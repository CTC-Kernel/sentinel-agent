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
use std::cmp::Ordering;

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
    pub show_password: bool,
    pub is_enrolling: bool,
}

impl Default for EnrollmentWizard {
    fn default() -> Self {
        Self {
            step: EnrollmentStep::Welcome,
            token_input: String::new(),
            qr_input: String::new(),
            use_qr: false,
            progress_message: "Connexion au serveur…".to_string(),
            show_token: false,
            admin_password: String::new(),
            show_password: false,
            is_enrolling: false,
        }
    }
}

/// Commands emitted by the enrollment wizard.
#[derive(Debug, Clone)]
pub enum EnrollmentCommand {
    /// User submitted enrollment details including password.
    SubmitEnrollment {
        token: String,
        admin_password: Option<String>,
    },
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

                    ui.add_space(theme::SPACE_MD);
                    ui.label(
                        egui::RichText::new("SENTINEL")
                            .font(theme::font_h2())
                            .color(theme::text_primary())
                            .extra_letter_spacing(theme::TRACKING_WIDE * 3.0),
                    );
                    ui.label(
                        egui::RichText::new("GRC AGENT")
                            .font(theme::font_micro())
                            .color(theme::accent_text())
                            .extra_letter_spacing(theme::TRACKING_WIDE * 2.0),
                    );

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

    /// The wizard's single column: one card, `ENROLLMENT_CARD_WIDTH` wide,
    /// centred by the parent layout however wide the window is.
    fn column(ui: &mut Ui, add: impl FnOnce(&mut Ui)) {
        let width = theme::ENROLLMENT_CARD_WIDTH.min(ui.available_width());
        ui.allocate_ui_with_layout(
            egui::vec2(width, 0.0),
            egui::Layout::top_down(egui::Align::Min),
            |ui: &mut Ui| {
                ui.set_width(width);
                widgets::card(ui, add);
            },
        );
    }

