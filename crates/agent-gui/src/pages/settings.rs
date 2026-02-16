//! Settings page.

use egui::Ui;
use sha2::{Digest, Sha256};
use zeroize::Zeroize;

use crate::app::AppState;
use crate::dto::GuiAgentStatus;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Verify an admin password attempt against a stored SHA-256 hash.
/// Uses constant-time comparison to prevent timing side-channel attacks.
fn verify_admin_password(attempt: &str, expected_hash: &str) -> bool {
    let mut hasher = Sha256::new();
    hasher.update(attempt.as_bytes());
    let computed = format!("{:x}", hasher.finalize());
    computed.len() == expected_hash.len()
        && computed
            .as_bytes()
            .iter()
            .zip(expected_hash.as_bytes())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0
}

pub struct SettingsPage;

impl SettingsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Configuration"],
            "Configuration",
            Some("GESTION ANALYTIQUE DES PARAMÈTRES ET CONTRÔLE DES SERVICES SENTINEL"),
            Some(
                "Configurez le comportement de l'agent, les fréquences de scan et les exclusions. Vous pouvez également ajuster les paramètres d'export et les options d'affichage.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Agent controls (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("CONTRÔLES DES SERVICES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui: &mut egui::Ui| {
                let is_paused = state.settings.is_paused;
                let (label, cmd) = if is_paused {
                    (
                        format!("{}  REPRENDRE L'AGENT", icons::PLAY),
                        GuiCommand::Resume,
                    )
                } else {
                    (
                        format!("{}  METTRE EN PAUSE", icons::STOP),
                        GuiCommand::Pause,
                    )
                };

                if widgets::button::primary_button(ui, label, true).clicked() {
                    state.settings.is_paused = !is_paused;
                    command = Some(cmd);
                }

                ui.add_space(theme::SPACE_SM);

                let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
                let check_label = if is_scanning {
                    format!("{}  VÉRIFICATION...", icons::CHECK)
                } else {
                    format!("{}  VÉRIFIER MAINTENANT", icons::CHECK)
                };
                let can_check = !state.settings.is_paused && !is_scanning;
                if widgets::button::primary_button_loading(ui, check_label, can_check, is_scanning)
                    .clicked()
                {
                    command = Some(GuiCommand::RunCheck);
                }
            });
        });

        ui.add_space(theme::SPACE);

        // Scan interval slider (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("INTERVALLE D'ANALYSE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.label(
                egui::RichText::new("Fréquence d'exécution des contrôles de conformité")
                    .font(theme::font_min())
                    .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_SM);

            let mut interval_min = (state.settings.check_interval_secs / 60) as f32;
            if interval_min < 5.0 {
                interval_min = 5.0;
            }

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("5 min")
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
                let changed = widgets::Slider::new(5.0, 120.0)
                    .step(5.0)
                    .style(widgets::SliderStyle::Stepped)
                    .show_ticks()
                    .hide_value()
                    .show(ui, &mut interval_min);
                if changed {
                    state.settings.check_interval_secs = (interval_min as u64) * 60;
                    command = Some(GuiCommand::UpdateCheckInterval {
                        interval_secs: state.settings.check_interval_secs,
                    });
                }
                ui.label(
                    egui::RichText::new("120 min")
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
            });

            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(format!(
                    "CONFIGURATION ACTUELLE : {} MINUTES",
                    state.settings.check_interval_secs / 60,
                ))
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .strong(),
            );
        });

        ui.add_space(theme::SPACE);

        // Log level selector (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("JOURNALISATION (LOGS)")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.label(
                egui::RichText::new("Niveau de verbosité des journaux système de l'agent")
                    .font(theme::font_min())
                    .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_SM);

            ui.horizontal(|ui: &mut egui::Ui| {
                use crate::dto::LogLevel;
                let levels: &[(LogLevel, egui::Color32)] = &[
                    (LogLevel::Error, theme::ERROR),
                    (LogLevel::Warn, theme::WARNING),
                    (LogLevel::Info, theme::INFO),
                    (LogLevel::Debug, theme::text_secondary()),
                    (LogLevel::Trace, theme::text_tertiary()),
                ];

                for &(ref level, color) in levels {
                    let active = state.settings.log_level == *level;
                    if widgets::chip_button(ui, level.as_str(), active, color).clicked() && !active
                    {
                        state.settings.log_level = *level;
                        command = Some(GuiCommand::SetLogLevel {
                            level: level.index() as u8,
                        });
                    }
                }
            });
        });

        ui.add_space(theme::SPACE);

        // Dark / Light mode toggle (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("APPARENCE DE L'INTERFACE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui: &mut egui::Ui| {
                let (mode_label, mode_icon) = if state.settings.dark_mode {
                    ("MODE SOMBRE", icons::MOON)
                } else {
                    ("MODE CLAIR", icons::SUN)
                };
                ui.label(
                    egui::RichText::new(format!("{}  {}", mode_icon, mode_label))
                        .font(theme::font_min())
                        .color(theme::text_primary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);
                widgets::toggle_switch(ui, &mut state.settings.dark_mode);
            });
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(
                    "Basculez entre l'affichage haute performance sombre et le mode haute luminosité clair.",
                )
                .font(theme::font_label())
                .color(theme::text_tertiary()),
            );
        });

        ui.add_space(theme::SPACE);

        // Update section (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("MAINTENANCE ET MISES À JOUR")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(format!(
                            "{}  SENTINEL CORE v{}",
                            icons::SETTINGS,
                            state.summary.version
                        ))
                        .font(theme::font_min())
                        .color(theme::text_primary())
                        .strong(),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new("Maintenez votre agent à jour pour bénéficier des dernières protections GRC.")
                            .font(theme::font_label())
                            .color(theme::text_tertiary()),
                    );
                });

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui: &mut egui::Ui| {
                    use crate::dto::UpdateStatus;

                    let (btn_text, is_busy) = match &state.settings.update_status {
                        UpdateStatus::Idle => (format!("{}  VÉRIFIER", icons::DOWNLOAD), false),
                        UpdateStatus::Available(v) => (format!("{}  INSTALLER v{}", icons::DOWNLOAD, v), false),
                        UpdateStatus::UpToDate => (format!("{}  À JOUR", icons::CHECK), false),
                        UpdateStatus::Downloading(p) => (format!("{}  {}%", icons::DOWNLOAD, (p * 100.0) as u32), true),
                        UpdateStatus::Verifying => (format!("{}  VÉRIFICATION", icons::DOWNLOAD), true),
                        UpdateStatus::Installing => (format!("{}  INSTALLATION", icons::DOWNLOAD), true),
                        UpdateStatus::Completed => (format!("{}  TERMINÉ", icons::CHECK), false),
                        UpdateStatus::Failed(_) => (format!("{}  RÉESSAYER", icons::REFRESH), false),
                    };

                    let can_click = !state.settings.is_paused && !is_busy;
                    if widgets::button::primary_button_loading(ui, btn_text, can_click, is_busy)
                        .clicked()
                    {
                        command = Some(GuiCommand::CheckUpdate);
                    }
                });
            });
        });

        ui.add_space(theme::SPACE);

        // Discovery toggle (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("DÉCOUVERTE RÉSEAU AUTOMATIQUE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("Activer la cartographie dynamique des actifs")
                        .font(theme::font_min())
                        .color(theme::text_primary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);
                widgets::toggle_switch(ui, &mut state.discovery.enabled);
            });
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new("L'agent scanne périodiquement le réseau local pour découvrir et authentifier de nouveaux actifs.")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        });

        ui.add_space(theme::SPACE);

        // Architecture URL Config (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("CONFIGURATION ARCHITECTURE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.label(
                egui::RichText::new("URL de la vue d'architecture 3D / Voxel")
                    .font(theme::font_min())
                    .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_SM);

            ui.horizontal(|ui: &mut egui::Ui| {
                let input_width = ui.available_width() - theme::SPACE_XL;
                egui::Frame::new()
                    .fill(theme::bg_tertiary())
                    .corner_radius(egui::CornerRadius::same(theme::INPUT_ROUNDING))
                    .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::border()))
                    .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.add(
                            egui::TextEdit::singleline(&mut state.settings.architecture_url)
                                .hint_text("https://...")
                                .desired_width(input_width - theme::SPACE_LG)
                                .char_limit(2048)
                                .frame(false)
                                .font(theme::font_mono()),
                        );
                    });
                if !state.settings.architecture_url.is_empty() {
                    ui.label(egui::RichText::new(icons::CHECK).color(theme::readable_color(theme::SUCCESS)));
                }
            });
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new("Lien vers la visualisation externe ou le jumeau numérique.")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        });

        ui.add_space(theme::SPACE);

        // SIEM Forwarding status (AAA Grade)
        Self::siem_card(ui, state);

        ui.add_space(theme::SPACE);

        // Bottom cards section with responsive layout
        Self::show_bottom_cards(ui, state, &mut command);

        ui.add_space(theme::SPACE_XL);

        command
    }

    fn show_bottom_cards(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        use egui::ScrollArea;

        // Responsive layout: 2 columns on wide screens, 1 column on narrow screens
        let total_width = ui.available_width();
        let min_width_for_two_cols = 800.0; // Minimum width for 2-column layout

        if total_width >= min_width_for_two_cols {
            // Two-column layout for wide screens
            let col_gap = theme::SPACE;
            let col_w = (total_width - col_gap) * 0.5;

            ui.horizontal_top(|ui: &mut egui::Ui| {
                ui.spacing_mut().item_spacing.x = col_gap;

                // Left column
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_width(col_w);
                    Self::connection_card(ui, state);
                    ui.add_space(theme::SPACE);
                    Self::intervals_card(ui, state);
                });

                // Right column
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_width(col_w);
                    Self::cloud_access_card(ui, state, command);
                    ui.add_space(theme::SPACE);
                    Self::danger_zone_card(ui, state, command);
                });
            });
        } else {
            // Single column layout for narrow screens with scroll
            ScrollArea::vertical()
                .id_salt("settings_scroll")
                .show(ui, |ui: &mut egui::Ui| {
                    Self::connection_card(ui, state);
                    ui.add_space(theme::SPACE);
                    Self::intervals_card(ui, state);
                    ui.add_space(theme::SPACE);
                    Self::cloud_access_card(ui, state, command);
                    ui.add_space(theme::SPACE);
                    Self::danger_zone_card(ui, state, command);
                });
        }
    }

    fn connection_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("PROTOCOLE DE CONNEXION")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            Self::setting_row(
                ui,
                "ENDPOINT",
                &state.settings.server_url,
                icons::ARROW_RIGHT,
            );
            if let Some(ref id) = state.summary.agent_id {
                Self::setting_row(ui, "ID AGENT", id, icons::ARROW_RIGHT);
            }
            if let Some(ref org) = state.summary.organization {
                Self::setting_row(ui, "ORGANISATION", org, icons::ARROW_RIGHT);
            }
        });
    }

    fn intervals_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("TRANSFERT ET SYNCHRONISATION")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            Self::setting_row(
                ui,
                "INTERVALLE SCAN",
                &format!("{} SECONDES", state.settings.check_interval_secs),
                icons::ARROW_RIGHT,
            );
            Self::setting_row(
                ui,
                "HEARTBEAT",
                &format!("{} SECONDES", state.settings.heartbeat_interval_secs),
                icons::ARROW_RIGHT,
            );
        });
    }

    fn cloud_access_card(ui: &mut Ui, state: &AppState, _command: &mut Option<GuiCommand>) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("ACCÈS CLOUD ET GESTION")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if let Some(ref id) = state.summary.agent_id {
                let url = format!("{}/agents/{}", super::about::branding::CONSOLE, id);

                ui.label(
                    egui::RichText::new("Pilotez vos politiques et exportez vos rapports de conformité directement sur le portail web.")
                        .font(theme::font_label())
                        .color(theme::text_secondary())
                );
                ui.add_space(theme::SPACE_MD);

                if widgets::primary_button(
                    ui,
                    format!("{}  VOIR SUR LE PORTAIL WEB", icons::EXTERNAL_LINK),
                    true,
                )
                .clicked()
                {
                    if url.starts_with("https://") {
                        if let Err(e) = open::that(&url) {
                            tracing::warn!("Failed to open portal URL: {}", e);
                        }
                    } else {
                        tracing::warn!("Refused to open non-HTTPS URL: {}", url);
                    }
                }
            } else {
                ui.label(
                    egui::RichText::new("AGENT NON ENREGISTRÉ")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong(),
                );
            }
        });
    }

    fn danger_zone_card(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let confirm_id = ui.make_persistent_id("quit_confirm");
        // Modal state: (is_open, password_input, error_msg)
        let unlock_modal_id = ui.make_persistent_id("admin_unlock_modal");
        let mut modal_state: (bool, String, Option<String>) = ui.memory(|mem| 
            mem.data.get_temp(unlock_modal_id).unwrap_or((false, String::new(), None))
        );

        if modal_state.0 {
            let ctx = ui.ctx().clone();
            egui::Window::new("DÉVERROUILLAGE ADMIN")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, egui::Vec2::ZERO)
                .show(&ctx, |ui| {
                    ui.set_min_width(320.0);
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_MD);
                        ui.label(egui::RichText::new(icons::LOCK).size(theme::ICON_XL).color(theme::accent_text()));
                        ui.add_space(theme::SPACE_MD);
                        ui.label(egui::RichText::new("Authentification Requise").font(theme::font_heading()).strong());
                        ui.add_space(theme::SPACE_XS);
                        ui.label("Saisissez le mot de passe administrateur pour accéder à cette zone.");
                        ui.add_space(theme::SPACE_MD);
                        
                        let resp = ui.add(egui::TextEdit::singleline(&mut modal_state.1)
                            .password(true)
                            .hint_text("Mot de passe")
                            .desired_width(200.0)
                        );
                        
                        // Autofocus on first appearance only
                        if !resp.has_focus() && !ui.input(|i| i.pointer.any_click()) {
                            resp.request_focus();
                        }

                        if resp.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                            // Validate password against SHA-256 hash (not plaintext)
                            if verify_admin_password(&modal_state.1, &state.settings.admin_password_sha256) {
                                state.security.admin_unlocked = true;
                                state.security.last_unlock = Some(chrono::Utc::now());
                                modal_state.0 = false;
                                modal_state.2 = None;
                            } else {
                                modal_state.2 = Some("Mot de passe incorrect".to_string());
                            }
                            // Securely wipe password from memory after validation attempt
                            modal_state.1.zeroize();
                        }

                        if let Some(err) = &modal_state.2 {
                            ui.add_space(theme::SPACE_XS);
                            ui.label(egui::RichText::new(err).color(theme::readable_color(theme::ERROR)).font(theme::font_body()));
                        }

                        ui.add_space(theme::SPACE_LG);
                        ui.horizontal(|ui| {
                            if widgets::secondary_button(ui, "ANNULER", true).clicked() {
                                modal_state.0 = false;
                                modal_state.1.zeroize();
                                modal_state.2 = None;
                            }
                            ui.add_space(theme::SPACE_SM);
                            if widgets::primary_button(ui, "DÉVERROUILLER", true).clicked() {
                                if verify_admin_password(&modal_state.1, &state.settings.admin_password_sha256) {
                                    state.security.admin_unlocked = true;
                                    state.security.last_unlock = Some(chrono::Utc::now());
                                    modal_state.0 = false;
                                    modal_state.2 = None;
                                } else {
                                    modal_state.2 = Some("Mot de passe incorrect".to_string());
                                }
                                // Securely wipe password from memory after validation attempt
                                modal_state.1.zeroize();
                            }
                        });
                    });
                });
            
            // Save state back
            ui.memory_mut(|mem| mem.data.insert_temp(unlock_modal_id, modal_state));
        }

        let confirming = ui.memory(|mem| mem.data.get_temp::<bool>(confirm_id).unwrap_or(false));

        // Danger zone with red-tinted frame for visual hierarchy
        egui::Frame::new()
            .fill(theme::ERROR.linear_multiply(theme::OPACITY_SUBTLE))
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(theme::SPACE_LG as i8))
            .stroke(egui::Stroke::new(theme::BORDER_MEDIUM, theme::ERROR.linear_multiply(theme::OPACITY_MEDIUM)))
            .shadow(if theme::is_dark_mode() { theme::shadow_md() } else { theme::shadow_sm() })
            .show(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!("{}  ZONE CRITIQUE", icons::WARNING))
                    .font(theme::font_label())
                    .color(theme::readable_color(theme::ERROR))
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if !state.security.admin_unlocked {
                // Locked State
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!("{}  MODE VERROUILLÉ", icons::LOCK))
                            .font(theme::font_body())
                            .color(theme::text_secondary())
                    );
                    
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if widgets::button::secondary_button(ui, "DÉVERROUILLER (ADMIN)", true).clicked() {
                             ui.memory_mut(|mem| mem.data.insert_temp(unlock_modal_id, (true, String::new(), None::<String>)));
                        }
                    });
                });
                ui.add_space(theme::SPACE_XS);
                ui.label(
                     egui::RichText::new("L'accès aux paramétres critiques nécessite une authentification administrateur.")
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
                );
            } else {
                // Unlocked State (Existing Content)
                if confirming {
                    // Confirmation state
                    ui.label(
                        egui::RichText::new("ÊTES-VOUS SÛR DE VOULOIR QUITTER L'AGENT ?")
                            .font(theme::font_min())
                            .color(theme::readable_color(theme::ERROR))
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new("L'agent cessera de protéger ce poste de travail.")
                            .font(theme::font_label())
                            .color(theme::text_secondary()),
                    );
                    ui.add_space(theme::SPACE_MD);

                    ui.horizontal(|ui: &mut egui::Ui| {
                        if widgets::secondary_button(ui, "ANNULER", true).clicked() {
                            ui.memory_mut(|mem| mem.data.insert_temp(confirm_id, false));
                        }

                        ui.add_space(theme::SPACE_SM);

                        if widgets::destructive_button(
                            ui,
                            format!("{}  CONFIRMER L'ARRÊT", icons::POWER_OFF),
                            true,
                        )
                        .clicked()
                        {
                            ui.memory_mut(|mem| mem.data.insert_temp(confirm_id, false));
                            *command = Some(GuiCommand::Shutdown);
                        }
                    });
                } else {
                    // Normal state
                    if widgets::destructive_button(
                        ui,
                        format!("{}  QUITTER L'AGENT SENTINEL", icons::POWER_OFF),
                        true,
                    )
                    .clicked()
                    {
                        ui.memory_mut(|mem| mem.data.insert_temp(confirm_id, true));
                    }
                }
            }
        });
    }

    fn setting_row(ui: &mut Ui, label: &str, value: &str, icon: &str) {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.set_min_height(theme::MIN_TOUCH_TARGET);
            ui.label(
                egui::RichText::new(icon)
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_min())
                    .color(theme::text_secondary())
                    .strong(),
            );
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    // Copy button for easy clipboard access
                    widgets::copy_button(ui, value, Some("Copier la valeur"));
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new(value)
                            .font(theme::font_mono_sm())
                            .color(theme::text_primary())
                            .strong(),
                    );
                },
            );
        });
    }

    fn siem_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(format!(
                        "{}  INTEGRATION SIEM",
                        icons::SHARE_NODES
                    ))
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
                );

                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if state.settings.siem_enabled {
                            ui.label(
                                egui::RichText::new(format!("{}  ACTIF", icons::CIRCLE_CHECK))
                                    .font(theme::font_label())
                                    .color(theme::readable_color(theme::SUCCESS))
                                    .strong(),
                            );
                        } else {
                            ui.label(
                                egui::RichText::new(format!("{}  INACTIF", icons::WARNING))
                                    .font(theme::font_label())
                                    .color(theme::readable_color(theme::WARNING))
                                    .strong(),
                            );
                        }
                    },
                );
            });

            ui.add_space(theme::SPACE_MD);

            if state.settings.siem_enabled {
                Self::setting_row(
                    ui,
                    "FORMAT",
                    &state.settings.siem_format,
                    icons::ARROW_RIGHT,
                );
                Self::setting_row(
                    ui,
                    "TRANSPORT",
                    &state.settings.siem_transport,
                    icons::ARROW_RIGHT,
                );
                Self::setting_row(
                    ui,
                    "DESTINATION",
                    &state.settings.siem_destination,
                    icons::ARROW_RIGHT,
                );
            } else {
                ui.label(
                    egui::RichText::new(
                        "Le transfert SIEM n'est pas configur\u{00e9}. Configurez-le dans le fichier de configuration de l'agent.",
                    )
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
                );
            }
        });
    }
}
