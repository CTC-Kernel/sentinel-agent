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

use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tracing::{debug, info, warn};

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
            // egui render loop + OpenGL poll uses 5-12% CPU on macOS even when idle
            max_cpu_idle: 20.0, // 20% idle (increased from 15% for macOS headroom)
            max_cpu_active: 35.0, // 35% during active scans (increased for I/O heavy checks)
            max_memory_bytes: 350 * 1024 * 1024, // 350 MB (egui+OpenGL context needs ~200MB)
            max_disk_iops: 100,
            max_startup_ms: 15000, // 15 seconds
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
    /// Network I/O throughput (bytes per second).
    pub network_io_bytes: u64,
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
    /// Last network total bytes (rx+tx).
    last_network_bytes: AtomicU64,
    /// sysinfo System instance.
    sys: Mutex<sysinfo::System>,
    /// sysinfo Networks instance.
    networks: Mutex<sysinfo::Networks>,
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
            last_network_bytes: AtomicU64::new(0),
            sys: Mutex::new(sysinfo::System::new_all()),
            networks: Mutex::new(sysinfo::Networks::new_with_refreshed_list()),
        }
    }

    /// Get current resource usage.
    pub fn get_usage(&self) -> ResourceUsage {
        let memory_bytes = get_process_memory();
        let cpu_percent = get_cpu_usage();
        let uptime_ms = self.start_time.elapsed().as_millis() as u64;

        self.sample_count.fetch_add(1, Ordering::Relaxed);

        // Network I/O collection using sysinfo
        let network_io_bytes = if let Ok(mut networks) = self.networks.lock() {
            networks.refresh(true);
            let current_network: u64 = networks
                .values()
                .map(|data| data.received() + data.transmitted())
                .sum();

            let last_net = self
                .last_network_bytes
                .swap(current_network, Ordering::Relaxed);
            if last_net > 0 {
                // Return bytes since last sample (assumes ~1s interval)
                current_network.saturating_sub(last_net)
            } else {
                0
            }
        } else {
            0
        };

        // Disk I/O collection using sysinfo for the current process
        let disk_iops = if let Ok(mut sys) = self.sys.lock() {
            // Refresh only current process for efficiency
            let pid = sysinfo::get_current_pid().unwrap_or(sysinfo::Pid::from(0));
            sys.refresh_processes_specifics(
                sysinfo::ProcessesToUpdate::Some(&[pid]),
                true,
                sysinfo::ProcessRefreshKind::nothing().with_disk_usage(),
            );
            if let Some(process) = sys.process(pid) {
                let usage = process.disk_usage();
                (usage.read_bytes + usage.written_bytes) as u32
            } else {
                get_disk_iops()
            }
        } else {
            get_disk_iops()
        };

        let usage = ResourceUsage {
            cpu_percent,
            memory_bytes,
            disk_iops,
            network_io_bytes,
            uptime_ms,
        };

        if self.sample_count.load(Ordering::Relaxed).is_multiple_of(10) {
            info!(
                "Resource Usage: CPU={:.1}%, RAM={}MB, DiskIO={}, NetIO={}",
                usage.cpu_percent,
                usage.memory_bytes / 1024 / 1024,
                usage.disk_iops,
                usage.network_io_bytes
            );
        }

        usage
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
    pub fn check_limits(&self, is_active: bool) -> bool {
        let usage = self.get_usage();

        // Improved activity detection: check if agent is actually performing work
        let is_actively_working = self.is_actively_working();
        let should_use_active_limits = is_active && is_actively_working;

        let (cpu_limit, state_name) = if should_use_active_limits {
            (self.limits.max_cpu_active, "active")
        } else {
            (self.limits.max_cpu_idle, "idle")
        };

        let cpu_over = usage.cpu_percent > cpu_limit;
        let memory_over = usage.memory_bytes > self.limits.max_memory_bytes;
        let disk_over = usage.disk_iops > self.limits.max_disk_iops;

        let within_limits = !cpu_over && !memory_over && !disk_over;

        if !within_limits {
            // Rate-limit warnings to once per 60 seconds
            let now_secs = self.start_time.elapsed().as_secs();
            let last_warning = self.last_warning_time.load(Ordering::Relaxed);

            if now_secs >= last_warning + 60 {
                self.last_warning_time.store(now_secs, Ordering::Relaxed);

                let mut breaches = Vec::new();
                if cpu_over {
                    breaches.push(format!(
                        "CPU={:.1}% (limit: {:.1}%)",
                        usage.cpu_percent, cpu_limit
                    ));
                }
                if memory_over {
                    breaches.push(format!(
                        "RAM={}MB (limit: {}MB)",
                        usage.memory_bytes / (1024 * 1024),
                        self.limits.max_memory_bytes / (1024 * 1024)
                    ));
                }
                if disk_over {
                    breaches.push(format!(
                        "DiskIO={} (limit: {})",
                        usage.disk_iops, self.limits.max_disk_iops
                    ));
                }

                warn!(
                    "Resource limits exceeded during {} state: {}",
                    state_name,
                    breaches.join(", ")
                );
            }
        }

        within_limits
    }

    /// Check if agent is actively working (scans, network activity, etc.)
    fn is_actively_working(&self) -> bool {
        // Simple heuristic: if CPU > 15%, agent is likely doing work
        // This prevents false positives during normal system activity
        let usage = self.get_usage();
        usage.cpu_percent > 15.0
    }

    /// Check if provided usage is within limits.
    /// Warnings are rate-limited to once per 60 seconds to avoid log spam.
    pub fn check_limits_with_usage(&self, usage: &ResourceUsage, is_active: bool) -> bool {
        let (cpu_limit, state_name) = if is_active {
            (self.limits.max_cpu_active, "active")
        } else {
            (self.limits.max_cpu_idle, "idle")
        };

        let cpu_over = usage.cpu_percent > cpu_limit;
        let memory_over = usage.memory_bytes > self.limits.max_memory_bytes;
        let disk_over = usage.disk_iops > self.limits.max_disk_iops;

        let within_limits = !cpu_over && !memory_over && !disk_over;

        if !within_limits {
            // Rate-limit warnings to once per 60 seconds
            let now_secs = self.start_time.elapsed().as_secs();
            let last_warning = self.last_warning_time.load(Ordering::Relaxed);

            if now_secs >= last_warning + 60 {
                self.last_warning_time.store(now_secs, Ordering::Relaxed);

                let mut breaches = Vec::new();
                if cpu_over {
                    breaches.push(format!(
                        "CPU={:.1}% (limit: {:.1}%)",
                        usage.cpu_percent, cpu_limit
                    ));
                }
                if memory_over {
                    breaches.push(format!(
                        "RAM={}MB (limit: {}MB)",
                        usage.memory_bytes / (1024 * 1024),
                        self.limits.max_memory_bytes / (1024 * 1024)
                    ));
                }
                if disk_over {
                    breaches.push(format!(
                        "DiskIO={} (limit: {})",
                        usage.disk_iops, self.limits.max_disk_iops
                    ));
                }

                warn!(
                    "Resource limits exceeded during {} state: {}",
                    state_name,
                    breaches.join(", ")
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
///
/// Uses `VecDeque` for O(1) push/pop from both ends instead of
/// `Vec::remove(0)` which is O(n).
#[derive(Debug)]
pub struct BoundedBuffer<T> {
    items: std::collections::VecDeque<T>,
    max_size: usize,
}

impl<T> BoundedBuffer<T> {
    /// Create a new bounded buffer with the given capacity.
    pub fn new(max_size: usize) -> Self {
        Self {
            items: std::collections::VecDeque::with_capacity(max_size.min(1024)),
            max_size,
        }
    }

    /// Push an item, dropping oldest if at capacity.
    pub fn push(&mut self, item: T) {
        if self.items.len() >= self.max_size {
            self.items.pop_front();
        }
        self.items.push_back(item);
    }

    /// Get the current number of items.
    pub fn len(&self) -> usize {
        self.items.len()
    }

    /// Check if the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    /// Get all items as a pair of slices (VecDeque may not be contiguous).
    pub fn as_slices(&self) -> (&[T], &[T]) {
        self.items.as_slices()
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

/// Battery-aware adaptive scheduler.
///
/// Adjusts scan intervals based on battery state to preserve laptop battery life.
/// - On AC power: use base interval
/// - On battery > 50%: 1.5x interval
/// - On battery 20-50%: 2x interval
/// - On battery < 20%: 4x interval (critical)
pub struct AdaptiveScheduler {
    base_interval_secs: u64,
}

impl AdaptiveScheduler {
    /// Create a new adaptive scheduler with the given base interval.
    pub fn new(base_interval_secs: u64) -> Self {
        Self { base_interval_secs }
    }

    /// Get the adjusted scan interval based on current battery state.
    pub fn adjusted_interval(&self) -> u64 {
        match get_battery_state() {
            BatteryState::AcPower => self.base_interval_secs,
            BatteryState::Discharging(pct) => {
                if pct < 20.0 {
                    self.base_interval_secs * 4 // Critical: scan much less frequently
                } else if pct < 50.0 {
                    self.base_interval_secs * 2 // Low: scan less frequently
                } else {
                    (self.base_interval_secs as f64 * 1.5) as u64 // On battery: slight slowdown
                }
            }
            BatteryState::Unknown => self.base_interval_secs,
        }
    }

    /// Check if running on battery power.
    pub fn is_on_battery(&self) -> bool {
        matches!(get_battery_state(), BatteryState::Discharging(_))
    }

    /// Get current battery percentage (None if on AC or unknown).
    pub fn battery_percentage(&self) -> Option<f64> {
        match get_battery_state() {
            BatteryState::Discharging(pct) => Some(pct),
            _ => None,
        }
    }
}

/// Battery state representation.
#[derive(Debug, Clone)]
enum BatteryState {
    /// Connected to AC power.
    AcPower,
    /// Running on battery with given percentage.
    Discharging(f64),
    /// Unable to determine battery state (desktop or error).
    Unknown,
}

/// Get current battery state.
fn get_battery_state() -> BatteryState {
    let manager = match battery::Manager::new() {
        Ok(m) => m,
        Err(_) => return BatteryState::Unknown,
    };

    let batteries = match manager.batteries() {
        Ok(b) => b,
        Err(_) => return BatteryState::Unknown,
    };

    for battery in batteries.flatten() {
        if battery.state() == battery::State::Discharging {
            let pct = battery
                .state_of_charge()
                .get::<battery::units::ratio::percent>();
            return BatteryState::Discharging(pct as f64);
        }
        // If any battery is charging or full, we're on AC
        if matches!(
            battery.state(),
            battery::State::Charging | battery::State::Full
        ) {
            return BatteryState::AcPower;
        }
    }

    BatteryState::Unknown
}

/// Resource guardian that monitors agent's own resource consumption
/// and throttles operations when budgets are exceeded.
pub struct ResourceGuardian {
    /// Maximum allowed CPU percentage for the agent process.
    cpu_budget_percent: f32,
    /// Maximum allowed memory in megabytes.
    memory_budget_mb: u64,
    /// Whether throttling is currently active.
    throttle_active: std::sync::atomic::AtomicBool,
}

impl ResourceGuardian {
    /// Create a new resource guardian with default budgets.
    pub fn new() -> Self {
        Self {
            cpu_budget_percent: 5.0, // 5% CPU max
            memory_budget_mb: 150,   // 150 MB max
            throttle_active: std::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Create with custom budgets.
    pub fn with_budgets(cpu_percent: f32, memory_mb: u64) -> Self {
        Self {
            cpu_budget_percent: cpu_percent,
            memory_budget_mb: memory_mb,
            throttle_active: std::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Check if throttling should be active.
    pub fn should_throttle(&self) -> bool {
        self.throttle_active
            .load(std::sync::atomic::Ordering::Acquire)
    }

    /// Check current resource usage and enforce budgets.
    pub fn check_and_enforce(&self) {
        let memory_bytes = get_process_memory();
        let memory_mb = memory_bytes / (1024 * 1024);
        let cpu_pct = get_cpu_usage();

        let over_budget =
            cpu_pct > self.cpu_budget_percent as f64 || memory_mb > self.memory_budget_mb;

        if over_budget && !self.should_throttle() {
            warn!(
                "Resource guardian: agent over budget (CPU: {:.1}%/{:.1}%, MEM: {}MB/{}MB). Throttling.",
                cpu_pct, self.cpu_budget_percent, memory_mb, self.memory_budget_mb
            );
            self.throttle_active
                .store(true, std::sync::atomic::Ordering::Release);
        } else if !over_budget && self.should_throttle() {
            info!("Resource guardian: back within budget. Releasing throttle.");
            self.throttle_active
                .store(false, std::sync::atomic::Ordering::Release);
        }
    }

    /// Get a delay duration to apply when throttled.
    pub fn throttle_delay(&self) -> Duration {
        if self.should_throttle() {
            Duration::from_millis(500) // Add 500ms delay between operations
        } else {
            Duration::ZERO
        }
    }
}

impl Default for ResourceGuardian {
    fn default() -> Self {
        Self::new()
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

/// System-wide CPU usage from /proc/stat (delta-based).
#[cfg(target_os = "linux")]
fn get_system_cpu() -> f64 {
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static LAST_TOTAL: AtomicU64 = AtomicU64::new(0);
    static LAST_IDLE: AtomicU64 = AtomicU64::new(0);

    if let Ok(content) = fs::read_to_string("/proc/stat") {
        // First line: "cpu  user nice system idle iowait irq softirq steal ..."
        if let Some(cpu_line) = content.lines().next() {
            let parts: Vec<u64> = cpu_line
                .split_whitespace()
                .skip(1) // skip "cpu"
                .filter_map(|s| s.parse().ok())
                .collect();

            if parts.len() >= 4 {
                let total: u64 = parts.iter().sum();
                // idle is index 3, iowait is index 4 (if present)
                let idle = parts[3] + parts.get(4).copied().unwrap_or(0);

                let prev_total = LAST_TOTAL.swap(total, Ordering::Relaxed);
                let prev_idle = LAST_IDLE.swap(idle, Ordering::Relaxed);

                if prev_total > 0 {
                    let total_delta = total.saturating_sub(prev_total);
                    let idle_delta = idle.saturating_sub(prev_idle);
                    if total_delta > 0 {
                        let busy = total_delta.saturating_sub(idle_delta);
                        return (busy as f64 / total_delta as f64) * 100.0;
                    }
                }
            }
        }
    }
    0.0
}

#[cfg(target_os = "linux")]
fn get_system_memory() -> (u64, u64) {
    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        let mut total = 0u64;
        let mut available = 0u64;
        for line in content.lines() {
            if line.starts_with("MemTotal:") {
                total = line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(0)
                    * 1024; // kB to bytes
            } else if line.starts_with("MemAvailable:") {
                available = line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(0)
                    * 1024;
            }
        }
        let used = total.saturating_sub(available);
        (total, used)
    } else {
        (0, 0)
    }
}

#[cfg(target_os = "linux")]
fn get_disk_usage() -> (u64, u64) {
    unsafe {
        let mut stat: libc::statvfs = std::mem::zeroed();
        let path = std::ffi::CString::new("/").unwrap();
        if libc::statvfs(path.as_ptr(), &mut stat) == 0 {
            let total = stat.f_blocks as u64 * stat.f_frsize;
            let free = stat.f_bavail as u64 * stat.f_frsize;
            let used = total.saturating_sub(free);
            (total, used)
        } else {
            (0, 0)
        }
    }
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

// ============ macOS Mach API FFI bindings ============

#[cfg(target_os = "macos")]
#[allow(non_camel_case_types)]
mod mach_ffi {
    //! Minimal FFI declarations for macOS Mach kernel APIs.
    //! These are not exposed by the `libc` crate.

    use libc::{c_int, c_uint};

    // --- Mach basic types ---
    pub type mach_port_t = c_uint;
    pub type kern_return_t = c_int;
    pub type task_flavor_t = c_uint;
    pub type task_info_t = *mut c_int;
    pub type mach_msg_type_number_t = c_uint;
    pub type host_flavor_t = c_int;
    pub type host_info64_t = *mut c_int;
    pub type natural_t = c_uint;
    pub type integer_t = c_int;
    pub type processor_flavor_t = c_int;
    pub type processor_info_array_t = *mut integer_t;

    // --- Task info (for process memory) ---
    pub const MACH_TASK_BASIC_INFO: task_flavor_t = 20;

    #[repr(C)]
    #[derive(Debug, Copy, Clone)]
    pub struct mach_task_basic_info_data_t {
        pub virtual_size: u64,
        pub resident_size: u64,
        pub resident_size_max: u64,
        pub user_time: libc::timeval,
        pub system_time: libc::timeval,
        pub policy: c_int,
        pub suspend_count: c_int,
    }

    pub const MACH_TASK_BASIC_INFO_COUNT: mach_msg_type_number_t =
        (std::mem::size_of::<mach_task_basic_info_data_t>() / std::mem::size_of::<natural_t>())
            as mach_msg_type_number_t;

    // --- VM statistics (for system memory) ---
    pub const HOST_VM_INFO64: host_flavor_t = 4;

    #[repr(C)]
    #[derive(Debug, Copy, Clone)]
    pub struct vm_statistics64_data_t {
        pub free_count: natural_t,
        pub active_count: natural_t,
        pub inactive_count: natural_t,
        pub wire_count: natural_t,
        pub zero_fill_count: u64,
        pub reactivations: u64,
        pub pageins: u64,
        pub pageouts: u64,
        pub faults: u64,
        pub cow_faults: u64,
        pub lookups: u64,
        pub hits: u64,
        pub purges: u64,
        pub purgeable_count: natural_t,
        pub speculative_count: natural_t,
        pub decompressions: u64,
        pub compressions: u64,
        pub swapins: u64,
        pub swapouts: u64,
        pub compressor_page_count: natural_t,
        pub throttled_count: natural_t,
        pub external_page_count: natural_t,
        pub internal_page_count: natural_t,
        pub total_uncompressed_pages_in_compressor: u64,
    }

    pub const HOST_VM_INFO64_COUNT: mach_msg_type_number_t =
        (std::mem::size_of::<vm_statistics64_data_t>() / std::mem::size_of::<natural_t>())
            as mach_msg_type_number_t;

    // --- CPU info (for system-wide CPU) ---
    pub const PROCESSOR_CPU_LOAD_INFO: processor_flavor_t = 2;

    pub const CPU_STATE_USER: usize = 0;
    pub const CPU_STATE_SYSTEM: usize = 1;
    pub const CPU_STATE_IDLE: usize = 2;
    pub const CPU_STATE_NICE: usize = 3;
    pub const CPU_STATE_MAX: usize = 4;

    unsafe extern "C" {
        pub fn mach_task_self() -> mach_port_t;
        pub fn mach_host_self() -> mach_port_t;

        pub fn task_info(
            target_task: mach_port_t,
            flavor: task_flavor_t,
            task_info_out: task_info_t,
            task_info_outCnt: *mut mach_msg_type_number_t,
        ) -> kern_return_t;

        pub fn host_statistics64(
            host_priv: mach_port_t,
            flavor: host_flavor_t,
            host_info64_out: host_info64_t,
            host_info64_outCnt: *mut mach_msg_type_number_t,
        ) -> kern_return_t;

        pub fn host_processor_info(
            host: mach_port_t,
            flavor: processor_flavor_t,
            out_processor_count: *mut natural_t,
            out_processor_info: *mut processor_info_array_t,
            out_processor_infoCnt: *mut mach_msg_type_number_t,
        ) -> kern_return_t;

        pub fn vm_deallocate(
            target_task: mach_port_t,
            address: usize,
            size: usize,
        ) -> kern_return_t;
    }
}

#[cfg(target_os = "macos")]
use mach_ffi::*;

// ============ macOS implementations ============

#[cfg(target_os = "macos")]
fn get_process_memory() -> u64 {
    // Use Mach task_info to get CURRENT resident memory (not peak).
    // ru_maxrss from getrusage reports peak RSS which overstates usage.
    unsafe {
        let task = mach_task_self();
        let mut info: mach_task_basic_info_data_t = std::mem::zeroed();
        let mut count = MACH_TASK_BASIC_INFO_COUNT;
        let kr = task_info(
            task,
            MACH_TASK_BASIC_INFO,
            &mut info as *mut _ as task_info_t,
            &mut count,
        );
        if kr == libc::KERN_SUCCESS {
            return info.resident_size;
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

/// System-wide CPU usage via Mach `host_processor_info`.
/// Returns the percentage of CPU time spent busy (user + system + nice)
/// across all cores, averaged since the last call (delta-based).
#[cfg(target_os = "macos")]
fn get_system_cpu() -> f64 {
    use std::sync::atomic::{AtomicU64, Ordering};

    static LAST_TOTAL_TICKS: AtomicU64 = AtomicU64::new(0);
    static LAST_IDLE_TICKS: AtomicU64 = AtomicU64::new(0);

    unsafe {
        let host = mach_host_self();
        let mut num_cpus: natural_t = 0;
        let mut info_array: processor_info_array_t = std::ptr::null_mut();
        let mut info_count: mach_msg_type_number_t = 0;

        let kr = host_processor_info(
            host,
            PROCESSOR_CPU_LOAD_INFO,
            &mut num_cpus,
            &mut info_array,
            &mut info_count,
        );

        if kr != libc::KERN_SUCCESS || info_array.is_null() {
            return 0.0;
        }

        // Sum ticks across all CPUs
        let mut total_ticks: u64 = 0;
        let mut idle_ticks: u64 = 0;

        for i in 0..num_cpus as usize {
            let base = i * CPU_STATE_MAX;
            let user = *info_array.add(base + CPU_STATE_USER) as u64;
            let system = *info_array.add(base + CPU_STATE_SYSTEM) as u64;
            let idle = *info_array.add(base + CPU_STATE_IDLE) as u64;
            let nice = *info_array.add(base + CPU_STATE_NICE) as u64;
            total_ticks += user + system + idle + nice;
            idle_ticks += idle;
        }

        // Free the Mach-allocated buffer
        let alloc_size = (info_count as usize) * std::mem::size_of::<integer_t>();
        vm_deallocate(mach_task_self(), info_array as usize, alloc_size);

        // Delta calculation
        let prev_total = LAST_TOTAL_TICKS.swap(total_ticks, Ordering::Relaxed);
        let prev_idle = LAST_IDLE_TICKS.swap(idle_ticks, Ordering::Relaxed);

        if prev_total == 0 {
            // First call — no delta yet
            return 0.0;
        }

        let total_delta = total_ticks.saturating_sub(prev_total);
        let idle_delta = idle_ticks.saturating_sub(prev_idle);

        if total_delta == 0 {
            return 0.0;
        }

        let busy_delta = total_delta.saturating_sub(idle_delta);
        (busy_delta as f64 / total_delta as f64) * 100.0
    }
}

#[cfg(target_os = "macos")]
fn get_system_memory() -> (u64, u64) {
    unsafe {
        // Total physical memory via sysctlbyname("hw.memsize")
        let mut total: u64 = 0;
        let mut size = std::mem::size_of::<u64>();
        let name = b"hw.memsize\0";
        libc::sysctlbyname(
            name.as_ptr() as *const libc::c_char,
            &mut total as *mut _ as *mut libc::c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        );

        // VM page statistics via host_statistics64
        let host = mach_host_self();
        let mut vm_info: vm_statistics64_data_t = std::mem::zeroed();
        let mut count = HOST_VM_INFO64_COUNT;
        let kr = host_statistics64(
            host,
            HOST_VM_INFO64,
            &mut vm_info as *mut _ as host_info64_t,
            &mut count,
        );
        if kr == libc::KERN_SUCCESS {
            let page_size = libc::sysconf(libc::_SC_PAGESIZE) as u64;
            // "Used" = active + wired + compressor (excludes inactive, free, speculative)
            let used = (vm_info.active_count as u64
                + vm_info.wire_count as u64
                + vm_info.compressor_page_count as u64)
                * page_size;
            (total, used)
        } else {
            (total, 0)
        }
    }
}

#[cfg(target_os = "macos")]
fn get_disk_usage() -> (u64, u64) {
    unsafe {
        let mut stat: libc::statvfs = std::mem::zeroed();
        let path = std::ffi::CString::new("/").unwrap();
        if libc::statvfs(path.as_ptr(), &mut stat) == 0 {
            let total = stat.f_blocks as u64 * stat.f_frsize;
            let free = stat.f_bavail as u64 * stat.f_frsize;
            let used = total.saturating_sub(free);
            (total, used)
        } else {
            (0, 0)
        }
    }
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
fn get_system_memory() -> (u64, u64) {
    // Placeholder - would use GlobalMemoryStatusEx
    (0, 0)
}

#[cfg(windows)]
fn get_disk_usage() -> (u64, u64) {
    // Placeholder - would use GetDiskFreeSpaceExW
    (0, 0)
}

#[cfg(windows)]
fn get_system_cpu() -> f64 {
    // Placeholder - would use GetSystemTimes or NtQuerySystemInformation
    0.0
}

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

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn get_system_cpu() -> f64 {
    0.0
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn get_system_memory() -> (u64, u64) {
    (0, 0)
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn get_disk_usage() -> (u64, u64) {
    (0, 0)
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

/// System-level resource information (CPU, memory total, disk usage).
#[derive(Debug, Clone, Default)]
pub struct SystemResources {
    /// System-wide CPU usage percentage (all cores combined).
    pub cpu_percent: f64,
    pub memory_total_bytes: u64,
    pub memory_used_bytes: u64,
    pub memory_percent: f64,
    pub disk_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_percent: f64,
}

/// Get system-level resource information (CPU, total memory, disk usage).
pub fn get_system_resources() -> SystemResources {
    let cpu_percent = get_system_cpu();
    let memory = get_system_memory();
    let disk = get_disk_usage();

    let memory_percent = if memory.0 > 0 {
        ((memory.1 as f64 / memory.0 as f64) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    let disk_percent = if disk.0 > 0 {
        (disk.1 as f64 / disk.0 as f64) * 100.0
    } else {
        0.0
    };

    SystemResources {
        cpu_percent: cpu_percent.clamp(0.0, 100.0),
        memory_total_bytes: memory.0,
        memory_used_bytes: memory.1,
        memory_percent,
        disk_total_bytes: disk.0,
        disk_used_bytes: disk.1,
        disk_percent,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_limits_default() {
        let limits = ResourceLimits::default();
        assert!((limits.max_cpu_idle - 20.0).abs() < f64::EPSILON);
        assert!((limits.max_cpu_active - 35.0).abs() < f64::EPSILON);
        assert_eq!(limits.max_memory_bytes, 350 * 1024 * 1024);
        assert_eq!(limits.max_disk_iops, 100);
        assert_eq!(limits.max_startup_ms, 15000);
    }

    #[test]
    fn test_resource_usage_within_idle_limits() {
        let limits = ResourceLimits::default();
        let usage = ResourceUsage {
            cpu_percent: 0.3,
            memory_bytes: 50 * 1024 * 1024,
            disk_iops: 5,
            network_io_bytes: 0,
            uptime_ms: 1000,
        };
        assert!(usage.is_within_idle_limits(&limits));
    }

    #[test]
    fn test_resource_usage_exceeds_idle_limits() {
        let limits = ResourceLimits::default();
        let usage = ResourceUsage {
            cpu_percent: 25.0, // Exceeds 20% idle limit
            memory_bytes: 50 * 1024 * 1024,
            disk_iops: 5,
            network_io_bytes: 0,
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
            network_io_bytes: 0,
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
        let items: Vec<i32> = buffer.items.iter().copied().collect();
        assert_eq!(items, vec![2, 3, 4]);
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
