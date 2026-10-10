// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! AI assistant commands: provider settings, prompts, the local model and
//! the analyses it is asked for.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{debug, info, warn};

use super::{CommandContext, LlmService, expected};

/// The first hundred characters of a text, for the audit trail. Cut on a
/// character boundary: French prompts routinely contain multi-byte ones.
fn audit_preview(text: &str) -> String {
    if text.chars().count() > 100 {
        format!("{}...", text.chars().take(97).collect::<String>())
    } else {
        text.to_string()
    }
}

/// Record in the audit trail that the operator asked the AI model something.
fn log_ai_interaction(ctx: &mut CommandContext, task: &'static str, prompt_preview: String) {
    if let Some(ref trail) = ctx.audit_trail {
        let trail = std::sync::Arc::clone(trail);
        ctx.tasks.spawn_expected(task, expected::SHORT, async move {
            trail
                .log(
                    agent_core::audit_trail::AuditAction::AIInteraction { prompt_preview },
                    "user",
                    None,
                )
                .await;
        });
    }
}

/// An analysis of the AI model made of text only, for the item `target`.
fn analysis_text(target: String, analysis: String) -> AgentEvent {
    AgentEvent::LlmAnalysisComplete {
        target,
        analysis,
        severity_override: None,
        is_false_positive: None,
        confidence: None,
        ai_remediation_script: None,
        ai_remediation_explanation: None,
    }
}

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    match command {
        GuiCommand::ConfigureAiProvider {
            settings,
            api_key,
            forget_key,
        } => configure_ai_provider(ctx, settings, api_key, forget_key).await,
        GuiCommand::TestAiProvider { settings, api_key } => {
            test_ai_provider(ctx, settings, api_key).await
        }
        GuiCommand::LlmPrompt {
            prompt,
            context,
            speak_response,
        } => llm_prompt(ctx, prompt, context, speak_response).await,
        GuiCommand::LlmCancel => llm_cancel(ctx).await,
        GuiCommand::LlmWarmUp { context } => llm_warm_up(ctx, context).await,
        GuiCommand::LlmGetStatus => llm_get_status(ctx).await,
        GuiCommand::LlmReloadModel => llm_reload_model(ctx).await,
        GuiCommand::LlmStartDownload => llm_start_download(ctx).await,
        GuiCommand::LlmPauseDownload => llm_pause_download(ctx).await,
        GuiCommand::LlmResumeDownload => llm_resume_download(ctx).await,
        GuiCommand::LlmCancelDownload => llm_cancel_download(ctx).await,
        GuiCommand::LlmAnalyzeVulnerability {
            finding_index,
            target_id,
        } => llm_analyze_vulnerability(ctx, finding_index, target_id).await,
        GuiCommand::LlmSelectModel {
            model_key,
            model_name,
            download_url,
            gguf_filename,
        } => llm_select_model(ctx, model_key, model_name, download_url, gguf_filename).await,
        GuiCommand::LlmClassifyThreat {
            event_description,
            target_id,
        } => llm_classify_threat(ctx, event_description, target_id).await,
        GuiCommand::LlmAnalyzeRisk {
            risk_id,
            risk_title,
            risk_description,
            current_probability,
            current_impact,
        } => {
            llm_analyze_risk(
                ctx,
                risk_id,
                risk_title,
                risk_description,
                current_probability,
                current_impact,
            )
            .await
        }
        other => super::misrouted("ai", &other),
    }
}

/// Handle `GuiCommand::ConfigureAiProvider`.
async fn configure_ai_provider(
    ctx: &mut CommandContext,
    settings: agent_gui::ai_provider::AiProviderSettings,
    api_key: agent_gui::ai_provider::ApiKey,
    forget_key: bool,
) {
    match ctx.remote_ai.configured(settings, api_key, forget_key) {
        Ok(candidate) => {
            let result = match ctx.db.as_ref() {
                Some(db) => candidate.save(db).await,
                None => Err("Base chiffrée indisponible : paramètres non enregistrés.".into()),
            };
            match result {
                Ok(()) => {
                    ctx.remote_ai = candidate;
                    let _ = ctx.events.send(ctx.remote_ai.event());
                    agent_core::remote_ai::feedback(&ctx.events, "Paramètres IA enregistrés.");
                }
                Err(message) => agent_core::remote_ai::feedback(&ctx.events, message),
            }
        }
        Err(message) => agent_core::remote_ai::feedback(&ctx.events, message),
    }
}

/// Handle `GuiCommand::TestAiProvider`.
async fn test_ai_provider(
    ctx: &mut CommandContext,
    settings: agent_gui::ai_provider::AiProviderSettings,
    api_key: agent_gui::ai_provider::ApiKey,
) {
    let candidate = ctx.remote_ai.configured(settings, api_key, false);
    let tx = ctx.events.clone();
    ctx.tasks.spawn_expected("test ai provider", expected::ANALYSIS, async move {
        let result = match candidate {
            Ok(candidate) => candidate
                .infer(
                    "Reply briefly.",
                    "Reply with OK.",
                    std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
                    &mut |_| {},
                )
                .await
                .map(|_| ()),
            Err(message) => Err(message),
        };
        agent_core::remote_ai::feedback(&tx, match result {
            Ok(()) => "Connexion réussie : le modèle a répondu. Paramètres non enregistrés par ce test.".into(),
            Err(message) => message,
        });
    });
}

