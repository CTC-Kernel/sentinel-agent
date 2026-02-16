//! Detection rules and IOCs (Indicators of Compromise).

use crate::types::ThreatIntelligence;
use std::collections::HashSet;

/// Type of IOC indicator.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IocType {
    /// Malicious IP address
    MaliciousIp,
    /// Malicious domain
    MaliciousDomain,
    /// C2 communication port
    C2Port,
    /// Crypto mining pool
    MiningPool,
    /// Suspicious process
    SuspiciousProcess,
}

/// Detection rules containing IOCs and patterns.
#[derive(Debug, Clone)]
pub struct DetectionRules {
    /// Known malicious IP addresses
    pub malicious_ips: HashSet<String>,
    /// Known malicious domains
    pub malicious_domains: HashSet<String>,
    /// Known C2 ports
    pub c2_ports: HashSet<u16>,
    /// Known crypto mining pools
    pub mining_pools: HashSet<String>,
    /// Common miner process names
    pub miner_processes: HashSet<String>,
    /// Suspicious outbound ports
    pub suspicious_ports: HashSet<u16>,
    /// Tor network ports
    pub tor_ports: HashSet<u16>,
    /// IRC ports
    pub irc_ports: HashSet<u16>,
}

impl DetectionRules {
    /// Create from threat intelligence data.
    pub fn from_threat_intel(intel: ThreatIntelligence) -> Self {
        let mut rules = Self::default();

        // Merge threat intel data
        rules.malicious_ips.extend(intel.malicious_ips);
        rules.malicious_domains.extend(intel.malicious_domains);
        rules.c2_ports.extend(intel.c2_ports);
        rules.mining_pools.extend(intel.mining_pools);

        rules
    }

    /// Check if an IP is known malicious.
    pub fn is_malicious_ip(&self, ip: &str) -> bool {
        self.malicious_ips.contains(ip)
    }

    /// Check if a port is a known C2 port.
    pub fn is_c2_port(&self, port: u16) -> bool {
        self.c2_ports.contains(&port)
    }

    /// Check if a port is suspicious.
    pub fn is_suspicious_port(&self, port: u16) -> bool {
        self.suspicious_ports.contains(&port)
            || self.tor_ports.contains(&port)
            || self.irc_ports.contains(&port)
    }

    /// Check if a process name matches known miners.
    pub fn is_miner_process(&self, process_name: &str) -> bool {
        let lower = process_name.to_lowercase();
        self.miner_processes.iter().any(|p| lower.contains(p))
    }

    /// Check if a destination is a known mining pool.
    pub fn is_mining_pool(&self, addr: &str) -> bool {
        self.mining_pools
            .iter()
            .any(|pool| addr.contains(pool) || pool.contains(addr))
    }

    /// Get IOC match description.
    pub fn get_ioc_match(&self, ip: &str, port: u16) -> Option<(IocType, String)> {
        if self.is_malicious_ip(ip) {
            return Some((IocType::MaliciousIp, format!("Known malicious IP: {}", ip)));
        }
        if self.is_c2_port(port) {
            return Some((IocType::C2Port, format!("Known C2 port: {}", port)));
        }
        None
    }
}

impl Default for DetectionRules {
    fn default() -> Self {
        Self {
            // Common threat intelligence - these would be updated dynamically
            malicious_ips: HashSet::new(),
            malicious_domains: HashSet::new(),

            // Well-known C2 ports (common backdoors, RATs)
            c2_ports: [
                4444,  // Metasploit default
                1337,  // Common backdoor
                31337, // Back Orifice
                5555,  // Android Debug Bridge (misused)
                6666,  // IRC (sometimes C2)
                // 8080 and 8443 removed — too common for legitimate services (proxies,
                // dev servers, management consoles), causing excessive false positives
                9999,  // Various backdoors
                12345, // NetBus
                20000, // Various trojans
                65535, // High port (suspicious)
            ]
            .into_iter()
            .collect(),

            // Known mining pool domains/patterns
            mining_pools: [
                "pool.minexmr.com",
                "xmr.pool.minergate.com",
                "xmr-eu1.nanopool.org",
                "xmr-us-east1.nanopool.org",
                "pool.supportxmr.com",
                "xmrpool.eu",
                "monerohash.com",
                "moneroocean.stream",
                "hashvault.pro",
                "gulf.moneroocean.stream",
                "pool.hashvault.pro",
                "stratum+tcp://",
                "nicehash.com",
                "2miners.com",
                "f2pool.com",
                "ethermine.org",
                "sparkpool.com",
            ]
            .into_iter()
            .map(String::from)
            .collect(),

            // Common miner process names
            miner_processes: [
                "xmrig",
                "cpuminer",
                "cgminer",
                "bfgminer",
                "minerd",
                "ethminer",
                "phoenixminer",
                "nbminer",
                "t-rex",
                "gminer",
                "lolminer",
                "nanominer",
                "teamredminer",
                "claymore",
                "nicehash",
                "minergate",
                "kryptex",
                "honeyminer",
                "cudo",
            ]
            .into_iter()
            .map(String::from)
            .collect(),

            // Suspicious outbound ports
            suspicious_ports: [
                22,   // SSH (unusual outbound from workstation)
                23,   // Telnet
                3389, // RDP outbound
                5900, // VNC
                5901, // VNC
                5902, // VNC
            ]
            .into_iter()
            .collect(),

            // Tor network ports
            tor_ports: [
                9001, // Tor OR port
                9030, // Tor directory
                9050, // Tor SOCKS
                9051, // Tor control
                9150, // Tor Browser SOCKS
            ]
            .into_iter()
            .collect(),

            // IRC ports (often used for botnets)
            irc_ports: [
                6665, 6666, 6667, 6668, 6669, // Standard IRC
                6697, // IRC SSL
                7000, // IRC alt
            ]
            .into_iter()
            .collect(),
        }
    }
}
