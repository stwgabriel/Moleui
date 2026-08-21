package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The fixtures below build throwaway repositories on disk. Every shape here is
// one that exists on a real machine and that a naive scanner gets wrong.

func mustRun(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command(args[0], args[1:]...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=Test", "GIT_AUTHOR_EMAIL=test@example.com",
		"GIT_COMMITTER_NAME=Test", "GIT_COMMITTER_EMAIL=test@example.com",
		"GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_SYSTEM=/dev/null",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("%v in %s failed: %v\n%s", args, dir, err, out)
	}
	return string(out)
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

// initRepo creates a repo with one commit on the default branch.
func initRepo(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}
	mustRun(t, path, "git", "init", "-q", "-b", "main")
	mustRun(t, path, "git", "config", "user.email", "test@example.com")
	mustRun(t, path, "git", "config", "user.name", "Test")
	writeFile(t, filepath.Join(path, "README.md"), "hello\n")
	mustRun(t, path, "git", "add", "-A")
	mustRun(t, path, "git", "commit", "-qm", "initial")
}

func defaultOpts(root string) scanOptions {
	return scanOptions{
		Roots:         []string{root},
		MaxDepth:      6,
		ColdDays:      7,
		Concurrency:   4,
		GitTimeout:    30 * time.Second,
		RemoteTimeout: 5 * time.Second,
		Now:           time.Now(),
	}
}

func findEntry(t *testing.T, r *Report, suffix string) *Entry {
	t.Helper()
	for i := range r.Entries {
		if strings.HasSuffix(r.Entries[i].Path, suffix) {
			return &r.Entries[i]
		}
	}
	t.Fatalf("no entry ending in %q; got %s", suffix, entryPaths(r))
	return nil
}

func entryPaths(r *Report) string {
	var b strings.Builder
	for i := range r.Entries {
		b.WriteString("\n  " + r.Entries[i].RelPath + " (" + string(r.Entries[i].Kind) + ")")
	}
	return b.String()
}

func gateFor(e *Entry, id string) *Gate {
	for i := range e.Gates {
		if e.Gates[i].ID == id {
			return &e.Gates[i]
		}
	}
	return nil
}

// TestArchiveGateRequiresVerification is the central safety property: with no
// remote contact, nothing may ever be archivable, however cold and clean it is.
func TestArchiveGateRequiresVerification(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "clean-repo")
	initRepo(t, repo)
	mustRun(t, repo, "git", "remote", "add", "origin", "https://github.com/someone/clean-repo.git")

	opts := defaultOpts(root)
	opts.Now = time.Now().Add(400 * 24 * time.Hour) // force cold
	report := scan(context.Background(), opts)

	e := findEntry(t, report, "clean-repo")
	if !e.Activity.Cold {
		t.Fatalf("fixture should be cold, got %d days idle", e.Activity.DaysIdle)
	}
	if e.Archivable {
		t.Fatal("an unverified repo must never be archivable")
	}
	if g := gateFor(e, GateVerified); g == nil || g.OK {
		t.Fatalf("expected the verification gate to fail, got %+v", g)
	}
}

// TestWorktreeIsDetectedAndNeverArchivable covers the shape that cost the most
// on the real machine: a linked worktree whose gitdir points at a path that no
// longer exists. It reports no branches and no commits, so a size-based cleaner
// reads it as an empty folder that is safe to delete.
func TestWorktreeIsDetectedAndNeverArchivable(t *testing.T) {
	root := t.TempDir()
	main := filepath.Join(root, "main-repo")
	initRepo(t, main)
	wt := filepath.Join(root, "worktrees", "feature")
	mustRun(t, main, "git", "worktree", "add", "-q", "-b", "feature", wt)

	report := scan(context.Background(), defaultOpts(root))
	e := findEntry(t, report, filepath.Join("worktrees", "feature"))

	if e.Kind != KindWorktree {
		t.Fatalf("expected kind %q, got %q", KindWorktree, e.Kind)
	}
	if e.GitIsDir {
		t.Fatal("a linked worktree has .git as a file, not a directory")
	}
	// git records the fully resolved path, and on macOS t.TempDir() hands back
	// /var/... while the real directory is /private/var/...
	wantMain, err := filepath.EvalSymlinks(main)
	if err != nil {
		t.Fatal(err)
	}
	if e.Worktree == nil || e.Worktree.MainRepo != wantMain {
		t.Fatalf("main repo = %+v, want %s", e.Worktree, wantMain)
	}
	if e.Archivable {
		t.Fatal("a worktree must never be archivable on its own")
	}
}

