//! Opt-in remote assistant, isolated from automatic local security analysis.
use agent_gui::ai_provider::{AiProvider, AiProviderSettings, ApiKey};
use agent_gui::events::AgentEvent;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
    mpsc,
};

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct RemoteAi {
    pub settings: AiProviderSettings,
    key: ApiKey,
    #[serde(default)]
    profiles: Vec<SavedProfile>,
}
#[derive(Clone, Serialize, Deserialize)]
struct SavedProfile {
    settings: AiProviderSettings,
    key: ApiKey,
}
impl RemoteAi {
    pub fn event(&self) -> AgentEvent {
        AgentEvent::AiProviderConfigured {
            settings: self.settings.clone(),
            has_key: !self.key.0.is_empty(),
            profiles: self
                .profiles
                .iter()
                .map(|p| (p.settings.clone(), !p.key.0.is_empty()))
                .collect(),
        }
    }
    pub fn configured(
        &self,
        mut settings: AiProviderSettings,
        key: ApiKey,
        forget: bool,
    ) -> Result<Self, String> {
        settings.model = settings.model.trim().to_string();
        settings.base_url = settings.base_url.trim().trim_end_matches('/').to_string();
        let mut profiles = self.profiles.clone();
        if self.settings.provider != AiProvider::Local {
            profiles.retain(|p| p.settings.provider != self.settings.provider);
            if !forget {
                profiles.push(SavedProfile {
                    settings: self.settings.clone(),
                    key: self.key.clone(),
                });
            }
        }
        let saved = profiles.iter().find(|p| {
            p.settings.provider == settings.provider && p.settings.base_url == settings.base_url
        });
        let key = if forget || settings.provider == AiProvider::Local {
            ApiKey::default()
        } else if key.0.trim().is_empty() {
            saved.map(|p| p.key.clone()).unwrap_or_default()
        } else {
            ApiKey(key.0.trim().to_string())
        };
        let mut candidate = Self {
            settings,
            key,
            profiles,
        };
        if candidate.settings.provider != AiProvider::Local {
            candidate.validate()?;
            candidate
                .profiles
                .retain(|p| p.settings.provider != candidate.settings.provider);
            candidate.profiles.push(SavedProfile {
                settings: candidate.settings.clone(),
                key: candidate.key.clone(),
            });
        }
        Ok(candidate)
    }
    fn validate(&self) -> Result<(), String> {
        if self.settings.provider == AiProvider::Local {
            return Err("Sélectionnez un fournisseur API pour tester la connexion.".into());
        }
        if self.settings.model.is_empty()
            || self.settings.model.len() > 200
            || !self
                .settings
                .model
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-_.:/".contains(c))
        {
            return Err(
                "Renseignez un identifiant de modèle valide fourni par votre service IA.".into(),
            );
        }
        if self.key.0.is_empty() && self.settings.provider != AiProvider::OpenAiCompatible {
            return Err("Renseignez une clé API.".into());
        }
        self.endpoint()?;
        Ok(())
    }
    fn endpoint(&self) -> Result<String, String> {
        Ok(match self.settings.provider {
            AiProvider::Local => return Err("Le modèle local n’utilise pas d’API.".into()),
            AiProvider::OpenAi => "https://api.openai.com/v1/chat/completions".into(),
            AiProvider::Anthropic => "https://api.anthropic.com/v1/messages".into(),
            AiProvider::Gemini => {
                let model = self.settings.model.trim_start_matches("models/");
                if model.contains(['/', ':']) {
                    return Err("Identifiant Gemini invalide.".into());
                }
                format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
                )
            }
            AiProvider::OpenAiCompatible => {
                let url = url::Url::parse(&self.settings.base_url)
                    .map_err(|_| "URL de base invalide (exemple : https://serveur/v1).")?;
                let loopback = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
                if url.host_str().is_none()
                    || !(url.scheme() == "https" || url.scheme() == "http" && loopback)
                    || !url.username().is_empty()
                    || url.password().is_some()
                    || url.query().is_some()
                    || url.fragment().is_some()
                {
                    return Err("Utilisez une URL HTTPS sans identifiants ni paramètres (HTTP autorisé uniquement en local).".into());
                }
                format!(
                    "{}/chat/completions",
                    self.settings.base_url.trim_end_matches('/')
                )
            }
        })
    }
    fn body(&self, system: &str, prompt: &str) -> Value {
        match self.settings.provider {
            AiProvider::Anthropic => {
                json!({"model":self.settings.model, "system":system, "max_tokens":2048, "stream":true, "messages":[{"role":"user","content":prompt}]})
            }
            AiProvider::Gemini => {
                json!({"systemInstruction":{"parts":[{"text":system}]}, "contents":[{"role":"user","parts":[{"text":prompt}]}], "generationConfig":{"maxOutputTokens":4096}})
            }
            _ => {
                json!({"model":self.settings.model, "stream":true, "messages":[{"role":"system","content":system},{"role":"user","content":prompt}]})
            }
        }
    }
    pub async fn infer(
        &self,
        system: &str,
        prompt: &str,
        cancel: Arc<AtomicBool>,
        on_delta: &mut (dyn FnMut(&str) + Send),
    ) -> Result<String, String> {
        self.validate()?;
        let operation = self.request(system, prompt, on_delta);
        tokio::pin!(operation);
        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err("Réponse interrompue.".into());
            }
            tokio::select! {
                result = &mut operation => return result,
                _ = tokio::time::sleep(std::time::Duration::from_millis(50)) => {}
            }
        }
    }
    async fn request(
        &self,
        system: &str,
        prompt: &str,
        on_delta: &mut (dyn FnMut(&str) + Send),
    ) -> Result<String, String> {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(std::time::Duration::from_secs(15))
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|_| "Impossible de créer le client IA.")?;
        let mut request = client
            .post(self.endpoint()?)
            .json(&self.body(system, prompt));
        if !self.key.0.is_empty() {
            request = match self.settings.provider {
                AiProvider::Anthropic => request.header("x-api-key", &self.key.0),
                AiProvider::Gemini => request.header("x-goog-api-key", &self.key.0),
                _ => request.bearer_auth(&self.key.0),
            };
        }
        if self.settings.provider == AiProvider::Anthropic {
            request = request.header("anthropic-version", "2023-06-01");
        }
        let response = request
            .send()
            .await
            .map_err(|_| "Connexion IA impossible : vérifiez le réseau et l’URL du service.")?;
        if !response.status().is_success() {
            return Err(match response.status().as_u16() {
                401 | 403 => "Clé API refusée ou accès au modèle non autorisé.".into(),
                404 => "Modèle ou URL introuvable. Vérifiez l’identifiant du modèle.".into(),
                429 => "Quota ou limite de requêtes atteint chez le fournisseur IA.".into(),
                code => format!("Le fournisseur IA a renvoyé une erreur HTTP {code}."),
            });
        }
        let mut stream = response.bytes_stream();
        let mut pending = Vec::new();
        let mut text = String::new();
        let mut total = 0;
        let mut completed = false;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|_| "La connexion IA s’est interrompue.")?;
            total += chunk.len();
            if total > 8 * 1024 * 1024 {
                return Err("Réponse IA trop volumineuse.".into());
            }
            pending.extend_from_slice(&chunk);
            while let Some(end) = pending.iter().position(|&b| b == b'\n') {
                let line: Vec<_> = pending.drain(..=end).collect();
                let line = std::str::from_utf8(&line).map_err(|_| "Réponse IA invalide.")?;
                completed |= stream_finished(self.settings.provider, line);
                if let Some(delta) = parse_line(self.settings.provider, line)? {
                    text.push_str(&delta);
                    on_delta(&delta);
                }
            }
            if completed {
                break;
            }
        }
        if !pending.is_empty() {
            let line = std::str::from_utf8(&pending).map_err(|_| "Réponse IA invalide.")?;
            completed |= stream_finished(self.settings.provider, line);
            if let Some(delta) = parse_line(self.settings.provider, line)? {
                text.push_str(&delta);
                on_delta(&delta);
            }
        }
        if text.trim().is_empty() {
            return Err("Le fournisseur n’a renvoyé aucun texte. Vérifiez le modèle et sa compatibilité avec la conversation.".into());
        }
        if !completed {
            return Err("Le flux IA s’est fermé avant la fin de la réponse.".into());
        }
        Ok(text)
    }
    pub async fn load(db: &agent_storage::Database) -> Result<Self, String> {
        use rusqlite::OptionalExtension;
        db.with_connection(|conn| {
            // Separate from agent_config: secrets are never included in configuration sync/export.
            conn.execute_batch("CREATE TABLE IF NOT EXISTS local_ai_credentials (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)")
                .map_err(|e| agent_storage::StorageError::Query(e.to_string()))?;
            let value: Option<String> = conn.query_row("SELECT value FROM local_ai_credentials WHERE id=1", [], |row| row.get(0)).optional()
                .map_err(|e| agent_storage::StorageError::Query(e.to_string()))?;
            match value {
                Some(value) => serde_json::from_str(&value).map_err(|_| agent_storage::StorageError::Query("Configuration IA illisible".into())),
                None => Ok(Self::default()),
            }
        }).await.map_err(|_| "Impossible de lire les paramètres IA chiffrés.".into())
    }
    pub async fn save(&self, db: &agent_storage::Database) -> Result<(), String> {
        let value = serde_json::to_string(self).map_err(|_| "Paramètres IA invalides.")?;
        db.with_connection(|conn| {
            conn.execute("INSERT INTO local_ai_credentials(id,value) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET value=excluded.value", [value])
                .map_err(|_| agent_storage::StorageError::Query("Enregistrement IA impossible".into()))?;
            Ok(())
        }).await.map_err(|_| "Impossible d’enregistrer les paramètres IA dans la base chiffrée.".into())
    }
}
fn stream_finished(provider: AiProvider, line: &str) -> bool {
    let Some(data) = line.trim().strip_prefix("data:") else {
        return false;
    };
    if data.trim() == "[DONE]" {
        return true;
    }
    let Ok(v) = serde_json::from_str::<Value>(data.trim()) else {
        return false;
    };
    match provider {
        AiProvider::Anthropic => v["type"] == "message_stop",
        AiProvider::Gemini => v["candidates"][0]["finishReason"].as_str().is_some(),
        _ => v["choices"][0]["finish_reason"].as_str().is_some(),
    }
}

