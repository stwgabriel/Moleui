#!/bin/bash
# Mole - conservative repository synchronisation helpers.

[[ -n "${_MOLE_REPOS_SYNC_LOADED:-}" ]] && return 0
_MOLE_REPOS_SYNC_LOADED=1

repos_sync_one() {
    local repo="$1"
    local profile="$2"
    local create_missing="$3"
    local dirty=""
    dirty=$(git -C "$repo" status --porcelain 2> /dev/null || true)
    if [[ -n "$dirty" ]]; then
        printf 'SKIPPED %s: uncommitted changes\n' "$repo"
        return 0
    fi

    local remote=""
    remote=$(git -C "$repo" remote get-url origin 2> /dev/null || true)
    if [[ -z "$remote" ]]; then
        if [[ "$create_missing" != "true" ]]; then
            printf 'SKIPPED %s: no remote\n' "$repo"
            return 0
        fi
        if ! git -C "$repo" rev-parse --verify HEAD > /dev/null 2>&1; then
            printf 'SKIPPED %s: no commit to upload\n' "$repo"
            return 0
        fi
        local name=""
        name=$(basename "$repo")
        if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
            printf 'would create private GitHub repository %s/%s and push %s\n' "$profile" "$name" "$repo"
            return 0
        fi
        if ! gh repo create "$profile/$name" --private --source "$repo" --remote origin --push; then
            printf 'FAILED %s: could not create private GitHub repository\n' "$repo" >&2
            return 1
        fi
        printf 'SYNCED %s: created private %s/%s\n' "$repo" "$profile" "$name"
        return 0
    fi

    local branch=""
    branch=$(git -C "$repo" symbolic-ref --quiet --short HEAD 2> /dev/null || true)
    if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
        printf 'would pull --ff-only and push %s\n' "$repo"
        return 0
    fi

    if [[ -n "$branch" ]] && git -C "$repo" rev-parse --verify "$branch@{upstream}" > /dev/null 2>&1; then
        if ! GIT_TERMINAL_PROMPT=0 git -C "$repo" pull --ff-only; then
            printf 'FAILED %s: pull needs attention\n' "$repo" >&2
            return 1
        fi
    fi
    if ! GIT_TERMINAL_PROMPT=0 git -C "$repo" push --all origin; then
        printf 'FAILED %s: push failed\n' "$repo" >&2
        return 1
    fi
    if ! GIT_TERMINAL_PROMPT=0 git -C "$repo" push --tags origin; then
        printf 'FAILED %s: tag push failed\n' "$repo" >&2
        return 1
    fi
    printf 'SYNCED %s\n' "$repo"
}
