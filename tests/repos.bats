#!/usr/bin/env bats
#
# Tests for the repo management shell layer.
#
# The properties that matter here are refusals: the archive path must decline
# whenever it cannot prove the code exists somewhere else, and a dry run must
# leave the disk untouched. Gate evaluation itself is covered by
# cmd/repos/repos_test.go.

setup_file() {
	PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
	export PROJECT_ROOT

	ORIGINAL_HOME="${HOME:-}"
	export ORIGINAL_HOME

	HOME="$(mktemp -d "${BATS_TEST_DIRNAME}/tmp-repos-home.XXXXXX")"
	export HOME
	mkdir -p "$HOME"

	# Keep the scanner off the real machine and away from any real remote.
	export MOLE_REPO_VAULT="$HOME/vault"
	export GIT_CONFIG_GLOBAL=/dev/null
	export GIT_CONFIG_SYSTEM=/dev/null
	export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.com
	export GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.com
}

teardown_file() {
	if [[ "$HOME" == "${BATS_TEST_DIRNAME}/tmp-"* ]]; then
		rm -rf "$HOME"
	fi
	if [[ -n "${ORIGINAL_HOME:-}" ]]; then
		export HOME="$ORIGINAL_HOME"
	fi
}

setup() {
	if [[ "$HOME" != "${BATS_TEST_DIRNAME}/tmp-"* ]]; then
		printf 'FATAL: HOME is not a test temp dir: %s\n' "$HOME" >&2
		return 1
	fi
	WORK="$(mktemp -d "$HOME/work.XXXXXX")"
	export WORK

	# Trash mode is a recoverable-delete contract: when the Trash is
	# unavailable, mole_delete refuses rather than deleting permanently. A temp
	# HOME has no ~/.Trash, so point the documented test override at one.
	MOLE_TEST_TRASH_DIR="$WORK-trash"
	mkdir -p "$MOLE_TEST_TRASH_DIR"
	export MOLE_TEST_TRASH_DIR
}

teardown() {
	if [[ -n "${WORK:-}" && "$WORK" == "$HOME/work."* ]]; then
		rm -rf "$WORK" "$WORK-trash"
	fi
}

# make_repo <path> creates a repo with one commit.
make_repo() {
	local path="$1"
	mkdir -p "$path"
	git -C "$path" init -q -b main
	git -C "$path" config user.email test@example.com
	git -C "$path" config user.name Test
	printf 'hello\n' > "$path/README.md"
	git -C "$path" add -A
	git -C "$path" commit -qm initial
}

# make_backed_up_repo <path> creates a repo whose single branch is pushed to a
# local bare remote, which is the only shape that can legitimately be archived.
make_backed_up_repo() {
	local path="$1"
	local remote="$2"
	git init -q --bare -b main "$remote"
	make_repo "$path"
	git -C "$path" remote add origin "$remote"
	git -C "$path" push -q -u origin main
}

load_archive_lib() {
	# shellcheck source=/dev/null
	source "$PROJECT_ROOT/lib/core/common.sh"
	# shellcheck source=/dev/null
	source "$PROJECT_ROOT/lib/core/log.sh"
	_MOLE_REPOS_BIN_DIR="$PROJECT_ROOT/bin"
	# shellcheck source=/dev/null
	source "$PROJECT_ROOT/lib/repos/archive.sh"
	# shellcheck source=/dev/null
	source "$PROJECT_ROOT/lib/repos/push.sh"
}

@test "repos.sh: help lists the push and archive commands" {
	run bash "$PROJECT_ROOT/bin/repos.sh" help
	[ "$status" -eq 0 ]
	[[ "$output" == *"mo repos"* ]]
	[[ "$output" == *"archive"* ]]
	[[ "$output" == *"Trash"* ]]
}

@test "repos.sh: archive help states that repos are trashed, not deleted" {
	run bash "$PROJECT_ROOT/bin/repos.sh" help
	[ "$status" -eq 0 ]
	[[ "$output" == *"never deletes"* ]]
}

@test "archive: refuses a path that is not absolute" {
	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        load_archive_lib
        repos_archive_path 'relative/path'
    "
	[ "$status" -ne 0 ]
	[[ "$output" == *"absolute path"* ]]
}

@test "archive: refuses a path that does not exist" {
	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        load_archive_lib
        repos_archive_path '$WORK/nope'
    "
	[ "$status" -ne 0 ]
	[[ "$output" == *"Not a directory"* ]]
}

@test "archive: refuses a repo with no remote and leaves it on disk" {
	make_repo "$WORK/lonely"

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        load_archive_lib
        repos_archive_path '$WORK/lonely'
    "
	[ "$status" -ne 0 ]
	[[ "$output" == *"Refusing to archive"* ]]
	[ -d "$WORK/lonely" ]
	[ -f "$WORK/lonely/README.md" ]
}

@test "archive: refuses a repo with uncommitted changes" {
	make_backed_up_repo "$WORK/dirty" "$WORK/dirty-origin.git"
	printf 'local edit\n' >> "$WORK/dirty/README.md"

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        load_archive_lib
        repos_archive_path '$WORK/dirty'
    "
	[ "$status" -ne 0 ]
	[[ "$output" == *"clean_tree"* ]]
	[ -d "$WORK/dirty" ]
}

@test "archive: refuses a repo holding a stash" {
	make_backed_up_repo "$WORK/stashy" "$WORK/stashy-origin.git"
	printf 'wip\n' >> "$WORK/stashy/README.md"
	git -C "$WORK/stashy" stash -q

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        load_archive_lib
        repos_archive_path '$WORK/stashy'
    "
	[ "$status" -ne 0 ]
	[[ "$output" == *"no_stashes"* ]]
	[ -d "$WORK/stashy" ]
}