/// Send a prompt to the local LLM.
async fn llm_prompt(
    ctx: &mut CommandContext,
    prompt: String,
    context: Option<agent_gui::dto::LlmPromptContext>,
    speak_response: bool,
) {
    info!("[AUDIT] GUI sent LLM prompt ({} chars)", prompt.len());
    log_ai_interaction(ctx, "llm prompt: audit trail", audit_preview(&prompt));
    let remote = ctx.remote_ai.clone();
    let svc = ctx.llm_service.clone();
    #[cfg(feature = "voice")]
    let voice: Option<std::sync::Arc<agent_core::voice::VoiceService>> = ctx.voice_service.clone();
    #[cfg(feature = "voice")]
    let voice_epoch = voice.as_ref().map_or(0, |v| v.speech_generation());
    let cancel = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    if let Ok(mut slot) = ctx.llm_cancel.lock()
        && let Some(previous) = slot.replace(cancel.clone())
    {
        previous.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    let job = PromptJob {
        tx: ctx.events.clone(),
        prompt,
        context,
        speak_response,
        cancel,
        #[cfg(feature = "voice")]
        voice,
        #[cfg(feature = "voice")]
        voice_epoch,
    };
    ctx.tasks.spawn_expected("llm prompt", expected::ANALYSIS, async move {
        let start = std::time::Instant::now();
        if remote.settings.provider != agent_gui::ai_provider::AiProvider::Local {
            job.answer_remotely(&remote, start).await;
            return;
        }
        #[cfg(feature = "llm")]
        {
            if let Some(ref svc) = svc {
                if let Some(manager) = svc.get_manager().await {
                    job.answer_locally(&manager, start).await;
                    return;
                }
                let reason = svc
                    .unavailable_reason()
                    .await
                    .unwrap_or_else(|| "Modèle en cours de configuration".to_string());
                let message = format!(
                    "Analyse IA indisponible : {reason}.\n\nAucune analyse n’a été exécutée pour cette question. Ouvrez « Modèle & diagnostic » pour vérifier ou charger le modèle, puis renvoyez votre question. Les recommandations déterministes restent consultables dans l’onglet Recommandations."
                );
                job.unavailable(message, start);
                return;
            }
        }
        // LLM not available (feature disabled or no service)
        let _ = &svc; // suppress unused-variable warning when llm feature is off
        let message = "Service IA indisponible. Aucune analyse n’a été exécutée. Consultez Modèle & diagnostic avant de renvoyer votre question.".to_string();
        job.unavailable(message, start);
    });
}

/// One question to the assistant, moved into the task that answers it.
struct PromptJob {
    tx: std::sync::mpsc::Sender<AgentEvent>,
    prompt: String,
    context: Option<agent_gui::dto::LlmPromptContext>,
    /// The answer is also spoken.
    #[cfg_attr(not(feature = "voice"), allow(dead_code))]
    speak_response: bool,
    /// Set by the operator to stop the answer.
    cancel: std::sync::Arc<std::sync::atomic::AtomicBool>,
    #[cfg(feature = "voice")]
    voice: Option<std::sync::Arc<agent_core::voice::VoiceService>>,
    /// The speech this answer belongs to: a newer one silences it.
    #[cfg(feature = "voice")]
    voice_epoch: u64,
}

impl PromptJob {
    /// The system prompt and the question as the model receives them.
    fn assistant_prompt(&self) -> (String, String) {
        let context_label = self
            .context
            .map(|value| value.label_fr())
            .unwrap_or("Général");
        agent_core::llm_stream::assistant_prompt(&self.prompt, context_label, self.speak_response)
    }

    /// Answer with the remote AI provider. The answer is streamed: the
    /// interface shows it as it is written, the voice starts with the first
    /// sentence.
    async fn answer_remotely(
        &self,
        remote: &agent_core::remote_ai::RemoteAi,
        start: std::time::Instant,
    ) {
        let (system, prompt) = self.assistant_prompt();
        let mut forward = agent_core::llm_stream::DeltaForwarder::new(self.tx.clone());
        #[cfg(feature = "voice")]
        let mut speech = if self.speak_response {
            self.voice
                .as_ref()
                .and_then(|v| v.speak_stream(self.voice_epoch))
        } else {
            None
        };
        let result = remote
            .infer(&system, &prompt, self.cancel.clone(), &mut |delta| {
                forward.push(delta);
                #[cfg(feature = "voice")]
                if let Some(speech) = speech.as_mut() {
                    speech.push(delta);
                }
            })
            .await;
        forward.flush();
        let message = match result {
            Ok(text) => text,
            Err(error) => agent_core::llm_stream::interrupted_answer(
                forward.text(),
                self.cancel.load(std::sync::atomic::Ordering::SeqCst),
                &error,
            ),
        };
        let _ = self.tx.send(AgentEvent::LlmChatResponse {
            message,
            processing_time_ms: start.elapsed().as_millis() as u64,
        });
        #[cfg(feature = "voice")]
        if let Some(speech) = speech {
            speech.finish();
        }
    }

    /// Answer with the local model, streamed the same way.
    #[cfg(feature = "llm")]
    async fn answer_locally(&self, manager: &agent_llm::LLMManager, start: std::time::Instant) {
        let (system_prompt, prompt) = self.assistant_prompt();
        let max_tokens = if self.speak_response { 400 } else { 640 };
        let req = agent_llm::engine::InferenceRequest::new(&prompt)
            .with_system_prompt(system_prompt)
            .with_max_tokens(max_tokens)
            .with_temperature(0.2)
            .with_cancel(self.cancel.clone());
        // Stream the answer: the GUI shows it as it is written
        // and the voice starts with the first sentence.
        let mut forward = agent_core::llm_stream::DeltaForwarder::new(self.tx.clone());
        #[cfg(feature = "voice")]
        let mut speech = if self.speak_response {
            self.voice
                .as_ref()
                .and_then(|v| v.speak_stream(self.voice_epoch))
        } else {
            None
        };
        let result = manager
            .engine()
            .infer_stream(req, &mut |delta: &str| {
                forward.push(delta);
                #[cfg(feature = "voice")]
                if let Some(speech) = speech.as_mut() {
                    speech.push(delta);
                }
            })
            .await;
        forward.flush();
        let (message, processing_time_ms) = match result {
            Ok(resp) => (resp.text, resp.duration_ms),
            Err(e) => {
                let cancelled = self.cancel.load(std::sync::atomic::Ordering::SeqCst);
                if cancelled {
                    info!("[AUDIT] Assistant answer interrupted by the operator");
                } else {
                    warn!("LLM inference error: {}", e);
                }
                #[cfg(feature = "voice")]
                if !cancelled
                    && forward.text().trim().is_empty()
                    && let Some(speech) = speech.as_mut()
                {
                    speech.push(&format!("Erreur d'inférence : {e}"));
                }
                (
                    agent_core::llm_stream::interrupted_answer(
                        forward.text(),
                        cancelled,
                        &e.to_string(),
                    ),
                    start.elapsed().as_millis() as u64,
                )
            }
        };
        let _ = self.tx.send(AgentEvent::LlmChatResponse {
            message,
            processing_time_ms,
        });
        #[cfg(feature = "voice")]
        if let Some(speech) = speech {
            speech.finish();
        }
    }

    /// Answer that no analysis ran, in text and, when asked, in voice.
    fn unavailable(&self, message: String, start: std::time::Instant) {
        let _ = self.tx.send(AgentEvent::LlmChatResponse {
            message: message.clone(),
            processing_time_ms: start.elapsed().as_millis() as u64,
        });
        #[cfg(feature = "voice")]
        if self.speak_response
            && let Some(ref v) = self.voice
        {
            v.speak_if_current(&message, self.voice_epoch);
        }
    }
}

/// Stop the answer being generated; the partial answer is kept.
async fn llm_cancel(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI stopped the assistant answer");
    if let Ok(slot) = ctx.llm_cancel.lock()
        && let Some(flag) = slot.as_ref()
    {
        flag.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    #[cfg(feature = "voice")]
    if let Some(ref voice) = ctx.voice_service {
        voice.stop_speaking();
    }
}

/// Load the model in the background before the first question and, when
/// given, pre-process the grounded context so the first answer starts fast.
async fn llm_warm_up(ctx: &mut CommandContext, context: Option<String>) {
    if ctx.remote_ai.settings.provider != agent_gui::ai_provider::AiProvider::Local {
        return;
    }

    #[cfg(feature = "llm")]
    {
        let svc = ctx.llm_service.clone();
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("llm warm up", expected::ANALYSIS, async move {
                if let Some(ref svc) = svc
                    && let Some(manager) = svc.get_manager().await
                {
                    let started = std::time::Instant::now();
                    if let Err(e) = manager.engine().warm_up().await {
                        warn!("LLM warm-up failed: {}", e);
                        return;
                    }
                    info!("LLM model ready in {:.1}s", started.elapsed().as_secs_f64());
                    if let Some(label) = manager.engine().acceleration().await {
                        let _ = tx.send(AgentEvent::LlmAcceleration { label });
                    }
                    // Pre-process the grounded context (background
                    // priority: a question pre-empts it). The prefix
                    // cache then serves the first question.
                    if let Some(context) = context.filter(|c| !c.trim().is_empty()) {
                        let request = agent_llm::engine::InferenceRequest::new(context)
                            .with_system_prompt(agent_core::llm_stream::assistant_system_prompt())
                            .with_max_tokens(1)
                            .with_temperature(0.0)
                            .background();
                        match manager.engine().infer(request).await {
                            Ok(_) => info!(
                                "LLM context pre-processed in {:.1}s",
                                started.elapsed().as_secs_f64()
                            ),
                            Err(e) => debug!("LLM context pre-processing skipped: {}", e),
                        }
                    }
                }
            });
    }
    #[cfg(not(feature = "llm"))]
    let _ = context;
}

/// Request current LLM model status.
async fn llm_get_status(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested LLM status");
    let tx = ctx.events.clone();
    #[cfg(feature = "llm")]
    {
        let svc = ctx.llm_service.clone();
        ctx.tasks
            .spawn_expected("llm get status", expected::SHORT, async move {
                if let Some(ref svc) = svc {
                    match svc.get_status().await {
                        agent_core::llm_service::LLMServiceStatus::Ready {
                            model_name,
                            inference_count,
                            memory_usage_mb,
                        } => {
                            let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                model_name,
                                status: "ready".to_string(),
                                inference_count,
                                memory_mb: memory_usage_mb,
                            });
                        }
                        agent_core::llm_service::LLMServiceStatus::NotConfigured => {
                            let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                model_name: "N/A".to_string(),
                                status: "not_configured".to_string(),
                                inference_count: 0,
                                memory_mb: 0,
                            });
                        }
                        agent_core::llm_service::LLMServiceStatus::NotAvailable => {
                            let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                model_name: "N/A".to_string(),
                                status: "not_available".to_string(),
                                inference_count: 0,
                                memory_mb: 0,
                            });
                        }
                        agent_core::llm_service::LLMServiceStatus::Error(err) => {
                            let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                model_name: "N/A".to_string(),
                                status: format!("error: {}", err),
                                inference_count: 0,
                                memory_mb: 0,
                            });
                        }
                        agent_core::llm_service::LLMServiceStatus::Downloading {
                            model_name,
                            progress_percent,
                            downloaded_mb,
                            total_mb,
                        } => {
                            let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                model_name,
                                status: format!(
                                    "downloading: {}% ({}/{} MB)",
                                    progress_percent, downloaded_mb, total_mb
                                ),
                                inference_count: 0,
                                memory_mb: 0,
                            });
                        }
                    }
                } else {
                    let _ = tx.send(AgentEvent::LlmStatusUpdate {
                        model_name: "N/A".to_string(),
                        status: "not_available".to_string(),
                        inference_count: 0,
                        memory_mb: 0,
                    });
                }
            });
    }
    #[cfg(not(feature = "llm"))]
    {
        let _ = tx.send(AgentEvent::LlmStatusUpdate {
            model_name: "N/A".to_string(),
            status: "not_available".to_string(),
            inference_count: 0,
            memory_mb: 0,
        });
    }
}

