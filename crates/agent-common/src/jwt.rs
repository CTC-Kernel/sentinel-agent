// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! JWT token parsing utilities.
//!
//! **Security note:** This module performs _claim extraction only_ (no signature
//! verification). The enrollment token is validated server-side; the agent uses
//! the extracted `organization_id` solely as an optimistic hint for the
//! `X-Organization-Id` header. A tampered value will simply be rejected by the
//! server during enrollment.

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

/// Maximum payload size to decode (16 KB) to prevent memory exhaustion from
/// oversized or malicious tokens.
const MAX_JWT_PAYLOAD_BYTES: usize = 16 * 1024;

/// Extract organization ID from an enrollment token.
///
/// Supports two token formats:
/// 1. **Compound token**: `{orgId}:{hexToken}` — org ID is the prefix before `:`.
/// 2. **JWT token**: `header.payload.signature` — org ID extracted from claims.
///
/// The extracted value is used as an optimistic hint for the
/// `X-Organization-Id` header. Server validates the actual token.
///
/// # Safety bounds
/// - Rejects tokens with more than 3 segments (JWT)
/// - Limits decoded payload to [`MAX_JWT_PAYLOAD_BYTES`] (JWT)
/// - Validates `exp` claim if present (JWT, rejects expired tokens)
pub fn parse_organization_id_from_token(token: &str) -> Option<String> {
    // Format 1: compound token "orgId:hexToken"
    if let Some(colon_idx) = token.find(':') {
        let org_id = &token[..colon_idx];
        // Validate: org_id must be non-empty and look like a UUID or identifier
        if !org_id.is_empty() && org_id.len() <= 128 {
            return Some(org_id.to_string());
        }
    }

    // Format 2: JWT token "header.payload.signature"
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }

    // Reject oversized payloads before decoding
    if parts[1].len() > MAX_JWT_PAYLOAD_BYTES {
        tracing::warn!("JWT payload segment exceeds size limit, rejecting");
        return None;
    }

    // Decode payload (2nd part) - handle URL safe base64
    let decoded = URL_SAFE_NO_PAD.decode(parts[1]).ok()?;
    if decoded.len() > MAX_JWT_PAYLOAD_BYTES {
        tracing::warn!("JWT decoded payload exceeds size limit, rejecting");
        return None;
    }

    let payload_str = String::from_utf8(decoded).ok()?;
    let json: serde_json::Value = serde_json::from_str(&payload_str).ok()?;

    // Validate expiration if present (reject clearly expired tokens)
    if let Some(exp) = json.get("exp").and_then(|v| v.as_i64()) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        if exp < now {
            tracing::warn!("JWT token has expired (exp={}, now={})", exp, now);
            return None;
        }
    }

    // Extract organization ID from standard claims
    json.get("organization_id")
        .or_else(|| json.get("org_id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: build a JWT token string from a JSON payload.
    fn make_token(payload: &serde_json::Value) -> String {
        let payload_str = serde_json::to_string(payload).unwrap();
        let payload_b64 = URL_SAFE_NO_PAD.encode(payload_str);
        format!("header.{}.signature", payload_b64)
    }

    /// Future expiration timestamp (year 2099).
    fn future_exp() -> i64 {
        4_102_444_800
    }

    #[test]
    fn test_parse_org_id_claim() {
        let token = make_token(&serde_json::json!({
            "org_id": "org_12345",
            "sub": "agent_x",
            "exp": future_exp()
        }));
        assert_eq!(
            parse_organization_id_from_token(&token),
            Some("org_12345".to_string())
        );
    }

    #[test]
    fn test_parse_organization_id_claim() {
        let token = make_token(&serde_json::json!({
            "organization_id": "org_67890",
            "sub": "agent_y"
        }));
        assert_eq!(
            parse_organization_id_from_token(&token),
            Some("org_67890".to_string())
        );
    }

    #[test]
    fn test_expired_token_rejected() {
        let token = make_token(&serde_json::json!({
            "org_id": "org_expired",
            "exp": 1_000_000 // way in the past
        }));
        assert_eq!(parse_organization_id_from_token(&token), None);
    }

    #[test]
    fn test_no_exp_claim_still_works() {
        // Tokens without exp are accepted (server validates)
        let token = make_token(&serde_json::json!({
            "org_id": "org_no_exp"
        }));
        assert_eq!(
            parse_organization_id_from_token(&token),
            Some("org_no_exp".to_string())
        );
    }

    #[test]
    fn test_compound_token_format() {
        // orgId:hexToken format
        let token = "550e8400-e29b-41d4-a716-446655440000:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        assert_eq!(
            parse_organization_id_from_token(token),
            Some("550e8400-e29b-41d4-a716-446655440000".to_string())
        );
    }

    #[test]
    fn test_compound_token_short_orgid() {
        let token = "org123:deadbeef";
        assert_eq!(
            parse_organization_id_from_token(token),
            Some("org123".to_string())
        );
    }

    #[test]
    fn test_invalid_token_format() {
        assert_eq!(parse_organization_id_from_token("invalid.token"), None);
        assert_eq!(parse_organization_id_from_token(""), None);
        assert_eq!(parse_organization_id_from_token("a.b.c.d"), None);
    }

    #[test]
    fn test_oversized_payload_rejected() {
        // Create a payload larger than MAX_JWT_PAYLOAD_BYTES
        let big_value = "x".repeat(MAX_JWT_PAYLOAD_BYTES + 1);
        let token = format!("header.{}.signature", big_value);
        assert_eq!(parse_organization_id_from_token(&token), None);
    }
}
