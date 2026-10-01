// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! LLM inference engine abstraction.

use anyhow::Result;
use async_trait::async_trait;
use chrono;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tracing::{debug, info, warn};

use super::config::{CacheConfig, InferenceConfig, ModelConfig, SecurityConfig};

/// Trait for LLM model engines.
#[async_trait]
pub trait ModelEngine: Send + Sync {
    /// Get model status.
    async fn status(&self) -> ModelStatus;

    /// Perform inference.
    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse>;

    /// Get memory usage statistics.
    async fn memory_usage(&self) -> MemoryUsage;

    /// Get total inference count.
    async fn inference_count(&self) -> u64;

    /// Reload the model.
    async fn reload(&self) -> Result<()>;

    /// Unload the model to free memory.
    async fn unload(&self) -> Result<()>;

    /// Load the model ahead of the first question so the operator does not
    /// pay the loading time on their first message.
    async fn warm_up(&self) -> Result<()> {
        Ok(())
    }

    /// Compute backend the loaded model runs on (e.g. "GPU Metal",
    /// "CPU AVX2/FMA · 8 threads"), once known.
    async fn acceleration(&self) -> Option<String> {
        None
    }

    /// Streaming inference: `on_delta` receives each text fragment as soon as
    /// it is generated. The returned response carries the complete text.
    async fn infer_stream(
        &self,
        request: InferenceRequest,
        on_delta: &mut (dyn for<'d> FnMut(&'d str) + Send),
    ) -> Result<InferenceResponse> {
        let response = self.infer(request).await?;
        on_delta(&response.text);
        Ok(response)
    }
}

/// Scheduling class of a request. Background work (automatic vulnerability
/// analysis, enrichment) never competes with a question the operator waits for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InferencePriority {
    #[default]
    Interactive,
    Background,
}

/// Model status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelStatus {
    /// Model is not loaded
    Unloaded,
    /// Model is currently loading
    Loading,
    /// Model is loaded and ready
    Ready,
    /// Model encountered an error
    Error(String),
    /// Model is busy with inference
    Busy,
}

impl ModelStatus {
    pub fn is_ready(&self) -> bool {
        matches!(self, ModelStatus::Ready)
    }

    pub fn is_error(&self) -> bool {
        matches!(self, ModelStatus::Error(_))
    }
}

/// Inference request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    /// Input prompt
    pub prompt: String,
    /// System prompt (sent as a separate System message to the model)
    pub system_prompt: Option<String>,
    /// Maximum tokens to generate
    pub max_tokens: Option<u32>,
    /// Temperature override
    pub temperature: Option<f32>,
    /// Top-p override
    pub top_p: Option<f32>,
    /// Stop sequences
    pub stop_sequences: Vec<String>,
    /// Request metadata
    pub metadata: std::collections::HashMap<String, String>,
    /// Interactive requests pre-empt background ones.
    #[serde(default)]
    pub priority: InferencePriority,
    /// Set to `true` to abandon the generation (operator pressed “Stop”).
    #[serde(skip)]
    pub cancel: Option<Arc<std::sync::atomic::AtomicBool>>,
}

impl InferenceRequest {
    pub fn new(prompt: impl Into<String>) -> Self {
        Self {
            prompt: prompt.into(),
            system_prompt: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stop_sequences: Vec::new(),
            metadata: std::collections::HashMap::new(),
            priority: InferencePriority::Interactive,
            cancel: None,
        }
    }

    /// Mark the request as background work: it waits while the operator has a
    /// question in flight and is paused (then restarted) if one arrives.
    pub fn background(mut self) -> Self {
        self.priority = InferencePriority::Background;
        self
    }

    /// Abandon the generation as soon as `cancel` becomes `true`.
    pub fn with_cancel(mut self, cancel: Arc<std::sync::atomic::AtomicBool>) -> Self {
        self.cancel = Some(cancel);
        self
    }

    fn is_cancelled(&self) -> bool {
        self.cancel
            .as_ref()
            .is_some_and(|flag| flag.load(std::sync::atomic::Ordering::SeqCst))
    }

    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = Some(max_tokens);
        self
    }

    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature);
        self
    }

    pub fn with_top_p(mut self, top_p: f32) -> Self {
        self.top_p = Some(top_p);
        self
    }

    pub fn with_stop_sequence(mut self, stop: impl Into<String>) -> Self {
        self.stop_sequences.push(stop.into());
        self
    }

    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }

    pub fn with_system_prompt(mut self, system_prompt: impl Into<String>) -> Self {
        self.system_prompt = Some(system_prompt.into());
        self
    }
}

/// Inference response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResponse {
    /// Generated text
    pub text: String,
    /// Number of tokens generated
    pub tokens_generated: u32,
    /// Time taken in milliseconds
    pub duration_ms: u64,
    /// Response metadata
    pub metadata: std::collections::HashMap<String, String>,
}

impl InferenceResponse {
    pub fn new(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            tokens_generated: 0,
            duration_ms: 0,
            metadata: std::collections::HashMap::new(),
        }
    }
}

/// Memory usage information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryUsage {
    /// Allocated memory in MB
    pub allocated_mb: u64,
    /// Peak memory usage in MB
    pub peak_mb: u64,
    /// Available memory in MB
    pub available_mb: u64,
}

