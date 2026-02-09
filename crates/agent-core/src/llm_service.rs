//! LLM service integration for the core agent.

#[cfg(feature = "llm")]
use {
    agent_llm::{LLMConfig, LLMManager, create_llm_manager},
    agent_scanner::{CheckRegistry, CheckRunner, IntelligentCheckRunner},
    anyhow::Result,
    std::sync::Arc,
    tokio::sync::RwLock,
    tracing::{error, info, warn},
};

#[cfg(not(feature = "llm"))]
use agent_scanner::CheckRunner;

/// LLM service that manages AI capabilities for the agent.
#[cfg(feature = "llm")]
pub struct LLMService {
    llm_manager: Arc<RwLock<Option<Arc<LLMManager>>>>,
    _intelligent_runner: Option<Arc<RwLock<Option<IntelligentCheckRunner>>>>,
    config_path: std::path::PathBuf,
}

#[cfg(not(feature = "llm"))]
pub struct LLMService {
    _private: (),
}

impl LLMService {
    /// Create new LLM service.
    #[cfg(feature = "llm")]
    pub async fn new(config_path: Option<std::path::PathBuf>) -> Result<Self> {
        let config_path =
            config_path.unwrap_or_else(|| std::path::PathBuf::from("config/llm.json"));

        info!("Initializing LLM service with config: {:?}", config_path);

        let service = Self {
            llm_manager: Arc::new(RwLock::new(None)),
            _intelligent_runner: None,
            config_path,
        };

        // Try to initialize LLM manager if config exists
        if service.config_path.exists() {
            if let Err(e) = service.initialize().await {
                warn!("Failed to initialize LLM service: {}", e);
            }
        } else {
            info!(
                "LLM config not found at {:?}, LLM features disabled",
                service.config_path
            );
        }

        Ok(service)
    }

    /// Create new LLM service without LLM support.
    #[cfg(not(feature = "llm"))]
    pub async fn new(_config_path: Option<std::path::PathBuf>) -> Result<Self> {
        Ok(Self { _private: () })
    }

    /// Initialize LLM manager from configuration.
    #[cfg(feature = "llm")]
    pub async fn initialize(&self) -> Result<()> {
        let config = LLMConfig::from_file(&self.config_path)?;

        // Validate configuration
        config.validate()?;

        // Create LLM manager
        let llm_manager = create_llm_manager(config).await?;

        // Store manager
        {
            let mut manager_guard = self.llm_manager.write().await;
            *manager_guard = Some(Arc::new(llm_manager));
        }

        info!("LLM service initialized successfully");
        Ok(())
    }

    /// Check if LLM service is available.
    #[cfg(feature = "llm")]
    pub async fn is_available(&self) -> bool {
        let manager_guard = self.llm_manager.read().await;
        manager_guard.is_some()
    }

    /// Check if LLM service is available (no-op version).
    #[cfg(not(feature = "llm"))]
    pub async fn is_available(&self) -> bool {
        false
    }

    /// Get LLM manager reference.
    #[cfg(feature = "llm")]
    pub async fn get_manager(&self) -> Option<Arc<LLMManager>> {
        let manager_guard = self.llm_manager.read().await;
        manager_guard.clone()
    }

    /// Create intelligent check runner with LLM integration.
    #[cfg(feature = "llm")]
    pub async fn create_intelligent_runner(
        &self,
        base_runner: CheckRunner,
        _registry: Arc<CheckRegistry>,
    ) -> Result<IntelligentCheckRunner> {
        let llm_manager = self.get_manager().await;

        let intelligent_runner = IntelligentCheckRunner::new(base_runner, llm_manager).await?;

        Ok(intelligent_runner)
    }

    /// Create intelligent check runner without LLM (fallback).
    #[cfg(not(feature = "llm"))]
    pub async fn create_intelligent_runner(
        &self,
        base_runner: CheckRunner,
        _registry: Arc<CheckRegistry>,
    ) -> Result<CheckRunner> {
        Ok(base_runner)
    }

    /// Get LLM statistics.
    #[cfg(feature = "llm")]
    pub async fn get_stats(&self) -> Option<agent_llm::ModelStats> {
        if let Some(manager) = self.get_manager().await {
            match manager.get_stats().await {
                Ok(stats) => Some(stats),
                Err(e) => {
                    error!("Failed to get LLM stats: {}", e);
                    None
                }
            }
        } else {
            None
        }
    }

    /// Get LLM statistics (no-op version).
    #[cfg(not(feature = "llm"))]
    pub async fn get_stats(&self) -> Option<()> {
        None
    }

    /// Reload LLM configuration.
    #[cfg(feature = "llm")]
    pub async fn reload(&self) -> Result<()> {
        info!("Reloading LLM service configuration");

        // Clear current manager
        {
            let mut manager_guard = self.llm_manager.write().await;
            *manager_guard = None;
        }

        // Reinitialize
        self.initialize().await
    }

    /// Reload LLM configuration (no-op version).
    #[cfg(not(feature = "llm"))]
    pub async fn reload(&self) -> Result<()> {
        Ok(())
    }

    /// Shutdown LLM service.
    #[cfg(feature = "llm")]
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down LLM service");

        if let Some(manager) = self.get_manager().await {
            // Unload model to free memory
            manager.engine().unload().await?;
        }

        // Clear manager
        {
            let mut manager_guard = self.llm_manager.write().await;
            *manager_guard = None;
        }

        Ok(())
    }

    /// Shutdown LLM service (no-op version).
    #[cfg(not(feature = "llm"))]
    pub async fn shutdown(&self) -> Result<()> {
        Ok(())
    }

    /// Get service status.
    pub async fn get_status(&self) -> LLMServiceStatus {
        #[cfg(feature = "llm")]
        {
            if self.is_available().await {
                if let Some(stats) = self.get_stats().await {
                    LLMServiceStatus::Ready {
                        model_name: stats.model_name,
                        inference_count: stats.inference_count,
                        memory_usage_mb: stats.memory_usage.allocated_mb,
                    }
                } else {
                    LLMServiceStatus::Error("Failed to get stats".to_string())
                }
            } else {
                LLMServiceStatus::NotConfigured
            }
        }

        #[cfg(not(feature = "llm"))]
        {
            LLMServiceStatus::NotAvailable
        }
    }
}

/// LLM service status.
#[derive(Debug, Clone)]
pub enum LLMServiceStatus {
    /// LLM not available (feature not enabled)
    NotAvailable,
    /// LLM not configured
    NotConfigured,
    /// LLM ready with statistics
    Ready {
        model_name: String,
        inference_count: u64,
        memory_usage_mb: u64,
    },
    /// LLM encountered an error
    Error(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_llm_service_creation() {
        let service = LLMService::new(None).await;
        assert!(service.is_ok());
    }

    #[tokio::test]
    async fn test_llm_service_availability() {
        let service = LLMService::new(None).await.unwrap();
        let available = service.is_available().await;
        // Availability depends on feature flags and config
        println!("LLM service available: {}", available);
    }
}
