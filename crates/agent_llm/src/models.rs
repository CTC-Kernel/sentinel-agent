// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! LLM model definitions and capabilities.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::config::ModelCapabilities;

/// Predefined model configurations.
pub struct ModelRegistry;

impl ModelRegistry {
    /// Get recommended models for different use cases.
    pub fn get_recommended_models() -> HashMap<String, ModelInfo> {
        let mut models = HashMap::new();

        // Legacy IDs/filenames remain stable for existing installations.
        // This unverified entry must never be downloaded or recommended automatically.
        models.insert(
            "kimi-k2".to_string(),
            ModelInfo {
                name: "Ancienne entrée Kimi — source non vérifiée".to_string(),
                description:
                    "Source de téléchargement non vérifiée ; sélection automatique désactivée."
                        .to_string(),
                parameter_count: 15_000_000_000,
                context_size: 200_000,
                capabilities: ModelCapabilities::ALL,
                recommended_use: vec![
                    "Agent autonome".to_string(),
                    "Raisonnement long contexte".to_string(),
                    "Remédiation SOC".to_string(),
                    "Audit de sécurité".to_string(),
                ],
                file_size_gb: 5.6,
                vram_gb_min: 8,
                download_url: None,
                gguf_filename: Some("kimi-k2.Q4_K_M.gguf".to_string()),
            },
        );

        // Legacy key for the actual DeepSeek Qwen 14B artifact
        models.insert("kimi-k2-thinking".to_string(), ModelInfo {
            name: "DeepSeek-R1-Distill-Qwen-14B".to_string(),
            description: "Modèle de raisonnement distillé. Les conclusions doivent être vérifiées sur les preuves.".to_string(),
            parameter_count: 14_000_000_000,
            context_size: 128_000,
            capabilities: ModelCapabilities::SECURITY_ANALYSIS | ModelCapabilities::REMEDIATION | ModelCapabilities::CLASSIFICATION,
            recommended_use: vec![
                "Triage forensic".to_string(),
                "Détection zero-day".to_string(),
                "Analyse d'attaque corrélée".to_string(),
            ],
            file_size_gb: 8.99,
            vram_gb_min: 12,
            download_url: Some("https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf".to_string()),
            gguf_filename: Some("kimi-k2-thinking.Q4_K_M.gguf".to_string()),
        });

        // Legacy key for the Qwen2.5 Coder artifact
        models.insert("kimi-k2-coder".to_string(), ModelInfo {
            name: "Qwen2.5-Coder-7B-Instruct".to_string(),
            description: "Aide à la rédaction de code et de scripts à relire ; aucune exécution implicite.".to_string(),
            parameter_count: 7_000_000_000,
            context_size: 65_536,
            capabilities: ModelCapabilities::CODE_ANALYSIS | ModelCapabilities::REMEDIATION | ModelCapabilities::SECURITY_ANALYSIS,
            recommended_use: vec![
                "Automatisation de playbooks".to_string(),
                "Scripts de confinement".to_string(),
                "Audit de conformité".to_string(),
            ],
            file_size_gb: 4.68,
            vram_gb_min: 6,
            download_url: Some("https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf".to_string()),
            gguf_filename: Some("kimi-k2-coder.Q4_K_M.gguf".to_string()),
        });

        // Qwen2.5 Coder artifact (persisted key retained)
        models.insert("qwen3-coder-7b".to_string(), ModelInfo {
            name: "Qwen2.5-Coder-7B-Instruct".to_string(),
            description: "Aide à la lecture et à la rédaction de code. Validation humaine des scripts requise.".to_string(),
            parameter_count: 7_000_000_000,
            context_size: 32768,
            capabilities: ModelCapabilities::CODE_ANALYSIS | ModelCapabilities::SECURITY_ANALYSIS,
            recommended_use: vec!["Code analysis".to_string(), "Security auditing".to_string()],
            file_size_gb: 4.68,
            vram_gb_min: 6,
            download_url: Some("https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf".to_string()),
            gguf_filename: Some("qwen3-coder-7b.Q4_K_M.gguf".to_string()),
        });

        // Llama 3.1 artifact (persisted key retained)
        models.insert("llama-4-8b".to_string(), ModelInfo {
            name: "Llama 3.1 8B Instruct".to_string(),
            description: "Assistant généraliste pour synthèse et analyse de texte.".to_string(),
            parameter_count: 8_000_000_000,
            context_size: 128000,
            capabilities: ModelCapabilities::ALL,
            recommended_use: vec![
                "General analysis".to_string(),
                "Remediation".to_string(),
                "Classification".to_string(),
            ],
            file_size_gb: 4.92,
            vram_gb_min: 8,
            download_url: Some("https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf".to_string()),
            gguf_filename: Some("llama-4-8b.Q4_K_M.gguf".to_string()),
        });

        // DeepSeek Qwen 7B artifact (persisted key retained)
        models.insert("deepseek-r1-8b".to_string(), ModelInfo {
            name: "DeepSeek-R1-Distill-Qwen-7B".to_string(),
            description: "Modèle de raisonnement distillé pour explorer des hypothèses.".to_string(),
            parameter_count: 7_000_000_000,
            context_size: 65536,
            capabilities: ModelCapabilities::SECURITY_ANALYSIS | ModelCapabilities::CLASSIFICATION,
            recommended_use: vec!["Threat analysis".to_string(), "Complex reasoning".to_string()],
            file_size_gb: 4.68,
            vram_gb_min: 8,
            download_url: Some("https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf".to_string()),
            gguf_filename: Some("deepseek-r1-8b.Q4_K_M.gguf".to_string()),
        });

        // Gemma 2 2B artifact (persisted key retained)
        models.insert("gemma-3-4b".to_string(), ModelInfo {
            name: "Gemma 2 2B Instruct".to_string(),
            description: "Modèle compact pour synthèse et classification de texte.".to_string(),
            parameter_count: 2_000_000_000,
            context_size: 8192,
            capabilities: ModelCapabilities::CLASSIFICATION | ModelCapabilities::SUMMARIZATION,
            recommended_use: vec!["Basic classification".to_string(), "Summarization".to_string()],
            file_size_gb: 1.71,
            vram_gb_min: 4,
            download_url: Some("https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf".to_string()),
            gguf_filename: Some("gemma-3-4b.Q4_K_M.gguf".to_string()),
        });

        models
    }