func TestBrokenWorktreeIsFlaggedNotEmpty(t *testing.T) {
	root := t.TempDir()
	orphan := filepath.Join(root, "orphan-worktree")
	writeFile(t, filepath.Join(orphan, ".git"), "gitdir: /nonexistent/repo/.git/worktrees/orphan\n")
	writeFile(t, filepath.Join(orphan, "package.json"), "{}\n")

	report := scan(context.Background(), defaultOpts(root))
	e := findEntry(t, report, "orphan-worktree")

	if e.Kind != KindWorktree {
		t.Fatalf("expected worktree kind, got %q", e.Kind)
	}
	if e.Worktree == nil || !e.Worktree.Broken {
		t.Fatalf("expected broken worktree, got %+v", e.Worktree)
	}
	if e.Archivable {
		t.Fatal("a broken worktree must not be archivable")
	}
	if e.ScanError == "" {
		t.Fatal("a broken worktree should carry a scan error explaining itself")
	}
}

// TestNestedRepoBlocksParentAndFixesSize guards the double-counting bug: a
// parent repo's size includes its children, so an unadjusted "free up X GB"
// figure is fiction, and archiving the parent would take active children too.
func TestNestedRepoBlocksParentAndFixesSize(t *testing.T) {
	root := filepath.Join(t.TempDir(), "space in name")
	parent := filepath.Join(root, "parent")
	initRepo(t, parent)
	child := filepath.Join(parent, "vendored", "child")
	initRepo(t, child)
	// Give the child a payload so the parent's inclusive size is clearly larger.
	writeFile(t, filepath.Join(child, "blob.bin"), strings.Repeat("x", 300*1024))
	mustRun(t, child, "git", "add", "-A")
	mustRun(t, child, "git", "commit", "-qm", "blob")

	report := scan(context.Background(), defaultOpts(root))
	p := findEntry(t, report, filepath.Join("space in name", "parent"))
	c := findEntry(t, report, filepath.Join("vendored", "child"))

	if p.Kind != KindNestedParent {
		t.Fatalf("parent kind = %q, want %q", p.Kind, KindNestedParent)
	}
	if c.Kind != KindNestedChild {
		t.Fatalf("child kind = %q, want %q", c.Kind, KindNestedChild)
	}
	if c.Parent != parent {
		t.Fatalf("child parent = %q, want %q", c.Parent, parent)
	}
	if p.Size.ExclusiveKB >= p.Size.TotalKB {
		t.Fatalf("exclusive size (%d) must exclude the child (total %d)", p.Size.ExclusiveKB, p.Size.TotalKB)
	}
	if g := gateFor(p, GateNoChildren); g == nil || g.OK {
		t.Fatalf("parent should be blocked by nested repos, got %+v", g)
	}
}

// TestSharedRemoteBlocksBothCopies: two directories pushing to one remote means
// "verified pushed" is not a safe verdict for either of them.
func TestSharedRemoteBlocksBothCopies(t *testing.T) {
	root := t.TempDir()
	a := filepath.Join(root, "copy-a")
	b := filepath.Join(root, "copy-b")
	initRepo(t, a)
	initRepo(t, b)
	// Same repo reached two ways: HTTPS and an SSH host alias. Both must
	// normalize to the same identity.
	mustRun(t, a, "git", "remote", "add", "origin", "https://github.com/me/shared.git")
	mustRun(t, b, "git", "remote", "add", "origin", "git@github.com-work:me/shared.git")

	report := scan(context.Background(), defaultOpts(root))
	ea := findEntry(t, report, "copy-a")
	eb := findEntry(t, report, "copy-b")

	if len(ea.SharedWith) == 0 || len(eb.SharedWith) == 0 {
		t.Fatalf("both copies should report a shared remote: a=%v b=%v", ea.SharedWith, eb.SharedWith)
	}
	for _, e := range []*Entry{ea, eb} {
		if g := gateFor(e, GateRemoteUnique); g == nil || g.OK {
			t.Fatalf("%s should be blocked by the shared remote, got %+v", e.Name, g)
		}
	}
}

