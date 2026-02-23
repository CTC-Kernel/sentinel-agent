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
        // ── Page Header ─────────────────────────────────────────────────
        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Pilotage", "Intelligence IA"],
            "Intelligence Artificielle",
            Some("MODULE D'ANALYSE IA ET RECOMMANDATIONS AUTOMATIQUES"),
            Some(
                "Synth\u{00e8}se automatique des donn\u{00e9}es de conformit\u{00e9}, vuln\u{00e9}rabilit\u{00e9}s, menaces et alertes r\u{00e9}seau en recommandations prioris\u{00e9}es par niveau de criticit\u{00e9}.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // ── Tab Bar ─────────────────────────────────────────────────────
        let selected_idx = state.ai.active_tab.index() as usize;

        let chat_count = state.ai.chat_history.len() as u32;
        // Use cached count for badge to avoid building recommendations twice per frame
        let rec_count = state.ai.recommendations_count as u32;

        let mut assistant_tab = Tab::new("ASSISTANT IA").icon(icons::ROBOT);
        if chat_count > 0 {
            assistant_tab = assistant_tab.badge(chat_count.min(99));
        }
        let mut recs_tab = Tab::new("RECOMMANDATIONS").icon(icons::BRAIN);
        if rec_count > 0 {
            recs_tab = recs_tab.badge(rec_count.min(99));
        }
        let model_tab = Tab::new("STATUT MOD\u{00c8}LE").icon(icons::MICROCHIP);

        let tabs = vec![assistant_tab, recs_tab, model_tab];

        if let Some(new_idx) = TabBar::new(tabs, selected_idx).full_width().show(ui) {
            let new_tab = LlmTab::from_index(new_idx as u8);
            state.ai.active_tab = new_tab;
        }

        ui.add_space(theme::SPACE_LG);

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

    fn show_assistant_tab(
        ui: &mut egui::Ui,
        state: &mut AppState,
    ) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        // Empty state
        if state.ai.chat_history.is_empty() && !state.ai.is_processing {
            widgets::empty_state(
                ui,
                icons::ROBOT,
                "ASSISTANT IA",
                Some(
                    "Posez une question de s\u{00e9}curit\u{00e9} ou utilisez les actions rapides ci-dessous pour d\u{00e9}marrer.",
                ),
            );
            ui.add_space(theme::SPACE_LG);
        } else {
            // ── Chat History (scrollable) ────────────────────────────────
            let available_height = ui.available_height() - 120.0; // Reserve space for input area
            egui::ScrollArea::vertical()
                .id_salt("llm_chat_scroll")
                .max_height(available_height.max(200.0))
                .stick_to_bottom(true)
                .show(ui, |ui| {
                    ui.add_space(theme::SPACE_SM);

                    for msg in &state.ai.chat_history {
                        Self::render_chat_message(ui, msg);
                        ui.add_space(theme::SPACE_SM);
                    }

                    // Processing indicator
                    if state.ai.is_processing {
                        Self::render_processing_indicator(ui);
                        ui.add_space(theme::SPACE_SM);
                    }
                });

            ui.add_space(theme::SPACE_MD);
        }

        // ── Quick Action Buttons ─────────────────────────────────────────
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing.x = theme::SPACE_SM;

            let quick_actions: &[(&str, &str, &str)] = &[
                (icons::SHIELD_CHECK, "Analyser ma posture", "Analyse ma posture de s\u{00e9}curit\u{00e9} globale et donne-moi un r\u{00e9}sum\u{00e9} des points critiques."),
                (icons::SHIELD_VIRUS, "R\u{00e9}sumer les vuln\u{00e9}rabilit\u{00e9}s", "R\u{00e9}sume les vuln\u{00e9}rabilit\u{00e9}s d\u{00e9}tect\u{00e9}es et recommande les actions prioritaires."),
                (icons::SEARCH, "D\u{00e9}tecter les faux positifs", "Analyse les alertes et menaces d\u{00e9}tect\u{00e9}es pour identifier les \u{00e9}ventuels faux positifs."),
            ];

            for &(icon, label, prompt) in quick_actions {
                let btn = egui::Button::new(
                    egui::RichText::new(format!("{} {}", icon, label))
                        .font(theme::font_small())
                        .color(theme::accent_text()),
                )
                .fill(theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE))
                .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8))
                .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::ACCENT.linear_multiply(theme::OPACITY_MUTED)));

                if ui.add_enabled(!state.ai.is_processing, btn).clicked() {
                    // Add user message to history
                    state.ai.chat_history.push(crate::dto::LlmChatMessage {
                        role: ChatRole::User,
                        content: prompt.to_string(),
                        timestamp: chrono::Utc::now(),
                        processing_time_ms: None,
                    });
                    state.ai.is_processing = true;
                    command = Some(GuiCommand::LlmPrompt {
                        prompt: prompt.to_string(),
                        context: None,
                    });
                }
            }
        });

        ui.add_space(theme::SPACE_MD);

        // ── Input Area ───────────────────────────────────────────────────
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::COMMENT)
                        .size(theme::ICON_SM)
                        .color(theme::text_tertiary()),
                );
                ui.add_space(theme::SPACE_XS);

                let text_edit = egui::TextEdit::singleline(&mut state.ai.input_text)
                    .hint_text("Posez une question de s\u{00e9}curit\u{00e9}...")
                    .font(theme::font_body())
                    .desired_width(ui.available_width() - 80.0)
                    .text_color(theme::text_primary());

                let response = ui.add_enabled(!state.ai.is_processing, text_edit);

                // Send on Enter
                let enter_pressed = response.lost_focus()
                    && ui.input(|i| i.key_pressed(egui::Key::Enter));

                let send_btn = egui::Button::new(
                    egui::RichText::new(icons::PAPER_PLANE)
                        .size(theme::ICON_SM)
                        .color(theme::text_on_accent()),
                )
                .fill(theme::ACCENT)
                .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8));

                let can_send = !state.ai.is_processing && !state.ai.input_text.trim().is_empty();
                let send_clicked = ui.add_enabled(can_send, send_btn).clicked();

                if (enter_pressed || send_clicked) && can_send {
                    let prompt = state.ai.input_text.trim().to_string();
                    state.ai.chat_history.push(crate::dto::LlmChatMessage {
                        role: ChatRole::User,
                        content: prompt.clone(),
                        timestamp: chrono::Utc::now(),
                        processing_time_ms: None,
                    });
                    state.ai.input_text.clear();
                    state.ai.is_processing = true;
                    command = Some(GuiCommand::LlmPrompt {
                        prompt,
                        context: None,
                    });
                }
            });
        });

        command
    }

    /// Render a single chat message bubble.
    fn render_chat_message(ui: &mut egui::Ui, msg: &crate::dto::LlmChatMessage) {
        let is_user = msg.role == ChatRole::User;
        let is_system = msg.role == ChatRole::System;

        let layout = if is_user {
            egui::Layout::right_to_left(egui::Align::TOP)
        } else {
            egui::Layout::left_to_right(egui::Align::TOP)
        };

        ui.with_layout(layout, |ui: &mut egui::Ui| {
            // Constrain bubble width
            let max_width = (ui.available_width() * 0.75).min(600.0);
            ui.set_max_width(max_width);

            let (bg_color, text_color, role_icon, role_color) = if is_user {
                (
                    theme::ACCENT.linear_multiply(theme::OPACITY_TINT),
                    theme::text_primary(),
                    icons::USER,
                    theme::ACCENT,
                )
            } else if is_system {
                (
                    theme::WARNING.linear_multiply(theme::OPACITY_SUBTLE),
                    theme::text_primary(),
                    icons::BOLT,
                    theme::WARNING,
                )
            } else {
                (
                    theme::bg_elevated(),
                    theme::text_primary(),
                    icons::ROBOT,
                    theme::SUCCESS,
                )
            };

            egui::Frame::new()
                .fill(bg_color)
                .corner_radius(egui::CornerRadius::same(theme::SPACE_MD as u8))
                .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
                .stroke(egui::Stroke::new(
                    theme::BORDER_HAIRLINE,
                    theme::border(),
                ))
                .show(ui, |ui: &mut egui::Ui| {
                    // Role badge
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(role_icon)
                                .size(theme::ICON_SM)
                                .color(role_color),
                        );
                        ui.add_space(theme::SPACE_XS);
                        ui.label(
                            egui::RichText::new(msg.role.label_fr())
                                .font(theme::font_label())
                                .color(role_color)
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

                    // Content
                    ui.label(
                        egui::RichText::new(&msg.content)
                            .font(theme::font_body())
                            .color(text_color),
                    );

                    // Processing time (assistant only)
                    if let Some(ms) = msg.processing_time_ms {
                        ui.add_space(theme::SPACE_XS);
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(icons::CLOCK)
                                    .size(theme::ICON_XS)
                                    .color(theme::text_tertiary()),
                            );
                            ui.label(
                                egui::RichText::new(format!("{}ms", ms))
                                    .font(theme::font_min())
                                    .color(theme::text_tertiary()),
                            );
                        });
                    }
                });
        });
    }

    /// Render a processing/loading indicator while the LLM is working.
    fn render_processing_indicator(ui: &mut egui::Ui) {
        ui.with_layout(egui::Layout::left_to_right(egui::Align::TOP), |ui: &mut egui::Ui| {
            let max_width = (ui.available_width() * 0.75).min(600.0);
            ui.set_max_width(max_width);

            egui::Frame::new()
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::SPACE_MD as u8))
                .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
                .stroke(egui::Stroke::new(
                    theme::BORDER_HAIRLINE,
                    theme::border(),
                ))
                .show(ui, |ui: &mut egui::Ui| {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(icons::ROBOT)
                                .size(theme::ICON_SM)
                                .color(theme::SUCCESS),
                        );
                        ui.add_space(theme::SPACE_XS);
                        ui.label(
                            egui::RichText::new("IA")
                                .font(theme::font_label())
                                .color(theme::SUCCESS)
                                .strong(),
                        );
                    });
                    ui.add_space(theme::SPACE_XS);
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.spinner();
                        ui.add_space(theme::SPACE_SM);
                        ui.label(
                            egui::RichText::new("Analyse en cours...")
                                .font(theme::font_body())
                                .color(theme::text_secondary())
                                .italics(),
                        );
                    });
                });
        });
    }

    // ====================================================================
    // Tab 1: Recommandations (existing content, extracted)
    // ====================================================================

    fn show_recommendations_tab(
        ui: &mut egui::Ui,
        state: &mut AppState,
    ) -> Option<GuiCommand> {
        let mut command = None;

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
            "Rechercher une recommandation, une cat\u{00e9}gorie...",
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
                        "AUCUN R\u{00c9}SULTAT",
                        Some("Modifiez vos crit\u{00e8}res de recherche ou de filtrage."),
                    );
                } else {
                    widgets::protected_state(
                        ui,
                        icons::SHIELD_CHECK,
                        "POSTURE DE S\u{00c9}CURIT\u{00c9} OPTIMALE",
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

            let drawer_action = widgets::DetailDrawer::new(
                "ai_recommendation_detail",
                &rec.title,
                kind_icon,
            )
            .accent(sev_color)
            .subtitle(kind_label)
            .show(ui.ctx(), &mut state.ai.detail_open, |ui| {
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
            }, &actions);

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

    fn show_model_status_tab(
        ui: &mut egui::Ui,
        state: &mut AppState,
    ) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        // Extract values to avoid borrow conflicts
        let download_phase = state.ai.download.phase;
        let model_status_str = state.ai.model_status.status.clone();

        // ── Download in progress / paused / failed ──────────────────────
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
            // If downloading, don't show the rest of the model status
            if matches!(
                download_phase,
                crate::dto::DownloadPhase::Downloading | crate::dto::DownloadPhase::Paused
            ) {
                return command;
            }
        }

        let status = &state.ai.model_status;

        // Empty / unloaded state
        if model_status_str.is_empty() || model_status_str == "unloaded" {
            widgets::empty_state(
                ui,
                icons::MICROCHIP,
                "MOD\u{00c8}LE NON CHARG\u{00c9}",
                Some(
                    "Le mod\u{00e8}le LLM n'est pas charg\u{00e9} en m\u{00e9}moire. Cliquez sur le bouton ci-dessous pour le charger.",
                ),
            );
            ui.add_space(theme::SPACE_LG);

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.add_space(
                    (ui.available_width() - 400.0).max(0.0) / 2.0,
                );

                let reload_btn = egui::Button::new(
                    egui::RichText::new(format!("{} Charger le mod\u{00e8}le", icons::PLAY))
                        .font(theme::font_body())
                        .color(theme::text_on_accent()),
                )
                .fill(theme::ACCENT)
                .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8));

                if ui.add(reload_btn).clicked() {
                    command = Some(GuiCommand::LlmReloadModel);
                }

                ui.add_space(theme::SPACE_MD);

                let download_btn = egui::Button::new(
                    egui::RichText::new(format!("{} T\u{00e9}l\u{00e9}charger le mod\u{00e8}le", icons::DOWNLOAD))
                        .font(theme::font_body())
                        .color(theme::accent_text()),
                )
                .fill(theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE))
                .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8))
                .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::ACCENT.linear_multiply(theme::OPACITY_MUTED)));

                if ui.add(download_btn).clicked() {
                    state.ai.download.phase = crate::dto::DownloadPhase::Downloading;
                    state.ai.download.progress_percent = 0;
                    state.ai.download.downloaded_bytes = 0;
                    command = Some(GuiCommand::LlmStartDownload);
                }
            });

            return command;
        }

        // ── Model Info Card ──────────────────────────────────────────────
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("INFORMATIONS DU MOD\u{00c8}LE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            // Model name
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::MICROCHIP)
                        .size(theme::ICON_MD)
                        .color(theme::ACCENT),
                );
                ui.add_space(theme::SPACE_SM);
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("NOM DU MOD\u{00c8}LE")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new(if status.model_name.is_empty() {
                            "--"
                        } else {
                            &status.model_name
                        })
                            .font(theme::font_heading())
                            .color(theme::text_primary())
                            .strong(),
                    );
                });
            });

            ui.add_space(theme::SPACE_LG);

            // Status badge
            let (status_label, status_color) = match status.status.as_str() {
                "ready" => ("PR\u{00ca}T", theme::SUCCESS),
                "loading" => ("CHARGEMENT", theme::WARNING),
                "error" => ("ERREUR", theme::ERROR),
                _ => (&*status.status.to_uppercase(), theme::text_tertiary()),
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("STATUT")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);
                widgets::status_badge(ui, status_label, status_color);
            });
        });

        ui.add_space(theme::SPACE_MD);

        // ── Metrics Grid ─────────────────────────────────────────────────
        let metrics = vec![
            (
                "INF\u{00c9}RENCES",
                status.inference_count.to_string(),
                if status.inference_count > 0 {
                    theme::ACCENT
                } else {
                    theme::text_tertiary()
                },
                icons::BOLT,
            ),
            (
                "M\u{00c9}MOIRE ALLOU\u{00c9}E",
                if status.memory_mb > 0 {
                    format!("{} Mo", status.memory_mb)
                } else {
                    "--".to_string()
                },
                if status.memory_mb > 0 {
                    theme::INFO
                } else {
                    theme::text_tertiary()
                },
                icons::MEMORY,
            ),
            (
                "\u{00c9}TAT",
                if status.is_ready {
                    "Actif".to_string()
                } else {
                    "Inactif".to_string()
                },
                if status.is_ready {
                    theme::SUCCESS
                } else {
                    theme::WARNING
                },
                icons::SERVER,
            ),
        ];

        let grid = widgets::ResponsiveGrid::new(180.0, theme::SPACE_SM);
        grid.show(ui, &metrics, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // ── Reload Button ────────────────────────────────────────────────
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("ACTIONS")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
            });
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui: &mut egui::Ui| {
                let reload_btn = egui::Button::new(
                    egui::RichText::new(format!("{} Recharger le mod\u{00e8}le", icons::REFRESH))
                        .font(theme::font_body())
                        .color(theme::text_on_accent()),
                )
                .fill(theme::ACCENT)
                .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8));

                if ui.add(reload_btn).clicked() {
                    command = Some(GuiCommand::LlmReloadModel);
                }

                ui.add_space(theme::SPACE_MD);

                let status_btn = egui::Button::new(
                    egui::RichText::new(format!("{} Actualiser le statut", icons::REFRESH))
                        .font(theme::font_body())
                        .color(theme::accent_text()),
                )
                .fill(theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE))
                .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8))
                .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::ACCENT.linear_multiply(theme::OPACITY_MUTED)));

                if ui.add(status_btn).clicked() {
                    command = Some(GuiCommand::LlmGetStatus);
                }
            });
        });

        command
    }

    // ====================================================================
    // Download progress UI
    // ====================================================================

    fn render_download_progress(
        ui: &mut egui::Ui,
        state: &mut AppState,
    ) -> Option<GuiCommand> {
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
                                    .color(theme::ERROR),
                            );
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new(error)
                                    .font(theme::font_small())
                                    .color(theme::ERROR),
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
                        egui::CornerRadius::same(6),
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
                            egui::CornerRadius::same(6),
                            fill_color,
                        );
                    }
                }

                ui.add_space(theme::SPACE_MD);

                // ── Stats row ───────────────────────────────────────────
                ui.horizontal(|ui: &mut egui::Ui| {
                    // Percentage
                    ui.label(
                        egui::RichText::new(format!("{}%", progress_percent))
                            .font(theme::font_stat())
                            .color(if is_paused { theme::WARNING } else { theme::ACCENT })
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
                    ui.ctx().request_repaint_after(std::time::Duration::from_millis(500));
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
                            .color(theme::ERROR),
                    )
                    .fill(theme::ERROR.linear_multiply(theme::OPACITY_SUBTLE))
                    .corner_radius(egui::CornerRadius::same(theme::SPACE_SM as u8))
                    .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::ERROR.linear_multiply(theme::OPACITY_MUTED)));

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

        let threat_count = state.threats.suspicious_processes.len()
            + state.threats.system_incidents.len();
        let threat_component = 100.0 - (threat_count as f32 * 10.0).min(100.0);

        let vuln_count = state.vulnerability_findings.len();
        let vuln_component = 100.0 - (vuln_count as f32 * 5.0).min(100.0);

        let alert_count = state.network.alerts.len();
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
                    title: format!(
                        "Corriger : {} sur {}",
                        vuln.cve_id, vuln.affected_software
                    ),
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
                title: format!(
                    "Investiguer : {}",
                    alert_type_label(&alert.alert_type)
                ),
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
                    "Type : {} \u{2014} Confiance : {}%",
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
            "ANALYSE EN ATTENTE",
            Some(
                "Lancez un audit de conformit\u{00e9} pour activer l'analyse IA automatique.",
            ),
        );
    }

    fn render_posture_hero(ui: &mut egui::Ui, state: &AppState, ai_score: f32) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                // Left: Gauge
                ui.vertical(|ui| {
                    ui.set_width(POSTURE_GAUGE_WIDTH);
                    widgets::compliance_gauge(ui, Some(ai_score), 70.0);
                });

                ui.add_space(theme::SPACE_LG);

                // Right: Risk level and breakdown
                ui.vertical(|ui| {
                    ui.add_space(theme::SPACE_MD);

                    let risk_label = Self::risk_label(ai_score);
                    let risk_color = theme::score_color(ai_score);

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
                            egui::RichText::new(format!("{:.0}%", ai_score))
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
                    let threat_count = state.threats.suspicious_processes.len()
                        + state.threats.system_incidents.len();
                    let vuln_count = state.vulnerability_findings.len();
                    let alert_count = state.network.alerts.len();

                    let components: &[(&str, f32, &str)] = &[
                        (
                            "Conformit\u{00e9}",
                            compliance_pct,
                            "40%",
                        ),
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
                        let color = theme::score_color(*score);
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(format!(
                                    "{} ({})",
                                    label, weight
                                ))
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                            );
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(format!("{:.0}%", score))
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
        let threat_count = state.threats.suspicious_processes.len()
            + state.network.alerts.len()
            + state.threats.system_incidents.len();
        let compliance_pct = state
            .summary
            .compliance_score
            .map(|s| format!("{:.0}%", s))
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
        use egui_extras::{Column, TableBuilder};

        let mut clicked_idx: Option<usize> = None;
        let ctx = ui.ctx().clone();

        let table = TableBuilder::new(ui)
            .striped(false)
            .resizable(true)
            .sense(egui::Sense::click())
            .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
            .column(Column::initial(100.0).at_least(80.0)) // Priority
            .column(Column::initial(90.0).at_least(70.0))  // Source
            .column(Column::initial(300.0).range(150.0..=600.0)) // Recommandation
            .column(Column::remainder()); // Rem\u{00e9}diation

        table
            .header(theme::TABLE_INLINE_HEADER_HEIGHT, |mut header| {
                for label in [
                    "PRIORIT\u{00c9}",
                    "SOURCE",
                    "RECOMMANDATION",
                    "REM\u{00c9}DIATION",
                ] {
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(theme::TRACKING_NORMAL),
                        );
                    });
                }
            })
            .body(|mut body| {
                for &idx in filtered {
                    let rec = &recommendations[idx];
                    let is_selected = state.ai.selected_recommendation == Some(idx);
                    let sev_color = theme::severity_color_typed(&rec.severity);

                    body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                        row.set_selected(is_selected);

                        // Priority badge
                        row.col(|ui: &mut egui::Ui| {
                            widgets::status_badge(ui, rec.severity.label(), sev_color);
                        });

                        // Source kind
                        row.col(|ui: &mut egui::Ui| {
                            let label = kind_label(rec.kind);
                            let color = kind_color(rec.kind);
                            ui.horizontal(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(kind_icon(rec.kind))
                                        .size(theme::ICON_SM)
                                        .color(color),
                                );
                                ui.label(
                                    egui::RichText::new(label)
                                        .font(theme::font_label())
                                        .color(color)
                                        .strong(),
                                );
                            });
                        });

                        // Title
                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(&rec.title)
                                    .font(theme::font_body())
                                    .color(theme::accent_text())
                                    .strong(),
                            );
                        });

                        // Remediation short
                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(&rec.subtitle)
                                    .font(theme::font_small())
                                    .color(theme::text_secondary()),
                            );
                        });

                        if row.response().clicked() {
                            clicked_idx = Some(idx);
                        }
                        if row.response().hovered() {
                            ctx.set_cursor_icon(egui::CursorIcon::PointingHand);
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
        let threat_count = state.threats.suspicious_processes.len()
            + state.network.alerts.len()
            + state.threats.system_incidents.len();
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
        "firewall" => "Activez le pare-feu syst\u{00e8}me et v\u{00e9}rifiez les r\u{00e8}gles de filtrage",
        "antivirus" => "Installez et activez une solution antivirus \u{00e0} jour",
        "authentication" => "Renforcez la politique d'authentification et activez le MFA",
        "updates" => "Appliquez les mises \u{00e0} jour de s\u{00e9}curit\u{00e9} en attente",
        "session_lock" => "Configurez le verrouillage automatique de session",
        "backup" => "Mettez en place une strat\u{00e9}gie de sauvegarde r\u{00e9}guli\u{00e8}re",
        "protocols" => "D\u{00e9}sactivez les protocoles obsol\u{00e8}tes (SSLv3, TLS 1.0/1.1)",
        "accounts" => "V\u{00e9}rifiez les comptes utilisateurs et supprimez les comptes inutilis\u{00e9}s",
        "mfa" => "Activez l'authentification multi-facteurs sur tous les acc\u{00e8}s",
        "remote_access" => "S\u{00e9}curisez les acc\u{00e8}s distants et limitez les ports ouverts",
        "audit_logging" => "Activez la journalisation des \u{00e9}v\u{00e9}nements de s\u{00e9}curit\u{00e9}",
        "device_control" => "Restreignez l'acc\u{00e8}s aux p\u{00e9}riph\u{00e9}riques amovibles",
        "kernel_security" => "Renforcez la s\u{00e9}curit\u{00e9} du noyau (SIP, Secure Boot)",
        "network_hardening" => "Renforcez la configuration r\u{00e9}seau et segmentez les flux",
        "time_sync" => "Configurez la synchronisation NTP avec un serveur fiable",
        "browser_security" => "Appliquez les politiques de s\u{00e9}curit\u{00e9} du navigateur",
        "directory_policy" => "V\u{00e9}rifiez les strat\u{00e9}gies GPO et politiques Active Directory",
        "privileged_access" => "Limitez les acc\u{00e8}s privil\u{00e9}gi\u{00e9}s et appliquez le moindre privil\u{00e8}ge",
        "network_security" => "Renforcez les contr\u{00f4}les de s\u{00e9}curit\u{00e9} r\u{00e9}seau",
        "access_control" => "V\u{00e9}rifiez les contr\u{00f4}les d'acc\u{00e8}s et permissions",
        "container_security" => "S\u{00e9}curisez les conteneurs et images Docker",
        "certificate_management" => "Renouvelez les certificats expir\u{00e9}s et v\u{00e9}rifiez la cha\u{00ee}ne de confiance",
        "data_protection" => "Classifiez et prot\u{00e9}gez les donn\u{00e9}es sensibles",
        "cloud_security" => "V\u{00e9}rifiez la configuration de s\u{00e9}curit\u{00e9} des services cloud",
        "general" => "V\u{00e9}rifiez la conformit\u{00e9} g\u{00e9}n\u{00e9}rale du syst\u{00e8}me",
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
        assert_eq!(LLMPanel::risk_label(90.0), "POSTURE S\u{00c9}CURIS\u{00c9}E");
        assert_eq!(LLMPanel::risk_label(70.0), "RISQUE MOD\u{00c9}R\u{00c9}");
        assert_eq!(LLMPanel::risk_label(40.0), "RISQUE \u{00c9}LEV\u{00c9}");
        assert_eq!(LLMPanel::risk_label(10.0), "RISQUE CRITIQUE");
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
