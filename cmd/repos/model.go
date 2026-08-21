// Package main implements the Mole repo inventory scanner.
//
// This binary is read-only. It classifies every git repository (and every
// project folder that is not a repository) under a set of roots, works out
// which local work has a verified copy on a remote, and decides whether the
// local copy is safe to archive. Every mutation lives in the shell layer
// (bin/repos.sh) so deletions keep going through mole_delete.
package main

// Kind describes what a discovered directory actually is. The distinction
// matters because three of these are never archivable on their own: a worktree
// shares its object store with a main repo, a nested parent contains child
// repos whose state it does not track, and a plain folder has no history at all.
type Kind string

const (
	// KindStandalone is a normal repository with no nested repos inside it.
	KindStandalone Kind = "standalone"
	// KindWorktree is a linked worktree; its .git is a file pointing elsewhere.
	KindWorktree Kind = "worktree"
	// KindNestedParent is a repository that contains other repositories.
	KindNestedParent Kind = "nested_parent"
	// KindNestedChild is a repository living inside another repository.
	KindNestedChild Kind = "nested_child"
	// KindPlain is a project folder with no git repository at all.
	KindPlain Kind = "plain"
)

// Ownership records whether the remote is one the user can be expected to push
// to. Third-party clones (upstream repos owned by someone else) can hold local
// changes that exist nowhere else and can never be pushed, so they are a
// separate category rather than a push failure.
type Ownership string

const (
	OwnershipOwn        Ownership = "own"
	OwnershipThirdParty Ownership = "third_party"
	OwnershipUnknown    Ownership = "unknown"
	OwnershipNone       Ownership = "none"
)

// PushState is the per-branch verdict.
type PushState string

const (
	// PushStateVerified means the branch SHA was found on the remote by ls-remote.
	PushStateVerified PushState = "verified"
	// PushStateAhead means local commits are not on the remote.
	PushStateAhead PushState = "ahead"
	// PushStateBehind means the remote is ahead of the local branch and every
	// local commit is already contained in it. Nothing needs pushing, and the
	// work is safely backed up even though the SHAs differ.
	PushStateBehind PushState = "behind"
	// PushStateNeedsFetch means the remote has a different SHA whose commit is
	// not in the local object store, so containment cannot be proven without
	// fetching. Never treated as backed up.
	PushStateNeedsFetch PushState = "needs_fetch"
	// PushStateNoUpstream means the branch has never been pushed.
	PushStateNoUpstream PushState = "no_upstream"
	// PushStateStaleUpstream means an upstream is configured but the branch is
	// missing from the remote entirely, i.e. the remote-tracking ref is a local
	// cache of a branch that no longer exists server-side.
	PushStateStaleUpstream PushState = "stale_upstream"
	// PushStateUnverified means no remote check ran (offline scan).
	PushStateUnverified PushState = "unverified"
)

// Remote is a parsed remote URL. Normalized is the identity used to detect two
// local directories pointing at the same remote, which invalidates "this is
// safely backed up" for both of them.
type Remote struct {
	Name            string `json:"name"`
	URL             string `json:"url"`
	Host            string `json:"host"`
	Owner           string `json:"owner"`
	Repo            string `json:"repo"`
	Normalized      string `json:"normalized"`
	Scheme          string `json:"scheme"`
	SSHAlias        string `json:"ssh_alias,omitempty"`
	EmbeddedUser    string `json:"embedded_user,omitempty"`
	VerifyOK        bool   `json:"verify_ok"`
	VerifyError     string `json:"verify_error,omitempty"`
	VerifyAttempted bool   `json:"verify_attempted"`

	// Missing means the remote answered that the repository does not exist.
	// This is the most dangerous state on the machine: local branches still
	// have remote-tracking refs and look pushed, but nothing is backed up.
	Missing bool `json:"missing"`
	// AuthFailed means the host refused the credentials, so the refs could not
	// be checked either way. Unlike Missing, the copy may well be safe.
	AuthFailed bool `json:"auth_failed"`
	// Ambiguous means the host returned "not found" over an unauthenticated
	// transport, which cannot distinguish a deleted repository from a private
	// one we failed to log into.
	Ambiguous bool `json:"ambiguous"`
	// VerifiedVia names the transport that answered, so a result obtained
	// through the SSH fallback is not mistaken for one over the stored URL.
	VerifiedVia string `json:"verified_via,omitempty"`
}

// Branch is one local branch and how it compares to the remote.
type Branch struct {
	Name      string    `json:"name"`
	SHA       string    `json:"sha"`
	Upstream  string    `json:"upstream,omitempty"`
	Ahead     int       `json:"ahead"`
	Behind    int       `json:"behind"`
	State     PushState `json:"state"`
	Committed string    `json:"committed"`
}

// Tag is a local tag. Tags are refs like branches and are just as easy to lose,
// so the archive gate checks them too.
type Tag struct {
	Name  string    `json:"name"`
	SHA   string    `json:"sha"`
	State PushState `json:"state"`
}

// Dirty counts uncommitted work.
type Dirty struct {
	Tracked   int `json:"tracked"`
	Untracked int `json:"untracked"`
	Total     int `json:"total"`
}

// Size holds both the naive directory size and the size that would actually be
// reclaimed. Nested repos would otherwise be counted twice: ubs-projects is
// 664M but 662M of that belongs to three child repos.
type Size struct {
	TotalKB     int64 `json:"total_kb"`
	ExclusiveKB int64 `json:"exclusive_kb"`
}