func TestStashAndDirtyBlockArchive(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "stashy")
	initRepo(t, repo)
	writeFile(t, filepath.Join(repo, "README.md"), "changed\n")
	mustRun(t, repo, "git", "stash", "-q")
	writeFile(t, filepath.Join(repo, "untracked.txt"), "new\n")

	report := scan(context.Background(), defaultOpts(root))
	e := findEntry(t, report, "stashy")

	if e.Stashes != 1 {
		t.Fatalf("stashes = %d, want 1", e.Stashes)
	}
	if g := gateFor(e, GateNoStashes); g == nil || g.OK {
		t.Fatalf("stash should block archiving, got %+v", g)
	}
	if e.Dirty.Untracked != 1 {
		t.Fatalf("untracked = %d, want 1", e.Dirty.Untracked)
	}
	if g := gateFor(e, GateCleanTree); g == nil || g.OK {
		t.Fatalf("dirty tree should block archiving, got %+v", g)
	}
}

// TestLocalOnlySecretsBlockArchive: gitignored credentials are invisible to
// every ref check, so a "fully pushed" repo can still be the only home for them.
func TestLocalOnlySecretsBlockArchive(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "secretive")
	initRepo(t, repo)
	writeFile(t, filepath.Join(repo, ".gitignore"), ".env.local\n*.sqlite\n")
	writeFile(t, filepath.Join(repo, ".env.local"), "TOKEN=abc\n")
	writeFile(t, filepath.Join(repo, "data.sqlite"), "binary\n")
	// A committed example file must not be mistaken for a secret.
	writeFile(t, filepath.Join(repo, ".env.example"), "TOKEN=\n")
	mustRun(t, repo, "git", "add", "-A")
	mustRun(t, repo, "git", "commit", "-qm", "ignore secrets")

	report := scan(context.Background(), defaultOpts(root))
	e := findEntry(t, report, "secretive")

	if len(e.LocalOnlyFiles) != 2 {
		t.Fatalf("local-only files = %v, want .env.local and data.sqlite", e.LocalOnlyFiles)
	}
	for _, f := range e.LocalOnlyFiles {
		if strings.Contains(f, "example") {
			t.Fatalf(".env.example is committed and must not be flagged: %v", e.LocalOnlyFiles)
		}
	}
	if g := gateFor(e, GateNoLocalOnly); g == nil || g.OK {
		t.Fatalf("local-only secrets should block archiving, got %+v", g)
	}
}

// TestColdnessUsesNewestRefNotHead: a repo whose default branch is ancient but
// which has a recent feature branch is not cold.
func TestColdnessUsesNewestRefNotHead(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "mixed-age")
	initRepo(t, repo)

	old := time.Now().Add(-400 * 24 * time.Hour).Format(time.RFC3339)
	cmd := exec.Command("git", "commit", "-q", "--allow-empty", "-m", "ancient", "--date", old)
	cmd.Dir = repo
	cmd.Env = append(os.Environ(),
		"GIT_AUTHOR_DATE="+old, "GIT_COMMITTER_DATE="+old,
		"GIT_AUTHOR_NAME=Test", "GIT_AUTHOR_EMAIL=test@example.com",
		"GIT_COMMITTER_NAME=Test", "GIT_COMMITTER_EMAIL=test@example.com")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("backdated commit failed: %v\n%s", err, out)
	}

	mustRun(t, repo, "git", "checkout", "-q", "-b", "recent")
	mustRun(t, repo, "git", "commit", "-q", "--allow-empty", "-m", "today")
	mustRun(t, repo, "git", "checkout", "-q", "main")

	// Age the working tree so the only recent signal left is the branch ref.
	// Without this the just-written files dominate and the test would pass for
	// the wrong reason.
	stale := time.Now().Add(-400 * 24 * time.Hour)
	if err := os.Chtimes(filepath.Join(repo, "README.md"), stale, stale); err != nil {
		t.Fatal(err)
	}

	report := scan(context.Background(), defaultOpts(root))
	e := findEntry(t, report, "mixed-age")

	if e.Activity.Cold {
		t.Fatalf("repo with a branch committed today must not be cold (idle %d days, source %q)",
			e.Activity.DaysIdle, e.Activity.Source)
	}
	if !strings.Contains(e.Activity.Source, "recent") {
		t.Fatalf("activity source = %q, want the recent branch", e.Activity.Source)
	}
}

