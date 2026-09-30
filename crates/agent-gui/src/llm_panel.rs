// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Intelligence Artificielle — LLM assistant, rule-based recommendations, and model status.
//!
//! Three-tab layout:
//! 1. **Assistant IA** — Chat interface with the local LLM
//! 2. **Recommandations** — Rule-based prioritized recommendations (existing)
//! 3. **Statut Mod\u{00e8}le** — LLM model dashboard
//!
//! Synthesizes compliance checks, vulnerability findings, network alerts,
//! and threat events into prioritized, actionable recommendations.

use crate::app::AppState;
use crate::dto::{ChatRole, GuiCheckStatus, LlmTab, Severity};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::tabs::{Tab, TabBar};

/// Width of the posture hero gauge column.
const POSTURE_GAUGE_WIDTH: f32 = 180.0;

// ============================================================================
// Internal recommendation type
// ============================================================================

/// A single AI-generated recommendation.
#[derive(Clone)]
pub struct Recommendation {
    /// Source kind: "compliance", "vulnerability", "network", "threat".
    pub kind: &'static str,
    /// Severity level.
    pub severity: Severity,
    /// One-line title.
    pub title: String,
    /// Short remediation / context line.
    pub subtitle: String,
    /// Extended description for the detail drawer.
    pub detail: String,
    /// Category (for compliance) or alert_type (for network).
    pub category: String,
    /// Related frameworks (compliance only).
    pub frameworks: Vec<String>,
}

// ============================================================================
// LLM Panel
// ============================================================================

/// LLM / AI analysis panel.
#[derive(Default, Clone)]
pub struct LLMPanel;

impl LLMPanel {
    /// Show the Intelligence Artificielle page.
    pub fn show(&mut self, ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
        ui.add_space(theme::SPACE_XS);
        ui.horizontal_wrapped(|ui| {
            let (status, color) = if state.ai.is_processing {
                ("ANALYSE EN COURS", theme::WARNING)
            } else if state.ai.model_status.is_ready {
                ("MODÈLE LOCAL PRÊT", theme::SUCCESS)
            } else {
                ("MODÈLE NON PRÊT", theme::text_secondary())
            };
            widgets::status_badge(ui, status, color);
            ui.label(
                egui::RichText::new(if state.ai.model_status.model_name.is_empty() {
                    "Consultez Modèle & diagnostic pour configurer le moteur."
                } else {
                    &state.ai.model_status.model_name
                })
                .font(theme::font_small())
                .color(theme::text_secondary()),
            );
        });
        ui.add_space(theme::SPACE_MD);

        // ── Tab Bar ─────────────────────────────────────────────────────
        let selected_idx = state.ai.active_tab.index() as usize;

        let chat_count = state.ai.chat_history.len() as u32;
        // Use cached count for badge to avoid building recommendations twice per frame
        let rec_count = state.ai.recommendations_count as u32;

        let mut assistant_tab = Tab::new("Assistant IA").icon(icons::ROBOT);
        if chat_count > 0 {
            assistant_tab = assistant_tab.badge(chat_count.min(99));
        }
        let mut recs_tab = Tab::new("Recommandations").icon(icons::BRAIN);
        if rec_count > 0 {
            recs_tab = recs_tab.badge(rec_count.min(99));
        }
        let model_tab = Tab::new("Modèle & diagnostic").icon(icons::MICROCHIP);

        let tabs = vec![assistant_tab, recs_tab, model_tab];

        if let Some(new_idx) = TabBar::new(tabs, selected_idx).show(ui) {
            let new_tab = LlmTab::from_index(new_idx as u8);
            state.ai.active_tab = new_tab;
        }

        ui.add_space(theme::SPACE_SM);

        // ── Route to active tab ─────────────────────────────────────────
        match state.ai.active_tab {
            LlmTab::Assistant => Self::show_assistant_tab(ui, state),
            LlmTab::Recommendations => Self::show_recommendations_tab(ui, state),
            LlmTab::ModelStatus => Self::show_model_status_tab(ui, state),
        }
    }

    // ====================================================================
    // Tab 0: Assistant IA (Chat)
    // ====================================================================

    fn show_assistant_tab(ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;
        let mut focus_draft = false;
        let mut draft_response = None;
        ui.horizontal_wrapped(|ui| {
            ui.label(
                egui::RichText::new("Métier")
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
            );
            egui::ComboBox::from_id_salt("assistant_work_mode")
                .selected_text(
                    [
                        "SOC · Investigation",
                        "RSSI / GRC · Décision",
                        "MSP / IT · Exploitation",
                    ][state.ai.work_mode.min(2)],
                )
                .show_ui(ui, |ui| {
                    for (index, label) in [
                        "SOC · Investigation",
                        "RSSI / GRC · Décision",
                        "MSP / IT · Exploitation",
                    ]
                    .iter()
                    .enumerate()
                    {
                        ui.selectable_value(&mut state.ai.work_mode, index, *label);
                    }
                });
            ui.label(
                egui::RichText::new("Périmètre")
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
            );
            egui::ComboBox::from_id_salt("assistant_context")
                .selected_text(
                    state
                        .ai
                        .prompt_context
                        .map(|c| c.label_fr())
                        .unwrap_or("Contexte automatique"),
                )
                .show_ui(ui, |ui| {
                    ui.selectable_value(&mut state.ai.prompt_context, None, "Contexte automatique");
                    for context in [
                        crate::dto::LlmPromptContext::General,
                        crate::dto::LlmPromptContext::Vulnerabilities,
                        crate::dto::LlmPromptContext::Compliance,
                        crate::dto::LlmPromptContext::Threats,
                        crate::dto::LlmPromptContext::Network,
                    ] {
                        ui.selectable_value(
                            &mut state.ai.prompt_context,
                            Some(context),
                            context.label_fr(),
                        );
                    }
                });
            ui.menu_button("Suggestions", |ui| {
                for (label, prompt) in Self::prompt_presets(state.ai.work_mode) {
                    if ui.button(*label).on_hover_text(*prompt).clicked() {
                        state.ai.input_text = prompt.to_string();
                        state.ai.pending_voice_send = false;
                        focus_draft = true;
                        ui.close_menu();
                    }
                }
            });
            ui.menu_button("Conversation", |ui| {
                let has_messages = !state.ai.chat_history.is_empty();
                if ui
                    .add_enabled(has_messages, egui::Button::new("Copier la conversation"))
                    .clicked()
                {
                    let text = state
                        .ai
                        .chat_history
                        .iter()
                        .map(|m| {
                            format!(
                                "{} · {}\n{}",
                                m.role.label_fr(),
                                m.timestamp.format("%H:%M"),
                                m.content
                            )
                        })
                        .collect::<Vec<_>>()
                        .join("\n\n");
                    ui.ctx().copy_text(text);
                    ui.close_menu();
                }
                if ui
                    .add_enabled(
                        has_messages && !state.ai.is_processing,
                        egui::Button::new("Effacer l’historique…"),
                    )
                    .clicked()
                {
                    state.ai.confirm_clear_chat = true;
                    ui.close_menu();
                }
            });
        });
        if state.ai.confirm_clear_chat {
            widgets::card(ui, |ui| {
                ui.label(
                    "Effacer les messages de cette conversation ? Votre brouillon sera conservé.",
                );
                ui.horizontal(|ui| {
                    if ui.button("Annuler").clicked() {
                        state.ai.confirm_clear_chat = false;
                    }
                    if ui
                        .add_enabled(
                            !state.ai.is_processing,
                            egui::Button::new("Effacer les messages"),
                        )
                        .clicked()
                    {
                        state.ai.chat_history.clear();
                        state.ai.confirm_clear_chat = false;
                    }
                });
            });
        }
        ui.add_space(theme::SPACE_SM);
        // Lay out from the bottom so the composer keeps its measured height,
        // including wrapped controls. Only the transcript consumes the remainder.
        let height =
            (ui.clip_rect().bottom() - ui.next_widget_position().y - theme::SPACE_SM).max(320.0);
        let (workspace_rect, _) = ui.allocate_exact_size(
            egui::vec2(ui.available_width(), height),
            egui::Sense::hover(),
        );
        let mut workspace = ui.new_child(egui::UiBuilder::new().max_rect(workspace_rect));
        workspace.set_clip_rect(workspace_rect.intersect(ui.clip_rect()));
        egui::TopBottomPanel::bottom("assistant_composer")
            .frame(egui::Frame::NONE)
            .resizable(false)
            .show_inside(&mut workspace, |ui| {
                widgets::Card::new()
                    .padding(theme::SPACE_MD)
                    .show(ui, |ui| {
                        let chat = widgets::ChatInput::new(
                            &mut state.ai.input_text,
                            "Décrivez votre question, les faits et le résultat attendu…",
                        )
                        .multiline()
                        .height(72.0)
                        .processing(state.ai.is_processing)
                        .id_salt("assistant_prompt")
                        .show(ui);
                        draft_response = Some(chat.response);
                        let voice_send = state.ai.pending_voice_send && !state.ai.is_processing;
                        if chat.send || voice_send {
                            let prompt = state.ai.input_text.clone();
                            command = Self::submit_prompt(
                                state,
                                &prompt,
                                voice_send || state.ai.voice_conversation_enabled,
                            );
                        }
                        if let Some(voice_command) = Self::voice_controls(ui, state) {
                            command = Some(voice_command);
                        }
                    });
            });
        egui::CentralPanel::default().frame(egui::Frame::NONE).show_inside(&mut workspace, |ui| {
            let chat_height = (ui.available_height() - theme::SPACE_MD).max(80.0);
        egui::ScrollArea::vertical()
            .id_salt("llm_chat_scroll")
            .max_height(chat_height)
            .auto_shrink([false, false])
            .stick_to_bottom(!state.ai.chat_history.is_empty() || state.ai.is_processing)
            .show(ui, |ui| {
                if state.ai.chat_history.is_empty() && !state.ai.is_processing {
                    ui.add_space(if chat_height < 280.0 { 4.0 } else { (chat_height * 0.16).min(64.0) });
                    ui.vertical_centered(|ui| {
                        ui.label(egui::RichText::new("Que souhaitez-vous analyser ?")
                            .font(theme::font_heading()).color(theme::text_primary()));
                        ui.add_space(theme::SPACE_SM);
                        ui.label(egui::RichText::new("Explorez les signaux du poste et préparez vos prochaines décisions.")
                            .color(theme::text_secondary()));
                        ui.add_space(theme::SPACE_SM);
                        for (label, prompt) in Self::prompt_presets(state.ai.work_mode) {
                            if ui.add_sized([300.0_f32.min(ui.available_width()), 32.0], egui::Button::new(*label)).on_hover_text(*prompt).clicked() {
                                state.ai.input_text = prompt.to_string();
                                state.ai.pending_voice_send = false;
                                focus_draft = true;
                            }
                        }
                    });
                } else {
                    for (index, message) in state.ai.chat_history.iter().enumerate() {
                        ui.push_id(index, |ui| Self::render_chat_message(ui, message));
                        ui.add_space(theme::SPACE_MD);
                    }
                    // Once the answer streams in, the growing message is the indicator.
                    if state.ai.is_processing && state.ai.streaming_index.is_none() {
                        Self::render_processing_indicator(ui);
                    }
                }
            });
        });
        if focus_draft && let Some(response) = draft_response {
            response.request_focus();
        }
        command
    }

