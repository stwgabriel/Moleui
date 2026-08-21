package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Gate IDs. Stable strings: the shell archive path re-reads these and refuses to
// act on an entry whose gate set it does not recognise.
const (
	GateNotSelf      = "not_self"
	GateKind         = "kind"
	GateHasRemote    = "has_remote"
	GateRemoteUnique = "remote_unique"
	GateVerified     = "refs_verified"
	GateRefsOnRemote = "refs_on_remote"
	GateTagsOnRemote = "tags_on_remote"
	GateCleanTree    = "clean_tree"
	GateNoStashes    = "no_stashes"
	GateSubmodules   = "submodules_clean"
	GateNoLocalOnly  = "no_local_only_files"
	GateNoChildren   = "no_nested_repos"
	GateCold         = "cold"
	GateHasCommits   = "has_commits"
	GateScanOK       = "scan_ok"
)

// evaluate fills in the push plan and the archive gates for one entry.
//
// Every gate must pass for Archivable. Coldness is the last and weakest of
// them: being untouched for a week says nothing about whether the work exists
// anywhere else, which is what the other gates establish.
func evaluate(e *Entry, opts scanOptions) {
	evaluatePush(e)

	var gates []Gate
	add := func(id, label string, ok bool, detail string) {
		gates = append(gates, Gate{ID: id, Label: label, OK: ok, Detail: detail})
	}

	// Never offer to delete the checkout this tool is running from.
	isSelf := opts.SelfPath != "" && (e.Path == opts.SelfPath || strings.HasPrefix(opts.SelfPath, e.Path+string(os.PathSeparator)))
	add(GateNotSelf, "Not Mole's own checkout", !isSelf, detailIf(isSelf, "this is the Mole repository itself"))

	add(GateScanOK, "Scanned cleanly", e.ScanError == "", e.ScanError)

	switch e.Kind {
	case KindPlain:
		add(GateKind, "Is a git repository", false, "no git repository, so nothing is on a remote")
	case KindWorktree:
		reason := "linked worktree; remove with `git worktree remove` from the main repo"
		if e.Worktree != nil && e.Worktree.Broken {
			reason = "orphaned worktree pointing at a missing gitdir: " + e.Worktree.GitDir
		}
		add(GateKind, "Not a linked worktree", false, reason)
	default:
		add(GateKind, "Not a linked worktree", true, "")
	}

	add(GateHasCommits, "Has commits", e.HasCommits,
		detailIf(!e.HasCommits, "no commits exist, so nothing has ever been pushed"))

	hasChildren := len(e.Children) > 0
	add(GateNoChildren, "No nested repositories", !hasChildren,
		detailIf(hasChildren, fmt.Sprintf("contains %d nested repositor%s that would be deleted with it",
			len(e.Children), plural(len(e.Children), "y", "ies"))))

	hasRemote := e.Remote != nil
	add(GateHasRemote, "Has a remote", hasRemote, detailIf(!hasRemote, "no remote configured"))

	shared := len(e.SharedWith) > 0
	add(GateRemoteUnique, "Remote not shared with another copy", !shared,
		detailIf(shared, "same remote as "+strings.Join(shortPaths(e.SharedWith), ", ")))

	verified := hasRemote && e.Remote.VerifyAttempted && e.Remote.VerifyOK
	verifyDetail := ""
	switch {
	case !hasRemote:
		verifyDetail = "no remote to verify against"
	case !e.Remote.VerifyAttempted:
		verifyDetail = "remote was not contacted; run with --verify"
	case e.Remote.Missing:
		// The dangerous case: remote-tracking refs still exist locally, so the
		// branches look pushed, but an authenticated request cannot see the
		// remote. Deleted, renamed, or access revoked are indistinguishable
		// from here, and all three mean the same thing for safety.
		verifyDetail = "authenticated but the remote is not reachable (" + e.Remote.VerifyError +
			"): deleted, renamed, or your access was revoked. Treat this copy as the only one."
	case e.Remote.AuthFailed:
		verifyDetail = "cannot authenticate to " + e.Remote.Host + ": " + e.Remote.VerifyError
	case e.Remote.Ambiguous:
		verifyDetail = "the remote returned \"not found\" without authenticating, so it is " +
			"either deleted or private and unreachable: " + e.Remote.VerifyError
	case !e.Remote.VerifyOK:
		verifyDetail = "remote unreachable: " + e.Remote.VerifyError
	}
	add(GateVerified, "Remote reachable and verified", verified, verifyDetail)

	// Ref checks only mean something once the remote answered. Without
	// verification they stay false rather than optimistically true.
	//
	// This uses unverifiedBranches, not unpushedBranches: a branch whose state
	// cannot be established is not safe to delete even though no push would
	// help it.
	unproven := unverifiedBranches(e)
	refsOK := verified && len(unproven) == 0
	refsDetail := ""
	if verified && len(unproven) > 0 {
		refsDetail = fmt.Sprintf("%d branch%s not confirmed on the remote: %s",
			len(unproven), plural(len(unproven), "", "es"), strings.Join(truncate(unproven, 5), ", "))
	} else if !verified {
		refsDetail = "unverified"
	}
	add(GateRefsOnRemote, "Every branch is on the remote", refsOK, refsDetail)

	unpushedTags := unpushedTagNames(e)
	tagsOK := verified && len(unpushedTags) == 0
	tagsDetail := ""
	if verified && len(unpushedTags) > 0 {
		tagsDetail = fmt.Sprintf("%d tag%s not on the remote: %s",
			len(unpushedTags), plural(len(unpushedTags), "", "s"), strings.Join(truncate(unpushedTags, 5), ", "))
	} else if !verified {
		tagsDetail = "unverified"
	}
	add(GateTagsOnRemote, "Every tag is on the remote", tagsOK, tagsDetail)

	cleanTree := e.Dirty.Total == 0
	add(GateCleanTree, "No uncommitted changes", cleanTree,
		detailIf(!cleanTree, fmt.Sprintf("%d changed, %d untracked", e.Dirty.Tracked, e.Dirty.Untracked)))

	noStash := e.Stashes == 0
	add(GateNoStashes, "No stashes", noStash,
		detailIf(!noStash, fmt.Sprintf("%d stash%s exist only on this machine", e.Stashes, plural(e.Stashes, "", "es"))))

	subsOK := e.Submodules.Dirty == 0
	add(GateSubmodules, "Submodules clean", subsOK,
		detailIf(!subsOK, fmt.Sprintf("%d submodule%s have local state", e.Submodules.Dirty, plural(e.Submodules.Dirty, "", "s"))))

	// Gitignored credentials and local databases are invisible to every ref
	// check above. They are the one thing a "fully pushed" repo can still lose.
	noLocalOnly := len(e.LocalOnlyFiles) == 0
	add(GateNoLocalOnly, "No local-only secrets or databases", noLocalOnly,
		detailIf(!noLocalOnly, fmt.Sprintf("%d untracked local file%s (%s) exist nowhere else",
			len(e.LocalOnlyFiles), plural(len(e.LocalOnlyFiles), "", "s"),
			strings.Join(truncate(e.LocalOnlyFiles, 3), ", "))))

	add(GateCold, fmt.Sprintf("Idle for %d+ days", opts.ColdDays), e.Activity.Cold,
		detailIf(!e.Activity.Cold, fmt.Sprintf("last activity %d days ago (%s)", e.Activity.DaysIdle, e.Activity.Source)))

	e.Gates = gates
	e.Archivable = true
	e.BlockedBy = nil
	for _, g := range gates {
		if !g.OK {
			e.Archivable = false
			e.BlockedBy = append(e.BlockedBy, g.ID)
		}
	}
}