func TestPlainFolderInsideRepoIsNotReported(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "monorepo")
	initRepo(t, repo)
	writeFile(t, filepath.Join(repo, "apps", "web", "package.json"), "{}\n")
	mustRun(t, repo, "git", "add", "-A")
	mustRun(t, repo, "git", "commit", "-qm", "add app")

	// A genuinely orphaned project outside any repo.
	writeFile(t, filepath.Join(root, "orphan", "package.json"), "{}\n")

	report := scan(context.Background(), defaultOpts(root))

	for i := range report.Entries {
		if strings.Contains(report.Entries[i].RelPath, filepath.Join("apps", "web")) {
			t.Fatalf("a tracked subdirectory must not be reported as an orphan: %s",
				report.Entries[i].RelPath)
		}
	}
	orphan := findEntry(t, report, "orphan")
	if orphan.Kind != KindPlain {
		t.Fatalf("orphan kind = %q, want %q", orphan.Kind, KindPlain)
	}
	if orphan.Archivable {
		t.Fatal("a folder with no git history must never be archivable")
	}
}

func TestNoCommitsRepoIsNeverArchivable(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "empty-repo")
	if err := os.MkdirAll(repo, 0o755); err != nil {
		t.Fatal(err)
	}
	mustRun(t, repo, "git", "init", "-q", "-b", "main")
	writeFile(t, filepath.Join(repo, "work.txt"), "uncommitted work\n")

	report := scan(context.Background(), defaultOpts(root))
	e := findEntry(t, report, "empty-repo")

	if e.HasCommits {
		t.Fatal("fixture has no commits")
	}
	if g := gateFor(e, GateHasCommits); g == nil || g.OK {
		t.Fatalf("a repo with no commits must be blocked, got %+v", g)
	}
	if e.Archivable {
		t.Fatal("a repo with no commits has nothing on a remote and must not be archivable")
	}
}

func TestSelfRepoIsNeverArchivable(t *testing.T) {
	root := t.TempDir()
	repo := filepath.Join(root, "mole")
	initRepo(t, repo)

	opts := defaultOpts(root)
	opts.SelfPath = repo
	opts.Now = time.Now().Add(400 * 24 * time.Hour)
	report := scan(context.Background(), opts)

	e := findEntry(t, report, "mole")
	if g := gateFor(e, GateNotSelf); g == nil || g.OK {
		t.Fatalf("Mole's own checkout must be excluded, got %+v", g)
	}
	if e.Archivable {
		t.Fatal("Mole must never nominate its own source tree")
	}
}

func TestVerifiedRepoBecomesArchivable(t *testing.T) {
	root := t.TempDir()
	// A bare repo on disk stands in for a reachable remote: ls-remote against a
	// local path exercises the same verification code path without a network.
	remote := filepath.Join(root, "origin.git")
	mustRun(t, root, "git", "init", "-q", "--bare", remote)

	repo := filepath.Join(root, "backed-up")
	initRepo(t, repo)
	mustRun(t, repo, "git", "remote", "add", "origin", remote)
	mustRun(t, repo, "git", "push", "-q", "-u", "origin", "main")
	mustRun(t, repo, "git", "tag", "v1")
	mustRun(t, repo, "git", "push", "-q", "origin", "v1")

	opts := defaultOpts(root)
	opts.Verify = true
	opts.Now = time.Now().Add(400 * 24 * time.Hour)
	report := scan(context.Background(), opts)

	e := findEntry(t, report, "backed-up")
	if !e.Archivable {
		var blockers []string
		for _, g := range e.Gates {
			if !g.OK {
				blockers = append(blockers, g.ID+": "+g.Detail)
			}
		}
		t.Fatalf("a cold, clean, fully pushed repo should be archivable; blocked by %v", blockers)
	}
	if len(e.Branches) != 1 || e.Branches[0].State != PushStateVerified {
		t.Fatalf("branch state = %+v, want verified", e.Branches)
	}
	if len(e.Tags) != 1 || e.Tags[0].State != PushStateVerified {
		t.Fatalf("tag state = %+v, want verified", e.Tags)
	}
}

