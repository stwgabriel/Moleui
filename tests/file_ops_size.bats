#!/usr/bin/env bats

# Tests for get_path_size_kb in lib/core/file_ops.sh.
# Exercises the stat fast-path for regular files / symlinks and the du
# fallback for directories, plus error and edge cases. File sizes track disk
# blocks, not logical length, so cleanup does not overstate sparse files.

setup_file() {
    PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
    export PROJECT_ROOT
}

setup() {
    SANDBOX="$(mktemp -d "${BATS_TEST_DIRNAME}/tmp-fileops-size.XXXXXX")"
    export SANDBOX
    export MOLE_TEST_NO_AUTH=1
}

teardown() {
    rm -rf "$SANDBOX"
}

prelude() {
    cat << EOF
set -euo pipefail
export MOLE_TEST_NO_AUTH=1
source "$PROJECT_ROOT/lib/core/common.sh"
EOF
}

create_sparse_file() {
    local size="$1"
    local path="$2"

    if command -v truncate > /dev/null 2>&1; then
        truncate -s "$size" "$path"
    elif command -v mkfile > /dev/null 2>&1; then
        mkfile -n "$size" "$path"
    else
        skip "truncate or mkfile required to create sparse files"
    fi
}

@test "get_path_size_kb returns 0 for empty path" {
    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb ""
EOF
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
}

@test "get_path_size_kb returns 0 for non-existent path" {
    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/does-not-exist"
EOF
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
}

@test "get_path_size_kb returns 0 for empty file" {
    : > "$SANDBOX/empty"
    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/empty"
EOF
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
}

@test "get_path_size_kb reports allocated blocks for sub-KB files" {
    # 500 logical bytes usually occupy one filesystem block. Match du's
    # disk-usage view rather than the logical byte count.
    dd if=/dev/zero of="$SANDBOX/small" bs=500 count=1 2> /dev/null
    expected=$(du -skP "$SANDBOX/small" | awk '{print $1}')
    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/small"
EOF
    [ "$status" -eq 0 ]
    [ "$output" = "$expected" ]
}

@test "get_path_size_kb reports allocated blocks for 1024-byte file" {
    dd if=/dev/zero of="$SANDBOX/onek" bs=1024 count=1 2> /dev/null
    expected=$(du -skP "$SANDBOX/onek" | awk '{print $1}')
    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/onek"
EOF
    [ "$status" -eq 0 ]
    [ "$output" = "$expected" ]
}

@test "get_path_size_kb matches du for odd byte counts" {
    dd if=/dev/zero of="$SANDBOX/odd" bs=50000 count=1 2> /dev/null
    expected=$(du -skP "$SANDBOX/odd" | awk '{print $1}')
    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/odd"
EOF
    [ "$status" -eq 0 ]
    [ "$output" = "$expected" ]
}

@test "get_path_size_kb does not report sparse logical size" {
    create_sparse_file 100g "$SANDBOX/sparse"
    expected=$(du -skP "$SANDBOX/sparse" | awk '{print $1}')

    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/sparse"
EOF
    [ "$status" -eq 0 ]
    [ "$output" = "$expected" ]
    [ "$output" -lt 1048576 ]
}

@test "get_path_size_kb does not follow symlinks" {
    # 100 KB target, symlink should report its own (tiny) size, not 100 KB.
    dd if=/dev/zero of="$SANDBOX/target" bs=1024 count=100 2> /dev/null
    ln -s "$SANDBOX/target" "$SANDBOX/link"

    target_kb=$(bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/target"
EOF
)
    link_kb=$(bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/link"
EOF
)

    [ "$target_kb" = "100" ]
    # Symlink path strings are short, so link size rounds to 1 KB or 0.
    # Either is acceptable; what must NOT happen is the link reporting the
    # 100 KB target size.
    [ "$link_kb" -lt 10 ]
}

@test "get_path_size_kb still returns 0 for broken symlinks" {
    ln -s "$SANDBOX/missing" "$SANDBOX/broken"
    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/broken"
EOF
    [ "$status" -eq 0 ]
    # -e on a broken symlink returns false, so the early return triggers.
    [ "$output" = "0" ]
}

@test "get_path_size_kb sums directory contents recursively" {
    mkdir -p "$SANDBOX/dir/sub"
    dd if=/dev/zero of="$SANDBOX/dir/a" bs=1024 count=10 2> /dev/null
    dd if=/dev/zero of="$SANDBOX/dir/sub/b" bs=1024 count=20 2> /dev/null

    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$SANDBOX/dir"
EOF
    [ "$status" -eq 0 ]
    # Should be at least the sum of the two files (30 KB). Filesystem
    # overhead may push it slightly higher, so use >= rather than ==.
    [ "$output" -ge 30 ]
}

@test "get_path_size_kb handles whitespace in paths" {
    local quirky="$SANDBOX/dir with spaces"
    mkdir -p "$quirky"
    dd if=/dev/zero of="$quirky/payload" bs=1024 count=5 2> /dev/null

    run bash --noprofile --norc << EOF
$(prelude)
get_path_size_kb "$quirky/payload"
EOF
    [ "$status" -eq 0 ]
    [ "$output" = "5" ]
}