/// Wrapper stored on disk so we can check TTL from the embedded timestamp
/// instead of relying on file modification time.
#[derive(Serialize, Deserialize)]
struct CacheEntry {
    cached_at: chrono::DateTime<chrono::Utc>,
    response: InferenceResponse,
}

/// File-based response cache for LLM inference results.
struct ResponseCache {
    config: CacheConfig,
    /// Approximate total size of cached files in bytes, tracked atomically to
    /// avoid re-scanning the directory on every `put()`.
    cached_size: std::sync::atomic::AtomicU64,
    io_lock: std::sync::Mutex<()>,
}

impl ResponseCache {
    fn new(config: CacheConfig) -> Self {
        let mut resolved_config = config;

        // Eagerly create and canonicalize the cache directory when caching is enabled.
        if resolved_config.enabled {
            let _ = std::fs::create_dir_all(&resolved_config.directory);
            if let Ok(canon) = resolved_config.directory.canonicalize() {
                resolved_config.directory = canon;
            }
        }

        // Pre-compute the current cache size once.
        let initial_size = if resolved_config.enabled {
            dir_size_bytes(&resolved_config.directory).unwrap_or(0)
        } else {
            0
        };

        Self {
            config: resolved_config,
            io_lock: std::sync::Mutex::new(()),
            cached_size: std::sync::atomic::AtomicU64::new(initial_size),
        }
    }

    /// Compute a cache key from request parameters.
    fn cache_key(request: &InferenceRequest) -> String {
        // Versioned, unambiguous framing, including tool stops and caller scope.
        let metadata: std::collections::BTreeMap<_, _> = request.metadata.iter().collect();
        let encoded = serde_json::to_vec(&(
            "sentinel-cache-v2",
            &request.system_prompt,
            &request.prompt,
            request.max_tokens,
            request.temperature.map(f32::to_bits),
            request.top_p.map(f32::to_bits),
            &request.stop_sequences,
            metadata,
        ))
        .expect("cache key contains only serializable primitive values");
        format!("{:x}", Sha256::digest(encoded))
    }

    /// Try to read a cached response. Returns `None` if caching is disabled,
    /// the entry is missing, or the entry has expired.
    fn get(&self, request: &InferenceRequest) -> Option<InferenceResponse> {
        if !self.config.enabled {
            return None;
        }

        let _guard = self.io_lock.lock().ok()?;
        let key = Self::cache_key(request);
        let path = self.config.directory.join(format!("{}.json", key));

        if !path.exists() {
            return None;
        }

        if std::fs::metadata(&path).ok()?.len()
            > self.config.max_size_mb.saturating_mul(1024 * 1024)
        {
            return None;
        }
        let data = std::fs::read_to_string(&path).ok()?;
        let entry: CacheEntry = serde_json::from_str(&data).ok()?;

        // Check TTL using the embedded timestamp.
        let age = chrono::Utc::now().signed_duration_since(entry.cached_at);
        let ttl_seconds = self.config.ttl_hours.saturating_mul(3600);
        if age < chrono::Duration::zero() || age.num_seconds() as u64 >= ttl_seconds {
            if let Ok(meta) = std::fs::metadata(&path)
                && std::fs::remove_file(&path).is_ok()
            {
                // `try_update` replaces `fetch_update` only on toolchains
                // newer than the workspace `rust-version` (1.85).
                #[allow(deprecated)]
                let _ = self.cached_size.fetch_update(
                    std::sync::atomic::Ordering::Relaxed,
                    std::sync::atomic::Ordering::Relaxed,
                    |size| Some(size.saturating_sub(meta.len())),
                );
            }
            return None;
        }

        Some(entry.response)
    }

    /// Store a response in the cache. Skips if caching is disabled or the
    /// cache directory exceeds `max_size_mb`.
    fn put(&self, request: &InferenceRequest, response: &InferenceResponse) {
        if !self.config.enabled {
            return;
        }

        let Ok(_guard) = self.io_lock.lock() else {
            return;
        };
        let key = Self::cache_key(request);
        let path = self.config.directory.join(format!("{}.json", key));
        let entry = CacheEntry {
            cached_at: chrono::Utc::now(),
            response: response.clone(),
        };
        let Ok(data) = serde_json::to_vec(&entry) else {
            return;
        };
        let current = self.cached_size.load(std::sync::atomic::Ordering::Relaxed);
        let old_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        let projected = current
            .saturating_sub(old_size)
            .saturating_add(data.len() as u64);
        if projected > self.config.max_size_mb.saturating_mul(1024 * 1024) {
            return;
        }
        // Readers see either the complete previous entry or the complete replacement.
        let temporary = self
            .config
            .directory
            .join(format!("{}.tmp", uuid::Uuid::new_v4()));
        let write = (|| -> std::io::Result<()> {
            use std::io::Write;
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)?;
            file.write_all(&data)?;
            drop(file);
            std::fs::rename(&temporary, &path)
        })();
        if let Err(error) = write {
            let _ = std::fs::remove_file(&temporary);
            warn!("Failed to store cache entry: {}", error);
        } else {
            self.cached_size
                .store(projected, std::sync::atomic::Ordering::Relaxed);
        }
    }
}

