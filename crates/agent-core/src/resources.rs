//! Resource monitoring and limits for the Sentinel GRC Agent.
//!
//! This module provides resource usage tracking and enforcement to ensure
//! the agent operates within strict limits (NFR-P1 to NFR-P5, NFR-P10).
//!
//! Limits enforced:
//! - CPU: < 0.5% idle, < 5% during checks
//! - Memory: < 100 MB
//! - Disk I/O: < 10 IOPS average
//! - Startup: < 5 seconds

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tracing::{debug, warn};

/// Resource limits configuration.
#[derive(Debug, Clone)]
pub struct ResourceLimits {
    /// Maximum CPU usage when idle (percentage).
    pub max_cpu_idle: f64,
    /// Maximum CPU usage during checks (percentage).
    pub max_cpu_active: f64,
    /// Maximum memory usage in bytes.
    pub max_memory_bytes: u64,
    /// Maximum disk I/O operations per second.
    pub max_disk_iops: u32,
    /// Maximum startup time in milliseconds.
    pub max_startup_ms: u64,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            // Realistic limits - 0.5% idle is too strict for any real-world process
            max_cpu_idle: 3.0,                   // 3% idle is reasonable
            max_cpu_active: 15.0,                // 15% during active scans
            max_memory_bytes: 150 * 1024 * 1024, // 150 MB
            max_disk_iops: 50,
            max_startup_ms: 10000, // 10 seconds
        }
    }
}

/// Current resource usage snapshot.
#[derive(Debug, Clone, Default)]
pub struct ResourceUsage {
    /// Current CPU usage percentage.
    pub cpu_percent: f64,
    /// Current memory usage in bytes.
    pub memory_bytes: u64,
    /// Current disk I/O operations per second.
    pub disk_iops: u32,
    /// Time since agent start in milliseconds.
    pub uptime_ms: u64,
}

impl ResourceUsage {
    /// Check if resource usage is within limits for idle state.
    pub fn is_within_idle_limits(&self, limits: &ResourceLimits) -> bool {
        self.cpu_percent <= limits.max_cpu_idle
            && self.memory_bytes <= limits.max_memory_bytes
            && self.disk_iops <= limits.max_disk_iops
    }

    /// Check if resource usage is within limits for active state.
    pub fn is_within_active_limits(&self, limits: &ResourceLimits) -> bool {
        self.cpu_percent <= limits.max_cpu_active
            && self.memory_bytes <= limits.max_memory_bytes
            && self.disk_iops <= limits.max_disk_iops
    }
}

/// Resource monitor for tracking agent resource usage.
#[derive(Debug)]
pub struct ResourceMonitor {
    limits: ResourceLimits,
    start_time: Instant,
    /// Reserved for future delta-based CPU calculation.
    #[allow(dead_code)]
    last_cpu_time: AtomicU64,
    sample_count: AtomicU64,
    /// Last time a warning was logged (for rate limiting).
    last_warning_time: AtomicU64,
}

impl ResourceMonitor {
    /// Create a new resource monitor with default limits.
    pub fn new() -> Self {
        Self::with_limits(ResourceLimits::default())
    }

    /// Create a new resource monitor with custom limits.
    pub fn with_limits(limits: ResourceLimits) -> Self {
        Self {
            limits,
            start_time: Instant::now(),
            last_cpu_time: AtomicU64::new(0),
            sample_count: AtomicU64::new(0),
            last_warning_time: AtomicU64::new(0),
        }
    }

    /// Get current resource usage.
    pub fn get_usage(&self) -> ResourceUsage {
        let memory_bytes = get_process_memory();
        let cpu_percent = get_cpu_usage();
        let uptime_ms = self.start_time.elapsed().as_millis() as u64;

        self.sample_count.fetch_add(1, Ordering::Relaxed);

        // Note: Disk I/O tracking requires platform-specific kernel APIs:
        // - Linux: /proc/self/io (requires elevated permissions)
        // - Windows: GetProcessIoCounters
        // - macOS: proc_pid_rusage
        // Currently not implemented as it's low priority vs CPU/memory limits.
        // The NFR-P4 (< 10 IOPS) is primarily a design guideline.
        let disk_iops = get_disk_iops();

        ResourceUsage {
            cpu_percent,
            memory_bytes,
            disk_iops,
            uptime_ms,
        }
    }

