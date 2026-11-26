// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Alert rules, evaluated on the incidents the agent raises, and their
//! delivery to the configured webhooks.
//!
//! The rules and the webhooks are stored and synchronised with the platform;
//! this module is what acts on them. Every incident the agent reports goes
//! through [`AlertDispatcher::dispatch`]:
//!
//! - the enabled rules are evaluated ([`rule_matches`]): a severity
//!   threshold, a list of incident types, or both;
//! - when at least one fires, each enabled webhook receives one message, in
//!   the format of its service;
//! - a webhook is not flooded: the same alert is sent to it once per
//!   [`SAME_ALERT_COOLDOWN`], and no more than [`BURST_LIMIT`] alerts per
//!   [`BURST_WINDOW`];
//! - a delivery waits at most [`REQUEST_TIMEOUT`] and is attempted up to
//!   [`MAX_ATTEMPTS`] times when the receiver cannot be reached or answers
//!   5xx or 429;
//! - the outcome is recorded with the webhook: the time of the last message
//!   sent, or the reason of the failure.
//!
//! Escalation rules ("not acknowledged after N minutes") are not evaluated:
//! the agent keeps no acknowledgement state for its incidents.

use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use agent_storage::Database;
use agent_storage::repositories::grc::{
    AlertRuleRepository, StoredAlertRule, StoredWebhook, WebhookRepository,
};
use chrono::{DateTime, Utc};
use tracing::{debug, info, warn};

/// Time one request to a webhook may take.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// Attempts made to deliver one message.
pub const MAX_ATTEMPTS: u32 = 3;

/// Wait before the second attempt; doubled before each one after it.
const RETRY_DELAY: Duration = Duration::from_secs(2);

/// Time during which the same alert is not sent again to a webhook.
pub const SAME_ALERT_COOLDOWN: Duration = Duration::from_secs(10 * 60);

/// Alerts a webhook receives at most within [`BURST_WINDOW`].
pub const BURST_LIMIT: usize = 20;

/// Window of [`BURST_LIMIT`].
pub const BURST_WINDOW: Duration = Duration::from_secs(10 * 60);

/// What a rule is evaluated on: an incident the agent raised.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AlertEvent {
    /// Incident type, as reported to the platform (`reverse_shell`).
    pub event_type: String,
    /// `critical`, `high`, `medium`, `low` or `info`.
    pub severity: String,
    pub title: String,
    pub description: String,
    pub detected_at: DateTime<Utc>,
}

impl From<&agent_scanner::SecurityIncident> for AlertEvent {
    fn from(incident: &agent_scanner::SecurityIncident) -> Self {
        Self {
            event_type: incident.incident_type.to_string(),
            severity: incident.severity.to_string(),
            title: incident.title.clone(),
            description: incident.description.clone(),
            detected_at: incident.detected_at,
        }
    }
}

/// Order of the severities; an unknown one counts as medium, as it does
/// where the rules are displayed.
fn severity_rank(severity: &str) -> u8 {
    match severity.to_ascii_lowercase().as_str() {
        "critical" => 4,
        "high" => 3,
        "low" => 1,
        "info" => 0,
        _ => 2,
    }
}

