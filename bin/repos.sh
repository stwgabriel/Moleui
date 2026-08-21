#!/bin/bash
# Mole - Repos command.
# Inventories every git repository, pushes what is unpushed, and archives
# repositories whose work is provably on a remote.
#
# Scanning is delegated to the bundled Go binary. Pushing and archiving stay in
# shell so removals run through Mole's audited helpers.

set -euo pipefail

export LC_ALL=C
export LANG=C

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/core/common.sh"

cleanup() {
    show_cursor 2> /dev/null || true
    cleanup_temp_files 2> /dev/null || true
}
trap cleanup EXIT
trap 'trap - EXIT; cleanup; exit 130' INT TERM

source "$SCRIPT_DIR/../lib/core/log.sh"
_MOLE_REPOS_BIN_DIR="$SCRIPT_DIR"
source "$SCRIPT_DIR/../lib/repos/push.sh"
source "$SCRIPT_DIR/../lib/repos/archive.sh"
source "$SCRIPT_DIR/../lib/repos/sync.sh"

GO_BIN="$SCRIPT_DIR/repos-go"

show_repos_help() {
    cat << 'EOF'
Usage: mo repos [command] [options] [root ...]

Commands:
  (none)              List every repository with its cloud status.
  push                Push unpushed branches and tags.
  sync                Pull clean repositories and push their branches and tags.
  archive             Move fully pushed, idle repositories to the Trash.
  plan                Print a proposed folder layout. Moves nothing.

List options (passed straight to the scanner):
  --json              Machine-readable report.
  --verify            Contact remotes and confirm every ref is really there.
  --cold-days <n>     Idle days before a repo counts as cold (default 7).
  --filter <kind>     all, archivable, needs-push, push-blocked, blocked,
                      no-remote, third-party, cold, plain.

Push options:
  --dry-run           Show what would be pushed.
  --yes               Do not ask for confirmation.
  <path>...           Limit to specific repositories.

Sync options:
  --profile <login>    Signed-in GitHub account used for new repositories.
  --create-missing     Create private GitHub repositories for selected repos with no remote.
  --dry-run            Show what would change.
  --yes                Do not ask for confirmation.
  <path>...            Limit to specific repositories.

Archive options:
  --dry-run           Show what would be moved to the Trash.
  --yes               Do not ask for confirmation.
  --vault             Copy local-only files (.env, keys, local databases) to
                      ~/.mole/repo-vault before archiving.
  --allow-warm        Archive even if the repository was touched recently.
  <path>...           Limit to specific repositories.

Archiving never deletes: repositories go to the Trash, and only after every
branch and tag has been confirmed present on the remote. Pushing never creates
commits; a dirty working tree is reported for you to resolve.

Roots default to $MOLE_REPOS_ROOTS, then ~/Dev.
EOF
}

require_go_bin() {
    if [[ ! -x "$GO_BIN" ]]; then
        echo "Bundled repo scanner not found at $GO_BIN." >&2
        echo "Run 'make build' or reinstall Mole to restore it." >&2
        exit 1
    fi
}

cmd_list() {
    require_go_bin
    exec "$GO_BIN" "$@"
}

cmd_plan() {
    require_go_bin
    # The scanner renders the proposal so there is exactly one place that
    # decides where a repository belongs.
    exec "$GO_BIN" --plan --verify "$@"
}

