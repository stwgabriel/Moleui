package main

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// scanOptions carries the knobs a caller can turn.
type scanOptions struct {
	Roots         []string
	MaxDepth      int
	ColdDays      int
	Verify        bool
	Concurrency   int
	GitTimeout    time.Duration
	RemoteTimeout time.Duration
	OwnOwners     []string
	Now           time.Time
	SelfPath      string
	// Fetch updates remote-tracking refs before comparing. It makes "is my
	// branch already contained in the remote?" answerable instead of unknown.
	Fetch bool
}

// scan runs discovery, then inspects every candidate concurrently, then applies
// the cross-repo passes (nesting, remote collisions, gates) that need the full
// set before they can be decided.
func scan(ctx context.Context, opts scanOptions) *Report {
	started := time.Now()

	cands, warnings := discover(opts.Roots, opts.MaxDepth)

	entries := make([]Entry, len(cands))
	sem := make(chan struct{}, max(1, opts.Concurrency))
	var wg sync.WaitGroup

	for i, c := range cands {
		wg.Go(func() {
			sem <- struct{}{}
			defer func() { <-sem }()
			entries[i] = inspect(ctx, c, opts)
		})
	}
	wg.Wait()

	linkNesting(entries)
	groupRemotes(entries)

	if opts.Verify {
		verifyRemotes(ctx, entries, opts)
	}

	for i := range entries {
		evaluate(&entries[i], opts)
	}

	report := &Report{
		Version:    1,
		ScannedAt:  opts.Now.UTC().Format(time.RFC3339),
		Roots:      opts.Roots,
		ColdDays:   opts.ColdDays,
		Verified:   opts.Verify,
		Entries:    entries,
		Warnings:   warnings,
		Organize:   proposeOrganize(entries, opts),
		DurationMS: time.Since(started).Milliseconds(),
	}
	report.Summary = summarize(entries)
	return report
}

// inspect gathers everything knowable about one directory without touching the
// network. Failures degrade to a ScanError on the entry rather than killing the
// scan, so one broken repo still leaves 63 useful rows.
func inspect(ctx context.Context, c candidate, opts scanOptions) Entry {
	e := Entry{
		Path:    c.path,
		Name:    filepath.Base(c.path),
		Root:    c.root,
		Markers: c.markers,
	}
	if rel, err := filepath.Rel(c.root, c.path); err == nil {
		e.RelPath = rel
	} else {
		e.RelPath = c.path
	}

	if !c.isRepo {
		e.Kind = KindPlain
		e.Ownership = OwnershipNone
		size, newest, _ := dirStats(c.path, nil)
		e.Size = Size{TotalKB: size, ExclusiveKB: size}
		e.Activity = activityFrom(newest, "file mtime", opts)
		return e
	}

	e.GitIsDir = c.gitIsDir
	e.Kind = KindStandalone

	cctx, cancel := context.WithTimeout(ctx, opts.GitTimeout)
	defer cancel()

	// A .git file means a linked worktree (or a submodule). The gitdir target is
	// an absolute path recorded at creation time, so it goes stale the moment
	// the main repo moves; a stale target is exactly the state that looks like
	// "empty repo, safe to delete" to a naive scanner.
	if !c.gitIsDir {
		e.Kind = KindWorktree
		e.Worktree = worktreeInfo(c.gitPath)
	}

	if gitDir, err := git(cctx, c.path, "rev-parse", "--absolute-git-dir"); err == nil {
		e.GitDir = gitDir
	} else if e.Worktree != nil && e.Worktree.Broken {
		// Broken worktree: git refuses every command, so record what the .git
		// file claimed and stop. Everything downstream treats it as unverifiable.
		e.ScanError = "worktree gitdir is missing: " + e.Worktree.GitDir
		size, newest, _ := dirStats(c.path, nil)
		e.Size = Size{TotalKB: size, ExclusiveKB: size}
		e.Activity = activityFrom(newest, "file mtime", opts)
		return e
	} else {
		e.ScanError = "not a usable git repository: " + err.Error()
		size, newest, _ := dirStats(c.path, nil)
		e.Size = Size{TotalKB: size, ExclusiveKB: size}
		e.Activity = activityFrom(newest, "file mtime", opts)
		return e
	}

	if head, err := git(cctx, c.path, "rev-parse", "HEAD"); err == nil && head != "" {
		e.HasCommits = true
		e.HeadSHA = head
	}
	if branch, err := git(cctx, c.path, "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		e.HeadBranch = branch
		e.Detached = branch == "HEAD"
	}
	if bare, err := git(cctx, c.path, "rev-parse", "--is-bare-repository"); err == nil && bare == "true" {
		e.BareOrEmpty = true
	}
	if !e.HasCommits {
		e.BareOrEmpty = true
	}

	e.Remote, e.OtherRemote = remotesFor(cctx, c.path)
	e.Branches = branchesFor(cctx, c.path)
	e.Tags = tagsFor(cctx, c.path)
	e.Stashes = stashCount(cctx, c.path)
	e.Dirty = dirtyFor(cctx, c.path)
	e.Submodules = submodulesFor(cctx, c.path)
	e.Ownership = ownershipFor(cctx, c.path, e.Remote, opts.OwnOwners)

	tracked := trackedFiles(cctx, c.path)
	size, newest, risky := dirStats(c.path, tracked)
	e.Size = Size{TotalKB: size, ExclusiveKB: size}
	e.LocalOnlyFiles = risky

	// Freshness is the newest of every ref and the working tree. HEAD's date
	// alone under-reports: a repo can sit on a 2023 default branch while a
	// feature branch was committed yesterday.
	last, source := newest, "file mtime"
	for _, b := range e.Branches {
		if t, err := time.Parse(time.RFC3339, b.Committed); err == nil && t.After(last) {
			last, source = t, "branch "+b.Name
		}
	}
	e.Activity = activityFrom(last, source, opts)

	return e
}

