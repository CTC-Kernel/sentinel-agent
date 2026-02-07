//! Settings page.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiAgentStatus;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct SettingsPage;

impl SettingsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
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
                    .extra_letter_spacing(0.5)
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
                    .extra_letter_spacing(0.5)
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
                let slider = egui::Slider::new(&mut interval_min, 5.0..=120.0)
                    .text("MINUTES")
                    .step_by(5.0)
                    .clamping(egui::SliderClamping::Always);
                let response = ui.add(slider);
                if response.changed() {
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
                    .extra_letter_spacing(0.5)
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
                    .extra_letter_spacing(0.5)
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
                    .extra_letter_spacing(0.5)
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
                    .extra_letter_spacing(0.5)
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
                if ui.checkbox(&mut state.discovery.enabled, "").changed() {
                    // State is already updated by checkbox
                }
            });
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new("L'agent scanne périodiquement le réseau local pour découvrir et authentifier de nouveaux actifs.")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        });

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
                    Self::danger_zone_card(ui, command);
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
                    Self::danger_zone_card(ui, command);
                });
        }
    }

    fn connection_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("PROTOCOLE DE CONNEXION")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            Self::setting_row(
                ui,
                "ENDPOINT",
                "https://app.cyber-threat-consulting.com/agentApi",
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
                    .extra_letter_spacing(0.5)
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
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if let Some(ref id) = state.summary.agent_id {
                let url = format!("https://app.cyber-threat-consulting.com/agents/{}", id);

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
                    let _ = open::that(&url);
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

    fn danger_zone_card(ui: &mut Ui, command: &mut Option<GuiCommand>) {
        let confirm_id = ui.make_persistent_id("quit_confirm");
        let confirming = ui.memory(|mem| mem.data.get_temp::<bool>(confirm_id).unwrap_or(false));

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("ZONE CRITIQUE")
                    .font(theme::font_label())
                    .color(theme::ERROR)
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if confirming {
                // Confirmation state
                ui.label(
                    egui::RichText::new("ÊTES-VOUS SÛR DE VOULOIR QUITTER L'AGENT ?")
                        .font(theme::font_min())
                        .color(theme::ERROR)
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
        });
    }

    fn setting_row(ui: &mut Ui, label: &str, value: &str, icon: &str) {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.set_min_height(32.0);
            ui.label(
                egui::RichText::new(icon)
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(4.0);
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
                    ui.add_space(4.0);
                    ui.label(
                        egui::RichText::new(value)
                            .font(egui::FontId::monospace(11.0))
                            .color(theme::text_primary())
                            .strong(),
                    );
                },
            );
        });
    }
}
