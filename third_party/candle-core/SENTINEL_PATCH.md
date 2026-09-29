# candle-core 0.9.2, Sentinel patch

Copy of the crates.io `candle-core` 0.9.2 (MIT OR Apache-2.0, see `LICENSE`),
wired in through `[patch.crates-io]` in the workspace `Cargo.toml`. Upstream
tests, benches and examples are removed.

## Why

Upstream selects the AVX2 kernels of the quantized (GGUF) matrix products at
compile time (`cfg(target_feature = "avx2")`). Release binaries target the
baseline x86_64 CPU so they run on every PC, which meant the local assistant
never used AVX2 (measured: −35 % generation speed, +45 % time to first token).

## What changed

- `src/utils.rs`: `with_avx()` detects AVX2 + FMA + F16C at run time (cached).
  `SENTINEL_LLM_SIMD=off` forces the portable kernels.
- `src/quantized/avx.rs`: every function is compiled with
  `#[target_feature(enable = "avx,avx2,fma,f16c,ssse3,sse3")]`; the entry points
  are `unsafe` (the caller checks the CPU). Parity test at the end of the file.
- `src/quantized/mod.rs`, `src/quantized/k_quants.rs`: the AVX2 module is
  always compiled on x86/x86_64 and chosen when `with_avx()` is true.

## Updating candle

Re-apply these three edits on the new version (search for `Sentinel patch`),
or drop the patch if upstream adopts run-time dispatch.

```sh
cargo test -p candle-core --lib runtime_dispatch
SENTINEL_LLM_SIMD=off cargo test -p candle-core --lib runtime_dispatch
```
