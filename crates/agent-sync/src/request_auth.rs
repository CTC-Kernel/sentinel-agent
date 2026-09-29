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

/// ECMAScript `Number::toString` (what `JSON.stringify` emits for numbers).
///
/// Rust and JS both pick the shortest round-tripping digit count, but when the
/// exact value lies halfway between two such candidates Rust rounds the last
/// digit up while ECMAScript picks the even one (`0.15649795532226563` vs
/// `0.15649795532226562`). Rust's fixed-precision formatting is exact with
/// round-half-even, so re-rendering at the shortest precision matches JS.
fn js_number(x: f64) -> String {
    if x == 0.0 || !x.is_finite() {
        return "0".into();
    }
    let shortest = format!("{:e}", x.abs());
    let (mantissa, _) = shortest.split_once('e').unwrap_or((&shortest, "0"));
    let precision = mantissa
        .len()
        .saturating_sub(if mantissa.contains('.') { 2 } else { 1 });
    let even = format!("{:.*e}", precision, x.abs());
    let chosen = if even.parse::<f64>() == Ok(x.abs()) {
        even
    } else {
        shortest
    };
    let (mantissa, exponent) = chosen.split_once('e').unwrap_or((&chosen, "0"));
    let digits = mantissa.replace('.', "");
    let digits = match digits.trim_end_matches('0') {
        "" => "0",
        d => d,
    };
    let k = digits.len() as i32;
    let n = exponent.parse::<i32>().unwrap_or(0) + 1;
    let body = if k <= n && n <= 21 {
        format!("{digits}{}", "0".repeat((n - k) as usize))
    } else if 0 < n && n <= 21 {
        format!("{}.{}", &digits[..n as usize], &digits[n as usize..])
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat((-n) as usize))
    } else {
        let e = n - 1;
        let sign = if e >= 0 { "+" } else { "-" };
        let fraction = if k == 1 {
            String::new()
        } else {
            format!(".{}", &digits[1..])
        };
        format!("{}{fraction}e{sign}{}", &digits[..1], e.abs())
    };
    if x < 0.0 { format!("-{body}") } else { body }
}

/// Encode JSON using ECMAScript's number formatting and integer-property ordering.
/// Sending these same bytes avoids signing Rust's `1.0` while the server verifies `1`.
fn server_json(value: &serde_json::Value) -> String {
    use serde_json::Value;
    match value {
        Value::Number(n) => js_number(n.as_f64().unwrap_or(0.0)),
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
    #[test]
    fn halfway_digits_round_to_even_like_ecmascript() {
        // Values observed in production heartbeats (memory_percent) that made
        // the server reject the signature.
        for (x, js) in [
            (0.156_497_955_322_265_63, "0.15649795532226562"),
            (215_492_859_907_334.63, "215492859907334.62"),
            (231_883_033_904_786.63, "231883033904786.62"),
            (-0.156_497_955_322_265_63, "-0.15649795532226562"),
            (9.33e25, "9.33e+25"),
            (3.97e-11, "3.97e-11"),
            (1.5, "1.5"),
            (123.0, "123"),
            (1e20, "100000000000000000000"),
            (u64::MAX as f64, "18446744073709552000"),
            (f64::MIN_POSITIVE, "2.2250738585072014e-308"),
            (5e-324, "5e-324"),
        ] {
            assert_eq!(js_number(x), js, "{x:e}");
        }
    }
}
