// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! JWT token parsing utilities.

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

/// Extract organization ID from JWT token payload (base64 decode only).
///
/// # Security Note
/// This function does NOT verify the JWT signature. The extracted `organization_id`
/// is used only as a client-side hint for the enrollment request. The server is the
/// sole authority for validating the enrollment token and binding the agent to an
/// organization. Do NOT use the returned value for any security-critical decision
/// on the client side.
pub fn parse_organization_id_from_token(token: &str) -> Option<String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }

    // Decode payload (2nd part) - handle URL safe base64
    if let Ok(decoded) = URL_SAFE_NO_PAD.decode(parts[1])
        && let Ok(payload_str) = String::from_utf8(decoded)
        && let Ok(json) = serde_json::from_str::<serde_json::Value>(&payload_str)
    {
        // Try standard claims
        if let Some(val) = json.get("organization_id").or_else(|| json.get("org_id"))
            && let Some(s) = val.as_str()
        {
            return Some(s.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_organization_id() {
        // Create a dummy JWT with org_id
        let payload = serde_json::json!({
            "org_id": "org_12345",
            "sub": "agent_x",
            "exp": 1234567890
        });
        let payload_str = serde_json::to_string(&payload).unwrap();
        let payload_b64 = URL_SAFE_NO_PAD.encode(payload_str);
        let token = format!("header.{}.signature", payload_b64);

        assert_eq!(
            parse_organization_id_from_token(&token),
            Some("org_12345".to_string())
        );

        // Create a dummy JWT with organization_id
        let payload2 = serde_json::json!({
            "organization_id": "org_67890",
            "sub": "agent_y"
        });
        let payload_str2 = serde_json::to_string(&payload2).unwrap();
        let payload_b64_2 = URL_SAFE_NO_PAD.encode(payload_str2);
        let token2 = format!("header.{}.signature", payload_b64_2);

        assert_eq!(
            parse_organization_id_from_token(&token2),
            Some("org_67890".to_string())
        );

        // Invalid token
        assert_eq!(parse_organization_id_from_token("invalid.token"), None);
    }
}
