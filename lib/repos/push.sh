#!/bin/bash
# Mole - Repo push helpers.
#
# Pushes existing commits to their remotes. This never creates commits: a dirty
# working tree is reported as a blocker for the user to resolve, because deciding
# what belongs in a commit is not something a cleanup tool can infer.

# Guard against double-sourcing.
[[ -n "${_MOLE_REPOS_PUSH_LOADED:-}" ]] && return 0
_MOLE_REPOS_PUSH_LOADED=1

# repos_push_branch pushes one branch, setting upstream when it has none.
#
# Returns 0 on success, 1 on failure. Output is captured so the caller decides
# what to surface; git writes progress to stderr even when it succeeds.
repos_push_branch() {
    local repo="$1"
    local branch="$2"
    local remote="${3:-origin}"
    local -a push_args=(push)

    # A branch with no upstream needs -u so the next scan can see the link.
    local upstream=""
    upstream=$(git -C "$repo" rev-parse --abbrev-ref "${branch}@{upstream}" 2> /dev/null || true)
    if [[ -z "$upstream" ]]; then
        push_args+=(--set-upstream)
    fi
    push_args+=("$remote" "refs/heads/${branch}:refs/heads/${branch}")

    if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
        printf '%s\n' "would run: git -C \"$repo\" ${push_args[*]}"
        return 0
    fi

    local output=""
    local rc=0
    # --no-verify is deliberately NOT passed: pre-push hooks are the user's own
    # safety net and skipping them silently would be a surprise.
    output=$(GIT_TERMINAL_PROMPT=0 git -C "$repo" "${push_args[@]}" 2>&1) || rc=$?
    if [[ $rc -ne 0 ]]; then
        REPOS_PUSH_ERROR=$(repos_first_error_line "$output")
        return 1
    fi
    REPOS_PUSH_ERROR=""
    return 0
}

# repos_push_tags pushes every local tag that the remote does not have.
repos_push_tags() {
    local repo="$1"
    local remote="${2:-origin}"

    if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
        printf '%s\n' "would run: git -C \"$repo\" push $remote --tags"
        return 0
    fi

    local output=""
    local rc=0
    output=$(GIT_TERMINAL_PROMPT=0 git -C "$repo" push "$remote" --tags 2>&1) || rc=$?
    if [[ $rc -ne 0 ]]; then
        REPOS_PUSH_ERROR=$(repos_first_error_line "$output")
        return 1
    fi
    REPOS_PUSH_ERROR=""
    return 0
}

# repos_first_error_line extracts the line of git output that names the problem.
# Collapsing multi-line git errors to one useful line keeps per-repo results
# readable when pushing dozens of repositories.
repos_first_error_line() {
    local text="$1"
    local line=""
    local fallback=""

    while IFS= read -r line; do
        [[ -z "${line// /}" ]] && continue
        case "$line" in
            "remote: "*)
                printf '%s\n' "${line#remote: }"
                return 0
                ;;
            *"Permission denied"* | *"Authentication failed"* | *"not found"*)
                printf '%s\n' "$line"
                return 0
                ;;
            "fatal: "* | "error: "*)
                [[ -z "$fallback" ]] && fallback="$line"
                ;;
            *)
                [[ -z "$fallback" ]] && fallback="$line"
                ;;
        esac
    done <<< "$text"

    printf '%s\n' "${fallback:-push failed}"
}

# repos_push_repo pushes every branch listed in REPOS_BRANCH_LIST for one repo,
# then its tags. Sets REPOS_PUSH_OK / REPOS_PUSH_FAILED counters and appends any
# failures to REPOS_PUSH_FAILURES.
repos_push_repo() {
    local repo="$1"
    local remote="${2:-origin}"
    shift 2
    local -a branches=("$@")

    REPOS_PUSH_OK=0
    REPOS_PUSH_FAILED=0
    REPOS_PUSH_FAILURES=()

    # bash 3.2 under `set -u` rejects "${arr[@]}" on an empty array, and a repo
    # can legitimately have zero branches to push and only a missing tag.
    if [[ ${#branches[@]} -gt 0 ]]; then
        local branch=""
        for branch in "${branches[@]}"; do
            [[ -z "$branch" ]] && continue
            if repos_push_branch "$repo" "$branch" "$remote"; then
                REPOS_PUSH_OK=$((REPOS_PUSH_OK + 1))
            else
                REPOS_PUSH_FAILED=$((REPOS_PUSH_FAILED + 1))
                REPOS_PUSH_FAILURES+=("${branch}: ${REPOS_PUSH_ERROR}")
            fi
        done
    fi

    # Tags are pushed once per repo. A tag failure is reported but does not
    # invalidate branches that went up successfully.
    if ! repos_push_tags "$repo" "$remote"; then
        REPOS_PUSH_FAILURES+=("tags: ${REPOS_PUSH_ERROR}")
    fi

    [[ $REPOS_PUSH_FAILED -eq 0 ]]
}
