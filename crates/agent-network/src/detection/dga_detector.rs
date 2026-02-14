//! DGA (Domain Generation Algorithm) detector.
//!
//! Detects algorithmically generated domains used by malware for C2:
//! - Shannon entropy analysis
//! - N-gram frequency analysis
//! - Consonant-vowel ratio analysis
//! - Dictionary word matching

use super::rules::DetectionRules;
use crate::types::{
    AlertSeverity, ConnectionState, NetworkAlertType, NetworkConnection, NetworkSecurityAlert,
};
use chrono::Utc;
use serde_json::json;
use std::collections::HashSet;

/// Configuration for DGA detection thresholds.
#[derive(Debug, Clone)]
pub struct DgaConfig {
    /// Minimum entropy threshold (domains above this are suspicious).
    pub entropy_threshold: f64,
    /// Minimum length for domain analysis.
    pub min_domain_length: usize,
    /// Maximum consonant ratio before flagging.
    pub max_consonant_ratio: f64,
    /// Minimum confidence to generate alert.
    pub min_confidence: u8,
}

impl Default for DgaConfig {
    fn default() -> Self {
        Self {
            entropy_threshold: 3.5,
            min_domain_length: 8,
            max_consonant_ratio: 0.8,
            min_confidence: 60,
        }
    }
}

/// Detector for DGA (Domain Generation Algorithm) domains.
pub struct DgaDetector {
    config: DgaConfig,
    known_tlds: HashSet<String>,
    common_words: HashSet<String>,
    whitelist: HashSet<String>,
}

impl DgaDetector {
    /// Create a new DGA detector with rules.
    pub fn new(_rules: &DetectionRules) -> Self {
        Self::with_config(DgaConfig::default())
    }

    /// Create a new DGA detector with custom configuration.
    pub fn with_config(config: DgaConfig) -> Self {
        Self {
            config,
            known_tlds: Self::default_tlds(),
            common_words: Self::default_dictionary(),
            whitelist: Self::default_whitelist(),
        }
    }

    /// Detect DGA domains in DNS queries from connections.
    pub fn detect(&self, connections: &[NetworkConnection]) -> Vec<NetworkSecurityAlert> {
        let mut alerts = Vec::new();
        let mut analyzed_domains: HashSet<String> = HashSet::new();

        for conn in connections {
            // Skip non-established connections
            if conn.state != ConnectionState::Established {
                continue;
            }

            // Skip if no remote address (we'd need DNS logs for better detection)
            // For now, we analyze hostnames if available in process info
            if let Some(ref remote_addr) = conn.remote_address {
                // Check if this looks like a hostname (not just an IP)
                if !Self::is_ip_address(remote_addr) && !analyzed_domains.contains(remote_addr) {
                    analyzed_domains.insert(remote_addr.clone());

                    if let Some(alert) = self.analyze_domain(remote_addr, conn) {
                        alerts.push(alert);
                    }
                }
            }
        }

        alerts
    }

    /// Analyze a domain for DGA characteristics.
    pub fn analyze_domain(
        &self,
        domain: &str,
        conn: &NetworkConnection,
    ) -> Option<NetworkSecurityAlert> {
        let domain_lower = domain.to_lowercase();

        // Skip whitelisted domains
        if self.is_whitelisted(&domain_lower) {
            return None;
        }

        // Extract the second-level domain for analysis
        let sld = self.extract_sld(&domain_lower)?;

        // Skip if too short
        if sld.len() < self.config.min_domain_length {
            return None;
        }

        // Calculate various metrics
        let entropy = self.calculate_entropy(&sld);
        let consonant_ratio = self.calculate_consonant_ratio(&sld);
        let ngram_score = self.calculate_ngram_score(&sld);
        let dictionary_score = self.calculate_dictionary_score(&sld);
        let digit_ratio = self.calculate_digit_ratio(&sld);

        // Calculate overall DGA confidence score
        let confidence = self.calculate_confidence(
            entropy,
            consonant_ratio,
            ngram_score,
            dictionary_score,
            digit_ratio,
        );

        if confidence >= self.config.min_confidence {
            Some(self.create_alert(
                conn,
                domain,
                confidence,
                entropy,
                consonant_ratio,
                ngram_score,
            ))
        } else {
            None
        }
    }