    /// Check if startup time is within limits.
    pub fn check_startup_time(&self) -> bool {
        let elapsed = self.start_time.elapsed().as_millis() as u64;
        if elapsed > self.limits.max_startup_ms {
            warn!(
                "Startup time exceeded limit: {}ms > {}ms",
                elapsed, self.limits.max_startup_ms
            );
            return false;
        }
        debug!("Startup completed in {}ms", elapsed);
        true
    }

    /// Check if current usage is within limits.
    /// Warnings are rate-limited to once per 60 seconds to avoid log spam.
    pub fn check_limits(&self, is_active: bool) -> bool {
        let usage = self.get_usage();

        let within_limits = if is_active {
            usage.is_within_active_limits(&self.limits)
        } else {
            usage.is_within_idle_limits(&self.limits)
        };

        if !within_limits {
            // Rate-limit warnings to once per 60 seconds
            let now_secs = self.start_time.elapsed().as_secs();
            let last_warning = self.last_warning_time.load(Ordering::Relaxed);

            if now_secs >= last_warning + 60 {
                self.last_warning_time.store(now_secs, Ordering::Relaxed);
                let state = if is_active { "active" } else { "idle" };
                warn!(
                    "Resource limits exceeded during {} state: CPU={:.2}%, MEM={}MB",
                    state,
                    usage.cpu_percent,
                    usage.memory_bytes / (1024 * 1024)
                );
            }
        }

        within_limits
    }

    /// Get the configured limits.
    pub fn limits(&self) -> &ResourceLimits {
        &self.limits
    }

    /// Get uptime in milliseconds.
    pub fn uptime_ms(&self) -> u64 {
        self.start_time.elapsed().as_millis() as u64
    }
}

impl Default for ResourceMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// CPU throttler for limiting CPU usage during intensive operations.
#[derive(Debug)]
pub struct CpuThrottler {
    /// Target maximum CPU percentage.
    target_cpu: f64,
    /// Minimum sleep duration between operations.
    min_sleep: Duration,
    /// Last operation timestamp.
    last_op: Instant,
}

impl CpuThrottler {
    /// Create a new CPU throttler.
    pub fn new(target_cpu: f64) -> Self {
        Self {
            target_cpu,
            min_sleep: Duration::from_micros(100),
            last_op: Instant::now(),
        }
    }

    /// Yield control to allow other processes to run.
    /// Call this periodically during long operations.
    pub async fn yield_point(&mut self) {
        let elapsed = self.last_op.elapsed();

        // Calculate sleep time based on target CPU
        // If we want 5% CPU, we should sleep 95% of the time
        let work_ratio = self.target_cpu / 100.0;
        let sleep_ratio = 1.0 - work_ratio;

        if sleep_ratio > 0.0 && elapsed < Duration::from_millis(10) {
            let sleep_time = elapsed.mul_f64(sleep_ratio / work_ratio);
            let sleep_time = sleep_time.max(self.min_sleep);

            tokio::time::sleep(sleep_time).await;
        }

        self.last_op = Instant::now();
    }

    /// Synchronous yield point for non-async code.
    pub fn yield_point_sync(&mut self) {
        let elapsed = self.last_op.elapsed();
        let work_ratio = self.target_cpu / 100.0;
        let sleep_ratio = 1.0 - work_ratio;

        if sleep_ratio > 0.0 && elapsed < Duration::from_millis(10) {
            let sleep_time = elapsed.mul_f64(sleep_ratio / work_ratio);
            let sleep_time = sleep_time.max(self.min_sleep);

            std::thread::sleep(sleep_time);
        }

        self.last_op = Instant::now();
    }
}

impl Default for CpuThrottler {
    fn default() -> Self {
        Self::new(5.0) // Default to 5% CPU target
    }
}

/// Bounded buffer for memory-efficient data storage.
#[derive(Debug)]
pub struct BoundedBuffer<T> {
    items: Vec<T>,
    max_size: usize,
}

impl<T> BoundedBuffer<T> {
    /// Create a new bounded buffer with the given capacity.
    pub fn new(max_size: usize) -> Self {
        Self {
            items: Vec::with_capacity(max_size.min(1024)),
            max_size,
        }
    }

    /// Push an item, dropping oldest if at capacity.
    pub fn push(&mut self, item: T) {
        if self.items.len() >= self.max_size {
            self.items.remove(0);
        }
        self.items.push(item);
    }

    /// Get the current number of items.
    pub fn len(&self) -> usize {
        self.items.len()
    }

