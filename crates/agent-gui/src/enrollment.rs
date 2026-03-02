// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Enrollment wizard -- 5-step onboarding flow.
//!
//! Steps:
//! 1. Welcome
//! 2. Token entry (token or QR scan)
//! 3. Admin setup (password configuration)
//! 4. Enrollment in progress
//! 5. Complete (success/failure)

use egui::Ui;

use crate::icons;
use crate::theme;
use crate::widgets;

// ============================================================================
// State
// ============================================================================

/// Current step of the enrollment wizard.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EnrollmentStep {
    Welcome,
    TokenEntry,
    AdminSetup,
    InProgress,
    Complete { success: bool, message: String },
}

/// Enrollment wizard state.
pub struct EnrollmentWizard {
    pub step: EnrollmentStep,
    pub token_input: String,
    pub qr_input: String,
    pub use_qr: bool,
    pub progress_message: String,
    pub show_token: bool,
    pub admin_password: String,
    pub use_default_password: bool,
    pub show_password: bool,
}

impl Default for EnrollmentWizard {
    fn default() -> Self {
        Self {
            step: EnrollmentStep::Welcome,
            token_input: String::new(),
            qr_input: String::new(),
            use_qr: false,
            progress_message: "Connexion au serveur...".to_string(),
            show_token: false,
            admin_password: "agent_admin".to_string(),
            use_default_password: true,
            show_password: false,
        }
    }
}

/// Commands emitted by the enrollment wizard.
#[derive(Debug, Clone)]
pub enum EnrollmentCommand {
    /// User submitted enrollment details including password.
    SubmitEnrollment { token: String, admin_password: Option<String> },
    /// User submitted a QR payload.
    SubmitQr(String),
    /// User wants to skip / cancel.
    Cancel,
    /// Enrollment finished, user clicked "Continuer".
    Finish,
}

// ============================================================================
// Rendering
// ============================================================================