fn parse_line(provider: AiProvider, line: &str) -> Result<Option<String>, String> {
    let Some(data) = line.trim().strip_prefix("data:") else {
        return Ok(None);
    };
    if data.trim() == "[DONE]" {
        return Ok(None);
    }
    let v: Value = serde_json::from_str(data.trim()).map_err(|_| "Réponse IA mal formée.")?;
    if v.get("error").is_some() || v["type"] == "error" {
        return Err("Le fournisseur a interrompu la génération.".into());
    }
    let text = match provider {
        AiProvider::Anthropic => v["delta"]["text"].as_str().unwrap_or("").to_string(),
        AiProvider::Gemini => v["candidates"][0]["content"]["parts"]
            .as_array()
            .map(|parts| {
                parts
                    .iter()
                    .filter(|p| p["thought"] != true)
                    .filter_map(|p| p["text"].as_str())
                    .collect::<String>()
            })
            .unwrap_or_default(),
        _ => v["choices"][0]["delta"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string(),
    };
    Ok((!text.is_empty()).then_some(text))
}

pub fn feedback(tx: &mpsc::Sender<AgentEvent>, message: impl Into<String>) {
    let _ = tx.send(AgentEvent::AiProviderFeedback {
        message: message.into(),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config(provider: AiProvider) -> RemoteAi {
        RemoteAi {
            settings: AiProviderSettings {
                provider,
                model: "test-model".into(),
                base_url: "https://example.com/v1".into(),
            },
            key: ApiKey("test-secret".into()),
            profiles: Vec::new(),
        }
    }
    #[tokio::test]
    async fn encrypted_profiles_survive_restart_local_switch_and_key_deletion() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("ai.db");
        let key_manager = agent_storage::KeyManager::new_with_key(&[42; 32]);
        let db = agent_storage::Database::open(
            agent_storage::DatabaseConfig::with_path(&path),
            &key_manager,
        )
        .unwrap();
        let initial = RemoteAi::load(&db).await.unwrap();
        assert_eq!(initial.settings.provider, AiProvider::Local);
        let source = config(AiProvider::Anthropic);
        let remote = initial
            .configured(source.settings.clone(), source.key.clone(), false)
            .unwrap();
        let local = remote
            .configured(AiProviderSettings::default(), ApiKey::default(), false)
            .unwrap();
        assert!(local.key.0.is_empty());
        local.save(&db).await.unwrap();
        drop(db);
        assert!(
            !std::fs::read(&path)
                .unwrap()
                .windows(b"test-secret".len())
                .any(|w| w == b"test-secret")
        );
        let db = agent_storage::Database::open(
            agent_storage::DatabaseConfig::with_path(&path),
            &key_manager,
        )
        .unwrap();
        let restored = RemoteAi::load(&db).await.unwrap();
        let remote = restored
            .configured(source.settings, ApiKey::default(), false)
            .unwrap();
        assert_eq!(remote.key.0, "test-secret");
        let erased = remote
            .configured(AiProviderSettings::default(), ApiKey::default(), true)
            .unwrap();
        erased.save(&db).await.unwrap();
        let restored = RemoteAi::load(&db).await.unwrap();
        assert!(restored.key.0.is_empty());
        assert!(restored.profiles.is_empty());
        let exported = agent_storage::ConfigRepository::new(&db)
            .get_all_map()
            .await
            .unwrap();
        assert!(
            !serde_json::to_string(&exported)
                .unwrap()
                .contains("test-secret")
        );
    }

    #[test]
    fn requests_use_native_provider_schemas() {
        assert_eq!(
            config(AiProvider::OpenAi).body("system", "question")["messages"][0]["role"],
            "system"
        );
        let claude = config(AiProvider::Anthropic).body("system", "question");
        assert_eq!(claude["system"], "system");
        assert_eq!(claude["messages"][0]["content"], "question");
        let gemini = config(AiProvider::Gemini).body("system", "question");
        assert_eq!(gemini["contents"][0]["parts"][0]["text"], "question");
        assert_eq!(gemini["systemInstruction"]["parts"][0]["text"], "system");
    }
    #[test]
    fn streams_decode_all_three_protocols_without_reasoning() {
        for (provider, event) in [
            (
                AiProvider::OpenAi,
                r#"data: {"choices":[{"delta":{"content":"Bonjour é"}}]}"#,
            ),
            (
                AiProvider::Anthropic,
                r#"data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Bonjour é"}}"#,
            ),
            (
                AiProvider::Gemini,
                r#"data: {"candidates":[{"content":{"parts":[{"text":"secret reasoning","thought":true},{"text":"Bonjour é"}]}}]}"#,
            ),
        ] {
            assert_eq!(parse_line(provider, event).unwrap().unwrap(), "Bonjour é");
        }
        assert!(
            parse_line(AiProvider::Anthropic, "event: ping")
                .unwrap()
                .is_none()
        );
        assert!(
            parse_line(AiProvider::OpenAi, "data: [DONE]")
                .unwrap()
                .is_none()
        );
        assert!(parse_line(AiProvider::OpenAi, "data: invalid").is_err());
        assert!(
            parse_line(
                AiProvider::Anthropic,
                r#"data: {"type":"error","error":{"message":"test-secret"}}"#
            )
            .unwrap_err()
            .contains("interrompu")
        );
    }
    #[test]
    fn credentials_do_not_follow_a_changed_provider_or_endpoint() {
        let original = config(AiProvider::OpenAiCompatible);
        let mut settings = original.settings.clone();
        settings.model = "another-model".into();
        assert_eq!(
            original
                .configured(settings.clone(), ApiKey::default(), false)
                .unwrap()
                .key
                .0,
            "test-secret"
        );
        settings.base_url = "https://other.example/v1".into();
        assert!(
            original
                .configured(settings.clone(), ApiKey::default(), false)
                .unwrap()
                .key
                .0
                .is_empty()
        );
        settings.provider = AiProvider::Anthropic;
        assert!(
            original
                .configured(settings, ApiKey::default(), false)
                .is_err()
        );
        let removed = original
            .configured(AiProviderSettings::default(), ApiKey::default(), true)
            .unwrap();
        assert!(removed.key.0.is_empty());
        assert_eq!(removed.settings.provider, AiProvider::Local);
        assert!(!format!("{:?}", original.key).contains("test-secret"));
        assert!(
            !serde_json::to_string(&original.event())
                .unwrap()
                .contains("test-secret")
        );
    }
    #[test]
    fn endpoints_reject_plaintext_remote_urls_and_embedded_credentials() {
        let mut c = config(AiProvider::OpenAiCompatible);
        for url in [
            "http://example.com/v1",
            "https://user:secret@example.com",
            "https://example.com?key=secret",
            "file:///etc/passwd",
            "https://example.com/#fragment",
        ] {
            c.settings.base_url = url.into();
            assert!(c.validate().is_err(), "{url}");
        }
        c.settings.base_url = "http://127.0.0.1:9999/v1".into();
        assert!(c.validate().is_ok());
        c.settings.provider = AiProvider::Gemini;
        c.settings.model = "../escape".into();
        assert!(c.validate().is_err());
    }
    #[tokio::test]
    async fn cancellation_does_not_send_a_request() {
        let c = config(AiProvider::OpenAi);
        let result = c
            .infer(
                "system",
                "prompt",
                Arc::new(AtomicBool::new(true)),
                &mut |_| panic!("unexpected delta"),
            )
            .await;
        assert!(result.unwrap_err().contains("interrompue"));
    }
    #[tokio::test]
    async fn compatible_http_stream_preserves_fragmented_utf8_and_auth() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            loop {
                let mut buf = [0; 2048];
                let n = stream.read(&mut buf).await.unwrap();
                request.extend_from_slice(&buf[..n]);
                if request.windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
            let request = String::from_utf8(request).unwrap().to_lowercase();
            assert!(request.starts_with("post /v1/chat/completions"));
            assert!(request.contains("authorization: bearer test-secret"));
            let body =
                "data: {\"choices\":[{\"delta\":{\"content\":\"écho\"}}]}\r\n\r\ndata: [DONE]\n\n";
            stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).as_bytes()).await.unwrap();
            for byte in body.as_bytes() {
                stream.write_all(&[*byte]).await.unwrap();
            }
        });
        let mut c = config(AiProvider::OpenAiCompatible);
        c.settings.base_url = format!("http://{address}/v1");
        let mut deltas = String::new();
        let text = c
            .infer(
                "system",
                "prompt",
                Arc::new(AtomicBool::new(false)),
                &mut |s| deltas.push_str(s),
            )
            .await
            .unwrap();
        assert_eq!(text, "écho");
        assert_eq!(text, deltas);
        server.await.unwrap();
    }
}