// evaluatePush decides what "push everything" would do here. It never proposes
// committing: auto-committing 268 untracked files would be a data decision the
// tool has no basis to make, so dirty trees are reported, not resolved.
func evaluatePush(e *Entry) {
	e.NeedsPush = false
	e.PushBranches = nil
	e.PushBlocked = false
	e.PushBlockedBy = ""

	switch {
	case e.Kind == KindPlain:
		e.PushBlocked = true
		e.PushBlockedBy = "not a git repository"
		return
	case e.ScanError != "":
		e.PushBlocked = true
		e.PushBlockedBy = e.ScanError
		return
	case !e.HasCommits:
		e.PushBlocked = true
		e.PushBlockedBy = "no commits to push"
		return
	case e.Remote == nil:
		e.PushBlocked = true
		e.PushBlockedBy = "no remote configured"
		return
	}

	e.PushBranches = unpushedBranches(e)
	e.NeedsPush = len(e.PushBranches) > 0 || len(unpushedTagNames(e)) > 0

	if e.Ownership == OwnershipThirdParty && e.NeedsPush {
		e.PushBlocked = true
		e.PushBlockedBy = "remote belongs to " + e.Remote.Owner + "; you likely cannot push to it"
		return
	}
	if len(e.SharedWith) > 0 && e.NeedsPush {
		e.PushBlocked = true
		e.PushBlockedBy = "another local copy uses this same remote: " + strings.Join(shortPaths(e.SharedWith), ", ")
	}
}