/// Calculate total size of files in a directory (non-recursive, json only).
fn dir_size_bytes(dir: &std::path::Path) -> Result<u64> {
    let mut total = 0u64;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        if entry.path().extension().is_some_and(|e| e == "json") {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    Ok(total)
}

/// Mistral.rs based engine implementation.
pub struct MistralEngine {
    model: Arc<tokio::sync::Mutex<Option<Arc<mistralrs::Model>>>>,
    config: ModelConfig,
    inference_config: InferenceConfig,
    security_config: SecurityConfig,
    blocked_patterns: Vec<regex::Regex>,
    cache: ResponseCache,
    status: Arc<tokio::sync::RwLock<ModelStatus>>,
    inference_count: Arc<std::sync::atomic::AtomicU64>,
    /// Serializes model loading: concurrent first requests must not load the
    /// model twice (double memory, double wait).
    load_lock: tokio::sync::Mutex<()>,
    /// Interactive requests currently in flight.
    interactive_in_flight: Arc<std::sync::atomic::AtomicUsize>,
    /// Compute backend of the loaded model.
    acceleration: std::sync::RwLock<Option<String>>,
}

/// Why a streamed generation stopped early.
#[derive(Debug)]
enum StreamStop {
    Cancelled,
    Preempted,
    TimedOut(&'static str, u64),
    Failed(anyhow::Error),
}

impl From<StreamStop> for anyhow::Error {
    fn from(stop: StreamStop) -> Self {
        match stop {
            StreamStop::Cancelled => anyhow::anyhow!("Génération interrompue par l'utilisateur"),
            StreamStop::Preempted => {
                anyhow::anyhow!("Analyse d'arrière-plan suspendue au profit d'une question")
            }
            StreamStop::TimedOut(phase, secs) => {
                anyhow::anyhow!("Inference timed out: no {phase} after {secs}s")
            }
            StreamStop::Failed(e) => e,
        }
    }
}

/// Counts an interactive request for as long as it is alive.
struct InteractiveGuard(Arc<std::sync::atomic::AtomicUsize>);

impl InteractiveGuard {
    fn new(counter: &Arc<std::sync::atomic::AtomicUsize>) -> Self {
        counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        Self(counter.clone())
    }
}

impl Drop for InteractiveGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
    }
}

/// Minimum wait for the first fragment (prompt processing on slow CPUs).
const FIRST_TOKEN_MIN_SECS: u64 = 240;
/// Silence tolerated between two generated fragments once the answer started.
const STREAM_IDLE_SECS: u64 = 60;
/// Polling step used to honour cancellation and pre-emption promptly.
const STREAM_POLL: std::time::Duration = std::time::Duration::from_millis(150);
/// How many times a pre-empted background request is restarted.
const BACKGROUND_RESTARTS: usize = 3;

impl MistralEngine {
    pub fn new(
        config: ModelConfig,
        inference_config: InferenceConfig,
        security_config: SecurityConfig,
        cache_config: CacheConfig,
    ) -> Self {
        let blocked_patterns = security_config
            .blocked_patterns
            .iter()
            .filter_map(|p| match regex::Regex::new(p) {
                Ok(re) => Some(re),
                Err(e) => {
                    warn!("Invalid blocked pattern '{}': {}", p, e);
                    None
                }
            })
            .collect();

        let mut scoped_cache = cache_config;
        let identity = std::fs::metadata(&config.path)
            .ok()
            .map(|m| (m.len(), m.modified().ok()));
        let scope = format!("{:?}:{:?}:{:?}", config, inference_config, identity);
        scoped_cache.directory = scoped_cache
            .directory
            .join(format!("v2-{:x}", Sha256::digest(scope.as_bytes())));
        Self {
            model: Arc::new(tokio::sync::Mutex::new(None)),
            config,
            inference_config,
            security_config,
            blocked_patterns,
            cache: ResponseCache::new(scoped_cache),
            status: Arc::new(tokio::sync::RwLock::new(ModelStatus::Unloaded)),
            inference_count: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            load_lock: tokio::sync::Mutex::new(()),
            interactive_in_flight: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            acceleration: std::sync::RwLock::new(None),
        }
    }

    fn interactive_busy(&self) -> bool {
        self.interactive_in_flight
            .load(std::sync::atomic::Ordering::SeqCst)
            > 0
    }

