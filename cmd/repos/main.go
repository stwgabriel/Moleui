package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"syscall"
	"time"
)

const usage = `mo repos - inventory every git repository on this machine.

Usage:
  repos [options] [root ...]

Options:
  --json                 Emit the full machine-readable report.
  --verify               Contact each remote and confirm every local ref exists
                         server-side. Required before anything can be archived.
  --fetch                Update remote-tracking refs first, so a branch that is
                         merely behind its remote is recognised as backed up
                         instead of unknown. Implied by --gate.
  --cold-days <n>        Days of inactivity before a repo counts as cold (default 7).
  --depth <n>            Maximum directory depth to search (default 6).
  --concurrency <n>      Parallel repository inspections (default: CPU count).
  --own <owner>          Treat this remote owner as yours. Repeatable.
  --filter <kind>        Only show: all, archivable, needs-push, push-blocked,
                         blocked, no-remote, third-party, cold, plain
                         (default all).
  --paths-only           Print one absolute path per line. For scripting.
  --timeout <dur>        Per-repository git timeout (default 20s).
  --remote-timeout <dur> Per-remote network timeout (default 25s).
  -h, --help             Show this help.

Gate mode:
  --gate <path>          Re-check one directory against every archive
                         precondition and exit 0 only if all of them pass.
                         Always verifies against the remote. Exit 3 means
                         refused, and the reasons are printed.
  --ignore-gate <id>     Waive one precondition in gate mode. Only
                         "no_local_only_files" and "cold" may be waived, and
                         only because the caller has already handled them.

Query modes:
  --push-branches <path> Print the branches of one repository that are not on
                         its remote, one per line. Always verifies.
  --plan                 Print the proposed folder layout as text.

Roots default to $MOLE_REPOS_ROOTS, then ~/Dev, then $HOME.

This command never writes. Pushing and archiving live in the shell layer so
deletions route through Mole's audited Trash helpers.
`

type stringList []string

func (s *stringList) String() string { return strings.Join(*s, ",") }
func (s *stringList) Set(v string) error {
	for part := range strings.SplitSeq(v, ",") {
		if p := strings.TrimSpace(part); p != "" {
			*s = append(*s, p)
		}
	}
	return nil
}

func environ() []string { return os.Environ() }

func main() {
	var (
		asJSON        = flag.Bool("json", false, "emit JSON")
		verify        = flag.Bool("verify", false, "verify refs against remotes")
		coldDays      = flag.Int("cold-days", 7, "days idle before cold")
		depth         = flag.Int("depth", 6, "max search depth")
		concurrency   = flag.Int("concurrency", runtime.NumCPU(), "parallel inspections")
		filterKind    = flag.String("filter", "all", "filter output")
		pathsOnly     = flag.Bool("paths-only", false, "print paths only")
		gitTimeout    = flag.Duration("timeout", 20*time.Second, "per-repo git timeout")
		remoteTimeout = flag.Duration("remote-timeout", 25*time.Second, "per-remote timeout")
		doFetch       = flag.Bool("fetch", false, "fetch remote-tracking refs before comparing")
		gatePath      = flag.String("gate", "", "re-check one path against the archive gate")
		pushBranches  = flag.String("push-branches", "", "print unpushed branches for one path")
		showPlan      = flag.Bool("plan", false, "print the proposed layout")
		own           stringList
		ignoreGates   stringList
	)
	flag.Var(&own, "own", "remote owner that is yours (repeatable)")
	flag.Var(&ignoreGates, "ignore-gate", "waive one gate in gate mode (repeatable)")
	flag.Usage = func() { fmt.Fprint(os.Stderr, usage) }
	flag.Parse()

	// Gate and push-branch modes always verify. Both feed a decision that moves
	// or deletes work, so neither may rest on a cached scan.
	singlePath := *gatePath
	if singlePath == "" {
		singlePath = *pushBranches
	}
	if singlePath != "" {
		*verify = true
		// A decision that moves or deletes work gets the most complete picture
		// available, so containment is proven rather than reported as unknown.
		*doFetch = true
	}

	rootArgs := flag.Args()
	if singlePath != "" {
		rootArgs = []string{singlePath}
	}
	roots := resolveRoots(rootArgs)
	if len(roots) == 0 {
		fmt.Fprintln(os.Stderr, "No readable roots to scan.")
		os.Exit(1)
	}

	if envOwners := os.Getenv("MOLE_REPOS_OWNERS"); envOwners != "" {
		_ = own.Set(envOwners)
	}

	// Ctrl-C must leave a scan half-done rather than wedged: the context cancels
	// every in-flight git child process.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	report := scan(ctx, scanOptions{
		Roots:         roots,
		MaxDepth:      *depth,
		ColdDays:      *coldDays,
		Verify:        *verify,
		Concurrency:   *concurrency,
		GitTimeout:    *gitTimeout,
		RemoteTimeout: *remoteTimeout,
		OwnOwners:     own,
		Fetch:         *doFetch,
		Now:           time.Now(),
		SelfPath:      selfRepoPath(),
	})

	if *gatePath != "" {
		os.Exit(runGate(report, roots[0], ignoreGates))
	}
	if *pushBranches != "" {
		os.Exit(runPushBranches(report, roots[0]))
	}
	if *showPlan {
		printPlan(report)
		return
	}

	entries := filterEntries(report.Entries, *filterKind)

	switch {
	case *pathsOnly:
		for _, e := range entries {
			fmt.Println(e.Path)
		}
	case *asJSON:
		filtered := *report
		filtered.Entries = entries
		enc := json.NewEncoder(os.Stdout)
		enc.SetEscapeHTML(false)
		if err := enc.Encode(filtered); err != nil {
			fmt.Fprintln(os.Stderr, "failed to encode report:", err)
			os.Exit(1)
		}
	default:
		printTable(report, entries)
	}
}