// worktreeInfo parses the `gitdir: <path>` pointer file.
func worktreeInfo(gitFile string) *Worktree {
	w := &Worktree{}
	data, err := os.ReadFile(gitFile)
	if err != nil {
		w.Broken = true
		return w
	}
	line := strings.TrimSpace(string(data))
	if !strings.HasPrefix(line, "gitdir:") {
		w.Broken = true
		return w
	}
	target := strings.TrimSpace(strings.TrimPrefix(line, "gitdir:"))
	w.GitDir = target
	if _, err := os.Stat(target); err != nil {
		w.Broken = true
		w.Prunable = true
	}
	// .git/worktrees/<name> lives inside the main repo's git dir; two levels up
	// is that git dir, and its parent is the main working copy.
	if before, _, ok := strings.Cut(target, string(os.PathSeparator)+".git"+string(os.PathSeparator)+"worktrees"+string(os.PathSeparator)); ok {
		w.MainRepo = before
	}
	return w
}

func remotesFor(ctx context.Context, dir string) (*Remote, []string) {
	lines, err := gitLines(ctx, dir, "remote", "-v")
	if err != nil || len(lines) == 0 {
		return nil, nil
	}
	seen := make(map[string]string)
	var order []string
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		if _, ok := seen[fields[0]]; !ok {
			seen[fields[0]] = fields[1]
			order = append(order, fields[0])
		}
	}
	if len(order) == 0 {
		return nil, nil
	}
	primary := "origin"
	if _, ok := seen["origin"]; !ok {
		primary = order[0]
	}
	var others []string
	for _, name := range order {
		if name != primary {
			others = append(others, name+" "+seen[name])
		}
	}
	return parseRemote(primary, seen[primary]), others
}