    /// Validate sampling parameters and the security policy; returns the
    /// effective (temperature, top_p, max_tokens).
    fn validate(&self, request: &InferenceRequest) -> Result<(f64, f64, usize)> {
        let temperature = request
            .temperature
            .unwrap_or(self.inference_config.temperature);
        let top_p = request.top_p.unwrap_or(self.inference_config.top_p);
        let max_tokens = request
            .max_tokens
            .unwrap_or(self.inference_config.max_tokens);
        if !(0.0..=2.0).contains(&temperature) || !(0.0..=1.0).contains(&top_p) || max_tokens == 0 {
            return Err(anyhow::anyhow!("Invalid inference sampling parameters"));
        }
        if self.security_config.sanitize_input {
            let total_len =
                request.prompt.len() + request.system_prompt.as_ref().map_or(0, |s| s.len());
            if total_len > self.security_config.max_input_length {
                return Err(anyhow::anyhow!(
                    "Input length ({}) exceeds maximum allowed ({})",
                    total_len,
                    self.security_config.max_input_length
                ));
            }

            for (pattern, re) in self
                .security_config
                .blocked_patterns
                .iter()
                .zip(&self.blocked_patterns)
            {
                if re.is_match(&request.prompt)
                    || request
                        .system_prompt
                        .as_ref()
                        .is_some_and(|sp| re.is_match(sp))
                {
                    return Err(anyhow::anyhow!(
                        "Input matches blocked pattern: {}",
                        pattern
                    ));
                }
            }
        }

        if self.security_config.audit_logging {
            info!(
                prompt_len = request.prompt.len(),
                system_prompt_len = request.system_prompt.as_ref().map_or(0, |s| s.len()),
                max_tokens = ?request.max_tokens,
                priority = ?request.priority,
                "LLM inference request"
            );
        }
        Ok((temperature as f64, top_p as f64, max_tokens as usize))
    }

    async fn current_model(&self) -> Result<Arc<mistralrs::Model>> {
        self.warm_up().await?;
        let guard = self.model.lock().await;
        guard
            .as_ref()
            .map(Arc::clone)
            .ok_or_else(|| anyhow::anyhow!("Model not loaded"))
    }

    /// Background work waits until no operator question is in flight.
    async fn wait_until_idle(&self, request: &InferenceRequest) -> Result<(), StreamStop> {
        while self.interactive_busy() {
            if request.is_cancelled() {
                return Err(StreamStop::Cancelled);
            }
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        }
        Ok(())
    }

    fn build_request(
        &self,
        request: &InferenceRequest,
        temperature: f64,
        top_p: f64,
        max_tokens: usize,
    ) -> mistralrs::RequestBuilder {
        let top_k = self.inference_config.top_k as usize;
        let mut builder = mistralrs::RequestBuilder::new();
        if let Some(ref system_prompt) = request.system_prompt {
            builder =
                builder.add_message(mistralrs::TextMessageRole::System, system_prompt.clone());
        }
        let stop_toks = (!request.stop_sequences.is_empty())
            .then(|| mistralrs::StopTokens::Seqs(request.stop_sequences.clone()));
        builder
            .add_message(mistralrs::TextMessageRole::User, request.prompt.clone())
            .set_sampling(mistralrs::SamplingParams {
                temperature: Some(temperature),
                top_k: Some(top_k),
                top_p: Some(top_p),
                top_n_logprobs: 0,
                frequency_penalty: None,
                presence_penalty: None,
                stop_toks,
                max_len: Some(max_tokens),
                logits_bias: None,
                n_choices: 1,
                repetition_penalty: Some(self.inference_config.repetition_penalty),
                dry_params: None,
                min_p: None,
            })
    }