cmd_push() {
    require_go_bin
    local dry_run=false
    local assume_yes=false
    local -a targets=()
    local -a roots=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run | -n) dry_run=true ;;
            --yes | -y) assume_yes=true ;;
            --help | -h)
                show_repos_help
                return 0
                ;;
            -*)
                echo "Unknown push option: $1" >&2
                return 1
                ;;
            *)
                if [[ -d "$1" ]]; then targets+=("$1"); else roots+=("$1"); fi
                ;;
        esac
        shift
    done

    [[ "$dry_run" == "true" ]] && export MOLE_DRY_RUN=1

    # Without explicit targets, ask the scanner which repositories actually have
    # something to push. Verification is on so a stale remote-tracking ref does
    # not hide a branch that never made it to the server.
    if [[ ${#targets[@]} -eq 0 ]]; then
        local paths=""
        paths=$("$GO_BIN" --verify --filter needs-push --paths-only ${roots[@]+"${roots[@]}"}) || true
        if [[ -z "$paths" ]]; then
            log_success "Every branch is already on its remote."
            return 0
        fi
        while IFS= read -r line; do
            [[ -n "$line" ]] && targets+=("$line")
        done <<< "$paths"
    fi

    echo "Repositories with unpushed work: ${#targets[@]}"
    local repo=""
    for repo in "${targets[@]}"; do
        printf '  %s\n' "$repo"
    done
    echo

    if [[ "$assume_yes" != "true" && "$dry_run" != "true" ]]; then
        printf 'Push all of these? [y/N] '
        local answer=""
        read -r answer < /dev/tty || answer=""
        case "$answer" in
            y | Y | yes | YES) ;;
            *)
                echo "Nothing pushed."
                return 0
                ;;
        esac
    fi

    local ok_repos=0
    local failed_repos=0
    local -a failures=()

    for repo in "${targets[@]}"; do
        local remote="origin"
        remote=$(git -C "$repo" remote 2> /dev/null | head -1 || true)
        if [[ -z "$remote" ]]; then
            failed_repos=$((failed_repos + 1))
            failures+=("$(basename "$repo"): no remote configured")
            continue
        fi

        # Ask the scanner which branches are genuinely missing from the remote
        # rather than trusting local ahead-counts, which stay at zero when a
        # remote branch has been deleted.
        local -a branches=()
        local branch_list=""
        local branch_err=""
        local branch_rc=0
        # create_temp_file registers the file with Mole's tracked cleanup, so the
        # EXIT trap removes it instead of a raw rm here.
        local err_file=""
        err_file=$(create_temp_file) || err_file=""
        if [[ -n "$err_file" ]]; then
            branch_list=$("$GO_BIN" --push-branches "$repo" 2> "$err_file") || branch_rc=$?
            branch_err=$(head -1 "$err_file" 2> /dev/null || true)
        else
            branch_list=$("$GO_BIN" --push-branches "$repo" 2> /dev/null) || branch_rc=$?
        fi

        if [[ $branch_rc -ne 0 ]]; then
            failed_repos=$((failed_repos + 1))
            failures+=("$(basename "$repo"): ${branch_err:-could not determine what needs pushing}")
            continue
        fi

        while IFS= read -r line; do
            [[ -n "$line" ]] && branches+=("$line")
        done <<< "$branch_list"

        printf '%s\n' "→ $(basename "$repo")"
        if repos_push_repo "$repo" "$remote" ${branches[@]+"${branches[@]}"}; then
            ok_repos=$((ok_repos + 1))
            log_success "  pushed ${REPOS_PUSH_OK} branch(es)"
        else
            failed_repos=$((failed_repos + 1))
            local failure=""
            for failure in ${REPOS_PUSH_FAILURES[@]+"${REPOS_PUSH_FAILURES[@]}"}; do
                failures+=("$(basename "$repo"): $failure")
            done
            log_warning "  ${REPOS_PUSH_FAILED} branch(es) failed"
        fi
    done

    # Repos that need pushing but cannot be pushed are excluded from the run
    # above. Say so explicitly: silently dropping them would read as "everything
    # is pushed" when it is not.
    local blocked_count=0
    blocked_count=$("$GO_BIN" --verify --filter push-blocked --paths-only ${roots[@]+"${roots[@]}"} 2> /dev/null | grep -c . || true)

    echo
    echo "Pushed: $ok_repos   Failed: $failed_repos"
    if [[ "${blocked_count:-0}" -gt 0 ]]; then
        echo "Skipped: $blocked_count repositor$([[ $blocked_count -eq 1 ]] && echo y || echo ies) that cannot be pushed"
        echo "  (third-party remotes, or two local copies sharing one remote)"
        echo "  See them with: mo repos --verify --filter push-blocked"
    fi
    if [[ ${#failures[@]} -gt 0 ]]; then
        echo "Failures:"
        local f=""
        for f in "${failures[@]}"; do
            printf '  %s\n' "$f"
        done
        return 1
    fi
    return 0
}

cmd_sync() {
    require_go_bin
    local dry_run=false
    local assume_yes=false
    local create_missing=false
    local profile=""
    local -a targets=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run | -n) dry_run=true ;;
            --yes | -y) assume_yes=true ;;
            --create-missing) create_missing=true ;;
            --profile)
                shift
                profile="${1:-}"
                ;;
            --help | -h)
                show_repos_help
                return 0
                ;;
            -*)
                echo "Unknown sync option: $1" >&2
                return 1
                ;;
            *)
                [[ -d "$1/.git" || -f "$1/.git" ]] && targets+=("$1")
                ;;
        esac
        shift
    done

    if [[ -z "$profile" ]]; then
        echo "Choose a GitHub profile with --profile before syncing." >&2
        return 1
    fi
    if [[ ${#targets[@]} -eq 0 ]]; then
        echo "Select at least one repository to sync." >&2
        return 1
    fi
    [[ "$dry_run" == "true" ]] && export MOLE_DRY_RUN=1

    if [[ "$assume_yes" != "true" && "$dry_run" != "true" ]]; then
        printf 'Sync %d repositories? [y/N] ' "${#targets[@]}"
        local answer=""
        read -r answer < /dev/tty || answer=""
        case "$answer" in
            y | Y | yes | YES) ;;
            *)
                echo "Nothing synced."
                return 0
                ;;
        esac
    fi

    local synced=0
    local failed=0
    local repo=""
    for repo in "${targets[@]}"; do
        if repos_sync_one "$repo" "$profile" "$create_missing"; then
            synced=$((synced + 1))
        else
            failed=$((failed + 1))
        fi
    done
    echo "Synced: $synced   Failed: $failed"
    [[ $failed -eq 0 ]]
}

