// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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

/// Application-level salt prepended to passwords before SHA-256 hashing.
/// This prevents rainbow-table attacks against stored hashes.
const PASSWORD_SALT: &str = "sentinel-grc-v2-admin-salt-2026";

/// Prefix used to distinguish salted hashes from legacy unsalted hashes.
const SALTED_HASH_PREFIX: &str = "salted:";

/// Compute the salted SHA-256 hash of a password.
#[allow(dead_code)] // Utility for computing salted hashes from other modules
pub(crate) fn compute_salted_hash(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(PASSWORD_SALT.as_bytes());
    hasher.update(password.as_bytes());
    format!("{}{:x}", SALTED_HASH_PREFIX, hasher.finalize())
}

/// Verify an admin password attempt against a stored SHA-256 hash.
/// Uses constant-time comparison to prevent timing side-channel attacks.
///
/// Supports both legacy (unsalted, 64 hex chars) and new (salted, prefixed
/// with "salted:") hash formats. On first run (empty hash), the default
/// password "admin" is accepted but a warning is logged.
fn verify_admin_password(attempt: &str, expected_hash: &str) -> bool {
    // If no admin password has been configured yet, accept "admin" as default
    // to allow initial access. The user should change it in settings.
    if expected_hash.is_empty() {
        tracing::warn!(
            "Default admin password in use -- set a custom password in settings immediately"
        );
        return attempt == "admin";
    }

    // New salted hash format: "salted:<hex>"
    if let Some(salted_hex) = expected_hash.strip_prefix(SALTED_HASH_PREFIX) {
        let mut hasher = Sha256::new();
        hasher.update(PASSWORD_SALT.as_bytes());
        hasher.update(attempt.as_bytes());
        let computed = format!("{:x}", hasher.finalize());
        return computed.len() == salted_hex.len()
            && computed
                .as_bytes()
                .iter()
                .zip(salted_hex.as_bytes())
                .fold(0u8, |acc, (a, b)| acc | (a ^ b))
                == 0;
    }

    // Legacy unsalted hash (64 hex chars) -- still accepted for backward
    // compatibility. The caller should prompt the user to re-set the password.
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

        ui.add_space(theme::SPACE_XS);
        let _ = widgets::page_header_nav(
            ui,
            &["Configuration"],
            "Configuration",
            Some("Paramètres de l'agent et contrôle des services Sentinel."),
            Some(
                "Configurez le comportement de l'agent, les fréquences de scan et les exclusions. Vous pouvez également ajuster les paramètres d'export et les options d'affichage.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        widgets::tabs(
            ui,
            &["Agent", "Apparence", "Connexions & SIEM", "Administration"],
            &mut state.settings.active_section,
        );
        ui.add_space(theme::SPACE_MD);
        match state.settings.active_section {
            0 => {
                Self::services_card(ui, state, &mut command);
                ui.add_space(theme::SPACE);
                Self::scan_interval_card(ui, state, &mut command);
                ui.add_space(theme::SPACE);
                Self::log_level_card(ui, state, &mut command);
                ui.add_space(theme::SPACE);
                Self::update_card(ui, state, &mut command);
                ui.add_space(theme::SPACE);
                Self::discovery_card(ui, state, &mut command);
                ui.add_space(theme::SPACE);
            }
            1 => {
                Self::theme_card(ui, state);
                ui.add_space(theme::SPACE);
            }
            2 => {
                Self::platform_url_card(ui, state);

                ui.add_space(theme::SPACE);

                // SIEM Forwarding configuration (AAA Grade)
                if let Some(cmd) = Self::siem_card(ui, state) {
                    command = Some(cmd);
                }

                ui.add_space(theme::SPACE);

                // SIEM Log Collector configuration (AAA Grade)
                if let Some(cmd) = Self::log_collector_card(ui, state) {
                    command = Some(cmd);
                }

                ui.add_space(theme::SPACE);
            }
            3 => {
                // Bottom cards section with responsive layout
                Self::show_bottom_cards(ui, state, &mut command);

                ui.add_space(theme::SPACE_XL);
            }
            _ => state.settings.active_section = 0,
        }
        command
    }

    /// Pause/resume and run-now controls for the agent services.
    fn services_card(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
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
                        format!("{}  Reprendre l'agent", icons::PLAY),
                        GuiCommand::Resume,
                    )
                } else {
                    (
                        format!("{}  Mettre en pause", icons::STOP),
                        GuiCommand::Pause,
                    )
                };

                // One primary per row: running a check is the action an
                // operator came here for; pausing the agent is a control.
                // Resuming a paused agent is the exception — then it is the
                // one thing that matters on this screen.
                let pause_clicked = if is_paused {
                    widgets::button::primary_button(ui, label, true).clicked()
                } else {
                    widgets::button::secondary_button(ui, label, true).clicked()
                };
                if pause_clicked {
                    state.settings.is_paused = !is_paused;
                    *command = Some(cmd);
                }

                ui.add_space(theme::SPACE_SM);

                let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
                let check_label = if is_scanning {
                    format!("{}  Vérification…", icons::CHECK)
                } else {
                    format!("{}  Vérifier maintenant", icons::CHECK)
                };
                let can_check = !state.settings.is_paused && !is_scanning;
                let check_clicked = if is_paused {
                    widgets::button::secondary_button_loading(
                        ui,
                        check_label,
                        can_check,
                        is_scanning,
                    )
                    .clicked()
                } else {
                    widgets::button::primary_button_loading(ui, check_label, can_check, is_scanning)
                        .clicked()
                };
                if check_clicked {
                    *command = Some(GuiCommand::RunCheck);
                }
            });
        });
    }

    /// Compliance check interval, 5 to 120 minutes.
    fn scan_interval_card(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
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

            // The value leads, the slider follows: the old trailing line
            // "Configuration actuelle : 60 minutes" repeated the slider.
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new(crate::format::interval(
                        state.settings.check_interval_secs,
                    ))
                    .font(theme::font_h2())
                    .color(theme::accent_text()),
                );
                ui.label(
                    egui::RichText::new("entre deux exécutions des contrôles de conformité")
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );
            });
            ui.add_space(theme::SPACE_SM);

            let mut interval_min = (state.settings.check_interval_secs / 60) as f32;
            if interval_min < 5.0 {
                interval_min = 5.0;
            }

            // Bounds sit under the track ends, like the ticks they
            // name. Beside the slider, a horizontal row centred each
            // label on the row height at the time it was placed, so
            // "5 min" and "120 min" landed at different heights.
            let slider_width = ui.available_width().min(420.0);
            let changed = widgets::Slider::new(5.0, 120.0)
                .step(5.0)
                .style(widgets::SliderStyle::Stepped)
                .show_ticks()
                .hide_value()
                .width(slider_width)
                .show(ui, &mut interval_min);
            if changed {
                state.settings.check_interval_secs = (interval_min as u64) * 60;
                *command = Some(GuiCommand::UpdateCheckInterval {
                    interval_secs: state.settings.check_interval_secs,
                });
            }
            ui.allocate_ui_with_layout(
                egui::vec2(slider_width, 0.0),
                egui::Layout::left_to_right(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    ui.set_width(slider_width);
                    ui.label(
                        egui::RichText::new("5 min")
                            .font(theme::font_label())
                            .color(theme::text_tertiary()),
                    );
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("120 min")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary()),
                            );
                        },
                    );
                },
            );
        });
    }

    /// Agent log verbosity.
    fn log_level_card(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
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
                        *command = Some(GuiCommand::SetLogLevel {
                            level: level.index() as u8,
                        });
                    }
                }
            });
            ui.add_space(theme::SPACE_SM);
            // The level names are the logging library's; say what each keeps.
            let meaning = match state.settings.log_level {
                crate::dto::LogLevel::Error => "Erreurs seulement : journaux minimaux.",
                crate::dto::LogLevel::Warn => "Erreurs et avertissements.",
                crate::dto::LogLevel::Info => {
                    "Activité normale de l'agent : recommandé en production."
                }
                crate::dto::LogLevel::Debug => {
                    "Détails de diagnostic : à activer le temps d'une investigation."
                }
                crate::dto::LogLevel::Trace => {
                    "Tout est journalisé : volumineux, réservé au support."
                }
            };
            ui.label(
                egui::RichText::new(format!("{}  {meaning}", icons::INFO_CIRCLE))
                    .font(theme::font_caption())
                    .color(theme::text_secondary()),
            );
        });
    }

    /// Current version and the update check.
    fn update_card(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
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
    // Text column sized explicitly, so a wrapping sentence cannot push
    // the button against the card's bottom edge.
    let text_w = (ui.available_width() - 240.0).max(160.0);
    ui.vertical(|ui: &mut egui::Ui| {
        ui.set_width(text_w);
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new("Sentinel Core")
                    .font(theme::font_body_strong())
                    .color(theme::text_primary()),
            );
            widgets::status_badge(ui, &format!("v{}", state.summary.version), theme::ACCENT);
        });
        ui.add_space(theme::SPACE_XS);
        ui.label(
            egui::RichText::new(if state.summary.standalone {
                "Mode autonome : seul le catalogue public des versions est contacté et chaque paquet est vérifié avant installation."
            } else {
                "Maintenez votre agent à jour pour bénéficier des dernières protections GRC."
            })
            .font(theme::font_label())
            .color(theme::text_tertiary()),
        );
    });

    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui: &mut egui::Ui| {
        use crate::dto::UpdateStatus;

        let (btn_text, is_busy) = match &state.settings.update_status {
            UpdateStatus::Idle => (format!("{}  Vérifier", icons::DOWNLOAD), false),
            UpdateStatus::Checking => ("Recherche en cours…".to_string(), true),
            UpdateStatus::Available(v) => (format!("{}  Installer la v{}", icons::DOWNLOAD, v), false),
            UpdateStatus::UpToDate => (format!("{}  À jour", icons::CHECK), false),
            UpdateStatus::Downloading(p) => (format!("{}  {}\u{202f}%", icons::DOWNLOAD, (p * 100.0) as u32), true),
            UpdateStatus::Verifying => (format!("{}  Vérification…", icons::DOWNLOAD), true),
            UpdateStatus::Installing => (format!("{}  Installation…", icons::DOWNLOAD), true),
            UpdateStatus::Completed => (format!("{}  Terminé", icons::CHECK), false),
            UpdateStatus::Failed(_) => (format!("{}  Réessayer", icons::REFRESH), false),
        };

        let can_click = !state.settings.is_paused && !is_busy;
        if widgets::button::primary_button_loading(ui, btn_text, can_click, is_busy)
            .clicked()
        {
            // Reflect the request in the same frame instead of
            // leaving the previous checkmark visible until the
            // runtime loop receives and processes the command.
            state.settings.update_status = UpdateStatus::Checking;
            *command = Some(GuiCommand::CheckUpdate);
        }
    });
});
        });
    }

    /// Local network discovery toggle.
    fn discovery_card(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
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
                let prev_discovery = state.discovery.enabled;
                widgets::toggle_switch_labeled(
                    ui,
                    &mut state.discovery.enabled,
                    "Cartographie dynamique des actifs",
                );
                if state.discovery.enabled != prev_discovery {
                    if state.discovery.enabled {
                        *command = Some(GuiCommand::StartDiscovery);
                    } else {
                        *command = Some(GuiCommand::StopDiscovery);
                    }
                }
            });
            ui.add_space(theme::SPACE_XS);
            ui.label(
    egui::RichText::new("L'agent scanne périodiquement le réseau local pour découvrir et authentifier de nouveaux actifs.")
        .font(theme::font_label())
        .color(theme::text_tertiary()),
);
        });
    }

    /// Dark, light or system appearance.
    fn theme_card(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("APPARENCE DE L'INTERFACE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(
                    "Choisissez un thème, ou laissez l'interface suivre celui du système.",
                )
                .font(theme::font_body())
                .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_MD);

            // Three preview tiles: each shows the theme it selects.
            let current = if state.settings.follow_system_theme {
                ThemeChoice::System
            } else if state.settings.dark_mode {
                ThemeChoice::Dark
            } else {
                ThemeChoice::Light
            };
            let mut picked = None;
            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing = egui::vec2(theme::SPACE_MD, theme::SPACE_MD);
                for choice in [ThemeChoice::Light, ThemeChoice::Dark, ThemeChoice::System] {
                    if theme_tile(ui, choice, choice == current) {
                        picked = Some(choice);
                    }
                }
            });
            match picked {
                Some(ThemeChoice::Light) => {
                    state.settings.follow_system_theme = false;
                    state.settings.dark_mode = false;
                }
                Some(ThemeChoice::Dark) => {
                    state.settings.follow_system_theme = false;
                    state.settings.dark_mode = true;
                }
                Some(ThemeChoice::System) => {
                    state.settings.follow_system_theme = true;
                    state.settings.dark_mode = theme::detect_os_dark_mode();
                }
                None => {}
            }

            ui.add_space(theme::SPACE_MD);
            ui.label(
                egui::RichText::new(match current {
                    ThemeChoice::Light => {
                        "Clair : interface lumineuse, teintes froides et élévation prononcée."
                    }
                    ThemeChoice::Dark => {
                        "Sombre : optimisé pour faible luminosité, sous-tons bleu nuit."
                    }
                    ThemeChoice::System => {
                        "Système : suit le réglage clair ou sombre de votre ordinateur."
                    }
                })
                .font(theme::font_caption())
                .color(theme::text_tertiary()),
            );
        });
    }

    /// Platform and architecture URLs.
    fn platform_url_card(ui: &mut Ui, state: &mut AppState) {
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
                                .hint_text("https://…")
                                .desired_width(input_width - theme::SPACE_LG)
                                .char_limit(2048)
                                .frame(false)
                                .font(theme::font_mono()),
                        );
                    });
                if !state.settings.architecture_url.is_empty() {
                    ui.label(
                        egui::RichText::new(icons::CHECK)
                            .color(theme::readable_color(theme::SUCCESS)),
                    );
                }
            });
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new("Lien vers la visualisation externe ou le jumeau numérique.")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        });
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

            if state.summary.standalone {
                Self::setting_row(
                    ui,
                    "Mode",
                    "Autonome \u{00b7} protection locale",
                    icons::SHIELD_CHECK,
                    false,
                );
                Self::setting_row(ui, "Plateforme", "Aucune", icons::LINK, false);
                return;
            }
            Self::setting_row(
                ui,
                "Adresse du serveur",
                &state.settings.server_url,
                icons::LINK,
                true,
            );
            if let Some(ref id) = state.summary.agent_id {
                Self::setting_row(ui, "Identifiant de l'agent", id, icons::FINGERPRINT, true);
            }
            if let Some(ref org) = state.summary.organization {
                Self::setting_row(ui, "Organisation", org, icons::BUILDING, false);
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
                "Fréquence d'analyse",
                &crate::format::interval(state.settings.check_interval_secs),
                icons::CLOCK,
                false,
            );
            if !state.summary.standalone {
                Self::setting_row(
                    ui,
                    "Signal de vie",
                    &crate::format::interval(state.settings.heartbeat_interval_secs),
                    icons::BOLT,
                    false,
                );
            }
        });
    }

    fn cloud_access_card(ui: &mut Ui, state: &AppState, command: &mut Option<GuiCommand>) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(if state.summary.standalone {
                    "PLATEFORME"
                } else {
                    "ACCÈS CLOUD ET GESTION"
                })
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if state.summary.standalone {
                ui.label(
                    egui::RichText::new(
                        "Ce poste est prot\u{00e9}g\u{00e9} en autonomie : aucune donn\u{00e9}e n'est \
                         envoy\u{00e9}e. Pour le piloter depuis une plateforme Sentinel GRC \
                         (politiques, rapports, r\u{00e9}ponse \u{00e0} distance), enr\u{00f4}lez-le \
                         avec un jeton fourni par votre administrateur.",
                    )
                    .font(theme::font_label())
                    .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_MD);
                if widgets::primary_button(
                    ui,
                    format!("{}  Connecter \u{00e0} une plateforme", icons::LINK),
                    true,
                )
                .clicked()
                {
                    *command = Some(GuiCommand::ConnectToPlatform);
                }
            } else if let Some(ref id) = state.summary.agent_id {
                let url = format!("{}/agents/{}", super::about::branding::CONSOLE, id);

                ui.label(
                    egui::RichText::new("Pilotez vos politiques et exportez vos rapports de conformité directement sur le portail web.")
                        .font(theme::font_label())
                        .color(theme::text_secondary())
                );
                ui.add_space(theme::SPACE_MD);

                if widgets::primary_button(
                    ui,
                    format!("{}  Voir sur le portail web", icons::EXTERNAL_LINK),
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
                    egui::RichText::new("Agent non enregistré")
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
        let mut modal_state: (bool, String, Option<String>) = ui.memory(|mem| {
            mem.data
                .get_temp(unlock_modal_id)
                .unwrap_or((false, String::new(), None))
        });

        let rate_limit_id = ui.make_persistent_id("admin_unlock_rate_limit");
        // Rate limit state: (attempts, lock_until)
        let mut rate_state: (u32, Option<chrono::DateTime<chrono::Utc>>) =
            ui.memory(|mem| mem.data.get_temp(rate_limit_id).unwrap_or((0, None)));

        if modal_state.0 {
            let ctx = ui.ctx().clone();
            // Drawn as the product's dialog surface, not as an egui window
            // with a title bar the rest of the interface never shows.
            egui::Window::new("Déverrouillage admin")
                .title_bar(false)
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, egui::Vec2::ZERO)
                .frame(
                    egui::Frame::new()
                        .fill(theme::bg_secondary())
                        .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
                        .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()))
                        .shadow(theme::Elevation::Level4.ambient())
                        .inner_margin(egui::Margin::same(theme::SPACE_LG as i8)),
                )
                .show(&ctx, |ui| {
                    ui.set_min_width(320.0);
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_MD);
                        ui.label(
                            egui::RichText::new(icons::LOCK)
                                .size(theme::ICON_XL)
                                .color(theme::accent_text()),
                        );
                        ui.add_space(theme::SPACE_MD);
                        ui.label(
                            egui::RichText::new("Authentification Requise")
                                .font(theme::font_heading())
                                .strong(),
                        );
                        ui.add_space(theme::SPACE_XS);

                        let is_locked = if let Some(lock_time) = rate_state.1 {
                            if chrono::Utc::now() < lock_time {
                                true
                            } else {
                                rate_state = (0, None);
                                ui.memory_mut(|mem| mem.data.insert_temp(rate_limit_id, rate_state));
                                false
                            }
                        } else {
                            false
                        };

                        if let (true, Some(lock_until)) = (is_locked, rate_state.1) {
                            let remaining = (lock_until - chrono::Utc::now()).num_seconds().max(1);
                            ui.label(
                                egui::RichText::new(format!("Trop de tentatives. Veuillez réessayer dans {}s.", remaining))
                                    .color(theme::readable_color(theme::ERROR))
                                    .font(theme::font_body())
                                    .strong(),
                            );
                            ui.add_space(theme::SPACE_LG);
                            if widgets::secondary_button(ui, "Fermer", true).clicked() {
                                modal_state.0 = false;
                                modal_state.1.zeroize();
                                modal_state.2 = None;
                            }
                        } else {
                            ui.label(
                                "Saisissez le mot de passe administrateur pour accéder à cette zone.",
                            );
                            ui.add_space(theme::SPACE_MD);

                            let reveal_id = unlock_modal_id.with("reveal");
                            let mut revealed: bool =
                                ui.memory(|mem| mem.data.get_temp(reveal_id).unwrap_or(false));
                            let field = widgets::PasswordInput::new(
                                &mut modal_state.1,
                                "Mot de passe administrateur",
                                &mut revealed,
                            )
                            .width(280.0)
                            .id_salt("admin_unlock_password")
                            .autofocus(true)
                            .proportional()
                            .show(ui);
                            ui.memory_mut(|mem| mem.data.insert_temp(reveal_id, revealed));

                            let mut attempt_validate = field.submitted;

                            if let Some(err) = &modal_state.2 {
                                ui.add_space(theme::SPACE_XS);
                                ui.label(
                                    egui::RichText::new(err)
                                        .color(theme::readable_color(theme::ERROR))
                                        .font(theme::font_body()),
                                );
                            }

                            ui.add_space(theme::SPACE_LG);
                            ui.horizontal(|ui| {
                                if widgets::secondary_button(ui, "Annuler", true).clicked() {
                                    modal_state.0 = false;
                                    modal_state.1.zeroize();
                                    modal_state.2 = None;
                                }
                                ui.add_space(theme::SPACE_SM);
                                if widgets::primary_button(ui, "Déverrouiller", true).clicked() {
                                    attempt_validate = true;
                                }
                            });

                            if attempt_validate {
                                if verify_admin_password(
                                    &modal_state.1,
                                    &state.settings.admin_password_sha256,
                                ) {
                                    state.security.admin_unlocked = true;
                                    state.security.last_unlock = Some(chrono::Utc::now());
                                    modal_state.0 = false;
                                    modal_state.2 = None;
                                    rate_state = (0, None); // Reset limit on success
                                } else {
                                    rate_state.0 += 1;
                                    if rate_state.0 >= 5 {
                                        let backoff_secs = 30 * 2i64.pow(rate_state.0.saturating_sub(5));
                                        rate_state.1 = Some(chrono::Utc::now() + chrono::Duration::seconds(backoff_secs));
                                        modal_state.2 = None; // clear error, show lock next frame
                                    } else {
                                        modal_state.2 = Some("Mot de passe incorrect".to_string());
                                    }
                                }
                                ui.memory_mut(|mem| mem.data.insert_temp(rate_limit_id, rate_state));
                                // Securely wipe password from memory after validation attempt
                                modal_state.1.zeroize();
                            }
                        }
                    });
                });

            // Save state back
            ui.memory_mut(|mem| mem.data.insert_temp(unlock_modal_id, modal_state));
        }

        let confirming = ui.memory(|mem| mem.data.get_temp::<bool>(confirm_id).unwrap_or(false));

        // Danger zone with red-tinted card for visual hierarchy
        widgets::danger_card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!("{}  ZONE CRITIQUE", icons::WARNING))
                    .font(theme::font_label())
                    .color(theme::readable_color(theme::ERROR))
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            // Show prominent warning when default password is still active
            if state.settings.admin_password_sha256.is_empty() {
                ui.label(
                    egui::RichText::new(format!(
                        "{}  ATTENTION : mot de passe par défaut actif. Configurez un mot de passe administrateur personnalisé.",
                        icons::WARNING
                    ))
                    .font(theme::font_body())
                    .color(theme::readable_color(theme::WARNING))
                    .strong(),
                );
                ui.add_space(theme::SPACE_SM);
            }

            if !state.security.admin_unlocked {
                // Locked State
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!("{}  Mode verrouillé", icons::LOCK))
                            .font(theme::font_body())
                            .color(theme::text_secondary()),
                    );

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if widgets::button::secondary_button(ui, "Déverrouiller (admin)", true)
                            .clicked()
                        {
                            ui.memory_mut(|mem| {
                                mem.data.insert_temp(
                                    unlock_modal_id,
                                    (true, String::new(), None::<String>),
                                )
                            });
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
                        if widgets::secondary_button(ui, "Annuler", true).clicked() {
                            ui.memory_mut(|mem| mem.data.insert_temp(confirm_id, false));
                        }

                        ui.add_space(theme::SPACE_SM);

                        if widgets::destructive_button(
                            ui,
                            format!("{}  Confirmer l'arrêt", icons::POWER_OFF),
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
                        format!("{}  Quitter l'agent sentinel", icons::POWER_OFF),
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

    /// A labelled read-only value. Only identifiers worth pasting elsewhere
    /// (endpoint, agent id) get a copy button; intervals do not.
    fn setting_row(ui: &mut Ui, label: &str, value: &str, icon: &str, copyable: bool) {
        // One row: icon and label in a fixed column, value beside it, copy
        // button at the edge. Stacked, each pair took 60px of mostly air.
        ui.horizontal(|ui| {
            ui.set_min_height(theme::MIN_TOUCH_TARGET);
            ui.allocate_ui_with_layout(
                egui::vec2(190.0, theme::MIN_TOUCH_TARGET),
                egui::Layout::left_to_right(egui::Align::Center),
                |ui| {
                    ui.set_width(190.0);
                    ui.label(
                        egui::RichText::new(icon)
                            .size(theme::ICON_XS)
                            .color(theme::accent_text()),
                    );
                    ui.label(
                        egui::RichText::new(label)
                            .font(theme::font_body())
                            .color(theme::text_secondary()),
                    );
                },
            );
            let copy_w = if copyable {
                theme::MIN_TOUCH_TARGET + theme::SPACE_SM
            } else {
                0.0
            };
            // Gaps included: a row a few pixels too wide stretched the card
            // past the page edge.
            let value_w =
                (ui.available_width() - copy_w - ui.spacing().item_spacing.x * 2.0).max(60.0);
            ui.allocate_ui_with_layout(
                egui::vec2(value_w, theme::MIN_TOUCH_TARGET),
                egui::Layout::left_to_right(egui::Align::Center),
                |ui| {
                    ui.set_width(value_w);
                    ui.add(
                        egui::Label::new(
                            egui::RichText::new(value)
                                .font(if copyable {
                                    theme::font_mono()
                                } else {
                                    theme::font_body_medium()
                                })
                                .color(theme::text_primary()),
                        )
                        .truncate()
                        .selectable(true),
                    )
                    .on_hover_text(value);
                },
            );
            if copyable {
                widgets::copy_button(ui, value, Some("Copier la valeur"));
            }
        });
    }

    fn siem_card(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!("{}  INTÉGRATION SIEM", icons::SHARE_NODES))
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            // Toggle SIEM on/off
            ui.horizontal(|ui: &mut egui::Ui| {
                let (status_label, status_color) = if state.settings.siem_enabled {
                    ("Transfert actif", theme::SUCCESS)
                } else {
                    ("Transfert inactif", theme::text_tertiary())
                };
                let prev = state.settings.siem_enabled;
                widgets::toggle_switch_labeled(ui, &mut state.settings.siem_enabled, "Export SIEM");
                ui.add_space(theme::SPACE_SM);
                widgets::status_badge(ui, status_label, status_color);
                if state.settings.siem_enabled != prev {
                    command = Some(GuiCommand::UpdateSiemConfig {
                        enabled: state.settings.siem_enabled,
                        format: state.settings.siem_format.clone(),
                        transport: state.settings.siem_transport.clone(),
                        destination: state.settings.siem_destination.clone(),
                    });
                }
            });

            ui.add_space(theme::SPACE_SM);

            if state.settings.siem_enabled {
                // Format selector
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new("FORMAT DE SORTIE")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_TIGHT)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                let formats = ["CEF", "LEEF", "JSON"];
                let mut format_idx = formats
                    .iter()
                    .position(|f| *f == state.settings.siem_format)
                    .unwrap_or(0);
                if widgets::button_group(ui, &formats, format_idx).is_some_and(|i| {
                    format_idx = i;
                    true
                }) {
                    state.settings.siem_format = formats[format_idx].to_string();
                    command = Some(GuiCommand::UpdateSiemConfig {
                        enabled: state.settings.siem_enabled,
                        format: state.settings.siem_format.clone(),
                        transport: state.settings.siem_transport.clone(),
                        destination: state.settings.siem_destination.clone(),
                    });
                }

                ui.add_space(theme::SPACE_MD);

                // Transport selector
                ui.label(
                    egui::RichText::new("PROTOCOLE DE TRANSPORT")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_TIGHT)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                let transports = ["Syslog", "HTTP"];
                let mut transport_idx = transports
                    .iter()
                    .position(|t| *t == state.settings.siem_transport)
                    .unwrap_or(0);
                if widgets::button_group(ui, &transports, transport_idx).is_some_and(|i| {
                    transport_idx = i;
                    true
                }) {
                    state.settings.siem_transport = transports[transport_idx].to_string();
                    command = Some(GuiCommand::UpdateSiemConfig {
                        enabled: state.settings.siem_enabled,
                        format: state.settings.siem_format.clone(),
                        transport: state.settings.siem_transport.clone(),
                        destination: state.settings.siem_destination.clone(),
                    });
                }

                ui.add_space(theme::SPACE_MD);

                // Destination input
                ui.label(
                    egui::RichText::new("ADRESSE DE DESTINATION")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_TIGHT)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);

                let hint = if state.settings.siem_transport == "HTTP" {
                    "https://siem.example.com/api/events"
                } else {
                    "syslog.example.com:514"
                };
                let prev_dest = state.settings.siem_destination.clone();
                widgets::text_input(ui, &mut state.settings.siem_destination, hint);
                if state.settings.siem_destination != prev_dest {
                    command = Some(GuiCommand::UpdateSiemConfig {
                        enabled: state.settings.siem_enabled,
                        format: state.settings.siem_format.clone(),
                        transport: state.settings.siem_transport.clone(),
                        destination: state.settings.siem_destination.clone(),
                    });
                }
            } else {
                ui.label(
                    egui::RichText::new(
                        "Activez le transfert pour envoyer les événements de sécurité vers votre SIEM.",
                    )
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
                );
            }
        });

        command
    }

    fn log_collector_card(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!("{}  COLLECTEUR DE LOGS SIEM", icons::DATABASE))
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            // Toggle collector on/off
            ui.horizontal(|ui: &mut egui::Ui| {
                let (status_label, status_color) = if state.settings.log_collector_enabled {
                    ("Collecte active", theme::SUCCESS)
                } else {
                    ("Collecte inactive", theme::text_tertiary())
                };
                let prev = state.settings.log_collector_enabled;
                widgets::toggle_switch_labeled(
                    ui,
                    &mut state.settings.log_collector_enabled,
                    "Collecte des journaux",
                );
                ui.add_space(theme::SPACE_SM);
                widgets::status_badge(ui, status_label, status_color);
                if state.settings.log_collector_enabled != prev {
                    command = Some(GuiCommand::UpdateLogCollectorConfig {
                        enabled: state.settings.log_collector_enabled,
                        sources: state.settings.log_collector_sources.clone(),
                        poll_interval_secs: state.settings.log_collector_poll_secs,
                    });
                }
            });

            ui.add_space(theme::SPACE_SM);

            if state.settings.log_collector_enabled {
                // Sources selection
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new("SOURCES DE JOURNAUX")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_TIGHT)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);

                let all_sources = [
                    ("system", "Système", icons::SERVER),
                    ("auth", "Authentification", icons::LOCK),
                    ("application", "Application", icons::SOFTWARE),
                    ("firewall", "Pare-feu", icons::SHIELD),
                ];

                ui.horizontal(|ui: &mut egui::Ui| {
                    let mut changed = false;
                    for (key, label, icon) in &all_sources {
                        let active = state
                            .settings
                            .log_collector_sources
                            .contains(&key.to_string());
                        let text = format!("{}  {}", icon, label);
                        let color = if active {
                            theme::SUCCESS
                        } else {
                            theme::text_tertiary()
                        };
                        if widgets::chip_button(ui, &text, active, color).clicked() {
                            if active {
                                state.settings.log_collector_sources.retain(|s| s != *key);
                            } else {
                                state.settings.log_collector_sources.push(key.to_string());
                            }
                            changed = true;
                        }
                        ui.add_space(theme::SPACE_XS);
                    }

                    if changed {
                        command = Some(GuiCommand::UpdateLogCollectorConfig {
                            enabled: state.settings.log_collector_enabled,
                            sources: state.settings.log_collector_sources.clone(),
                            poll_interval_secs: state.settings.log_collector_poll_secs,
                        });
                    }
                });

                ui.add_space(theme::SPACE_MD);

                // Polling interval
                // Caption with the current value beside it; bounds under
                // the track ends. It read "10s … 300s" at two heights, then
                // "INTERVALLE ACTUEL : 60 SECONDES".
                let mut poll_secs = state.settings.log_collector_poll_secs as f32;
                let slider_width = ui.available_width().min(420.0);
                ui.allocate_ui_with_layout(
                    egui::vec2(slider_width, 0.0),
                    egui::Layout::left_to_right(egui::Align::Center),
                    |ui| {
                        ui.set_width(slider_width);
                        ui.label(
                            egui::RichText::new("INTERVALLE DE COLLECTE")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_TIGHT)
                                .strong(),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            ui.label(
                                egui::RichText::new(crate::format::interval(
                                    state.settings.log_collector_poll_secs,
                                ))
                                .font(theme::font_body_strong())
                                .color(theme::accent_text()),
                            );
                        });
                    },
                );
                let changed = widgets::Slider::new(10.0, 300.0)
                    .step(10.0)
                    .style(widgets::SliderStyle::Stepped)
                    .hide_value()
                    .width(slider_width)
                    .show(ui, &mut poll_secs);
                if changed {
                    state.settings.log_collector_poll_secs = poll_secs as u64;
                    command = Some(GuiCommand::UpdateLogCollectorConfig {
                        enabled: state.settings.log_collector_enabled,
                        sources: state.settings.log_collector_sources.clone(),
                        poll_interval_secs: state.settings.log_collector_poll_secs,
                    });
                }
                ui.allocate_ui_with_layout(
                    egui::vec2(slider_width, 0.0),
                    egui::Layout::left_to_right(egui::Align::Center),
                    |ui| {
                        ui.set_width(slider_width);
                        ui.label(
                            egui::RichText::new("10 s")
                                .font(theme::font_caption())
                                .color(theme::text_tertiary()),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            ui.label(
                                egui::RichText::new("5 min")
                                    .font(theme::font_caption())
                                    .color(theme::text_tertiary()),
                            );
                        });
                    },
                );
            } else {
                ui.label(
                    egui::RichText::new(
                        "Activez le collecteur pour récupérer les journaux système et les afficher dans la page Surveillance.",
                    )
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
                );
            }
        });

        command
    }
}

