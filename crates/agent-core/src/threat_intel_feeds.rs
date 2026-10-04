// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Indicator-of-compromise feeds for the network detector.
//!
//! The platform can push threat intelligence through configuration sync, but
//! a standalone agent has no platform, and an organisation may run its own
//! intelligence source (MISP, OpenCTI, a TAXII server). The feeds declared in
//! `threat_intel_feeds` are downloaded on their own schedule and their
//! malicious addresses and domains are added to what the detector knows.
//!
//! # Formats
//!
//! - `text`: one indicator per line (address, domain or URL), `#` comments,
//!   CSV and hosts-file layouts accepted. Covers most public block lists and
//!   MISP's text export.
//! - `stix`: a STIX 2.1 bundle. `indicator` objects with a STIX pattern are
//!   read; revoked or expired ones are left out.
//! - `taxii`: the objects endpoint of a TAXII 2.1 collection, paginated.
//!
//! # Guarantees
//!
//! - Nothing about the host is sent: feeds are downloaded whole.
//! - Addresses that are not publicly routable (private, loopback,
//!   link-local…) are refused, so a feed cannot flag the local network.
//! - A feed that fails keeps the indicators of its last successful download,
//!   which are also kept on disk for the next start.

use agent_common::config::{AgentConfig, ThreatIntelFeed, ThreatIntelFeedFormat};
use agent_network::ThreatIntelligence;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tracing::{debug, info, warn};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
/// Largest response accepted from a feed.
const MAX_FEED_BYTES: usize = 64 * 1024 * 1024;
/// Indicators kept per feed.
const MAX_INDICATORS_PER_FEED: usize = 500_000;
/// TAXII pages followed for one collection.
const MAX_TAXII_PAGES: usize = 50;
const MIN_REFRESH_HOURS: u64 = 1;
/// How often the background task wakes up to see whether a feed is due.
const SCHEDULER_TICK: Duration = Duration::from_secs(60);

/// `ipv4-addr:value = '198.51.100.7'` and the like inside a STIX pattern.
static STIX_COMPARISON: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(ipv4-addr|ipv6-addr|domain-name|url):value\s*=\s*'([^']+)'")
        .expect("static pattern is valid")
});

/// Malicious addresses and domains of one feed.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Indicators {
    pub ips: BTreeSet<String>,
    pub domains: BTreeSet<String>,
}

impl Indicators {
    pub fn len(&self) -> usize {
        self.ips.len() + self.domains.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    fn is_full(&self) -> bool {
        self.len() >= MAX_INDICATORS_PER_FEED
    }

    /// Add one raw indicator (address, `address:port`, domain or URL).
    /// Returns whether it was accepted.
    pub fn add(&mut self, raw: &str) -> bool {
        if self.is_full() {
            return false;
        }
        let Some(host) = host_of(raw) else {
            return false;
        };
        if let Ok(ip) = host.parse::<IpAddr>() {
            return is_public_address(ip) && self.ips.insert(ip.to_string());
        }
        match normalize_domain(&host) {
            Some(domain) => self.domains.insert(domain),
            None => false,
        }
    }

    fn merge(&mut self, other: &Indicators) {
        self.ips.extend(other.ips.iter().cloned());
        self.domains.extend(other.domains.iter().cloned());
    }
}

/// Host part of an indicator: strips a URL scheme, path and port.
fn host_of(raw: &str) -> Option<String> {
    let value = raw.trim().trim_matches(['"', '\'']);
    if value.is_empty() {
        return None;
    }
    if value.contains("://") {
        let url = url::Url::parse(value).ok()?;
        return url
            .host_str()
            .map(|host| host.trim_matches(['[', ']']).to_string());
    }
    // A bare IPv6 address holds colons that are not a port separator.
    if value.parse::<IpAddr>().is_ok() {
        return Some(value.to_string());
    }
    let value = value.split('/').next().unwrap_or(value);
    let host = match value.rsplit_once(':') {
        Some((host, port)) if !port.is_empty() && port.bytes().all(|b| b.is_ascii_digit()) => host,
        _ => value,
    };
    Some(host.trim_matches(['[', ']']).to_string())
}

/// Whether an address can be met on the Internet. A feed listing a private
/// or local address would flag the organisation's own traffic.
fn is_public_address(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let octets = v4.octets();
            let shared = octets[0] == 100 && (64..=127).contains(&octets[1]); // 100.64/10
            let reserved = octets[0] >= 240; // 240/4 and broadcast
            !(v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_multicast()
                || shared
                || reserved)
        }
        IpAddr::V6(v6) => {
            let first = v6.segments()[0];
            let unique_local = first & 0xfe00 == 0xfc00; // fc00::/7
            let link_local = first & 0xffc0 == 0xfe80; // fe80::/10
            !(v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || unique_local
                || link_local)
        }
    }
}

