// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Blocking one address with the system firewall on Linux (iptables) and
//! Windows (netsh). macOS has its own module, `pf_blocklist`.
//!
//! Traffic is dropped in both directions. A rule on incoming packets alone
//! does not stop the host from reaching the address: both firewalls let the
//! replies of a connection the host opened through, which is exactly the
//! traffic of a command-and-control channel or an exfiltration.

use crate::host_isolation::Command;
use std::net::IpAddr;
use tracing::debug;

/// The firewall the commands are written for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Backend {
    #[cfg_attr(target_os = "windows", allow(dead_code))] // Windows uses netsh.
    Iptables,
    #[cfg_attr(target_os = "linux", allow(dead_code))] // Linux uses iptables.
    Netsh,
}

impl Backend {
    #[cfg(target_os = "linux")]
    pub(super) const SYSTEM: Self = Self::Iptables;
    #[cfg(target_os = "windows")]
    pub(super) const SYSTEM: Self = Self::Netsh;
}

/// Names of the Windows Firewall rules blocking `ip`: incoming, outgoing.
/// The incoming one keeps the name used before outgoing traffic was blocked,
/// so a block set by an earlier version is still lifted.
fn netsh_rule_names(ip: IpAddr) -> [String; 2] {
    let base = format!("SentinelBlock_{}", ip.to_string().replace(['.', ':'], "_"));
    [base.clone(), format!("{base}_out")]
}

/// Commands dropping the traffic from and to `ip`.
pub(super) fn block_commands(backend: Backend, ip: IpAddr) -> Vec<Command> {
    let address = ip.to_string();
    match backend {
        Backend::Iptables => {
            // `iptables` only knows IPv4. Inserted first: appended, the rules
            // would sit behind the "accept established connections" rule of
            // ufw or firewalld and never see the replies they must drop.
            let program = if ip.is_ipv6() {
                "ip6tables"
            } else {
                "iptables"
            };
            vec![
                Command::new(program, &["-I", "INPUT", "1", "-s", &address, "-j", "DROP"]),
                Command::new(
                    program,
                    &["-I", "OUTPUT", "1", "-d", &address, "-j", "DROP"],
                ),
            ]
        }
        Backend::Netsh => {
            let [incoming, outgoing] = netsh_rule_names(ip);
            let rule = |name: &str, direction: &str| {
                Command::new(
                    "netsh",
                    &[
                        "advfirewall",
                        "firewall",
                        "add",
                        "rule",
                        &format!("name={name}"),
                        &format!("dir={direction}"),
                        "action=block",
                        &format!("remoteip={address}"),
                    ],
                )
            };
            vec![rule(&incoming, "in"), rule(&outgoing, "out")]
        }
    }
}

/// Commands lifting the block of `ip`, one per direction.
pub(super) fn unblock_commands(backend: Backend, ip: IpAddr) -> Vec<Command> {
    let address = ip.to_string();
    match backend {
        Backend::Iptables => {
            let program = if ip.is_ipv6() {
                "ip6tables"
            } else {
                "iptables"
            };
            vec![
                Command::new(program, &["-D", "INPUT", "-s", &address, "-j", "DROP"]),
                Command::new(program, &["-D", "OUTPUT", "-d", &address, "-j", "DROP"]),
            ]
        }
        Backend::Netsh => netsh_rule_names(ip)
            .iter()
            .map(|name| {
                Command::new(
                    "netsh",
                    &[
                        "advfirewall",
                        "firewall",
                        "delete",
                        "rule",
                        &format!("name={name}"),
                    ],
                )
            })
            .collect(),
    }
}

/// Runs firewall commands. A trait so the sequence is tested without root.
pub(super) trait Firewall {
    /// Run `command`. On failure, return what it printed.
    async fn run(&self, command: &Command) -> Result<(), String>;
}

/// The system's firewall tools.
#[cfg(any(target_os = "linux", target_os = "windows"))]
pub(super) struct SystemFirewall;

#[cfg(any(target_os = "linux", target_os = "windows"))]
impl Firewall for SystemFirewall {
    async fn run(&self, command: &Command) -> Result<(), String> {
        crate::host_isolation::run(command).await.map(drop)
    }
}

/// Block `ip` in both directions, or not at all.
pub(super) async fn block(
    firewall: &impl Firewall,
    backend: Backend,
    ip: IpAddr,
) -> Result<(), String> {
    // Lifting first keeps one rule per direction when an address is blocked
    // twice: stacked rules would outlive the single unblock that follows.
    lift(firewall, backend, ip).await;

    for command in block_commands(backend, ip) {
        if let Err(e) = firewall.run(&command).await {
            // Half a block looks applied and is not: undo what was added.
            lift(firewall, backend, ip).await;
            return Err(e);
        }
    }
    Ok(())
}

/// Unblock `ip`. Fails when no rule could be removed; a block set by an
/// earlier version has an incoming rule only, and removing it is a success.
pub(super) async fn unblock(
    firewall: &impl Firewall,
    backend: Backend,
    ip: IpAddr,
) -> Result<(), String> {
    let mut removed = 0usize;
    let mut failure = None;
    for command in unblock_commands(backend, ip) {
        match firewall.run(&command).await {
            Ok(()) => removed += 1,
            Err(e) => failure = Some(e),
        }
    }
    match failure {
        Some(e) if removed == 0 => Err(e),
        _ => Ok(()),
    }
}