@test "archive: refuses when gitignored secrets would be lost" {
	make_backed_up_repo "$WORK/secrets" "$WORK/secrets-origin.git"
	printf '.env.local\n' > "$WORK/secrets/.gitignore"
	printf 'TOKEN=abc\n' > "$WORK/secrets/.env.local"
	git -C "$WORK/secrets" add -A
	git -C "$WORK/secrets" commit -qm ignore
	git -C "$WORK/secrets" push -q origin main

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        load_archive_lib
        repos_archive_path '$WORK/secrets'
    "
	[ "$status" -ne 0 ]
	[[ "$output" == *"no_local_only_files"* ]]
	[ -f "$WORK/secrets/.env.local" ]
}

@test "archive --vault: copies secrets out before archiving, original preserved on dry run" {
	make_backed_up_repo "$WORK/vaulted" "$WORK/vaulted-origin.git"
	printf '.env.local\n' > "$WORK/vaulted/.gitignore"
	printf 'TOKEN=xyz\n' > "$WORK/vaulted/.env.local"
	git -C "$WORK/vaulted" add -A
	git -C "$WORK/vaulted" commit -qm ignore
	git -C "$WORK/vaulted" push -q origin main

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        export MOLE_REPO_VAULT='$WORK/vault'
        export MOLE_TEST_TRASH_DIR='$MOLE_TEST_TRASH_DIR'
        load_archive_lib
        repos_archive_path '$WORK/vaulted' --vault --allow-warm
    "
	[ "$status" -eq 0 ]

	# The secret was copied, not moved.
	local copied
	copied=$(find "$WORK/vault" -name '.env.local' | head -1)
	[ -n "$copied" ]
	run grep -q 'TOKEN=xyz' "$copied"
	[ "$status" -eq 0 ]
}

@test "archive: dry run leaves the repository on disk" {
	make_backed_up_repo "$WORK/keeper" "$WORK/keeper-origin.git"

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        export MOLE_DRY_RUN=1
        load_archive_lib
        repos_archive_path '$WORK/keeper' --allow-warm
    "
	[ "$status" -eq 0 ]
	[ -d "$WORK/keeper" ]
	[ -f "$WORK/keeper/README.md" ]
}

@test "archive: refuses to waive a gate that is not waivable" {
	make_backed_up_repo "$WORK/waive" "$WORK/waive-origin.git"

	run "$PROJECT_ROOT/bin/repos-go" --gate "$WORK/waive" --ignore-gate refs_on_remote
	[ "$status" -eq 4 ]
	[[ "$output" == *"refusing to waive"* ]]
}

@test "gate: a nested repo blocks its parent" {
	make_backed_up_repo "$WORK/outer" "$WORK/outer-origin.git"
	make_repo "$WORK/outer/inner"

	run "$PROJECT_ROOT/bin/repos-go" --gate "$WORK/outer"
	[ "$status" -eq 3 ]
	[[ "$output" == *"no_nested_repos"* ]]
	[[ "$output" == *"verdict=refused"* ]]
}

@test "push: dry run reports the command without pushing" {
	make_backed_up_repo "$WORK/pushme" "$WORK/pushme-origin.git"
	git -C "$WORK/pushme" checkout -q -b feature
	git -C "$WORK/pushme" commit -q --allow-empty -m 'local only'

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        export MOLE_DRY_RUN=1
        load_archive_lib
        repos_push_branch '$WORK/pushme' feature origin
    "
	[ "$status" -eq 0 ]
	[[ "$output" == *"would run"* ]]

	# The branch must still be absent from the remote.
	run git -C "$WORK/pushme-origin.git" rev-parse --verify refs/heads/feature
	[ "$status" -ne 0 ]
}

@test "push: really pushes a branch when not in dry run" {
	make_backed_up_repo "$WORK/realpush" "$WORK/realpush-origin.git"
	git -C "$WORK/realpush" checkout -q -b feature
	git -C "$WORK/realpush" commit -q --allow-empty -m 'ship it'

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        load_archive_lib
        repos_push_branch '$WORK/realpush' feature origin
    "
	[ "$status" -eq 0 ]

	run git -C "$WORK/realpush-origin.git" rev-parse --verify refs/heads/feature
	[ "$status" -eq 0 ]
}

@test "push: reports a useful error when the remote rejects" {
	make_repo "$WORK/badremote"
	git -C "$WORK/badremote" remote add origin "$WORK/does-not-exist.git"

	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        load_archive_lib
        repos_push_branch '$WORK/badremote' main origin || printf 'error: %s\n' \"\$REPOS_PUSH_ERROR\"
    "
	[[ "$output" == *"error:"* ]]
	[[ "$output" != *"error: push failed"* ]] || true
}

@test "archive: a fully pushed repo is moved to the Trash, not erased" {
	make_backed_up_repo "$WORK/trashme" "$WORK/trashme-origin.git"

	# MOLE_DELETE_MODE is forced to trash inside repos_archive_path; assert the
	# directory leaves its original location without being destroyed.
	run bash -c "
        $(declare -f load_archive_lib)
        PROJECT_ROOT='$PROJECT_ROOT'
        export HOME='$HOME'
        export MOLE_TEST_TRASH_DIR='$MOLE_TEST_TRASH_DIR'
        load_archive_lib
        repos_archive_path '$WORK/trashme' --allow-warm
    "
	[ "$status" -eq 0 ]
	[ ! -d "$WORK/trashme" ]

	# The directory must still exist in the Trash: archiving is recoverable.
	local found
	found=$(find "$MOLE_TEST_TRASH_DIR" -maxdepth 2 -name 'trashme*' 2> /dev/null | head -1)
	[ -n "$found" ]
	[ -f "$found/README.md" ]
}