/// Lower-case a domain and check it is one (labels of letters, digits and
/// hyphens, at least two of them).
fn normalize_domain(raw: &str) -> Option<String> {
    let domain = raw.trim().trim_end_matches('.').to_ascii_lowercase();
    let valid_label = |label: &str| {
        !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    };
    let labels: Vec<&str> = domain.split('.').collect();
    let valid = domain.len() <= 253
        && labels.len() >= 2
        && labels.iter().all(|label| valid_label(label))
        // The last label of a name is never all digits (that is an address).
        && labels.last().is_some_and(|tld| !tld.bytes().all(|b| b.is_ascii_digit()));
    valid.then_some(domain)
}

/// Parse a plain list: one indicator per line, `#` comments. For CSV lines
/// the first field is used; for hosts-file lines (`0.0.0.0 bad.example`) the
/// name after the sink address.
pub fn parse_text(body: &str) -> Indicators {
    let mut indicators = Indicators::default();
    for line in body.lines() {
        let line = line.split('#').next().unwrap_or("").trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with("//") {
            continue;
        }
        let mut fields = line
            .split(|c: char| c.is_whitespace() || c == ',' || c == ';')
            .filter(|field| !field.is_empty());
        let Some(first) = fields.next() else {
            continue;
        };
        let value = match first {
            "0.0.0.0" | "127.0.0.1" | "::" | "::1" => fields.next().unwrap_or(first),
            _ => first,
        };
        indicators.add(value);
        if indicators.is_full() {
            break;
        }
    }
    indicators
}

/// Read the indicators of a list of STIX objects into `indicators`.
fn add_stix_objects(
    objects: &[serde_json::Value],
    now: chrono::DateTime<chrono::Utc>,
    indicators: &mut Indicators,
) {
    for object in objects {
        if object.get("type").and_then(|v| v.as_str()) != Some("indicator") {
            continue;
        }
        if object.get("revoked").and_then(|v| v.as_bool()) == Some(true) {
            continue;
        }
        // Other pattern languages (Sigma, YARA, Snort…) are not addresses.
        let pattern_type = object.get("pattern_type").and_then(|v| v.as_str());
        if pattern_type.is_some_and(|kind| !kind.eq_ignore_ascii_case("stix")) {
            continue;
        }
        let expired = object
            .get("valid_until")
            .and_then(|v| v.as_str())
            .and_then(|until| chrono::DateTime::parse_from_rfc3339(until).ok())
            .is_some_and(|until| until <= now);
        if expired {
            continue;
        }
        let Some(pattern) = object.get("pattern").and_then(|v| v.as_str()) else {
            continue;
        };
        for comparison in STIX_COMPARISON.captures_iter(pattern) {
            indicators.add(&comparison[2]);
        }
        if indicators.is_full() {
            break;
        }
    }
}

/// Parse a STIX 2.1 bundle, or a TAXII envelope (same `objects` array).
pub fn parse_stix(
    body: &str,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<(Indicators, Option<String>), String> {
    let document: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("invalid STIX document: {e}"))?;
    let objects = document
        .get("objects")
        .and_then(|v| v.as_array())
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let mut indicators = Indicators::default();
    add_stix_objects(objects, now, &mut indicators);
    // TAXII: more pages follow when `more` is true.
    let next = (document.get("more").and_then(|v| v.as_bool()) == Some(true))
        .then(|| document.get("next").and_then(|v| v.as_str()))
        .flatten()
        .map(str::to_string);
    Ok((indicators, next))
}

