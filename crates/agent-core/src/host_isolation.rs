// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Host network isolation (containment).
//!
//! Cuts the endpoint off the network while keeping what is needed to lift the
//! isolation again:
//! - loopback;
//! - DNS and DHCP, so the endpoint keeps an address and can still resolve the
//!   platform's name;
//! - the Sentinel GRC platform (addresses resolved when isolating), so the
//!   agent stays reachable. A standalone agent has no platform: it is released
//!   from its own interface, or when the requested duration elapses.
//!
//! The isolation is recorded on disk: after a restart it is applied again
//! (pf and iptables rules do not survive a reboot) or lifted if its duration
//! has elapsed meanwhile.
//!
//! # Firewall used
//!
//! | OS      | Mechanism                                                        |
//! |---------|------------------------------------------------------------------|
//! | macOS   | pf anchor `com.apple/sentinel-isolation`, pf enabled by token    |
//! | Linux   | `SENTINEL_ISO_IN` / `SENTINEL_ISO_OUT` chains (iptables, ip6tables) |
//! | Windows | Windows Firewall block rules `SentinelIsolation_*`               |
//!
//! The rules for every system are built by pure functions, so they are
//! unit-tested on any development machine.

use agent_common::config::AgentConfig;
use agent_common::error::CommonError;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// pf anchor holding the isolation rules. macOS' default ruleset evaluates
/// every anchor under `com.apple/`, so `/etc/pf.conf` is left untouched.
const PF_ANCHOR: &str = "com.apple/sentinel-isolation";
const IPTABLES_CHAIN_IN: &str = "SENTINEL_ISO_IN";
const IPTABLES_CHAIN_OUT: &str = "SENTINEL_ISO_OUT";
const NETSH_RULE_PREFIX: &str = "SentinelIsolation_";
const NETSH_RULES: &[&str] = &["OutTCP", "OutUDP", "OutICMPv4", "InTCP", "InUDP"];

const MAX_REASON_CHARS: usize = 300;

/// An isolation in force.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IsolationState {
    /// Unix time (seconds) the isolation was applied.
    pub isolated_at: i64,
    /// Unix time (seconds) it is lifted automatically; `None`: until released.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_at: Option<i64>,
    /// Why the endpoint was isolated (playbook name, operator action…).
    pub reason: String,
    /// Addresses still reachable: the platform's.
    #[serde(default)]
    pub allowed: Vec<IpAddr>,
    /// macOS: token returned when enabling pf, needed to release that enable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pf_token: Option<String>,
}

/// Whether an isolation is in force, kept in memory for status reporting.
static ISOLATED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Whether the endpoint is currently isolated (as last applied, lifted or
/// found at start-up by this process).
pub fn is_isolated() -> bool {
    ISOLATED.load(std::sync::atomic::Ordering::Acquire)
}

fn set_isolated(isolated: bool) {
    ISOLATED.store(isolated, std::sync::atomic::Ordering::Release);
}

/// One firewall command.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Command {
    pub program: &'static str,
    pub args: Vec<String>,
}

impl Command {
    fn new(program: &'static str, args: &[&str]) -> Self {
        Self {
            program,
            args: args.iter().map(|arg| (*arg).to_string()).collect(),
        }
    }
}

// ── pf (macOS) ──────────────────────────────────────────────────────────────

/// pf rules of the isolation anchor.
pub(crate) fn pf_rules(allowed: &[IpAddr]) -> String {
    let mut rules = String::from(
        "# Sentinel GRC - host isolation. Managed by the agent, do not edit.\n\
         pass quick on lo0 all\n\
         pass out quick inet proto udp from any port 68 to any port 67 keep state\n\
         pass in quick inet proto udp from any port 67 to any port 68 keep state\n\
         pass out quick proto { tcp, udp } from any to any port 53 keep state\n",
    );
    if allowed.iter().any(IpAddr::is_ipv6) {
        // Neighbour discovery, without which no IPv6 address is reachable.
        rules.push_str("pass quick inet6 proto icmp6 all\n");
    }
    for ip in allowed {
        rules.push_str(&format!("pass out quick from any to {ip} keep state\n"));
    }
    rules.push_str("block drop quick all\n");
    rules
}

fn pf_rules_path() -> PathBuf {
    AgentConfig::platform_data_dir().join("host_isolation.pf.conf")
}

/// Extract the reference token printed by `pfctl -E` (`Token : 1234`).
pub(crate) fn pf_token(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let (label, value) = line.split_once(':')?;
        let value = value.trim();
        (label.trim().eq_ignore_ascii_case("token")
            && !value.is_empty()
            && value.bytes().all(|b| b.is_ascii_digit()))
        .then(|| value.to_string())
    })
}