    /// Stream one generation. Dropping the mistral.rs stream cancels the
    /// sequence cleanly, so cancellation, pre-emption and time-outs never
    /// require reloading the model.
    async fn run_stream(
        &self,
        model: &mistralrs::Model,
        request: &InferenceRequest,
        builder: mistralrs::RequestBuilder,
        on_delta: &mut (dyn for<'d> FnMut(&'d str) + Send),
    ) -> Result<(String, usize), StreamStop> {
        use std::time::{Duration, Instant};

        let mut stream = model
            .stream_chat_request(builder)
            .await
            .map_err(StreamStop::Failed)?;
        // Prompt processing on CPU can be long: the first fragment gets a
        // generous budget (the operator sees the wait and can stop it), later
        // fragments only need to keep flowing.
        let first_budget = self.inference_config.timeout_secs.max(FIRST_TOKEN_MIN_SECS);
        let mut deadline = Instant::now() + Duration::from_secs(first_budget);
        let mut started = false;
        let mut text = String::new();
        let mut fragments = 0usize;
        let mut usage_tokens = None;
        let background = request.priority == InferencePriority::Background;

        loop {
            if request.is_cancelled() {
                return Err(StreamStop::Cancelled);
            }
            if background && self.interactive_busy() {
                return Err(StreamStop::Preempted);
            }
            if Instant::now() >= deadline {
                return Err(if started {
                    StreamStop::TimedOut("new token", STREAM_IDLE_SECS)
                } else {
                    StreamStop::TimedOut("first token", first_budget)
                });
            }
            let next = match tokio::time::timeout(STREAM_POLL, stream.next()).await {
                Err(_) => continue,
                Ok(next) => next,
            };
            match next {
                None => break,
                Some(mistralrs::Response::Chunk(chunk)) => {
                    if let Some(usage) = &chunk.usage {
                        usage_tokens = Some(usage.completion_tokens);
                    }
                    let mut finished = false;
                    if let Some(choice) = chunk.choices.first() {
                        if let Some(content) = choice.delta.content.as_deref()
                            && !content.is_empty()
                        {
                            text.push_str(content);
                            on_delta(content);
                        }
                        fragments += 1;
                        finished = choice.finish_reason.is_some();
                    }
                    started = true;
                    deadline = Instant::now() + Duration::from_secs(STREAM_IDLE_SECS);
                    if finished {
                        break;
                    }
                }
                Some(mistralrs::Response::Done(done)) => {
                    usage_tokens = Some(done.usage.completion_tokens);
                    if text.is_empty()
                        && let Some(content) = done
                            .choices
                            .first()
                            .and_then(|choice| choice.message.content.clone())
                    {
                        on_delta(&content);
                        text = content;
                    }
                    break;
                }
                Some(mistralrs::Response::ModelError(message, _)) => {
                    return Err(StreamStop::Failed(anyhow::anyhow!(
                        "Inference error: {message}"
                    )));
                }
                Some(mistralrs::Response::InternalError(e))
                | Some(mistralrs::Response::ValidationError(e)) => {
                    return Err(StreamStop::Failed(anyhow::anyhow!("Inference error: {e}")));
                }
                Some(_) => {}
            }
        }
        Ok((text, usage_tokens.unwrap_or(fragments)))
    }

    async fn load_model(&self) -> Result<()> {
        // Set status to Loading, then release the lock before expensive I/O
        {
            let mut status = self.status.write().await;
            *status = ModelStatus::Loading;
        }

        // Create the model loader
        let model_path = self.config.path.to_string_lossy().to_string();

        info!("Loading GGUF model from: {}", model_path);

        // We assume the path allows deducing the structure or we configure it as a local file
        // Since we don't know the exact API for local files, we'll try to find a way.
        // Usually builders have a method to specify it's a local file.
        // For now, let's try passing the path as the repo and file.
        // If the path is "/path/to/model.gguf", repo might be the dir, file the filename.

        let path = std::path::Path::new(&model_path);
        let parent = path.parent().unwrap_or(std::path::Path::new("."));
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let started = std::time::Instant::now();
        let build = |force_cpu: bool| {
            let mut builder =
                mistralrs::GgufModelBuilder::new(parent.to_string_lossy(), vec![filename.clone()])
                    // One operator, a few background jobs: a small batch keeps
                    // CPU caches warm. Prefix caching reuses the grounded context.
                    .with_max_num_seqs(4)
                    .with_prefix_cache_n(Some(8));
            if force_cpu {
                builder = builder.with_force_cpu();
            }
            async move { builder.build().await.map_err(|e| anyhow::anyhow!(e)) }
        };
        let gpu_build = cfg!(all(target_os = "macos", target_arch = "aarch64"));
        let mut on_gpu = gpu_build;
        let load_result = match build(false).await {
            // Apple Silicon builds use the GPU (Metal); keep the assistant
            // available on the CPU if the GPU cannot be used.
            Err(e) if gpu_build => {
                warn!("GPU model loading failed ({e}); falling back to the CPU");
                on_gpu = false;
                build(true).await
            }
            other => other,
        };
        if load_result.is_ok() {
            let acceleration = if on_gpu {
                "GPU Metal".to_string()
            } else {
                crate::hardware::cpu_label()
            };
            info!(
                "Model loaded in {:.1}s on {acceleration}",
                started.elapsed().as_secs_f64()
            );
            if let Ok(mut slot) = self.acceleration.write() {
                *slot = Some(acceleration);
            }
        }

        match load_result {
            Ok(model) => {
                let mut model_guard = self.model.lock().await;
                *model_guard = Some(Arc::new(model));

                let mut status = self.status.write().await;
                *status = ModelStatus::Ready;
                info!("Model loaded successfully");
                Ok(())
            }
            Err(e) => {
                let mut status = self.status.write().await;
                *status = ModelStatus::Error(e.to_string());
                Err(e)
            }
        }
    }
}

#[async_trait]
impl ModelEngine for MistralEngine {
    async fn status(&self) -> ModelStatus {
        self.status.read().await.clone()
    }

    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse> {
        self.infer_stream(request, &mut |_| {}).await
    }

    async fn acceleration(&self) -> Option<String> {
        self.acceleration.read().ok().and_then(|slot| slot.clone())
    }

    async fn warm_up(&self) -> Result<()> {
        if self.status().await.is_ready() {
            return Ok(());
        }
        let _loading = self.load_lock.lock().await;
        // Another request may have finished loading while we waited.
        if self.status().await.is_ready() {
            return Ok(());
        }
        self.load_model().await
    }

