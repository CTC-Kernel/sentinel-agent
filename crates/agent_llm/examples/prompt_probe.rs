//! Run prompts against the local model and print the answers, to check how
//! the model follows an instruction before shipping a prompt change.
//!
//! ```sh
//! LLM_BENCH_MODEL=/path/model.gguf cargo run --release -p agent_llm --example prompt_probe -- \
//!     system.txt question1.txt question2.txt
//! ```
//!
//! The first file is the system prompt, each following file one user message.

use agent_llm::config::{CacheConfig, InferenceConfig, ModelConfig, SecurityConfig};
use agent_llm::engine::{InferenceRequest, create_engine};
use std::time::Instant;

#[tokio::main(flavor = "multi_thread")]
async fn main() -> anyhow::Result<()> {
    let path = std::env::var("LLM_BENCH_MODEL").expect("LLM_BENCH_MODEL=/path/to/model.gguf");
    let mut files = std::env::args().skip(1);
    let system = std::fs::read_to_string(files.next().expect("system prompt file"))?;
    let questions: Vec<String> = files.collect();
    anyhow::ensure!(!questions.is_empty(), "at least one user message file");

    let model = ModelConfig {
        path: path.into(),
        ..ModelConfig::default()
    };
    let cache = CacheConfig {
        enabled: false,
        ..CacheConfig::default()
    };
    let engine = create_engine(
        &model,
        &InferenceConfig::default(),
        &SecurityConfig::default(),
        &cache,
    )?;
    let started = Instant::now();
    engine.warm_up().await?;
    println!(
        "load: {:.1}s · calcul: {}",
        started.elapsed().as_secs_f64(),
        engine.acceleration().await.unwrap_or_default()
    );

    for file in questions {
        let user = std::fs::read_to_string(&file)?;
        let request = InferenceRequest::new(user.trim())
            .with_system_prompt(system.trim())
            .with_max_tokens(640)
            .with_temperature(0.2);
        let started = Instant::now();
        let response = engine.infer(request).await?;
        println!(
            "\n===== {file} ({:.1}s, {} tokens) =====\n{}",
            started.elapsed().as_secs_f64(),
            response.tokens_generated,
            response.text.trim()
        );
    }
    Ok(())
}