// ── iptables (Linux) ────────────────────────────────────────────────────────

/// Commands lifting the iptables isolation. Each may fail when the isolation
/// is not (fully) in place.
pub(crate) fn iptables_release() -> Vec<Command> {
    let mut commands = Vec::new();
    for program in ["iptables", "ip6tables"] {
        commands.push(Command::new(
            program,
            &["-D", "INPUT", "-j", IPTABLES_CHAIN_IN],
        ));
        commands.push(Command::new(
            program,
            &["-D", "OUTPUT", "-j", IPTABLES_CHAIN_OUT],
        ));
        commands.push(Command::new(
            program,
            &["-D", "FORWARD", "-j", IPTABLES_CHAIN_OUT],
        ));
        for chain in [IPTABLES_CHAIN_IN, IPTABLES_CHAIN_OUT] {
            commands.push(Command::new(program, &["-F", chain]));
            commands.push(Command::new(program, &["-X", chain]));
        }
    }
    commands
}

/// Commands applying the iptables isolation for one address family.
pub(crate) fn iptables_apply(allowed: &[IpAddr], ipv6: bool) -> Vec<Command> {
    let program = if ipv6 { "ip6tables" } else { "iptables" };
    let cmd = |args: &[&str]| Command::new(program, args);
    let (chain_in, chain_out) = (IPTABLES_CHAIN_IN, IPTABLES_CHAIN_OUT);

    let mut commands = vec![
        cmd(&["-N", chain_in]),
        cmd(&["-N", chain_out]),
        cmd(&["-A", chain_in, "-i", "lo", "-j", "ACCEPT"]),
        cmd(&["-A", chain_out, "-o", "lo", "-j", "ACCEPT"]),
    ];
    if ipv6 {
        // Neighbour discovery, without which no IPv6 address is reachable.
        commands.push(cmd(&["-A", chain_in, "-p", "ipv6-icmp", "-j", "ACCEPT"]));
        commands.push(cmd(&["-A", chain_out, "-p", "ipv6-icmp", "-j", "ACCEPT"]));
    } else {
        commands.push(cmd(&[
            "-A", chain_out, "-p", "udp", "--sport", "68", "--dport", "67", "-j", "ACCEPT",
        ]));
        commands.push(cmd(&[
            "-A", chain_in, "-p", "udp", "--sport", "67", "--dport", "68", "-j", "ACCEPT",
        ]));
    }
    for protocol in ["udp", "tcp"] {
        commands.push(cmd(&[
            "-A", chain_out, "-p", protocol, "--dport", "53", "-j", "ACCEPT",
        ]));
        commands.push(cmd(&[
            "-A", chain_in, "-p", protocol, "--sport", "53", "-j", "ACCEPT",
        ]));
    }
    for ip in allowed.iter().filter(|ip| ip.is_ipv6() == ipv6) {
        let ip = ip.to_string();
        commands.push(cmd(&["-A", chain_out, "-d", &ip, "-j", "ACCEPT"]));
        commands.push(cmd(&["-A", chain_in, "-s", &ip, "-j", "ACCEPT"]));
    }
    commands.extend([
        cmd(&["-A", chain_in, "-j", "DROP"]),
        cmd(&["-A", chain_out, "-j", "DROP"]),
        // Hooked last: until here the chains filter nothing.
        cmd(&["-I", "INPUT", "1", "-j", chain_in]),
        cmd(&["-I", "OUTPUT", "1", "-j", chain_out]),
        cmd(&["-I", "FORWARD", "1", "-j", chain_out]),
    ]);
    commands
}

// ── Windows Firewall ────────────────────────────────────────────────────────

/// Ranges left once `allowed` (inclusive ranges) is taken out of `0..=max`.
fn gaps(mut allowed: Vec<(u128, u128)>, max: u128) -> Vec<(u128, u128)> {
    allowed.sort_unstable();
    let mut blocked = Vec::new();
    // First address not yet known to be allowed or blocked.
    let mut next = Some(0u128);
    for (start, end) in allowed {
        let Some(cursor) = next else { break };
        if start > cursor {
            blocked.push((cursor, start - 1));
        }
        if end >= cursor {
            next = (end < max).then(|| end + 1);
        }
    }
    if let Some(cursor) = next {
        blocked.push((cursor, max));
    }
    blocked
}

