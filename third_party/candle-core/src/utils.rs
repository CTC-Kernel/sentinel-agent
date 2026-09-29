//! Useful functions for checking features.
use std::str::FromStr;

pub fn get_num_threads() -> usize {
    // Respond to the same environment variable as rayon.
    match std::env::var("RAYON_NUM_THREADS")
        .ok()
        .and_then(|s| usize::from_str(&s).ok())
    {
        Some(x) if x > 0 => x,
        Some(_) | None => num_cpus::get(),
    }
}

pub fn has_accelerate() -> bool {
    cfg!(feature = "accelerate")
}

pub fn has_mkl() -> bool {
    cfg!(feature = "mkl")
}

pub fn cuda_is_available() -> bool {
    cfg!(feature = "cuda")
}

pub fn metal_is_available() -> bool {
    cfg!(feature = "metal")
}

/// Whether the AVX2 quantized kernels are used. Sentinel patch: detected at
/// run time (upstream: compile time) so a baseline x86_64 build uses AVX2 on
/// CPUs that have it and stays runnable on the others.
/// `SENTINEL_LLM_SIMD=off` forces the portable kernels.
pub fn with_avx() -> bool {
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    {
        static AVX: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
        *AVX.get_or_init(|| {
            let disabled = std::env::var("SENTINEL_LLM_SIMD")
                .map(|v| v.eq_ignore_ascii_case("off"))
                .unwrap_or(false);
            !disabled
                && std::arch::is_x86_feature_detected!("avx2")
                && std::arch::is_x86_feature_detected!("fma")
                && std::arch::is_x86_feature_detected!("f16c")
        })
    }
    #[cfg(not(any(target_arch = "x86", target_arch = "x86_64")))]
    false
}

pub fn with_neon() -> bool {
    cfg!(target_feature = "neon")
}

pub fn with_simd128() -> bool {
    cfg!(target_feature = "simd128")
}

pub fn with_f16c() -> bool {
    cfg!(target_feature = "f16c")
}
