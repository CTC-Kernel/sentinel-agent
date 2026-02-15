//! Enrollment wizard -- 4-step onboarding flow.
//!
//! Steps:
//! 1. Bienvenue (welcome)
//! 2. Saisie du token (token entry or QR scan)
//! 3. Enrôlemen in cours (progress)
//! 4. Terminé (success/failure)

use egui::Ui;

use crate::icons;
use crate::theme;
use crate::widgets;
use once_cell::sync::Lazy;
use regex::Regex;

static TOKEN_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[a-zA-Z0-9]{5}(?:-[a-zA-Z0-9]{5}){2,}$").unwrap());

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
    pub show_token: bool, // Toggle for token visibility
}

impl Default for EnrollmentWizard {
    fn default() -> Self {
        Self {
            step: EnrollmentStep::Welcome,
            token_input: String::new(),
            qr_input: String::new(),
            use_qr: false,
            progress_message: "Connexion au serveur...".to_string(),
            show_token: false, // Token masked by default for security
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

        // Paint gradient background
        let rect = ui.max_rect();
        let is_dark = theme::is_dark_mode();

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

                    // Hero Image (IA.png) with Glow
                    // Load image from bytes
                    let image = egui::Image::from_bytes(
                        "bytes://ia.png",
                        include_bytes!("../assets/IA.png"),
                    )
                    .max_width(theme::ENROLLMENT_LOGO_WIDTH)
                    .corner_radius(egui::CornerRadius::same(theme::ROUNDING_LG));

                    let image_response = ui.add(image);

                    // Simple glow effect behind/around logo
                    if is_dark {
                        let center = image_response.rect.center();
                        let radius = theme::ENROLLMENT_GLOW_RADIUS;
                        let color = theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE);

                        // Paint on background layer to ensure it's behind the image
                        ui.ctx()
                            .layer_painter(egui::LayerId::background())
                            .circle_filled(center, radius, color);
                    }

                    ui.add_space(theme::SPACE_LG);

                    // Step indicator
                    Self::step_indicator(ui, &self.step);
                    ui.add_space(theme::SPACE_LG);

                    // ScrollArea for content protection
                    egui::ScrollArea::vertical().show(ui, |ui: &mut egui::Ui| match &self.step {
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
                    });
                });
            });

        command
    }

    fn show_welcome(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let command = None;

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.set_max_width(theme::ENROLLMENT_CARD_WIDTH);
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.add_space(theme::SPACE);

                ui.label(
                    egui::RichText::new("Bienvenue dans Sentinel Agent")
                        .font(theme::font_comex()) // Larger, bolder title
                        .color(theme::accent_text())
                        .strong(),
                );
                ui.add_space(theme::SPACE);

                ui.label(
                    egui::RichText::new(
                        "Pour commencer, vous devez enrôler cet agent auprès de \
                         votre plateforme Sentinel GRC.\n\n\
                         Vous aurez besoin du token d'enrôlement fourni par votre \
                         administrateur.",
                    )
                    .font(theme::font_body())
                    .color(theme::text_secondary())
                    .line_height(Some(theme::ICON_MD)), // Better readability
                );

                ui.add_space(theme::SPACE_LG);

                if widgets::button::primary_button(ui, "Commencer l'enrôlement", true).clicked() {
                    self.step = EnrollmentStep::TokenEntry;
                }

                ui.add_space(theme::SPACE);
            });
        });

        command
    }

    fn show_token_entry(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XL);

        // CENTERING CONTAINER: Glass Card
        ui.vertical_centered(|ui: &mut egui::Ui| {
            ui.set_max_width(theme::ENROLLMENT_INPUT_WIDTH);

            // Glass Card Frame
            let card_bg = theme::bg_secondary();
            let card_stroke = egui::Stroke::new(theme::BORDER_THIN, theme::border());

            egui::Frame::new()
                .fill(card_bg)
                .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
                .stroke(card_stroke)
                .inner_margin(egui::Margin::same(theme::SPACE_XL as i8))
                .show(ui, |ui: &mut egui::Ui| {
                    // Header
                    ui.label(
                        egui::RichText::new("AUTHENTIFICATION")
                            .font(theme::font_heading())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new("Connectez cet agent à votre console Sentinel GRC.")
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );

                    ui.add_space(theme::SPACE_LG);

                    // Custom Segmented Control (Pill Toggle)
                    let height = theme::SEGMENTED_CONTROL_HEIGHT;
                    let width = theme::SEGMENTED_CONTROL_WIDTH;
                    let rounding = theme::SEGMENTED_CONTROL_ROUNDING;

                    let (rect, response) = ui
                        .allocate_exact_size(egui::Vec2::new(width, height), egui::Sense::click());

                    if ui.is_rect_visible(rect) {
                        // Track Background
                        ui.painter().rect_filled(
                            rect,
                            egui::CornerRadius::same(rounding),
                            theme::border(),
                        );

                        // 2. Calculate State
                        let half_width = width / 2.0;
                        // Animate position
                        let target_x = if self.use_qr {
                            rect.left() + half_width
                        } else {
                            rect.left()
                        };
                        let pill_x = ui.ctx().animate_value_with_time(
                            response.id.with("pill_x"),
                            target_x,
                            theme::ANIM_NORMAL,
                        );

                        let pill_rect = egui::Rect::from_min_size(
                            egui::Pos2::new(pill_x, rect.top()),
                            egui::Vec2::new(half_width, height),
                        )
                        .shrink(theme::SPACE_XS);

                        // Pill (Shadow + Body + Stroke) via Frame
                        let pill_frame = egui::Frame::new()
                            .fill(theme::bg_elevated())
                            .corner_radius(egui::CornerRadius::same(rounding.saturating_sub(theme::ROUNDING_SM)))
                            .shadow(theme::premium_shadow(8, 20))
                            .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::border().linear_multiply(theme::OPACITY_MEDIUM)));

                        // Create a child UI placed exactly at the pill's position
                        // Scoped to avoid borrow conflicts
                        {
                            let mut pill_child_ui =
                                ui.new_child(egui::UiBuilder::new().max_rect(pill_rect));
                            pill_frame.show(&mut pill_child_ui, |ui: &mut egui::Ui| {
                                ui.allocate_space(ui.available_size());
                            });
                        }

                        // Labels
                        let left_rect = egui::Rect::from_min_size(
                            rect.min,
                            egui::Vec2::new(half_width, height),
                        );
                        let right_rect = egui::Rect::from_min_size(
                            egui::Pos2::new(rect.left() + half_width, rect.top()),
                            egui::Vec2::new(half_width, height),
                        );

                        // Click logic
                        if response.clicked()
                            && let Some(pos) = response.hover_pos()
                        {
                            if left_rect.contains(pos) {
                                self.use_qr = false;
                            } else if right_rect.contains(pos) {
                                self.use_qr = true;
                            }
                        }

                        // Text Painting
                        // Use a reference to painter to avoid closure capturing entire UI
                        let painter = ui.painter();
                        let paint_label = |text: &str, area: egui::Rect, active: bool| {
                            let color = if active {
                                theme::text_primary()
                            } else {
                                theme::text_secondary()
                            };
                            let font = if active {
                                theme::font_body()
                            } else {
                                theme::font_small()
                            };

                            painter.text(
                                area.center(),
                                egui::Align2::CENTER_CENTER,
                                text,
                                font,
                                color,
                            );
                        };

                        paint_label("Token", left_rect, !self.use_qr);
                        paint_label("QR Code", right_rect, self.use_qr);
                    }

                    ui.add_space(theme::SPACE_LG);

                    // INPUT AREA
                    let input_bg = theme::bg_tertiary();
                    let input_rounding = theme::INPUT_ROUNDING;

                    if self.use_qr {
                        // Label
                        ui.label(
                            egui::RichText::new("CONTENU DU QR CODE")
                                .font(theme::font_small())
                                .color(theme::text_tertiary()),
                        );
                        ui.add_space(theme::SPACE_XS);

                        egui::Frame::new()
                            .fill(input_bg)
                            .corner_radius(egui::CornerRadius::same(input_rounding))
                            .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::border().linear_multiply(theme::OPACITY_MODERATE)))
                            .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
                            .show(ui, |ui: &mut egui::Ui| {
                                ui.add(
                                    egui::TextEdit::multiline(&mut self.qr_input)
                                        .desired_rows(5)
                                        .desired_width(f32::INFINITY)
                                        .frame(false)
                                        .font(egui::TextStyle::Monospace)
                                        .hint_text("Collez ici..."),
                                );
                            });
                    } else {
                        // Label
                        ui.label(
                            egui::RichText::new("TOKEN D'ENRÔLEMENT")
                                .font(theme::font_small())
                                .color(theme::text_tertiary()),
                        );
                        ui.add_space(theme::SPACE_XS);

                        // Token input with security masking

                        egui::Frame::new()
                            .fill(input_bg)
                            .corner_radius(egui::CornerRadius::same(input_rounding))
                            .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::border().linear_multiply(theme::OPACITY_MODERATE)))
                            .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
                            .show(ui, |ui: &mut egui::Ui| {
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    ui.add(
                                        egui::TextEdit::singleline(&mut self.token_input)
                                            .desired_width((ui.available_width() - theme::SEGMENTED_CONTROL_HEIGHT).max(0.0)) // Space for toggle button
                                            .frame(false)
                                            .font(egui::TextStyle::Monospace)
                                            .password(!self.show_token) // Built-in password masking
                                            .hint_text("xxxxx-xxxxx-xxxxx"),
                                    );



                                    // Toggle visibility button (FA icons instead of emoji)
                                    let vis_icon = if self.show_token {
                                        icons::EYE_SLASH
                                    } else {
                                        icons::EYE
                                    };
                                    if widgets::button::icon_button(
                                        ui,
                                        vis_icon,
                                        Some(if self.show_token {
                                            "Masquer le token"
                                        } else {
                                            "Afficher le token"
                                        }),
                                    )
                                    .clicked()
                                    {
                                        self.show_token = !self.show_token;
                                    }
                                });
                            });
                        
                        // Validation feedback
                        let token = self.token_input.trim();
                        if !token.is_empty() && !TOKEN_REGEX.is_match(token) {
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new("Format invalide (attendu: xxxxx-xxxxx-xxxxx)")
                                    .font(theme::font_min())
                                    .color(theme::readable_color(theme::ERROR)),
                            );
                        }
                    }

                    ui.add_space(theme::SPACE_LG);

                    // ACTIONS
                    let is_valid = if self.use_qr {
                        !self.qr_input.trim().is_empty()
                    } else {
                        let token = self.token_input.trim();
                        !token.is_empty() && TOKEN_REGEX.is_match(token)
                    };

                    ui.add_enabled_ui(is_valid, |ui: &mut egui::Ui| {
                        let btn_txt = egui::RichText::new("ENRÔLER L'AGENT").font(theme::font_body()).strong();
                        // Custom Hero Button Loop
                        // Use corner_radius instead of rounding which is deprecated
                        let btn = ui.add_sized(
                            egui::Vec2::new(ui.available_width(), theme::BUTTON_HEIGHT_LG),
                            egui::Button::new(btn_txt)
                                .fill(theme::ACCENT)
                                .corner_radius(egui::CornerRadius::same(theme::ROUNDING_LG)),
                        );

                        if btn.clicked() {
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

                    ui.add_space(theme::SPACE_MD);

                    // AUTH LINKS FOOTER
                    ui.vertical_centered(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("Pas de token ?")
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        );
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.spacing_mut().item_spacing.x = theme::SPACE_SM;
                            let link_attr = egui::RichText::new("Se connecter")
                                .font(theme::font_small())
                                .color(theme::accent_text());
                            if ui.link(link_attr).clicked() {
                                ui.ctx().open_url(egui::OpenUrl::new_tab(
                                    "https://app.cyber-threat-consulting.com/login",
                                ));
                            }
                            ui.label(egui::RichText::new("•").color(theme::text_tertiary()));
                            let link_attr_reg = egui::RichText::new("Créer un compte")
                                .font(theme::font_small())
                                .color(theme::accent_text());
                            if ui.link(link_attr_reg).clicked() {
                                ui.ctx().open_url(egui::OpenUrl::new_tab(
                                    "https://app.cyber-threat-consulting.com/register",
                                ));
                            }
                        });
                    });
                }); // End Glass Card
        });

        command
    }

    fn show_progress(ui: &mut Ui, message: &str) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.set_max_width(theme::ENROLLMENT_CARD_WIDTH);
            ui.vertical_centered(|ui: &mut egui::Ui| {
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

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.set_max_width(theme::ENROLLMENT_CARD_WIDTH);
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.add_space(theme::SPACE_LG);

                if success {
                    ui.label(
                        egui::RichText::new(icons::CIRCLE_CHECK)
                            .font(egui::FontId::proportional(theme::ENROLLMENT_HERO_ICON))
                            .color(theme::readable_color(theme::SUCCESS)),
                    );
                    ui.add_space(theme::SPACE);
                    ui.label(
                        egui::RichText::new("Enrôlement réussi !")
                            .font(theme::font_card_value())
                            .color(theme::readable_color(theme::SUCCESS))
                            .strong(),
                    );
                } else {
                    ui.label(
                        egui::RichText::new(icons::CIRCLE_XMARK)
                            .font(egui::FontId::proportional(theme::ENROLLMENT_HERO_ICON))
                            .color(theme::readable_color(theme::ERROR)),
                    );
                    ui.add_space(theme::SPACE);
                    ui.label(
                        egui::RichText::new("Échec de l'enrôlement")
                            .font(theme::font_card_value())
                            .color(theme::readable_color(theme::ERROR))
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

                if widgets::button::primary_button(ui, btn_text, true).clicked() {
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
            ("Enrôlement", EnrollmentStep::InProgress),
            (
                "Terminé",
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

        ui.horizontal(|ui: &mut egui::Ui| {
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