    fn prompt_presets(mode: usize) -> &'static [(&'static str, &'static str)] {
        match mode {
            1 => &[
                (
                    "Synthèse des risques",
                    "Prépare une synthèse des risques pour la direction : faits, impacts métier, incertitudes et décisions attendues.",
                ),
                (
                    "Preuves de conformité",
                    "Résume les contrôles en échec, les preuves disponibles et les preuves manquantes pour un audit de conformité.",
                ),
                (
                    "Plan de traitement",
                    "Propose un plan de traitement priorisé : risque, action, responsable à désigner, échéance proposée et preuve de clôture.",
                ),
            ],
            2 => &[
                (
                    "Santé du poste",
                    "Analyse la santé de ce poste : ressources, inventaire et signaux de sécurité. Distingue problèmes observés et informations manquantes.",
                ),
                (
                    "Plan de correctifs",
                    "Priorise les correctifs de vulnérabilités. Indique prérequis, impact attendu, vérification et retour arrière à prévoir.",
                ),
                (
                    "Compte rendu client",
                    "Prépare un compte rendu d'exploitation : état observé, incidents, actions recommandées et points à confirmer. N'invente aucune action réalisée.",
                ),
            ],
            _ => &[
                (
                    "Triage des alertes",
                    "Priorise les alertes et menaces observées. Cite les preuves, indique les hypothèses et propose les prochaines vérifications.",
                ),
                (
                    "Exposition aux CVE",
                    "Résume les vulnérabilités détectées, leur exposition et les correctifs prioritaires. Signale les données manquantes.",
                ),
                (
                    "Plan d’investigation",
                    "Prépare un plan d'investigation des signaux suspects : faits, hypothèses, preuves à collecter et critères pour confirmer ou écarter la menace.",
                ),
            ],
        }
    }

    pub(crate) fn reset_voice_session(state: &mut AppState) {
        state.ai.voice_conversation_enabled = false;
        state.ai.pending_voice_send = false;
        state.ai.voice_reply_pending = false;
        state.ai.is_listening = false;
        state.ai.is_speaking = false;
        state.ai.mic_level = 0.0;
        state.ai.is_transcribing = false;
        state.ai.voice_relisten_pending = false;
        state.ai.voice_empty_rounds = 0;
    }

    /// Missing Whisper model: explain and open the settings instead of
    /// sending a command that can only fail.
    fn require_dictation_model(state: &mut AppState) -> Option<GuiCommand> {
        state.ai.voice_error = Some(
            "La dictée utilise un modèle Whisper local qui n’est pas encore installé.".to_string(),
        );
        state.ai.voice_notice = None;
        state.ai.voice_settings_open = true;
        None
    }

    /// Start a hands-free conversation: listen, send automatically, read the
    /// answer aloud, then listen again.
    pub(crate) fn start_conversation(state: &mut AppState) -> Option<GuiCommand> {
        if !state.ai.dictation_available() {
            return Self::require_dictation_model(state);
        }
        state.ai.voice_conversation_enabled = true;
        state.ai.voice_empty_rounds = 0;
        state.ai.voice_error = None;
        state.ai.voice_notice = None;
        state.ai.pending_voice_send = false;
        state.ai.voice_reply_pending = false;
        state.ai.is_listening = true;
        Some(GuiCommand::SetVoiceListening { enabled: true })
    }

    /// Start or end a dictation. Ending keeps and transcribes what was said.
    pub(crate) fn toggle_dictation(state: &mut AppState) -> Option<GuiCommand> {
        if !state.ai.is_listening && !state.ai.dictation_available() {
            return Self::require_dictation_model(state);
        }
        state.ai.is_listening = !state.ai.is_listening;
        state.ai.pending_voice_send = false;
        state.ai.voice_reply_pending = false;
        state.ai.voice_error = None;
        state.ai.voice_notice = None;
        state.ai.voice_empty_rounds = 0;
        if state.ai.is_listening {
            state.ai.is_speaking = false;
        }
        Some(GuiCommand::SetVoiceListening {
            enabled: state.ai.is_listening,
        })
    }

    fn voice_status_label(state: &AppState) -> &'static str {
        let ai = &state.ai;
        if ai.is_transcribing {
            "Transcription…"
        } else if ai.is_listening && ai.voice_conversation_enabled {
            "À l’écoute… parlez naturellement"
        } else if ai.is_listening {
            "Dictée en cours…"
        } else if ai.is_speaking {
            "Sentinel répond…"
        } else if ai.is_processing && ai.voice_reply_pending {
            "Réflexion…"
        } else {
            ""
        }
    }

    /// Voice controls under the composer: hands-free conversation, dictation,
    /// playback, settings and an actionable status.
    fn voice_controls(ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;
        let session_active = state.ai.is_listening
            || state.ai.is_speaking
            || state.ai.voice_reply_pending
            || state.ai.is_transcribing
            || state.ai.voice_relisten_pending;
        let hands_free = state.ai.voice_conversation_enabled
            && (session_active || state.ai.is_processing || state.ai.pending_voice_send);
        ui.horizontal_wrapped(|ui| {
            if state.ai.is_processing
                && ui
                    .add_enabled(
                        !state.ai.cancel_requested,
                        egui::Button::new(format!("{} Arrêter la réponse", icons::STOP)),
                    )
                    .on_hover_text("Interrompt la génération ; le texte déjà produit est conservé")
                    .clicked()
            {
                state.ai.cancel_requested = true;
                // The runtime also silences the voice: do not reopen the mic.
                state.ai.voice_reply_pending = false;
                command = Some(GuiCommand::LlmCancel);
            }
            if hands_free {
                if ui
                    .button(format!("{} Quitter la conversation", icons::STOP))
                    .on_hover_text("Ferme le micro et arrête la lecture")
                    .clicked()
                {
                    Self::reset_voice_session(state);
                    command = Some(GuiCommand::StopVoice);
                }
                if state.ai.is_listening
                    && !state.ai.is_transcribing
                    && ui
                        .button(format!("{} J’ai fini", icons::PAPER_PLANE))
                        .on_hover_text("Envoyer maintenant sans attendre le silence")
                        .clicked()
                {
                    command = Some(GuiCommand::SetVoiceListening { enabled: false });
                }
                if state.ai.is_speaking
                    && ui
                        .button(format!("{} Interrompre et parler", icons::MICROPHONE))
                        .on_hover_text("Coupe la réponse et rouvre le micro")
                        .clicked()
                {
                    state.ai.voice_reply_pending = false;
                    state.ai.is_speaking = false;
                    state.ai.is_listening = true;
                    command = Some(GuiCommand::SetVoiceListening { enabled: true });
                }
            } else {
                if ui
                    .add_enabled(
                        !state.ai.is_processing && !state.ai.is_listening,
                        egui::Button::new(format!("{} Parler", icons::HEADPHONES)),
                    )
                    .on_hover_text("Conversation vocale mains libres : vous parlez, Sentinel répond à voix haute puis vous écoute de nouveau")
                    .clicked()
                {
                    command = Self::start_conversation(state);
                }
                let label = if state.ai.is_listening {
                    format!("{} Terminer la dictée", icons::STOP)
                } else {
                    format!("{} Dicter", icons::MICROPHONE)
                };
                if ui
                    .add_enabled(
                        !state.ai.is_processing || state.ai.is_listening,
                        egui::Button::new(label),
                    )
                    .on_hover_text("Dicter un brouillon à relire avant envoi. Terminer conserve ce qui a été dit.")
                    .clicked()
                {
                    state.ai.voice_conversation_enabled = false;
                    command = Self::toggle_dictation(state);
                }
            }

            let status = Self::voice_status_label(state);
            if !status.is_empty() {
                ui.label(egui::RichText::new(status).color(theme::text_secondary()));
            }
            if state.ai.is_listening {
                ui.add(
                    egui::ProgressBar::new(state.ai.mic_level.clamp(0.0, 1.0))
                        .desired_width(90.0)
                        .text("Micro"),
                );
            }
            if !hands_free {
                if state.ai.is_speaking || state.ai.voice_reply_pending {
                    if ui
                        .button(format!("{} Arrêter la lecture", icons::STOP))
                        .clicked()
                    {
                        Self::reset_voice_session(state);
                        command = Some(GuiCommand::StopVoice);
                    }
                } else if !state.ai.is_listening
                    && let Some(message) = state
                        .ai
                        .chat_history
                        .iter()
                        .rev()
                        .find(|m| m.role == ChatRole::Assistant)
                    && ui
                        .add_enabled(
                            !state.ai.is_processing,
                            egui::Button::new(format!("{} Lire la réponse", icons::VOLUME_HIGH)),
                        )
                        .on_hover_text("Lire la dernière réponse à voix haute")
                        .clicked()
                {
                    command = Some(GuiCommand::SpeakNotification {
                        text: message.content.clone(),
                    });
                    state.ai.is_speaking = true;
                    state.ai.voice_reply_pending = false;
                }
            }
            if ui
                .button(format!("{} Réglages vocaux", icons::GEAR))
                .on_hover_text("Voix, vitesse, dictée, alertes vocales")
                .clicked()
            {
                state.ai.voice_settings_open = true;
            }
        });
        ui.label(
            egui::RichText::new("Entrée : envoyer · Maj+Entrée : nouvelle ligne")
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );
        if let Some(feedback) = Self::voice_feedback(ui, state) {
            command = Some(feedback);
        }
        command
    }

    fn install_button_label(key: &str) -> String {
        let size = crate::dto::whisper_model_spec(key)
            .map(|spec| spec.size_label())
            .unwrap_or_default();
        format!("{} Installer la dictée ({size})", icons::DOWNLOAD)
    }

    /// Installation progress, actionable errors and informational notices.
    fn voice_feedback(ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
        use crate::dto::VoiceInstallPhase;
        let mut command = None;
        if let Some(install) = state.ai.voice_install.clone() {
            match install.phase {
                phase if phase.is_active() => {
                    ui.add_space(theme::SPACE_XS);
                    ui.horizontal_wrapped(|ui| {
                        let fraction = if install.total_bytes > 0 {
                            install.downloaded_bytes as f32 / install.total_bytes as f32
                        } else {
                            0.0
                        };
                        let text = match phase {
                            VoiceInstallPhase::Verifying => {
                                "Vérification de l’intégrité…".to_string()
                            }
                            VoiceInstallPhase::Loading => "Chargement du modèle…".to_string(),
                            _ => format!("Installation de la dictée · {:.0} %", fraction * 100.0),
                        };
                        ui.add(
                            egui::ProgressBar::new(fraction.clamp(0.0, 1.0))
                                .desired_width(220.0)
                                .text(text),
                        );
                        if phase == VoiceInstallPhase::Downloading && ui.button("Annuler").clicked()
                        {
                            command = Some(GuiCommand::VoiceCancelModelInstall);
                        }
                    });
                }
                VoiceInstallPhase::Failed => {
                    ui.add_space(theme::SPACE_XS);
                    ui.horizontal_wrapped(|ui| {
                        ui.label(
                            egui::RichText::new(format!(
                                "{} Installation de la dictée impossible : {}",
                                icons::WARNING,
                                install.error.as_deref().unwrap_or("erreur inconnue")
                            ))
                            .font(theme::font_small())
                            .color(theme::readable_color(theme::ERROR)),
                        );
                        if ui.button("Réessayer").clicked() {
                            command = Some(GuiCommand::VoiceInstallModel {
                                model_key: install.model_key.clone(),
                            });
                        }
                        if ui
                            .small_button(icons::XMARK)
                            .on_hover_text("Masquer")
                            .clicked()
                        {
                            state.ai.voice_install = None;
                        }
                    });
                }
                _ => {}
            }
        }

        if let Some(error) = state.ai.voice_error.clone() {
            ui.add_space(theme::SPACE_XS);
            let missing_model = !state.ai.dictation_available();
            ui.horizontal_wrapped(|ui| {
                let title = if missing_model {
                    format!("{} Dictée non installée.", icons::MICROPHONE_SLASH)
                } else {
                    format!("{} Problème vocal :", icons::WARNING)
                };
                ui.label(
                    egui::RichText::new(title)
                        .font(theme::font_small())
                        .strong()
                        .color(theme::readable_color(theme::ERROR)),
                );
                ui.add(
                    egui::Label::new(
                        egui::RichText::new(if missing_model {
                            "Whisper s’exécute localement : aucun son ne quitte le poste."
                        } else {
                            error.as_str()
                        })
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                    )
                    .wrap()
                    .selectable(true),
                );
            });
            ui.horizontal_wrapped(|ui| {
                if missing_model && !state.ai.voice_install_active() {
                    let key = state.ai.voice_settings.whisper_model.clone();
                    if ui.button(Self::install_button_label(&key)).clicked() {
                        state.ai.voice_error = None;
                        command = Some(GuiCommand::VoiceInstallModel { model_key: key });
                    }
                }
                if ui.small_button("Masquer").clicked() {
                    state.ai.voice_error = None;
                }
            });
        } else if let Some(notice) = state.ai.voice_notice.clone() {
            ui.add_space(theme::SPACE_XS);
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    egui::RichText::new(format!("{} {notice}", icons::INFO_CIRCLE))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                );
                if ui
                    .small_button(icons::XMARK)
                    .on_hover_text("Masquer")
                    .clicked()
                {
                    state.ai.voice_notice = None;
                }
            });
        }
        command
    }

    /// Voice preferences window, reachable from the assistant, the dashboard
    /// and the floating assistant.
    pub fn voice_settings_window(ctx: &egui::Context, state: &mut AppState) -> Vec<GuiCommand> {
        use crate::dto::{SpokenReplyMode, VoiceAlertThreshold, WHISPER_MODELS};
        let mut commands = Vec::new();
        if !state.ai.voice_settings_open {
            return commands;
        }
        let before = state.ai.voice_settings.clone();
        let mut open = true;
        let max_height = (ctx.screen_rect().height() - 80.0).max(240.0);
        egui::Window::new(format!("{} Réglages vocaux", icons::GEAR))
            .id(egui::Id::new("voice_settings_window"))
            .open(&mut open)
            .collapsible(false)
            .resizable(true)
            .default_width(460.0)
            .max_height(max_height)
            .show(ctx, |ui| {
                egui::ScrollArea::vertical().auto_shrink([false, true]).show(ui, |ui| {
                    let engine = state.ai.voice_engine.clone().unwrap_or_default();
                    let known = state.ai.voice_engine.is_some();

                    // ── Dictation & conversation ──────────────────────────
                    ui.heading("Dictée et conversation");
                    let status = if !known {
                        "État en cours de vérification…".to_string()
                    } else if let Some(model) = engine.stt_model.as_deref() {
                        let label = crate::dto::whisper_model_spec(model)
                            .map_or(model, |spec| spec.label);
                        format!("{} Dictée prête · modèle {label}", icons::CIRCLE_CHECK)
                    } else if engine.stt_ready {
                        format!("{} Dictée prête (chargée à la première utilisation)", icons::CIRCLE_CHECK)
                    } else {
                        format!("{} Dictée non installée", icons::MICROPHONE_SLASH)
                    };
                    ui.label(egui::RichText::new(status).color(theme::text_secondary()));
                    ui.add_space(theme::SPACE_XS);

                    let selected_key = state.ai.voice_settings.whisper_model.clone();
                    let selected = crate::dto::whisper_model_spec(&selected_key)
                        .unwrap_or(&WHISPER_MODELS[1]);
                    ui.horizontal_wrapped(|ui| {
                        ui.label("Modèle de reconnaissance");
                        egui::ComboBox::from_id_salt("voice_whisper_model")
                            .selected_text(format!("{} · {}", selected.label, selected.size_label()))
                            .show_ui(ui, |ui| {
                                for spec in WHISPER_MODELS {
                                    let installed = engine.installed_models.iter().any(|key| key == spec.key);
                                    let text = format!(
                                        "{} · {}{}",
                                        spec.label,
                                        spec.size_label(),
                                        if installed { " · installé" } else { "" }
                                    );
                                    ui.selectable_value(
                                        &mut state.ai.voice_settings.whisper_model,
                                        spec.key.to_string(),
                                        text,
                                    )
                                    .on_hover_text(spec.description);
                                }
                            });
                    });
                    ui.label(
                        egui::RichText::new(selected.description)
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );
                    let selected_installed = engine.installed_models.iter().any(|key| key == selected.key);
                    if state.ai.voice_install_active() {
                        ui.label(
                            egui::RichText::new("Installation en cours, suivez la progression sous le champ de saisie.")
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        );
                        if ui.button("Annuler l’installation").clicked() {
                            commands.push(GuiCommand::VoiceCancelModelInstall);
                        }
                    } else if !selected_installed {
                        if ui.button(Self::install_button_label(selected.key)).clicked() {
                            state.ai.voice_error = None;
                            commands.push(GuiCommand::VoiceInstallModel {
                                model_key: selected.key.to_string(),
                            });
                        }
                    } else if engine.stt_model.as_deref() != Some(selected.key) {
                        ui.label(
                            egui::RichText::new("Ce modèle sera utilisé à la prochaine dictée.")
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        );
                    }
                    ui.label(
                        egui::RichText::new("Téléchargement unique depuis huggingface.co (ggerganov/whisper.cpp), intégrité vérifiée par SHA-256. La transcription s’exécute entièrement sur ce poste.")
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );
                    ui.add_space(theme::SPACE_SM);

                    ui.horizontal_wrapped(|ui| {
                        ui.label("Langue parlée");
                        let language = &mut state.ai.voice_settings.dictation_language;
                        let label = match language.as_str() {
                            "en" => "Anglais",
                            "auto" => "Détection automatique",
                            _ => "Français",
                        };
                        egui::ComboBox::from_id_salt("voice_dictation_language")
                            .selected_text(label)
                            .show_ui(ui, |ui| {
                                ui.selectable_value(language, "fr".to_string(), "Français");
                                ui.selectable_value(language, "en".to_string(), "Anglais");
                                ui.selectable_value(language, "auto".to_string(), "Détection automatique");
                            });
                    });
                    let mut pause_secs = state.ai.voice_settings.end_of_speech_ms as f32 / 1000.0;
                    if ui
                        .add(
                            egui::Slider::new(&mut pause_secs, 0.5..=3.0)
                                .step_by(0.1)
                                .suffix(" s")
                                .text("Silence de fin de phrase"),
                        )
                        .on_hover_text("Durée de silence avant que Sentinel considère que vous avez terminé")
                        .changed()
                    {
                        state.ai.voice_settings.end_of_speech_ms = (pause_secs * 1000.0).round() as u32;
                    }
                    ui.label(
                        egui::RichText::new("Augmentez cette durée si vos phrases sont coupées pendant une pause. Une dictée peut durer jusqu’à 2 minutes ; « J’ai fini » envoie immédiatement.")
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );

                    ui.add_space(theme::SPACE_MD);
                    ui.separator();

                    // ── Spoken answers ─────────────────────────────────────
                    ui.heading("Lecture des réponses");
                    if known && !engine.tts_available {
                        ui.label(
                            egui::RichText::new(format!("{} Aucune voix système détectée sur ce poste.", icons::WARNING))
                                .color(theme::readable_color(theme::ERROR)),
                        );
                    }
                    ui.horizontal_wrapped(|ui| {
                        ui.radio_value(
                            &mut state.ai.voice_settings.reply_mode,
                            SpokenReplyMode::Full,
                            "Réponse complète",
                        );
                        ui.radio_value(
                            &mut state.ai.voice_settings.reply_mode,
                            SpokenReplyMode::Summary,
                            "Résumé (premières phrases)",
                        );
                    });
                    if !known || engine.can_set_voice {
                        ui.horizontal_wrapped(|ui| {
                            ui.label("Voix");
                            let current = state
                                .ai
                                .voice_settings
                                .voice_id
                                .as_ref()
                                .and_then(|id| engine.voices.iter().find(|voice| &voice.id == id))
                                .map_or_else(
                                    || "Automatique (meilleure voix française)".to_string(),
                                    |voice| format!("{} · {}", voice.name, voice.language),
                                );
                            egui::ComboBox::from_id_salt("voice_tts_voice")
                                .selected_text(current)
                                .width(260.0)
                                .show_ui(ui, |ui| {
                                    ui.selectable_value(
                                        &mut state.ai.voice_settings.voice_id,
                                        None,
                                        "Automatique (meilleure voix française)",
                                    );
                                    for voice in &engine.voices {
                                        ui.selectable_value(
                                            &mut state.ai.voice_settings.voice_id,
                                            Some(voice.id.clone()),
                                            format!("{} · {}", voice.name, voice.language),
                                        );
                                    }
                                });
                        });
                    }
                    ui.add_enabled(
                        !known || engine.can_set_rate,
                        egui::Slider::new(&mut state.ai.voice_settings.rate, 0.5..=2.0)
                            .step_by(0.05)
                            .suffix(" ×")
                            .text("Vitesse"),
                    );
                    let mut volume = state.ai.voice_settings.volume * 100.0;
                    if ui
                        .add_enabled(
                            !known || engine.can_set_volume,
                            egui::Slider::new(&mut volume, 0.0..=100.0)
                                .step_by(5.0)
                                .suffix(" %")
                                .text("Volume"),
                        )
                        .changed()
                    {
                        state.ai.voice_settings.volume = volume / 100.0;
                    }
                    if ui
                        .add_enabled(
                            !state.ai.is_listening,
                            egui::Button::new(format!("{} Tester la voix", icons::PLAY)),
                        )
                        .clicked()
                    {
                        commands.push(GuiCommand::ConfigureVoice {
                            settings: state.ai.voice_settings.clone().sanitized(),
                        });
                        commands.push(GuiCommand::SpeakNotification {
                            text: "Bonjour, je suis Sentinel. Voici ma voix avec ces réglages. Je lis les réponses en entier, phrase par phrase.".to_string(),
                        });
                        state.ai.is_speaking = true;
                    }

                    ui.add_space(theme::SPACE_MD);
                    ui.separator();

                    // ── Spoken alerts ──────────────────────────────────────
                    ui.heading("Alertes vocales");
                    if ui
                        .checkbox(&mut state.ai.voice_alerts_enabled, "Annoncer les alertes de sécurité")
                        .changed()
                        && !state.ai.voice_alerts_enabled
                    {
                        state.ai.pending_voice_alerts.clear();
                    }
                    ui.add_enabled_ui(state.ai.voice_alerts_enabled, |ui| {
                        ui.horizontal_wrapped(|ui| {
                            ui.label("Seuil");
                            egui::ComboBox::from_id_salt("voice_alert_threshold")
                                .selected_text(state.ai.voice_alert_threshold.label_fr())
                                .show_ui(ui, |ui| {
                                    for threshold in VoiceAlertThreshold::ALL {
                                        ui.selectable_value(
                                            &mut state.ai.voice_alert_threshold,
                                            threshold,
                                            threshold.label_fr(),
                                        );
                                    }
                                });
                        });
                    });
                    ui.label(
                        egui::RichText::new("Les alertes n’interrompent jamais une dictée ni une réponse en cours ; au-delà de trois, elles sont résumées.")
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );

                    ui.add_space(theme::SPACE_MD);
                    ui.horizontal(|ui| {
                        if ui.button("Rétablir les valeurs par défaut").clicked() {
                            let model = state.ai.voice_settings.whisper_model.clone();
                            state.ai.voice_settings = crate::dto::VoiceSettings {
                                whisper_model: model,
                                ..crate::dto::VoiceSettings::default()
                            };
                            state.ai.voice_alert_threshold = VoiceAlertThreshold::default();
                        }
                        if ui.button("Actualiser").on_hover_text("Relire les voix et modèles disponibles").clicked() {
                            commands.push(GuiCommand::VoiceRefreshStatus);
                        }
                    });
                });
            });
        state.ai.voice_settings_open = open;
        if state.ai.voice_settings != before {
            state.ai.voice_config_sync_pending = true;
        }
        commands
    }

    /// One submission path for the page and the floating assistant.
    pub(crate) fn submit_prompt(
        state: &mut AppState,
        question: &str,
        speak_response: bool,
    ) -> Option<GuiCommand> {
        let question = question.trim();
        if state.ai.is_processing || question.is_empty() {
            return None;
        }
        let context = state
            .ai
            .prompt_context
            .unwrap_or_else(|| Self::infer_prompt_context(question));
        state.ai.chat_history.push(crate::dto::LlmChatMessage {
            role: ChatRole::User,
            content: question.to_string(),
            timestamp: chrono::Utc::now(),
            processing_time_ms: None,
        });
        let prompt = Self::grounded_prompt(state, question);
        state.ai.input_text.clear();
        state.ai.pending_voice_send = false;
        state.ai.is_processing = true;
        state.ai.voice_reply_pending = speak_response && state.ai.voice_conversation_enabled;
        Some(GuiCommand::LlmPrompt {
            prompt,
            context: Some(context),
            speak_response,
        })
    }

    fn infer_prompt_context(question: &str) -> crate::dto::LlmPromptContext {
        use crate::dto::LlmPromptContext;
        let normalized = question.to_lowercase();
        if ["cve", "vuln", "correctif", "patch"]
            .iter()
            .any(|keyword| normalized.contains(keyword))
        {
            LlmPromptContext::Vulnerabilities
        } else if ["réseau", "reseau", "connexion"]
            .iter()
            .any(|keyword| normalized.contains(keyword))
            || normalized
                .split(|c: char| !c.is_alphanumeric())
                .any(|word| matches!(word, "ip" | "port" | "ports" | "dns"))
        {
            LlmPromptContext::Network
        } else if ["menace", "incident", "processus", "alerte", "ioc"]
            .iter()
            .any(|keyword| normalized.contains(keyword))
        {
            LlmPromptContext::Threats
        } else if [
            "conform",
            "contrôle",
            "controle",
            "audit",
            "iso",
            "nis2",
            "dora",
        ]
        .iter()
        .any(|keyword| normalized.contains(keyword))
        {
            LlmPromptContext::Compliance
        } else {
            LlmPromptContext::General
        }
    }

    /// Grounded context shared by every question of the current state: the
    /// prompt prefix before the question. Pre-processing it lets the model
    /// start answering the first question almost immediately.
    pub(crate) fn warm_up_context(state: &AppState) -> String {
        let prompt = Self::grounded_prompt(state, "");
        match prompt.find(Self::QUESTION_MARKER) {
            Some(end) => prompt[..end].to_string(),
            None => prompt,
        }
    }

    const QUESTION_MARKER: &'static str = "\n\nQUESTION OPÉRATEUR:";

    /// Security domains the operator asks about: every one is always listed,
    /// with the result of its checks or an explicit "not evaluated", so the
    /// model never reports as missing a configuration the agent measured.
    const SECURITY_DOMAINS: &'static [(&'static str, &'static [&'static str])] = &[
        ("Antivirus", &["antivirus_active"]),
        ("Pare-feu", &["firewall_active"]),
        (
            "Politique de mots de passe",
            &["password_policy", "gpo_password_policy"],
        ),
        (
            "Politique de comptes",
            &[
                "gpo_account_lockout",
                "admin_accounts",
                "privileged_groups",
                "guest_account_disabled",
                "auto_login_disabled",
                "mfa_enabled",
            ],
        ),
        (
            "Chiffrement et démarrage",
            &["disk_encryption", "secure_boot"],
        ),
        ("Mises à jour", &["update_status", "patches_current"]),
        ("Verrouillage de session", &["screen_lock"]),
        ("Accès distant", &["remote_access_secure", "ssh_hardening"]),
        ("Journalisation", &["audit_logging", "gpo_audit_policy"]),
    ];

    fn check_status_label(status: GuiCheckStatus) -> &'static str {
        match status {
            GuiCheckStatus::Pass => "conforme",
            GuiCheckStatus::Fail => "NON CONFORME",
            GuiCheckStatus::Error => "ERREUR DE CONTRÔLE",
            GuiCheckStatus::Skipped => "non applicable",
            GuiCheckStatus::Pending | GuiCheckStatus::Running => "en cours",
        }
    }

    /// One check as the model sees it: status, what the agent measured and,
    /// for failures and errors, the collected values that explain the cause.
    fn describe_check(check: &crate::dto::GuiCheckResult) -> String {
        let mut line = format!(
            "{} [{}]: {}",
            Self::text_excerpt(&check.name, 80),
            Self::text_excerpt(&check.check_id, 48),
            Self::check_status_label(check.status)
        );
        if let Some(message) = check.message.as_deref().filter(|m| !m.trim().is_empty()) {
            line.push_str(" — ");
            line.push_str(&Self::text_excerpt(message.trim(), 200));
        }
        if matches!(check.status, GuiCheckStatus::Fail | GuiCheckStatus::Error)
            && let Some(details) = check.details.as_ref()
        {
            let facts = Self::details_summary(details, 220);
            if !facts.is_empty() {
                line.push_str(" | relevé: ");
                line.push_str(&facts);
            }
        }
        line
    }

    /// Flatten collected check data into short `key=value` facts (scalars
    /// only, two levels deep), bounded to `max_chars`.
    fn details_summary(details: &serde_json::Value, max_chars: usize) -> String {
        fn scalar(value: &serde_json::Value) -> Option<String> {
            match value {
                serde_json::Value::Bool(b) => Some(if *b { "oui" } else { "non" }.to_string()),
                serde_json::Value::Number(n) => Some(n.to_string()),
                serde_json::Value::String(s) if !s.trim().is_empty() => {
                    Some(LLMPanel::text_excerpt(s.trim(), 60))
                }
                _ => None,
            }
        }
        fn collect(prefix: &str, value: &serde_json::Value, depth: u8, out: &mut Vec<String>) {
            match value {
                serde_json::Value::Object(map) => {
                    for (key, child) in map {
                        let key = if prefix.is_empty() {
                            key.clone()
                        } else {
                            format!("{prefix}.{key}")
                        };
                        if depth < 2 {
                            collect(&key, child, depth + 1, out);
                        }
                    }
                }
                serde_json::Value::Array(items) => {
                    let values: Vec<String> = items.iter().filter_map(scalar).take(4).collect();
                    if !values.is_empty() && !prefix.is_empty() {
                        out.push(format!("{prefix}={}", values.join("/")));
                    }
                }
                other => {
                    if let Some(value) = scalar(other)
                        && !prefix.is_empty()
                    {
                        out.push(format!("{prefix}={value}"));
                    }
                }
            }
        }
        let mut facts = Vec::new();
        collect("", details, 0, &mut facts);
        let mut summary = String::new();
        for fact in facts {
            let needed = fact.chars().count() + usize::from(!summary.is_empty()) * 2;
            if summary.chars().count() + needed > max_chars {
                break;
            }
            if !summary.is_empty() {
                summary.push_str(", ");
            }
            summary.push_str(&fact);
        }
        summary
    }

    /// Ground free-form chat in the live endpoint telemetry visible to the GUI.
    /// The snapshot is bounded so local models keep enough context budget for
    /// reasoning and never need direct database or network access. Stable
    /// data comes first so consecutive questions share a cached prefix.
    pub(crate) fn grounded_prompt(state: &AppState, question: &str) -> String {
        let count =
            |status: GuiCheckStatus| state.checks.iter().filter(|c| c.status == status).count();
        let last_scan = state
            .checks
            .iter()
            .filter_map(|check| check.executed_at)
            .max()
            .map(|at| {
                at.with_timezone(&chrono::Local)
                    .format("%d/%m/%Y %H:%M")
                    .to_string()
            });

        let domain_ids: std::collections::HashSet<&str> = Self::SECURITY_DOMAINS
            .iter()
            .flat_map(|(_, ids)| ids.iter().copied())
            .collect();
        let domains: Vec<String> = Self::SECURITY_DOMAINS
            .iter()
            .map(|(label, ids)| {
                let checks: Vec<String> = ids
                    .iter()
                    .filter_map(|id| state.checks.iter().find(|check| check.check_id == *id))
                    .map(Self::describe_check)
                    .collect();
                if checks.is_empty() {
                    format!(
                        "- {label}: non évalué sur ce poste (contrôle non exécuté ou non applicable à ce système)"
                    )
                } else {
                    format!("- {label}: {}", checks.join(" ; "))
                }
            })
            .collect();

        let mut other_failures: Vec<_> = state
            .checks
            .iter()
            .filter(|check| matches!(check.status, GuiCheckStatus::Fail | GuiCheckStatus::Error))
            .filter(|check| !domain_ids.contains(check.check_id.as_str()))
            .collect();
        other_failures.sort_by_key(|check| {
            std::cmp::Reverse((
                Self::severity_weight(check.severity),
                matches!(check.status, GuiCheckStatus::Fail),
            ))
        });
        let other_failures: Vec<String> = other_failures
            .into_iter()
            .take(8)
            .map(|check| format!("- {} ({:?})", Self::describe_check(check), check.severity))
            .collect();

        let mut prioritized_vulnerabilities: Vec<_> = state.vulnerability_findings.iter().collect();
        prioritized_vulnerabilities.sort_by(|left, right| {
            let right_score = right
                .cvss_score
                .unwrap_or_else(|| Self::severity_weight(right.severity) as f32);
            let left_score = left
                .cvss_score
                .unwrap_or_else(|| Self::severity_weight(left.severity) as f32);
            right_score.total_cmp(&left_score)
        });
        let vulnerabilities: Vec<String> = prioritized_vulnerabilities
            .into_iter()
            .take(6)
            .map(|finding| {
                format!(
                    "- {} sur {} {} ({:?}, CVSS {})",
                    Self::text_excerpt(&finding.cve_id, 48),
                    Self::text_excerpt(&finding.affected_software, 100),
                    Self::text_excerpt(&finding.affected_version, 48),
                    finding.severity,
                    finding
                        .cvss_score
                        .map(|score| format!("{score:.1}"))
                        .unwrap_or_else(|| "inconnu".to_string())
                )
            })
            .collect();

        let open = |acknowledged: bool, allowlisted: bool| !acknowledged && !allowlisted;
        let when = |at: chrono::DateTime<chrono::Utc>| {
            at.with_timezone(&chrono::Local)
                .format("%d/%m %H:%M")
                .to_string()
        };
        let threats: Vec<String> = state
            .threats
            .suspicious_processes
            .iter()
            .filter(|process| open(process.acknowledged, process.allowlisted))
            .take(4)
            .map(|process| {
                format!(
                    "- Processus suspect {} PID {} (confiance {}%, {}): {} | commande: {}",
                    Self::text_excerpt(&process.process_name, 60),
                    process.pid,
                    process.confidence,
                    when(process.detected_at),
                    Self::text_excerpt(&process.reason, 160),
                    Self::text_excerpt(&process.command_line, 160)
                )
            })
            .chain(
                state
                    .threats
                    .system_incidents
                    .iter()
                    .filter(|incident| open(incident.acknowledged, incident.allowlisted))
                    .take(4)
                    .map(|incident| {
                        format!(
                            "- Incident système {} ({:?}, confiance {}%, {}): {}",
                            Self::text_excerpt(&incident.title, 120),
                            incident.severity,
                            incident.confidence,
                            when(incident.detected_at),
                            Self::text_excerpt(&incident.description, 160)
                        )
                    }),
            )
            .chain(
                state
                    .network
                    .alerts
                    .iter()
                    .filter(|alert| open(alert.acknowledged, alert.allowlisted))
                    .take(4)
                    .map(|alert| {
                        format!(
                            "- Alerte réseau {} ({:?}, confiance {}%, {}): {} | {} → {}{}",
                            Self::text_excerpt(&alert.alert_type, 80),
                            alert.severity,
                            alert.confidence,
                            when(alert.detected_at),
                            Self::text_excerpt(&alert.description, 140),
                            alert.source_ip.as_deref().unwrap_or("?"),
                            alert.destination_ip.as_deref().unwrap_or("?"),
                            alert
                                .destination_port
                                .map(|port| format!(":{port}"))
                                .unwrap_or_default()
                        )
                    }),
            )
            .chain(
                state
                    .fim
                    .alerts
                    .iter()
                    .filter(|alert| !alert.acknowledged)
                    .take(3)
                    .map(|alert| {
                        format!(
                            "- Intégrité fichier {:?}: {}",
                            alert.change_type,
                            Self::text_excerpt(&alert.path, 160)
                        )
                    }),
            )
            .collect();
        let recent_conversation: Vec<String> = state
            .ai
            .chat_history
            .iter()
            .rev()
            .skip(1)
            .take(4)
            .rev()
            .map(|message| {
                format!(
                    "{:?}: {}",
                    message.role,
                    Self::text_excerpt(&message.content, 400)
                )
            })
            .collect();

        let (open_processes, open_incidents, open_network, unacknowledged_fim) =
            state.open_threat_counts();
        let list = |items: &[String], empty: &str| {
            if items.is_empty() {
                format!("- {empty}")
            } else {
                items.join("\n")
            }
        };
        let scan_line = match (&last_scan, state.checks.is_empty()) {
            (_, true) => "aucun scan de conformité exécuté : les contrôles ne sont pas encore disponibles, proposer de lancer l'analyse".to_string(),
            (Some(at), false) => format!("dernier scan le {at}"),
            (None, false) => "date du dernier scan inconnue".to_string(),
        };

        format!(
            "CONTEXTE SENTINEL NEXUS ACTUEL (données locales mesurées par l'agent, ne rien inventer):\n\
             - Mode: {mode}\n\
             - Conformité: score {score}, {scan_line}\n\
             - Contrôles: {total} au total, {pass} conformes, {fail} non conformes, {error} en erreur, {skipped} non applicables\n\
             - Vulnérabilités: {vuln_count}\n\
             - Menaces ouvertes (hors acquittées/autorisées): {open_processes} processus suspects, {open_incidents} incidents système, {open_network} alertes réseau, {unacknowledged_fim} alertes d'intégrité\n\
             \n\
             ÉTAT DES DOMAINES DE SÉCURITÉ (résultat de chaque contrôle; « relevé » = valeurs collectées sur le poste):\n{domains}\n\
             \n\
             AUTRES CONTRÔLES NON CONFORMES OU EN ERREUR (avec cause):\n{other_failures}\n\
             \n\
             VULNÉRABILITÉS PRIORITAIRES:\n{vulnerabilities}\n\
             \n\
             MENACES OUVERTES:\n{threats}\n\
             \n\
             RESSOURCES: CPU {cpu:.0}%, mémoire {memory:.0}%, disque {disk:.0}%\n\
             \n\
             CONVERSATION RÉCENTE:\n{conversation}{marker}\n{question}\n\
             \n\
             Réponds en français, précisément et de façon actionnable. Appuie-toi sur les résultats de contrôles et relevés ci-dessus et cite leurs identifiants. Une information présente ci-dessus n'est jamais « manquante » ; un domaine « non évalué » ou « non applicable » se signale comme tel. N'affirme jamais avoir observé une donnée absente.",
            mode = if state.summary.standalone {
                "autonome"
            } else {
                "connecté"
            },
            score = state
                .summary
                .compliance_score
                .map(|s| format!("{s:.1}%"))
                .unwrap_or_else(|| "non mesuré".into()),
            total = state.checks.len(),
            pass = count(GuiCheckStatus::Pass),
            fail = count(GuiCheckStatus::Fail),
            error = count(GuiCheckStatus::Error),
            skipped = count(GuiCheckStatus::Skipped),
            vuln_count = state.vulnerability_findings.len(),
            domains = domains.join("\n"),
            other_failures = list(&other_failures, "aucun"),
            vulnerabilities = list(&vulnerabilities, "aucune"),
            threats = list(&threats, "aucune"),
            // Volatile figures last: the stable context above stays a shared
            // prefix between consecutive questions (reused by the prefix cache).
            cpu = state.resources.cpu_percent,
            memory = state.resources.memory_percent,
            disk = state.resources.disk_percent,
            conversation = if recent_conversation.is_empty() {
                "aucune".to_string()
            } else {
                recent_conversation.join("\n")
            },
            marker = Self::QUESTION_MARKER,
        )
    }

    /// Keep telemetry and conversation excerpts inside the local model's
    /// context budget without splitting accented characters or emojis.
    fn text_excerpt(value: &str, max_chars: usize) -> String {
        if max_chars == 0 {
            return String::new();
        }
        if value.chars().count() <= max_chars {
            return value.to_string();
        }
        let mut excerpt = value
            .chars()
            .take(max_chars.saturating_sub(1))
            .collect::<String>();
        excerpt.push('…');
        excerpt
    }

    fn severity_weight(severity: crate::dto::Severity) -> u8 {
        match severity {
            crate::dto::Severity::Critical => 10,
            crate::dto::Severity::High => 8,
            crate::dto::Severity::Medium => 5,
            crate::dto::Severity::Low => 2,
            crate::dto::Severity::Info => 0,
        }
    }

    /// Render a single chat message bubble.
    pub fn render_chat_message(ui: &mut egui::Ui, msg: &crate::dto::LlmChatMessage) {
        let is_user = msg.role == ChatRole::User;
        let is_system = msg.role == ChatRole::System;

        let layout = if is_user {
            egui::Layout::right_to_left(egui::Align::TOP)
        } else {
            egui::Layout::left_to_right(egui::Align::TOP)
        };

        ui.with_layout(layout, |ui: &mut egui::Ui| {
            // Constrain bubble width more strictly to avoid right-side overflow
            // We use the available width minus a safe margin for the gutters
            let max_bubble_width = (ui.available_width() * 0.85).min(700.0);

            ui.allocate_ui_with_layout(egui::Vec2::new(max_bubble_width, 0.0), layout, |ui| {
                let (bg_color, text_color, role_icon, role_color) = if is_user {
                    (
                        theme::badge_bg(theme::ACCENT),
                        theme::text_primary(),
                        icons::USER,
                        theme::ACCENT,
                    )
                } else if is_system {
                    (
                        theme::badge_bg(theme::WARNING),
                        theme::text_primary(),
                        icons::BOLT,
                        theme::WARNING,
                    )
                } else {
                    (
                        theme::bg_elevated(),
                        theme::text_primary(),
                        icons::ROBOT,
                        theme::AI,
                    )
                };

                egui::Frame::new()
                    .fill(bg_color)
                    .corner_radius(egui::CornerRadius::same(theme::SPACE_MD as u8))
                    .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
                    .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border()))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.vertical(|ui| {
                            ui.set_max_width((max_bubble_width - theme::SPACE_MD * 2.0).max(80.0));
                            // Role badge & Time
                            ui.horizontal(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(role_icon)
                                        .size(theme::ICON_SM)
                                        .color(theme::readable_color(role_color)),
                                );
                                ui.add_space(theme::SPACE_XS);
                                ui.label(
                                    egui::RichText::new(msg.role.label_fr())
                                        .font(theme::font_label())
                                        .color(theme::readable_color(role_color))
                                        .strong(),
                                );

                                ui.with_layout(
                                    egui::Layout::right_to_left(egui::Align::Center),
                                    |ui: &mut egui::Ui| {
                                        // Timestamp
                                        let time_str = msg.timestamp.format("%H:%M").to_string();
                                        ui.label(
                                            egui::RichText::new(time_str)
                                                .font(theme::font_min())
                                                .color(theme::text_tertiary()),
                                        );
                                    },
                                );
                            });

                            ui.add_space(theme::SPACE_XS);

                            ui.add(
                                egui::Label::new(
                                    egui::RichText::new(&msg.content)
                                        .font(theme::font_body())
                                        .color(text_color),
                                )
                                .wrap()
                                .selectable(true),
                            );
                            ui.horizontal_wrapped(|ui| {
                                if ui
                                    .add(
                                        egui::Button::new("Copier")
                                            .min_size(egui::vec2(60.0, 24.0)),
                                    )
                                    .clicked()
                                {
                                    ui.ctx().copy_text(msg.content.clone());
                                }
                                if let Some(ms) = msg.processing_time_ms {
                                    ui.label(
                                        egui::RichText::new(format!("{:.1} s", ms as f64 / 1000.0))
                                            .font(theme::font_small())
                                            .color(theme::text_tertiary()),
                                    );
                                }
                            });
                        });
                    });
            });
        });
    }

    /// Render a processing/loading indicator while the LLM is working.
    pub fn render_processing_indicator(ui: &mut egui::Ui) {
        ui.with_layout(
            egui::Layout::left_to_right(egui::Align::TOP),
            |ui: &mut egui::Ui| {
                // Same max width constraint as chat bubbles for consistency
                let max_bubble_width = (ui.available_width() * 0.85).min(700.0);

                ui.allocate_ui_with_layout(
                    egui::Vec2::new(max_bubble_width, 0.0),
                    egui::Layout::left_to_right(egui::Align::TOP),
                    |ui| {
                        egui::Frame::new()
                            .fill(theme::bg_elevated())
                            .corner_radius(egui::CornerRadius::same(theme::SPACE_MD as u8))
                            .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
                            .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border()))
                            .show(ui, |ui: &mut egui::Ui| {
                                ui.vertical(|ui| {
                                    ui.horizontal(|ui: &mut egui::Ui| {
                                        ui.label(
                                            egui::RichText::new(icons::ROBOT)
                                                .size(theme::ICON_SM)
                                                .color(theme::readable_color(theme::SUCCESS)),
                                        );
                                        ui.add_space(theme::SPACE_XS);
                                        ui.label(
                                            egui::RichText::new("IA")
                                                .font(theme::font_label())
                                                .color(theme::readable_color(theme::SUCCESS))
                                                .strong(),
                                        );
                                    });
                                    ui.add_space(theme::SPACE_XS);
                                    ui.horizontal(|ui: &mut egui::Ui| {
                                        ui.spinner();
                                        ui.add_space(theme::SPACE_SM);
                                        ui.label(
                                            egui::RichText::new("Analyse en cours…")
                                                .font(theme::font_body())
                                                .color(theme::text_secondary())
                                                .italics(),
                                        );
                                    });
                                });
                            });
                    },
                );
            },
        );
    }

    // ====================================================================
    // Tab 1: Recommandations (existing content, extracted)
    // ====================================================================

    fn show_recommendations_tab(ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.label(egui::RichText::new("Priorisation par règles à partir des données locales ; aucune inférence du modèle dans cette liste.").font(theme::font_small()).color(theme::text_secondary()));

        // Build recommendations from AppState and cache count for badge
        let recommendations = Self::build_recommendations(state);
        state.ai.recommendations_count = recommendations.len();

        if recommendations.is_empty() && state.checks.is_empty() {
            Self::show_empty_state(ui);
            return command;
        }

        // ── Section A: Security Posture Hero ─────────────────────────────
        let ai_score = Self::compute_ai_score(state);
        Self::render_posture_hero(ui, state, ai_score);
        ui.add_space(theme::SPACE_LG);

        // ── Section B: Key Insights Grid ─────────────────────────────────
        Self::render_insights_grid(ui, state);
        ui.add_space(theme::SPACE_LG);

        // ── Section C: Search / Filter Bar ───────────────────────────────
        let compliance_active = state.ai.filter.as_deref() == Some("compliance");
        let vuln_active = state.ai.filter.as_deref() == Some("vulnerability");
        let threat_active = state.ai.filter.as_deref() == Some("threat");
        let network_active = state.ai.filter.as_deref() == Some("network");

        // Apply filtering
        let search_lower = state.ai.search.to_lowercase();
        let filtered: Vec<usize> = recommendations
            .iter()
            .enumerate()
            .filter(|(_, r)| {
                // Filter by kind
                if let Some(ref f) = state.ai.filter
                    && r.kind != f.as_str()
                {
                    return false;
                }
                // Filter by search text (short-circuit, no format! allocation)
                if !search_lower.is_empty()
                    && !r.title.to_lowercase().contains(&search_lower)
                    && !r.subtitle.to_lowercase().contains(&search_lower)
                    && !r.category.to_lowercase().contains(&search_lower)
                {
                    return false;
                }
                true
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.ai.search,
            "Rechercher une recommandation, une cat\u{00e9}gorie…",
        )
        .chip("CONFORMIT\u{00c9}", compliance_active, theme::ACCENT)
        .chip("VULN\u{00c9}RABILIT\u{00c9}S", vuln_active, theme::ERROR)
        .chip("MENACES", threat_active, theme::WARNING)
        .chip("R\u{00c9}SEAU", network_active, theme::INFO)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some("compliance"),
                1 => Some("vulnerability"),
                2 => Some("threat"),
                3 => Some("network"),
                _ => None,
            };
            let target_str = target.map(String::from);
            if state.ai.filter == target_str {
                state.ai.filter = None;
            } else {
                state.ai.filter = target_str;
            }
        }

        ui.add_space(theme::SPACE_MD);

        // ── Section D: Recommendations List ──────────────────────────────
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("RECOMMANDATIONS PRIORIS\u{00c9}ES")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{} \u{00c9}L\u{00c9}MENTS", result_count))
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    },
                );
            });
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                if state.ai.filter.is_some() || !state.ai.search.is_empty() {
                    widgets::empty_state(
                        ui,
                        icons::SEARCH,
                        "Aucun r\u{00e9}sultat",
                        Some("Modifiez vos crit\u{00e8}res de recherche ou de filtrage."),
                    );
                } else {
                    widgets::protected_state(
                        ui,
                        icons::SHIELD_CHECK,
                        "Posture de s\u{00e9}curit\u{00e9} optimale",
                        "Aucune recommandation \u{00e0} signaler. Tous les contr\u{00f4}les sont conformes.",
                    );
                }
            } else {
                Self::render_recommendations_list(ui, state, &recommendations, &filtered);
            }
        });

        ui.add_space(theme::SPACE_XL);

        // ── Section E: Detail Drawer ─────────────────────────────────────
        if let Some(sel_idx) = state.ai.selected_recommendation
            && sel_idx < recommendations.len()
        {
            let rec = recommendations[sel_idx].clone();
            let sev_color = theme::severity_color_typed(&rec.severity);
            let kind_label = kind_label(rec.kind);
            let kind_icon = kind_icon(rec.kind);

            let actions = vec![
                widgets::DetailAction::primary("Lancer le contr\u{00f4}le", icons::PLAY),
                widgets::DetailAction::secondary("Exporter", icons::DOWNLOAD),
            ];

            let drawer_action =
                widgets::DetailDrawer::new("ai_recommendation_detail", &rec.title, kind_icon)
                    .accent(sev_color)
                    .subtitle(kind_label)
                    .show(
                        ui.ctx(),
                        &mut state.ai.detail_open,
                        |ui| {
                            widgets::detail_section(ui, "RECOMMANDATION");
                            widgets::detail_field_badge(
                                ui,
                                "Priorit\u{00e9}",
                                rec.severity.label(),
                                sev_color,
                            );
                            widgets::detail_field_badge(
                                ui,
                                "Source",
                                kind_label,
                                kind_color(rec.kind),
                            );
                            widgets::detail_field(
                                ui,
                                "Cat\u{00e9}gorie",
                                &format_category(&rec.category),
                            );

                            widgets::detail_section(ui, "D\u{00c9}TAILS");
                            widgets::detail_text(ui, "Description", &rec.subtitle);
                            if !rec.detail.is_empty() {
                                widgets::detail_text(ui, "Contexte", &rec.detail);
                            }

                            widgets::detail_section(ui, "REM\u{00c9}DIATION");
                            let remediation = category_remediation(&rec.category);
                            widgets::detail_text(ui, "Action recommand\u{00e9}e", remediation);

                            if !rec.frameworks.is_empty() {
                                widgets::detail_section(ui, "R\u{00c9}F\u{00c9}RENTIELS");
                                for fw in &rec.frameworks {
                                    widgets::detail_field_badge(
                                        ui,
                                        "",
                                        &fw.to_uppercase(),
                                        theme::INFO,
                                    );
                                }
                            }
                        },
                        &actions,
                    );

            if let Some(action_idx) = drawer_action {
                match action_idx {
                    0 => command = Some(GuiCommand::RunCheck),
                    1 => {
                        Self::export_recommendation(state, &rec);
                    }
                    _ => {}
                }
            }
        }

        command
    }

    // ====================================================================
    // Tab 2: Statut Mod\u{00e8}le
    // ====================================================================

    fn show_model_status_tab(ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        ui.horizontal_wrapped(|ui| {
            if ui.button(format!("{} Actualiser l’état", icons::REFRESH)).clicked() {
                command = Some(GuiCommand::LlmGetStatus);
            }
            if state.ai.is_processing {
                ui.label("Un échange est en cours. Le changement de modèle sera disponible après la réponse.");
            }
        });
        ui.add_space(theme::SPACE_SM);

        // ── Download in progress / paused / failed ──────────────────────
        let download_phase = state.ai.download.phase;
        let show_download_ui = matches!(
            download_phase,
            crate::dto::DownloadPhase::Downloading
                | crate::dto::DownloadPhase::Paused
                | crate::dto::DownloadPhase::Failed
        );

        if show_download_ui {
            if let Some(cmd) = Self::render_download_progress(ui, state) {
                return Some(cmd);
            }
            ui.add_space(theme::SPACE_LG);
            if matches!(
                download_phase,
                crate::dto::DownloadPhase::Downloading | crate::dto::DownloadPhase::Paused
            ) {
                return command;
            }
        }

        // ── Active model status hero card ────────────────────────────────
        let model_status_str = state.ai.model_status.status.clone();
        let model_name_str = state.ai.model_status.model_name.clone();
        let is_ready = state.ai.model_status.is_ready;

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                // Status indicator dot
                let (dot_color, status_text) = if is_ready {
                    (theme::SUCCESS, "ACTIF")
                } else if model_status_str.starts_with("error") {
                    (theme::ERROR, "ERREUR")
                } else if model_status_str == "loading" {
                    (theme::WARNING, "CHARGEMENT")
                } else {
                    (theme::text_tertiary(), "NON CHARGÉ")
                };

                let t = ui.input(|i| i.time);
                let pulse = if is_ready && !theme::is_reduced_motion() {
                    (t * 3.0).sin().abs() as f32 * 0.3 + 0.7
                } else {
                    1.0
                };
                ui.label(
                    egui::RichText::new("●")
                        .size(theme::ICON_SM)
                        .color(dot_color.linear_multiply(pulse)),
                );
                ui.add_space(theme::SPACE_SM);

                ui.vertical(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("MODÈLE ACTIF")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new(if model_name_str.is_empty() {
                            "Aucun modèle chargé".to_string()
                        } else {
                            model_name_str.clone()
                        })
                        .font(theme::font_heading())
                        .color(theme::text_primary())
                        .strong(),
                    );
                });

                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        widgets::status_badge(ui, status_text, dot_color);
                    },
                );
            });

            if is_ready {
                ui.add_space(theme::SPACE_MD);
                ui.horizontal(|ui: &mut egui::Ui| {
                    let icon_color = theme::text_tertiary();
                    ui.label(
                        egui::RichText::new(icons::BOLT)
                            .size(theme::ICON_XS)
                            .color(icon_color),
                    );
                    ui.label(
                        egui::RichText::new(format!(
                            "{} inférences",
                            state.ai.model_status.inference_count
                        ))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                    );
                    ui.add_space(theme::SPACE_MD);
                    ui.label(
                        egui::RichText::new(icons::MEMORY)
                            .size(theme::ICON_XS)
                            .color(icon_color),
                    );
                    ui.label(
                        egui::RichText::new(if state.ai.model_status.memory_mb > 0 {
                            format!(
                                "{} Mo alloués",
                                crate::format::int(state.ai.model_status.memory_mb)
                            )
                        } else {
                            "--".to_string()
                        })
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                    );
                    if let Some(acceleration) = state.ai.acceleration.as_deref() {
                        ui.add_space(theme::SPACE_MD);
                        ui.label(
                            egui::RichText::new(icons::MICROCHIP)
                                .size(theme::ICON_XS)
                                .color(icon_color),
                        );
                        ui.label(
                            egui::RichText::new(acceleration)
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        )
                        .on_hover_text(
                            "Accélération choisie automatiquement selon ce poste : GPU si disponible, sinon instructions AVX2 du processeur si présentes, un thread par cœur physique.",
                        );
                    }

                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            let reload_btn = egui::Button::new(
                                egui::RichText::new(format!("{} Recharger", icons::REFRESH))
                                    .font(theme::font_small())
                                    .color(theme::accent_text()),
                            )
                            .fill(theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE))
                            .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8))
                            .stroke(egui::Stroke::new(
                                theme::BORDER_THIN,
                                theme::ACCENT.linear_multiply(theme::OPACITY_MUTED),
                            ));

                            if ui
                                .add_enabled(!state.ai.is_processing, reload_btn)
                                .clicked()
                            {
                                command = Some(GuiCommand::LlmReloadModel);
                            }
                        },
                    );
                });
            } else if !model_status_str.is_empty() && !is_ready {
                // Reload / load button for non-ready state
                ui.add_space(theme::SPACE_MD);
                ui.horizontal(|ui: &mut egui::Ui| {
                    if model_status_str != "not_configured" {
                        let load_btn = egui::Button::new(
                            egui::RichText::new(format!("{} Charger le modèle", icons::PLAY))
                                .font(theme::font_body())
                                .color(theme::text_on_accent()),
                        )
                        .fill(theme::ACCENT)
                        .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8));
                        if ui
                            .add_enabled(
                                !state.ai.is_processing && model_status_str != "loading",
                                load_btn,
                            )
                            .clicked()
                        {
                            command = Some(GuiCommand::LlmReloadModel);
                        }
                    }
                });
            }
        });

        ui.add_space(theme::SPACE_LG);

        // Read the same registry used by the engine; no independently branded catalogue.
        #[cfg(feature = "llm")]
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("Choisir un modèle local")
                    .font(theme::font_heading())
                    .color(theme::text_primary()),
            );
            ui.label(egui::RichText::new("Les tailles correspondent aux fichiers Q4_K_M. La mémoire nécessaire dépend aussi du contexte et du moteur.").font(theme::font_small()).color(theme::text_secondary()));
            ui.add(
                egui::TextEdit::singleline(&mut state.ai.model_search)
                    .hint_text("Rechercher un modèle ou un usage…")
                    .desired_width(ui.available_width()),
            );
            let mut models: Vec<_> = agent_llm::models::ModelRegistry::get_recommended_models()
                .into_iter()
                .filter(|(key, info)| info.download_url.is_some() && key != "kimi-k2-coder")
                .collect();
            models.sort_by(|a, b| {
                a.1.file_size_gb
                    .total_cmp(&b.1.file_size_gb)
                    .then_with(|| a.0.cmp(&b.0))
            });
            let search = state.ai.model_search.to_lowercase();
            let mut visible = 0;
            for (key, model) in models {
                if !search.is_empty()
                    && !format!("{} {}", model.name, model.description)
                        .to_lowercase()
                        .contains(&search)
                {
                    continue;
                }
                visible += 1;
                ui.push_id(&key, |ui| {
                    ui.add_space(theme::SPACE_MD);
                    ui.separator();
                    ui.horizontal_wrapped(|ui| {
                        ui.label(
                            egui::RichText::new(&model.name)
                                .font(theme::font_body_strong())
                                .color(theme::text_primary()),
                        );
                        ui.label(
                            egui::RichText::new(format!("≈ {:.2} Go", model.file_size_gb))
                                .color(theme::text_secondary()),
                        );
                        if model_name_str == key || model_name_str.eq_ignore_ascii_case(&model.name)
                        {
                            widgets::status_badge(
                                ui,
                                if is_ready { "ACTIF" } else { "CONFIGURÉ" },
                                theme::ACCENT,
                            );
                        }
                    });
                    ui.label(
                        egui::RichText::new(&model.description).color(theme::text_secondary()),
                    );
                    ui.horizontal_wrapped(|ui| {
                        if let Some(url) = &model.download_url
                            && let Some((repository, _)) = url.split_once("/resolve/")
                        {
                            ui.hyperlink_to("Source et licence", repository);
                        }
                        let can_select = !state.ai.is_processing && model_status_str != "loading";
                        if ui
                            .add_enabled(can_select, egui::Button::new("Télécharger / activer"))
                            .on_hover_text(
                                "Télécharge le fichier si nécessaire puis charge ce modèle local.",
                            )
                            .clicked()
                        {
                            state.ai.download = crate::dto::LlmDownloadState {
                                phase: crate::dto::DownloadPhase::Downloading,
                                model_name: model.name.clone(),
                                ..Default::default()
                            };
                            command = Some(GuiCommand::LlmSelectModel {
                                model_key: key.clone(),
                                model_name: model.name.clone(),
                                download_url: model.download_url.clone(),
                                gguf_filename: model.gguf_filename.clone(),
                            });
                        }
                    });
                });
            }
            if visible == 0 {
                ui.label("Aucun modèle ne correspond à cette recherche.");
            }
        });
        #[cfg(not(feature = "llm"))]
        ui.label("Le catalogue nécessite une version compilée avec le module IA.");

        command
    }

    // ====================================================================
    // ====================================================================
    // Download progress UI
    // ====================================================================

    fn render_download_progress(ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        // Extract all needed values before the mutable closure
        let phase = state.ai.download.phase;
        let model_name = state.ai.download.model_name.clone();
        let progress_percent = state.ai.download.progress_percent;
        let downloaded_bytes = state.ai.download.downloaded_bytes;
        let total_bytes = state.ai.download.total_bytes;
        let speed_bps = state.ai.download.speed_bps;
        let error_msg = state.ai.download.error.clone();

        let is_paused = phase == crate::dto::DownloadPhase::Paused;
        let is_failed = phase == crate::dto::DownloadPhase::Failed;

        widgets::card(ui, |ui: &mut egui::Ui| {
            // ── Header ──────────────────────────────────────────────────
            ui.horizontal(|ui: &mut egui::Ui| {
                let header_icon = if is_failed {
                    icons::CIRCLE_XMARK
                } else if is_paused {
                    icons::PAUSE
                } else {
                    icons::DOWNLOAD
                };
                let header_color = if is_failed {
                    theme::ERROR
                } else if is_paused {
                    theme::WARNING
                } else {
                    theme::ACCENT
                };

                ui.label(
                    egui::RichText::new(header_icon)
                        .size(theme::ICON_MD)
                        .color(header_color),
                );
                ui.add_space(theme::SPACE_SM);
                ui.vertical(|ui: &mut egui::Ui| {
                    let title = if is_failed {
                        "T\u{00c9}L\u{00c9}CHARGEMENT \u{00c9}CHOU\u{00c9}"
                    } else if is_paused {
                        "T\u{00c9}L\u{00c9}CHARGEMENT EN PAUSE"
                    } else {
                        "T\u{00c9}L\u{00c9}CHARGEMENT DU MOD\u{00c8}LE"
                    };
                    ui.label(
                        egui::RichText::new(title)
                            .font(theme::font_label())
                            .color(header_color)
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                    );
                    if !model_name.is_empty() {
                        ui.label(
                            egui::RichText::new(&model_name)
                                .font(theme::font_body())
                                .color(theme::text_primary())
                                .strong(),
                        );
                    }
                });
            });

            ui.add_space(theme::SPACE_MD);

            // ── Error message ───────────────────────────────────────────
            if let Some(ref error) = error_msg {
                egui::Frame::new()
                    .fill(theme::ERROR.linear_multiply(theme::OPACITY_SUBTLE))
                    .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8))
                    .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(icons::CIRCLE_XMARK)
                                    .size(theme::ICON_SM)
                                    .color(theme::readable_color(theme::ERROR)),
                            );
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new(error)
                                    .font(theme::font_small())
                                    .color(theme::readable_color(theme::ERROR)),
                            );
                        });
                    });
                ui.add_space(theme::SPACE_MD);
            }

            // ── Progress Bar ────────────────────────────────────────────
            if !is_failed {
                let progress = progress_percent as f32 / 100.0;

                // Custom progress bar
                let desired_size = egui::vec2(ui.available_width(), 12.0);
                let (rect, _response) = ui.allocate_exact_size(desired_size, egui::Sense::hover());

                if ui.is_rect_visible(rect) {
                    let painter = ui.painter();

                    // Background track
                    painter.rect_filled(
                        rect,
                        egui::CornerRadius::same(theme::ROUNDING_MD),
                        theme::bg_elevated(),
                    );

                    // Fill
                    let fill_width = rect.width() * progress;
                    if fill_width > 0.0 {
                        let fill_rect = egui::Rect::from_min_size(
                            rect.min,
                            egui::vec2(fill_width, rect.height()),
                        );

                        let fill_color = if is_paused {
                            theme::WARNING
                        } else {
                            theme::ACCENT
                        };

                        painter.rect_filled(
                            fill_rect,
                            egui::CornerRadius::same(theme::ROUNDING_MD),
                            fill_color,
                        );
                    }
                }

                ui.add_space(theme::SPACE_MD);

                // ── Stats row ───────────────────────────────────────────
                ui.horizontal(|ui: &mut egui::Ui| {
                    // Percentage
                    ui.label(
                        egui::RichText::new(format!("{}\u{202f}%", progress_percent))
                            .font(theme::font_stat())
                            .color(if is_paused {
                                theme::WARNING
                            } else {
                                theme::ACCENT
                            })
                            .strong(),
                    );

                    ui.add_space(theme::SPACE_LG);

                    // Downloaded / Total
                    let downloaded_mb = downloaded_bytes / (1024 * 1024);
                    let total_mb = total_bytes / (1024 * 1024);
                    let size_text = if total_mb > 0 {
                        format!("{} / {} Mo", downloaded_mb, total_mb)
                    } else {
                        format!("{} Mo", downloaded_mb)
                    };
                    ui.label(
                        egui::RichText::new(size_text)
                            .font(theme::font_body())
                            .color(theme::text_secondary()),
                    );

                    // Speed (only when actively downloading)
                    if !is_paused && speed_bps > 0 {
                        ui.with_layout(
                            egui::Layout::right_to_left(egui::Align::Center),
                            |ui: &mut egui::Ui| {
                                let speed_text = Self::format_speed(speed_bps);
                                ui.label(
                                    egui::RichText::new(format!("{} {}", icons::BOLT, speed_text))
                                        .font(theme::font_small())
                                        .color(theme::text_tertiary()),
                                );

                                // ETA
                                if total_bytes > 0 && speed_bps > 0 {
                                    let remaining = total_bytes.saturating_sub(downloaded_bytes);
                                    if remaining > 0 {
                                        let eta_secs = remaining / speed_bps;
                                        let eta_text = Self::format_duration(eta_secs);
                                        ui.label(
                                            egui::RichText::new(format!("{} restant", eta_text))
                                                .font(theme::font_small())
                                                .color(theme::text_tertiary()),
                                        );
                                    }
                                }
                            },
                        );
                    }
                });

                // Request repaint while downloading for animation
                if !is_paused {
                    ui.ctx()
                        .request_repaint_after(std::time::Duration::from_millis(500));
                }
            }

            ui.add_space(theme::SPACE_LG);

            // ── Action Buttons ──────────────────────────────────────────
            ui.horizontal(|ui: &mut egui::Ui| {
                if is_failed {
                    // Retry button
                    let retry_btn = egui::Button::new(
                        egui::RichText::new(format!("{} R\u{00e9}essayer", icons::REFRESH))
                            .font(theme::font_body())
                            .color(theme::text_on_accent()),
                    )
                    .fill(theme::ACCENT)
                    .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8));

                    if ui.add(retry_btn).clicked() {
                        state.ai.download.phase = crate::dto::DownloadPhase::Downloading;
                        state.ai.download.error = None;
                        state.ai.download.progress_percent = 0;
                        state.ai.download.downloaded_bytes = 0;
                        command = Some(GuiCommand::LlmStartDownload);
                    }
                } else if is_paused {
                    // Resume button
                    let resume_btn = egui::Button::new(
                        egui::RichText::new(format!("{} Reprendre", icons::PLAY))
                            .font(theme::font_body())
                            .color(theme::text_on_accent()),
                    )
                    .fill(theme::ACCENT)
                    .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8));

                    if ui.add(resume_btn).clicked() {
                        state.ai.download.phase = crate::dto::DownloadPhase::Downloading;
                        command = Some(GuiCommand::LlmResumeDownload);
                    }
                } else {
                    // Pause button (active download)
                    let pause_btn = egui::Button::new(
                        egui::RichText::new(format!("{} Mettre en pause", icons::PAUSE))
                            .font(theme::font_body())
                            .color(theme::text_on_accent()),
                    )
                    .fill(theme::WARNING)
                    .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8));

                    if ui.add(pause_btn).clicked() {
                        state.ai.download.phase = crate::dto::DownloadPhase::Paused;
                        command = Some(GuiCommand::LlmPauseDownload);
                    }
                }

                ui.add_space(theme::SPACE_MD);

                // Cancel button (always visible when not failed)
                if !is_failed {
                    let cancel_btn = egui::Button::new(
                        egui::RichText::new(format!("{} Annuler", icons::CIRCLE_XMARK))
                            .font(theme::font_body())
                            .color(theme::readable_color(theme::ERROR)),
                    )
                    .fill(theme::ERROR.linear_multiply(theme::OPACITY_SUBTLE))
                    .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8))
                    .stroke(egui::Stroke::new(
                        theme::BORDER_THIN,
                        theme::ERROR.linear_multiply(theme::OPACITY_MUTED),
                    ));

                    if ui.add(cancel_btn).clicked() {
                        state.ai.download.phase = crate::dto::DownloadPhase::Idle;
                        command = Some(GuiCommand::LlmCancelDownload);
                    }
                }
            });
        });

        command
    }

    /// Format bytes per second to human-readable speed string.
    fn format_speed(bps: u64) -> String {
        if bps >= 1_000_000 {
            format!("{:.1} Mo/s", bps as f64 / 1_000_000.0)
        } else if bps >= 1_000 {
            format!("{:.0} Ko/s", bps as f64 / 1_000.0)
        } else {
            format!("{} o/s", bps)
        }
    }

    /// Format seconds to "Xh Ym" or "Ym Zs" duration string.
    fn format_duration(secs: u64) -> String {
        if secs >= 3600 {
            let h = secs / 3600;
            let m = (secs % 3600) / 60;
            format!("{}h {:02}m", h, m)
        } else if secs >= 60 {
            let m = secs / 60;
            let s = secs % 60;
            format!("{}m {:02}s", m, s)
        } else {
            format!("{}s", secs)
        }
    }

    // ── Score computation ────────────────────────────────────────────────

    /// Compute the composite AI security score (0--100).
    pub fn compute_ai_score(state: &AppState) -> f32 {
        let compliance = state.summary.compliance_score.unwrap_or(50.0);

        let (processes, incidents, alert_count, _) = state.open_threat_counts();
        let threat_count = processes + incidents;
        let threat_component = 100.0 - (threat_count as f32 * 10.0).min(100.0);

        let vuln_count = state.vulnerability_findings.len();
        let vuln_component = 100.0 - (vuln_count as f32 * 5.0).min(100.0);

        let network_component = 100.0 - (alert_count as f32 * 15.0).min(100.0);

        (compliance * 0.40
            + threat_component * 0.20
            + vuln_component * 0.25
            + network_component * 0.15)
            .clamp(0.0, 100.0)
    }

    /// Get the risk level label for a score.
    pub fn risk_label(score: f32) -> &'static str {
        if score >= 80.0 {
            "POSTURE S\u{00c9}CURIS\u{00c9}E"
        } else if score >= 60.0 {
            "RISQUE MOD\u{00c9}R\u{00c9}"
        } else if score >= 35.0 {
            "RISQUE \u{00c9}LEV\u{00c9}"
        } else {
            "RISQUE CRITIQUE"
        }
    }

    // ── Recommendation builder ───────────────────────────────────────────

    /// Build prioritized recommendations from current state.
    pub fn build_recommendations(state: &AppState) -> Vec<Recommendation> {
        let mut recs = Vec::new();

        // 1. Failing compliance checks
        for check in &state.checks {
            if check.status == GuiCheckStatus::Fail {
                recs.push(Recommendation {
                    kind: "compliance",
                    severity: check.severity,
                    title: format!("Corriger : {}", check.name),
                    subtitle: category_remediation(&check.category).to_string(),
                    detail: check
                        .message
                        .as_deref()
                        .unwrap_or("Aucun d\u{00e9}tail disponible")
                        .to_string(),
                    category: check.category.clone(),
                    frameworks: check.frameworks.clone(),
                });
            }
        }

        // 2. Critical/High vulnerabilities
        for vuln in &state.vulnerability_findings {
            if matches!(vuln.severity, Severity::Critical | Severity::High) {
                let fix_label = if vuln.fix_available {
                    "Correctif disponible \u{2014} appliquer en priorit\u{00e9}"
                } else {
                    "Aucun correctif disponible \u{2014} appliquer des mesures compensatoires"
                };
                recs.push(Recommendation {
                    kind: "vulnerability",
                    severity: vuln.severity,
                    title: format!("Corriger : {} sur {}", vuln.cve_id, vuln.affected_software),
                    subtitle: fix_label.to_string(),
                    detail: vuln.description.clone(),
                    category: "vulnerability".to_string(),
                    frameworks: Vec::new(),
                });
            }
        }

        // 3. Network security alerts
        for alert in &state.network.alerts {
            recs.push(Recommendation {
                kind: "network",
                severity: alert.severity,
                title: format!("Investiguer : {}", alert_type_label(&alert.alert_type)),
                subtitle: alert.description.clone(),
                detail: format!(
                    "{}{}{}",
                    alert
                        .source_ip
                        .as_deref()
                        .map(|ip| format!("Source : {} \u{2014} ", ip))
                        .unwrap_or_default(),
                    alert
                        .destination_ip
                        .as_deref()
                        .map(|ip| format!("Destination : {}", ip))
                        .unwrap_or_default(),
                    alert
                        .destination_port
                        .map(|p| format!(" :{}", p))
                        .unwrap_or_default(),
                ),
                category: alert.alert_type.clone(),
                frameworks: Vec::new(),
            });
        }

        // 4. System incidents
        for incident in &state.threats.system_incidents {
            recs.push(Recommendation {
                kind: "threat",
                severity: incident.severity,
                title: format!("R\u{00e9}soudre : {}", incident.title),
                subtitle: incident.description.clone(),
                detail: format!(
                    "Type : {} \u{2014} Confiance : {}\u{202f}%",
                    incident.incident_type, incident.confidence
                ),
                category: incident.incident_type.clone(),
                frameworks: Vec::new(),
            });
        }

        // Sort by severity weight descending
        recs.sort_by(|a, b| b.severity.weight().total_cmp(&a.severity.weight()));
        recs
    }

    // ── Render helpers ───────────────────────────────────────────────────

    fn show_empty_state(ui: &mut egui::Ui) {
        widgets::empty_state(
            ui,
            icons::BRAIN,
            "Analyse en attente",
            Some("Lancez un audit de conformit\u{00e9} pour activer l'analyse IA automatique."),
        );
    }

    fn render_posture_hero(ui: &mut egui::Ui, state: &AppState, ai_score: f32) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                // Left: Gauge
                ui.vertical(|ui| {
                    ui.set_width(POSTURE_GAUGE_WIDTH);
                    widgets::compliance_gauge_captioned(ui, Some(ai_score), 70.0, "SCORE IA");
                });

                ui.add_space(theme::SPACE_LG);

                // Right: Risk level and breakdown
                ui.vertical(|ui| {
                    ui.add_space(theme::SPACE_MD);

                    let risk_label = Self::risk_label(ai_score);
                    let risk_color = theme::readable_color(theme::score_color(ai_score));

                    ui.label(
                        egui::RichText::new("SCORE DE S\u{00c9}CURIT\u{00c9} IA")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_XS);

                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{:.0}\u{202f}%", ai_score))
                                .font(theme::font_card_value())
                                .color(risk_color)
                                .strong(),
                        );
                        ui.add_space(theme::SPACE_SM);
                        widgets::status_badge(ui, risk_label, risk_color);
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Component breakdown
                    ui.label(
                        egui::RichText::new("COMPOSANTES DU SCORE")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_SM);

                    let compliance_pct = state.summary.compliance_score.unwrap_or(50.0);
                    let (processes, incidents, alert_count, _) = state.open_threat_counts();
                    let threat_count = processes + incidents;
                    let vuln_count = state.vulnerability_findings.len();

                    let components: &[(&str, f32, &str)] = &[
                        ("Conformit\u{00e9}", compliance_pct, "40%"),
                        (
                            "Menaces",
                            100.0 - (threat_count as f32 * 10.0).min(100.0),
                            "20%",
                        ),
                        (
                            "Vuln\u{00e9}rabilit\u{00e9}s",
                            100.0 - (vuln_count as f32 * 5.0).min(100.0),
                            "25%",
                        ),
                        (
                            "R\u{00e9}seau",
                            100.0 - (alert_count as f32 * 15.0).min(100.0),
                            "15%",
                        ),
                    ];

                    for (label, score, weight) in components {
                        let color = theme::readable_color(theme::score_color(*score));
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(format!("{} ({})", label, weight))
                                    .font(theme::font_small())
                                    .color(theme::text_secondary()),
                            );
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(format!("{:.0}\u{202f}%", score))
                                            .font(theme::font_small())
                                            .color(color)
                                            .strong(),
                                    );
                                },
                            );
                        });
                    }
                });
            });
        });
    }

    fn render_insights_grid(ui: &mut egui::Ui, state: &AppState) {
        let failing = state.policy.failing;
        let vuln_count = state.vulnerability_findings.len();
        let (processes, incidents, network, _) = state.open_threat_counts();
        let threat_count = processes + network + incidents;
        let compliance_pct = state
            .summary
            .compliance_score
            .map(|s| format!("{:.0}\u{202f}%", s))
            .unwrap_or_else(|| "--".to_string());

        let items = vec![
            (
                "CONTR\u{00d4}LES D\u{00c9}FAILLANTS",
                failing.to_string(),
                if failing > 0 {
                    theme::ERROR
                } else {
                    theme::SUCCESS
                },
                icons::CIRCLE_XMARK,
            ),
            (
                "VULN\u{00c9}RABILIT\u{00c9}S ACTIVES",
                vuln_count.to_string(),
                if vuln_count > 0 {
                    theme::SEVERITY_HIGH
                } else {
                    theme::text_tertiary()
                },
                icons::SHIELD_VIRUS,
            ),
            (
                "MENACES D\u{00c9}TECT\u{00c9}ES",
                threat_count.to_string(),
                if threat_count > 0 {
                    theme::WARNING
                } else {
                    theme::text_tertiary()
                },
                icons::SKULL,
            ),
            (
                "SCORE DE CONFORMIT\u{00c9}",
                compliance_pct,
                theme::ACCENT,
                icons::COMPLIANCE,
            ),
        ];

        let grid = widgets::ResponsiveGrid::new(180.0, theme::SPACE_SM);
        grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });
    }

    fn summary_card(
        ui: &mut egui::Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(icon)
                            .size(theme::ICON_MD)
                            .color(color.linear_multiply(theme::OPACITY_STRONG)),
                    );
                    ui.add_space(theme::SPACE_SM);
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .font(theme::font_stat())
                                .color(color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_min())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                    });
                });
            });
        });
    }

    fn render_recommendations_list(
        ui: &mut egui::Ui,
        state: &mut AppState,
        recommendations: &[Recommendation],
        filtered: &[usize],
    ) {
        use widgets::table;

        let mut clicked_idx: Option<usize> = None;
        let selected = state.ai.selected_recommendation;

        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(96.0, 0.0),  // Priorité
                table::Col::fluid(110.0, 0.5), // Source
                table::Col::fluid(180.0, 2.0), // Recommandation
                table::Col::fluid(160.0, 3.0), // Remédiation
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            for label in [
                "PRIORIT\u{00c9}",
                "SOURCE",
                "RECOMMANDATION",
                "REM\u{00c9}DIATION",
            ] {
                header.col(|ui: &mut egui::Ui| {
                    table::header_cell(ui, label);
                });
            }
        })
        .body(|mut body| {
            for &idx in filtered {
                let rec = &recommendations[idx];
                let is_selected = selected == Some(idx);
                let sev_color = theme::severity_color_typed(&rec.severity);

                body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                    row.set_selected(is_selected);

                    // Priority badge
                    row.col(|ui: &mut egui::Ui| {
                        widgets::status_badge(ui, rec.severity.label(), sev_color);
                    });

                    // Source kind
                    row.col(|ui: &mut egui::Ui| {
                        table::cell_icon(
                            ui,
                            kind_icon(rec.kind),
                            kind_color(rec.kind),
                            kind_label(rec.kind),
                        );
                    });

                    // Title
                    row.col(|ui: &mut egui::Ui| {
                        table::cell_colored(ui, &rec.title, theme::accent_text());
                    });

                    // Remediation short
                    row.col(|ui: &mut egui::Ui| {
                        table::cell_small(ui, &rec.subtitle);
                    });

                    if table::row_interaction(&row, is_selected) {
                        clicked_idx = Some(idx);
                    }
                });
            }
        });

        if let Some(idx) = clicked_idx {
            state.ai.selected_recommendation = Some(idx);
            state.ai.detail_open = true;
        }
    }

    fn export_recommendation(state: &AppState, rec: &Recommendation) {
        let rows = vec![vec![
            rec.severity.as_str().to_string(),
            kind_label(rec.kind).to_string(),
            rec.title.clone(),
            rec.subtitle.clone(),
            rec.category.clone(),
            rec.frameworks.join(", "),
        ]];

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || {
                let headers = &[
                    "priorite",
                    "source",
                    "recommandation",
                    "remediation",
                    "categorie",
                    "frameworks",
                ];
                let path = crate::export::default_export_path("recommandation_ia.csv");
                match crate::export::export_csv(headers, &rows, &path) {
                    Ok(()) => {
                        if let Err(e) = tx.send(crate::app::AsyncTaskResult::CsvExport(
                            true,
                            "Export CSV r\u{00e9}ussi".to_string(),
                        )) {
                            tracing::warn!("Failed to send CSV export success: {}", e);
                        }
                    }
                    Err(e) => {
                        if let Err(send_err) = tx.send(crate::app::AsyncTaskResult::CsvExport(
                            false,
                            format!("\u{00c9}chec export: {}", e),
                        )) {
                            tracing::warn!("Failed to send CSV export error: {}", send_err);
                        }
                    }
                }
            });
        }
    }
}