// backedUp reports that every commit on this branch is known to exist on the
// remote. Behind counts: the remote simply moved on, and it still holds all of
// this branch's history.
func backedUp(state PushState) bool {
	return state == PushStateVerified || state == PushStateBehind
}

// unpushedBranches lists branches with commits that a push would need to send.
// Under verification this is exact; offline it falls back to the ahead-count,
// which is why archiving requires verification.
//
// NeedsFetch is deliberately excluded: pushing a branch whose relationship to
// the remote is unknown could only fail or overwrite, and the right next step is
// a fetch, not a push.
func unpushedBranches(e *Entry) []string {
	var out []string
	for _, b := range e.Branches {
		switch {
		case backedUp(b.State):
			continue
		case b.State == PushStateNeedsFetch:
			continue
		case b.State == PushStateUnverified:
			if b.Ahead > 0 || b.Upstream == "" {
				out = append(out, b.Name)
			}
		default:
			out = append(out, b.Name)
		}
	}
	sort.Strings(out)
	return out
}

// unverifiedBranches lists branches that cannot be shown to be on the remote,
// including the ones a push would not fix. The archive gate uses this, not
// unpushedBranches, because "nothing to push" is not the same as "safely stored".
func unverifiedBranches(e *Entry) []string {
	var out []string
	for _, b := range e.Branches {
		if !backedUp(b.State) {
			out = append(out, b.Name+" ("+string(b.State)+")")
		}
	}
	sort.Strings(out)
	return out
}

// unpushedTagNames lists tags missing from the remote. Unlike branches, a tag
// points at one commit and is never "behind": either the remote has it at that
// SHA or the tag exists only here.
func unpushedTagNames(e *Entry) []string {
	var out []string
	for _, t := range e.Tags {
		if t.State != PushStateVerified && t.State != PushStateUnverified {
			out = append(out, t.Name)
		}
	}
	sort.Strings(out)
	return out
}