// TestStaleUpstreamIsCaught is the reason verification cannot use ahead-counts:
// after the remote branch is deleted, the local remote-tracking ref survives and
// the branch still reports zero commits ahead.
func TestStaleUpstreamIsCaught(t *testing.T) {
	root := t.TempDir()
	remote := filepath.Join(root, "origin.git")
	mustRun(t, root, "git", "init", "-q", "--bare", remote)

	repo := filepath.Join(root, "stale")
	initRepo(t, repo)
	mustRun(t, repo, "git", "remote", "add", "origin", remote)
	mustRun(t, repo, "git", "checkout", "-q", "-b", "gone")
	mustRun(t, repo, "git", "commit", "-q", "--allow-empty", "-m", "work")
	mustRun(t, repo, "git", "push", "-q", "-u", "origin", "gone")
	// Delete it server-side; the local remote-tracking ref stays behind.
	mustRun(t, remote, "git", "update-ref", "-d", "refs/heads/gone")

	opts := defaultOpts(root)
	opts.Verify = true
	opts.Now = time.Now().Add(400 * 24 * time.Hour)
	report := scan(context.Background(), opts)

	e := findEntry(t, report, "stale")
	var gone *Branch
	for i := range e.Branches {
		if e.Branches[i].Name == "gone" {
			gone = &e.Branches[i]
		}
	}
	if gone == nil {
		t.Fatalf("branch 'gone' missing from %+v", e.Branches)
	}
	if gone.Ahead != 0 {
		t.Fatalf("precondition: ahead-count should still read 0, got %d", gone.Ahead)
	}
	if gone.State != PushStateStaleUpstream {
		t.Fatalf("branch state = %q, want %q", gone.State, PushStateStaleUpstream)
	}
	if e.Archivable {
		t.Fatal("a branch missing from the remote must block archiving even though ahead=0")
	}
}

// TestBranchBehindRemoteIsBackedUp: when the remote is ahead, every local commit
// is already stored server-side. Such a branch needs no push and must not block
// archiving, even though its SHA differs from the remote's.
func TestBranchBehindRemoteIsBackedUp(t *testing.T) {
	root := t.TempDir()
	remote := filepath.Join(root, "origin.git")
	// -b main so the bare repo's HEAD matches the branch being pushed; without
	// it the clone below lands on an unborn master and pushes unrelated history.
	mustRun(t, root, "git", "init", "-q", "--bare", "-b", "main", remote)

	repo := filepath.Join(root, "behind")
	initRepo(t, repo)
	mustRun(t, repo, "git", "remote", "add", "origin", remote)
	mustRun(t, repo, "git", "push", "-q", "-u", "origin", "main")

	// A second clone pushes an extra commit, leaving the first repo behind. It
	// lives outside the scanned root on purpose: inside it, the shared-remote
	// check would correctly flag both copies and mask what this test measures.
	outside := t.TempDir()
	other := filepath.Join(outside, "other")
	mustRun(t, outside, "git", "clone", "-q", remote, other)
	mustRun(t, other, "git", "config", "user.email", "test@example.com")
	mustRun(t, other, "git", "config", "user.name", "Test")
	mustRun(t, other, "git", "checkout", "-q", "main")
	mustRun(t, other, "git", "commit", "-q", "--allow-empty", "-m", "remote moved on")
	mustRun(t, other, "git", "push", "-q", "origin", "main")

	opts := defaultOpts(root)
	opts.Verify = true
	opts.Fetch = true
	opts.Now = time.Now().Add(400 * 24 * time.Hour)
	report := scan(context.Background(), opts)

	e := findEntry(t, report, filepath.Join(root, "behind"))
	if len(e.Branches) != 1 {
		t.Fatalf("expected one branch, got %+v", e.Branches)
	}
	if e.Branches[0].State != PushStateBehind {
		t.Fatalf("branch state = %q, want %q", e.Branches[0].State, PushStateBehind)
	}
	if e.NeedsPush {
		t.Fatalf("a branch that is merely behind needs no push, got %v", e.PushBranches)
	}
	if g := gateFor(e, GateRefsOnRemote); g == nil || !g.OK {
		t.Fatalf("a behind branch is fully stored on the remote and must pass, got %+v", g)
	}
	if !e.Archivable {
		var blockers []string
		for _, g := range e.Gates {
			if !g.OK {
				blockers = append(blockers, g.ID+": "+g.Detail)
			}
		}
		t.Fatalf("repo behind its remote should still be archivable; blocked by %v", blockers)
	}
}

// TestOrganizeTargetsAreUnique: two repositories with the same directory name
// must not be proposed into the same destination. A user applying the printed
// plan by hand would otherwise overwrite one with the other.
func TestOrganizeTargetsAreUnique(t *testing.T) {
	root := t.TempDir()
	// Same basename, different parents, and both cold: exactly the shape that
	// occurs when one project is checked out under two organisations.
	initRepo(t, filepath.Join(root, "AgencyA", "cms"))
	initRepo(t, filepath.Join(root, "AgencyB", "cms"))

	opts := defaultOpts(root)
	opts.Now = time.Now().Add(400 * 24 * time.Hour)
	report := scan(context.Background(), opts)

	seen := make(map[string]string)
	for _, m := range report.Organize {
		if m.To == "" {
			continue
		}
		if prev, clash := seen[m.To]; clash {
			t.Fatalf("two proposals target %q: %q and %q", m.To, prev, m.From)
		}
		seen[m.To] = m.From
	}
	if len(seen) < 2 {
		t.Fatalf("expected a proposal for each repo, got %d: %+v", len(seen), report.Organize)
	}
}