/// Remove the rules of `ip` that exist, without reporting the missing ones.
async fn lift(firewall: &impl Firewall, backend: Backend, ip: IpAddr) {
    for command in unblock_commands(backend, ip) {
        if let Err(e) = firewall.run(&command).await {
            debug!("No rule to lift for {}: {}", ip, e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(value: &str) -> IpAddr {
        value.parse().unwrap()
    }

    fn line(command: &Command) -> String {
        format!("{} {}", command.program, command.args.join(" "))
    }

    fn lines(commands: &[Command]) -> Vec<String> {
        commands.iter().map(line).collect()
    }

    /// Records the commands instead of running them.
    #[derive(Default)]
    struct FakeFirewall {
        calls: std::sync::Mutex<Vec<String>>,
        /// Commands containing one of these fragments fail.
        failing: Vec<&'static str>,
    }

    impl FakeFirewall {
        fn failing(fragments: &[&'static str]) -> Self {
            Self {
                failing: fragments.to_vec(),
                ..Self::default()
            }
        }

        fn calls(&self) -> Vec<String> {
            self.calls.lock().unwrap().clone()
        }
    }

    impl Firewall for FakeFirewall {
        async fn run(&self, command: &Command) -> Result<(), String> {
            let line = line(command);
            self.calls.lock().unwrap().push(line.clone());
            if self.failing.iter().any(|fragment| line.contains(fragment)) {
                return Err(format!("{line} failed"));
            }
            Ok(())
        }
    }

    #[test]
    fn iptables_drops_both_directions_ahead_of_the_existing_rules() {
        assert_eq!(
            lines(&block_commands(Backend::Iptables, ip("203.0.113.7"))),
            [
                "iptables -I INPUT 1 -s 203.0.113.7 -j DROP",
                "iptables -I OUTPUT 1 -d 203.0.113.7 -j DROP",
            ]
        );
    }

    #[test]
    fn ipv6_addresses_go_to_ip6tables() {
        let block = lines(&block_commands(Backend::Iptables, ip("2001:db8::10")));
        let unblock = lines(&unblock_commands(Backend::Iptables, ip("2001:db8::10")));
        assert!(
            block
                .iter()
                .chain(&unblock)
                .all(|l| l.starts_with("ip6tables "))
        );
        assert_eq!(unblock[1], "ip6tables -D OUTPUT -d 2001:db8::10 -j DROP");
    }

    #[test]
    fn windows_blocks_outgoing_traffic_too() {
        assert_eq!(
            lines(&block_commands(Backend::Netsh, ip("203.0.113.7"))),
            [
                "netsh advfirewall firewall add rule name=SentinelBlock_203_0_113_7 \
                 dir=in action=block remoteip=203.0.113.7",
                "netsh advfirewall firewall add rule name=SentinelBlock_203_0_113_7_out \
                 dir=out action=block remoteip=203.0.113.7",
            ]
        );
    }

    #[test]
    fn windows_unblock_removes_the_rule_of_earlier_versions() {
        let unblock = lines(&unblock_commands(Backend::Netsh, ip("2001:db8::10")));
        assert_eq!(
            unblock,
            [
                "netsh advfirewall firewall delete rule name=SentinelBlock_2001_db8__10",
                "netsh advfirewall firewall delete rule name=SentinelBlock_2001_db8__10_out",
            ]
        );
    }

    #[tokio::test]
    async fn blocking_twice_leaves_one_rule_per_direction() {
        let firewall = FakeFirewall::default();
        block(&firewall, Backend::Iptables, ip("203.0.113.7"))
            .await
            .unwrap();
        assert_eq!(
            firewall.calls(),
            [
                // Any earlier block is lifted before the rules are added.
                "iptables -D INPUT -s 203.0.113.7 -j DROP",
                "iptables -D OUTPUT -d 203.0.113.7 -j DROP",
                "iptables -I INPUT 1 -s 203.0.113.7 -j DROP",
                "iptables -I OUTPUT 1 -d 203.0.113.7 -j DROP",
            ]
        );
    }

    #[tokio::test]
    async fn a_half_applied_block_is_undone_and_reported() {
        let firewall = FakeFirewall::failing(&["-I OUTPUT"]);
        let error = block(&firewall, Backend::Iptables, ip("203.0.113.7"))
            .await
            .unwrap_err();
        assert!(error.contains("-I OUTPUT"), "{error}");

        let calls = firewall.calls();
        let added = calls.iter().position(|c| c.contains("-I INPUT")).unwrap();
        assert!(
            calls[added..]
                .iter()
                .any(|c| c == "iptables -D INPUT -s 203.0.113.7 -j DROP"),
            "the incoming rule must be removed again: {calls:?}"
        );
    }

    #[tokio::test]
    async fn unblocking_a_block_of_an_earlier_version_succeeds() {
        // Earlier versions only added the incoming rule.
        let firewall = FakeFirewall::failing(&["-D OUTPUT"]);
        unblock(&firewall, Backend::Iptables, ip("203.0.113.7"))
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn unblocking_an_address_that_is_not_blocked_is_reported() {
        let firewall = FakeFirewall::failing(&["-D INPUT", "-D OUTPUT"]);
        assert!(
            unblock(&firewall, Backend::Iptables, ip("203.0.113.7"))
                .await
                .is_err()
        );
    }
}
