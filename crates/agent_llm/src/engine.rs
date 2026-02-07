//! LLM inference engine abstraction.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use tracing::{debug, info, warn};

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

    pub fn with_tokens(mut self, tokens: u32) -> Self {
        self.tokens_generated = tokens;
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = duration_ms;
        self
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
    model: Arc<tokio::sync::Mutex<Option<mistralrs::MistralRs>>>,
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
        let mut status = self.status.write().await;
        *status = ModelStatus::Loading;

        info!("Loading model: {}", self.config.path.display());

        // Create the model loader
        let loader = mistralrs::LoaderBuilder::new()
            .with_source(mistralrs::Source::GGUF(
                mistralrs::GGUFSource::new(self.config.path.clone()),
            ))
            .build()?;

        // Load the model
        let pipeline = loader.load_model_from_gguf()?;
        let model = mistralrs::MistralRs::new(pipeline);

        let mut model_guard = self.model.lock().await;
        *model_guard = Some(model);

        *status = ModelStatus::Ready;
        info!("Model loaded successfully");

        Ok(())
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

        // Build sampling parameters
        let sampling_params = mistralrs::SamplingParams {
            temperature: request.temperature.unwrap_or(self.inference_config.temperature),
            top_p: request.top_p.unwrap_or(self.inference_config.top_p),
            top_k: Some(self.inference_config.top_k),
            repetition_penalty: Some(self.inference_config.repetition_penalty),
            max_len: request.max_tokens.unwrap_or(self.inference_config.max_tokens),
            ..Default::default()
        };

        // Create the request
        let mistral_request = mistralrs::Request::new(
            request.prompt,
            sampling_params,
        );

        // Perform inference
        let response = model.send_chat_request(mistral_request).await?;

        let duration = start_time.elapsed();

        // Update inference count
        self.inference_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        Ok(InferenceResponse {
            text: response.choices[0].message.content.clone(),
            tokens_generated: response.usage.as_ref()
                .map(|u| u.completion_tokens as u32)
                .unwrap_or(0),
            duration_ms: duration.as_millis() as u64,
            metadata: std::collections::HashMap::new(),
        })
    }

    async fn memory_usage(&self) -> MemoryUsage {
        // This would need to be implemented based on the actual model's memory reporting
        // For now, return placeholder values
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