func TestParseRemoteNormalization(t *testing.T) {
	cases := []struct {
		raw        string
		host       string
		owner      string
		repo       string
		normalized string
		alias      string
	}{
		{"git@github.com:owner/repo.git", "github.com", "owner", "repo", "github.com/owner/repo", ""},
		{"https://github.com/owner/repo.git", "github.com", "owner", "repo", "github.com/owner/repo", ""},
		{"git@github.com-npdigital:owner/repo.git", "github.com", "owner", "repo", "github.com/owner/repo", "github.com-npdigital"},
		{"https://user@bitbucket.org/owner/repo.git", "bitbucket.org", "owner", "repo", "bitbucket.org/owner/repo", ""},
		{"ssh://git@gitlab.com/group/sub/repo.git", "gitlab.com", "group/sub", "repo", "gitlab.com/group/sub/repo", ""},
	}
	for _, c := range cases {
		r := parseRemote("origin", c.raw)
		if r == nil {
			t.Fatalf("%s: parsed to nil", c.raw)
		}
		if r.Host != c.host || r.Owner != c.owner || r.Repo != c.repo {
			t.Errorf("%s: host/owner/repo = %s/%s/%s, want %s/%s/%s",
				c.raw, r.Host, r.Owner, r.Repo, c.host, c.owner, c.repo)
		}
		if r.Normalized != c.normalized {
			t.Errorf("%s: normalized = %q, want %q", c.raw, r.Normalized, c.normalized)
		}
		if r.SSHAlias != c.alias {
			t.Errorf("%s: alias = %q, want %q", c.raw, r.SSHAlias, c.alias)
		}
	}
}

// TestRemoteGoneClassification pins the distinction that decides whether a user
// is told their code has no backup.
func TestRemoteGoneClassification(t *testing.T) {
	gone := []string{
		"Repository not found.",
		"ERROR: Repository not found.",
		"remote: Repository does not exist",
	}
	for _, msg := range gone {
		if !remoteGone(msg) {
			t.Errorf("%q should read as a missing remote", msg)
		}
	}
	notGone := []string{
		"git@bitbucket.org: Permission denied (publickey).",
		"fatal: Authentication failed for 'https://example.com/x.git/'",
		"Repository not found. Permission denied",
	}
	for _, msg := range notGone {
		if remoteGone(msg) {
			t.Errorf("%q must not read as a missing remote", msg)
		}
	}
	for _, msg := range []string{
		"git@bitbucket.org: Permission denied (publickey).",
		"fatal: Authentication failed",
		"fatal: could not read Password for 'https://x@bitbucket.org'",
	} {
		if !remoteAuthFailed(msg) {
			t.Errorf("%q should read as an auth failure", msg)
		}
	}
}

func TestSSHFallbackURL(t *testing.T) {
	if got := sshFallbackURL(parseRemote("origin", "https://github.com/me/x.git")); got != "git@github.com:me/x.git" {
		t.Errorf("fallback = %q", got)
	}
	// SSH remotes have nothing to fall back to.
	if got := sshFallbackURL(parseRemote("origin", "git@github.com:me/x.git")); got != "" {
		t.Errorf("ssh remote should have no fallback, got %q", got)
	}
	// Unknown hosts must not be guessed at.
	if got := sshFallbackURL(parseRemote("origin", "https://git.internal.example/me/x.git")); got != "" {
		t.Errorf("unknown host should have no fallback, got %q", got)
	}
}

func TestIsRisky(t *testing.T) {
	risky := []string{".env", ".env.local", ".env.production", "id_rsa", "data.sqlite", "cert.pem", "terraform.tfstate"}
	for _, n := range risky {
		if !isRisky(n) {
			t.Errorf("%q should be treated as local-only", n)
		}
	}
	safe := []string{".env.example", ".env.sample", ".env.template", "README.md", "main.go", "package.json"}
	for _, n := range safe {
		if isRisky(n) {
			t.Errorf("%q must not be flagged", n)
		}
	}
}