/// Reload the LLM model.
async fn llm_reload_model(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested LLM model reload");
    let tx = ctx.events.clone();
    #[cfg(feature = "llm")]
    {
        let svc = ctx.llm_service.clone();
        let llm_handle = ctx.handle.clone();
        ctx.tasks
            .spawn_expected("llm reload model", expected::DOWNLOAD, async move {
                if let Some(ref svc) = svc {
                    if let Err(e) = svc.reload().await {
                        warn!("Failed to reload LLM model: {}", e);
                        llm_handle.set_llm_loaded(false);
                        let _ = tx.send(AgentEvent::LlmStatusUpdate {
                            model_name: "N/A".to_string(),
                            status: format!("reload_error: {}", e),
                            inference_count: 0,
                            memory_mb: 0,
                        });
                        return;
                    }
                    llm_handle.set_llm_loaded(true);
                    match svc.get_status().await {
                        agent_core::llm_service::LLMServiceStatus::Ready {
                            model_name,
                            inference_count,
                            memory_usage_mb,
                        } => {
                            let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                model_name,
                                status: "ready".to_string(),
                                inference_count,
                                memory_mb: memory_usage_mb,
                            });
                        }
                        other => {
                            let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                model_name: "N/A".to_string(),
                                status: format!("{}", other),
                                inference_count: 0,
                                memory_mb: 0,
                            });
                        }
                    }
                } else {
                    let _ = tx.send(AgentEvent::LlmStatusUpdate {
                        model_name: "N/A".to_string(),
                        status: "not_available".to_string(),
                        inference_count: 0,
                        memory_mb: 0,
                    });
                }
            });
    }
    #[cfg(not(feature = "llm"))]
    {
        let _ = tx.send(AgentEvent::LlmStatusUpdate {
            model_name: "N/A".to_string(),
            status: "not_available".to_string(),
            inference_count: 0,
            memory_mb: 0,
        });
    }
}