func branchesFor(ctx context.Context, dir string) []Branch {
	lines, err := gitLines(ctx, dir, "for-each-ref", "--format="+refFormat, "refs/heads")
	if err != nil {
		return nil
	}
	refs := parseRefLines(lines)
	out := make([]Branch, 0, len(refs))
	for _, r := range refs {
		b := Branch{Name: r.name, SHA: r.sha, Upstream: r.upstream, State: PushStateUnverified}
		if !r.committed.IsZero() {
			b.Committed = r.committed.UTC().Format(time.RFC3339)
		}
		if r.upstream == "" {
			b.State = PushStateNoUpstream
		} else if counts, err := git(ctx, dir, "rev-list", "--left-right", "--count", r.upstream+"..."+r.name); err == nil {
			f := strings.Fields(counts)
			if len(f) == 2 {
				b.Behind, _ = strconv.Atoi(f[0])
				b.Ahead, _ = strconv.Atoi(f[1])
				if b.Ahead > 0 {
					b.State = PushStateAhead
				}
			}
		}
		out = append(out, b)
	}
	return out
}

func tagsFor(ctx context.Context, dir string) []Tag {
	lines, err := gitLines(ctx, dir, "for-each-ref", "--format=%(refname:short)%09%(objectname)", "refs/tags")
	if err != nil {
		return nil
	}
	out := make([]Tag, 0, len(lines))
	for _, line := range lines {
		f := strings.Split(line, "\t")
		if len(f) < 2 {
			continue
		}
		out = append(out, Tag{Name: f[0], SHA: f[1], State: PushStateUnverified})
	}
	return out
}

func stashCount(ctx context.Context, dir string) int {
	lines, err := gitLines(ctx, dir, "stash", "list")
	if err != nil {
		return 0
	}
	return len(lines)
}

func dirtyFor(ctx context.Context, dir string) Dirty {
	var d Dirty
	// --untracked-files=all so a directory of new work counts every file rather
	// than collapsing to one entry.
	lines, err := gitLines(ctx, dir, "status", "--porcelain", "--untracked-files=all")
	if err != nil {
		return d
	}
	for _, line := range lines {
		if strings.HasPrefix(line, "??") {
			d.Untracked++
		} else {
			d.Tracked++
		}
	}
	d.Total = d.Tracked + d.Untracked
	return d
}

func submodulesFor(ctx context.Context, dir string) Submodules {
	var s Submodules
	lines, err := gitLines(ctx, dir, "submodule", "status", "--recursive")
	if err != nil {
		return s
	}
	for _, line := range lines {
		s.Count++
		// git marks a submodule needing attention with a leading +, - or U.
		if len(line) > 0 && (line[0] == '+' || line[0] == '-' || line[0] == 'U') {
			s.Dirty++
		}
	}
	return s
}

func trackedFiles(ctx context.Context, dir string) map[string]bool {
	out, err := git(ctx, dir, "ls-files")
	if err != nil {
		return nil
	}
	lines := splitLines(out)
	set := make(map[string]bool, len(lines))
	for _, l := range lines {
		set[l] = true
	}
	return set
}

// ownershipFor decides whether this remote is one the user can push to.
//
// The reliable signal is authorship: a repo the user actually works on has
// commits by their configured identity. A cloned third-party tool has none.
// An explicit owner allowlist wins over the heuristic.
func ownershipFor(ctx context.Context, dir string, remote *Remote, ownOwners []string) Ownership {
	if remote == nil {
		return OwnershipNone
	}
	owner := strings.ToLower(remote.Owner)
	for _, o := range ownOwners {
		if strings.EqualFold(strings.TrimSpace(o), owner) {
			return OwnershipOwn
		}
	}

	email, _ := git(ctx, dir, "config", "user.email")
	name, _ := git(ctx, dir, "config", "user.name")
	for _, ident := range []string{email, name} {
		if strings.TrimSpace(ident) == "" {
			continue
		}
		if out, err := git(ctx, dir, "log", "-1", "--format=%H", "--author="+ident, "--all"); err == nil && strings.TrimSpace(out) != "" {
			return OwnershipOwn
		}
	}

	if head, err := git(ctx, dir, "rev-parse", "HEAD"); err != nil || head == "" {
		return OwnershipUnknown
	}
	return OwnershipThirdParty
}

