#!/bin/bash
# Mole - Repo archive helpers.
#
# Archiving means: prove every local ref exists on the remote, then move the
# working copy to the Trash so it stays recoverable. It is not a delete, and it
# never runs on a stale decision: the gate is re-checked against the network
# immediately before the move.
#
# All removal goes through mole_delete from lib/core/file_ops.sh so Trash
# routing, path validation, operation logging, and dry-run behaviour stay
# consistent with the rest of Mole. There is no raw rm in this file.

[[ -n "${_MOLE_REPOS_ARCHIVE_LOADED:-}" ]] && return 0
_MOLE_REPOS_ARCHIVE_LOADED=1

# Where local-only files are copied before a repo is archived.
repos_vault_root() {
    printf '%s\n' "${MOLE_REPO_VAULT:-$HOME/.mole/repo-vault}"
}

# repos_gate_binary locates the Go scanner that owns the archive decision.
repos_gate_binary() {
    local script_dir="${_MOLE_REPOS_BIN_DIR:-}"
    if [[ -z "$script_dir" ]]; then
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" 2> /dev/null && pwd)" || return 1
    fi
    local bin="$script_dir/repos-go"
    [[ -x "$bin" ]] || return 1
    printf '%s\n' "$bin"
}

# repos_check_gate re-evaluates every archive precondition for one path.
#
# Stores the human-readable gate report in REPOS_GATE_REPORT, the reclaimable
# size in REPOS_GATE_SIZE_KB, and any local-only files in REPOS_GATE_LOCAL_FILES.
# Returns 0 only when the path is archivable.
repos_check_gate() {
    local repo="$1"
    shift
    local -a waivers=("$@")

    REPOS_GATE_REPORT=""
    REPOS_GATE_SIZE_KB=0
    REPOS_GATE_LOCAL_FILES=()

    local bin=""
    if ! bin=$(repos_gate_binary); then
        REPOS_GATE_REPORT="repo scanner binary not found; run 'make build'"
        return 1
    fi

    local -a args=(--gate "$repo")
    # bash 3.2 under `set -u` treats "${arr[@]}" on an empty array as unbound,
    # so every expansion of a possibly-empty array is guarded by its length.
    if [[ ${#waivers[@]} -gt 0 ]]; then
        local waiver=""
        for waiver in "${waivers[@]}"; do
            [[ -n "$waiver" ]] && args+=(--ignore-gate "$waiver")
        done
    fi

    local output=""
    local rc=0
    output=$("$bin" "${args[@]}" 2>&1) || rc=$?
    REPOS_GATE_REPORT="$output"

    local line=""
    while IFS= read -r line; do
        case "$line" in
            size_kb=*) REPOS_GATE_SIZE_KB="${line#size_kb=}" ;;
            local_only=*) REPOS_GATE_LOCAL_FILES+=("${line#local_only=}") ;;
        esac
    done <<< "$output"

    return $rc
}

# repos_vault_local_files copies the gitignored, irreplaceable files out of a
# repository before it is archived.
#
# Copies, never moves: if anything below fails the original is still in place.
# The caller must confirm success before waiving the local-only gate.
repos_vault_local_files() {
    local repo="$1"
    shift
    local -a files=("$@")

    # Explicit if/fi rather than `[[ ... ]] && return 0`: the short-circuit form
    # propagates exit 1 from a failed test, which callers reading the status
    # would misread as a vault failure.
    if [[ ${#files[@]} -eq 0 ]]; then
        return 0
    fi

    local stamp=""
    stamp=$(date +%Y%m%d-%H%M%S)
    local dest=""
    dest="$(repos_vault_root)/$(basename "$repo")-$stamp"

    if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
        printf '%s\n' "would copy ${#files[@]} local-only file(s) to $dest"
        REPOS_VAULT_PATH="$dest"
        return 0
    fi

    # Guarded non-empty above, so a plain quoted expansion is safe here and
    # keeps filenames containing spaces intact.
    local rel=""
    for rel in "${files[@]}"; do
        local src="$repo/$rel"
        [[ -e "$src" ]] || continue
        local target="$dest/$rel"
        if ! mkdir -p "$(dirname "$target")"; then
            log_error "Could not create vault directory for $rel"
            return 1
        fi
        # -p preserves timestamps and mode so a restored .env keeps its
        # permissions; a credential file must not come back world-readable.
        if ! cp -p "$src" "$target"; then
            log_error "Could not copy $rel into the vault"
            return 1
        fi
    done

    chmod -R go-rwx "$dest" 2> /dev/null || true
    REPOS_VAULT_PATH="$dest"
    return 0
}

# repos_archive_path archives one repository.
#
# Usage: repos_archive_path <path> [--vault] [--allow-warm]
#
# --vault      copy local-only files to the vault first, then waive that gate
# --allow-warm waive the idle-time check for a repo the user knows is finished
#
# Returns 0 on success, 1 when refused or when the move failed. Refusal is a
# normal outcome, not an error to work around.
repos_archive_path() {
    local repo="$1"
    shift

    local use_vault=false
    local allow_warm=false
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --vault) use_vault=true ;;
            --allow-warm) allow_warm=true ;;
            *)
                log_error "repos_archive_path: unknown option $1"
                return 1
                ;;
        esac
        shift
    done

    if [[ -z "$repo" || "${repo:0:1}" != "/" ]]; then
        log_error "Archive needs an absolute path, got: ${repo:-<empty>}"
        return 1
    fi
    if [[ ! -d "$repo" ]]; then
        log_error "Not a directory: $repo"
        return 1
    fi

    # First pass with no waivers, so the report reflects the true state and the
    # local-only file list is populated before anything is copied.
    local -a waivers=()
    repos_check_gate "$repo" || true

    if [[ "$use_vault" == "true" && ${#REPOS_GATE_LOCAL_FILES[@]} -gt 0 ]]; then
        if ! repos_vault_local_files "$repo" "${REPOS_GATE_LOCAL_FILES[@]}"; then
            log_error "Vault copy failed; leaving $repo untouched"
            return 1
        fi
        log_info "Copied ${#REPOS_GATE_LOCAL_FILES[@]} local-only file(s) to ${REPOS_VAULT_PATH}"
        waivers+=("no_local_only_files")
    fi
    [[ "$allow_warm" == "true" ]] && waivers+=("cold")

    # Re-check with the waivers applied. This second call is the one that
    # authorises the move, and it goes back to the network every time.
    if ! repos_check_gate "$repo" "${waivers[@]+"${waivers[@]}"}"; then
        log_warning "Refusing to archive $(basename "$repo"):"
        printf '%s\n' "$REPOS_GATE_REPORT" | grep -E '^FAIL' || true
        return 1
    fi

    local size_kb="${REPOS_GATE_SIZE_KB:-0}"

    # Trash mode keeps the copy recoverable. Archiving is meant to free space,
    # not to destroy history, and the user may still need the directory back.
    local previous_mode="${MOLE_DELETE_MODE:-permanent}"
    export MOLE_DELETE_MODE=trash

    local rc=0
    if ! mole_delete "$repo" false; then
        rc=1
    fi

    export MOLE_DELETE_MODE="$previous_mode"

    if [[ $rc -ne 0 ]]; then
        log_error "Could not move $repo to the Trash"
        return 1
    fi

    REPOS_ARCHIVED_SIZE_KB="$size_kb"
    return 0
}