// ============================================================================
// LLM Status Widget (dashboard compact)
// ============================================================================

/// Compact LLM status for the dashboard command center.
#[derive(Default)]
pub struct LLMStatusWidget;

impl LLMStatusWidget {
    /// Show compact status. Displays recommendation count when data is available.
    pub fn show(&self, ui: &mut egui::Ui, state: &AppState) {
        let failing = state.policy.failing as usize;
        let vuln_critical = state
            .vulnerability_findings
            .iter()
            .filter(|v| matches!(v.severity, Severity::Critical | Severity::High))
            .count();
        let (processes, incidents, network, _) = state.open_threat_counts();
        let threat_count = processes + network + incidents;
        let total = failing + vuln_critical + threat_count;

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(icons::BRAIN)
                    .size(theme::ICON_SM)
                    .color(if total > 0 {
                        theme::WARNING
                    } else {
                        theme::SUCCESS
                    }),
            );
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new("IA :")
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
            );
            if total > 0 {
                ui.label(
                    egui::RichText::new(format!("{} recommandations", total))
                        .font(theme::font_small())
                        .color(theme::readable_color(theme::WARNING))
                        .strong(),
                );
            } else if state.checks.is_empty() {
                ui.label(
                    egui::RichText::new("En attente")
                        .font(theme::font_small())
                        .color(theme::text_tertiary()),
                );
            } else {
                ui.label(
                    egui::RichText::new("Aucune alerte")
                        .font(theme::font_small())
                        .color(theme::readable_color(theme::SUCCESS)),
                );
            }
        });
    }
}