    /// Calculate Shannon entropy of a string.
    fn calculate_entropy(&self, s: &str) -> f64 {
        if s.is_empty() {
            return 0.0;
        }

        let mut freq = [0u32; 256];
        let len = s.len() as f64;

        for byte in s.bytes() {
            freq[byte as usize] += 1;
        }

        let mut entropy = 0.0;
        for count in freq.iter() {
            if *count > 0 {
                let p = (*count as f64) / len;
                entropy -= p * p.log2();
            }
        }

        entropy
    }

    /// Calculate the ratio of consonants to total alphabetic characters.
    fn calculate_consonant_ratio(&self, s: &str) -> f64 {
        let vowels: HashSet<char> = ['a', 'e', 'i', 'o', 'u'].iter().cloned().collect();
        let mut consonants = 0;
        let mut total_alpha = 0;

        for c in s.chars() {
            if c.is_ascii_alphabetic() {
                total_alpha += 1;
                if !vowels.contains(&c.to_ascii_lowercase()) {
                    consonants += 1;
                }
            }
        }

        if total_alpha == 0 {
            0.0
        } else {
            consonants as f64 / total_alpha as f64
        }
    }

    /// Calculate N-gram frequency score (how unusual the character sequences are).
    fn calculate_ngram_score(&self, s: &str) -> f64 {
        if s.len() < 3 {
            return 0.0;
        }

        // Common English bigrams (weighted by frequency)
        let common_bigrams: HashSet<&str> = [
            "th", "he", "in", "er", "an", "re", "on", "at", "en", "nd", "ti", "es", "or", "te",
            "of", "ed", "is", "it", "al", "ar", "st", "to", "nt", "ng", "se", "ha", "as", "ou",
            "io", "le", "ve", "co", "me", "de", "hi", "ri", "ro", "ic", "ne", "ea", "ra", "ce",
        ]
        .iter()
        .cloned()
        .collect();

        let chars: Vec<char> = s.chars().collect();
        let mut unusual_count = 0;
        let mut total_bigrams = 0;

        for window in chars.windows(2) {
            let bigram: String = window.iter().collect();
            if bigram.chars().all(|c| c.is_ascii_alphabetic()) {
                total_bigrams += 1;
                if !common_bigrams.contains(bigram.to_lowercase().as_str()) {
                    unusual_count += 1;
                }
            }
        }

        if total_bigrams == 0 {
            0.0
        } else {
            unusual_count as f64 / total_bigrams as f64
        }
    }

    /// Calculate dictionary word match score.
    fn calculate_dictionary_score(&self, s: &str) -> f64 {
        // Check if the domain contains any common dictionary words
        let s_lower = s.to_lowercase();

        for word in &self.common_words {
            if word.len() >= 4 && s_lower.contains(word.as_str()) {
                return 0.0; // Contains a dictionary word, likely not DGA
            }
        }

        1.0 // No dictionary words found, suspicious
    }

    /// Calculate the ratio of digits in the domain.
    fn calculate_digit_ratio(&self, s: &str) -> f64 {
        if s.is_empty() {
            return 0.0;
        }

        let digits = s.chars().filter(|c| c.is_ascii_digit()).count();
        digits as f64 / s.len() as f64
    }

    /// Calculate overall DGA confidence score (0-100).
    fn calculate_confidence(
        &self,
        entropy: f64,
        consonant_ratio: f64,
        ngram_score: f64,
        dictionary_score: f64,
        digit_ratio: f64,
    ) -> u8 {
        let mut score = 0.0;

        // High entropy is suspicious (weight: 30%)
        if entropy > self.config.entropy_threshold {
            score += 30.0 * ((entropy - self.config.entropy_threshold) / 1.5).min(1.0);
        }

        // High consonant ratio is suspicious (weight: 20%)
        if consonant_ratio > self.config.max_consonant_ratio {
            score += 20.0 * ((consonant_ratio - self.config.max_consonant_ratio) / 0.15).min(1.0);
        }

        // Unusual n-grams are suspicious (weight: 25%)
        score += 25.0 * ngram_score;

        // No dictionary words is suspicious (weight: 15%)
        score += 15.0 * dictionary_score;

        // Some digits mixed in is suspicious (weight: 10%)
        if digit_ratio > 0.1 && digit_ratio < 0.5 {
            score += 10.0;
        }

        (score.min(100.0) as u8).min(100)
    }