/// Addresses to block, as a Windows Firewall `remoteip` list: everything but
/// the allowed addresses and the ranges a working stack needs.
pub(crate) fn netsh_blocked_addresses(allowed: &[IpAddr], ipv6: bool) -> String {
    let range = |start: u128, end: u128| -> String {
        let show = |value: u128| -> String {
            if ipv6 {
                Ipv6Addr::from(value).to_string()
            } else {
                Ipv4Addr::from(u32::try_from(value).unwrap_or(u32::MAX)).to_string()
            }
        };
        if start == end {
            show(start)
        } else {
            format!("{}-{}", show(start), show(end))
        }
    };

    let mut keep: Vec<(u128, u128)> = Vec::new();
    let max = if ipv6 {
        // Loopback, link-local (neighbour discovery, DHCPv6) and multicast.
        keep.push((1, 1));
        keep.push((
            u128::from(Ipv6Addr::new(0xfe80, 0, 0, 0, 0, 0, 0, 0)),
            u128::from(Ipv6Addr::new(
                0xfebf, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff,
            )),
        ));
        keep.push((
            u128::from(Ipv6Addr::new(0xff00, 0, 0, 0, 0, 0, 0, 0)),
            u128::MAX,
        ));
        u128::MAX
    } else {
        // Loopback.
        keep.push((
            u128::from(u32::from(Ipv4Addr::new(127, 0, 0, 0))),
            u128::from(u32::from(Ipv4Addr::new(127, 255, 255, 255))),
        ));
        u128::from(u32::MAX)
    };
    for ip in allowed {
        match ip {
            IpAddr::V4(v4) if !ipv6 => {
                let value = u128::from(u32::from(*v4));
                keep.push((value, value));
            }
            IpAddr::V6(v6) if ipv6 => {
                let value = u128::from(*v6);
                keep.push((value, value));
            }
            _ => {}
        }
    }

    gaps(keep, max)
        .into_iter()
        .map(|(start, end)| range(start, end))
        .collect::<Vec<_>>()
        .join(",")
}

fn netsh_rule_name(rule: &str) -> String {
    format!("name={NETSH_RULE_PREFIX}{rule}")
}

/// Commands applying the Windows Firewall isolation.
///
/// Block rules win over allow rules, so they are scoped to leave DNS (port
/// 53), DHCP (ports 67/68) and the allowed addresses out.
pub(crate) fn netsh_apply(allowed: &[IpAddr]) -> Vec<Command> {
    let v4 = netsh_blocked_addresses(allowed, false);
    let all = format!("{v4},{}", netsh_blocked_addresses(allowed, true));
    let rule = |name: &str, direction: &str, extra: &[String]| -> Command {
        let mut args: Vec<String> = ["advfirewall", "firewall", "add", "rule"]
            .iter()
            .map(|arg| (*arg).to_string())
            .collect();
        args.push(netsh_rule_name(name));
        args.push(format!("dir={direction}"));
        args.push("action=block".to_string());
        args.extend(extra.iter().cloned());
        Command {
            program: "netsh",
            args,
        }
    };
    vec![
        rule(
            "OutTCP",
            "out",
            &[
                "protocol=TCP".to_string(),
                "remoteport=1-52,54-65535".to_string(),
                format!("remoteip={all}"),
            ],
        ),
        rule(
            "OutUDP",
            "out",
            &[
                "protocol=UDP".to_string(),
                "remoteport=1-52,54-66,68-65535".to_string(),
                format!("remoteip={all}"),
            ],
        ),
        rule(
            "OutICMPv4",
            "out",
            &["protocol=icmpv4".to_string(), format!("remoteip={v4}")],
        ),
        rule(
            "InTCP",
            "in",
            &["protocol=TCP".to_string(), format!("remoteip={all}")],
        ),
        rule(
            "InUDP",
            "in",
            &[
                "protocol=UDP".to_string(),
                "localport=1-67,69-65535".to_string(),
                format!("remoteip={all}"),
            ],
        ),
    ]
}

/// Commands lifting the Windows Firewall isolation.
pub(crate) fn netsh_release() -> Vec<Command> {
    NETSH_RULES
        .iter()
        .map(|rule| Command {
            program: "netsh",
            args: vec![
                "advfirewall".to_string(),
                "firewall".to_string(),
                "delete".to_string(),
                "rule".to_string(),
                netsh_rule_name(rule),
            ],
        })
        .collect()
}

// ── Platform address ────────────────────────────────────────────────────────

/// Host and port of the platform, from the configured server URL.
pub(crate) fn platform_endpoint(server_url: &str) -> Option<(String, u16)> {
    let url = url::Url::parse(server_url).ok()?;
    let host = url.host_str()?.trim_matches(['[', ']']).to_string();
    Some((host, url.port_or_known_default().unwrap_or(443)))
}