// ============================================================================
// Helper functions
// ============================================================================

/// Category-to-remediation French text mapping.
fn category_remediation(category: &str) -> &'static str {
    match category {
        "encryption" => "Activez le chiffrement complet du disque (FileVault/BitLocker/LUKS)",
        "firewall" => {
            "Activez le pare-feu syst\u{00e8}me et v\u{00e9}rifiez les r\u{00e8}gles de filtrage"
        }
        "antivirus" => "Installez et activez une solution antivirus \u{00e0} jour",
        "authentication" => "Renforcez la politique d'authentification et activez le MFA",
        "updates" => "Appliquez les mises \u{00e0} jour de s\u{00e9}curit\u{00e9} en attente",
        "session_lock" => "Configurez le verrouillage automatique de session",
        "backup" => "Mettez en place une strat\u{00e9}gie de sauvegarde r\u{00e9}guli\u{00e8}re",
        "protocols" => "D\u{00e9}sactivez les protocoles obsol\u{00e8}tes (SSLv3, TLS 1.0/1.1)",
        "accounts" => {
            "V\u{00e9}rifiez les comptes utilisateurs et supprimez les comptes inutilis\u{00e9}s"
        }
        "mfa" => "Activez l'authentification multi-facteurs sur tous les acc\u{00e8}s",
        "remote_access" => {
            "S\u{00e9}curisez les acc\u{00e8}s distants et limitez les ports ouverts"
        }
        "audit_logging" => {
            "Activez la journalisation des \u{00e9}v\u{00e9}nements de s\u{00e9}curit\u{00e9}"
        }
        "device_control" => "Restreignez l'acc\u{00e8}s aux p\u{00e9}riph\u{00e9}riques amovibles",
        "kernel_security" => "Renforcez la s\u{00e9}curit\u{00e9} du noyau (SIP, Secure Boot)",
        "network_hardening" => "Renforcez la configuration r\u{00e9}seau et segmentez les flux",
        "time_sync" => "Configurez la synchronisation NTP avec un serveur fiable",
        "browser_security" => "Appliquez les politiques de s\u{00e9}curit\u{00e9} du navigateur",
        "directory_policy" => {
            "V\u{00e9}rifiez les strat\u{00e9}gies GPO et politiques Active Directory"
        }
        "privileged_access" => {
            "Limitez les acc\u{00e8}s privil\u{00e9}gi\u{00e9}s et appliquez le moindre privil\u{00e8}ge"
        }
        "network_security" => {
            "Renforcez les contr\u{00f4}les de s\u{00e9}curit\u{00e9} r\u{00e9}seau"
        }
        "access_control" => "V\u{00e9}rifiez les contr\u{00f4}les d'acc\u{00e8}s et permissions",
        "container_security" => "S\u{00e9}curisez les conteneurs et images Docker",
        "certificate_management" => {
            "Renouvelez les certificats expir\u{00e9}s et v\u{00e9}rifiez la cha\u{00ee}ne de confiance"
        }
        "data_protection" => "Classifiez et prot\u{00e9}gez les donn\u{00e9}es sensibles",
        "cloud_security" => {
            "V\u{00e9}rifiez la configuration de s\u{00e9}curit\u{00e9} des services cloud"
        }
        "general" => {
            "V\u{00e9}rifiez la conformit\u{00e9} g\u{00e9}n\u{00e9}rale du syst\u{00e8}me"
        }
        _ => "V\u{00e9}rifiez la conformit\u{00e9} du contr\u{00f4}le concern\u{00e9}",
    }
}