/// Start downloading the LLM model.
async fn llm_start_download(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested LLM model download");
    let tx = ctx.events.clone();
    #[cfg(feature = "llm")]
    {
        let svc = ctx.llm_service.clone();
        ctx.tasks
            .spawn_expected("llm start download", expected::DOWNLOAD, async move {
                if let Some(ref svc) = svc {
                    let config = match svc.get_config().await {
                        Ok(c) => c,
                        Err(e) => {
                            let _ = tx.send(AgentEvent::LlmDownloadFailed {
                                model_name: "N/A".to_string(),
                                error: format!("Configuration invalide: {}", e),
                            });
                            return;
                        }
                    };
                    let model_name = config.model.name.clone();
                    let tx2 = tx.clone();
                    let name2 = model_name.clone();
                    let progress_fn: agent_core::llm_service::DownloadProgressFn =
                        Box::new(move |percent, downloaded, total, speed| {
                            let _ = tx2.send(AgentEvent::LlmDownloadProgress {
                                model_name: name2.clone(),
                                progress_percent: percent,
                                downloaded_bytes: downloaded,
                                total_bytes: total,
                                speed_bps: speed,
                            });
                        });
                    match svc
                        .download_model_with_progress(&config, Some(progress_fn))
                        .await
                    {
                        Ok(()) => {
                            info!("LLM model download completed");
                            let total = config.model.path.metadata().map(|m| m.len()).unwrap_or(0);
                            let _ = tx.send(AgentEvent::LlmDownloadComplete {
                                model_name: model_name.clone(),
                                total_bytes: total,
                            });
                            // Auto-initialize after download
                            if let Err(e) = svc.reload().await {
                                warn!("Failed to initialize model after download: {}", e);
                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                    model_name,
                                    status: format!("init_error: {}", e),
                                    inference_count: 0,
                                    memory_mb: 0,
                                });
                            } else if let agent_core::llm_service::LLMServiceStatus::Ready {
                                model_name: name,
                                inference_count,
                                memory_usage_mb,
                            } = svc.get_status().await
                            {
                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                    model_name: name,
                                    status: "ready".to_string(),
                                    inference_count,
                                    memory_mb: memory_usage_mb,
                                });
                            }
                        }
                        Err(e) => {
                            warn!("LLM model download failed: {}", e);
                            let _ = tx.send(AgentEvent::LlmDownloadFailed {
                                model_name,
                                error: e.to_string(),
                            });
                        }
                    }
                }
            });
    }
    #[cfg(not(feature = "llm"))]
    {
        let _ = tx.send(AgentEvent::LlmDownloadFailed {
            model_name: "N/A".to_string(),
            error: "Module IA non compilé".to_string(),
        });
    }
}

/// Pause the current LLM model download.
async fn llm_pause_download(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested download pause");
    #[cfg(feature = "llm")]
    {
        let svc = ctx.llm_service.clone();
        ctx.tasks
            .spawn_expected("llm pause download", expected::SHORT, async move {
                if let Some(ref svc) = svc {
                    svc.pause_download().await;
                }
            });
    }
}

/// Resume a paused LLM model download.
async fn llm_resume_download(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested download resume");
    #[cfg(feature = "llm")]
    {
        let svc = ctx.llm_service.clone();
        ctx.tasks
            .spawn_expected("llm resume download", expected::SHORT, async move {
                if let Some(ref svc) = svc {
                    svc.resume_download().await;
                }
            });
    }
}