/// A feed address is accepted over HTTPS only (plain HTTP on the loopback
/// interface, for a local relay).
pub fn validate_feed_url(raw: &str) -> Result<url::Url, String> {
    let url = url::Url::parse(raw.trim()).map_err(|e| format!("invalid address: {e}"))?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    match url.scheme() {
        "https" => Ok(url),
        "http" if local => Ok(url),
        other => Err(format!(
            "address must use https (got {other}); a feed fetched in clear text could be altered in transit"
        )),
    }
}

/// Feeds that can be used: named, with a valid address, each name once.
/// The others are reported and left out.
pub fn usable_feeds(feeds: &[ThreatIntelFeed]) -> Vec<ThreatIntelFeed> {
    let mut usable: Vec<ThreatIntelFeed> = Vec::new();
    for feed in feeds {
        let name = feed.name.trim();
        if name.is_empty() {
            warn!(
                "Threat intelligence feed without a name ignored ({})",
                feed.url
            );
        } else if usable.iter().any(|known| known.name == name) {
            warn!(
                "Threat intelligence feed '{}' is declared twice: second one ignored",
                name
            );
        } else if let Err(reason) = validate_feed_url(&feed.url) {
            warn!("Threat intelligence feed '{}' ignored: {}", name, reason);
        } else {
            usable.push(ThreatIntelFeed {
                name: name.to_string(),
                ..feed.clone()
            });
        }
    }
    usable
}

/// Download one response body, with a size cap.
async fn get(
    client: &reqwest::Client,
    url: url::Url,
    accept: &str,
    authorization: Option<&str>,
) -> Result<String, String> {
    let mut request = client.get(url).header(reqwest::header::ACCEPT, accept);
    if let Some(authorization) = authorization.filter(|value| !value.trim().is_empty()) {
        request = request.header(reqwest::header::AUTHORIZATION, authorization.trim());
    }
    let mut response = request
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP {status}"));
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("network error: {e}"))?
    {
        if body.len().saturating_add(chunk.len()) > MAX_FEED_BYTES {
            return Err("feed is larger than accepted".to_string());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&body).into_owned())
}

/// Download and parse one feed.
pub async fn fetch_feed(
    client: &reqwest::Client,
    feed: &ThreatIntelFeed,
) -> Result<Indicators, String> {
    let url = validate_feed_url(&feed.url)?;
    let authorization = feed.authorization.as_deref();
    match feed.format {
        ThreatIntelFeedFormat::Text => {
            let body = get(client, url, "text/plain, text/csv, */*", authorization).await?;
            Ok(parse_text(&body))
        }
        ThreatIntelFeedFormat::Stix => {
            let body = get(
                client,
                url,
                "application/stix+json;version=2.1, application/json",
                authorization,
            )
            .await?;
            parse_stix(&body, chrono::Utc::now()).map(|(indicators, _)| indicators)
        }
        ThreatIntelFeedFormat::Taxii => {
            let mut indicators = Indicators::default();
            let mut next: Option<String> = None;
            for _ in 0..MAX_TAXII_PAGES {
                let mut page_url = url.clone();
                {
                    let mut query = page_url.query_pairs_mut();
                    query.append_pair("match[type]", "indicator");
                    if let Some(token) = &next {
                        query.append_pair("next", token);
                    }
                }
                let body = get(
                    client,
                    page_url,
                    "application/taxii+json;version=2.1",
                    authorization,
                )
                .await?;
                let (page, following) = parse_stix(&body, chrono::Utc::now())?;
                indicators.merge(&page);
                next = following;
                if next.is_none() || indicators.is_full() {
                    break;
                }
            }
            Ok(indicators)
        }
    }
}

