// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Voice commands: dictation, spoken answers and the speech model.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::info;

use super::{CommandContext, expected};

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    match command {
        GuiCommand::StopVoice => stop_voice(ctx).await,
        GuiCommand::ConfigureVoice { settings } => configure_voice(ctx, settings).await,
        GuiCommand::VoiceRefreshStatus => voice_refresh_status(ctx).await,
        GuiCommand::VoiceInstallModel { model_key } => voice_install_model(ctx, model_key).await,
        GuiCommand::VoiceCancelModelInstall => voice_cancel_model_install(ctx).await,
        GuiCommand::SetVoiceListening { enabled } => set_voice_listening(ctx, enabled).await,
        GuiCommand::SpeakNotification { text } => speak_notification(ctx, text).await,
        GuiCommand::LlmToggleVoice => llm_toggle_voice(ctx).await,
        other => super::misrouted("voice", &other),
    }
}

/// Stop microphone capture and speech without rearming hands-free mode.
/// Unlike `SetVoiceListening { enabled: false }`, the recording is discarded.
async fn stop_voice(ctx: &mut CommandContext) {
    #[cfg(feature = "voice")]
    if let Some(ref voice) = ctx.voice_service {
        voice.stop_listening();
        voice.stop_speaking();
    }
    let _ = ctx.events.send(AgentEvent::LlmVoiceState { active: false });
    let _ = ctx.events.send(AgentEvent::VoiceStatus { speaking: false });
}

/// Apply the operator's voice preferences (voice, rate, dictation...).
async fn configure_voice(ctx: &mut CommandContext, settings: agent_gui::dto::VoiceSettings) {
    #[cfg(feature = "voice")]
    if let Some(ref voice) = ctx.voice_service {
        voice.configure(settings);
    }
    #[cfg(not(feature = "voice"))]
    let _ = settings;
}

/// Ask the runtime to publish its voice capabilities.
async fn voice_refresh_status(ctx: &mut CommandContext) {
    #[cfg(feature = "voice")]
    if let Some(ref voice) = ctx.voice_service {
        voice.publish_status();
    }
    #[cfg(not(feature = "voice"))]
    let _ = ctx.events.send(AgentEvent::VoiceEngineStatus {
        info: Box::default(),
    });
}

/// Download, verify and load a Whisper model from the pinned catalogue.
async fn voice_install_model(ctx: &mut CommandContext, model_key: String) {
    info!(
        "[AUDIT] GUI requested Whisper model installation: {}",
        model_key
    );
    #[cfg(feature = "voice")]
    if let Some(voice) = ctx.voice_service.clone() {
        ctx.tasks
            .spawn_expected("voice install model", expected::DOWNLOAD, async move {
                voice.install_model(&model_key).await;
            });
    }
    #[cfg(not(feature = "voice"))]
    let _ = ctx.events.send(AgentEvent::VoiceModelInstall {
        progress: agent_gui::dto::VoiceInstallProgress {
            model_key,
            phase: agent_gui::dto::VoiceInstallPhase::Failed,
            downloaded_bytes: 0,
            total_bytes: 0,
            error: Some("Reconnaissance vocale indisponible dans cette version.".to_string()),
        },
    });
}

/// Cancel a Whisper model download.
async fn voice_cancel_model_install(ctx: &mut CommandContext) {
    #[cfg(feature = "voice")]
    if let Some(ref voice) = ctx.voice_service {
        voice.cancel_install();
    }
}

/// Enable or disable the Voice Interaction capability (STT).
/// Disabling ends the capture and transcribes what was already said.
async fn set_voice_listening(ctx: &mut CommandContext, enabled: bool) {
    info!("[AUDIT] GUI requested voice listening: {}", enabled);
    #[cfg(feature = "voice")]
    {
        let voice: Option<std::sync::Arc<agent_core::voice::VoiceService>> =
            ctx.voice_service.clone();
        let tx = ctx.events.clone();
        {
            if let Some(ref voice) = voice {
                if enabled {
                    // Natural barge-in: silence any answer/alert before
                    // opening the microphone so Whisper cannot transcribe
                    // Sentinel's own synthesized voice.
                    voice.stop_speaking();
                    voice.start_listening().await;
                } else {
                    // Ending the dictation keeps what was already
                    // said: it is transcribed right away.
                    voice.finish_listening();
                }
            } else if enabled {
                let _ = tx.send(AgentEvent::VoiceError {
                    message:
                        "Service vocal indisponible. Vérifiez le microphone et le modèle Whisper."
                            .to_string(),
                });
            }
        }
    }
    #[cfg(not(feature = "voice"))]
    {
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("set voice listening", expected::SHORT, async move {
                if enabled {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    let _ = tx.send(AgentEvent::VoiceError {
                        message: "Reconnaissance vocale indisponible dans cette version."
                            .to_string(),
                    });
                }
            });
    }
}

/// Read text through the native TTS engine.
async fn speak_notification(ctx: &mut CommandContext, text: String) {
    info!("[AUDIT] GUI requested a spoken security notification");
    let speech_started = {
        #[cfg(feature = "voice")]
        {
            if let Some(ref voice) = ctx.voice_service {
                voice.speak(&text);
                true
            } else {
                false
            }
        }
        #[cfg(not(feature = "voice"))]
        {
            false
        }
    };
    if !speech_started {
        let _ = text;
        let _ = ctx.events.send(AgentEvent::VoiceError {
            message: "Synthèse vocale indisponible dans cette version.".to_string(),
        });
        // Match the service's completion event even in
        // voice-less builds or when initialization failed.
        let _ = ctx.events.send(AgentEvent::VoiceStatus { speaking: false });
    }
}

/// Toggle voice recognition on/off (convenience wrapper around SetVoiceListening).
async fn llm_toggle_voice(ctx: &mut CommandContext) {
    // Toggle voice: uses SetVoiceListening path — GUI manages the toggle state.
    info!("[AUDIT] GUI toggled voice recognition");
    #[cfg(feature = "voice")]
    {
        let voice: Option<std::sync::Arc<agent_core::voice::VoiceService>> =
            ctx.voice_service.clone();
        ctx.tasks
            .spawn_expected("llm toggle voice", expected::SHORT, async move {
                if let Some(ref voice) = voice {
                    voice.start_listening().await;
                }
            });
    }
}
