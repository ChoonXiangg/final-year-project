#!/usr/bin/env bash
# Workaround for SP1 5.x: sp1-build passes --remap-path-scope=object to the
# SP1 custom rustc toolchain, but the toolchain fork never merged the Rust 1.81
# stabilisation so it only knows the nightly -Z form. Strip the flag so the
# ELF compilation succeeds without changing any other build behaviour.

RUSTC="$1"
shift

FILTERED=()
for arg in "$@"; do
    if [[ "$arg" == "--remap-path-scope="* ]]; then
        continue
    fi
    FILTERED+=("$arg")
done

exec "$RUSTC" "${FILTERED[@]}"