impl EnrollmentWizard {
    /// Render the enrollment wizard. Returns a command when the user takes an action.
    pub fn show(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let mut command = None;

        // Paint gradient background
        let rect = ui.max_rect();
        let _is_dark = theme::is_dark_mode();

        if ui.is_rect_visible(rect) {
            use egui::epaint::{Mesh, Vertex};
            let mut mesh = Mesh::default();

            let (center_col, outer_col) = theme::enrollment_gradient();

            // Stick to the vertical spotlight for consistency with Sidebar.
            let top_col = center_col;
            let bot_col = outer_col;

            let idx = mesh.vertices.len() as u32;
            mesh.vertices.push(Vertex {
                pos: rect.left_top(),
                uv: Default::default(),
                color: top_col,
            });
            mesh.vertices.push(Vertex {
                pos: rect.right_top(),
                uv: Default::default(),
                color: top_col,
            });
            mesh.vertices.push(Vertex {
                pos: rect.right_bottom(),
                uv: Default::default(),
                color: bot_col,
            });
            mesh.vertices.push(Vertex {
                pos: rect.left_bottom(),
                uv: Default::default(),
                color: bot_col,
            });

            mesh.add_triangle(idx, idx + 1, idx + 2);
            mesh.add_triangle(idx + 2, idx + 3, idx);

            ui.painter().add(mesh);
        }

        egui::Frame::new()
            .fill(egui::Color32::TRANSPARENT)
            .inner_margin(egui::Margin::same(theme::SPACE_XL as i8))
            .show(ui, |ui: &mut egui::Ui| {
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE_XL);

                    // Hero Image (IA.png) - Professional clean look
                    // Load image from bytes
                    let image = egui::Image::from_bytes(
                        "bytes://ia.png",
                        include_bytes!("../assets/IA.png"),
                    )
                    .max_width(theme::ENROLLMENT_LOGO_WIDTH)
                    .corner_radius(egui::CornerRadius::same(theme::ROUNDING_LG));

                    let _image_response = ui.add(image);

                    ui.add_space(theme::SPACE_LG);

                    // Step indicator
                    Self::step_indicator(ui, &self.step);
                    ui.add_space(theme::SPACE_LG);

                    match &self.step {
                        EnrollmentStep::Welcome => {
                            command = self.show_welcome(ui);
                        }
                        EnrollmentStep::TokenEntry => {
                            command = self.show_token_entry(ui);
                        }
                        EnrollmentStep::AdminSetup => {
                            command = self.show_admin_setup(ui);
                        }
                        EnrollmentStep::InProgress => {
                            Self::show_progress(ui, &self.progress_message);
                        }
                        EnrollmentStep::Complete { success, message } => {
                            command = Self::show_complete(ui, *success, message);
                        }
                    }
                });
            });

        // On failure retry: reset wizard to token entry instead of sending Finish to backend
        if let Some(EnrollmentCommand::Finish) = &command
            && let EnrollmentStep::Complete { success: false, .. } = &self.step
        {
            self.step = EnrollmentStep::TokenEntry;
            self.token_input.clear();
            self.qr_input.clear();
            return None;
        }

        command
    }

    fn show_welcome(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let command = None;

        ui.centered_and_justified(|ui| {
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.set_max_width(theme::ENROLLMENT_CARD_WIDTH);
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE);

                    ui.label(
                        egui::RichText::new("Bienvenue dans Sentinel Agent")
                            .font(theme::font_comex())
                            .color(theme::accent_text())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE);

                    ui.label(
                        egui::RichText::new(
                            "Pour commencer, vous devez inscrire cet agent avec votre \
                             plateforme Sentinel GRC.\n\n\
                             Vous aurez besoin du jeton d'inscription fourni par votre \
                             administrateur.",
                        )
                        .font(theme::font_body())
                        .color(theme::text_secondary())
                        .line_height(Some(theme::ICON_MD)),
                    );

                    ui.add_space(theme::SPACE_LG);

                    if widgets::button::primary_button(ui, "Commencer l'inscription", true).clicked() {
                        self.step = EnrollmentStep::TokenEntry;
                    }

                    ui.add_space(theme::SPACE);
                });
            });
        });

        command
    }

    fn show_token_entry(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let mut command = None;

        widgets::card(ui, |ui| {
            ui.set_max_width(480.0);
            ui.vertical_centered(|ui| {
                ui.label(
                    egui::RichText::new("Authentification")
                        .font(egui::FontId::proportional(18.0))
                        .color(theme::text_primary())
                        .strong(),
                );
                ui.add_space(theme::SPACE);

                // Simple checkbox toggle for Token / QR
                ui.checkbox(&mut self.use_qr, "Utiliser un QR Code");

                ui.add_space(theme::SPACE_SM);

                if self.use_qr {
                    ui.label(
                        egui::RichText::new(
                            "Collez le contenu du QR code ci-dessous.",
                        )
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                    );
                    ui.add_space(theme::SPACE_SM);

                    let te = egui::TextEdit::multiline(&mut self.qr_input)
                        .desired_rows(4)
                        .desired_width(f32::INFINITY)
                        .hint_text("Coller le contenu du QR code...");
                    ui.add(te);
                } else {
                    ui.label(
                        egui::RichText::new(
                            "Saisissez le token d'enrôlement fourni par votre administrateur.\n\
                             Vous le trouverez dans Sentinel GRC \u{2192} Paramètres \
                             \u{2192} Agents \u{2192} Enrôler un Agent.",
                        )
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                    );
                    ui.add_space(theme::SPACE_SM);

                    ui.horizontal(|ui| {
                        ui.add(
                            egui::TextEdit::singleline(&mut self.token_input)
                                .desired_width(ui.available_width() - 40.0)
                                .font(egui::TextStyle::Monospace)
                                .password(!self.show_token)
                                .hint_text("Token d'enrôlement..."),
                        );

                        let vis_icon = if self.show_token {
                            icons::EYE_SLASH
                        } else {
                            icons::EYE
                        };
                        if widgets::button::icon_button(ui, vis_icon, None).clicked() {
                            self.show_token = !self.show_token;
                        }
                    });
                }

                ui.add_space(theme::SPACE);

                // Buttons
                ui.horizontal(|ui| {
                    let cancel_btn = egui::Button::new(
                        egui::RichText::new("Annuler")
                            .font(theme::font_body())
                            .color(theme::text_secondary()),
                    )
                    .fill(theme::bg_elevated())
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                    if ui.add(cancel_btn).clicked() {
                        command = Some(EnrollmentCommand::Cancel);
                    }

                    ui.add_space(theme::SPACE);

                    let has_input = if self.use_qr {
                        !self.qr_input.trim().is_empty()
                    } else {
                        !self.token_input.trim().is_empty()
                    };

                    let next_btn = egui::Button::new(
                        egui::RichText::new("Suivant")
                            .font(theme::font_body())
                            .color(theme::text_on_accent()),
                    )
                    .fill(theme::ACCENT)
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
                    .min_size(egui::Vec2::new(120.0, 36.0));

                    if ui.add_enabled(has_input, next_btn).clicked() {
                        if self.use_qr {
                            // QR goes directly to enrollment (no admin setup for QR)
                            let qr = self.qr_input.trim().to_string();
                            self.step = EnrollmentStep::InProgress;
                            self.progress_message = "Traitement du code QR...".to_string();
                            command = Some(EnrollmentCommand::SubmitQr(qr));
                        } else {
                            // Token goes to admin setup step
                            self.step = EnrollmentStep::AdminSetup;
                        }
                    }
                });
            });
        });

        command
    }

    fn show_admin_setup(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let mut command = None;

        widgets::card(ui, |ui| {
            ui.set_max_width(480.0);
            ui.vertical_centered(|ui| {
                ui.label(
                    egui::RichText::new("Configuration Admin")
                        .font(egui::FontId::proportional(18.0))
                        .color(theme::text_primary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new("Définissez le mot de passe administrateur pour cet agent.")
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                );

                ui.add_space(theme::SPACE_LG);

                // Default password toggle
                ui.checkbox(
                    &mut self.use_default_password,
                    "Utiliser le mot de passe par défaut (agent_admin)",
                );

                if !self.use_default_password {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new("Mot de passe personnalisé :")
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );
                    ui.add_space(theme::SPACE_XS);

                    ui.horizontal(|ui| {
                        ui.add(
                            egui::TextEdit::singleline(&mut self.admin_password)
                                .desired_width(ui.available_width() - 40.0)
                                .font(egui::TextStyle::Monospace)
                                .password(!self.show_password)
                                .hint_text("Saisir un mot de passe sécurisé"),
                        );

                        let vis_icon = if self.show_password {
                            icons::EYE_SLASH
                        } else {
                            icons::EYE
                        };
                        if widgets::button::icon_button(ui, vis_icon, None).clicked() {
                            self.show_password = !self.show_password;
                        }
                    });
                }

                ui.add_space(theme::SPACE_LG);

                // Actions
                ui.horizontal(|ui| {
                    let back_btn = egui::Button::new(
                        egui::RichText::new("Retour")
                            .font(theme::font_body())
                            .color(theme::text_secondary()),
                    )
                    .fill(theme::bg_elevated())
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                    if ui.add(back_btn).clicked() {
                        self.step = EnrollmentStep::TokenEntry;
                    }

                    ui.add_space(theme::SPACE);

                    let is_valid =
                        self.use_default_password || !self.admin_password.trim().is_empty();

                    let enroll_btn = egui::Button::new(
                        egui::RichText::new("Enrôler")
                            .font(theme::font_body())
                            .color(theme::text_on_accent()),
                    )
                    .fill(theme::ACCENT)
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
                    .min_size(egui::Vec2::new(120.0, 36.0));

                    if ui.add_enabled(is_valid, enroll_btn).clicked() {
                        let token = self.token_input.trim().to_string();
                        let password = if self.use_default_password {
                            None
                        } else {
                            Some(self.admin_password.trim().to_string())
                        };

                        self.step = EnrollmentStep::InProgress;
                        self.progress_message = "Connexion au serveur...".to_string();
                        command = Some(EnrollmentCommand::SubmitEnrollment {
                            token,
                            admin_password: password,
                        });
                    }
                });
            });
        });

        command
    }

    fn show_progress(ui: &mut Ui, message: &str) {
        widgets::card(ui, |ui| {
            ui.set_max_width(480.0);
            ui.vertical_centered(|ui| {
                ui.add_space(theme::SPACE_LG);
                ui.spinner();
                ui.add_space(theme::SPACE);
                ui.label(
                    egui::RichText::new(message)
                        .font(theme::font_body())
                        .color(theme::text_primary()),
                );
                ui.add_space(theme::SPACE);
                ui.label(
                    egui::RichText::new("Veuillez patienter...")
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_LG);
            });
        });
    }

    fn show_complete(ui: &mut Ui, success: bool, message: &str) -> Option<EnrollmentCommand> {
        let mut command = None;

        widgets::card(ui, |ui| {
            ui.set_max_width(480.0);
            ui.vertical_centered(|ui| {
                ui.add_space(theme::SPACE_LG);

                if success {
                    ui.label(
                        egui::RichText::new("\u{2705}")
                            .font(egui::FontId::proportional(48.0)),
                    );
                    ui.add_space(theme::SPACE);
                    ui.label(
                        egui::RichText::new("Enrôlement réussi !")
                            .font(egui::FontId::proportional(22.0))
                            .color(theme::SUCCESS)
                            .strong(),
                    );
                } else {
                    ui.label(
                        egui::RichText::new("\u{274c}")
                            .font(egui::FontId::proportional(48.0)),
                    );
                    ui.add_space(theme::SPACE);
                    ui.label(
                        egui::RichText::new("Échec de l'enrôlement")
                            .font(egui::FontId::proportional(22.0))
                            .color(theme::ERROR)
                            .strong(),
                    );
                }

                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(message)
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );

                ui.add_space(theme::SPACE_LG);

                let btn_text = if success { "Continuer" } else { "Réessayer" };
                let btn = egui::Button::new(
                    egui::RichText::new(btn_text)
                        .font(theme::font_body())
                        .color(theme::text_on_accent()),
                )
                .fill(if success { theme::ACCENT } else { theme::WARNING })
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
                .min_size(egui::Vec2::new(160.0, 40.0));

                if ui.add(btn).clicked() {
                    command = Some(EnrollmentCommand::Finish);
                }

                ui.add_space(theme::SPACE_LG);
            });
        });

        command
    }

    fn step_indicator(ui: &mut Ui, current: &EnrollmentStep) {
        let step_labels = ["Bienvenue", "Jeton", "Admin", "Inscription", "Terminé"];

        let current_idx = match current {
            EnrollmentStep::Welcome => 0,
            EnrollmentStep::TokenEntry => 1,
            EnrollmentStep::AdminSetup => 2,
            EnrollmentStep::InProgress => 3,
            EnrollmentStep::Complete { .. } => 4,
        };

        ui.horizontal(|ui| {
            for (i, label) in step_labels.iter().enumerate() {
                let color = if i <= current_idx {
                    theme::ACCENT
                } else {
                    theme::text_tertiary()
                };

                ui.label(
                    egui::RichText::new(format!("{}. {}", i + 1, label))
                        .font(theme::font_small())
                        .color(color),
                );

                if i < step_labels.len() - 1 {
                    ui.label(
                        egui::RichText::new(" \u{2192} ")
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );
                }
            }
        });
    }

    /// Set the enrollment result. Called by the app when enrollment completes.
    pub fn set_result(&mut self, success: bool, message: String) {
        self.step = EnrollmentStep::Complete { success, message };
    }

    /// Update the progress message.
    pub fn set_progress(&mut self, message: String) {
        self.progress_message = message;
    }
}
