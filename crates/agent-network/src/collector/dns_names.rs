// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Host names this machine resolved recently.
//!
//! The connection collectors only see addresses, and a detector that looks
//! for generated domains or mining pools needs names. They are read from
//! the resolver cache of the system, where one can be read:
//!
//! - **Windows**: `Get-DnsClientCache`.
//! - **Linux**: `resolvectl show-cache` (systemd-resolved 254 or later).
//!   Without it nothing lists the names resolved: an explicit "not covered".
//! - **macOS**: no source. The cache of mDNSResponder cannot be dumped
//!   (`dscacheutil -cachedump` is gone) and its log masks the names
//!   queried. "Not covered", said as such.
//!
//! One command per pass, with a deadline, and a bounded number of names.

#[cfg(any(target_os = "linux", target_os = "windows", test))]
use std::collections::BTreeMap;
#[cfg(any(target_os = "linux", target_os = "windows"))]
use std::time::Duration;

/// A name the machine resolved, and the addresses it got for it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObservedName {
    /// Lowercase, without the trailing dot.
    pub name: String,
    /// Addresses the name resolved to (may be empty: a CNAME, or a source
    /// that does not give them).
    pub addresses: Vec<String>,
}

/// Whether detections by host name are fed on this machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DnsNameCoverage {
    /// No pass ran yet.
    Unknown,
    /// Names are read from `source`.
    Covered {
        source: &'static str,
        /// Names read by the last pass.
        names: usize,
    },
    /// No source of names here: detections by name (generated domains,
    /// mining pools, malicious domains) do not run. Not "nothing found".
    NotCovered { reason: String },
}

impl DnsNameCoverage {
    /// Stable code: `unknown`, `covered` or `not_covered`.
    pub fn code(&self) -> &'static str {
        match self {
            Self::Unknown => "unknown",
            Self::Covered { .. } => "covered",
            Self::NotCovered { .. } => "not_covered",
        }
    }
}

/// What one pass read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DnsNameObservation {
    pub names: Vec<ObservedName>,
    pub coverage: DnsNameCoverage,
}

impl DnsNameObservation {
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    fn covered(source: &'static str, names: Vec<ObservedName>) -> Self {
        Self {
            coverage: DnsNameCoverage::Covered {
                source,
                names: names.len(),
            },
            names,
        }
    }

    fn not_covered(reason: impl Into<String>) -> Self {
        Self {
            names: Vec::new(),
            coverage: DnsNameCoverage::NotCovered {
                reason: reason.into(),
            },
        }
    }
}

/// Names kept from one pass.
#[cfg(any(target_os = "linux", target_os = "windows", test))]
const MAX_NAMES: usize = 2000;

/// How long the command reading the cache may run.
#[cfg(any(target_os = "linux", target_os = "windows"))]
const DEADLINE: Duration = Duration::from_secs(15);

/// Gather `(name, address)` pairs into names, bounded and normalised.
#[cfg(any(target_os = "linux", target_os = "windows", test))]
fn collect(pairs: impl IntoIterator<Item = (String, Option<String>)>) -> Vec<ObservedName> {
    let mut names: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for (name, address) in pairs {
        let name = name.trim().trim_end_matches('.').to_lowercase();
        // Not names of hosts on the Internet: reverse lookups, mDNS, single
        // labels, and anything that is not a DNS name.
        if !name.contains('.')
            || name.ends_with(".arpa")
            || name.ends_with(".local")
            || name.parse::<std::net::IpAddr>().is_ok()
            || !name
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
        {
            continue;
        }
        if names.len() >= MAX_NAMES && !names.contains_key(&name) {
            continue;
        }
        let addresses = names.entry(name).or_default();
        if let Some(address) = address.filter(|a| a.parse::<std::net::IpAddr>().is_ok())
            && !addresses.contains(&address)
        {
            addresses.push(address);
        }
    }
    names
        .into_iter()
        .map(|(name, addresses)| ObservedName { name, addresses })
        .collect()
}

/// Names in the output of `resolvectl show-cache`: one record per line,
/// `name IN TYPE data`.
#[cfg(any(target_os = "linux", test))]
fn parse_resolvectl_cache(output: &str) -> Vec<ObservedName> {
    collect(output.lines().filter_map(|line| {
        let mut words = line.split_whitespace();
        let (name, class, kind, data) = (words.next()?, words.next()?, words.next()?, words.next());
        (class == "IN" && matches!(kind, "A" | "AAAA" | "CNAME")).then(|| {
            (
                name.to_string(),
                data.filter(|_| kind != "CNAME").map(str::to_string),
            )
        })
    }))
}

/// Names in the JSON of `Get-DnsClientCache | Select-Object Entry, Data`:
/// an array of records, or one record alone.
#[cfg(any(target_os = "windows", test))]
fn parse_dns_client_cache(json: &str) -> Vec<ObservedName> {
    let records = match serde_json::from_str::<serde_json::Value>(json.trim()) {
        Ok(serde_json::Value::Array(records)) => records,
        Ok(record @ serde_json::Value::Object(_)) => vec![record],
        _ => Vec::new(),
    };
    collect(records.iter().filter_map(|record| {
        Some((
            record.get("Entry")?.as_str()?.to_string(),
            record
                .get("Data")
                .and_then(|data| data.as_str())
                .map(str::to_string),
        ))
    }))
}