/// Addresses that must stay reachable: the platform's. Empty for a
/// standalone agent.
///
/// Fails when the platform cannot be located: isolating then would cut the
/// only channel able to lift the isolation remotely.
async fn control_channel_addresses(config: &AgentConfig) -> Result<Vec<IpAddr>, CommonError> {
    if config.standalone {
        return Ok(Vec::new());
    }
    let (host, port) = platform_endpoint(&config.server_url).ok_or_else(|| {
        CommonError::internal("Isolation refused: the platform address is not configured")
    })?;
    if let Ok(ip) = host.parse::<IpAddr>() {
        return Ok(vec![ip]);
    }
    let mut addresses: Vec<IpAddr> = tokio::net::lookup_host((host.as_str(), port))
        .await
        .map_err(|e| {
            CommonError::internal(format!(
                "Isolation refused: the platform address ({host}) cannot be resolved ({e}), \
                 so the endpoint could not be released remotely"
            ))
        })?
        .map(|address| address.ip())
        .collect();
    addresses.sort();
    addresses.dedup();
    if addresses.is_empty() {
        return Err(CommonError::internal(format!(
            "Isolation refused: the platform address ({host}) resolves to nothing"
        )));
    }
    Ok(addresses)
}

// ── State on disk ───────────────────────────────────────────────────────────

fn state_path() -> PathBuf {
    AgentConfig::platform_data_dir().join("host_isolation.json")
}

async fn load_state(path: &Path) -> Option<IsolationState> {
    let bytes = tokio::fs::read(path).await.ok()?;
    serde_json::from_slice(&bytes).ok()
}

async fn store_state(path: &Path, state: &IsolationState) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(path, serde_json::to_vec_pretty(state)?).await
}

/// The isolation in force, if any.
pub async fn isolation_state() -> Option<IsolationState> {
    load_state(&state_path()).await
}

/// What a restart has to do about a recorded isolation.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Reconcile {
    /// Its duration elapsed while the agent was down: lift it.
    Release,
    /// Still in force: apply the rules again; lift after `remaining_secs`.
    Reapply { remaining_secs: Option<u64> },
}

pub(crate) fn reconcile_action(state: &IsolationState, now: i64) -> Reconcile {
    match state.release_at {
        Some(release_at) if release_at <= now => Reconcile::Release,
        Some(release_at) => Reconcile::Reapply {
            remaining_secs: Some(u64::try_from(release_at.saturating_sub(now)).unwrap_or(0)),
        },
        None => Reconcile::Reapply {
            remaining_secs: None,
        },
    }
}

// ── Execution ───────────────────────────────────────────────────────────────

/// Run a command; on failure return what it printed.
async fn run(command: &Command) -> Result<String, String> {
    let output = agent_common::process::silent_async_command(command.program)
        .args(&command.args)
        .output()
        .await
        .map_err(|e| format!("{} could not be started: {}", command.program, e))?;
    let printed = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    if output.status.success() {
        Ok(printed)
    } else {
        Err(format!(
            "{} {} failed: {}",
            command.program,
            command.args.join(" "),
            printed.trim()
        ))
    }
}

/// Run every command, ignoring failures (lifting rules that may not exist).
async fn run_all_best_effort(commands: &[Command]) {
    for command in commands {
        if let Err(e) = run(command).await {
            tracing::debug!("Isolation cleanup step skipped: {}", e);
        }
    }
}

/// Run the commands in order; on the first failure undo with `rollback`.
async fn run_all_or_rollback(commands: &[Command], rollback: &[Command]) -> Result<(), String> {
    for command in commands {
        if let Err(e) = run(command).await {
            run_all_best_effort(rollback).await;
            return Err(e);
        }
    }
    Ok(())
}