    fn show_welcome(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        Self::column(ui, |ui: &mut egui::Ui| {
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.add_space(theme::SPACE);
                ui.label(
                    egui::RichText::new("Bienvenue dans Sentinel Agent")
                        .font(theme::font_h2())
                        .color(theme::text_primary()),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(
                        "Pour commencer, inscrivez cet agent aupr\u{00e8}s de votre plateforme \
                         Sentinel GRC. Vous aurez besoin du jeton d'enr\u{00f4}lement fourni \
                         par votre administrateur.",
                    )
                    .font(theme::font_body())
                    .color(theme::text_secondary())
                    .line_height(Some(theme::ICON_MD)),
                );
                ui.add_space(theme::SPACE_LG);
                if widgets::button::primary_button(ui, "Commencer l'enr\u{00f4}lement", true)
                    .clicked()
                {
                    self.step = EnrollmentStep::TokenEntry;
                }
                ui.add_space(theme::SPACE);
            });
        });

        None
    }

    fn show_token_entry(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let mut command = None;

        Self::column(ui, |ui| {
            ui.vertical_centered(|ui| {
                ui.label(
                    egui::RichText::new("Jeton d'enr\u{00f4}lement")
                        .font(theme::font_h2())
                        .color(theme::text_primary()),
                );
                ui.add_space(theme::SPACE);

                let mut mode = usize::from(self.use_qr);
                if widgets::tabs_pills(ui, &["Jeton", "QR code"], &mut mode) {
                    self.use_qr = mode == 1;
                }

                ui.add_space(theme::SPACE_SM);

                if self.use_qr {
                    ui.label(
                        egui::RichText::new("Collez le contenu du QR code ci-dessous.")
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );
                    ui.add_space(theme::SPACE_SM);

                    let te = egui::TextEdit::multiline(&mut self.qr_input)
                        .desired_rows(4)
                        .desired_width(f32::INFINITY)
                        .hint_text("Coller le contenu du QR code…");
                    ui.add(te);
                } else {
                    ui.label(
                        egui::RichText::new(
                            "Saisissez le jeton d'enrôlement fourni par votre administrateur.\n\
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
                                .hint_text("Jeton d'enrôlement…"),
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

                // Actions: primary on the trailing edge, as in every dialog.
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    let is_valid = if self.use_qr {
                        !self.qr_input.trim().is_empty()
                    } else {
                        !self.token_input.trim().is_empty()
                    };

                    if widgets::primary_button_loading(
                        ui,
                        "Suivant",
                        is_valid && !self.is_enrolling,
                        self.is_enrolling,
                    )
                    .clicked()
                    {
                        if self.use_qr {
                            // QR goes directly to enrollment (no admin setup for QR)
                            let qr = self.qr_input.trim().to_string();
                            self.step = EnrollmentStep::InProgress;
                            self.is_enrolling = true;
                            self.progress_message = "Traitement du code QR…".to_string();
                            command = Some(EnrollmentCommand::SubmitQr(qr));
                        } else {
                            // Token goes to admin setup step
                            self.step = EnrollmentStep::AdminSetup;
                        }
                    }

                    ui.add_space(theme::SPACE_SM);
                    if widgets::secondary_button(ui, "Annuler", true).clicked() {
                        command = Some(EnrollmentCommand::Cancel);
                    }
                });
            });
        });

        command
    }

    fn show_admin_setup(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let mut command = None;

        Self::column(ui, |ui| {
            ui.vertical_centered(|ui| {
                ui.label(
                    egui::RichText::new("Compte administrateur")
                        .font(theme::font_h2())
                        .color(theme::text_primary()),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(
                        "Définissez le mot de passe administrateur pour cet agent.",
                    )
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
                );

                ui.add_space(theme::SPACE_LG);

                // Password input (always required — no default password)
                ui.label(
                    egui::RichText::new("Mot de passe administrateur")
                        .font(theme::font_label())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_XS);

                ui.horizontal(|ui| {
                    ui.add(
                        egui::TextEdit::singleline(&mut self.admin_password)
                            .desired_width(ui.available_width() - 40.0)
                            .font(egui::TextStyle::Monospace)
                            .password(!self.show_password)
                            .hint_text("Saisir un mot de passe sécurisé (min. 8 caractères)"),
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

                // Password strength feedback
                let pw_len = self.admin_password.trim().len();
                if pw_len > 0 && pw_len < 8 {
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new("Le mot de passe doit contenir au moins 8 caractères.")
                            .font(theme::font_small())
                            .color(theme::readable_color(theme::ERROR)),
                    );
                }

                ui.add_space(theme::SPACE_LG);

                // Actions
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    let is_valid = self.admin_password.trim().len() >= 8;

                    if widgets::primary_button_loading(
                        ui,
                        "Enrôler",
                        is_valid && !self.is_enrolling,
                        self.is_enrolling,
                    )
                    .clicked()
                    {
                        let token = self.token_input.trim().to_string();
                        let password = Some(self.admin_password.trim().to_string());

                        self.step = EnrollmentStep::InProgress;
                        self.is_enrolling = true;
                        self.progress_message = "Connexion au serveur…".to_string();
                        command = Some(EnrollmentCommand::SubmitEnrollment {
                            token,
                            admin_password: password,
                        });
                    }

                    ui.add_space(theme::SPACE_SM);
                    if widgets::secondary_button(ui, "Retour", true).clicked() {
                        self.step = EnrollmentStep::TokenEntry;
                    }
                });
            });
        });

        command
    }

    fn show_progress(ui: &mut Ui, message: &str) {
        Self::column(ui, |ui| {
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
                    egui::RichText::new("Veuillez patienter…")
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_LG);
            });
        });
    }

    fn show_complete(ui: &mut Ui, success: bool, message: &str) -> Option<EnrollmentCommand> {
        let mut command = None;

        Self::column(ui, |ui| {
            if success {
                widgets::hero_state(
                    ui,
                    icons::SHIELD_CHECK,
                    "Enr\u{00f4}lement r\u{00e9}ussi",
                    message,
                    theme::SUCCESS,
                );
            } else {
                widgets::hero_state(
                    ui,
                    icons::CIRCLE_XMARK,
                    "\u{00c9}chec de l'enr\u{00f4}lement",
                    message,
                    theme::ERROR,
                );
            }
            ui.vertical_centered(|ui| {
                let label = if success {
                    "Continuer"
                } else {
                    "R\u{00e9}essayer"
                };
                if widgets::button::primary_button(ui, label, true).clicked() {
                    command = Some(EnrollmentCommand::Finish);
                }
                ui.add_space(theme::SPACE);
            });
        });

        command
    }

    /// Numbered stepper: done steps carry a check, the current one is filled,
    /// the rest wait in outline. Painted, so it centres as one block.
    fn step_indicator(ui: &mut Ui, current: &EnrollmentStep) {
        const LABELS: [&str; 5] = [
            "Bienvenue",
            "Jeton",
            "Admin",
            "Enr\u{00f4}lement",
            "Termin\u{00e9}",
        ];
        const STEP_W: f32 = 96.0;
        const RADIUS: f32 = 11.0;

        let current_idx = match current {
            EnrollmentStep::Welcome => 0,
            EnrollmentStep::TokenEntry => 1,
            EnrollmentStep::AdminSetup => 2,
            EnrollmentStep::InProgress => 3,
            EnrollmentStep::Complete { .. } => 4,
        };

        let height = RADIUS * 2.0 + theme::SPACE_XS + theme::ICON_SM;
        let (rect, _) = ui.allocate_exact_size(
            egui::vec2(STEP_W * LABELS.len() as f32, height),
            egui::Sense::hover(),
        );
        if !ui.is_rect_visible(rect) {
            return;
        }
        let painter = ui.painter();
        let cy = rect.top() + RADIUS;
        let center_x = |i: usize| rect.left() + STEP_W * (i as f32 + 0.5);

        for i in 0..LABELS.len() - 1 {
            let done = i < current_idx;
            painter.line_segment(
                [
                    egui::pos2(center_x(i) + RADIUS + theme::SPACE_XS, cy),
                    egui::pos2(center_x(i + 1) - RADIUS - theme::SPACE_XS, cy),
                ],
                egui::Stroke::new(
                    theme::BORDER_THIN,
                    if done { theme::ACCENT } else { theme::border() },
                ),
            );
        }

        for (i, label) in LABELS.iter().enumerate() {
            let center = egui::pos2(center_x(i), cy);
            let (fill, ring, glyph, text) = match i.cmp(&current_idx) {
                Ordering::Less => (
                    theme::tinted_surface(theme::ACCENT),
                    theme::ACCENT,
                    theme::accent_text(),
                    theme::text_secondary(),
                ),
                Ordering::Equal => (
                    theme::ACCENT,
                    theme::ACCENT,
                    theme::text_on_accent(),
                    theme::text_primary(),
                ),
                Ordering::Greater => (
                    theme::bg_secondary(),
                    theme::border(),
                    theme::text_tertiary(),
                    theme::text_tertiary(),
                ),
            };
            painter.circle_filled(center, RADIUS, fill);
            painter.circle_stroke(center, RADIUS, egui::Stroke::new(theme::BORDER_THIN, ring));
            if i < current_idx {
                painter.text(
                    center,
                    egui::Align2::CENTER_CENTER,
                    icons::CHECK,
                    theme::font_icon(theme::ICON_XS),
                    glyph,
                );
            } else {
                painter.text(
                    center,
                    egui::Align2::CENTER_CENTER,
                    (i + 1).to_string(),
                    theme::font_label(),
                    glyph,
                );
            }
            painter.text(
                egui::pos2(center.x, rect.top() + RADIUS * 2.0 + theme::SPACE_XS),
                egui::Align2::CENTER_TOP,
                *label,
                theme::font_label(),
                text,
            );
        }
    }

    /// Set the enrollment result. Called by the app when enrollment completes.
    pub fn set_result(&mut self, success: bool, message: String) {
        self.is_enrolling = false;
        self.step = EnrollmentStep::Complete { success, message };
    }

    /// Update the progress message.
    pub fn set_progress(&mut self, message: String) {
        self.progress_message = message;
    }
}