    /// Get model info by name.
    pub fn get_model_info(name: &str) -> Option<ModelInfo> {
        Self::get_recommended_models().get(name).cloned()
    }

    /// Get the download URL for a model by name.
    pub fn get_download_url(name: &str) -> Option<String> {
        Self::get_recommended_models()
            .get(name)
            .and_then(|m| m.download_url.clone())
    }

    /// Recommend model based on use case and hardware constraints.
    pub fn recommend_model(use_case: UseCase, vram_gb: u32) -> Option<ModelInfo> {
        let models = Self::get_recommended_models();

        let candidates: Vec<_> = models
            .values()
            .filter(|m| m.download_url.is_some() && m.vram_gb_min <= vram_gb)
            .filter(|m| match use_case {
                UseCase::CodeAnalysis => m.capabilities.code_analysis,
                UseCase::SecurityAnalysis => m.capabilities.security_analysis,
                UseCase::Remediation => m.capabilities.remediation,
                UseCase::Classification => m.capabilities.classification,
                UseCase::Summarization => m.capabilities.summarization,
                UseCase::General => true,
            })
            .collect();

        // Return the model with highest parameter count that fits
        candidates
            .into_iter()
            .max_by(|a, b| {
                a.parameter_count
                    .cmp(&b.parameter_count)
                    .then_with(|| a.name.cmp(&b.name))
            })
            .cloned()
    }
}

/// Model information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub description: String,
    pub parameter_count: u64,
    pub context_size: usize,
    pub capabilities: ModelCapabilities,
    pub recommended_use: Vec<String>,
    pub file_size_gb: f32,
    pub vram_gb_min: u32,
    /// HuggingFace download URL for the GGUF file.
    pub download_url: Option<String>,
    /// Expected filename for the downloaded model.
    pub gguf_filename: Option<String>,
}

/// Use cases for model recommendation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UseCase {
    CodeAnalysis,
    SecurityAnalysis,
    Remediation,
    Classification,
    Summarization,
    General,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_registry() {
        let models = ModelRegistry::get_recommended_models();
        assert!(models.contains_key("kimi-k2"));
        assert!(models.contains_key("kimi-k2-thinking"));
        assert!(models.contains_key("kimi-k2-coder"));
        assert!(models.contains_key("qwen3-coder-7b"));
        assert!(models.contains_key("llama-4-8b"));
    }

    #[test]
    fn persisted_model_keys_resolve_to_the_actual_download_identity() {
        let llama = ModelRegistry::get_model_info("llama-4-8b").unwrap();
        assert_eq!(llama.name, "Llama 3.1 8B Instruct");
        assert!(
            llama
                .download_url
                .unwrap()
                .contains("Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf")
        );
        let reasoning = ModelRegistry::get_model_info("kimi-k2-thinking").unwrap();
        assert_eq!(reasoning.parameter_count, 14_000_000_000);
        assert!(reasoning.name.contains("DeepSeek-R1-Distill-Qwen-14B"));
        assert!(ModelRegistry::get_download_url("kimi-k2").is_none());
        assert_ne!(
            ModelRegistry::recommend_model(UseCase::General, 128)
                .unwrap()
                .name,
            "Ancienne entrée Kimi — source non vérifiée"
        );
    }

    #[test]
    fn test_model_recommendation() {
        // A downloadable model with code capabilities should be available
        let model = ModelRegistry::recommend_model(UseCase::CodeAnalysis, 8);
        assert!(model.is_some());
        assert!(model.unwrap().capabilities.code_analysis);
    }
}
