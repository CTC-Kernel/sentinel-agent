// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Service watchdog: tells systemd the agent is alive.
//!
//! The unit declares `WatchdogSec`, so systemd expects a `WATCHDOG=1`
//! notification at least that often and restarts the service when none
//! arrives. The keepalive is tied to the main loop: it is sent only while the
//! loop keeps turning, so a deadlocked agent is restarted instead of staying
//! up and doing nothing.
//!
//! Outside systemd (macOS, Windows, a terminal) nothing is sent.

use std::sync::OnceLock;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

/// A pass of the main loop may run a compliance scan or wait on several
/// uploads; only a loop silent for this long is considered stuck.
#[cfg_attr(not(unix), allow(dead_code))] // Only systemd is sent keepalives.
const STALL_LIMIT: Duration = Duration::from_secs(30 * 60);

static EPOCH: OnceLock<Instant> = OnceLock::new();
/// Seconds since [`EPOCH`] at the last pass of the main loop.
static LAST_BEAT: AtomicU64 = AtomicU64::new(0);

fn now_secs() -> u64 {
    EPOCH.get_or_init(Instant::now).elapsed().as_secs()
}

/// Record that the main loop is making progress. Call once per pass.
pub fn beat() {
    LAST_BEAT.store(now_secs(), Ordering::Relaxed);
}

/// Whether the main loop has turned recently enough to vouch for the agent.
#[cfg_attr(not(unix), allow(dead_code))]
fn is_alive(now: u64, last_beat: u64, stall_limit: Duration) -> bool {
    now.saturating_sub(last_beat) < stall_limit.as_secs()
}

/// Interval between keepalives for a watchdog of `watchdog_usec`, or `None`
/// when the value is not a usable duration. Half the timeout, as systemd
/// recommends, so one late keepalive does not restart the service.
#[cfg_attr(not(unix), allow(dead_code))]
fn keepalive_interval(watchdog_usec: &str) -> Option<Duration> {
    let usec = watchdog_usec.trim().parse::<u64>().ok()?;
    (usec >= 2).then(|| Duration::from_micros(usec / 2))
}

/// Start sending keepalives when systemd asked for them. Call from the async
/// runtime, before the first long start-up step: the timeout already runs.
pub fn start() {
    beat();
    #[cfg(unix)]
    unix::start();
}

#[cfg(unix)]
mod unix {
    use super::*;
    use std::ffi::OsStr;
    use std::os::unix::ffi::OsStrExt;
    use std::os::unix::net::UnixDatagram;
    use tracing::{error, info, warn};

    /// Send `state` to the notification socket at `target` (the value of
    /// `NOTIFY_SOCKET`: a path, or `@name` in Linux' abstract namespace).
    pub(super) fn send(target: &OsStr, state: &str) -> std::io::Result<()> {
        let socket = UnixDatagram::unbound()?;
        match target.as_bytes().split_first() {
            Some((b'/', _)) => {
                socket.send_to(state.as_bytes(), std::path::Path::new(target))?;
                Ok(())
            }
            #[cfg(target_os = "linux")]
            Some((b'@', name)) => {
                use std::os::linux::net::SocketAddrExt;
                let address = std::os::unix::net::SocketAddr::from_abstract_name(name)?;
                socket.send_to_addr(state.as_bytes(), &address)?;
                Ok(())
            }
            _ => Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "unsupported NOTIFY_SOCKET address",
            )),
        }
    }

    pub(super) fn start() {
        let Some(target) = std::env::var_os("NOTIFY_SOCKET") else {
            return;
        };
        // The watchdog may be meant for another process of the unit.
        if let Ok(pid) = std::env::var("WATCHDOG_PID")
            && pid.trim().parse::<u32>().ok() != Some(std::process::id())
        {
            return;
        }
        let Some(interval) = std::env::var("WATCHDOG_USEC")
            .ok()
            .as_deref()
            .and_then(keepalive_interval)
        else {
            return;
        };

        info!(
            "Service watchdog active: keepalive every {}s while the main loop runs",
            interval.as_secs()
        );
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            let mut reported_stall = false;
            loop {
                ticker.tick().await;
                if !is_alive(now_secs(), LAST_BEAT.load(Ordering::Relaxed), STALL_LIMIT) {
                    if !reported_stall {
                        error!(
                            "Main loop silent for more than {}s: keepalives stopped, \
                             the service manager will restart the agent",
                            STALL_LIMIT.as_secs()
                        );
                        reported_stall = true;
                    }
                    continue;
                }
                reported_stall = false;
                if let Err(e) = send(&target, "WATCHDOG=1") {
                    warn!("Watchdog keepalive not delivered: {}", e);
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keepalive_is_sent_at_half_the_timeout() {
        assert_eq!(
            keepalive_interval("120000000"),
            Some(Duration::from_secs(60))
        );
        assert_eq!(
            keepalive_interval(" 30000000\n"),
            Some(Duration::from_secs(15))
        );
    }

    #[test]
    fn unusable_timeouts_disable_the_keepalive() {
        assert_eq!(keepalive_interval(""), None);
        assert_eq!(keepalive_interval("soon"), None);
        assert_eq!(keepalive_interval("0"), None);
        assert_eq!(keepalive_interval("-5"), None);
    }

    #[test]
    fn a_silent_loop_stops_vouching_for_the_agent() {
        let limit = Duration::from_secs(1800);
        assert!(is_alive(100, 100, limit));
        assert!(is_alive(1899, 100, limit));
        assert!(!is_alive(1900, 100, limit));
        // A beat recorded after `now` was read must not underflow.
        assert!(is_alive(100, 101, limit));
    }

    #[cfg(unix)]
    #[test]
    fn keepalive_reaches_a_path_socket() {
        use std::os::unix::net::UnixDatagram;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("notify.sock");
        let receiver = UnixDatagram::bind(&path).unwrap();
        receiver
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();

        unix::send(path.as_os_str(), "WATCHDOG=1").unwrap();

        let mut buffer = [0u8; 32];
        let received = receiver.recv(&mut buffer).unwrap();
        assert_eq!(&buffer[..received], b"WATCHDOG=1");
    }

    #[cfg(unix)]
    #[test]
    fn unknown_socket_addresses_are_refused() {
        use std::ffi::OsStr;
        assert!(unix::send(OsStr::new("relative.sock"), "WATCHDOG=1").is_err());
        assert!(unix::send(OsStr::new(""), "WATCHDOG=1").is_err());
    }
}
