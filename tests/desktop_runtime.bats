#!/usr/bin/env bats

setup_file() {
    PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
    export PROJECT_ROOT
}

@test "desktop runtime includes every shell subcommand dispatched by mole" {
    run node "$PROJECT_ROOT/apps/desktop/scripts/prepare-runtime.mjs"

    [ "$status" -eq 0 ]

    local script
    for script in clean status uninstall optimize analyze purge installer touchid completion; do
        [ -x "$PROJECT_ROOT/apps/desktop/.mole-runtime/bin/${script}.sh" ]
    done
}