    async fn infer_stream(
        &self,
        request: InferenceRequest,
        on_delta: &mut (dyn for<'d> FnMut(&'d str) + Send),
    ) -> Result<InferenceResponse> {
        let (temperature, top_p, max_tokens) = self.validate(&request)?;

        // --- Cache lookup ---
        if let Some(cached) = self.cache.get(&request) {
            info!("Cache hit for inference request");
            on_delta(&cached.text);
            return Ok(cached);
        }

        // Interactive questions are counted for their whole lifetime so that
        // background work steps aside immediately.
        let _interactive = (request.priority == InferencePriority::Interactive)
            .then(|| InteractiveGuard::new(&self.interactive_in_flight));

        debug!(
            "Starting inference: prompt_len={}, max_tokens={}, temp={:.1}",
            request.prompt.len(),
            max_tokens,
            temperature
        );

        let mut restarts = 0usize;
        let (text, tokens, duration) = loop {
            if request.priority == InferencePriority::Background {
                self.wait_until_idle(&request).await?;
            }
            let model = self.current_model().await?;
            let start_time = std::time::Instant::now();
            let builder = self.build_request(&request, temperature, top_p, max_tokens);
            match self.run_stream(&model, &request, builder, on_delta).await {
                Ok((text, tokens)) => break (text, tokens, start_time.elapsed()),
                Err(StreamStop::Preempted) if restarts < BACKGROUND_RESTARTS => {
                    restarts += 1;
                    debug!("Background inference paused for an interactive question");
                }
                Err(stop) => {
                    if let StreamStop::TimedOut(..) = stop {
                        warn!("LLM inference stalled: {:?}", stop);
                    }
                    return Err(stop.into());
                }
            }
        };

        // Update inference count
        self.inference_count
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        info!(
            "Inference complete: {} tokens in {:.1}s ({:.0} tok/s)",
            tokens,
            duration.as_secs_f64(),
            tokens as f64 / duration.as_secs_f64().max(0.001)
        );

        let response = InferenceResponse {
            text,
            tokens_generated: u32::try_from(tokens).unwrap_or(u32::MAX),
            duration_ms: duration.as_millis() as u64,
            metadata: std::collections::HashMap::new(),
        };

        // --- Cache store ---
        self.cache.put(&request, &response);

        Ok(response)
    }

    async fn memory_usage(&self) -> MemoryUsage {
        let (allocated, available) = get_process_memory_mb();
        MemoryUsage {
            allocated_mb: allocated,
            peak_mb: allocated, // No peak tracking without sysinfo
            available_mb: available,
        }
    }

    async fn inference_count(&self) -> u64 {
        self.inference_count
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    async fn reload(&self) -> Result<()> {
        info!("Reloading model...");
        let _loading = self.load_lock.lock().await;
        self.unload().await?;
        self.load_model().await?;
        Ok(())
    }

    async fn unload(&self) -> Result<()> {
        let mut model_guard = self.model.lock().await;
        *model_guard = None;

        let mut status = self.status.write().await;
        *status = ModelStatus::Unloaded;

        info!("Model unloaded");
        Ok(())
    }
}

/// Create an LLM engine based on configuration.
pub fn create_engine(
    config: &ModelConfig,
    inference_config: &InferenceConfig,
    security_config: &SecurityConfig,
    cache_config: &CacheConfig,
) -> Result<Arc<dyn ModelEngine>> {
    let engine: Arc<dyn ModelEngine> = match config.model_type {
        super::config::ModelType::Llama4
        | super::config::ModelType::Qwen3Coder
        | super::config::ModelType::DeepSeekR1
        | super::config::ModelType::Gemma3
        | super::config::ModelType::Mistral7B => Arc::new(MistralEngine::new(
            config.clone(),
            inference_config.clone(),
            security_config.clone(),
            cache_config.clone(),
        )),
        super::config::ModelType::Custom(_) => Arc::new(MistralEngine::new(
            config.clone(),
            inference_config.clone(),
            security_config.clone(),
            cache_config.clone(),
        )),
    };

    Ok(engine)
}

