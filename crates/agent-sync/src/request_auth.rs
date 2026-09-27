//! Application-layer request authentication shared by both HTTP clients.
//! The server signs JSON.stringify(req.body), with millisecond timestamps and a nonce.
use base64::Engine;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use zeroize::Zeroizing;

#[derive(Clone)]
pub struct SigningSecret(Zeroizing<String>);
impl SigningSecret {
    pub fn new(value: String) -> Self {
        Self(Zeroizing::new(value))
    }
    pub fn expose(&self) -> &str {
        &self.0
    }
}
impl std::fmt::Debug for SigningSecret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("[REDACTED]")
    }
}

/// Encode JSON using ECMAScript's number formatting and integer-property ordering.
/// Sending these same bytes avoids signing Rust's `1.0` while the server verifies `1`.
fn server_json(value: &serde_json::Value) -> String {
    use serde_json::Value;
    match value {
        Value::Number(n) => {
            let x = n.as_f64().unwrap_or(0.0);
            if x == 0.0 {
                return "0".into();
            }
            if (1e-6..1e21).contains(&x.abs()) {
                return x.to_string();
            }
            let scientific = format!("{x:e}");
            let (mantissa, exponent) = scientific.split_once('e').unwrap();
            let exponent: i32 = exponent.parse().unwrap();
            format!(
                "{mantissa}e{}{exponent}",
                if exponent >= 0 { "+" } else { "" }
            )
        }
        Value::Array(values) => format!(
            "[{}]",
            values.iter().map(server_json).collect::<Vec<_>>().join(",")
        ),
        Value::Object(values) => {
            let mut keys: Vec<_> = values.keys().collect();
            let index = |s: &str| {
                s.parse::<u32>()
                    .ok()
                    .filter(|n| *n != u32::MAX && n.to_string() == s)
            };
            keys.sort_by(|a, b| match (index(a), index(b)) {
                (Some(a), Some(b)) => a.cmp(&b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => a.cmp(b),
            });
            format!(
                "{{{}}}",
                keys.iter()
                    .map(|key| format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap(),
                        server_json(&values[*key])
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
        _ => value.to_string(),
    }
}

pub fn sign_request(
    builder: reqwest::RequestBuilder,
    secret: &SigningSecret,
) -> Result<reqwest::RequestBuilder, String> {
    let (client, request) = builder.build_split();
    let mut request = request.map_err(|_| "Unable to build authenticated request")?;
    let key = Zeroizing::new(
        base64::engine::general_purpose::STANDARD
            .decode(secret.expose())
            .map_err(|_| "Invalid enrollment signing key encoding")?,
    );
    if key.len() < 32 {
        return Err("Enrollment signing key is too short".into());
    }
    let bytes = match request.body() {
        Some(body) => body
            .as_bytes()
            .ok_or("Streaming request bodies cannot be signed as JSON")?,
        None => b"{}",
    };
    let value: serde_json::Value =
        serde_json::from_slice(bytes).map_err(|_| "Authenticated request body must be JSON")?;
    let body = server_json(&value);
    if request.body().is_some() {
        *request.body_mut() = Some(body.clone().into());
    }
    let timestamp = chrono::Utc::now().timestamp_millis().to_string();
    let nonce = uuid::Uuid::new_v4().simple().to_string();
    // Cloud-function deployment prefixes are not part of Express req.path.
    let path = request.url().path();
    let path = path.find("/v1/").map(|i| &path[i..]).unwrap_or(path);
    let payload = format!("{timestamp}:{nonce}:{}:{path}:{body}", request.method());
    let mut mac = Hmac::<Sha256>::new_from_slice(&key).map_err(|_| "Invalid signing key")?;
    mac.update(payload.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());
    for (name, value) in [
        ("x-request-timestamp", timestamp),
        ("x-request-nonce", nonce),
        ("x-agent-signature", signature),
    ] {
        request.headers_mut().insert(
            reqwest::header::HeaderName::from_static(name),
            value.parse().map_err(|_| "Invalid authentication header")?,
        );
    }
    // Force signature authentication even on servers supporting both mechanisms.
    request.headers_mut().remove("x-agent-certificate");
    request
        .headers_mut()
        .remove(reqwest::header::CONTENT_LENGTH);
    Ok(reqwest::RequestBuilder::from_parts(client, request))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn secret() -> SigningSecret {
        SigningSecret::new(base64::engine::general_purpose::STANDARD.encode([42; 32]))
    }
    #[test]
    fn signature_binds_method_path_body_and_nonce() {
        let req = sign_request(
            reqwest::Client::new()
                .post("https://example.test/agentApi/v1/agents/test/heartbeat?x=1")
                .json(&serde_json::json!({"cpu":1.0,"memory":1e-7,"unicode":"é"})),
            &secret(),
        )
        .unwrap()
        .build()
        .unwrap();
        let body = std::str::from_utf8(req.body().unwrap().as_bytes().unwrap()).unwrap();
        assert_eq!(body, "{\"cpu\":1,\"memory\":1e-7,\"unicode\":\"é\"}");
        let payload = format!(
            "{}:{}:POST:/v1/agents/test/heartbeat:{body}",
            req.headers()["x-request-timestamp"].to_str().unwrap(),
            req.headers()["x-request-nonce"].to_str().unwrap()
        );
        let mut mac = Hmac::<Sha256>::new_from_slice(&[42; 32]).unwrap();
        mac.update(payload.as_bytes());
        assert_eq!(
            req.headers()["x-agent-signature"],
            hex::encode(mac.finalize().into_bytes())
        );
        assert!(!format!("{:?}", secret()).contains(secret().expose()));
    }
    #[test]
    fn get_requests_are_signed_and_retries_have_unique_nonces() {
        let client = reqwest::Client::new();
        let a = sign_request(client.get("https://example.test/v1/check"), &secret())
            .unwrap()
            .build()
            .unwrap();
        let b = sign_request(client.get("https://example.test/v1/check"), &secret())
            .unwrap()
            .build()
            .unwrap();
        assert_ne!(
            a.headers()["x-request-nonce"],
            b.headers()["x-request-nonce"]
        );
        assert!(a.body().is_none());
        assert!(
            sign_request(
                client.get("https://example.test"),
                &SigningSecret::new("invalid".into())
            )
            .is_err()
        );
    }
    #[test]
    fn matches_server_json_number_and_key_order() {
        let value = serde_json::json!({"10":1e21,"2":-0.0,"a":1e-6,"b":1e-7});
        assert_eq!(
            server_json(&value),
            "{\"2\":0,\"10\":1e+21,\"a\":0.000001,\"b\":1e-7}"
        );
    }
}