cmd_archive() {
    require_go_bin
    local dry_run=false
    local assume_yes=false
    local use_vault=false
    local allow_warm=false
    local -a targets=()
    local -a roots=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run | -n) dry_run=true ;;
            --yes | -y) assume_yes=true ;;
            --vault) use_vault=true ;;
            --allow-warm) allow_warm=true ;;
            --help | -h)
                show_repos_help
                return 0
                ;;
            -*)
                echo "Unknown archive option: $1" >&2
                return 1
                ;;
            *)
                if [[ -d "$1" ]]; then targets+=("$1"); else roots+=("$1"); fi
                ;;
        esac
        shift
    done

    [[ "$dry_run" == "true" ]] && export MOLE_DRY_RUN=1

    if [[ ${#targets[@]} -eq 0 ]]; then
        local paths=""
        paths=$("$GO_BIN" --verify --filter archivable --paths-only ${roots[@]+"${roots[@]}"}) || true
        if [[ -z "$paths" ]]; then
            log_info "No repository currently passes every archive check."
            log_info "Run 'mo repos --verify' to see what is blocking each one."
            return 0
        fi
        while IFS= read -r line; do
            [[ -n "$line" ]] && targets+=("$line")
        done <<< "$paths"
    fi

    echo "These repositories are fully pushed and idle:"
    local repo=""
    for repo in "${targets[@]}"; do
        printf '  %s\n' "$repo"
    done
    echo
    echo "They will be moved to the Trash, not deleted. Every branch and tag is"
    echo "re-checked against its remote immediately before each move."
    echo

    if [[ "$assume_yes" != "true" && "$dry_run" != "true" ]]; then
        printf 'Archive %d repositor%s to the Trash? [y/N] ' "${#targets[@]}" \
            "$([[ ${#targets[@]} -eq 1 ]] && echo y || echo ies)"
        local answer=""
        read -r answer < /dev/tty || answer=""
        case "$answer" in
            y | Y | yes | YES) ;;
            *)
                echo "Nothing archived."
                return 0
                ;;
        esac
    fi

    local archived=0
    local refused=0
    local total_kb=0
    local -a archive_opts=()
    [[ "$use_vault" == "true" ]] && archive_opts+=("--vault")
    [[ "$allow_warm" == "true" ]] && archive_opts+=("--allow-warm")

    for repo in "${targets[@]}"; do
        printf '%s\n' "→ $(basename "$repo")"
        if repos_archive_path "$repo" ${archive_opts[@]+"${archive_opts[@]}"}; then
            archived=$((archived + 1))
            total_kb=$((total_kb + ${REPOS_ARCHIVED_SIZE_KB:-0}))
            log_success "  moved to Trash"
        else
            refused=$((refused + 1))
        fi
    done

    echo
    if [[ "$dry_run" == "true" ]]; then
        echo "Dry run. Nothing was moved."
    fi
    echo "Archived: $archived   Refused: $refused   Reclaimed: $((total_kb / 1024)) MB"
    return 0
}

main() {
    local command="${1:-}"
    case "$command" in
        push)
            shift
            cmd_push "$@"
            ;;
        sync)
            shift
            cmd_sync "$@"
            ;;
        archive)
            shift
            cmd_archive "$@"
            ;;
        plan)
            shift
            cmd_plan "$@"
            ;;
        help | --help | -h)
            show_repos_help
            ;;
        *)
            cmd_list "$@"
            ;;
    esac
}

main "$@"
