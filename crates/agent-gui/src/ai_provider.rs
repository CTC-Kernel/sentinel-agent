//! User-selected assistant backend. Secrets never appear in Debug output or GUI preferences.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum AiProvider {
    #[default]
    Local,
    OpenAi,
    Anthropic,
    Gemini,
    OpenAiCompatible,
}
impl AiProvider {
    pub const ALL: [Self; 5] = [
        Self::Local,
        Self::OpenAi,
        Self::Anthropic,
        Self::Gemini,
        Self::OpenAiCompatible,
    ];
    pub fn label(self) -> &'static str {
        match self {
            Self::Local => "Modèle local",
            Self::OpenAi => "OpenAI (ChatGPT)",
            Self::Anthropic => "Anthropic (Claude)",
            Self::Gemini => "Google Gemini",
            Self::OpenAiCompatible => "API compatible OpenAI",
        }
    }
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ApiKey(pub String);
impl std::fmt::Debug for ApiKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("[REDACTED]")
    }
}
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct AiProviderSettings {
    pub provider: AiProvider,
    pub model: String,
    pub base_url: String,
}