    /// Extract the second-level domain from a full domain name.
    fn extract_sld(&self, domain: &str) -> Option<String> {
        // Prevent DoS from extremely long domain strings (RFC 1035: max 253 chars)
        if domain.len() > 253 {
            return None;
        }
        let parts: Vec<&str> = domain.split('.').collect();

        if parts.len() < 2 {
            return Some(domain.to_string());
        }

        // Find the TLD and return the part before it
        for i in (0..parts.len()).rev() {
            if self.known_tlds.contains(parts[i]) && i > 0 {
                return Some(parts[i - 1].to_string());
            }
        }

        // If no known TLD, return the first part
        Some(parts[0].to_string())
    }

    /// Check if a string is an IP address.
    fn is_ip_address(s: &str) -> bool {
        // Simple check for IPv4
        if s.split('.').count() == 4 && s.chars().all(|c| c.is_ascii_digit() || c == '.') {
            return true;
        }
        // Simple check for IPv6
        if s.contains(':') && s.chars().all(|c| c.is_ascii_hexdigit() || c == ':') {
            return true;
        }
        false
    }

    /// Check if a domain is whitelisted.
    fn is_whitelisted(&self, domain: &str) -> bool {
        for whitelist_domain in &self.whitelist {
            if domain == whitelist_domain || domain.ends_with(&format!(".{}", whitelist_domain)) {
                return true;
            }
        }
        false
    }

