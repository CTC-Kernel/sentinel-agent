#!/usr/bin/env bash
# Offline cross-language regression: actual Rust serialization → platform handlers → Rust.
set -euo pipefail
agent_root="$(cd "$(dirname "$0")/.." && pwd)"
platform_root="${1:-$(dirname "$agent_root")/sentinel-grc-v2-prod}"
contract_dir="$(mktemp -d "${TMPDIR:-/tmp}/sentinel-edr-contract.XXXXXX")"
trap 'rm -rf "$contract_dir"' EXIT
export SENTINEL_EDR_UPSTREAM="$contract_dir/upstream.json"
export SENTINEL_EDR_DOWNSTREAM="$contract_dir/downstream.json"
cd "$agent_root"
cargo run --offline -p agent-core --no-default-features --features gui --example edr_contract -- export "$SENTINEL_EDR_UPSTREAM"
(cd "$platform_root/functions" && ./node_modules/.bin/jest --runInBand --cacheDirectory="$contract_dir/jest-cache" --testPathPatterns=edrRustContract)
cargo run --offline -p agent-core --no-default-features --features gui --example edr_contract -- verify "$SENTINEL_EDR_DOWNSTREAM"
