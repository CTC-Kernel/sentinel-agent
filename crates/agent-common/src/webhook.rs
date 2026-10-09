// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Webhook destinations: URL validation and per-format test payloads.
//!
//! A webhook receives security alerts and is called by the agent, which
//! often runs with elevated rights inside the network. The URL is therefore
//! checked the same way wherever it enters — the settings form, the save
//! command and the test request:
//!
//! - HTTPS only: alerts carry host names, users and indicators;
//! - no credentials in the URL, where they end up in logs and exports;
//! - no loopback, link-local, multicast or cloud metadata destination, the
//!   usual server-side request forgery targets. Private ranges stay allowed
//!   for an on-premises SIEM.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

/// Host names that resolve to instance metadata services or to this host.
const FORBIDDEN_HOSTS: &[&str] = &[
    "localhost",
    "metadata",
    "metadata.google.internal",
    "metadata.azure.internal",
    "instance-data",
    "instance-data.ec2.internal",
];

/// Why a webhook URL is refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WebhookUrlError {
    Empty,
    Unparseable,
    NotHttps,
    Credentials,
    MissingHost,
    ForbiddenHost(String),
}

impl WebhookUrlError {
    /// Operator-facing explanation, in French.
    pub fn message_fr(&self) -> String {
        match self {
            Self::Empty => "Saisissez l'URL du webhook.".to_string(),
            Self::Unparseable => "Cette URL n'est pas valide.".to_string(),
            Self::NotHttps => {
                "Utilisez une URL en https:// : les alertes contiennent des données de sécurité."
                    .to_string()
            }
            Self::Credentials => {
                "Retirez l'identifiant et le mot de passe de l'URL ; utilisez le jeton prévu par \
                 le service destinataire."
                    .to_string()
            }
            Self::MissingHost => "L'URL doit indiquer un serveur destinataire.".to_string(),
            Self::ForbiddenHost(host) => format!(
                "« {host} » désigne ce poste ou un service interne (métadonnées cloud, adresse \
                 locale) : destination refusée."
            ),
        }
    }
}

impl std::fmt::Display for WebhookUrlError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message_fr())
    }
}

impl std::error::Error for WebhookUrlError {}

/// Check a webhook URL and return it parsed.
pub fn validate_webhook_url(raw: &str) -> Result<url::Url, WebhookUrlError> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Err(WebhookUrlError::Empty);
    }
    let url = url::Url::parse(raw).map_err(|_| WebhookUrlError::Unparseable)?;
    if url.scheme() != "https" {
        return Err(WebhookUrlError::NotHttps);
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(WebhookUrlError::Credentials);
    }
    match url.host() {
        None => Err(WebhookUrlError::MissingHost),
        Some(url::Host::Domain(domain)) => {
            let domain = domain.trim_end_matches('.').to_ascii_lowercase();
            if FORBIDDEN_HOSTS.contains(&domain.as_str()) || domain.ends_with(".localhost") {
                Err(WebhookUrlError::ForbiddenHost(domain))
            } else {
                Ok(url)
            }
        }
        Some(url::Host::Ipv4(ip)) => check_ip(IpAddr::V4(ip)).map(|()| url),
        Some(url::Host::Ipv6(ip)) => check_ip(IpAddr::V6(ip)).map(|()| url),
    }
}

/// Refuse addresses that point back at this host or at link-local services.
fn check_ip(ip: IpAddr) -> Result<(), WebhookUrlError> {
    let forbidden = match ip {
        IpAddr::V4(v4) => forbidden_v4(v4),
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => forbidden_v4(v4),
            None => forbidden_v6(v6),
        },
    };
    if forbidden {
        Err(WebhookUrlError::ForbiddenHost(ip.to_string()))
    } else {
        Ok(())
    }
}

fn forbidden_v4(ip: Ipv4Addr) -> bool {
    ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_link_local() // 169.254.0.0/16, including 169.254.169.254
        || ip.is_multicast()
        || ip.is_broadcast()
}

fn forbidden_v6(ip: Ipv6Addr) -> bool {
    // fe80::/10 link-local; `is_unicast_link_local` is not stable.
    let link_local = (ip.segments()[0] & 0xffc0) == 0xfe80;
    ip.is_loopback() || ip.is_unspecified() || ip.is_multicast() || link_local
}

/// JSON body of a test message, shaped for the receiving service: Slack and
/// Teams reject a body without their own text field, which made every test
/// of those webhooks fail.
pub fn test_payload(format: &str, timestamp_rfc3339: &str) -> serde_json::Value {
    let text = "Sentinel : message de test du webhook. Aucune action n'est requise.";
    match format {
        "slack" => serde_json::json!({ "text": text }),
        "msteams" | "teams" => serde_json::json!({
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": "Test du webhook Sentinel",
            "themeColor": "6D28D9",
            "title": "Test du webhook Sentinel",
            "text": text,
        }),
        _ => serde_json::json!({
            "type": "test",
            "message": text,
            "timestamp": timestamp_rfc3339,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_https_services_and_private_receivers() {
        for url in [
            "https://hooks.slack.com/services/T0/B0/secret",
            "https://outlook.office.com/webhook/abc",
            "https://splunk.ctc.local:8088/services/collector",
            "https://10.0.4.12/hook",
            "https://[2001:db8::1]/hook",
        ] {
            assert!(validate_webhook_url(url).is_ok(), "{url}");
        }
    }

    #[test]
    fn refuses_cleartext_credentials_and_internal_targets() {
        assert_eq!(validate_webhook_url("  "), Err(WebhookUrlError::Empty));
        assert_eq!(
            validate_webhook_url("hooks.slack.com"),
            Err(WebhookUrlError::Unparseable)
        );
        assert_eq!(
            validate_webhook_url("http://siem.example.org/hook"),
            Err(WebhookUrlError::NotHttps)
        );
        assert_eq!(
            validate_webhook_url("file:///etc/passwd"),
            Err(WebhookUrlError::NotHttps)
        );
        assert_eq!(
            validate_webhook_url("https://user:pw@siem.example.org/hook"),
            Err(WebhookUrlError::Credentials)
        );
        for url in [
            "https://169.254.169.254/latest/meta-data/",
            "https://127.0.0.1:8443/",
            "https://[::1]/",
            "https://[::ffff:169.254.169.254]/",
            "https://[fe80::1]/",
            "https://0.0.0.0/",
            "https://localhost/",
            "https://api.localhost/",
            "https://metadata.google.internal/computeMetadata/v1/",
            "https://METADATA.GOOGLE.INTERNAL./",
        ] {
            assert!(
                matches!(
                    validate_webhook_url(url),
                    Err(WebhookUrlError::ForbiddenHost(_))
                ),
                "{url}"
            );
        }
    }

    #[test]
    fn test_payloads_follow_the_receiver_format() {
        assert!(test_payload("slack", "t")["text"].is_string());
        assert_eq!(test_payload("msteams", "t")["@type"], "MessageCard");
        assert_eq!(test_payload("generic", "t")["timestamp"], "t");
    }
}