/// A type name reduced to its letters and digits: `ReverseShell`,
/// `reverse_shell` and `reverse-shell` are the same type.
fn type_key(name: &str) -> String {
    name.chars()
        .filter(char::is_ascii_alphanumeric)
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

/// Whether `rule` fires on `event`.
///
/// A rule carries a severity threshold, a list of incident types, or both;
/// the event must satisfy each condition the rule has. A rule with neither
/// never fires, nor does an escalation rule (see the module documentation).
pub fn rule_matches(rule: &StoredAlertRule, event: &AlertEvent) -> bool {
    if !rule.enabled || type_key(&rule.rule_type).starts_with("escalation") {
        return false;
    }
    let types: Vec<String> = serde_json::from_str(&rule.detection_types).unwrap_or_default();
    let threshold = rule.severity_threshold.as_deref();
    if types.is_empty() && threshold.is_none() {
        return false;
    }
    let severity_reached = threshold
        .is_none_or(|threshold| severity_rank(&event.severity) >= severity_rank(threshold));
    let type_listed = types.is_empty()
        || types
            .iter()
            .any(|t| type_key(t) == type_key(&event.event_type));
    severity_reached && type_listed
}

/// JSON body of an alert, shaped for the receiving service (Slack and Teams
/// reject a body without their own text field).
pub fn alert_payload(
    format: &str,
    event: &AlertEvent,
    rules: &[String],
    hostname: &str,
) -> serde_json::Value {
    let headline = format!(
        "[{}] {} ({})",
        event.severity.to_uppercase(),
        event.title,
        hostname
    );
    match format {
        "slack" => serde_json::json!({
            "text": format!("{headline}\n{}", event.description),
        }),
        "msteams" | "teams" => serde_json::json!({
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": headline,
            "themeColor": match severity_rank(&event.severity) {
                4 => "B91C1C",
                3 => "EA580C",
                2 => "CA8A04",
                _ => "2563EB",
            },
            "title": headline,
            "text": event.description,
        }),
        _ => serde_json::json!({
            "type": "alert",
            "severity": event.severity,
            "incident_type": event.event_type,
            "title": event.title,
            "description": event.description,
            "hostname": hostname,
            "rules": rules,
            "detected_at": event.detected_at.to_rfc3339(),
        }),
    }
}

/// What each webhook received lately.
#[derive(Default)]
struct Throttle {
    /// Last time an alert (webhook, type and title) was sent.
    last_same: HashMap<(String, String), Instant>,
    /// Times of the alerts sent to a webhook within the burst window.
    sent: HashMap<String, VecDeque<Instant>>,
}

impl Throttle {
    /// Whether `alert` may be sent to `webhook` at `now`; counts it if so.
    fn admit(&mut self, webhook: &str, alert: &str, now: Instant) -> bool {
        self.last_same
            .retain(|_, at| now.duration_since(*at) < SAME_ALERT_COOLDOWN);
        let key = (webhook.to_string(), alert.to_string());
        if self.last_same.contains_key(&key) {
            return false;
        }
        let window = self.sent.entry(webhook.to_string()).or_default();
        while window
            .front()
            .is_some_and(|at| now.duration_since(*at) >= BURST_WINDOW)
        {
            window.pop_front();
        }
        if window.len() >= BURST_LIMIT {
            return false;
        }
        window.push_back(now);
        self.last_same.insert(key, now);
        true
    }
}

/// Evaluates the alert rules and delivers the alerts.
pub struct AlertDispatcher {
    client: reqwest::Client,
    throttle: Mutex<Throttle>,
    retry_delay: Duration,
}

impl Default for AlertDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

impl AlertDispatcher {
    pub fn new() -> Self {
        // No redirects: a 30x towards an internal address is the classic
        // way around the destination check.
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap_or_default();
        Self {
            client,
            throttle: Mutex::new(Throttle::default()),
            retry_delay: RETRY_DELAY,
        }
    }

    /// Evaluate the rules on `event` and send it to the enabled webhooks
    /// when one fires. Returns the number of webhooks that received it.
    pub async fn dispatch(&self, db: &Database, event: &AlertEvent) -> usize {
        let rules = match AlertRuleRepository::new(db).get_all().await {
            Ok(rules) => rules,
            Err(e) => {
                warn!("Alert rules could not be read: {}", e);
                return 0;
            }
        };
        let fired: Vec<String> = rules
            .iter()
            .filter(|rule| rule_matches(rule, event))
            .map(|rule| rule.name.clone())
            .collect();
        if fired.is_empty() {
            return 0;
        }

        let repo = WebhookRepository::new(db);
        let webhooks = match repo.get_all().await {
            Ok(webhooks) => webhooks,
            Err(e) => {
                warn!("Webhooks could not be read: {}", e);
                return 0;
            }
        };
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());
        let alert_key = format!("{}|{}", event.event_type, event.title);

        let mut delivered = 0;
        for webhook in webhooks.iter().filter(|w| w.enabled) {
            let admitted = self
                .throttle
                .lock()
                .map(|mut throttle| throttle.admit(&webhook.id, &alert_key, Instant::now()))
                .unwrap_or(false);
            if !admitted {
                debug!(
                    "Alert '{}' not sent again to webhook '{}' (anti-burst)",
                    event.title, webhook.name
                );
                continue;
            }
            // The stored `events` column carries the format.
            let payload = alert_payload(&webhook.events, event, &fired, &hostname);
            let outcome = self.send(webhook, &payload).await;
            match &outcome {
                Ok(()) => {
                    delivered += 1;
                    info!(
                        "Alert '{}' sent to webhook '{}' (rules: {})",
                        event.title,
                        webhook.name,
                        fired.join(", ")
                    );
                }
                Err(reason) => warn!(
                    "Alert '{}' not delivered to webhook '{}': {}",
                    event.title, webhook.name, reason
                ),
            }
            if let Err(e) = repo
                .record_delivery(&webhook.id, Utc::now(), outcome.err())
                .await
            {
                warn!(
                    "Delivery status of webhook '{}' not recorded: {}",
                    webhook.name, e
                );
            }
        }
        delivered
    }

    /// Check the destination, then deliver.
    async fn send(
        &self,
        webhook: &StoredWebhook,
        payload: &serde_json::Value,
    ) -> Result<(), String> {
        agent_common::webhook::validate_webhook_url(&webhook.url)
            .map_err(|e| format!("destination refused: {e}"))?;
        self.deliver(&webhook.url, payload, webhook.secret.as_deref())
            .await
    }

    /// POST `payload` to `url`, again after a pause when the receiver could
    /// not be reached or answered 5xx or 429. With a secret, the body is
    /// signed: `X-Sentinel-Signature: sha256=<HMAC-SHA256 of the body>`.
    async fn deliver(
        &self,
        url: &str,
        payload: &serde_json::Value,
        secret: Option<&str>,
    ) -> Result<(), String> {
        let body = payload.to_string();
        let signature = secret
            .filter(|s| !s.is_empty())
            .and_then(|secret| sign(secret, &body));
        let mut last_error = String::new();
        for attempt in 0..MAX_ATTEMPTS {
            if attempt > 0 {
                tokio::time::sleep(self.retry_delay * 2u32.pow(attempt - 1)).await;
            }
            let mut request = self
                .client
                .post(url)
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(body.clone());
            if let Some(signature) = &signature {
                request = request.header("X-Sentinel-Signature", format!("sha256={signature}"));
            }
            match request.send().await {
                Ok(response) if response.status().is_success() => return Ok(()),
                Ok(response) => {
                    let status = response.status();
                    last_error = format!("HTTP {}", status.as_u16());
                    if !(status.is_server_error() || status.as_u16() == 429) {
                        break;
                    }
                }
                // Without the URL: it may carry the token of the receiver.
                Err(e) => last_error = e.without_url().to_string(),
            }
        }
        Err(last_error)
    }
}