/// Cancel the current LLM model download.
async fn llm_cancel_download(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested download cancel");
    #[cfg(feature = "llm")]
    {
        let svc = ctx.llm_service.clone();
        ctx.tasks
            .spawn_expected("llm cancel download", expected::SHORT, async move {
                if let Some(ref svc) = svc {
                    svc.cancel_download().await;
                }
            });
    }
}

/// Analyze a specific vulnerability finding with AI.
async fn llm_analyze_vulnerability(
    ctx: &mut CommandContext,
    finding_index: usize,
    target_id: String,
) {
    info!(
        "[AUDIT] GUI requested LLM vulnerability analysis for finding #{}",
        finding_index
    );
    log_ai_interaction(
        ctx,
        "llm analyze vulnerability: audit trail",
        format!("Vulnerability analysis index: #{}", finding_index),
    );
    let tx = ctx.events.clone();
    let svc = ctx.llm_service.clone();
    let handle = ctx.handle.clone();
    ctx.tasks.spawn_expected(
        "llm analyze vulnerability",
        expected::ANALYSIS,
        async move {
            let target = target_id;
            #[cfg(feature = "llm")]
            {
                if let Some(ref svc) = svc {
                    // Retrieve finding from cache
                    let finding = {
                        let cache = handle.state.last_vuln_findings.read().await;
                        cache.as_ref().and_then(|res| {
                            res.vulnerabilities
                                .iter()
                                .find(|v| {
                                    let id = v
                                        .cve_id
                                        .clone()
                                        .or_else(|| v.advisory_id.clone())
                                        .unwrap_or_else(|| {
                                            format!(
                                                "{}-{}",
                                                v.source.to_uppercase(),
                                                v.package_name.to_uppercase()
                                            )
                                        });
                                    agent_gui::state::event_identity(
                                        "finding",
                                        &(
                                            &id,
                                            &v.package_name,
                                            &v.installed_version,
                                            &v.source,
                                            Some(v.detected_at),
                                        ),
                                    ) == target
                                })
                                .cloned()
                        })
                    };

                    if let Some(finding) = finding {
                        match svc.analyze_vulnerability(&finding).await {
                            Ok(analysis) => {
                                let _ = tx.send(analysis_text(target.clone(), analysis));
                            }
                            Err(e) => {
                                warn!("LLM vulnerability analysis error: {}", e);
                                let _ = tx.send(analysis_text(
                                    target,
                                    format!("Erreur d'analyse : {}", e),
                                ));
                            }
                        }
                        return;
                    } else {
                        warn!(
                            "LlmAnalyzeVulnerability: finding #{} not found in cache",
                            finding_index
                        );
                    }
                }
            }
            let _ = svc;
            let _ = tx.send(analysis_text(
                target,
                "Module IA non disponible ou finding introuvable.".to_string(),
            ));
        },
    );
}

/// Select a specific LLM model (by registry key, e.g. "llama-4-8b").
/// The runtime will update llm.json and reload the model.
async fn llm_select_model(
    ctx: &mut CommandContext,
    model_key: String,
    model_name: String,
    download_url: Option<String>,
    gguf_filename: Option<String>,
) {
    info!("[AUDIT] GUI requested model switch to '{}'", model_key);
    let tx = ctx.events.clone();
    let svc = ctx.llm_service.clone();
    ctx.tasks
        .spawn_expected("llm select model", expected::DOWNLOAD, async move {
            let data_dir = agent_common::config::AgentConfig::platform_data_dir();
            let Some(switch) = ModelSwitch::prepare(
                &data_dir,
                tx,
                &model_key,
                model_name,
                download_url,
                gguf_filename,
            ) else {
                return;
            };

            info!(
                "LLM config updated for model '{}', starting download/reload",
                model_key
            );

            let Some(llm_svc) = svc else {
                switch.restore_or_warn();
                switch.failed("Service IA indisponible dans cette installation".to_string());
                return;
            };
            if !switch.llm_cfg.model.path.exists() {
                // If model file doesn't exist → trigger download
                switch.download_and_load(&llm_svc).await;
            } else {
                // Model already exists locally → just reload
                switch.load_existing(&llm_svc).await;
            }
        });
}

/// A switch to another model: the configuration it wrote, and what was
/// there before. The switch is transactional: a failed download or load
/// must not leave the next start of the application pinned to a model
/// that cannot be used.
struct ModelSwitch {
    tx: std::sync::mpsc::Sender<AgentEvent>,
    /// The model's name, as the interface shows it.
    model_name: String,
    config_path: std::path::PathBuf,
    /// The configuration file before the switch; `None` when there was none.
    previous_config: Option<Vec<u8>>,
    llm_cfg: agent_llm::LLMConfig,
}

impl ModelSwitch {
    /// Write the selection of `model_key` in the model configuration under
    /// `data_dir`. Returns `None`, after telling the interface why, when
    /// the file name is not a plain `.gguf` name or the configuration
    /// cannot be written.
    fn prepare(
        data_dir: &std::path::Path,
        tx: std::sync::mpsc::Sender<AgentEvent>,
        model_key: &str,
        model_name: String,
        download_url: Option<String>,
        gguf_filename: Option<String>,
    ) -> Option<Self> {
        // Determine the config path
        let config_path = data_dir.join("config").join("llm.json");
        let previous_config = std::fs::read(&config_path).ok();

        // Load or create base config
        let mut llm_cfg = if config_path.exists() {
            agent_llm::LLMConfig::from_file(&config_path).unwrap_or_default()
        } else {
            agent_llm::LLMConfig::default()
        };

        // Update model fields
        llm_cfg.model.name = model_key.to_string();
        if let Some(ref fname) = gguf_filename {
            let candidate = std::path::Path::new(fname);
            if candidate.file_name().and_then(|value| value.to_str()) != Some(fname.as_str())
                || candidate.extension().and_then(|value| value.to_str()) != Some("gguf")
            {
                let _ = tx.send(AgentEvent::LlmDownloadFailed {
                    model_name,
                    error: "Nom de fichier GGUF non valide".to_string(),
                });
                return None;
            }
            llm_cfg.model.path = data_dir.join("models").join(fname);
        }
        // Never inherit the previous model's URL. When absent,
        // the download service resolves the selected registry key.
        llm_cfg.model.download_url = download_url;

        // Save updated config
        if let Some(parent) = config_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Err(e) = llm_cfg.save_to_file(&config_path) {
            warn!("Failed to save updated LLM config: {}", e);
            let _ = tx.send(AgentEvent::LlmDownloadFailed {
                model_name,
                error: format!("Erreur de configuration: {}", e),
            });
            return None;
        }

        Some(Self {
            tx,
            model_name,
            config_path,
            previous_config,
            llm_cfg,
        })
    }

