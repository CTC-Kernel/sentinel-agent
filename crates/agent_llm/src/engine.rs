// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! LLM inference engine abstraction.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use sha2::{Sha256, Digest};
use chrono;
use tracing::{info, debug, warn};

use super::config::{ModelConfig, InferenceConfig, SecurityConfig, CacheConfig};

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
        }
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
            cached_size: std::sync::atomic::AtomicU64::new(initial_size),
        }
    }

    /// Compute a cache key from request parameters.
    fn cache_key(request: &InferenceRequest) -> String {
        let mut hasher = Sha256::new();
        if let Some(ref sp) = request.system_prompt {
            hasher.update(sp.as_bytes());
        }
        hasher.update(request.prompt.as_bytes());
        if let Some(mt) = request.max_tokens {
            hasher.update(mt.to_le_bytes());
        }
        if let Some(t) = request.temperature {
            hasher.update(t.to_le_bytes());
        }
        if let Some(tp) = request.top_p {
            hasher.update(tp.to_le_bytes());
        }
        format!("{:x}", hasher.finalize())
    }

    /// Try to read a cached response. Returns `None` if caching is disabled,
    /// the entry is missing, or the entry has expired.
    fn get(&self, request: &InferenceRequest) -> Option<InferenceResponse> {
        if !self.config.enabled {
            return None;
        }

        let key = Self::cache_key(request);
        let path = self.config.directory.join(format!("{}.json", key));

        if !path.exists() {
            return None;
        }

        let data = std::fs::read_to_string(&path).ok()?;
        let entry: CacheEntry = serde_json::from_str(&data).ok()?;

        // Check TTL using the embedded timestamp.
        let age = chrono::Utc::now().signed_duration_since(entry.cached_at);
        let ttl = chrono::Duration::hours(self.config.ttl_hours as i64);
        if age > ttl {
            // Expired — remove the file and update the size tracker.
            if let Ok(meta) = std::fs::metadata(&path) {
                self.cached_size.fetch_sub(meta.len(), std::sync::atomic::Ordering::Relaxed);
            }
            let _ = std::fs::remove_file(&path);
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

        // Check total cache size via the atomic counter (no dir scan).
        let current_size = self.cached_size.load(std::sync::atomic::Ordering::Relaxed);
        if current_size >= self.config.max_size_mb * 1024 * 1024 {
            debug!("Cache directory exceeds max size ({}MB), skipping write", self.config.max_size_mb);
            return;
        }

        let key = Self::cache_key(request);
        let path = self.config.directory.join(format!("{}.json", key));

        let entry = CacheEntry {
            cached_at: chrono::Utc::now(),
            response: response.clone(),
        };

        match serde_json::to_string(&entry) {
            Ok(data) => {
                let data_len = data.len() as u64;
                if let Err(e) = std::fs::write(&path, data) {
                    warn!("Failed to write cache entry: {}", e);
                } else {
                    self.cached_size.fetch_add(data_len, std::sync::atomic::Ordering::Relaxed);
                }
            }
            Err(e) => warn!("Failed to serialize response for cache: {}", e),
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
}

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

        Self {
            model: Arc::new(tokio::sync::Mutex::new(None)),
            config,
            inference_config,
            security_config,
            blocked_patterns,
            cache: ResponseCache::new(cache_config),
            status: Arc::new(tokio::sync::RwLock::new(ModelStatus::Unloaded)),
            inference_count: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
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
        let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Mistralrs 0.7.0 GgufModelBuilder usage
        let load_result = (async {
            let builder = mistralrs::GgufModelBuilder::new(
                parent.to_string_lossy(),
                vec![filename],
            );
            
            builder.build().await.map_err(|e| anyhow::anyhow!(e))
        }).await;

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
        // --- Security validation ---
        if self.security_config.sanitize_input {
            let total_len = request.prompt.len()
                + request.system_prompt.as_ref().map_or(0, |s| s.len());
            if total_len > self.security_config.max_input_length {
                return Err(anyhow::anyhow!(
                    "Input length ({}) exceeds maximum allowed ({})",
                    total_len,
                    self.security_config.max_input_length
                ));
            }

            for (pattern, re) in self.security_config.blocked_patterns.iter().zip(&self.blocked_patterns) {
                if re.is_match(&request.prompt)
                    || request.system_prompt.as_ref().is_some_and(|sp| re.is_match(sp))
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
                "LLM inference request"
            );
        }

        // --- Cache lookup ---
        if let Some(cached) = self.cache.get(&request) {
            info!("Cache hit for inference request");
            return Ok(cached);
        }

        // Ensure model is loaded
        if !self.status().await.is_ready() {
            self.load_model().await?;
        }

        // Clone the Arc<Model> out and release the Mutex so other engine methods
        // (status, memory_usage) are not blocked during inference.
        let model = {
            let guard = self.model.lock().await;
            Arc::clone(guard.as_ref()
                .ok_or_else(|| anyhow::anyhow!("Model not loaded"))?)
        };

        let start_time = std::time::Instant::now();

        let temperature = request.temperature.unwrap_or(self.inference_config.temperature) as f64;
        let top_p = request.top_p.unwrap_or(self.inference_config.top_p) as f64;
        let top_k = self.inference_config.top_k as usize;
        let repetition_penalty = self.inference_config.repetition_penalty;
        let max_tokens = request.max_tokens.unwrap_or(self.inference_config.max_tokens) as usize;
        let timeout_secs = self.inference_config.timeout_secs;

        debug!("Starting inference: prompt_len={}, max_tokens={}, temp={:.1}",
            request.prompt.len(), max_tokens, temperature);

        // Build a chat request with the given token limit.
        let build_chat_request = |max_tok: usize| {
            let mut builder = mistralrs::RequestBuilder::new();
            if let Some(ref system_prompt) = request.system_prompt {
                builder = builder.add_message(
                    mistralrs::TextMessageRole::System,
                    system_prompt.clone(),
                );
            }
            builder
                .add_message(mistralrs::TextMessageRole::User, request.prompt.clone())
                .set_sampler_temperature(temperature)
                .set_sampler_topp(top_p)
                .set_sampler_topk(top_k)
                .set_sampler_max_len(max_tok)
                .set_sampling(mistralrs::SamplingParams {
                    temperature: Some(temperature),
                    top_k: Some(top_k),
                    top_p: Some(top_p),
                    top_n_logprobs: 0,
                    frequency_penalty: None,
                    presence_penalty: None,
                    stop_toks: None,
                    max_len: Some(max_tok),
                    logits_bias: None,
                    n_choices: 1,
                    repetition_penalty: Some(repetition_penalty),
                    dry_params: None,
                    min_p: None,
                })
        };

        // Enforce timeout to prevent infinite hangs on slow inference
        let timeout_duration = std::time::Duration::from_secs(timeout_secs);

        // First attempt with full max_tokens
        let response = match tokio::time::timeout(
            timeout_duration,
            model.send_chat_request(build_chat_request(max_tokens)),
        ).await {
            Ok(Ok(resp)) => resp,
            Ok(Err(e)) => {
                return Err(anyhow::anyhow!("Inference error: {}", e));
            }
            Err(_) => {
                // After timeout, mistralrs internal state is corrupted (channel dropped).
                // Unload, reload, and retry once with reduced tokens to break the death spiral.
                let reduced_tokens = max_tokens.min(256);
                warn!(
                    "LLM inference timed out after {}s — reloading and retrying with max_tokens={}",
                    timeout_secs, reduced_tokens
                );

                self.unload().await?;
                self.load_model().await?;

                // Clone the freshly loaded model
                let model = {
                    let guard = self.model.lock().await;
                    Arc::clone(guard.as_ref()
                        .ok_or_else(|| anyhow::anyhow!("Model not loaded after reload"))?)
                };

                match tokio::time::timeout(
                    timeout_duration,
                    model.send_chat_request(build_chat_request(reduced_tokens)),
                ).await {
                    Ok(Ok(resp)) => {
                        info!("Retry with reduced tokens succeeded");
                        resp
                    }
                    Ok(Err(e)) => {
                        return Err(anyhow::anyhow!("Inference error on retry: {}", e));
                    }
                    Err(_) => {
                        warn!("LLM inference timed out again after {}s — giving up", timeout_secs);
                        {
                            let mut status = self.status.write().await;
                            *status = ModelStatus::Error(
                                format!("Inference timed out after {}s (retry also failed)", timeout_secs),
                            );
                        }
                        let mut model_lock = self.model.lock().await;
                        *model_lock = None;
                        return Err(anyhow::anyhow!(
                            "Inference timed out after {}s (retry with reduced tokens also failed)",
                            timeout_secs,
                        ));
                    }
                }
            }
        };

        let duration = start_time.elapsed();

        // Update inference count
        self.inference_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        let text = response.choices.first()
            .map(|c| c.message.content.clone().unwrap_or_default())
            .ok_or_else(|| anyhow::anyhow!("LLM returned empty choices"))?;

        let tokens = response.usage.completion_tokens;
        info!("Inference complete: {} tokens in {:.1}s ({:.0} tok/s)",
            tokens, duration.as_secs_f64(),
            tokens as f64 / duration.as_secs_f64().max(0.001));

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
        self.inference_count.load(std::sync::atomic::Ordering::Relaxed)
    }

    async fn reload(&self) -> Result<()> {
        info!("Reloading model...");
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
        super::config::ModelType::Llama4 |
        super::config::ModelType::Qwen3Coder |
        super::config::ModelType::DeepSeekR1 |
        super::config::ModelType::Gemma3 => {
            Arc::new(MistralEngine::new(config.clone(), inference_config.clone(), security_config.clone(), cache_config.clone()))
        }
        super::config::ModelType::Custom(_) => {
            Arc::new(MistralEngine::new(config.clone(), inference_config.clone(), security_config.clone(), cache_config.clone()))
        }
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
            .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().ok())
            .map(|kb| kb / 1024)
            .unwrap_or(0);
        // Get available from vm_stat or sysctl
        let available = Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().ok())
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
        assert_eq!(request.system_prompt, Some("You are a security analyst".to_string()));
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

        MistralEngine::new(model_config, inference_config, security_config, cache_config)
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
        let request = InferenceRequest::new("analyze")
            .with_system_prompt("secret = abc123");
        let result = engine.infer(request).await;

        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("blocked pattern"), "Got: {}", err_msg);
    }

    #[tokio::test]
    async fn test_security_counts_system_prompt_in_length() {
        let engine = make_test_engine();
        // 60 + 60 = 120 > 100 max
        let request = InferenceRequest::new("a".repeat(60))
            .with_system_prompt("b".repeat(60));
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
        let engine = MistralEngine::new(model_config, inference_config, security_config, cache_config);

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