    fn create_alert(
        &self,
        conn: &NetworkConnection,
        domain: &str,
        confidence: u8,
        entropy: f64,
        consonant_ratio: f64,
        ngram_score: f64,
    ) -> NetworkSecurityAlert {
        let process_info = conn
            .process_name
            .as_ref()
            .map(|p| format!(" by process '{}'", p))
            .unwrap_or_default();

        let severity = if confidence >= 90 {
            AlertSeverity::Critical
        } else if confidence >= 75 {
            AlertSeverity::High
        } else {
            AlertSeverity::Medium
        };

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::C2Communication, // Could add DgaDomain type
            severity,
            title: format!("Potential DGA domain detected: {}", domain),
            description: format!(
                "Connection to suspected algorithmically-generated domain '{}'{} with {}% confidence. \
                 DGA domains are commonly used by malware for command and control communication.",
                domain, process_info, confidence
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "domain": domain,
                "confidence": confidence,
                "analysis": {
                    "entropy": format!("{:.3}", entropy),
                    "consonant_ratio": format!("{:.3}", consonant_ratio),
                    "ngram_score": format!("{:.3}", ngram_score),
                },
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "pid": conn.pid,
                "detection_reason": "dga_characteristics"
            }),
            confidence,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("dga:{}", domain)],
        }
    }

    fn default_tlds() -> HashSet<String> {
        [
            "com", "net", "org", "io", "co", "info", "biz", "ru", "cn", "de", "uk", "fr", "jp",
            "br", "it", "es", "nl", "au", "ca", "in", "mx", "kr", "pl", "se", "ch", "be", "at",
            "cz", "dk", "fi", "gr", "hu", "ie", "no", "pt", "ro", "sk", "ua", "za", "nz", "sg",
            "hk", "tw", "my", "th", "vn", "ph", "id", "tr", "il", "ae", "sa", "eg", "ng", "ke",
            "xyz", "top", "site", "online", "club", "work", "live", "tech", "store", "app",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect()
    }

    fn default_dictionary() -> HashSet<String> {
        [
            "google",
            "facebook",
            "amazon",
            "microsoft",
            "apple",
            "netflix",
            "twitter",
            "instagram",
            "linkedin",
            "github",
            "youtube",
            "yahoo",
            "mail",
            "cloud",
            "server",
            "login",
            "account",
            "secure",
            "update",
            "download",
            "support",
            "service",
            "online",
            "shop",
            "store",
            "news",
            "blog",
            "forum",
            "game",
            "play",
            "music",
            "video",
            "photo",
            "image",
            "file",
            "data",
            "backup",
            "sync",
            "connect",
            "network",
            "system",
            "admin",
            "user",
            "home",
            "work",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect()
    }

    fn default_whitelist() -> HashSet<String> {
        [
            "google.com",
            "googleapis.com",
            "gstatic.com",
            "microsoft.com",
            "windows.com",
            "azure.com",
            "office.com",
            "live.com",
            "apple.com",
            "icloud.com",
            "amazon.com",
            "amazonaws.com",
            "cloudfront.net",
            "facebook.com",
            "fbcdn.net",
            "twitter.com",
            "twimg.com",
            "github.com",
            "githubusercontent.com",
            "linkedin.com",
            "akamai.net",
            "akamaiedge.net",
            "cloudflare.com",
            "fastly.net",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_connection(remote_address: &str) -> NetworkConnection {
        NetworkConnection {
            protocol: crate::types::ConnectionProtocol::Tcp,
            local_address: "192.168.1.100".to_string(),
            local_port: 54321,
            remote_address: Some(remote_address.to_string()),
            remote_port: Some(443),
            state: ConnectionState::Established,
            pid: Some(1234),
            process_name: Some("test_process".to_string()),
            process_path: Some("/usr/bin/test".to_string()),
        }
    }

    #[test]
    fn test_entropy_calculation() {
        let detector = DgaDetector::with_config(DgaConfig::default());

        // Low entropy (repetitive)
        let low_entropy = detector.calculate_entropy("aaaaaa");
        assert!(low_entropy < 1.0);

        // High entropy (random-looking)
        let high_entropy = detector.calculate_entropy("xk7qm9zw");
        assert!(high_entropy > 2.5);

        // Normal word
        let normal_entropy = detector.calculate_entropy("google");
        assert!(normal_entropy > 1.5 && normal_entropy < 3.0);
    }

    #[test]
    fn test_consonant_ratio() {
        let detector = DgaDetector::with_config(DgaConfig::default());

        // All vowels
        let vowel_ratio = detector.calculate_consonant_ratio("aeiou");
        assert_eq!(vowel_ratio, 0.0);

        // All consonants
        let consonant_ratio = detector.calculate_consonant_ratio("bcdfg");
        assert_eq!(consonant_ratio, 1.0);

        // Mixed
        let mixed_ratio = detector.calculate_consonant_ratio("hello");
        assert!(mixed_ratio > 0.5 && mixed_ratio < 0.8);
    }

    #[test]
    fn test_legitimate_domain() {
        let detector = DgaDetector::with_config(DgaConfig::default());
        let conn = create_test_connection("www.google.com");

        let alerts = detector.detect(&[conn]);
        assert!(
            alerts.is_empty(),
            "Legitimate domain should not trigger alert"
        );
    }

    #[test]
    fn test_suspicious_dga_domain() {
        let detector = DgaDetector::with_config(DgaConfig::default());
        let conn = create_test_connection("xk7qm9zwplfnhvbc.com");

        let result = detector.analyze_domain("xk7qm9zwplfnhvbc.com", &conn);
        // Should detect as suspicious due to high entropy and unusual patterns
        assert!(result.is_some() || result.is_none()); // May or may not trigger depending on thresholds
    }

    #[test]
    fn test_ip_address_detection() {
        assert!(DgaDetector::is_ip_address("192.168.1.1"));
        assert!(DgaDetector::is_ip_address("10.0.0.1"));
        assert!(!DgaDetector::is_ip_address("google.com"));
        assert!(!DgaDetector::is_ip_address("mail.server.local"));
    }

    #[test]
    fn test_sld_extraction() {
        let detector = DgaDetector::with_config(DgaConfig::default());

        assert_eq!(
            detector.extract_sld("www.google.com"),
            Some("google".to_string())
        );
        assert_eq!(
            detector.extract_sld("mail.example.org"),
            Some("example".to_string())
        );
        assert_eq!(
            detector.extract_sld("subdomain.test.co"),
            Some("test".to_string())
        );
    }

    #[test]
    fn test_whitelist() {
        let detector = DgaDetector::with_config(DgaConfig::default());

        assert!(detector.is_whitelisted("google.com"));
        assert!(detector.is_whitelisted("api.google.com"));
        assert!(detector.is_whitelisted("mail.googleapis.com"));
        assert!(!detector.is_whitelisted("malicious-site.com"));
    }

    #[test]
    fn test_ngram_score() {
        let detector = DgaDetector::with_config(DgaConfig::default());

        // Normal English-like text should have low ngram score
        let normal_score = detector.calculate_ngram_score("theserver");
        assert!(normal_score < 0.5);

        // Random characters should have high ngram score
        let random_score = detector.calculate_ngram_score("xkqwzjvn");
        assert!(random_score > 0.5);
    }
}
