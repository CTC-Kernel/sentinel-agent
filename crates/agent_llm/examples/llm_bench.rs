//! Latency bench for the local assistant.
//!
//! ```sh
//! LLM_BENCH_MODEL=/path/model.gguf cargo run --release -p agent_llm --example llm_bench
//! ```
//!
//! Reports model load time, time to first token and total time for a short
//! question and for a question carrying the grounded Sentinel context.

use agent_llm::config::{CacheConfig, InferenceConfig, ModelConfig, SecurityConfig};
use agent_llm::engine::{InferenceRequest, create_engine};
use std::time::Instant;

fn grounded_context() -> String {
    let mut lines = vec![
        "CONTEXTE SENTINEL NEXUS ACTUEL (données locales, ne rien inventer):".to_string(),
        "- Mode: autonome".into(),
        "- Score de conformité: 72.4%".into(),
        "- Contrôles: 148 total, 12 en échec/erreur".into(),
        "- Vulnérabilités: 23".into(),
    ];
    for i in 0..8 {
        lines.push(format!(
            "- Contrôle prioritaire {i}: Chiffrement du disque désactivé [cis-{i}.1.2] (High, Fail)"
        ));
    }
    for i in 0..8 {
        lines.push(format!(
            "- CVE-2024-{:04} sur openssl 3.0.{i} (Critical, CVSS 9.{i})",
            1000 + i
        ));
    }
    for i in 0..6 {
        lines.push(format!("- Processus powershell.exe PID {} (confiance 8{i}%): commande encodée base64 lancée depuis un document Office", 4800 + i));
    }
    lines.join("\n")
}

#[tokio::main(flavor = "multi_thread")]
async fn main() -> anyhow::Result<()> {
    let path = std::env::var("LLM_BENCH_MODEL").expect("LLM_BENCH_MODEL=/path/to/model.gguf");
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
    println!("load: {:.1}s", started.elapsed().as_secs_f64());

    let system = "Tu es Sentinel Intelligence, analyste SOC senior. Réponds en français.";
    let context = grounded_context();
    let cases = [
        ("court", "Qu'est-ce qu'une CVE ?".to_string()),
        (
            "contexte",
            format!("{context}\n\nQUESTION OPÉRATEUR:\nQuels sont les risques prioritaires ?"),
        ),
        (
            "contexte (2e)",
            format!("{context}\n\nQUESTION OPÉRATEUR:\nQue faire en premier ?"),
        ),
    ];
    for (label, prompt) in cases {
        let request = InferenceRequest::new(&prompt)
            .with_system_prompt(system)
            .with_max_tokens(200)
            .with_temperature(0.2);
        let started = Instant::now();
        let mut first = None;
        let mut chunks = 0usize;
        let response = engine
            .infer_stream(request, &mut |_delta| {
                chunks += 1;
                first.get_or_insert_with(|| started.elapsed());
            })
            .await?;
        let total = started.elapsed();
        println!(
            "{label:>14}: prompt {} chars · 1er token {:.2}s · total {:.2}s · {} tokens ({:.1} tok/s) · {chunks} fragments",
            prompt.len(),
            first.unwrap_or(total).as_secs_f64(),
            total.as_secs_f64(),
            response.tokens_generated,
            response.tokens_generated as f64 / total.as_secs_f64(),
        );
    }

    // Background analysis running when the operator asks a question: the
    // question must not wait for the analysis to finish.
    let background_engine = engine.clone();
    let background = tokio::spawn(async move {
        let request = InferenceRequest::new("Analyse la vulnérabilité CVE-2024-3094 de xz-utils : exploitabilité, impact et correctif.")
            .with_max_tokens(200)
            .with_temperature(0.2)
            .background();
        let started = Instant::now();
        let result = background_engine.infer(request).await;
        (started.elapsed(), result.map(|r| r.tokens_generated))
    });
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    let started = Instant::now();
    let mut first = None;
    let question = InferenceRequest::new("En une phrase : qu'est-ce qu'un EDR ?")
        .with_system_prompt(system)
        .with_max_tokens(60)
        .with_temperature(0.2);
    let response = engine
        .infer_stream(question, &mut |_| {
            first.get_or_insert_with(|| started.elapsed());
        })
        .await?;
    println!(
        "question pendant une analyse d'arrière-plan: 1er token {:.2}s · total {:.2}s · {} tokens",
        first.unwrap_or_default().as_secs_f64(),
        started.elapsed().as_secs_f64(),
        response.tokens_generated
    );
    let (elapsed, tokens) = background.await?;
    println!(
        "analyse d'arrière-plan (suspendue puis reprise): total {:.2}s · {:?} tokens",
        elapsed.as_secs_f64(),
        tokens.map_err(|e| e.to_string())
    );

    // Cancellation: the stream is dropped and the engine stays usable.
    let cancel = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let flag = cancel.clone();
    let mut fragments = 0usize;
    let started = Instant::now();
    let cancelled = engine
        .infer_stream(
            InferenceRequest::new("Écris un long rapport sur la sécurité des postes.")
                .with_max_tokens(400)
                .with_cancel(cancel),
            &mut |_| {
                fragments += 1;
                if fragments == 10 {
                    flag.store(true, std::sync::atomic::Ordering::SeqCst);
                }
            },
        )
        .await;
    println!(
        "annulation après 10 fragments: {:.2}s · {}",
        started.elapsed().as_secs_f64(),
        cancelled
            .err()
            .map_or("non annulée".into(), |e| e.to_string())
    );
    let started = Instant::now();
    let after = engine
        .infer(InferenceRequest::new("Réponds OK.").with_max_tokens(5))
        .await?;
    println!(
        "requête suivante après annulation: {:.2}s · {:?}",
        started.elapsed().as_secs_f64(),
        after.text
    );

    // Warm-up with a fresh context while the operator types, then the question.
    let fresh_context = grounded_context()
        .replace("72.4%", "64.9%")
        .replace("powershell", "rundll32");
    let started = Instant::now();
    engine
        .infer(
            InferenceRequest::new(fresh_context.clone())
                .with_system_prompt(system)
                .with_max_tokens(1)
                .with_temperature(0.0)
                .background(),
        )
        .await?;
    println!(
        "pré-calcul du contexte (pendant la saisie): {:.2}s",
        started.elapsed().as_secs_f64()
    );
    let started = Instant::now();
    let mut first = None;
    engine
        .infer_stream(
            InferenceRequest::new(format!(
                "{fresh_context}\n\nQUESTION OPÉRATEUR:\nQuelles priorités ?"
            ))
            .with_system_prompt(system)
            .with_max_tokens(40)
            .with_temperature(0.2),
            &mut |_| {
                first.get_or_insert_with(|| started.elapsed());
            },
        )
        .await?;
    println!(
        "1re question après pré-calcul: 1er token {:.2}s",
        first.unwrap_or_default().as_secs_f64()
    );
    Ok(())
}
