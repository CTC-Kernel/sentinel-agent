//! LLM inference engine abstraction.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use tracing::info;

use super::config::{ModelConfig, InferenceConfig};

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

/// Mistral.rs based engine implementation.
pub struct MistralEngine {
    model: Arc<tokio::sync::Mutex<Option<mistralrs::Model>>>,
    config: ModelConfig,
    inference_config: InferenceConfig,
    status: Arc<tokio::sync::RwLock<ModelStatus>>,
    inference_count: Arc<std::sync::atomic::AtomicU64>,
}

impl MistralEngine {
    pub fn new(config: ModelConfig, inference_config: InferenceConfig) -> Self {
        Self {
            model: Arc::new(tokio::sync::Mutex::new(None)),
            config,
            inference_config,
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
                *model_guard = Some(model);

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
        // Ensure model is loaded
        if !self.status().await.is_ready() {
            self.load_model().await?;
        }

        let model_guard = self.model.lock().await;
        let model = model_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Model not loaded"))?;

        let start_time = std::time::Instant::now();

        let messages = mistralrs::TextMessages::new()
            .add_message(mistralrs::TextMessageRole::User, request.prompt.clone());

        let temperature = request.temperature.unwrap_or(self.inference_config.temperature) as f64;
        let top_p = request.top_p.unwrap_or(self.inference_config.top_p) as f64;
        let top_k = self.inference_config.top_k as usize;
        let repetition_penalty = self.inference_config.repetition_penalty;
        let max_tokens = request.max_tokens.unwrap_or(self.inference_config.max_tokens) as usize;

        // TODO(llm): wire sampling params to mistralrs API
        let _sampling_params = mistralrs::SamplingParams {
            temperature: Some(temperature),
            top_k: Some(top_k),
            top_p: Some(top_p),
            top_n_logprobs: 0,
            frequency_penalty: None,
            presence_penalty: None,
            stop_toks: None,
            max_len: Some(max_tokens),
            logits_bias: None,
            n_choices: 1,
            repetition_penalty: Some(repetition_penalty),
            dry_params: None,
            min_p: None,
        };

        let response = model.send_chat_request(messages).await.map_err(|e| anyhow::anyhow!(e))?;

        let duration = start_time.elapsed();

        // Update inference count
        self.inference_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        
        let text = response.choices.first()
            .map(|c| c.message.content.clone().unwrap_or_default()) // Handle Option<String>
            .ok_or_else(|| anyhow::anyhow!("LLM returned empty choices"))?;

        Ok(InferenceResponse {
            text,
            tokens_generated: u32::try_from(response.usage.completion_tokens).unwrap_or(u32::MAX), // Access directly
            duration_ms: duration.as_millis() as u64,
            metadata: std::collections::HashMap::new(),
        })
    }

    async fn memory_usage(&self) -> MemoryUsage {
        // TODO(llm): implement actual memory usage reporting
        MemoryUsage {
            allocated_mb: 0,
            peak_mb: 0,
            available_mb: 0,
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
pub fn create_engine(config: &ModelConfig) -> Result<Arc<dyn ModelEngine>> {
    let inference_config = InferenceConfig::default();
    
    let engine: Arc<dyn ModelEngine> = match config.model_type {
        super::config::ModelType::Llama4 |
        super::config::ModelType::Qwen3Coder |
        super::config::ModelType::DeepSeekR1 |
        super::config::ModelType::Gemma3 => {
            Arc::new(MistralEngine::new(config.clone(), inference_config))
        }
        super::config::ModelType::Custom(_) => {
            Arc::new(MistralEngine::new(config.clone(), inference_config))
        }
    };

    Ok(engine)
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
        assert_eq!(request.max_tokens, Some(100));
        assert_eq!(request.temperature, Some(0.8));
        assert_eq!(request.stop_sequences, vec!["\n"]);
        assert_eq!(request.metadata.get("test"), Some(&"value".to_string()));
    }

    #[test]
    fn test_model_status() {
        assert!(ModelStatus::Ready.is_ready());
        assert!(!ModelStatus::Unloaded.is_ready());
        assert!(ModelStatus::Error("test".to_string()).is_error());
        assert!(!ModelStatus::Ready.is_error());
    }
}