/// Network alert type to French label.
fn alert_type_label(alert_type: &str) -> &'static str {
    match alert_type {
        "c2" => "Communication C2 suspecte",
        "mining" => "Activit\u{00e9} de minage d\u{00e9}tect\u{00e9}e",
        "exfiltration" => "Exfiltration de donn\u{00e9}es suspecte",
        "dga" => "Domaine DGA d\u{00e9}tect\u{00e9}",
        "beaconing" => "Beaconing r\u{00e9}seau d\u{00e9}tect\u{00e9}",
        "port_scan" => "Scan de ports d\u{00e9}tect\u{00e9}",
        "suspicious_port" => "Port suspect d\u{00e9}tect\u{00e9}",
        "dns_tunneling" => "Tunnel DNS d\u{00e9}tect\u{00e9}",
        _ => "Alerte r\u{00e9}seau",
    }
}

/// Kind to French label.
pub fn kind_label(kind: &str) -> &'static str {
    match kind {
        "compliance" => "Conformit\u{00e9}",
        "vulnerability" => "Vuln\u{00e9}rabilit\u{00e9}",
        "network" => "R\u{00e9}seau",
        "threat" => "Menace",
        _ => "Autre",
    }
}

/// Kind to icon.
pub fn kind_icon(kind: &str) -> &'static str {
    match kind {
        "compliance" => icons::COMPLIANCE,
        "vulnerability" => icons::SHIELD_VIRUS,
        "network" => icons::NETWORK,
        "threat" => icons::SKULL,
        _ => icons::INFO,
    }
}