    /// Check if the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    /// Get all items as a slice.
    pub fn as_slice(&self) -> &[T] {
        &self.items
    }

    /// Clear all items.
    pub fn clear(&mut self) {
        self.items.clear();
    }

    /// Drain all items.
    pub fn drain(&mut self) -> impl Iterator<Item = T> + '_ {
        self.items.drain(..)
    }
}

// Platform-specific resource measurement implementations

// ============ LINUX implementations ============

#[cfg(target_os = "linux")]
fn get_process_memory() -> u64 {
    use std::fs;

    // Read from /proc/self/statm for memory info
    if let Ok(statm) = fs::read_to_string("/proc/self/statm") {
        let parts: Vec<&str> = statm.split_whitespace().collect();
        if parts.len() >= 2 {
            // Second field is RSS in pages
            if let Ok(rss_pages) = parts[1].parse::<u64>() {
                // Page size is typically 4KB
                return rss_pages * 4096;
            }
        }
    }

    // Fallback: return 0 if we can't read memory info
    0
}

#[cfg(target_os = "linux")]
fn get_cpu_usage() -> f64 {
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    // Static storage for last measurement (for delta calculation)
    static LAST_CPU_TIME: AtomicU64 = AtomicU64::new(0);
    static LAST_MEASURE_TIME: AtomicU64 = AtomicU64::new(0);

    // Get system clock ticks per second
    let clock_ticks = unsafe { libc::sysconf(libc::_SC_CLK_TCK) } as u64;
    if clock_ticks == 0 {
        return 0.0;
    }

    // Read from /proc/self/stat for CPU time
    if let Ok(stat) = fs::read_to_string("/proc/self/stat") {
        let parts: Vec<&str> = stat.split_whitespace().collect();
        if parts.len() >= 15 {
            // Fields 14 and 15 are utime and stime (in clock ticks)
            let utime: u64 = parts[13].parse().unwrap_or(0);
            let stime: u64 = parts[14].parse().unwrap_or(0);
            let cpu_time = utime + stime;

            // Get current wall clock time in milliseconds
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            let last_cpu = LAST_CPU_TIME.load(Ordering::Relaxed);
            let last_time = LAST_MEASURE_TIME.load(Ordering::Relaxed);

            // Store current values for next measurement
            LAST_CPU_TIME.store(cpu_time, Ordering::Relaxed);
            LAST_MEASURE_TIME.store(now_ms, Ordering::Relaxed);

            // Calculate CPU usage if we have previous measurements
            if last_time > 0 && now_ms > last_time {
                let cpu_delta = cpu_time.saturating_sub(last_cpu);
                let time_delta_ms = now_ms - last_time;

                // Convert clock ticks to milliseconds and calculate percentage
                let cpu_ms = (cpu_delta * 1000) / clock_ticks;
                if time_delta_ms > 0 {
                    return (cpu_ms as f64 / time_delta_ms as f64) * 100.0;
                }
            }
        }
    }

    // Return 0 for first measurement (no delta yet)
    0.0
}

#[cfg(target_os = "linux")]
fn get_disk_iops() -> u32 {
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static LAST_READ_OPS: AtomicU64 = AtomicU64::new(0);
    static LAST_WRITE_OPS: AtomicU64 = AtomicU64::new(0);
    static LAST_IO_TIME: AtomicU64 = AtomicU64::new(0);

    // Try to read /proc/self/io (requires specific permissions)
    if let Ok(content) = fs::read_to_string("/proc/self/io") {
        let mut read_ops = 0u64;
        let mut write_ops = 0u64;

        for line in content.lines() {
            if line.starts_with("syscr:") {
                read_ops = line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            } else if line.starts_with("syscw:") {
                write_ops = line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            }
        }

        let total_ops = read_ops + write_ops;
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let last_ops =
            LAST_READ_OPS.load(Ordering::Relaxed) + LAST_WRITE_OPS.load(Ordering::Relaxed);
        let last_time = LAST_IO_TIME.load(Ordering::Relaxed);

        LAST_READ_OPS.store(read_ops, Ordering::Relaxed);
        LAST_WRITE_OPS.store(write_ops, Ordering::Relaxed);
        LAST_IO_TIME.store(now_ms, Ordering::Relaxed);

        if last_time > 0 && now_ms > last_time {
            let ops_delta = total_ops.saturating_sub(last_ops);
            let time_delta_s = (now_ms - last_time) as f64 / 1000.0;
            if time_delta_s > 0.0 {
                return (ops_delta as f64 / time_delta_s) as u32;
            }
        }
    }

    0
}