/// Apply the firewall rules. Returns the pf token on macOS.
async fn apply_rules(allowed: &[IpAddr]) -> Result<Option<String>, String> {
    if cfg!(target_os = "macos") {
        let rules_path = pf_rules_path();
        if let Some(parent) = rules_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
        }
        tokio::fs::write(&rules_path, pf_rules(allowed))
            .await
            .map_err(|e| format!("cannot write {}: {e}", rules_path.display()))?;
        let rules_file = rules_path.to_string_lossy().to_string();
        run(&Command::new(
            "pfctl",
            &["-a", PF_ANCHOR, "-f", &rules_file],
        ))
        .await?;
        let token = match run(&Command::new("pfctl", &["-E"])).await {
            Ok(printed) => pf_token(&printed),
            Err(e) => {
                run_all_best_effort(&[Command::new("pfctl", &["-a", PF_ANCHOR, "-F", "all"])])
                    .await;
                return Err(e);
            }
        };
        // Connections opened before the rules were loaded keep their state.
        run_all_best_effort(&[Command::new("pfctl", &["-F", "states"])]).await;
        Ok(token)
    } else if cfg!(target_os = "windows") {
        // Rules have no effect while a firewall profile is turned off.
        let profiles_off = run(&Command::new(
            "powershell",
            &[
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "@(Get-NetFirewallProfile | Where-Object { -not $_.Enabled }).Count",
            ],
        ))
        .await?;
        if profiles_off.trim() != "0" {
            return Err(
                "Windows Firewall is turned off for at least one profile: the isolation \
                 could not be enforced"
                    .to_string(),
            );
        }
        run_all_best_effort(&netsh_release()).await;
        run_all_or_rollback(&netsh_apply(allowed), &netsh_release()).await?;
        Ok(None)
    } else {
        let release = iptables_release();
        run_all_best_effort(&release).await;
        run_all_or_rollback(&iptables_apply(allowed, false), &release).await?;
        // A kernel without IPv6 has nothing to filter there.
        if Path::new("/proc/sys/net/ipv6").exists() {
            run_all_or_rollback(&iptables_apply(allowed, true), &release).await?;
        }
        Ok(None)
    }
}

async fn remove_rules(pf_token: Option<&str>) {
    if cfg!(target_os = "macos") {
        let mut commands = vec![Command::new("pfctl", &["-a", PF_ANCHOR, "-F", "all"])];
        if let Some(token) = pf_token {
            commands.push(Command::new("pfctl", &["-X", token]));
        }
        run_all_best_effort(&commands).await;
        let _ = tokio::fs::remove_file(pf_rules_path()).await;
    } else if cfg!(target_os = "windows") {
        run_all_best_effort(&netsh_release()).await;
    } else {
        run_all_best_effort(&iptables_release()).await;
    }
}

fn schedule_release(after_secs: u64) {
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(after_secs)).await;
        // Only lift the isolation this timer belongs to: it may have been
        // released and applied again with another duration meanwhile.
        let due = isolation_state()
            .await
            .and_then(|state| state.release_at)
            .is_some_and(|release_at| release_at <= chrono::Utc::now().timestamp());
        if due && let Err(e) = release_host().await {
            warn!("Failed to lift the host isolation automatically: {}", e);
        }
    });
}

/// Isolate the endpoint from the network.
///
/// `duration_secs` greater than 0 lifts the isolation automatically after
/// that time; 0 keeps it until [`release_host`] is called.
pub async fn isolate_host(reason: &str, duration_secs: u64) -> Result<IsolationState, CommonError> {
    if !crate::service::is_admin() {
        let data = crate::privileged::delegate(crate::privileged::Request::IsolateHost {
            reason: reason.to_string(),
            duration_secs,
        })
        .await?;
        return data
            .and_then(|value| serde_json::from_value(value).ok())
            .ok_or_else(|| CommonError::internal("The service returned no isolation state"));
    }
    let config = AgentConfig::load(None)
        .map_err(|e| CommonError::internal(format!("Isolation refused: {e}")))?;
    let allowed = control_channel_addresses(&config).await?;

    info!(
        "Isolating the endpoint from the network ({}); still reachable: {:?}",
        reason, allowed
    );
    let pf_token = apply_rules(&allowed)
        .await
        .map_err(|e| CommonError::internal(format!("Host isolation failed: {e}")))?;

    let now = chrono::Utc::now().timestamp();
    let state = IsolationState {
        isolated_at: now,
        release_at: (duration_secs > 0)
            .then(|| now.saturating_add(i64::try_from(duration_secs).unwrap_or(i64::MAX))),
        reason: reason.chars().take(MAX_REASON_CHARS).collect(),
        allowed,
        pf_token,
    };
    if let Err(e) = store_state(&state_path(), &state).await {
        // Without the record a restart could neither re-apply nor lift it.
        remove_rules(state.pf_token.as_deref()).await;
        return Err(CommonError::internal(format!(
            "Host isolation cancelled: its state could not be recorded ({e})"
        )));
    }
    set_isolated(true);
    if duration_secs > 0 {
        schedule_release(duration_secs);
    }
    info!("Endpoint isolated from the network");
    Ok(state)
}