/// A choice in the appearance tab.
#[derive(Clone, Copy, PartialEq, Eq)]
enum ThemeChoice {
    Light,
    Dark,
    System,
}

/// One appearance tile: a miniature of the interface in that theme, with
/// its name. Returns true when clicked.
fn theme_tile(ui: &mut Ui, choice: ThemeChoice, selected: bool) -> bool {
    const SIZE: egui::Vec2 = egui::vec2(184.0, 148.0);
    let (label, icon) = match choice {
        ThemeChoice::Light => ("Clair", icons::SUN),
        ThemeChoice::Dark => ("Sombre", icons::MOON),
        ThemeChoice::System => ("Système", icons::DESKTOP),
    };
    let (rect, response) = ui.allocate_exact_size(SIZE, egui::Sense::click());
    response.widget_info(|| {
        egui::WidgetInfo::selected(egui::WidgetType::RadioButton, true, selected, label)
    });
    if ui.is_rect_visible(rect) {
        let hover = crate::animation::animate_hover(ui.ctx(), response.id, response.hovered());
        let painter = ui.painter();
        let radius = egui::CornerRadius::same(theme::ROUNDING_LG);
        painter.rect(
            rect,
            radius,
            theme::bg_tertiary(),
            if selected {
                egui::Stroke::new(theme::BORDER_THICK, theme::accent_text())
            } else {
                egui::Stroke::new(
                    theme::BORDER_THIN,
                    crate::animation::lerp_color(theme::border(), theme::text_tertiary(), hover),
                )
            },
            egui::StrokeKind::Inside,
        );
        // Miniature window.
        let preview = egui::Rect::from_min_max(
            rect.min + egui::vec2(12.0, 12.0),
            egui::pos2(rect.right() - 12.0, rect.bottom() - 44.0),
        );
        match choice {
            ThemeChoice::Light => paint_theme_preview(painter, preview, false),
            ThemeChoice::Dark => paint_theme_preview(painter, preview, true),
            ThemeChoice::System => {
                // Half and half, split on the diagonal's vertical.
                let left = egui::Rect::from_min_max(
                    preview.min,
                    egui::pos2(preview.center().x, preview.bottom()),
                );
                let right = egui::Rect::from_min_max(
                    egui::pos2(preview.center().x, preview.top()),
                    preview.max,
                );
                paint_theme_preview(&painter.with_clip_rect(left), preview, false);
                paint_theme_preview(&painter.with_clip_rect(right), preview, true);
            }
        }
        // Name row.
        let text_color = if selected {
            theme::accent_text()
        } else {
            theme::text_primary()
        };
        let row_y = rect.bottom() - 22.0;
        painter.text(
            egui::pos2(rect.left() + 14.0, row_y),
            egui::Align2::LEFT_CENTER,
            icon,
            theme::font_icon(theme::ICON_XS),
            text_color,
        );
        painter.text(
            egui::pos2(rect.left() + 14.0 + theme::ICON_XS + theme::SPACE_SM, row_y),
            egui::Align2::LEFT_CENTER,
            label,
            theme::font_body_strong(),
            text_color,
        );
        if selected {
            painter.text(
                egui::pos2(rect.right() - 14.0, row_y),
                egui::Align2::RIGHT_CENTER,
                icons::CIRCLE_CHECK,
                theme::font_icon(theme::ICON_SM),
                theme::accent_text(),
            );
        }
    }
    if response.hovered() {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    response.clicked()
}

/// A tiny schematic of the app (sidebar, top bar, two cards, an accent
/// button) in the given theme's own colours, whatever theme is active.
fn paint_theme_preview(painter: &egui::Painter, rect: egui::Rect, dark: bool) {
    use egui::Color32;
    let (page, sidebar, card, line, text) = if dark {
        (
            Color32::from_rgb(6, 9, 18),
            Color32::from_rgb(10, 13, 24),
            Color32::from_rgb(17, 22, 36),
            Color32::from_rgb(38, 46, 66),
            Color32::from_rgb(148, 163, 184),
        )
    } else {
        (
            Color32::from_rgb(241, 244, 248),
            Color32::from_rgb(250, 251, 253),
            Color32::WHITE,
            Color32::from_rgb(214, 220, 228),
            Color32::from_rgb(81, 96, 118),
        )
    };
    let radius = egui::CornerRadius::same(theme::ROUNDING_SM);
    painter.rect_filled(rect, radius, page);
    let side_w = rect.width() * 0.24;
    let sidebar_rect = egui::Rect::from_min_size(rect.min, egui::vec2(side_w, rect.height()));
    painter.rect_filled(
        sidebar_rect,
        egui::CornerRadius {
            nw: theme::ROUNDING_SM,
            sw: theme::ROUNDING_SM,
            ne: 0,
            se: 0,
        },
        sidebar,
    );
    for i in 0..4 {
        let y = rect.top() + 12.0 + i as f32 * 11.0;
        painter.rect_filled(
            egui::Rect::from_min_size(
                egui::pos2(rect.left() + 6.0, y),
                egui::vec2(side_w - 12.0, 4.0),
            ),
            2.0,
            if i == 0 { theme::ACCENT } else { line },
        );
    }
    let content_left = rect.left() + side_w + 8.0;
    // Top bar line and the accent action.
    painter.rect_filled(
        egui::Rect::from_min_size(
            egui::pos2(content_left, rect.top() + 8.0),
            egui::vec2(46.0, 5.0),
        ),
        2.0,
        text,
    );
    painter.rect_filled(
        egui::Rect::from_min_size(
            egui::pos2(rect.right() - 30.0, rect.top() + 6.0),
            egui::vec2(22.0, 9.0),
        ),
        3.0,
        theme::ACCENT,
    );
    // Two cards.
    let card_w = (rect.right() - content_left - 8.0 - 6.0) / 2.0;
    for i in 0..2 {
        let card_rect = egui::Rect::from_min_size(
            egui::pos2(content_left + i as f32 * (card_w + 6.0), rect.top() + 24.0),
            egui::vec2(card_w, rect.height() - 34.0),
        );
        painter.rect(
            card_rect,
            3.0,
            card,
            egui::Stroke::new(theme::BORDER_HAIRLINE, line),
            egui::StrokeKind::Inside,
        );
        painter.rect_filled(
            egui::Rect::from_min_size(
                card_rect.min + egui::vec2(5.0, 6.0),
                egui::vec2(card_w * 0.5, 4.0),
            ),
            2.0,
            text,
        );
        painter.rect_filled(
            egui::Rect::from_min_size(
                card_rect.min + egui::vec2(5.0, 16.0),
                egui::vec2(card_w - 10.0, 3.0),
            ),
            1.5,
            line,
        );
    }
    painter.rect_stroke(
        rect,
        radius,
        egui::Stroke::new(theme::BORDER_HAIRLINE, line),
        egui::StrokeKind::Inside,
    );
}