// waivableGates are the only preconditions a caller may waive, and each is
// waivable only because the caller can genuinely resolve it beforehand: secrets
// can be copied out of the directory first, and coldness is a heuristic the user
// is entitled to overrule for a repo they know they are done with. Everything
// else establishes that the code exists somewhere else and is not negotiable.
var waivableGates = map[string]bool{
	GateNoLocalOnly: true,
	GateCold:        true,
}

// runGate re-checks a single directory and returns the process exit code:
// 0 archivable, 3 refused, 4 the path could not be evaluated.
//
// The shell archive path calls this immediately before deleting anything, so a
// decision made minutes earlier in the UI can never be acted on stale.
func runGate(report *Report, target string, ignore []string) int {
	for _, id := range ignore {
		if !waivableGates[id] {
			fmt.Fprintf(os.Stderr, "refusing to waive gate %q: only %s and %s may be waived\n",
				id, GateNoLocalOnly, GateCold)
			return 4
		}
	}
	waived := make(map[string]bool, len(ignore))
	for _, id := range ignore {
		waived[id] = true
	}

	var entry *Entry
	for i := range report.Entries {
		if report.Entries[i].Path == target {
			entry = &report.Entries[i]
			break
		}
	}
	if entry == nil {
		fmt.Fprintf(os.Stderr, "no repository found at %s\n", target)
		return 4
	}

	blocked := false
	for _, g := range entry.Gates {
		switch {
		case g.OK:
			fmt.Printf("pass  %-22s %s\n", g.ID, g.Label)
		case waived[g.ID]:
			fmt.Printf("waived %-21s %s (%s)\n", g.ID, g.Label, g.Detail)
		default:
			blocked = true
			fmt.Printf("FAIL  %-22s %s: %s\n", g.ID, g.Label, g.Detail)
		}
	}

	fmt.Printf("size_kb=%d\n", entry.Size.ExclusiveKB)
	for _, f := range entry.LocalOnlyFiles {
		fmt.Printf("local_only=%s\n", f)
	}

	if blocked {
		fmt.Println("verdict=refused")
		return 3
	}
	fmt.Println("verdict=archivable")
	return 0
}

// runPushBranches prints the branches of one repository that a verified remote
// check says are not on the server, one per line for the shell to consume.
func runPushBranches(report *Report, target string) int {
	for i := range report.Entries {
		e := &report.Entries[i]
		if e.Path != target {
			continue
		}
		if e.PushBlocked {
			fmt.Fprintln(os.Stderr, "cannot push: "+e.PushBlockedBy)
			return 3
		}
		for _, b := range e.PushBranches {
			fmt.Println(b)
		}
		return 0
	}
	fmt.Fprintf(os.Stderr, "no repository found at %s\n", target)
	return 4
}