// proposeOrganize suggests a target layout. Nothing here is executed; moves
// break linked-worktree gitdir pointers, editor workspaces, and per-path tool
// history, so the list exists to be reviewed and approved.
func proposeOrganize(entries []Entry, opts scanOptions) []MoveProposal {
	if len(opts.Roots) == 0 {
		return nil
	}
	root := opts.Roots[0]
	var out []MoveProposal

	for i := range entries {
		e := &entries[i]
		if e.Kind == KindNestedChild || e.Parent != "" {
			continue
		}

		bucket := ""
		reason := ""
		switch {
		case e.Kind == KindWorktree && e.Worktree != nil && e.Worktree.Broken:
			out = append(out, MoveProposal{
				From:   e.Path,
				To:     "",
				Reason: "orphaned worktree; its gitdir no longer exists. Prune from the main repo rather than moving it.",
				Risk:   "run `git worktree prune` in " + shortPath(e.Worktree.MainRepo),
				Safe:   false,
			})
			continue
		case e.Kind == KindPlain:
			bucket = filepath.Join("Unversioned")
			reason = "no git repository; keep separate until it is initialised and pushed"
		case e.Ownership == OwnershipThirdParty:
			bucket = filepath.Join("Vendor")
			reason = "clone of " + e.Remote.Owner + "'s repository"
		case e.Activity.Cold && e.Archivable:
			bucket = filepath.Join("Archive")
			reason = fmt.Sprintf("idle %d days and fully pushed", e.Activity.DaysIdle)
		case e.Activity.Cold:
			bucket = filepath.Join("Archive", "Needs attention")
			// Show what a person can act on, not the internal gate id.
			reason = fmt.Sprintf("idle %d days, but %s", e.Activity.DaysIdle, firstBlocker(e))
		default:
			bucket = filepath.Join("Active")
			reason = fmt.Sprintf("active %d days ago", e.Activity.DaysIdle)
		}

		target := filepath.Join(root, bucket, e.Name)
		if target == e.Path {
			continue
		}
		risk := ""
		safe := true
		if len(e.Children) > 0 {
			risk = fmt.Sprintf("contains %d nested repositories that move with it", len(e.Children))
			safe = false
		}
		if e.Kind == KindNestedParent {
			safe = false
		}
		out = append(out, MoveProposal{From: e.Path, To: target, Reason: reason, Risk: risk, Safe: safe})
	}

	sort.Slice(out, func(i, j int) bool { return out[i].From < out[j].From })
	return disambiguateTargets(out)
}

// disambiguateTargets ensures no two proposals name the same destination.
//
// Basenames collide constantly in practice: two directories called `cms` (one
// under Innovarts, one under Liquid) land in the same bucket and would both
// propose `<root>/Archive/cms`. Nothing here executes a move, but a user
// following the printed plan by hand would overwrite one with the other, so the
// plan has to be applicable as written.
//
// Disambiguation prefers the parent directory name, which is what makes the two
// paths distinguishable to a human, and falls back to a numeric suffix.
func disambiguateTargets(proposals []MoveProposal) []MoveProposal {
	counts := make(map[string]int)
	for _, p := range proposals {
		if p.To != "" {
			counts[p.To]++
		}
	}

	used := make(map[string]bool)
	for i := range proposals {
		to := proposals[i].To
		if to == "" {
			continue
		}
		if counts[to] < 2 && !used[to] {
			used[to] = true
			continue
		}

		dir := filepath.Dir(to)
		base := filepath.Base(to)
		parent := filepath.Base(filepath.Dir(proposals[i].From))

		candidate := to
		if parent != "" && parent != "." && parent != string(os.PathSeparator) && parent != base {
			candidate = filepath.Join(dir, parent+"-"+base)
		}
		for suffix := 2; used[candidate]; suffix++ {
			candidate = filepath.Join(dir, fmt.Sprintf("%s-%d", base, suffix))
		}
		used[candidate] = true
		proposals[i].To = candidate
	}
	return proposals
}

// firstBlocker describes, in the words shown to a user, the first reason this
// repository cannot be archived.
func firstBlocker(e *Entry) string {
	for _, g := range e.Gates {
		if g.OK {
			continue
		}
		if g.Detail != "" {
			return g.Detail
		}
		return strings.ToLower(g.Label) + " failed"
	}
	return "something still needs attention"
}

func detailIf(cond bool, msg string) string {
	if cond {
		return msg
	}
	return ""
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

func truncate(in []string, n int) []string {
	if len(in) <= n {
		return in
	}
	out := append([]string{}, in[:n]...)
	return append(out, fmt.Sprintf("and %d more", len(in)-n))
}

func shortPaths(in []string) []string {
	out := make([]string, 0, len(in))
	for _, p := range in {
		out = append(out, shortPath(p))
	}
	return out
}

// shortPath keeps the last two segments, enough to identify a directory in a
// message without printing an unreadable absolute path.
func shortPath(p string) string {
	if p == "" {
		return ""
	}
	parts := strings.Split(filepath.Clean(p), string(os.PathSeparator))
	if len(parts) <= 2 {
		return filepath.Clean(p)
	}
	return filepath.Join(parts[len(parts)-2], parts[len(parts)-1])
}