    /// Put back the configuration that was there before the switch.
    fn restore_previous_config(&self) -> std::io::Result<()> {
        match &self.previous_config {
            Some(contents) => std::fs::write(&self.config_path, contents),
            None => match std::fs::remove_file(&self.config_path) {
                Ok(()) => Ok(()),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(error) => Err(error),
            },
        }
    }

    /// Put the previous configuration back; a failure is only logged.
    fn restore_or_warn(&self) {
        if let Err(restore_error) = self.restore_previous_config() {
            warn!("Failed to restore previous LLM config: {}", restore_error);
        }
    }

    /// Put the previous configuration back and, when there was one, load
    /// its model again.
    async fn roll_back(&self, llm_svc: &LlmService) {
        if let Err(restore_error) = self.restore_previous_config() {
            warn!("Failed to restore previous LLM config: {}", restore_error);
        } else if self.previous_config.is_some()
            && let Err(restore_error) = llm_svc.reload().await
        {
            warn!("Failed to reactivate previous LLM model: {}", restore_error);
        }
    }

    /// Tell the interface the switch failed.
    fn failed(&self, error: String) {
        let _ = self.tx.send(AgentEvent::LlmDownloadFailed {
            model_name: self.model_name.clone(),
            error,
        });
    }

    /// Tell the interface the model is in place, and its state once ready.
    async fn announce_loaded(&self, llm_svc: &LlmService) {
        let _ = self.tx.send(AgentEvent::LlmDownloadComplete {
            model_name: self.model_name.clone(),
            total_bytes: self
                .llm_cfg
                .model
                .path
                .metadata()
                .map(|metadata| metadata.len())
                .unwrap_or(0),
        });
        if let agent_core::llm_service::LLMServiceStatus::Ready {
            model_name,
            inference_count,
            memory_usage_mb,
        } = llm_svc.get_status().await
        {
            let _ = self.tx.send(AgentEvent::LlmStatusUpdate {
                model_name,
                status: "ready".to_string(),
                inference_count,
                memory_mb: memory_usage_mb,
            });
        }
    }

    /// Download the model file, with its progress shown, then load it.
    async fn download_and_load(&self, llm_svc: &LlmService) {
        let progress_tx = self.tx.clone();
        let progress_name = self.model_name.clone();
        let progress_cb: agent_core::llm_service::DownloadProgressFn =
            Box::new(move |pct, dl, total, speed| {
                let _ = progress_tx.send(AgentEvent::LlmDownloadProgress {
                    model_name: progress_name.clone(),
                    progress_percent: pct,
                    downloaded_bytes: dl,
                    total_bytes: total,
                    speed_bps: speed,
                });
            });
        match llm_svc
            .download_model_with_progress(&self.llm_cfg, Some(progress_cb))
            .await
        {
            Ok(()) => {
                // Auto-reload after download
                if let Err(e) = llm_svc.reload().await {
                    warn!("Auto-reload after download failed: {}", e);
                    self.roll_back(llm_svc).await;
                    self.failed(format!(
                        "Modèle téléchargé mais impossible à charger: {}",
                        e
                    ));
                } else {
                    self.announce_loaded(llm_svc).await;
                }
            }
            Err(e) => {
                warn!("Download failed for '{}': {}", self.model_name, e);
                self.restore_or_warn();
                self.failed(e.to_string());
            }
        }
    }

    /// Load a model whose file is already there.
    async fn load_existing(&self, llm_svc: &LlmService) {
        match llm_svc.reload().await {
            Ok(()) => self.announce_loaded(llm_svc).await,
            Err(e) => {
                warn!("Reload after model switch failed: {}", e);
                self.roll_back(llm_svc).await;
                self.failed(format!(
                    "Le fichier GGUF existe mais son chargement a échoué: {}",
                    e
                ));
            }
        }
    }
}