/// Get current process RSS and available system memory in MB.
fn get_process_memory_mb() -> (u64, u64) {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let pid = std::process::id();
        // Get RSS via ps
        let allocated = Command::new("ps")
            .args(["-o", "rss=", "-p", &pid.to_string()])
            .output()
            .ok()
            .and_then(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<u64>()
                    .ok()
            })
            .map(|kb| kb / 1024)
            .unwrap_or(0);
        // Get available from vm_stat or sysctl
        let available = Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output()
            .ok()
            .and_then(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<u64>()
                    .ok()
            })
            .map(|bytes| bytes / (1024 * 1024))
            .unwrap_or(0);
        (allocated, available)
    }
    #[cfg(target_os = "linux")]
    {
        let allocated = std::fs::read_to_string("/proc/self/status")
            .ok()
            .and_then(|s| {
                s.lines()
                    .find(|l| l.starts_with("VmRSS:"))
                    .and_then(|l| l.split_whitespace().nth(1))
                    .and_then(|v| v.parse::<u64>().ok())
            })
            .map(|kb| kb / 1024)
            .unwrap_or(0);
        let available = std::fs::read_to_string("/proc/meminfo")
            .ok()
            .and_then(|s| {
                s.lines()
                    .find(|l| l.starts_with("MemAvailable:"))
                    .and_then(|l| l.split_whitespace().nth(1))
                    .and_then(|v| v.parse::<u64>().ok())
            })
            .map(|kb| kb / 1024)
            .unwrap_or(0);
        (allocated, available)
    }
    #[cfg(target_os = "windows")]
    {
        // Basic Windows fallback
        (0, 0)
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        (0, 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inference_request_builder() {
        let request = InferenceRequest::new("Hello")
            .with_max_tokens(100)
            .with_temperature(0.8)
            .with_stop_sequence("\n")
            .with_metadata("test", "value");

        assert_eq!(request.prompt, "Hello");
        assert_eq!(request.system_prompt, None);
        assert_eq!(request.max_tokens, Some(100));
        assert_eq!(request.temperature, Some(0.8));
        assert_eq!(request.stop_sequences, vec!["\n"]);
        assert_eq!(request.metadata.get("test"), Some(&"value".to_string()));
    }

    #[test]
    fn test_inference_request_system_prompt() {
        let request = InferenceRequest::new("Analyze this")
            .with_system_prompt("You are a security analyst")
            .with_max_tokens(256);

        assert_eq!(request.prompt, "Analyze this");
        assert_eq!(
            request.system_prompt,
            Some("You are a security analyst".to_string())
        );
        assert_eq!(request.max_tokens, Some(256));
    }

    #[test]
    fn test_model_status() {
        assert!(ModelStatus::Ready.is_ready());
        assert!(!ModelStatus::Unloaded.is_ready());
        assert!(ModelStatus::Error("test".to_string()).is_error());
        assert!(!ModelStatus::Ready.is_error());
    }

    // -----------------------------------------------------------------------
    // ResponseCache tests
    // -----------------------------------------------------------------------

    fn make_test_cache_config(dir: &std::path::Path) -> CacheConfig {
        CacheConfig {
            enabled: true,
            directory: dir.to_path_buf(),
            max_size_mb: 10,
            ttl_hours: 1,
        }
    }

    #[test]
    fn test_cache_put_and_get() {
        let tmp = tempfile::tempdir().unwrap();
        let cache = ResponseCache::new(make_test_cache_config(tmp.path()));

        let request = InferenceRequest::new("test prompt")
            .with_max_tokens(100)
            .with_temperature(0.7);

        let response = InferenceResponse {
            text: "cached response".to_string(),
            tokens_generated: 5,
            duration_ms: 100,
            metadata: std::collections::HashMap::new(),
        };

        // Initially empty
        assert!(cache.get(&request).is_none());

        // Put then get
        cache.put(&request, &response);
        let cached = cache.get(&request).unwrap();
        assert_eq!(cached.text, "cached response");
        assert_eq!(cached.tokens_generated, 5);
    }

    #[test]
    fn test_cache_disabled() {
        let tmp = tempfile::tempdir().unwrap();
        let mut config = make_test_cache_config(tmp.path());
        config.enabled = false;
        let cache = ResponseCache::new(config);

        let request = InferenceRequest::new("test");
        let response = InferenceResponse::new("resp");

        cache.put(&request, &response);
        assert!(cache.get(&request).is_none());
    }

    #[test]
    fn test_cache_ttl_expiry() {
        let tmp = tempfile::tempdir().unwrap();
        let mut config = make_test_cache_config(tmp.path());
        config.ttl_hours = 1; // 1 hour TTL
        let cache = ResponseCache::new(config);

        let request = InferenceRequest::new("test");
        let response = InferenceResponse::new("resp");

        // Write a CacheEntry with a timestamp 2 hours in the past (expired).
        let entry = CacheEntry {
            cached_at: chrono::Utc::now() - chrono::Duration::hours(2),
            response: response.clone(),
        };
        let key = ResponseCache::cache_key(&request);
        let path = tmp.path().join(format!("{}.json", key));
        std::fs::write(&path, serde_json::to_string(&entry).unwrap()).unwrap();

        // Should be expired
        assert!(cache.get(&request).is_none());
        assert_eq!(
            cache.cached_size.load(std::sync::atomic::Ordering::Relaxed),
            0
        );
        // File should have been deleted
        assert!(!path.exists());
    }

    #[test]
    fn test_cache_max_size_skip() {
        let tmp = tempfile::tempdir().unwrap();
        let mut config = make_test_cache_config(tmp.path());
        config.max_size_mb = 0; // 0 MB = always full
        let cache = ResponseCache::new(config);

        let request = InferenceRequest::new("test");
        let response = InferenceResponse::new("resp");

        cache.put(&request, &response);
        // Should not have been written because max_size_mb = 0
        let key = ResponseCache::cache_key(&request);
        let path = tmp.path().join(format!("{}.json", key));
        assert!(!path.exists());
    }

    #[test]
    fn test_cache_key_deterministic() {
        let r1 = InferenceRequest::new("hello").with_temperature(0.5);
        let r2 = InferenceRequest::new("hello").with_temperature(0.5);
        assert_eq!(ResponseCache::cache_key(&r1), ResponseCache::cache_key(&r2));
    }

    #[test]
    fn test_cache_key_differs_on_prompt() {
        let r1 = InferenceRequest::new("hello");
        let r2 = InferenceRequest::new("world");
        assert_ne!(ResponseCache::cache_key(&r1), ResponseCache::cache_key(&r2));
    }

    // -----------------------------------------------------------------------
    // Security validation tests
    // -----------------------------------------------------------------------

    fn make_test_engine() -> MistralEngine {
        let model_config = ModelConfig::default();
        let inference_config = InferenceConfig::default();
        let security_config = SecurityConfig {
            sanitize_input: true,
            max_input_length: 100,
            blocked_patterns: vec![
                r"(?i)password\s*[:=]\s*\S+".to_string(),
                r"(?i)secret\s*[:=]\s*\S+".to_string(),
            ],
            audit_logging: true,
        };
        let cache_config = CacheConfig::default();

        MistralEngine::new(
            model_config,
            inference_config,
            security_config,
            cache_config,
        )
    }

    #[tokio::test]
    async fn invalid_sampling_is_rejected_before_model_loading() {
        let engine = make_test_engine();
        for temperature in [f32::NAN, f32::INFINITY, -0.1, 2.1] {
            let error = engine
                .infer(InferenceRequest::new("hello").with_temperature(temperature))
                .await
                .unwrap_err();
            assert!(error.to_string().contains("sampling"));
            assert!(matches!(engine.status().await, ModelStatus::Unloaded));
        }
        let mut request = InferenceRequest::new("hello");
        request.top_p = Some(f32::NAN);
        assert!(
            engine
                .infer(request)
                .await
                .unwrap_err()
                .to_string()
                .contains("sampling")
        );
    }

    #[tokio::test]
    async fn test_security_rejects_oversized_input() {
        let engine = make_test_engine();
        // max_input_length = 100, so a 200-char prompt should fail
        let long_prompt = "a".repeat(200);
        let request = InferenceRequest::new(long_prompt);
        let result = engine.infer(request).await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("exceeds maximum"), "Got: {}", err_msg);
    }

    #[tokio::test]
    async fn test_security_rejects_blocked_pattern() {
        let engine = make_test_engine();
        let request = InferenceRequest::new("password = hunter2");
        let result = engine.infer(request).await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("blocked pattern"), "Got: {}", err_msg);
    }

    #[tokio::test]
    async fn test_security_rejects_blocked_pattern_in_system_prompt() {
        let engine = make_test_engine();
        let request = InferenceRequest::new("analyze").with_system_prompt("secret = abc123");
        let result = engine.infer(request).await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("blocked pattern"), "Got: {}", err_msg);
    }

    #[tokio::test]
    async fn test_security_counts_system_prompt_in_length() {
        let engine = make_test_engine();
        // 60 + 60 = 120 > 100 max
        let request = InferenceRequest::new("a".repeat(60)).with_system_prompt("b".repeat(60));
        let result = engine.infer(request).await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("exceeds maximum"), "Got: {}", err_msg);
    }

    #[tokio::test]
    async fn test_security_disabled_allows_long_input() {
        let model_config = ModelConfig::default();
        let inference_config = InferenceConfig::default();
        let security_config = SecurityConfig {
            sanitize_input: false,
            max_input_length: 10,
            blocked_patterns: vec![],
            audit_logging: false,
        };
        let cache_config = CacheConfig {
            enabled: false,
            ..CacheConfig::default()
        };
        let engine = MistralEngine::new(
            model_config,
            inference_config,
            security_config,
            cache_config,
        );

        // With sanitize_input=false, even a very long prompt should pass security
        // (it will fail later at model loading, which is expected)
        let request = InferenceRequest::new("a".repeat(1000));
        let result = engine.infer(request).await;

        // Should NOT be a security error — it'll fail on model load instead
        if let Err(e) = result {
            assert!(!e.to_string().contains("exceeds maximum"));
            assert!(!e.to_string().contains("blocked pattern"));
        }
    }
}