// printPlan renders the proposed layout. It is a proposal only: moving a
// repository breaks linked-worktree gitdir pointers, editor workspaces, and
// any tool that keys state by absolute path.
func printPlan(report *Report) {
	if len(report.Organize) == 0 {
		fmt.Println("No layout changes proposed.")
		return
	}
	fmt.Println("Proposed layout. Nothing has been moved.")
	fmt.Println()
	for _, m := range report.Organize {
		if m.To == "" {
			fmt.Printf("  %s\n      %s\n", m.From, m.Reason)
			if m.Risk != "" {
				fmt.Printf("      action: %s\n", m.Risk)
			}
			continue
		}
		flag := ""
		if !m.Safe {
			flag = "  [review]"
		}
		fmt.Printf("  %s\n   -> %s%s\n      %s\n", m.From, m.To, flag, m.Reason)
		if m.Risk != "" {
			fmt.Printf("      risk: %s\n", m.Risk)
		}
	}
	fmt.Println()
	fmt.Println("Apply these yourself, or from the Repos page in the desktop app.")
	fmt.Println("Moving a repository can break linked worktrees and editor workspaces.")
}

// resolveRoots prefers explicit arguments, then MOLE_REPOS_ROOTS, then the
// conventional ~/Dev, then $HOME.
func resolveRoots(args []string) []string {
	var candidates []string
	if len(args) > 0 {
		candidates = args
	} else if env := os.Getenv("MOLE_REPOS_ROOTS"); env != "" {
		candidates = strings.Split(env, string(os.PathListSeparator))
	} else {
		home, err := os.UserHomeDir()
		if err == nil {
			dev := filepath.Join(home, "Dev")
			if st, statErr := os.Stat(dev); statErr == nil && st.IsDir() {
				candidates = []string{dev}
			} else {
				candidates = []string{home}
			}
		}
	}

	var out []string
	seen := make(map[string]bool)
	for _, c := range candidates {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if after, ok := strings.CutPrefix(c, "~"); ok {
			if home, err := os.UserHomeDir(); err == nil {
				c = filepath.Join(home, after)
			}
		}
		abs, err := filepath.Abs(c)
		if err != nil {
			continue
		}
		// Resolve symlinks so a root reached through a link and the same root
		// reached directly are not scanned twice.
		if resolved, err := filepath.EvalSymlinks(abs); err == nil {
			abs = resolved
		}
		if st, err := os.Stat(abs); err != nil || !st.IsDir() || seen[abs] {
			continue
		}
		seen[abs] = true
		out = append(out, abs)
	}
	return out
}