/// Classify a threat event with AI.
async fn llm_classify_threat(
    ctx: &mut CommandContext,
    event_description: String,
    target_id: String,
) {
    let description_preview = event_description.chars().take(80).collect::<String>();
    info!(
        "[AUDIT] GUI requested LLM threat classification: {}",
        description_preview
    );
    log_ai_interaction(
        ctx,
        "llm classify threat: audit trail",
        format!(
            "Threat classification: {}",
            audit_preview(&event_description)
        ),
    );
    let tx = ctx.events.clone();
    let svc = ctx.llm_service.clone();
    ctx.tasks.spawn_expected("llm classify threat", expected::ANALYSIS, async move {
        let start = std::time::Instant::now();
        #[cfg(feature = "llm")]
        {
            if let Some(ref svc) = svc
                && let Some(manager) = svc.get_manager().await
            {
                let event = agent_llm::security::SecurityEvent {
                    id: uuid::Uuid::new_v4().to_string(),
                    event_type: "user_submitted".to_string(),
                    description: event_description.clone(),
                    system_info: String::new(),
                    historical_context: String::new(),
                    timestamp: chrono::Utc::now(),
                    source: "gui".to_string(),
                    severity: "unknown".to_string(),
                    raw_data: serde_json::Value::Null,
                };
                match manager.classifier().classify_event(&event).await {
                    Ok(classification) => {
                        let analysis = format!(
                            "Type: {:?}\nNiveau: {:?}\nConfiance: {}%\nVecteur d'attaque: {:?}\nImpact: {}",
                            classification.threat_type,
                            classification.threat_level,
                            classification.confidence,
                            classification.attack_vector,
                            classification.impact_assessment,
                        );
                        let _ = tx.send(AgentEvent::LlmAnalysisComplete {
                            target: target_id.clone(),
                            analysis,
                            severity_override: Some(format!("{}", classification.threat_level)),
                            is_false_positive: None,
                            confidence: Some(classification.confidence),
                            ai_remediation_script: None,
                            ai_remediation_explanation: None,
                        });
                    }
                    Err(e) => {
                        warn!("LLM threat classification error: {}", e);
                        let _ = tx.send(analysis_text(target_id.clone(), format!("Erreur de classification : {}", e)));
                    }
                }
                return;
            }
        }
        let _ = svc;
        let _ = start;
        let _ = tx.send(analysis_text(target_id, "Modèle IA non disponible pour la classification des menaces.".to_string()));
    });
}