/// Hex HMAC-SHA256 of `body` under `secret`.
fn sign(secret: &str, body: &str) -> Option<String> {
    use hmac::{Hmac, KeyInit, Mac};
    let mut mac = Hmac::<sha2::Sha256>::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(body.as_bytes());
    Some(hex::encode(mac.finalize().into_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::{DatabaseConfig, KeyManager};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn rule(rule_type: &str, threshold: Option<&str>, types: &[&str]) -> StoredAlertRule {
        StoredAlertRule {
            id: format!("rule-{rule_type}"),
            name: format!("{rule_type} rule"),
            rule_type: rule_type.to_string(),
            severity_threshold: threshold.map(str::to_string),
            detection_types: serde_json::to_string(types).unwrap(),
            escalation_minutes: None,
            enabled: true,
            created_at: Utc::now().to_rfc3339(),
            synced: false,
        }
    }

    fn event(event_type: &str, severity: &str) -> AlertEvent {
        AlertEvent {
            event_type: event_type.to_string(),
            severity: severity.to_string(),
            title: "Reverse shell detected".to_string(),
            description: "bash -i towards 203.0.113.9:4444".to_string(),
            detected_at: Utc::now(),
        }
    }

    #[test]
    fn a_severity_rule_fires_from_its_threshold_up() {
        let high = rule("SeverityThreshold", Some("high"), &[]);
        assert!(rule_matches(&high, &event("malware", "critical")));
        assert!(rule_matches(&high, &event("malware", "high")));
        assert!(!rule_matches(&high, &event("malware", "medium")));
        assert!(!rule_matches(&high, &event("malware", "low")));
    }

    #[test]
    fn a_type_rule_fires_on_its_types_however_they_are_written() {
        let types = rule("TypeFilter", None, &["ReverseShell", "crypto-miner"]);
        assert!(rule_matches(&types, &event("reverse_shell", "low")));
        assert!(rule_matches(&types, &event("crypto_miner", "low")));
        assert!(!rule_matches(&types, &event("malware", "critical")));

        // Both conditions when the rule has both.
        let both = rule("TypeFilter", Some("high"), &["reverse_shell"]);
        assert!(rule_matches(&both, &event("reverse_shell", "high")));
        assert!(!rule_matches(&both, &event("reverse_shell", "medium")));
    }

    #[test]
    fn disabled_empty_and_escalation_rules_never_fire() {
        let mut disabled = rule("SeverityThreshold", Some("low"), &[]);
        disabled.enabled = false;
        let empty = rule("TypeFilter", None, &[]);
        let escalation = rule("EscalationDelay", Some("low"), &[]);
        for never in [&disabled, &empty, &escalation] {
            assert!(!rule_matches(never, &event("malware", "critical")));
        }
    }

    #[test]
    fn each_service_gets_the_body_it_accepts() {
        let event = event("reverse_shell", "critical");
        let rules = vec!["Critical incidents".to_string()];

        let slack = alert_payload("slack", &event, &rules, "srv-01");
        assert!(slack["text"].as_str().unwrap().contains("[CRITICAL]"));
        assert!(slack["text"].as_str().unwrap().contains("srv-01"));

        let teams = alert_payload("msteams", &event, &rules, "srv-01");
        assert_eq!(teams["@type"], "MessageCard");
        assert_eq!(teams["text"], event.description);

        let generic = alert_payload("generic", &event, &rules, "srv-01");
        assert_eq!(generic["type"], "alert");
        assert_eq!(generic["incident_type"], "reverse_shell");
        assert_eq!(generic["rules"][0], "Critical incidents");
    }

    #[test]
    fn the_same_alert_is_sent_once_per_cooldown() {
        let mut throttle = Throttle::default();
        let start = Instant::now();
        assert!(throttle.admit("hook", "malware|x", start));
        assert!(!throttle.admit("hook", "malware|x", start + Duration::from_secs(60)));
        // Another alert, or another webhook, is not held back.
        assert!(throttle.admit("hook", "malware|y", start + Duration::from_secs(60)));
        assert!(throttle.admit("other", "malware|x", start + Duration::from_secs(60)));
        assert!(throttle.admit("hook", "malware|x", start + SAME_ALERT_COOLDOWN));
    }

    #[test]
    fn a_webhook_receives_a_bounded_number_of_alerts_per_window() {
        let mut throttle = Throttle::default();
        let start = Instant::now();
        for n in 0..BURST_LIMIT {
            assert!(throttle.admit("hook", &format!("alert {n}"), start));
        }
        assert!(!throttle.admit("hook", "one too many", start));
        assert!(throttle.admit("hook", "after the window", start + BURST_WINDOW));
    }

    /// Answer each connection with the next status of `statuses`; hands back
    /// the requests received.
    async fn receiver(statuses: Vec<u16>) -> (String, tokio::task::JoinHandle<Vec<String>>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/hook", listener.local_addr().unwrap());
        let handle = tokio::spawn(async move {
            let mut requests = Vec::new();
            for status in statuses {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut received = Vec::new();
                let mut buffer = [0u8; 4096];
                loop {
                    let read = socket.read(&mut buffer).await.unwrap();
                    received.extend_from_slice(&buffer[..read]);
                    let text = String::from_utf8_lossy(&received).to_string();
                    let complete = text.split_once("\r\n\r\n").is_some_and(|(head, body)| {
                        let expected = head
                            .lines()
                            .find_map(|line| {
                                let (name, value) = line.split_once(':')?;
                                name.eq_ignore_ascii_case("content-length")
                                    .then(|| value.trim().parse::<usize>().ok())?
                            })
                            .unwrap_or(0);
                        body.len() >= expected
                    });
                    if complete || read == 0 {
                        break;
                    }
                }
                let response = format!(
                    "HTTP/1.1 {status} X\r\ncontent-length: 0\r\nconnection: close\r\n\r\n"
                );
                socket.write_all(response.as_bytes()).await.unwrap();
                socket.shutdown().await.ok();
                requests.push(String::from_utf8_lossy(&received).to_string());
            }
            requests
        });
        (url, handle)
    }

    fn fast_dispatcher() -> AlertDispatcher {
        AlertDispatcher {
            retry_delay: Duration::from_millis(5),
            ..AlertDispatcher::new()
        }
    }

    #[tokio::test]
    async fn a_delivery_is_attempted_again_after_a_server_error() {
        let (url, server) = receiver(vec![503, 200]).await;
        let payload = serde_json::json!({ "type": "alert" });

        let outcome = fast_dispatcher()
            .deliver(&url, &payload, Some("s3cret"))
            .await;

        assert_eq!(outcome, Ok(()));
        let requests = server.await.unwrap();
        assert_eq!(requests.len(), 2);
        assert!(requests[1].starts_with("POST /hook"));
        assert!(
            requests[1]
                .to_lowercase()
                .contains("x-sentinel-signature: sha256=")
        );
        assert!(requests[1].ends_with("{\"type\":\"alert\"}"));
    }

    #[tokio::test]
    async fn a_refusal_is_final_and_attempts_are_bounded() {
        let (url, server) = receiver(vec![404]).await;
        let payload = serde_json::json!({});
        let outcome = fast_dispatcher().deliver(&url, &payload, None).await;
        assert_eq!(outcome, Err("HTTP 404".to_string()));
        assert_eq!(server.await.unwrap().len(), 1);

        let (url, server) = receiver(vec![500; MAX_ATTEMPTS as usize]).await;
        let outcome = fast_dispatcher().deliver(&url, &payload, None).await;
        assert_eq!(outcome, Err("HTTP 500".to_string()));
        assert_eq!(server.await.unwrap().len(), MAX_ATTEMPTS as usize);
    }

    fn webhook(id: &str, url: &str) -> StoredWebhook {
        StoredWebhook {
            id: id.to_string(),
            name: format!("webhook {id}"),
            url: url.to_string(),
            events: "generic".to_string(),
            secret: None,
            enabled: true,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
            synced: false,
        }
    }

    #[tokio::test]
    async fn a_firing_rule_reaches_the_webhooks_and_records_the_outcome() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::open(
            DatabaseConfig::with_path(dir.path().join("agent.db")),
            &KeyManager::new_with_key(&[7; 32]),
        )
        .unwrap();
        AlertRuleRepository::new(&db)
            .upsert(&rule("SeverityThreshold", Some("high"), &[]))
            .await
            .unwrap();
        let webhooks = WebhookRepository::new(&db);
        // Refused before any request: not https.
        webhooks
            .upsert(&webhook("plain", "http://siem.example/hook"))
            .await
            .unwrap();
        let mut disabled = webhook("off", "https://siem.example/hook");
        disabled.enabled = false;
        webhooks.upsert(&disabled).await.unwrap();
        let dispatcher = fast_dispatcher();

        // Below the threshold: no rule fires, nothing is attempted.
        let quiet = dispatcher.dispatch(&db, &event("malware", "low")).await;
        assert_eq!(quiet, 0);
        assert!(webhooks.delivery_status().await.unwrap().is_empty());

        let delivered = dispatcher
            .dispatch(&db, &event("malware", "critical"))
            .await;

        assert_eq!(delivered, 0);
        let status = webhooks.delivery_status().await.unwrap();
        assert_eq!(status.len(), 1, "the disabled webhook is left alone");
        let plain = &status["plain"];
        assert_eq!(plain.last_sent, None);
        assert!(
            plain
                .last_error
                .as_deref()
                .unwrap()
                .contains("destination refused")
        );
    }
}
