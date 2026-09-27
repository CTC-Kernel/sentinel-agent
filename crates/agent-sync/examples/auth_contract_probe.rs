//! Emit synthetic requests for independent verification by the Node server contract.
use agent_sync::request_auth::{SigningSecret, sign_request};
use base64::Engine;
fn main() {
    let secret = SigningSecret::new(base64::engine::general_purpose::STANDARD.encode([42; 32]));
    let client = reqwest::Client::new();
    let cases = [
        serde_json::json!({"cpu":1.0,"negative_zero":-0.0,"tiny":1e-7,"limit":1e21}),
        serde_json::json!({"10":42,"2":7,"text":"é / \\ \n \"","array":[true,null,1.5,1e-6]}),
        serde_json::json!({"precise":333_333_333.333_333_3,"large":u64::MAX,"small":f64::MIN_POSITIVE}),
        serde_json::json!({"timestamp":"2026-09-27T12:00:00Z","metrics":{"disk":2147483648_u64,"cpu":0.125}}),
    ];
    for case in cases {
        let request = sign_request(
            client
                .post("https://example.test/agentApi/v1/agents/test/heartbeat")
                .json(&case),
            &secret,
        )
        .unwrap()
        .build()
        .unwrap();
        println!(
            "{}",
            serde_json::json!({"method":request.method().as_str(),"path":"/v1/agents/test/heartbeat", "body":std::str::from_utf8(request.body().unwrap().as_bytes().unwrap()).unwrap(),"timestamp":request.headers()["x-request-timestamp"].to_str().unwrap(),"nonce":request.headers()["x-request-nonce"].to_str().unwrap(),"signature":request.headers()["x-agent-signature"].to_str().unwrap()})
        );
    }
}