func activityFrom(last time.Time, source string, opts scanOptions) Activity {
	a := Activity{Source: source}
	if last.IsZero() {
		a.Last = ""
		a.DaysIdle = -1
		a.Cold = false
		return a
	}
	a.Last = last.UTC().Format(time.RFC3339)
	days := max(int(opts.Now.Sub(last).Hours()/24), 0)
	a.DaysIdle = days
	a.Cold = days >= opts.ColdDays
	return a
}

// linkNesting marks parent/child repositories and rewrites exclusive size.
// Without this, a parent's reported size double-counts its children and
// archiving the parent would silently take active child repos with it.
func linkNesting(entries []Entry) {
	for i := range entries {
		if entries[i].Kind == KindPlain {
			continue
		}
		prefix := entries[i].Path + string(os.PathSeparator)
		for j := range entries {
			if i == j || entries[j].Kind == KindPlain {
				continue
			}
			if strings.HasPrefix(entries[j].Path, prefix) {
				entries[i].Children = append(entries[i].Children, entries[j].Path)
			}
		}
	}

	for i := range entries {
		if len(entries[i].Children) > 0 && entries[i].Kind == KindStandalone {
			entries[i].Kind = KindNestedParent
		}
	}

	// Deepest enclosing repo wins as parent, so a grandchild is not attributed
	// to the top-level repo.
	for i := range entries {
		best := ""
		for j := range entries {
			if i == j || entries[j].Kind == KindPlain {
				continue
			}
			prefix := entries[j].Path + string(os.PathSeparator)
			if strings.HasPrefix(entries[i].Path, prefix) && len(entries[j].Path) > len(best) {
				best = entries[j].Path
			}
		}
		if best != "" {
			entries[i].Parent = best
			if entries[i].Kind == KindStandalone {
				entries[i].Kind = KindNestedChild
			}
		}
	}

	byPath := make(map[string]*Entry, len(entries))
	for i := range entries {
		byPath[entries[i].Path] = &entries[i]
	}
	for i := range entries {
		exclusive := entries[i].Size.TotalKB
		for _, child := range entries[i].Children {
			if c, ok := byPath[child]; ok && c.Parent == entries[i].Path {
				exclusive -= c.Size.TotalKB
			}
		}
		if exclusive < 0 {
			exclusive = 0
		}
		entries[i].Size.ExclusiveKB = exclusive
	}
}

// groupRemotes records, for each entry, the other local directories pointing at
// the same remote. Two working copies sharing one remote means "verified
// pushed" is not a safe verdict for either: whichever is checked second may be
// looking at refs the first one pushed.
func groupRemotes(entries []Entry) {
	byRemote := make(map[string][]string)
	for i := range entries {
		if entries[i].Remote == nil || entries[i].Remote.Normalized == "" {
			continue
		}
		byRemote[entries[i].Remote.Normalized] = append(byRemote[entries[i].Remote.Normalized], entries[i].Path)
	}
	for i := range entries {
		if entries[i].Remote == nil {
			continue
		}
		peers := byRemote[entries[i].Remote.Normalized]
		if len(peers) < 2 {
			continue
		}
		for _, p := range peers {
			if p != entries[i].Path {
				entries[i].SharedWith = append(entries[i].SharedWith, p)
			}
		}
	}
}

// verifyOutcome is the result of contacting one remote, including which
// transport answered and how a failure should be read.
type verifyOutcome struct {
	refs       map[string]string
	via        string
	errMsg     string
	ok         bool
	missing    bool
	authFailed bool
	ambiguous  bool
}