/// Last known indicators of every feed, as kept on disk.
#[derive(Debug, Default, Serialize, Deserialize)]
struct FeedCache {
    #[serde(default)]
    feeds: BTreeMap<String, CachedFeed>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct CachedFeed {
    /// Unix time (seconds) of the last successful download.
    fetched_at: i64,
    indicators: Indicators,
}

fn cache_path() -> PathBuf {
    AgentConfig::platform_data_dir()
        .join("cache")
        .join("threat-intel")
        .join("feeds.json")
}

async fn load_cache(path: &Path) -> FeedCache {
    match tokio::fs::read(path).await {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => FeedCache::default(),
    }
}

async fn store_cache(path: &Path, cache: &FeedCache) {
    let write = async {
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        let mut tmp = path.as_os_str().to_owned();
        tmp.push(".tmp");
        let tmp = PathBuf::from(tmp);
        tokio::fs::write(&tmp, serde_json::to_vec(cache)?).await?;
        tokio::fs::rename(&tmp, path).await
    };
    if let Err(e) = write.await {
        warn!("Failed to save threat intelligence feeds: {}", e);
    }
}

/// Indicators of the configured feeds only (a feed removed from the
/// configuration stops contributing), as threat intelligence.
fn intel_of(cache: &FeedCache, feeds: &[ThreatIntelFeed]) -> ThreatIntelligence {
    let mut merged = Indicators::default();
    let mut last_updated = None;
    for feed in feeds {
        if let Some(cached) = cache.feeds.get(&feed.name) {
            merged.merge(&cached.indicators);
            last_updated = last_updated.max(Some(cached.fetched_at));
        }
    }
    ThreatIntelligence {
        malicious_ips: merged.ips.into_iter().collect(),
        malicious_domains: merged.domains.into_iter().collect(),
        c2_ports: Vec::new(),
        mining_pools: Vec::new(),
        last_updated: last_updated.and_then(|secs| chrono::DateTime::from_timestamp(secs, 0)),
    }
}

/// Union of what the platform pushed and what the feeds provide.
pub fn merge_intel(
    platform: Option<&ThreatIntelligence>,
    feeds: Option<&ThreatIntelligence>,
) -> ThreatIntelligence {
    let mut ips = BTreeSet::new();
    let mut domains = BTreeSet::new();
    let mut ports = BTreeSet::new();
    let mut pools = BTreeSet::new();
    let mut last_updated = None;
    for intel in [platform, feeds].into_iter().flatten() {
        ips.extend(intel.malicious_ips.iter().cloned());
        domains.extend(intel.malicious_domains.iter().cloned());
        ports.extend(intel.c2_ports.iter().copied());
        pools.extend(intel.mining_pools.iter().cloned());
        last_updated = last_updated.max(intel.last_updated);
    }
    ThreatIntelligence {
        malicious_ips: ips.into_iter().collect(),
        malicious_domains: domains.into_iter().collect(),
        c2_ports: ports.into_iter().collect(),
        mining_pools: pools.into_iter().collect(),
        last_updated,
    }
}

/// Whether a feed is due: never downloaded, or older than its refresh period.
fn is_due(cache: &FeedCache, feed: &ThreatIntelFeed, now: i64) -> bool {
    let refresh_secs = i64::try_from(
        feed.refresh_hours
            .max(MIN_REFRESH_HOURS)
            .saturating_mul(3600),
    )
    .unwrap_or(i64::MAX);
    cache
        .feeds
        .get(&feed.name)
        .is_none_or(|cached| now.saturating_sub(cached.fetched_at) >= refresh_secs)
}

/// Slot the background task leaves fresh intelligence in, for the main loop
/// to apply.
pub type PendingIntel = Arc<Mutex<Option<ThreatIntelligence>>>;

/// Keep the configured feeds up to date until shutdown.
///
/// The last indicators kept on disk are published at once, then each feed is
/// downloaded when due. A failed download is retried at the next tick of its
/// period and keeps the previous indicators meanwhile.
pub async fn run(
    feeds: Vec<ThreatIntelFeed>,
    pending: PendingIntel,
    shutdown: Arc<std::sync::atomic::AtomicBool>,
) {
    let client = match reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .user_agent("sentinel-grc-agent")
        .build()
    {
        Ok(client) => client,
        Err(e) => {
            warn!("Threat intelligence feeds disabled: {}", e);
            return;
        }
    };
    let path = cache_path();
    let mut cache = load_cache(&path).await;
    let publish = |cache: &FeedCache| {
        let intel = intel_of(cache, &feeds);
        *pending.lock().unwrap_or_else(|e| e.into_inner()) = Some(intel);
    };
    if feeds
        .iter()
        .any(|feed| cache.feeds.contains_key(&feed.name))
    {
        publish(&cache);
    }

    // After a failure, wait a full tick cycle of the feed before retrying.
    let mut retry_after: BTreeMap<String, i64> = BTreeMap::new();
    while !shutdown.load(std::sync::atomic::Ordering::Acquire) {
        let now = chrono::Utc::now().timestamp();
        let mut changed = false;
        for feed in &feeds {
            let waiting = retry_after
                .get(&feed.name)
                .is_some_and(|until| now < *until);
            if waiting || !is_due(&cache, feed, now) {
                continue;
            }
            match fetch_feed(&client, feed).await {
                Ok(indicators) => {
                    info!(
                        "Threat intelligence feed '{}': {} addresses, {} domains",
                        feed.name,
                        indicators.ips.len(),
                        indicators.domains.len()
                    );
                    cache.feeds.insert(
                        feed.name.clone(),
                        CachedFeed {
                            fetched_at: now,
                            indicators,
                        },
                    );
                    retry_after.remove(&feed.name);
                    changed = true;
                }
                Err(e) => {
                    warn!(
                        "Threat intelligence feed '{}' not refreshed ({}): keeping its last indicators",
                        feed.name, e
                    );
                    retry_after.insert(feed.name.clone(), now.saturating_add(3600));
                }
            }
        }
        if changed {
            store_cache(&path, &cache).await;
            publish(&cache);
        }
        tokio::time::sleep(SCHEDULER_TICK).await;
    }
    debug!("Threat intelligence feed task stopped");
}

impl crate::AgentRuntime {
    /// Give the network detector the union of the platform's intelligence
    /// and the feeds'.
    pub(crate) async fn apply_threat_intel(&self) {
        let platform = self.platform_threat_intel.read().await.clone();
        let feeds = self.feed_threat_intel.read().await.clone();
        let merged = merge_intel(platform.as_ref(), feeds.as_ref());
        info!(
            "Threat intelligence in use: {} addresses, {} domains",
            merged.malicious_ips.len(),
            merged.malicious_domains.len()
        );
        self.network_manager
            .write()
            .await
            .update_threat_intel(merged);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(items: &[&str]) -> BTreeSet<String> {
        items.iter().map(|item| (*item).to_string()).collect()
    }

    #[test]
    fn indicators_are_classified_and_normalised() {
        let mut indicators = Indicators::default();
        assert!(indicators.add("198.51.100.7:8443"), "port stripped");
        assert!(indicators.add("https://Evil.Example.com/path?q=1"));
        assert!(indicators.add("http://203.0.113.9:8080/gate.php"));
        assert!(indicators.add("bad-domain.example."));
        assert!(indicators.add("2001:db8::200e"));
        assert!(indicators.add("[2001:db8::2003]:443"));
        assert!(!indicators.add("198.51.100.7"), "already known");

        assert_eq!(
            indicators.ips,
            set(&[
                "198.51.100.7",
                "203.0.113.9",
                "2001:db8::2003",
                "2001:db8::200e"
            ])
        );
        assert_eq!(
            indicators.domains,
            set(&["bad-domain.example", "evil.example.com"])
        );
    }

    #[test]
    fn local_addresses_and_non_indicators_are_refused() {
        let mut indicators = Indicators::default();
        for local in [
            "10.0.0.5",
            "192.168.1.1",
            "172.16.4.4",
            "127.0.0.1",
            "169.254.1.1",
            "0.0.0.0",
            "100.64.0.1",
            "224.0.0.1",
            "255.255.255.255",
            "::1",
            "fe80::1",
            "fd00::1",
        ] {
            assert!(!indicators.add(local), "{local} must be refused");
        }
        for junk in [
            "",
            "   ",
            "localhost",
            "not a domain",
            "-bad.example",
            "999.1.1.1",
            "a..b",
        ] {
            assert!(!indicators.add(junk), "{junk:?} must be refused");
        }
        assert!(indicators.is_empty());
    }

    #[test]
    fn text_feeds_accept_lists_csv_and_hosts_files() {
        let body = "# Feodo Tracker\n\
                    198.51.100.7\n\
                    203.0.113.9,2026-10-01,Emotet\n\
                    \n\
                    0.0.0.0 tracker.bad.example   # hosts-file layout\n\
                    127.0.0.1\tads.bad.example\n\
                    ; a comment\n\
                    // another\n\
                    first_seen,dst_ip\n\
                    10.1.2.3\n\
                    https://c2.bad.example/login\n";
        let indicators = parse_text(body);
        assert_eq!(indicators.ips, set(&["198.51.100.7", "203.0.113.9"]));
        assert_eq!(
            indicators.domains,
            set(&["ads.bad.example", "c2.bad.example", "tracker.bad.example"])
        );
    }

    const STIX_BUNDLE: &str = r#"{
        "type": "bundle",
        "id": "bundle--1",
        "more": true,
        "next": "page-2",
        "objects": [
            { "type": "indicator", "pattern_type": "stix",
              "pattern": "[ipv4-addr:value = '198.51.100.7' OR ipv4-addr:value = '203.0.113.9']" },
            { "type": "indicator",
              "pattern": "[domain-name:value = 'C2.Bad.Example'] AND [url:value = 'http://drop.bad.example/x.bin']" },
            { "type": "indicator", "revoked": true,
              "pattern": "[ipv4-addr:value = '198.51.100.99']" },
            { "type": "indicator", "valid_until": "2020-01-01T00:00:00Z",
              "pattern": "[ipv4-addr:value = '198.51.100.98']" },
            { "type": "indicator", "valid_until": "2099-01-01T00:00:00Z",
              "pattern": "[ipv6-addr:value = '2001:db8::200e']" },
            { "type": "indicator", "pattern_type": "yara",
              "pattern": "rule x { strings: $a = \"ipv4-addr:value = '198.51.100.97'\" condition: $a }" },
            { "type": "indicator",
              "pattern": "[file:hashes.'SHA-256' = 'aaaa'] OR [ipv4-addr:value = '10.0.0.1']" },
            { "type": "malware", "name": "ipv4-addr:value = '198.51.100.96'" }
        ]
    }"#;