// selfRepoPath finds the Mole checkout this binary was built from, so the tool
// can never nominate its own source tree for deletion.
func selfRepoPath() string {
	if env := os.Getenv("MOLE_SELF_REPO"); env != "" {
		return env
	}
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	dir := filepath.Dir(exe)
	for range 8 {
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

func filterEntries(entries []Entry, kind string) []Entry {
	keep := func(e *Entry) bool {
		switch strings.ToLower(kind) {
		case "", "all":
			return true
		case "archivable":
			return e.Archivable
		case "needs-push":
			// Only repos a push could actually succeed for. A third-party clone
			// or a shared remote needs a decision from the user first, so
			// offering it here would just queue a guaranteed failure.
			return e.NeedsPush && !e.PushBlocked
		case "push-blocked":
			return e.NeedsPush && e.PushBlocked
		case "blocked":
			return !e.Archivable && e.Activity.Cold
		case "no-remote":
			return e.Remote == nil
		case "third-party":
			return e.Ownership == OwnershipThirdParty
		case "cold":
			return e.Activity.Cold
		case "plain":
			return e.Kind == KindPlain
		default:
			return true
		}
	}
	out := make([]Entry, 0, len(entries))
	for i := range entries {
		if keep(&entries[i]) {
			out = append(out, entries[i])
		}
	}
	return out
}

func printTable(report *Report, entries []Entry) {
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Activity.DaysIdle != entries[j].Activity.DaysIdle {
			return entries[i].Activity.DaysIdle > entries[j].Activity.DaysIdle
		}
		return entries[i].RelPath < entries[j].RelPath
	})

	s := report.Summary
	fmt.Printf("Repos: %d  Plain folders: %d  Worktrees: %d  Cold: %d  Needs push: %d  Archivable: %d\n",
		s.Repos, s.Plain, s.Worktrees, s.Cold, s.NeedsPush, s.Archivable)
	fmt.Printf("On disk: %s   Reclaimable: %s\n", humanKB(s.TotalKB), humanKB(s.ReclaimableKB))
	if !report.Verified {
		fmt.Println("Remotes were not contacted. Run with --verify before archiving anything.")
	}
	if s.RemoteConflict > 0 {
		fmt.Printf("%d director%s share a remote with another copy.\n", s.RemoteConflict, plural(s.RemoteConflict, "y", "ies"))
	}
	if s.NoBackup > 0 {
		fmt.Printf("%d director%s have no copy anywhere but this machine.\n", s.NoBackup, plural(s.NoBackup, "y", "ies"))
	}
	if s.RemoteMissing > 0 {
		fmt.Printf("%d repositor%s point at a remote that no longer exists.\n", s.RemoteMissing, plural(s.RemoteMissing, "y", "ies"))
	}
	if s.AuthFailed > 0 {
		fmt.Printf("%d repositor%s could not be checked because authentication failed.\n", s.AuthFailed, plural(s.AuthFailed, "y", "ies"))
	}
	fmt.Println()

	fmt.Printf("%-46s %-14s %6s %8s %-9s %s\n", "PATH", "KIND", "IDLE", "SIZE", "STATE", "NOTE")
	for i := range entries {
		e := &entries[i]
		note := ""
		state := "ok"
		switch {
		case e.Archivable:
			state = "archivable"
			note = "fully pushed and idle"
		case e.Remote != nil && e.Remote.Missing:
			state = "NO BACKUP"
			note = "remote is gone (" + e.Remote.VerifyError + "); only copy is here"
		case e.Kind == KindPlain:
			state = "no-git"
			note = "not a repository; nothing is backed up"
		case e.ScanError != "":
			state = "error"
			note = e.ScanError
		case e.PushBlocked:
			state = "blocked"
			note = e.PushBlockedBy
		case e.NeedsPush:
			state = "needs-push"
			note = fmt.Sprintf("%d branch%s to push", len(e.PushBranches), plural(len(e.PushBranches), "", "es"))
		case len(e.BlockedBy) > 0 && e.Activity.Cold:
			state = "keep"
			note = firstBlockingDetail(e)
		}
		idle := "-"
		if e.Activity.DaysIdle >= 0 {
			idle = fmt.Sprintf("%dd", e.Activity.DaysIdle)
		}
		fmt.Printf("%-46s %-14s %6s %8s %-9s %s\n",
			elide(e.RelPath, 46), e.Kind, idle, humanKB(e.Size.ExclusiveKB), state, elide(note, 60))
	}

	for _, w := range report.Warnings {
		fmt.Fprintln(os.Stderr, "warning:", w)
	}
}

func firstBlockingDetail(e *Entry) string {
	for _, g := range e.Gates {
		if !g.OK && g.Detail != "" {
			return g.Detail
		}
	}
	if len(e.BlockedBy) > 0 {
		return e.BlockedBy[0]
	}
	return ""
}

func humanKB(kb int64) string {
	const unit = 1024.0
	v := float64(kb)
	units := []string{"KB", "MB", "GB", "TB"}
	for _, u := range units {
		if v < unit || u == "TB" {
			if v >= 100 || u == "KB" {
				return fmt.Sprintf("%.0f%s", v, u)
			}
			return fmt.Sprintf("%.1f%s", v, u)
		}
		v /= unit
	}
	return fmt.Sprintf("%.0fKB", float64(kb))
}

func elide(s string, n int) string {
	if len(s) <= n {
		return s
	}
	if n <= 3 {
		return s[:n]
	}
	return "..." + s[len(s)-(n-3):]
}