/// Kind to theme color.
pub fn kind_color(kind: &str) -> egui::Color32 {
    match kind {
        "compliance" => theme::ACCENT,
        "vulnerability" => theme::ERROR,
        "network" => theme::INFO,
        "threat" => theme::WARNING,
        _ => theme::text_tertiary(),
    }
}

/// Format category to uppercase French label (reuse compliance.rs mapping).
fn format_category(category: &str) -> String {
    match category {
        "encryption" => "CHIFFREMENT".to_string(),
        "antivirus" => "ANTIVIRUS".to_string(),
        "firewall" => "PARE-FEU".to_string(),
        "authentication" => "AUTHENTIFICATION".to_string(),
        "session_lock" => "VERROUILLAGE".to_string(),
        "updates" => "MISES \u{00c0} JOUR".to_string(),
        "protocols" => "PROTOCOLES".to_string(),
        "backup" => "SAUVEGARDE".to_string(),
        "accounts" => "COMPTES".to_string(),
        "mfa" => "MFA".to_string(),
        "remote_access" => "ACC\u{00c8}S DISTANT".to_string(),
        "audit_logging" => "AUDIT".to_string(),
        "device_control" => "P\u{00c9}RIPH\u{00c9}RIQUES".to_string(),
        "kernel_security" => "NOYAU".to_string(),
        "network_hardening" => "R\u{00c9}SEAU".to_string(),
        "time_sync" => "SYNCHRONISATION".to_string(),
        "browser_security" => "NAVIGATEUR".to_string(),
        "directory_policy" => "STRAT\u{00c9}GIES GPO".to_string(),
        "privileged_access" => "ACC\u{00c8}S PRIVIL\u{00c9}GI\u{00c9}S".to_string(),
        "general" => "G\u{00c9}N\u{00c9}RAL".to_string(),
        "network_security" => "S\u{00c9}CURIT\u{00c9} R\u{00c9}SEAU".to_string(),
        "access_control" => "CONTR\u{00d4}LE D'ACC\u{00c8}S".to_string(),
        "container_security" => "CONTENEURS".to_string(),
        "certificate_management" => "CERTIFICATS".to_string(),
        "data_protection" => "PROTECTION DONN\u{00c9}ES".to_string(),
        "cloud_security" => "S\u{00c9}CURIT\u{00c9} CLOUD".to_string(),
        "vulnerability" => "VULN\u{00c9}RABILIT\u{00c9}".to_string(),
        _ => category.to_uppercase().replace('_', " "),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assistant_composer_stays_visible_below_transcript() {
        for size in [egui::vec2(960.0, 640.0), egui::vec2(1360.0, 820.0)] {
            for scenario in 0..4 {
                let ctx = egui::Context::default();
                theme::configure_fonts(&ctx);
                theme::apply_theme(&ctx, scenario % 2 == 0);
                let mut state = AppState::default();
                state.ai.is_listening = scenario == 2;
                state.ai.voice_error = (scenario == 3).then(|| "Microphone indisponible".into());
                if scenario != 0 {
                    state.ai.chat_history.push(crate::dto::LlmChatMessage {
                        role: ChatRole::Assistant,
                        content: "Réponse longue à consulter. ".repeat(200),
                        timestamp: chrono::Utc::now(),
                        processing_time_ms: None,
                    });
                }
                for frame in 0..3 {
                    let output = ctx.run(
                        egui::RawInput {
                            screen_rect: Some(egui::Rect::from_min_size(egui::Pos2::ZERO, size)),
                            ..Default::default()
                        },
                        |ctx| {
                            egui::TopBottomPanel::top("header")
                                .exact_height(56.0)
                                .show(ctx, |_| {});
                            egui::SidePanel::left("sidebar")
                                .exact_width(if size.x < 1000.0 { 64.0 } else { 244.0 })
                                .show(ctx, |_| {});
                            egui::CentralPanel::default().show(ctx, |ui| {
                                egui::ScrollArea::vertical().show(ui, |ui| {
                                    crate::app::page_column(ui, |ui| {
                                        LLMPanel.show(ui, &mut state);
                                    });
                                });
                            });
                        },
                    );
                    if frame < 2 {
                        continue;
                    }
                    for label in [
                        if scenario == 2 {
                            format!("{} Terminer la dictée", icons::STOP)
                        } else {
                            format!("{} Dicter", icons::MICROPHONE)
                        },
                        format!("{} Réglages vocaux", icons::GEAR),
                        format!("{} Parler", icons::HEADPHONES),
                        "Décrivez votre question, les faits et le résultat attendu…".to_owned(),
                    ] {
                        let painted = output
                            .shapes
                            .iter()
                            .find_map(|shape| {
                                if let egui::epaint::Shape::Text(text) = &shape.shape
                                    && text.galley.text() == label
                                {
                                    return Some((
                                        text.galley.rect.translate(text.pos.to_vec2()),
                                        shape.clip_rect,
                                    ));
                                }
                                None
                            })
                            .unwrap_or_else(|| panic!("Missing {label}"));
                        assert!(
                            painted.1.expand(1.0).contains_rect(painted.0),
                            "{label} clipped at {size:?}: {painted:?}"
                        );
                        assert!(painted.0.bottom() < size.y, "{label} below viewport");
                        assert!(
                            painted.0.top() > size.y * 0.5,
                            "{label} overlaps navigation"
                        );
                    }
                }
            }
        }
    }

    fn check(
        id: &str,
        status: GuiCheckStatus,
        message: &str,
        details: serde_json::Value,
    ) -> crate::dto::GuiCheckResult {
        crate::dto::GuiCheckResult {
            check_id: id.to_string(),
            name: id.replace('_', " "),
            category: "test".to_string(),
            status,
            severity: Severity::High,
            score: None,
            message: Some(message.to_string()),
            details: Some(details),
            executed_at: Some(chrono::Utc::now()),
            frameworks: vec![],
        }
    }

    #[test]
    fn grounded_context_lists_every_security_domain_with_measured_values() {
        let mut state = AppState::default();
        let checks = vec![
            check(
                "antivirus_active",
                GuiCheckStatus::Pass,
                "Windows Defender is active with real-time protection. Definitions: 1.419.52",
                serde_json::json!({"enabled": true}),
            ),
            check(
                "firewall_active",
                GuiCheckStatus::Fail,
                "Windows Firewall is not enabled",
                serde_json::json!({"enabled": false, "profiles": {"public": false, "domain": true}}),
            ),
            check(
                "password_policy",
                GuiCheckStatus::Fail,
                "Password policy is non-compliant",
                serde_json::json!({"min_length": 6, "complexity": false, "note": null}),
            ),
            check(
                "backup_configured",
                GuiCheckStatus::Error,
                "Access denied reading backup configuration",
                serde_json::json!({"error": "E_ACCESSDENIED"}),
            ),
            check(
                "bluetooth_disabled",
                GuiCheckStatus::Pass,
                "ok",
                serde_json::json!({}),
            ),
        ];
        state.checks = checks;
        let mut acknowledged = crate::dto::GuiSuspiciousProcess {
            process_name: "vieux.exe".into(),
            pid: 1,
            command_line: "vieux.exe".into(),
            reason: "ancien".into(),
            confidence: 50,
            detected_at: chrono::Utc::now(),
            ai_confidence: None,
            is_false_positive: None,
            ai_analysis: None,
            acknowledged: true,
            allowlisted: false,
        };
        state
            .threats
            .suspicious_processes
            .push_back(acknowledged.clone());
        acknowledged.process_name = "powershell.exe".into();
        acknowledged.command_line = "powershell -enc SQBFAFgA".into();
        acknowledged.reason = "PowerShell encodé".into();
        acknowledged.acknowledged = false;
        state.threats.suspicious_processes.push_back(acknowledged);

        let prompt = LLMPanel::grounded_prompt(&state, "Quel est l'état du pare-feu ?");

        // Passing controls give the measured configuration.
        assert!(prompt.contains(
            "antivirus active [antivirus_active]: conforme — Windows Defender is active"
        ));
        // Failures carry their cause and the collected values.
        assert!(
            prompt.contains("[firewall_active]: NON CONFORME — Windows Firewall is not enabled | relevé: enabled=non, profiles.")
        );
        assert!(prompt.contains("profiles.domain=oui") && prompt.contains("profiles.public=non"));
        // Key order depends on whether feature unification turns on
        // serde_json's `preserve_order`, so assert each fact on its own.
        assert!(prompt.contains("min_length=6") && prompt.contains("complexity=non"));
        assert!(!prompt.contains("note="));
        // Every domain is listed, measured or explicitly not evaluated.
        for (label, _) in LLMPanel::SECURITY_DOMAINS {
            assert!(prompt.contains(&format!("- {label}: ")), "{label} missing");
        }
        assert!(prompt.contains("- Mises à jour: non évalué sur ce poste"));
        // Other failures and errors come with their cause; passing ones do not.
        assert!(prompt.contains("backup configured [backup_configured]: ERREUR DE CONTRÔLE — Access denied reading backup configuration | relevé: error=E_ACCESSDENIED"));
        assert!(!prompt.contains("bluetooth"));
        assert!(prompt.contains("5 au total, 2 conformes, 2 non conformes, 1 en erreur"));
        // Only open threats, with their command line.
        assert!(
            prompt.contains("powershell.exe PID 1")
                && prompt.contains("commande: powershell -enc SQBFAFgA")
        );
        assert!(!prompt.contains("vieux.exe"));
        assert!(prompt.ends_with("N'affirme jamais avoir observé une donnée absente."));
        assert!(prompt.contains("QUESTION OPÉRATEUR:\nQuel est l'état du pare-feu ?"));
        // Bounded for the local model (8k-token context).
        assert!(prompt.chars().count() < 9_000, "{}", prompt.chars().count());
    }

    #[test]
    fn details_summary_is_bounded_and_skips_empty_values() {
        let details = serde_json::json!({
            "a": "x".repeat(100),
            "list": [1, 2, 3, 4, 5, 6],
            "empty": "",
            "deep": {"level": {"too_deep": 1}},
        });
        let summary = LLMPanel::details_summary(&details, 90);
        assert!(summary.chars().count() <= 90);
        assert!(summary.contains("list=1/2/3/4"));
        assert!(!summary.contains("empty") && !summary.contains("too_deep"));
    }

    #[test]
    fn submissions_share_grounding_respect_context_and_never_duplicate_while_busy() {
        let mut state = AppState::default();
        state.ai.prompt_context = Some(crate::dto::LlmPromptContext::Compliance);
        let command =
            LLMPanel::submit_prompt(&mut state, "Fais un rapport pour mon équipe", false).unwrap();
        let GuiCommand::LlmPrompt {
            prompt,
            context,
            speak_response,
        } = command
        else {
            panic!("wrong command");
        };
        assert_eq!(context, Some(crate::dto::LlmPromptContext::Compliance));
        assert!(prompt.contains("Conformité: score non mesuré, aucun scan de conformité exécuté"));
        assert!(!speak_response);
        assert!(LLMPanel::submit_prompt(&mut state, "Encore", false).is_none());
        assert_eq!(state.ai.chat_history.len(), 1);
        assert_eq!(
            LLMPanel::infer_prompt_context("rapport pour mon équipe"),
            crate::dto::LlmPromptContext::General
        );
        assert_eq!(
            LLMPanel::infer_prompt_context("Inspecter le port 443"),
            crate::dto::LlmPromptContext::Network
        );
    }

    #[test]
    fn test_llm_panel_creation() {
        let _panel = LLMPanel;
    }

    #[test]
    fn test_llm_status_widget() {
        let _widget = LLMStatusWidget;
    }

    #[test]
    fn test_ai_score_empty_state() {
        let state = AppState::default();
        let score = LLMPanel::compute_ai_score(&state);
        assert!((0.0..=100.0).contains(&score));
    }

    #[test]
    fn test_build_recommendations_empty() {
        let state = AppState::default();
        let recs = LLMPanel::build_recommendations(&state);
        assert!(recs.is_empty());
    }

    #[test]
    fn test_risk_label() {
        assert_eq!(
            LLMPanel::risk_label(90.0),
            "POSTURE S\u{00c9}CURIS\u{00c9}E"
        );
        assert_eq!(LLMPanel::risk_label(70.0), "RISQUE MOD\u{00c9}R\u{00c9}");
        assert_eq!(LLMPanel::risk_label(40.0), "RISQUE \u{00c9}LEV\u{00c9}");
        assert_eq!(LLMPanel::risk_label(10.0), "RISQUE CRITIQUE");
    }

    #[test]
    fn prompt_context_routes_security_domains() {
        use crate::dto::LlmPromptContext;

        assert_eq!(
            LLMPanel::infer_prompt_context("Quels correctifs pour cette CVE ?"),
            LlmPromptContext::Vulnerabilities
        );
        assert_eq!(
            LLMPanel::infer_prompt_context("Analyse les alertes DNS du réseau"),
            LlmPromptContext::Network
        );
        assert_eq!(
            LLMPanel::infer_prompt_context("Résume les incidents et IOC"),
            LlmPromptContext::Threats
        );
        assert_eq!(
            LLMPanel::infer_prompt_context("Prépare l'audit ISO 27001"),
            LlmPromptContext::Compliance
        );
    }

    #[test]
    fn telemetry_excerpt_is_unicode_safe_and_bounded() {
        assert_eq!(
            LLMPanel::text_excerpt("sécurité 🚨 active", 10),
            "sécurité …"
        );
        assert_eq!(LLMPanel::text_excerpt("court", 10), "court");
        assert_eq!(LLMPanel::text_excerpt("donnée", 0), "");
    }

    #[test]
    fn telemetry_severity_ranking_prioritizes_critical_evidence() {
        use crate::dto::Severity;

        assert!(
            LLMPanel::severity_weight(Severity::Critical)
                > LLMPanel::severity_weight(Severity::High)
        );
        assert!(
            LLMPanel::severity_weight(Severity::High) > LLMPanel::severity_weight(Severity::Medium)
        );
        assert_eq!(LLMPanel::severity_weight(Severity::Info), 0);
    }

    #[test]
    fn test_category_remediation_known() {
        let text = category_remediation("encryption");
        assert!(text.contains("chiffrement"));
    }

    #[test]
    fn test_category_remediation_fallback() {
        let text = category_remediation("unknown_xyz");
        assert!(text.contains("conformit"));
    }

    #[test]
    fn test_alert_type_label() {
        assert_eq!(alert_type_label("c2"), "Communication C2 suspecte");
        assert_eq!(alert_type_label("unknown"), "Alerte r\u{00e9}seau");
    }

    #[test]
    fn test_kind_helpers() {
        assert_eq!(kind_label("compliance"), "Conformit\u{00e9}");
        assert_eq!(kind_icon("vulnerability"), icons::SHIELD_VIRUS);
        assert_ne!(kind_color("network"), egui::Color32::TRANSPARENT);
    }

    #[test]
    fn test_format_category() {
        assert_eq!(format_category("encryption"), "CHIFFREMENT");
        assert_eq!(format_category("unknown_cat"), "UNKNOWN CAT");
    }
}