/// Analyze a risk entry with AI for enhanced scoring and mitigation.
async fn llm_analyze_risk(
    ctx: &mut CommandContext,
    risk_id: String,
    risk_title: String,
    risk_description: String,
    current_probability: u8,
    current_impact: u8,
) {
    info!(
        "[AUDIT] GUI requested AI risk analysis for: {} (prob={}, impact={})",
        risk_title, current_probability, current_impact
    );
    log_ai_interaction(
        ctx,
        "llm analyze risk: audit trail",
        format!("Risk analysis: {}", risk_title),
    );
    let _ = &risk_description; // used inside #[cfg(feature = "llm")] below
    let tx = ctx.events.clone();
    let svc = ctx.llm_service.clone();
    let rid = risk_id.clone();
    ctx.tasks.spawn_expected("llm analyze risk", expected::ANALYSIS, async move {
        #[cfg(feature = "llm")]
        {
            if let Some(ref svc) = svc
                && let Some(manager) = svc.get_manager().await
            {
                let prompt = format!(
                    "Tu es un analyste de risques en cybersécurité (GRC). Analyse le risque suivant et fournis :\n\
                     1. Une évaluation de la probabilité (1-5) et de l'impact (1-5)\n\
                     2. Une analyse détaillée (3-5 phrases)\n\
                     3. Des suggestions de mitigation concrètes (2-4 points)\n\n\
                     Risque : {risk_title}\n\
                     Description : {risk_description}\n\
                     Probabilité actuelle : {current_probability}/5\n\
                     Impact actuel : {current_impact}/5\n\n\
                     Réponds en JSON avec ce schéma :\n\
                     {{\n\
                       \"suggested_probability\": 1-5,\n\
                       \"suggested_impact\": 1-5,\n\
                       \"analysis\": \"texte d'analyse\",\n\
                       \"mitigation_suggestions\": [\"suggestion1\", \"suggestion2\"]\n\
                     }}"
                );
                let req = agent_llm::engine::InferenceRequest::new(&prompt)
                    .with_max_tokens(1024)
                    .with_temperature(0.4);
                match manager.engine().infer(req).await {
                    Ok(resp) => {
                        // Try to parse structured JSON from the response
                        let (sugg_prob, sugg_impact, analysis, mitigations) =
                            crate::parse_risk_analysis_response(&resp.text);
                        let _ = tx.send(AgentEvent::LlmRiskAnalysis {
                            risk_id: rid,
                            suggested_probability: sugg_prob,
                            suggested_impact: sugg_impact,
                            analysis,
                            mitigation_suggestions: mitigations,
                        });
                    }
                    Err(e) => {
                        warn!("LLM risk analysis error: {}", e);
                        let _ = tx.send(AgentEvent::LlmRiskAnalysis {
                            risk_id: rid,
                            suggested_probability: None,
                            suggested_impact: None,
                            analysis: format!("Erreur d'analyse IA : {}", e),
                            mitigation_suggestions: vec![],
                        });
                    }
                }
                return;
            }
        }
        let _ = &svc;
        let _ = tx.send(AgentEvent::LlmRiskAnalysis {
            risk_id: rid,
            suggested_probability: None,
            suggested_impact: None,
            analysis: "Modèle IA non disponible pour l'analyse des risques.".to_string(),
            mitigation_suggestions: vec![],
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gui_commands::testing;

    #[test]
    fn a_short_prompt_is_kept_whole_in_the_audit_trail() {
        assert_eq!(
            audit_preview("Que faire du CVE-2026-1234 ?"),
            "Que faire du CVE-2026-1234 ?"
        );
        let exactly_100 = "é".repeat(100);
        assert_eq!(audit_preview(&exactly_100), exactly_100);
    }

    #[test]
    fn a_long_prompt_is_cut_on_a_character_boundary() {
        // Multi-byte characters: cutting on bytes would panic or garble.
        let prompt = "é".repeat(150);
        let preview = audit_preview(&prompt);
        assert_eq!(preview.chars().count(), 100);
        assert_eq!(preview, format!("{}...", "é".repeat(97)));
    }

    #[test]
    fn a_text_analysis_carries_no_verdict() {
        match analysis_text(
            "finding-1".to_string(),
            "Mise à jour disponible.".to_string(),
        ) {
            AgentEvent::LlmAnalysisComplete {
                target,
                analysis,
                severity_override,
                is_false_positive,
                confidence,
                ai_remediation_script,
                ai_remediation_explanation,
            } => {
                assert_eq!(target, "finding-1");
                assert_eq!(analysis, "Mise à jour disponible.");
                assert!(severity_override.is_none() && is_false_positive.is_none());
                assert!(confidence.is_none());
                assert!(ai_remediation_script.is_none() && ai_remediation_explanation.is_none());
            }
            _ => panic!("expected an analysis"),
        }
    }

    fn switch_in(
        data_dir: &std::path::Path,
        gguf: &str,
    ) -> (Option<ModelSwitch>, std::sync::mpsc::Receiver<AgentEvent>) {
        let (tx, events) = std::sync::mpsc::channel();
        let switch = ModelSwitch::prepare(
            data_dir,
            tx,
            "mistral-7b",
            "Mistral 7B".to_string(),
            Some("https://models.example/mistral-7b.gguf".to_string()),
            Some(gguf.to_string()),
        );
        (switch, events)
    }

    #[test]
    fn a_model_switch_writes_the_selection_under_the_data_directory() {
        let dir = tempfile::tempdir().unwrap();
        let (switch, _events) = switch_in(dir.path(), "mistral-7b.Q4.gguf");

        let switch = switch.expect("a switch");
        assert!(switch.previous_config.is_none());
        let saved =
            agent_llm::LLMConfig::from_file(&dir.path().join("config").join("llm.json")).unwrap();
        assert_eq!(saved.model.name, "mistral-7b");
        assert_eq!(
            saved.model.path,
            dir.path().join("models").join("mistral-7b.Q4.gguf")
        );
        assert_eq!(
            saved.model.download_url.as_deref(),
            Some("https://models.example/mistral-7b.gguf")
        );
    }

    #[test]
    fn a_model_file_name_cannot_leave_the_models_directory() {
        for name in [
            "../../etc/evil.gguf",
            "sub/model.gguf",
            "model.bin",
            "model",
        ] {
            let dir = tempfile::tempdir().unwrap();
            let (switch, events) = switch_in(dir.path(), name);

            assert!(switch.is_none(), "{name}");
            // Refused before anything is written, and the interface is told.
            assert!(!dir.path().join("config").join("llm.json").exists());
            match events.try_recv() {
                Ok(AgentEvent::LlmDownloadFailed { model_name, error }) => {
                    assert_eq!(model_name, "Mistral 7B");
                    assert_eq!(error, "Nom de fichier GGUF non valide");
                }
                other => panic!("expected a refusal, got {:?}", other.map(|_| ())),
            }
        }
    }

    #[test]
    fn a_failed_switch_puts_the_previous_configuration_back() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config").join("llm.json");

        // No configuration before: the one written by the switch is removed.
        let (switch, _events) = switch_in(dir.path(), "first.gguf");
        let switch = switch.unwrap();
        assert!(config_path.exists());
        switch.restore_previous_config().unwrap();
        assert!(!config_path.exists());
        // Restoring twice is not an error.
        switch.restore_previous_config().unwrap();

        // A configuration before: its exact content comes back.
        let (first, _events) = switch_in(dir.path(), "first.gguf");
        drop(first);
        let before = std::fs::read(&config_path).unwrap();
        let (second, _events) = switch_in(dir.path(), "second.gguf");
        let second = second.unwrap();
        assert_ne!(std::fs::read(&config_path).unwrap(), before);
        second.restore_previous_config().unwrap();
        assert_eq!(std::fs::read(&config_path).unwrap(), before);
    }

    fn prompt_job() -> (PromptJob, std::sync::mpsc::Receiver<AgentEvent>) {
        let (tx, events) = std::sync::mpsc::channel();
        let job = PromptJob {
            tx,
            prompt: "Que faire du CVE-2026-1234 ?".to_string(),
            context: None,
            speak_response: false,
            cancel: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            #[cfg(feature = "voice")]
            voice: None,
            #[cfg(feature = "voice")]
            voice_epoch: 0,
        };
        (job, events)
    }

    #[test]
    fn an_unavailable_model_is_answered_in_the_chat() {
        let (job, events) = prompt_job();

        job.unavailable(
            "Service IA indisponible.".to_string(),
            std::time::Instant::now(),
        );

        match events.try_recv() {
            Ok(AgentEvent::LlmChatResponse { message, .. }) => {
                assert_eq!(message, "Service IA indisponible.");
            }
            other => panic!("expected a chat answer, got {:?}", other.map(|_| ())),
        }
    }

    #[test]
    fn a_question_without_context_is_a_general_one() {
        let (job, _events) = prompt_job();
        let (_, general) = job.assistant_prompt();
        let (_, expected) = agent_core::llm_stream::assistant_prompt(&job.prompt, "Général", false);
        assert_eq!(general, expected);
    }

    #[tokio::test]
    async fn a_prompt_without_any_model_is_answered_and_replaces_the_previous_one() {
        let (mut ctx, events) = testing::context();
        let previous = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        *ctx.llm_cancel.lock().unwrap() = Some(previous.clone());

        llm_prompt(&mut ctx, "Bonjour".to_string(), None, false).await;

        // The answer that was being written is told to stop.
        assert!(previous.load(std::sync::atomic::Ordering::SeqCst));
        assert!(ctx.tasks.is_running("llm prompt"));
        while !ctx.tasks.is_empty() {
            tokio::task::yield_now().await;
            ctx.tasks.reap();
        }
        match events.try_recv() {
            Ok(AgentEvent::LlmChatResponse { message, .. }) => {
                assert!(message.starts_with("Service IA indisponible."));
            }
            other => panic!("expected a chat answer, got {:?}", other.map(|_| ())),
        }
    }

    #[tokio::test]
    async fn without_an_audit_trail_nothing_is_logged() {
        let (mut ctx, _events) = testing::context();
        log_ai_interaction(&mut ctx, "llm prompt: audit trail", "question".to_string());
        assert!(ctx.tasks.is_empty());
    }
}
