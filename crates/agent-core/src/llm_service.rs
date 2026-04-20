// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! LLM service integration for the core agent.

#[cfg(feature = "llm")]
use {
    agent_llm::{LLMConfig, LLMManager, ModelRegistry, create_llm_manager},
    agent_scanner::{CheckRegistry, CheckRunner, IntelligentCheckRunner},
    anyhow::Result,
    std::sync::Arc,
    tokio::sync::RwLock,
    tracing::{error, info, warn},
};

#[cfg(not(feature = "llm"))]
use agent_scanner::CheckRunner;

/// Download control signal.
#[cfg(feature = "llm")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DownloadControl {
    /// Download is running normally.
    Running,
    /// Download is paused (should wait before continuing).
    Paused,
    /// Download has been cancelled.
    Cancelled,
}

/// Progress callback type for download reporting.
#[cfg(feature = "llm")]
pub type DownloadProgressFn = Box<dyn Fn(u8, u64, u64, u64) + Send + Sync>;

/// LLM service that manages AI capabilities for the agent.
#[cfg(feature = "llm")]
pub struct LLMService {
    llm_manager: Arc<RwLock<Option<Arc<LLMManager>>>>,
    _intelligent_runner: Option<Arc<RwLock<Option<IntelligentCheckRunner>>>>,
    config_path: std::path::PathBuf,
    /// Human-readable reason why the LLM is not available (if applicable).
    init_error: RwLock<Option<String>>,
    /// Download control channel (sender side held by runtime for pause/resume/cancel).
    download_control_tx: Arc<RwLock<Option<tokio::sync::watch::Sender<DownloadControl>>>>,
    /// Download control channel (receiver side used by download loop).
    download_control_rx: Arc<RwLock<Option<tokio::sync::watch::Receiver<DownloadControl>>>>,
}

#[cfg(not(feature = "llm"))]
pub struct LLMService {
    _private: (),
}

impl LLMService {
    /// Create new LLM service.
    #[cfg(feature = "llm")]
    pub async fn new(config_path: Option<std::path::PathBuf>) -> Result<Self> {
        let config_path = config_path.unwrap_or_else(|| {
            agent_common::config::AgentConfig::platform_data_dir()
                .join("config")
                .join("llm.json")
        });

        info!("Initializing LLM service with config: {:?}", config_path);

        let service = Self {
            llm_manager: Arc::new(RwLock::new(None)),
            _intelligent_runner: None,
            config_path: config_path.clone(),
            init_error: RwLock::new(None),
            download_control_tx: Arc::new(RwLock::new(None)),
            download_control_rx: Arc::new(RwLock::new(None)),
        };

        // Try to initialize LLM manager if config exists
        if service.config_path.exists() {
            if let Err(e) = service.initialize().await {
                let reason = format!("Échec d'initialisation du modèle: {}", e);
                warn!("{}", reason);
                *service.init_error.write().await = Some(reason);
            }
        } else {
            let reason = format!(
                "Fichier de configuration introuvable: {}. Créez ce fichier à partir de l'exemple et téléchargez un modèle GGUF.",
                config_path.display()
            );
            info!("{}", reason);
            *service.init_error.write().await = Some(reason);
        }

        Ok(service)
    }

    /// Create new LLM service without LLM support.
    #[cfg(not(feature = "llm"))]
    pub async fn new(_config_path: Option<std::path::PathBuf>) -> Result<Self> {
        Ok(Self { _private: () })
    }