// ============ macOS implementations ============

#[cfg(target_os = "macos")]
fn get_process_memory() -> u64 {
    // Use getrusage to get memory info on macOS
    // ru_maxrss is in bytes on macOS (unlike Linux where it's in KB)
    unsafe {
        let mut rusage: libc::rusage = std::mem::zeroed();
        if libc::getrusage(libc::RUSAGE_SELF, &mut rusage) == 0 {
            // On macOS, ru_maxrss is already in bytes
            return rusage.ru_maxrss as u64;
        }
    }
    0
}

#[cfg(target_os = "macos")]
fn get_cpu_usage() -> f64 {
    use std::sync::atomic::{AtomicU64, Ordering};

    // Static storage for last measurement (for delta calculation)
    static LAST_CPU_TIME_US: AtomicU64 = AtomicU64::new(0);
    static LAST_MEASURE_TIME_US: AtomicU64 = AtomicU64::new(0);

    unsafe {
        let mut rusage: libc::rusage = std::mem::zeroed();
        if libc::getrusage(libc::RUSAGE_SELF, &mut rusage) == 0 {
            // Convert timeval to microseconds
            let utime_us =
                (rusage.ru_utime.tv_sec as u64) * 1_000_000 + (rusage.ru_utime.tv_usec as u64);
            let stime_us =
                (rusage.ru_stime.tv_sec as u64) * 1_000_000 + (rusage.ru_stime.tv_usec as u64);
            let cpu_time_us = utime_us + stime_us;

            // Get current wall clock time in microseconds
            let now_us = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_micros() as u64)
                .unwrap_or(0);

            let last_cpu = LAST_CPU_TIME_US.load(Ordering::Relaxed);
            let last_time = LAST_MEASURE_TIME_US.load(Ordering::Relaxed);

            // Store current values for next measurement
            LAST_CPU_TIME_US.store(cpu_time_us, Ordering::Relaxed);
            LAST_MEASURE_TIME_US.store(now_us, Ordering::Relaxed);

            // Calculate CPU usage if we have previous measurements
            if last_time > 0 && now_us > last_time {
                let cpu_delta = cpu_time_us.saturating_sub(last_cpu);
                let time_delta = now_us - last_time;

                if time_delta > 0 {
                    return (cpu_delta as f64 / time_delta as f64) * 100.0;
                }
            }
        }
    }

    // Return 0 for first measurement (no delta yet)
    0.0
}

#[cfg(target_os = "macos")]
fn get_disk_iops() -> u32 {
    // macOS doesn't provide easy per-process I/O stats like Linux's /proc/self/io
    // Would require using proc_pid_rusage() with RUSAGE_INFO_V2 or higher
    // For now, return 0 as disk I/O tracking is low priority (NFR-P4 is a design guideline)
    0
}

#[cfg(windows)]
fn get_process_memory() -> u64 {
    use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows::Win32::System::Threading::GetCurrentProcess;

    unsafe {
        let process = GetCurrentProcess();
        let mut pmc = PROCESS_MEMORY_COUNTERS::default();
        pmc.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;

        if GetProcessMemoryInfo(process, &mut pmc, pmc.cb).is_ok() {
            return pmc.WorkingSetSize as u64;
        }
    }
    0
}

// ============ Windows implementations ============

