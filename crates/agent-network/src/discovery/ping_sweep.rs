//! Concurrent subnet ping sweep.
//!
//! Generates all host IPs in a CIDR block and pings them concurrently
//! using system `ping` to discover live hosts without raw sockets.

use crate::error::{NetworkError, NetworkResult};
use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::Semaphore;
use tracing::{debug, trace, warn};

/// Configuration for a ping sweep.
pub struct PingSweepConfig {
    /// Maximum concurrent ping processes.
    pub max_concurrent: usize,
    /// Ping timeout in milliseconds.
    pub timeout_ms: u64,
}

impl Default for PingSweepConfig {
    fn default() -> Self {
        Self {
            max_concurrent: 50,
            timeout_ms: 500,
        }
    }
}

/// Performs concurrent ping sweeps of subnets.
pub struct PingSweeper;

impl PingSweeper {
    /// Ping all hosts in the given CIDR subnet and return responding IPs.
    ///
    /// `cancel` can be set to `true` to abort the sweep early.
    pub async fn sweep(
        cidr: &str,
        config: &PingSweepConfig,
        cancel: Arc<AtomicBool>,
    ) -> NetworkResult<Vec<String>> {
        let hosts = Self::cidr_to_hosts(cidr)?;
        let total = hosts.len();
        debug!("Ping sweep: {} hosts in {}", total, cidr);

        let semaphore = Arc::new(Semaphore::new(config.max_concurrent));
        let timeout_ms = config.timeout_ms;

        let mut handles = Vec::with_capacity(total);

        for ip in hosts {
            if cancel.load(Ordering::Relaxed) {
                debug!("Ping sweep cancelled");
                break;
            }

            let permit = semaphore.clone().acquire_owned().await.map_err(|e| {
                NetworkError::Discovery(format!("Semaphore error: {}", e))
            })?;
            let cancel_clone = cancel.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit; // hold until done

                if cancel_clone.load(Ordering::Relaxed) {
                    return None;
                }

                let alive = Self::ping_host(&ip, timeout_ms).await;
                if alive {
                    trace!("Host {} is alive", ip);
                    Some(ip)
                } else {
                    None
                }
            });

            handles.push(handle);
        }

        let mut alive_hosts = Vec::new();
        for handle in handles {
            match handle.await {
                Ok(Some(ip)) => alive_hosts.push(ip),
                Ok(None) => {}
                Err(e) => {
                    warn!("Ping task failed: {}", e);
                }
            }
        }

        debug!("Ping sweep complete: {}/{} hosts alive", alive_hosts.len(), total);
        Ok(alive_hosts)
    }

    /// Parse a CIDR string into a list of host IP addresses.
    /// Excludes network and broadcast addresses for /24 and larger.
    fn cidr_to_hosts(cidr: &str) -> NetworkResult<Vec<String>> {
        let parts: Vec<&str> = cidr.split('/').collect();
        if parts.len() != 2 {
            return Err(NetworkError::ParseError(format!(
                "Invalid CIDR notation: {}",
                cidr
            )));
        }

        let base_ip: Ipv4Addr = parts[0].parse().map_err(|e| {
            NetworkError::ParseError(format!("Invalid IP in CIDR: {}: {}", parts[0], e))
        })?;

        let prefix_len: u32 = parts[1].parse().map_err(|e| {
            NetworkError::ParseError(format!("Invalid prefix length: {}: {}", parts[1], e))
        })?;

        if prefix_len > 32 {
            return Err(NetworkError::ParseError(format!(
                "Prefix length {} is out of range",
                prefix_len
            )));
        }

        if prefix_len < 16 {
            return Err(NetworkError::Discovery(
                "Subnet too large (prefix < /16). Refusing to scan.".to_string(),
            ));
        }

        let base_u32 = u32::from(base_ip);
        let host_bits = 32 - prefix_len;
        let mask = if prefix_len == 0 {
            0u32
        } else {
            !((1u32 << host_bits) - 1)
        };
        let network = base_u32 & mask;
        let total_hosts = 1u32 << host_bits;

        let mut hosts = Vec::new();

        if total_hosts <= 2 {
            // /31 or /32 — include all
            for i in 0..total_hosts {
                hosts.push(Ipv4Addr::from(network + i).to_string());
            }
        } else {
            // Skip network address (first) and broadcast (last)
            for i in 1..total_hosts - 1 {
                hosts.push(Ipv4Addr::from(network + i).to_string());
            }
        }

        Ok(hosts)
    }

    /// Ping a single host and return whether it responded.
    async fn ping_host(ip: &str, timeout_ms: u64) -> bool {
        let result = if cfg!(target_os = "macos") {
            // macOS: -W is in ms
            Command::new("ping")
                .args(["-c", "1", "-W", &timeout_ms.to_string(), ip])
                .output()
                .await
        } else if cfg!(target_os = "windows") {
            Command::new("ping")
                .args(["-n", "1", "-w", &timeout_ms.to_string(), ip])
                .output()
                .await
        } else {
            // Linux: -W is in seconds, convert
            let timeout_secs = std::cmp::max(1, (timeout_ms + 999) / 1000);
            Command::new("ping")
                .args(["-c", "1", "-W", &timeout_secs.to_string(), ip])
                .output()
                .await
        };

        match result {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cidr_to_hosts_24() {
        let hosts = PingSweeper::cidr_to_hosts("192.168.1.0/24").unwrap();
        assert_eq!(hosts.len(), 254);
        assert_eq!(hosts[0], "192.168.1.1");
        assert_eq!(hosts[253], "192.168.1.254");
    }

    #[test]
    fn test_cidr_to_hosts_28() {
        let hosts = PingSweeper::cidr_to_hosts("10.0.0.0/28").unwrap();
        // /28 = 16 addresses, minus network and broadcast = 14
        assert_eq!(hosts.len(), 14);
        assert_eq!(hosts[0], "10.0.0.1");
        assert_eq!(hosts[13], "10.0.0.14");
    }

    #[test]
    fn test_cidr_to_hosts_32() {
        let hosts = PingSweeper::cidr_to_hosts("10.0.0.5/32").unwrap();
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0], "10.0.0.5");
    }

    #[test]
    fn test_cidr_to_hosts_31() {
        let hosts = PingSweeper::cidr_to_hosts("10.0.0.0/31").unwrap();
        assert_eq!(hosts.len(), 2);
        assert_eq!(hosts[0], "10.0.0.0");
        assert_eq!(hosts[1], "10.0.0.1");
    }

    #[test]
    fn test_cidr_invalid() {
        assert!(PingSweeper::cidr_to_hosts("not-a-cidr").is_err());
        assert!(PingSweeper::cidr_to_hosts("192.168.1.0").is_err());
        assert!(PingSweeper::cidr_to_hosts("192.168.1.0/33").is_err());
    }

    #[test]
    fn test_cidr_too_large() {
        assert!(PingSweeper::cidr_to_hosts("10.0.0.0/8").is_err());
        assert!(PingSweeper::cidr_to_hosts("10.0.0.0/15").is_err());
    }
}
