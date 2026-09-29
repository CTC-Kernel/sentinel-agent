//! Run-time adaptation of local inference to the machine.
//!
//! Release binaries target the baseline CPU of each architecture so they run
//! on every supported PC. The fast paths are chosen when the agent starts:
//! AVX2/FMA kernels on x86_64 CPUs that have them (see
//! `third_party/candle-core`), NEON on ARM, Metal on Apple Silicon, and one
//! compute thread per physical core.

/// Environment variable read by rayon (and candle) for the thread count.
const THREADS_ENV: &str = "RAYON_NUM_THREADS";

/// Use one compute thread per physical core. Matrix products gain nothing
/// from hyper-threads (both siblings share the same vector units) and the
/// spare logical cores keep the rest of the agent and the desktop
/// responsive during a generation. An explicit `RAYON_NUM_THREADS` wins.
///
/// # Safety
/// Mutates the process environment: call it before any other thread starts.
pub unsafe fn configure_threads() {
    if std::env::var_os(THREADS_ENV).is_some() {
        return;
    }
    let logical = std::thread::available_parallelism().map_or(1, |n| n.get());
    let Some(physical) = sysinfo::System::physical_core_count() else {
        return;
    };
    let threads = physical.clamp(1, logical);
    if threads < logical {
        // SAFETY: single-threaded at this point (caller contract).
        unsafe { std::env::set_var(THREADS_ENV, threads.to_string()) };
    }
}

/// Compute threads used for inference.
pub fn compute_threads() -> usize {
    std::env::var(THREADS_ENV)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|threads| *threads > 0)
        .unwrap_or_else(|| std::thread::available_parallelism().map_or(1, |n| n.get()))
}

/// Vector instructions used by the quantized CPU kernels on this machine.
pub fn cpu_kernels() -> &'static str {
    if cfg!(any(target_arch = "x86", target_arch = "x86_64")) {
        if candle_core::utils::with_avx() {
            "AVX2/FMA"
        } else {
            "SSE (processeur sans AVX2)"
        }
    } else if candle_core::utils::with_neon() {
        "NEON"
    } else {
        "générique"
    }
}

/// Human-readable compute backend, shown in the model diagnostic.
pub fn cpu_label() -> String {
    format!("CPU {} · {} threads", cpu_kernels(), compute_threads())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_describe_the_running_machine() {
        let label = cpu_label();
        assert!(label.starts_with("CPU "), "{label}");
        assert!(compute_threads() >= 1);
        #[cfg(target_arch = "x86_64")]
        assert_eq!(
            cpu_kernels() == "AVX2/FMA",
            std::arch::is_x86_feature_detected!("avx2")
                && std::arch::is_x86_feature_detected!("fma")
                && std::arch::is_x86_feature_detected!("f16c")
                && std::env::var("SENTINEL_LLM_SIMD")
                    .map_or(true, |v| !v.eq_ignore_ascii_case("off"))
        );
    }
}