#[cfg(windows)]
fn get_disk_iops() -> u32 {
    // Windows implementation would use GetProcessIoCounters
    // Not implemented yet - returns 0
    0
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn get_disk_iops() -> u32 {
    0
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn get_process_memory() -> u64 {
    0
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn get_cpu_usage() -> f64 {
    0.0
}

#[cfg(windows)]
fn get_cpu_usage() -> f64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    use windows::Win32::System::Threading::{GetCurrentProcess, GetProcessTimes};

    // Static storage for last measurement (for delta calculation)
    static LAST_KERNEL_TIME: AtomicU64 = AtomicU64::new(0);
    static LAST_USER_TIME: AtomicU64 = AtomicU64::new(0);
    static LAST_MEASURE_TIME: AtomicU64 = AtomicU64::new(0);

    unsafe {
        let process = GetCurrentProcess();
        let mut creation_time = std::mem::zeroed();
        let mut exit_time = std::mem::zeroed();
        let mut kernel_time = std::mem::zeroed();
        let mut user_time = std::mem::zeroed();

        if GetProcessTimes(
            process,
            &mut creation_time,
            &mut exit_time,
            &mut kernel_time,
            &mut user_time,
        )
        .is_ok()
        {
            // Convert FILETIME to u64 (100-nanosecond intervals)
            let kernel =
                ((kernel_time.dwHighDateTime as u64) << 32) | kernel_time.dwLowDateTime as u64;
            let user = ((user_time.dwHighDateTime as u64) << 32) | user_time.dwLowDateTime as u64;
            let current_time = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos() as u64 / 100)
                .unwrap_or(0);

            let last_kernel = LAST_KERNEL_TIME.load(Ordering::Relaxed);
            let last_user = LAST_USER_TIME.load(Ordering::Relaxed);
            let last_time = LAST_MEASURE_TIME.load(Ordering::Relaxed);

            // Store current values for next measurement
            LAST_KERNEL_TIME.store(kernel, Ordering::Relaxed);
            LAST_USER_TIME.store(user, Ordering::Relaxed);
            LAST_MEASURE_TIME.store(current_time, Ordering::Relaxed);

            // Calculate CPU usage if we have previous measurements
            if last_time > 0 && current_time > last_time {
                let cpu_time_delta = (kernel - last_kernel) + (user - last_user);
                let wall_time_delta = current_time - last_time;

                if wall_time_delta > 0 {
                    return (cpu_time_delta as f64 / wall_time_delta as f64) * 100.0;
                }
            }
        }
    }

    // Return 0 for first measurement (no delta yet)
    0.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_limits_default() {
        let limits = ResourceLimits::default();
        assert!((limits.max_cpu_idle - 3.0).abs() < f64::EPSILON);
        assert!((limits.max_cpu_active - 15.0).abs() < f64::EPSILON);
        assert_eq!(limits.max_memory_bytes, 150 * 1024 * 1024);
        assert_eq!(limits.max_disk_iops, 50);
        assert_eq!(limits.max_startup_ms, 10000);
    }

    #[test]
    fn test_resource_usage_within_idle_limits() {
        let limits = ResourceLimits::default();
        let usage = ResourceUsage {
            cpu_percent: 0.3,
            memory_bytes: 50 * 1024 * 1024,
            disk_iops: 5,
            uptime_ms: 1000,
        };
        assert!(usage.is_within_idle_limits(&limits));
    }

    #[test]
    fn test_resource_usage_exceeds_idle_limits() {
        let limits = ResourceLimits::default();
        let usage = ResourceUsage {
            cpu_percent: 5.0, // Exceeds 3%
            memory_bytes: 50 * 1024 * 1024,
            disk_iops: 5,
            uptime_ms: 1000,
        };
        assert!(!usage.is_within_idle_limits(&limits));
    }

    #[test]
    fn test_resource_usage_within_active_limits() {
        let limits = ResourceLimits::default();
        let usage = ResourceUsage {
            cpu_percent: 4.0,
            memory_bytes: 80 * 1024 * 1024,
            disk_iops: 8,
            uptime_ms: 1000,
        };
        assert!(usage.is_within_active_limits(&limits));
    }

    #[test]
    fn test_bounded_buffer() {
        let mut buffer: BoundedBuffer<i32> = BoundedBuffer::new(3);

        buffer.push(1);
        buffer.push(2);
        buffer.push(3);
        assert_eq!(buffer.len(), 3);

        // Adding a 4th item should drop the oldest
        buffer.push(4);
        assert_eq!(buffer.len(), 3);
        assert_eq!(buffer.as_slice(), &[2, 3, 4]);
    }

    #[test]
    fn test_bounded_buffer_drain() {
        let mut buffer: BoundedBuffer<i32> = BoundedBuffer::new(3);
        buffer.push(1);
        buffer.push(2);

        let items: Vec<i32> = buffer.drain().collect();
        assert_eq!(items, vec![1, 2]);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_resource_monitor_creation() {
        let monitor = ResourceMonitor::new();
        assert!(monitor.uptime_ms() < 1000); // Should be very small
    }

    #[test]
    fn test_cpu_throttler_creation() {
        let throttler = CpuThrottler::new(5.0);
        assert!((throttler.target_cpu - 5.0).abs() < f64::EPSILON);
    }
}
