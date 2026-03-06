// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Local LLM inference for intelligent security analysis
//!
//! This crate provides local LLM capabilities for security analysis,
//! vulnerability assessment, and threat intelligence within the Sentinel agent.

pub mod analyzer;
pub mod config;
pub mod engine;
pub mod models;
pub mod prompts;
pub mod remediation;
pub mod security;
pub mod utils;

// Re-export main components
pub use analyzer::{AnalysisContext, AnalysisResult, LLMAnalyzer, ScanResult, SecurityAnalysis};
pub use config::LLMConfig;
pub use engine::{
    InferenceRequest, InferenceResponse, MemoryUsage, MistralEngine, ModelEngine, ModelStatus,
    create_engine,
};
pub use models::{ModelInfo, ModelRegistry};
pub use remediation::{
    ActionType, RemediationAction, RemediationAdvisor, RemediationPlan, RemediationRequest,
    SecurityIssue, SystemContext,
};
pub use security::{
    SecurityClassification, SecurityClassifier, SecurityEvent, ThreatLevel, ThreatType,
};

use anyhow::Result;
use std::sync::Arc;

/// Model statistics.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ModelStats {
    pub model_name: String,
    pub status: ModelStatus,
    pub inference_count: u64,
    pub memory_usage: MemoryUsage,
}

/// LLM Manager to coordinate engine, analyzer, classifier, and remediation advisor.
pub struct LLMManager {
    engine: Arc<dyn ModelEngine>,
    analyzer: Arc<LLMAnalyzer>,
    classifier: Arc<SecurityClassifier>,
    advisor: Arc<RemediationAdvisor>,
    config: LLMConfig,
}

impl LLMManager {
    pub fn new(
        engine: Arc<dyn ModelEngine>,
        analyzer: Arc<LLMAnalyzer>,
        classifier: Arc<SecurityClassifier>,
        advisor: Arc<RemediationAdvisor>,
        config: LLMConfig,
    ) -> Self {
        Self {
            engine,
            analyzer,
            classifier,
            advisor,
            config,
        }
    }

    pub fn engine(&self) -> &Arc<dyn ModelEngine> {
        &self.engine
    }

    pub fn analyzer(&self) -> &Arc<LLMAnalyzer> {
        &self.analyzer
    }

    pub fn classifier(&self) -> &Arc<SecurityClassifier> {
        &self.classifier
    }

    pub fn advisor(&self) -> &Arc<RemediationAdvisor> {
        &self.advisor
    }

    pub fn config(&self) -> &LLMConfig {
        &self.config
    }

    pub async fn get_stats(&self) -> Result<ModelStats> {
        let memory = self.engine.memory_usage().await;
        let count = self.engine.inference_count().await;
        let status = self.engine.status().await;

        Ok(ModelStats {
            model_name: self.config.model.name.clone(),
            status,
            inference_count: count,
            memory_usage: memory,
        })
    }
}

/// Create a new LLM manager with default configuration.
pub async fn create_llm_manager(config: LLMConfig) -> Result<LLMManager> {
    let engine = engine::create_engine(
        &config.model,
        &config.inference,
        &config.security,
        &config.cache,
    )?;
    let analyzer = LLMAnalyzer::new(engine.clone(), &config);
    let classifier = SecurityClassifier::new(engine.clone(), &config);
    let advisor = RemediationAdvisor::new(engine.clone(), &config);

    Ok(LLMManager {
        engine,
        analyzer: Arc::new(analyzer),
        classifier: Arc::new(classifier),
        advisor: Arc::new(advisor),
        config,
    })
}
