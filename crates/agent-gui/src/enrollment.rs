//! Enrollment wizard -- 4-step onboarding flow.
//!
//! Steps:
//! 1. Bienvenue (welcome)
//! 2. Saisie du token (token entry or QR scan)
//! 3. Enr\u{00f4}lement en cours (progress)
//! 4. Termin\u{00e9} (success/failure)

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
}

impl Default for EnrollmentWizard {
    fn default() -> Self {
        Self {
            step: EnrollmentStep::Welcome,
            token_input: String::new(),
            qr_input: String::new(),
            use_qr: false,
            progress_message: "Connexion au serveur...".to_string(),
        }
    }
}

/// Commands emitted by the enrollment wizard.
#[derive(Debug, Clone)]
pub enum EnrollmentCommand {
    /// User submitted a token to enroll with.
    SubmitToken(String),
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

        egui::Frame::new()
            .fill(theme::bg_primary())
            .inner_margin(egui::Margin::same(32))
            .show(ui, |ui| {
                ui.vertical_centered(|ui| {
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
                        EnrollmentStep::InProgress => {
                            Self::show_progress(ui, &self.progress_message);
                        }
                        EnrollmentStep::Complete { success, message } => {
                            command = Self::show_complete(ui, *success, message);
                        }
                    }
                });
            });

        command
    }

    fn show_welcome(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let command = None;

        widgets::card(ui, |ui| {
            ui.set_max_width(480.0);
            ui.vertical_centered(|ui| {
                ui.add_space(theme::SPACE);

                ui.label(
                    egui::RichText::new("Bienvenue dans Sentinel Agent")
                        .font(egui::FontId::proportional(24.0))
                        .color(theme::ACCENT)
                        .strong(),
                );
                ui.add_space(theme::SPACE);

                ui.label(
                    egui::RichText::new(
                        "Pour commencer, vous devez enr\u{00f4}ler cet agent aupr\u{00e8}s de \
                         votre plateforme Sentinel GRC.\n\n\
                         Vous aurez besoin du token d'enr\u{00f4}lement fourni par votre \
                         administrateur.",
                    )
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );

                ui.add_space(theme::SPACE_LG);

                let btn = egui::Button::new(
                    egui::RichText::new("Commencer l'enr\u{00f4}lement")
                        .font(theme::font_body())
                        .color(theme::text_on_accent()),
                )
                .fill(theme::ACCENT)
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
                .min_size(egui::Vec2::new(220.0, 40.0));

                if ui.add(btn).clicked() {
                    self.step = EnrollmentStep::TokenEntry;
                }

                ui.add_space(theme::SPACE);
            });
        });

        command
    }

    fn show_token_entry(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let mut command = None;

        widgets::card(ui, |ui| {
            ui.set_max_width(480.0);

            ui.label(
                egui::RichText::new("Entrer le token d'enr\u{00f4}lement")
                    .font(theme::font_heading())
                    .color(theme::text_primary()),
            );
            ui.add_space(theme::SPACE);

            // Toggle between token and QR
            ui.horizontal(|ui| {
                if ui.selectable_label(!self.use_qr, "Token manuel").clicked() {
                    self.use_qr = false;
                }
                if ui
                    .selectable_label(self.use_qr, "Code QR (coller)")
                    .clicked()
                {
                    self.use_qr = true;
                }
            });

            ui.add_space(theme::SPACE_SM);

            if self.use_qr {
                ui.label(
                    egui::RichText::new(
                        "Collez le contenu du code QR scann\u{00e9} ci-dessous.\n\
                         Vous pouvez scanner le QR avec votre t\u{00e9}l\u{00e9}phone et \
                         copier le texte.",
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
                        "Saisissez le token d'enr\u{00f4}lement fourni par votre administrateur.\n\
                         Vous le trouverez dans Sentinel GRC > Param\u{00e8}tres \
                         > Agents > Enr\u{00f4}ler un Agent.",
                    )
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_SM);

                let te = egui::TextEdit::singleline(&mut self.token_input)
                    .desired_width(f32::INFINITY)
                    .hint_text("Token d'enr\u{00f4}lement...");
                ui.add(te);
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

                let enroll_btn = egui::Button::new(
                    egui::RichText::new("Enr\u{00f4}ler")
                        .font(theme::font_body())
                        .color(theme::text_on_accent()),
                )
                .fill(theme::ACCENT)
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
                .min_size(egui::Vec2::new(120.0, 36.0));

                if ui.add_enabled(has_input, enroll_btn).clicked() {
                    if self.use_qr {
                        let qr = self.qr_input.trim().to_string();
                        self.step = EnrollmentStep::InProgress;
                        self.progress_message = "Traitement du code QR...".to_string();
                        command = Some(EnrollmentCommand::SubmitQr(qr));
                    } else {
                        let token = self.token_input.trim().to_string();
                        self.step = EnrollmentStep::InProgress;
                        self.progress_message = "Connexion au serveur...".to_string();
                        command = Some(EnrollmentCommand::SubmitToken(token));
                    }
                }
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
                        egui::RichText::new(icons::CIRCLE_CHECK).font(egui::FontId::proportional(48.0)).color(theme::SUCCESS),
                    );
                    ui.add_space(theme::SPACE);
                    ui.label(
                        egui::RichText::new("Enr\u{00f4}lement r\u{00e9}ussi !")
                            .font(egui::FontId::proportional(22.0))
                            .color(theme::SUCCESS)
                            .strong(),
                    );
                } else {
                    ui.label(
                        egui::RichText::new(icons::CIRCLE_XMARK).font(egui::FontId::proportional(48.0)).color(theme::ERROR),
                    );
                    ui.add_space(theme::SPACE);
                    ui.label(
                        egui::RichText::new("\u{00c9}chec de l'enr\u{00f4}lement")
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

                let btn_text = if success {
                    "Continuer"
                } else {
                    "R\u{00e9}essayer"
                };
                let btn = egui::Button::new(
                    egui::RichText::new(btn_text)
                        .font(theme::font_body())
                        .color(theme::text_on_accent()),
                )
                .fill(if success {
                    theme::ACCENT
                } else {
                    theme::WARNING
                })
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
        let steps = [
            ("Bienvenue", EnrollmentStep::Welcome),
            ("Token", EnrollmentStep::TokenEntry),
            ("Enr\u{00f4}lement", EnrollmentStep::InProgress),
            (
                "Termin\u{00e9}",
                EnrollmentStep::Complete {
                    success: true,
                    message: String::new(),
                },
            ),
        ];

        let current_idx = match current {
            EnrollmentStep::Welcome => 0,
            EnrollmentStep::TokenEntry => 1,
            EnrollmentStep::InProgress => 2,
            EnrollmentStep::Complete { .. } => 3,
        };

        ui.horizontal(|ui| {
            for (i, (label, _)) in steps.iter().enumerate() {
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

                if i < steps.len() - 1 {
                    ui.label(
                        egui::RichText::new(format!(" {} ", icons::ARROW_RIGHT))
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