#[cfg(test)]
mod cache_regressions {
    use super::*;
    #[test]
    fn cache_key_frames_fields_and_includes_stops_and_scope() {
        let a = InferenceRequest::new("bc").with_system_prompt("a");
        let mut b = InferenceRequest::new("c").with_system_prompt("ab");
        assert_ne!(ResponseCache::cache_key(&a), ResponseCache::cache_key(&b));
        b = a.clone();
        b.stop_sequences.push("END".into());
        assert_ne!(ResponseCache::cache_key(&a), ResponseCache::cache_key(&b));
        b = a.clone();
        b.metadata.insert("tenant".into(), "other".into());
        assert_ne!(ResponseCache::cache_key(&a), ResponseCache::cache_key(&b));
    }
    #[test]
    fn replacement_accounting_matches_disk_and_rejects_oversized_entry() {
        let dir = tempfile::tempdir().unwrap();
        let cache = ResponseCache::new(CacheConfig {
            enabled: true,
            directory: dir.path().into(),
            max_size_mb: 1,
            ttl_hours: 1,
        });
        let request = InferenceRequest::new("request");
        for text in ["short", "a slightly longer response", "tiny"] {
            cache.put(&request, &InferenceResponse::new(text));
            assert_eq!(cache.get(&request).unwrap().text, text);
            assert_eq!(
                cache.cached_size.load(std::sync::atomic::Ordering::Relaxed),
                dir_size_bytes(dir.path()).unwrap()
            );
        }
        cache.put(
            &InferenceRequest::new("huge"),
            &InferenceResponse::new("a".repeat(1024 * 1024)),
        );
        assert!(cache.get(&InferenceRequest::new("huge")).is_none());
    }
    #[test]
    fn engines_with_different_models_do_not_share_cache() {
        let dir = tempfile::tempdir().unwrap();
        let cache = CacheConfig {
            enabled: true,
            directory: dir.path().into(),
            max_size_mb: 1,
            ttl_hours: 1,
        };
        let first = ModelConfig::default();
        let mut second = first.clone();
        second.name.push_str("-other");
        let a = MistralEngine::new(
            first,
            InferenceConfig::default(),
            SecurityConfig::default(),
            cache.clone(),
        );
        let b = MistralEngine::new(
            second,
            InferenceConfig::default(),
            SecurityConfig::default(),
            cache,
        );
        let request = InferenceRequest::new("same question");
        a.cache
            .put(&request, &InferenceResponse::new("first model"));
        assert!(b.cache.get(&request).is_none());
    }
}