    #[test]
    fn stix_indicators_skip_revoked_expired_and_foreign_patterns() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-10-04T00:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let (indicators, next) = parse_stix(STIX_BUNDLE, now).unwrap();
        assert_eq!(
            indicators.ips,
            set(&["198.51.100.7", "203.0.113.9", "2001:db8::200e"])
        );
        assert_eq!(
            indicators.domains,
            set(&["c2.bad.example", "drop.bad.example"])
        );
        assert_eq!(next.as_deref(), Some("page-2"), "TAXII envelope pagination");

        let (empty, next) = parse_stix(r#"{ "type": "bundle" }"#, now).unwrap();
        assert!(empty.is_empty() && next.is_none());
        assert!(parse_stix("<html>login</html>", now).is_err());
    }

    #[test]
    fn feed_addresses_must_be_encrypted() {
        assert!(validate_feed_url("https://feeds.example/ioc.txt").is_ok());
        assert!(validate_feed_url("http://localhost:8080/ioc.txt").is_ok());
        assert!(validate_feed_url("http://127.0.0.1/ioc.txt").is_ok());
        assert!(
            validate_feed_url("http://feeds.example/ioc.txt")
                .unwrap_err()
                .contains("https")
        );
        assert!(validate_feed_url("file:///etc/passwd").is_err());
        assert!(validate_feed_url("not a url").is_err());
    }

