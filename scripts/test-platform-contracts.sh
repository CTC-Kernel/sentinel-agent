#!/usr/bin/env bash
# Local contracts; synthetic data only, no deployed agent or network service.
set -euo pipefail
agent_root="$(cd "$(dirname "$0")/.." && pwd)"
platform_root="${1:-$(dirname "$agent_root")/sentinel-grc-v2-prod}"
contract_dir="$(mktemp -d "${TMPDIR:-/tmp}/sentinel-modules-contract.XXXXXX")"
trap 'rm -rf "$contract_dir"' EXIT
export SENTINEL_ALL_UPSTREAM="$contract_dir/upstream.json"
export SENTINEL_ALL_DOWNSTREAM="$contract_dir/downstream.json"
cd "$agent_root"
cargo run --offline -p agent-sync --example platform_contract -- export "$SENTINEL_ALL_UPSTREAM"
(cd "$platform_root/functions" && ./node_modules/.bin/jest --runInBand --cacheDirectory="$contract_dir/jest-cache" --testPathPatterns=allModulesRustContract)
cargo run --offline -p agent-sync --example platform_contract -- verify "$SENTINEL_ALL_DOWNSTREAM"