// checkRemote contacts a remote, falling back to SSH when an HTTPS attempt
// fails, and classifies the outcome.
//
// The classification is deliberately conservative: "missing" is only claimed
// when an authenticated transport reported the repository absent. Anything less
// certain stays ambiguous, because wrongly declaring a remote dead would send
// the user chasing a backup they already have, while wrongly declaring one
// healthy could cost them code.
func checkRemote(ctx context.Context, dir string, remote *Remote, timeout time.Duration) verifyOutcome {
	refs, err := lsRemoteRefs(ctx, dir, remote.Name, timeout)
	if err == nil {
		return verifyOutcome{refs: refs, via: remote.Name, ok: true}
	}
	primaryMsg := cleanGitError(err.Error())

	fallback := sshFallbackURL(remote)
	if fallback == "" {
		out := verifyOutcome{errMsg: primaryMsg}
		switch {
		case remote.Scheme == "ssh" && remoteGone(primaryMsg):
			// SSH identified us by key, so "not found" is authoritative.
			out.missing = true
		case remoteAuthFailed(primaryMsg):
			out.authFailed = true
		case remoteGone(primaryMsg):
			// HTTPS 404 with no SSH form to try: cannot tell missing from
			// unauthorised.
			out.ambiguous = true
		default:
			out.authFailed = true
		}
		return out
	}

	fbRefs, fbErr := lsRemoteRefs(ctx, dir, fallback, timeout)
	if fbErr == nil {
		return verifyOutcome{refs: fbRefs, via: "ssh:" + fallback, ok: true}
	}
	fbMsg := cleanGitError(fbErr.Error())

	out := verifyOutcome{errMsg: primaryMsg + " (over SSH: " + fbMsg + ")"}
	switch {
	case remoteAuthFailed(fbMsg):
		// Neither transport could log in; the repo may be perfectly fine.
		out.authFailed = true
	case remoteGone(fbMsg):
		// SSH authenticated and still reported it absent.
		out.missing = true
	default:
		out.ambiguous = true
	}
	return out
}

// verifyRemotes resolves every local ref against the server. Results are cached
// per remote URL so two copies of one repo cost a single network round trip.
func verifyRemotes(ctx context.Context, entries []Entry, opts scanOptions) {
	var mu sync.Mutex
	cache := make(map[string]verifyOutcome)

	sem := make(chan struct{}, max(1, min(opts.Concurrency, 8)))
	var wg sync.WaitGroup

	for i := range entries {
		e := &entries[i]
		if e.Remote == nil || !e.HasCommits {
			continue
		}
		wg.Go(func() {
			sem <- struct{}{}
			defer func() { <-sem }()

			key := e.Remote.URL
			mu.Lock()
			cached, ok := cache[key]
			mu.Unlock()

			// Fetch before the ref comparison so a branch that is merely behind
			// can be recognised as fully stored rather than unknown. Failures
			// are ignored: the comparison below still runs and simply reports
			// needs_fetch where it cannot prove containment.
			if opts.Fetch {
				_ = fetchRemote(ctx, e.Path, e.Remote.Name, opts.RemoteTimeout)
			}

			if !ok {
				cached = checkRemote(ctx, e.Path, e.Remote, opts.RemoteTimeout)
				mu.Lock()
				cache[key] = cached
				mu.Unlock()
			}

			e.Remote.VerifyAttempted = true
			if !cached.ok {
				e.Remote.VerifyOK = false
				e.Remote.VerifyError = cached.errMsg
				e.Remote.Missing = cached.missing
				e.Remote.AuthFailed = cached.authFailed
				e.Remote.Ambiguous = cached.ambiguous
				return
			}
			e.Remote.VerifyOK = true
			e.Remote.VerifiedVia = cached.via

			for bi := range e.Branches {
				b := &e.Branches[bi]
				remoteSHA, present := cached.refs["refs/heads/"+b.Name]
				switch {
				case present && remoteSHA == b.SHA:
					b.State = PushStateVerified
				case present:
					// SHAs differ, which alone says nothing about direction.
					contained, known := containedIn(ctx, e.Path, b.SHA, remoteSHA)
					switch {
					case contained:
						b.State = PushStateBehind
					case known:
						b.State = PushStateAhead
					default:
						b.State = PushStateNeedsFetch
					}
				case b.Upstream != "":
					// Upstream configured but the branch is gone server-side:
					// the local remote-tracking ref is a stale cache.
					b.State = PushStateStaleUpstream
				default:
					b.State = PushStateNoUpstream
				}
			}
			for ti := range e.Tags {
				t := &e.Tags[ti]
				if remoteSHA, present := cached.refs["refs/tags/"+t.Name]; present && remoteSHA == t.SHA {
					t.State = PushStateVerified
				} else if present {
					t.State = PushStateAhead
				} else {
					t.State = PushStateNoUpstream
				}
			}
		})
	}
	wg.Wait()
}