    fn feed(name: &str, refresh_hours: u64) -> ThreatIntelFeed {
        ThreatIntelFeed {
            name: name.to_string(),
            url: format!("https://feeds.example/{name}"),
            format: ThreatIntelFeedFormat::Text,
            authorization: None,
            refresh_hours,
        }
    }

    fn cached(fetched_at: i64, ips: &[&str], domains: &[&str]) -> CachedFeed {
        CachedFeed {
            fetched_at,
            indicators: Indicators {
                ips: set(ips),
                domains: set(domains),
            },
        }
    }

    #[test]
    fn unusable_feed_declarations_are_left_out() {
        let mut clear_text = feed("clear", 12);
        clear_text.url = "http://feeds.example/ioc.txt".to_string();
        let mut unnamed = feed("x", 12);
        unnamed.name = "  ".to_string();
        let mut padded = feed("padded", 12);
        padded.name = " padded ".to_string();

        let usable = usable_feeds(&[feed("a", 12), clear_text, unnamed, feed("a", 6), padded]);
        let names: Vec<&str> = usable.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, ["a", "padded"]);
        assert_eq!(usable[0].refresh_hours, 12, "the first declaration wins");
    }

    #[test]
    fn a_feed_is_due_when_new_or_older_than_its_period() {
        let mut cache = FeedCache::default();
        let daily = feed("daily", 24);
        assert!(is_due(&cache, &daily, 1_000_000), "never downloaded");

        cache
            .feeds
            .insert("daily".to_string(), cached(1_000_000, &[], &[]));
        assert!(!is_due(&cache, &daily, 1_000_000 + 23 * 3600));
        assert!(is_due(&cache, &daily, 1_000_000 + 24 * 3600));
        // A period of zero is raised to one hour.
        cache
            .feeds
            .insert("eager".to_string(), cached(1_000_000, &[], &[]));
        assert!(!is_due(&cache, &feed("eager", 0), 1_000_000 + 1800));
        assert!(is_due(&cache, &feed("eager", 0), 1_000_000 + 3600));
    }