/// Lift the isolation. Does nothing when the endpoint is not isolated.
pub async fn release_host() -> Result<(), CommonError> {
    if !crate::service::is_admin() {
        return crate::privileged::delegate(crate::privileged::Request::ReleaseHost)
            .await
            .map(|_| ());
    }
    let path = state_path();
    let state = load_state(&path).await;
    remove_rules(state.as_ref().and_then(|s| s.pf_token.as_deref())).await;
    set_isolated(false);
    match tokio::fs::remove_file(&path).await {
        Ok(()) => info!("Endpoint isolation lifted"),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => {
            return Err(CommonError::internal(format!(
                "Isolation rules removed, but its record could not be deleted ({e})"
            )));
        }
    }
    Ok(())
}

/// Bring the firewall in line with the recorded isolation after a restart.
///
/// Call once during agent start-up.
pub async fn reconcile_host_isolation() {
    let Some(state) = isolation_state().await else {
        return;
    };
    match reconcile_action(&state, chrono::Utc::now().timestamp()) {
        Reconcile::Release => {
            info!("Host isolation expired while the agent was stopped: lifting it");
            if let Err(e) = release_host().await {
                warn!("Failed to lift the expired host isolation: {}", e);
            }
        }
        Reconcile::Reapply { remaining_secs } => {
            info!(
                "Endpoint is isolated ({}): applying the rules again",
                state.reason
            );
            match apply_rules(&state.allowed).await {
                Ok(pf_token) => {
                    set_isolated(true);
                    let refreshed = IsolationState { pf_token, ..state };
                    if let Err(e) = store_state(&state_path(), &refreshed).await {
                        warn!("Failed to record the host isolation: {}", e);
                    }
                }
                Err(e) => warn!("Failed to apply the host isolation again: {}", e),
            }
            if let Some(remaining) = remaining_secs {
                schedule_release(remaining);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(value: &str) -> IpAddr {
        value.parse().unwrap()
    }

    fn args(command: &Command) -> String {
        command.args.join(" ")
    }

    #[test]
    fn pf_rules_pass_the_essentials_then_block_everything() {
        let rules = pf_rules(&[ip("203.0.113.10"), ip("203.0.113.11")]);
        let lines: Vec<&str> = rules.lines().filter(|l| !l.starts_with('#')).collect();

        assert_eq!(lines.first(), Some(&"pass quick on lo0 all"));
        assert_eq!(lines.last(), Some(&"block drop quick all"));
        assert!(lines.contains(&"pass out quick from any to 203.0.113.10 keep state"));
        assert!(lines.contains(&"pass out quick from any to 203.0.113.11 keep state"));
        assert!(rules.contains("port 53"));
        assert!(rules.contains("port 68 to any port 67"));
        assert!(!rules.contains("icmp6"), "no IPv6 platform address");
        // Every rule stops evaluation: nothing after the block can re-open.
        assert!(lines.iter().all(|line| line.contains(" quick ")));
    }

    #[test]
    fn pf_rules_keep_ipv6_neighbour_discovery_for_an_ipv6_platform() {
        let rules = pf_rules(&[ip("2001:db8::10")]);
        assert!(rules.contains("pass quick inet6 proto icmp6 all"));
        assert!(rules.contains("pass out quick from any to 2001:db8::10 keep state"));
    }

    #[test]
    fn standalone_pf_rules_allow_no_remote_address() {
        let rules = pf_rules(&[]);
        assert!(!rules.contains("pass out quick from any to "));
        assert!(rules.ends_with("block drop quick all\n"));
    }

    #[test]
    fn pf_token_is_read_from_pfctl_output() {
        assert_eq!(
            pf_token("pf enabled\nToken : 12345678901234567890\n").as_deref(),
            Some("12345678901234567890")
        );
        assert_eq!(pf_token("pfctl: pf already enabled\n"), None);
        assert_eq!(pf_token("Token : not-a-number"), None);
    }

    #[test]
    fn iptables_chains_are_hooked_only_once_complete() {
        let commands = iptables_apply(&[ip("203.0.113.10"), ip("2001:db8::10")], false);
        assert!(commands.iter().all(|c| c.program == "iptables"));
        let lines: Vec<String> = commands.iter().map(args).collect();

        assert_eq!(lines[0], "-N SENTINEL_ISO_IN");
        assert_eq!(lines[1], "-N SENTINEL_ISO_OUT");
        assert!(lines.contains(&"-A SENTINEL_ISO_OUT -d 203.0.113.10 -j ACCEPT".to_string()));
        assert!(lines.contains(&"-A SENTINEL_ISO_IN -s 203.0.113.10 -j ACCEPT".to_string()));
        assert!(
            !lines.iter().any(|l| l.contains("2001:db8")),
            "IPv6 addresses belong to ip6tables"
        );
        assert!(lines.contains(&"-A SENTINEL_ISO_OUT -p udp --dport 53 -j ACCEPT".to_string()));

        // The DROP rules close each chain, and the hooks come after them.
        let drop_in = lines
            .iter()
            .position(|l| l == "-A SENTINEL_ISO_IN -j DROP")
            .unwrap();
        let drop_out = lines
            .iter()
            .position(|l| l == "-A SENTINEL_ISO_OUT -j DROP")
            .unwrap();
        let first_hook = lines.iter().position(|l| l.starts_with("-I ")).unwrap();
        assert!(drop_in < first_hook && drop_out < first_hook);
        assert_eq!(
            &lines[first_hook..],
            [
                "-I INPUT 1 -j SENTINEL_ISO_IN",
                "-I OUTPUT 1 -j SENTINEL_ISO_OUT",
                "-I FORWARD 1 -j SENTINEL_ISO_OUT",
            ]
        );
        let accepts_after_drop = lines[drop_in.min(drop_out)..first_hook]
            .iter()
            .any(|l| l.ends_with("ACCEPT"));
        assert!(!accepts_after_drop);
    }

    #[test]
    fn ip6tables_gets_ipv6_addresses_and_neighbour_discovery() {
        let commands = iptables_apply(&[ip("203.0.113.10"), ip("2001:db8::10")], true);
        assert!(commands.iter().all(|c| c.program == "ip6tables"));
        let lines: Vec<String> = commands.iter().map(args).collect();
        assert!(lines.contains(&"-A SENTINEL_ISO_OUT -d 2001:db8::10 -j ACCEPT".to_string()));
        assert!(lines.contains(&"-A SENTINEL_ISO_IN -p ipv6-icmp -j ACCEPT".to_string()));
        assert!(!lines.iter().any(|l| l.contains("203.0.113.10")));
        assert!(
            !lines.iter().any(|l| l.contains("--dport 67")),
            "DHCPv4 only"
        );
    }

    #[test]
    fn iptables_release_unhooks_before_deleting_the_chains() {
        let lines: Vec<String> = iptables_release()
            .iter()
            .filter(|c| c.program == "iptables")
            .map(args)
            .collect();
        assert_eq!(
            lines,
            [
                "-D INPUT -j SENTINEL_ISO_IN",
                "-D OUTPUT -j SENTINEL_ISO_OUT",
                "-D FORWARD -j SENTINEL_ISO_OUT",
                "-F SENTINEL_ISO_IN",
                "-X SENTINEL_ISO_IN",
                "-F SENTINEL_ISO_OUT",
                "-X SENTINEL_ISO_OUT",
            ]
        );
        assert_eq!(iptables_release().len(), 14, "same for ip6tables");
    }

    #[test]
    fn gaps_are_the_exact_complement() {
        assert_eq!(gaps(vec![], 9), [(0, 9)]);
        assert_eq!(gaps(vec![(0, 9)], 9), []);
        assert_eq!(gaps(vec![(3, 4)], 9), [(0, 2), (5, 9)]);
        assert_eq!(gaps(vec![(0, 0), (9, 9)], 9), [(1, 8)]);
        // Unsorted, overlapping and adjacent ranges.
        assert_eq!(gaps(vec![(6, 7), (2, 4), (3, 5)], 9), [(0, 1), (8, 9)]);
        assert_eq!(gaps(vec![(2, 9), (4, 5)], 9), [(0, 1)]);
    }

    #[test]
    fn windows_blocks_every_ipv4_address_but_loopback_and_the_platform() {
        assert_eq!(
            netsh_blocked_addresses(&[ip("203.0.113.10")], false),
            "0.0.0.0-126.255.255.255,128.0.0.0-203.0.113.9,203.0.113.11-255.255.255.255"
        );
        assert_eq!(
            netsh_blocked_addresses(&[], false),
            "0.0.0.0-126.255.255.255,128.0.0.0-255.255.255.255"
        );
    }

    #[test]
    fn windows_keeps_ipv6_loopback_link_local_and_multicast() {
        let blocked = netsh_blocked_addresses(&[ip("2001:db8::10")], true);
        let ranges: Vec<&str> = blocked.split(',').collect();
        assert_eq!(
            ranges[0], "::",
            "the unspecified address alone precedes ::1"
        );
        assert_eq!(ranges[1], "::2-2001:db8::f");
        assert_eq!(
            ranges[2],
            "2001:db8::11-fe7f:ffff:ffff:ffff:ffff:ffff:ffff:ffff"
        );
        assert_eq!(ranges[3], "fec0::-feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
        assert_eq!(ranges.len(), 4, "ff00::/8 runs to the end of the space");
    }

    #[test]
    fn windows_rules_leave_dns_and_dhcp_out_of_the_blocks() {
        let commands = netsh_apply(&[ip("203.0.113.10")]);
        assert_eq!(commands.len(), NETSH_RULES.len());
        for (command, rule) in commands.iter().zip(NETSH_RULES) {
            assert_eq!(command.program, "netsh");
            assert!(args(command).starts_with(&format!(
                "advfirewall firewall add rule name=SentinelIsolation_{rule} dir="
            )));
            assert!(command.args.contains(&"action=block".to_string()));
        }
        let out_tcp = args(&commands[0]);
        assert!(out_tcp.contains("remoteport=1-52,54-65535"));
        let out_udp = args(&commands[1]);
        assert!(out_udp.contains("remoteport=1-52,54-66,68-65535"));
        let in_udp = args(&commands[4]);
        assert!(in_udp.contains("localport=1-67,69-65535"));
        // The platform address is in none of the blocked ranges.
        assert!(!commands.iter().any(|c| args(c).contains("203.0.113.10,")));
        assert!(out_tcp.contains("203.0.113.9,203.0.113.11"));

        let released: Vec<String> = netsh_release().iter().map(args).collect();
        assert_eq!(released.len(), commands.len());
        assert_eq!(
            released[0],
            "advfirewall firewall delete rule name=SentinelIsolation_OutTCP"
        );
    }

    #[test]
    fn platform_endpoint_is_read_from_the_server_url() {
        assert_eq!(
            platform_endpoint("https://grc.example.com/fn/agentApi"),
            Some(("grc.example.com".to_string(), 443))
        );
        assert_eq!(
            platform_endpoint("http://10.0.0.5:8080/api"),
            Some(("10.0.0.5".to_string(), 8080))
        );
        assert_eq!(
            platform_endpoint("https://[2001:db8::10]/api"),
            Some(("2001:db8::10".to_string(), 443))
        );
        assert_eq!(platform_endpoint("not a url"), None);
    }

    #[tokio::test]
    async fn standalone_agents_allow_nothing_and_literal_addresses_need_no_dns() {
        let config = AgentConfig {
            standalone: true,
            ..AgentConfig::default()
        };
        assert!(control_channel_addresses(&config).await.unwrap().is_empty());

        let config = AgentConfig {
            server_url: "https://203.0.113.10/fn/agentApi".to_string(),
            ..AgentConfig::default()
        };
        assert_eq!(
            control_channel_addresses(&config).await.unwrap(),
            [ip("203.0.113.10")]
        );
    }

    #[tokio::test]
    async fn isolation_is_refused_when_the_platform_cannot_be_located() {
        let config = AgentConfig {
            server_url: "https://platform.invalid/fn/agentApi".to_string(),
            ..AgentConfig::default()
        };
        let error = control_channel_addresses(&config).await.unwrap_err();
        assert!(error.to_string().contains("Isolation refused"));
    }

    fn state(release_at: Option<i64>) -> IsolationState {
        IsolationState {
            isolated_at: 1_000,
            release_at,
            reason: "Playbook 'Ransomware'".to_string(),
            allowed: vec![ip("203.0.113.10")],
            pf_token: Some("42".to_string()),
        }
    }

    #[test]
    fn restart_lifts_an_expired_isolation_and_reapplies_a_running_one() {
        assert_eq!(
            reconcile_action(&state(Some(1_500)), 2_000),
            Reconcile::Release
        );
        assert_eq!(
            reconcile_action(&state(Some(2_000)), 2_000),
            Reconcile::Release
        );
        assert_eq!(
            reconcile_action(&state(Some(2_600)), 2_000),
            Reconcile::Reapply {
                remaining_secs: Some(600)
            }
        );
        assert_eq!(
            reconcile_action(&state(None), 2_000),
            Reconcile::Reapply {
                remaining_secs: None
            }
        );
    }

    #[tokio::test]
    async fn state_survives_a_round_trip_on_disk() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("host_isolation.json");
        assert_eq!(load_state(&path).await, None);

        let saved = state(Some(2_600));
        store_state(&path, &saved).await.unwrap();
        assert_eq!(load_state(&path).await, Some(saved));

        tokio::fs::write(&path, b"not json").await.unwrap();
        assert_eq!(load_state(&path).await, None);
    }
}