/// Run a command with a deadline; its standard output when it succeeded.
#[cfg(any(target_os = "linux", target_os = "windows"))]
async fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let mut command = tokio::process::Command::from(agent_common::process::silent_command(program));
    command.args(args).kill_on_drop(true);
    match tokio::time::timeout(DEADLINE, command.output()).await {
        Err(_) => Err(format!(
            "{program} n'a pas r\u{e9}pondu en {} s",
            DEADLINE.as_secs()
        )),
        Ok(Err(e)) => Err(format!("{program} introuvable ({e})")),
        Ok(Ok(output)) if !output.status.success() => Err(format!(
            "{program} a \u{e9}chou\u{e9} ({})",
            String::from_utf8_lossy(&output.stderr).trim()
        )),
        Ok(Ok(output)) => Ok(String::from_utf8_lossy(&output.stdout).to_string()),
    }
}

/// Read the names this machine resolved recently.
pub async fn observe_dns_names() -> DnsNameObservation {
    #[cfg(target_os = "linux")]
    {
        match run("resolvectl", &["show-cache"]).await {
            Ok(output) => DnsNameObservation::covered(
                "cache de systemd-resolved",
                parse_resolvectl_cache(&output),
            ),
            Err(e) => DnsNameObservation::not_covered(format!(
                "aucun cache DNS consultable\u{a0}: {e}. La lecture demande systemd-resolved 254 ou plus r\u{e9}cent."
            )),
        }
    }
    #[cfg(target_os = "windows")]
    {
        match run(
            "powershell",
            &[
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-DnsClientCache | Select-Object Entry, Data | ConvertTo-Json -Compress",
            ],
        )
        .await
        {
            Ok(output) => DnsNameObservation::covered(
                "cache du client DNS de Windows",
                parse_dns_client_cache(&output),
            ),
            Err(e) => DnsNameObservation::not_covered(format!(
                "le cache du client DNS n'a pas pu \u{ea}tre lu\u{a0}: {e}"
            )),
        }
    }
    #[cfg(target_os = "macos")]
    {
        // Deliberately no attempt: nothing on macOS lists the names
        // resolved without privileges the agent does not have.
        DnsNameObservation::not_covered(
            "macOS n'expose pas les noms r\u{e9}solus\u{a0}: le cache de mDNSResponder ne peut pas \u{ea}tre lu et son journal masque les noms",
        )
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        DnsNameObservation::not_covered("syst\u{e8}me non pris en charge")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_resolved_cache_gives_names_with_their_addresses() {
        let output = "Scope protocol=dns ifindex=2 ifname=eth0\n\
                      Example.COM. IN A 93.184.216.34\n\
                      example.com IN AAAA 2606:2800:220:1:248:1893:25c8:1946\n\
                      www.example.com IN CNAME example.com\n\
                      34.216.184.93.in-addr.arpa IN PTR example.com\n\
                      printer.local IN A 192.168.1.9\n\
                      \n\
                      Scope protocol=llmnr ifindex=2 ifname=eth0\n";
        let names = parse_resolvectl_cache(output);
        assert_eq!(
            names,
            [
                ObservedName {
                    name: "example.com".into(),
                    addresses: vec![
                        "93.184.216.34".into(),
                        "2606:2800:220:1:248:1893:25c8:1946".into()
                    ],
                },
                ObservedName {
                    name: "www.example.com".into(),
                    addresses: vec![],
                },
            ]
        );
    }

    #[test]
    fn the_windows_cache_gives_names_with_their_addresses() {
        let json = r#"[{"Entry":"pool.minexmr.com","Data":"203.0.113.9"},
                       {"Entry":"pool.minexmr.com","Data":"203.0.113.10"},
                       {"Entry":"www.example.com","Data":"example.com"},
                       {"Entry":"9.113.0.203.in-addr.arpa","Data":"pool.minexmr.com"},
                       {"Entry":"intranet","Data":"10.0.0.1"}]"#;
        let names = parse_dns_client_cache(json);
        assert_eq!(names.len(), 2);
        assert_eq!(names[0].name, "pool.minexmr.com");
        assert_eq!(names[0].addresses, ["203.0.113.9", "203.0.113.10"]);
        assert!(
            names[1].addresses.is_empty(),
            "a CNAME target is no address"
        );

        // One record alone is not wrapped in an array by ConvertTo-Json.
        let one = parse_dns_client_cache(r#"{"Entry":"a.example.org","Data":"192.0.2.1"}"#);
        assert_eq!(one.len(), 1);
        assert!(parse_dns_client_cache("").is_empty());
    }

    #[test]
    fn the_number_of_names_is_bounded() {
        let many = (0..MAX_NAMES + 50).map(|i| (format!("host{i}.example.com"), None));
        assert_eq!(collect(many).len(), MAX_NAMES);
    }

    /// On the system running the tests the pass answers, covered or not,
    /// and "not covered" never comes with names.
    #[tokio::test]
    async fn a_pass_says_whether_names_are_covered() {
        let observation = observe_dns_names().await;
        match &observation.coverage {
            DnsNameCoverage::Covered { names, .. } => assert_eq!(*names, observation.names.len()),
            DnsNameCoverage::NotCovered { reason } => {
                assert!(observation.names.is_empty());
                assert!(!reason.is_empty());
            }
            DnsNameCoverage::Unknown => panic!("a pass always concludes"),
        }
        #[cfg(target_os = "macos")]
        assert_eq!(observation.coverage.code(), "not_covered");
    }
}