    #[test]
    fn only_configured_feeds_contribute() {
        let mut cache = FeedCache::default();
        cache.feeds.insert(
            "kept".to_string(),
            cached(2_000, &["198.51.100.7"], &["bad.example"]),
        );
        cache
            .feeds
            .insert("removed".to_string(), cached(3_000, &["203.0.113.9"], &[]));

        let intel = intel_of(&cache, &[feed("kept", 12), feed("never-fetched", 12)]);
        assert_eq!(intel.malicious_ips, ["198.51.100.7"]);
        assert_eq!(intel.malicious_domains, ["bad.example"]);
        assert_eq!(intel.last_updated.map(|t| t.timestamp()), Some(2_000));
    }

    #[test]
    fn platform_and_feed_intelligence_are_united() {
        let platform = ThreatIntelligence {
            malicious_ips: vec!["198.51.100.7".into(), "198.51.100.8".into()],
            malicious_domains: vec!["platform.bad.example".into()],
            c2_ports: vec![4444],
            mining_pools: vec!["pool.example".into()],
            last_updated: chrono::DateTime::from_timestamp(5_000, 0),
        };
        let feeds = ThreatIntelligence {
            malicious_ips: vec!["198.51.100.7".into(), "203.0.113.9".into()],
            malicious_domains: vec!["feed.bad.example".into()],
            c2_ports: Vec::new(),
            mining_pools: Vec::new(),
            last_updated: chrono::DateTime::from_timestamp(9_000, 0),
        };

        let merged = merge_intel(Some(&platform), Some(&feeds));
        assert_eq!(
            merged.malicious_ips,
            ["198.51.100.7", "198.51.100.8", "203.0.113.9"]
        );
        assert_eq!(
            merged.malicious_domains,
            ["feed.bad.example", "platform.bad.example"]
        );
        assert_eq!(merged.c2_ports, [4444]);
        assert_eq!(merged.mining_pools, ["pool.example"]);
        assert_eq!(merged.last_updated.map(|t| t.timestamp()), Some(9_000));

        let only_platform = merge_intel(Some(&platform), None);
        assert_eq!(only_platform.malicious_ips.len(), 2);
        assert!(merge_intel(None, None).malicious_ips.is_empty());
    }

    #[tokio::test]
    async fn cache_survives_a_round_trip_on_disk() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("feeds.json");
        assert!(load_cache(&path).await.feeds.is_empty());

        let mut cache = FeedCache::default();
        cache.feeds.insert(
            "kept".to_string(),
            cached(2_000, &["198.51.100.7"], &["bad.example"]),
        );
        store_cache(&path, &cache).await;

        let reloaded = load_cache(&path).await;
        assert_eq!(reloaded.feeds["kept"].fetched_at, 2_000);
        assert_eq!(
            reloaded.feeds["kept"].indicators.ips,
            set(&["198.51.100.7"])
        );

        tokio::fs::write(&path, b"corrupt").await.unwrap();
        assert!(load_cache(&path).await.feeds.is_empty());
    }
}