// remoteGone matches the host telling us the repository does not exist. Kept
// deliberately narrow: mistaking an auth failure for a deleted remote would
// raise a false alarm, and mistaking a deleted remote for an auth failure would
// hide the one case where the local copy is the only copy.
func remoteGone(msg string) bool {
	lower := strings.ToLower(msg)
	for _, pat := range []string{
		"repository not found",
		"not found",
		"does not exist",
		"repository does not exist",
		"no such repository",
		"could not read from remote repository. please make sure",
	} {
		if strings.Contains(lower, pat) {
			// "Permission denied" plus "not found" happens when a host hides
			// private repos from unauthenticated users; treat that as auth.
			return !strings.Contains(lower, "permission denied") &&
				!strings.Contains(lower, "authentication failed")
		}
	}
	return false
}

func remoteAuthFailed(msg string) bool {
	lower := strings.ToLower(msg)
	for _, pat := range []string{
		"permission denied",
		"authentication failed",
		"could not read from remote repository",
		"access denied",
		"invalid credentials",
		"terminal prompts disabled",
		"host key verification failed",
		// git asks for a password it cannot prompt for; this is a credential
		// problem, not a missing repository.
		"could not read password",
		"could not read username",
		"no such identity",
		"unauthorized",
	} {
		if strings.Contains(lower, pat) {
			return true
		}
	}
	return false
}

func cleanGitError(msg string) string {
	msg = strings.TrimSpace(msg)
	if msg == "" {
		return "remote check failed"
	}
	if len(msg) > 200 {
		return msg[:200]
	}
	return msg
}

// noBackup reports that nothing about this directory exists off this machine:
// no git history at all, no remote configured, or a remote that has been
// deleted. These are the entries that can never be safely cleaned up, and the
// ones worth acting on first.
func noBackup(e *Entry) bool {
	if e.Kind == KindPlain {
		return true
	}
	if e.Kind == KindWorktree {
		return false
	}
	if !e.HasCommits {
		return true
	}
	if e.Remote == nil {
		return true
	}
	return e.Remote.Missing
}

func summarize(entries []Entry) Summary {
	var s Summary
	for i := range entries {
		e := &entries[i]
		s.Total++
		s.TotalKB += e.Size.ExclusiveKB
		switch e.Kind {
		case KindPlain:
			s.Plain++
			s.NoRemote++
		case KindWorktree:
			s.Worktrees++
		default:
			s.Repos++
			if e.Remote == nil {
				s.NoRemote++
			}
		}
		if e.Ownership == OwnershipThirdParty {
			s.ThirdParty++
		}
		if e.NeedsPush {
			s.NeedsPush++
		}
		if e.Dirty.Total > 0 {
			s.Dirty++
		}
		if e.Activity.Cold {
			s.Cold++
		}
		if len(e.SharedWith) > 0 {
			s.RemoteConflict++
		}
		if e.Remote != nil && e.Remote.VerifyAttempted && !e.Remote.VerifyOK {
			s.Unverified++
			if e.Remote.Missing {
				s.RemoteMissing++
			}
			if e.Remote.AuthFailed {
				s.AuthFailed++
			}
		}
		if noBackup(e) {
			s.NoBackup++
		}
		if e.Archivable {
			s.Archivable++
			s.ReclaimableKB += e.Size.ExclusiveKB
		}
	}
	return s
}