    /// Initialize LLM manager from configuration.
    /// Automatically downloads the model from HuggingFace if not present.
    pub async fn initialize(&self) -> Result<()> {
        if !self.config_path.exists() {
            return Err(anyhow::anyhow!(
                "Fichier de configuration LLM introuvable à {:?}",
                self.config_path
            ));
        }
        let config = LLMConfig::from_file(&self.config_path)?;

        // Auto-download model if not present
        if !config.model.path.exists() {
            info!(
                "Model file not found at {:?}, attempting auto-download...",
                config.model.path
            );
            self.download_model(&config).await?;
        }

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

    /// Download the model GGUF file from HuggingFace (simple version for auto-download).
    #[cfg(feature = "llm")]
    async fn download_model(&self, config: &LLMConfig) -> Result<()> {
        self.download_model_with_progress(config, None).await
    }

    /// Download the model with progress reporting and pause/resume/cancel support.
    ///
    /// `progress_fn`: Optional callback called with (percent, downloaded_bytes, total_bytes, speed_bps).
    #[cfg(feature = "llm")]
    pub async fn download_model_with_progress(
        &self,
        config: &LLMConfig,
        progress_fn: Option<DownloadProgressFn>,
    ) -> Result<()> {
        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;

        // Resolve download URL: config > registry > error
        let url = config
            .model
            .download_url
            .clone()
            .or_else(|| ModelRegistry::get_download_url(&config.model.name))
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "No download URL for model '{}'. Set 'download_url' in llm.json or download the GGUF file manually to {:?}",
                    config.model.name,
                    config.model.path
                )
            })?;

        let model_path = &config.model.path;

        // Ensure parent directory exists
        if let Some(parent) = model_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Set up download control channel
        let (ctrl_tx, ctrl_rx) = tokio::sync::watch::channel(DownloadControl::Running);
        {
            *self.download_control_tx.write().await = Some(ctrl_tx);
            *self.download_control_rx.write().await = Some(ctrl_rx.clone());
        }

        info!("Downloading model '{}' from {}", config.model.name, url);

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3600))
            .build()?;

        let response = client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to download model: HTTP {} from {}",
                response.status(),
                url
            ));
        }

        let total_size = response.content_length().unwrap_or(0);
        let total_mb = total_size / (1024 * 1024);
        info!(
            "Model download started: {} ({} MB)",
            config.model.name, total_mb
        );

        let tmp_path = model_path.with_extension("gguf.downloading");
        let mut file = tokio::fs::File::create(&tmp_path).await?;
        let mut stream = response.bytes_stream();

        let mut downloaded: u64 = 0;
        let mut last_log_percent: u8 = 0;
        let mut last_progress_time = std::time::Instant::now();
        let mut last_progress_bytes: u64 = 0;

        let mut ctrl_rx = ctrl_rx;

        let result: Result<()> = async {
            while let Some(chunk) = stream.next().await {
                // Check control signal
                let ctrl = *ctrl_rx.borrow();
                match ctrl {
                    DownloadControl::Cancelled => {
                        info!("Download cancelled by user");
                        return Err(anyhow::anyhow!("Téléchargement annulé par l'utilisateur"));
                    }
                    DownloadControl::Paused => {
                        info!("Download paused by user");
                        // Wait until resumed or cancelled
                        loop {
                            if ctrl_rx.changed().await.is_err() {
                                return Err(anyhow::anyhow!("Download control channel closed"));
                            }
                            let new_ctrl = *ctrl_rx.borrow();
                            match new_ctrl {
                                DownloadControl::Running => {
                                    info!("Download resumed");
                                    break;
                                }
                                DownloadControl::Cancelled => {
                                    info!("Download cancelled while paused");
                                    return Err(anyhow::anyhow!(
                                        "Téléchargement annulé par l'utilisateur"
                                    ));
                                }
                                DownloadControl::Paused => continue,
                            }
                        }
                    }
                    DownloadControl::Running => {}
                }

                let chunk = chunk?;
                file.write_all(&chunk).await?;
                downloaded += chunk.len() as u64;

                // Calculate speed and report progress
                let now = std::time::Instant::now();
                let elapsed = now.duration_since(last_progress_time);
                let speed_bps = if elapsed.as_secs_f64() > 0.0 {
                    ((downloaded - last_progress_bytes) as f64 / elapsed.as_secs_f64()) as u64
                } else {
                    0
                };

                if total_size > 0 {
                    let percent = ((downloaded as f64 / total_size as f64) * 100.0) as u8;

                    // Report progress every ~500ms or every 2%
                    if elapsed >= std::time::Duration::from_millis(500)
                        || percent >= last_log_percent + 2
                    {
                        if let Some(ref cb) = progress_fn {
                            cb(percent, downloaded, total_size, speed_bps);
                        }

                        if percent >= last_log_percent + 10 {
                            last_log_percent = percent;
                            info!(
                                "Download progress: {}% ({}/{} MB) - {:.1} MB/s",
                                percent,
                                downloaded / (1024 * 1024),
                                total_mb,
                                speed_bps as f64 / (1024.0 * 1024.0)
                            );
                        }

                        last_progress_time = now;
                        last_progress_bytes = downloaded;
                    }
                } else if elapsed >= std::time::Duration::from_secs(2) {
                    // Unknown total: report every 2s
                    if let Some(ref cb) = progress_fn {
                        cb(0, downloaded, 0, speed_bps);
                    }
                    last_progress_time = now;
                    last_progress_bytes = downloaded;
                }
            }
            Ok(())
        }
        .await;

        // Clean up control channels
        {
            *self.download_control_tx.write().await = None;
            *self.download_control_rx.write().await = None;
        }

        // Handle failure: clean up temp file
        if result.is_err() {
            let _ = tokio::fs::remove_file(&tmp_path).await;
            return result;
        }

        file.flush().await?;
        drop(file);

        tokio::fs::rename(&tmp_path, model_path).await?;

        info!(
            "Model '{}' downloaded successfully ({} MB)",
            config.model.name,
            downloaded / (1024 * 1024)
        );

        // Report completion
        if let Some(ref cb) = progress_fn {
            cb(100, downloaded, downloaded, 0);
        }

        Ok(())
    }

    /// Pause the current download.
    #[cfg(feature = "llm")]
    pub async fn pause_download(&self) {
        if let Some(ref tx) = *self.download_control_tx.read().await {
            let _ = tx.send(DownloadControl::Paused);
        }
    }

    /// Resume the current download.
    #[cfg(feature = "llm")]
    pub async fn resume_download(&self) {
        if let Some(ref tx) = *self.download_control_tx.read().await {
            let _ = tx.send(DownloadControl::Running);
        }
    }

    /// Cancel the current download.
    #[cfg(feature = "llm")]
    pub async fn cancel_download(&self) {
        if let Some(ref tx) = *self.download_control_tx.read().await {
            let _ = tx.send(DownloadControl::Cancelled);
        }
    }

    /// Check if a download is currently in progress.
    #[cfg(feature = "llm")]
    pub async fn is_downloading(&self) -> bool {
        self.download_control_tx.read().await.is_some()
    }

    /// Get the LLM config (for starting downloads from the GUI).
    #[cfg(feature = "llm")]
    pub async fn get_config(&self) -> Result<LLMConfig> {
        if !self.config_path.exists() {
            info!(
                "Fichier de configuration absent, création d'une configuration par défaut à {:?}",
                self.config_path
            );

            // Ensure config directory exists
            if let Some(parent) = self.config_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }

            let mut config = LLMConfig::default();

            // Resolve relative paths based on config path parent
            if let Some(parent) = self.config_path.parent() {
                if config.model.path.is_relative() {
                    config.model.path = parent.join(&config.model.path);
                }
                if config.cache.directory.is_relative() {
                    config.cache.directory = parent.join(&config.cache.directory);
                }
            }

            // Save it so that reload() after download can find it
            if let Err(e) = config.save_to_file(&self.config_path) {
                warn!(
                    "Impossible de sauvegarder la configuration par défaut: {}",
                    e
                );
            }

            return Ok(config);
        }
        LLMConfig::from_file(&self.config_path)
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

    /// Get the reason why LLM is unavailable (if applicable).
    #[cfg(feature = "llm")]
    pub async fn unavailable_reason(&self) -> Option<String> {
        self.init_error.read().await.clone()
    }

    /// Get the reason why LLM is unavailable (feature not compiled).
    #[cfg(not(feature = "llm"))]
    pub async fn unavailable_reason(&self) -> Option<String> {
        Some("Module IA non compilé (feature 'llm' désactivée).".to_string())
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

    /// Analyze a vulnerability finding using the LLM.
    #[cfg(feature = "llm")]
    pub async fn analyze_vulnerability(&self, finding: &agent_scanner::VulnerabilityFinding) -> Result<String> {
        let manager = self.get_manager().await.ok_or_else(|| {
            anyhow::anyhow!("LLM manager not available")
        })?;

        let severity = format!("{:?}", finding.severity).to_uppercase();
        let prompt = format!(
            "### SYSTEM: You are Sentinel-Core AI, a cybersecurity expert. \
            Analyze the following vulnerability and provide a concise assessment (exploitability, impact) \
            and a specific remediation step. Keep it under 100 words.\n\n\
            ### FINDING:\n\
            - **Package**: {}\n\
            - **Installed Version**: {}\n\
            - **CVE**: {}\n\
            - **Severity**: {}\n\
            - **Description**: {}\n\n\
            ### ANALYSIS:",
            finding.package_name,
            finding.installed_version,
            finding.cve_id.as_deref().unwrap_or("N/A"),
            severity,
            finding.description
        );

        let req = agent_llm::engine::InferenceRequest::new(&prompt)
            .with_max_tokens(512)
            .with_temperature(0.2);

        let resp = manager.engine().infer(req).await?;
        Ok(resp.text.trim().to_string())
    }

    /// Fallback for analyze_vulnerability when LLM is not compiled.
    #[cfg(not(feature = "llm"))]
    pub async fn analyze_vulnerability(&self, _finding: &agent_scanner::VulnerabilityFinding) -> Result<String> {
        Err(anyhow::anyhow!("AI analysis requires the 'llm' feature."))
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
            if !self.config_path.exists() {
                return LLMServiceStatus::NotConfigured;
            }

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
            } else if let Some(reason) = self.unavailable_reason().await {
                LLMServiceStatus::Error(reason)
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
    /// Model is being downloaded
    Downloading {
        model_name: String,
        progress_percent: u8,
        downloaded_mb: u64,
        total_mb: u64,
    },
    /// LLM ready with statistics
    Ready {
        model_name: String,
        inference_count: u64,
        memory_usage_mb: u64,
    },
    /// LLM encountered an error
    Error(String),
}

impl std::fmt::Display for LLMServiceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotAvailable => write!(f, "not_available"),
            Self::NotConfigured => write!(f, "not_configured"),
            Self::Downloading {
                model_name,
                progress_percent,
                ..
            } => {
                write!(f, "downloading ({} {}%)", model_name, progress_percent)
            }
            Self::Ready { model_name, .. } => write!(f, "ready ({})", model_name),
            Self::Error(msg) => write!(f, "error: {}", msg),
        }
    }
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
        // Availability depends on feature flags and config — just verify it doesn't panic
        let _available = service.is_available().await;
    }
}