// Activity is the freshness verdict. Source names which ref or file won, since
// HEAD alone lies: a repo can have a 2023 HEAD and a branch committed yesterday.
type Activity struct {
	Last     string `json:"last"`
	Source   string `json:"source"`
	DaysIdle int    `json:"days_idle"`
	Cold     bool   `json:"cold"`
}

// Gate is one archive precondition. Every gate carries its own reason string so
// the UI can explain a refusal instead of just greying out a button.
type Gate struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail,omitempty"`
}

// Worktree describes a linked-worktree entry.
type Worktree struct {
	MainRepo string `json:"main_repo,omitempty"`
	GitDir   string `json:"git_dir,omitempty"`
	Prunable bool   `json:"prunable"`
	Broken   bool   `json:"broken"`
}

// Submodules summarises submodule state; a submodule with local commits is
// local-only work that the parent repo's own status does not fully report.
type Submodules struct {
	Count int `json:"count"`
	Dirty int `json:"dirty"`
}

// Entry is one discovered directory.
type Entry struct {
	Path     string    `json:"path"`
	RelPath  string    `json:"rel_path"`
	Name     string    `json:"name"`
	Root     string    `json:"root"`
	Kind     Kind      `json:"kind"`
	GitDir   string    `json:"git_dir,omitempty"`
	GitIsDir bool      `json:"git_is_dir"`
	Worktree *Worktree `json:"worktree,omitempty"`

	Remote      *Remote   `json:"remote"`
	Ownership   Ownership `json:"ownership"`
	SharedWith  []string  `json:"shared_with,omitempty"`
	OtherRemote []string  `json:"other_remotes,omitempty"`

	HeadBranch  string `json:"head_branch,omitempty"`
	HeadSHA     string `json:"head_sha,omitempty"`
	HasCommits  bool   `json:"has_commits"`
	Detached    bool   `json:"detached"`
	BareOrEmpty bool   `json:"bare_or_empty"`

	Branches   []Branch   `json:"branches,omitempty"`
	Tags       []Tag      `json:"tags,omitempty"`
	Stashes    int        `json:"stashes"`
	Dirty      Dirty      `json:"dirty"`
	Submodules Submodules `json:"submodules"`

	Activity Activity `json:"activity"`
	Size     Size     `json:"size"`

	// LocalOnlyFiles are gitignored paths that look irreplaceable (env files,
	// keys, local databases). They are invisible to every ref check, so
	// archiving without handling them destroys real data.
	LocalOnlyFiles []string `json:"local_only_files,omitempty"`

	Children []string `json:"children,omitempty"`
	Parent   string   `json:"parent,omitempty"`

	// Markers are the project-type hints used to decide a plain folder is a
	// project worth reporting rather than a stray directory.
	Markers []string `json:"markers,omitempty"`

	Gates         []Gate   `json:"gates"`
	Archivable    bool     `json:"archivable"`
	BlockedBy     []string `json:"blocked_by,omitempty"`
	NeedsPush     bool     `json:"needs_push"`
	PushBranches  []string `json:"push_branches,omitempty"`
	PushBlocked   bool     `json:"push_blocked"`
	PushBlockedBy string   `json:"push_blocked_by,omitempty"`

	ScanError string `json:"scan_error,omitempty"`
}

// Summary is the headline count set the dashboard opens with.
type Summary struct {
	Total          int   `json:"total"`
	Repos          int   `json:"repos"`
	Plain          int   `json:"plain"`
	Worktrees      int   `json:"worktrees"`
	NoRemote       int   `json:"no_remote"`
	ThirdParty     int   `json:"third_party"`
	NeedsPush      int   `json:"needs_push"`
	Dirty          int   `json:"dirty"`
	Cold           int   `json:"cold"`
	Archivable     int   `json:"archivable"`
	ReclaimableKB  int64 `json:"reclaimable_kb"`
	TotalKB        int64 `json:"total_kb"`
	RemoteConflict int   `json:"remote_conflict"`
	Unverified     int   `json:"unverified"`
	RemoteMissing  int   `json:"remote_missing"`
	AuthFailed     int   `json:"auth_failed"`
	// NoBackup counts directories whose work exists on no remote at all: plain
	// folders, repos with no remote, and repos whose remote has been deleted.
	NoBackup int `json:"no_backup"`
}

// Report is the top-level JSON document.
type Report struct {
	Version    int            `json:"version"`
	ScannedAt  string         `json:"scanned_at"`
	Roots      []string       `json:"roots"`
	ColdDays   int            `json:"cold_days"`
	Verified   bool           `json:"verified"`
	Entries    []Entry        `json:"entries"`
	Summary    Summary        `json:"summary"`
	Organize   []MoveProposal `json:"organize,omitempty"`
	Warnings   []string       `json:"warnings,omitempty"`
	DurationMS int64          `json:"duration_ms"`
}

// MoveProposal is a single suggested relocation. Nothing acts on these; they
// are rendered for approval, because moving a directory breaks worktree gitdir
// paths, editor workspaces, and per-path tool history.
type MoveProposal struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Reason string `json:"reason"`
	Risk   string `json:"risk"`
	Safe   bool   `json:"safe"`
}
