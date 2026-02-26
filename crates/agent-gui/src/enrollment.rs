//! Enrollment wizard -- 4-step onboarding flow.
//!
//! Steps:
//! 1. Welcome
//! 2. Authentication (token or QR scan)
//! 3. Progress
//! 4. Completion

use egui::Ui;

use crate::icons;
use crate::theme;
use crate::widgets;
use std::sync::LazyLock;
use regex::Regex;

static TOKEN_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-zA-Z0-9]{5}(?:-[a-zA-Z0-9]{5}){2,}$").unwrap());

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
    pub show_token: bool, // Toggle for token visibility
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
            progress_message: "Connecting to server...".to_string(),
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

                    // Premium glow effect behind/around logo
                    if is_dark {
                        let center = image_response.rect.center();
                        let radius = theme::ENROLLMENT_GLOW_RADIUS;
                        
                        // Multi-layered glow for AAA feel
                        for scale in [1.0, 1.5, 2.0] {
                            let color = theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE / (scale * scale));
                            ui.ctx()
                                .layer_painter(egui::LayerId::background())
                                .circle_filled(center, radius * scale, color);
                        }
                    }

                    ui.add_space(theme::SPACE_LG);

                    // Step indicator
                    Self::step_indicator(ui, &self.step);
                    ui.add_space(theme::SPACE_LG);

                    // Staggered entry for the enrollment content
                    let entry_alpha = ui.ctx().animate_value_with_time(ui.id().with("wizard_entry"), 1.0, theme::ANIM_NORMAL);
                    
                    // ScrollArea for content protection
                    egui::ScrollArea::vertical().show(ui, |ui: &mut egui::Ui| {
                        ui.set_opacity(entry_alpha);
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
            });

        // On failure retry: reset wizard to token entry instead of sending Finish to backend
        if let Some(EnrollmentCommand::Finish) = &command
            && let EnrollmentStep::Complete { success: false, .. } = &self.step
        {
            self.step = EnrollmentStep::TokenEntry;
            self.token_input.clear();
            self.qr_input.clear();
            return None; // Don't send Finish to backend — stay in enrollment loop
        }

        command
    }

    fn show_admin_setup(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XL);

        ui.vertical_centered(|ui: &mut egui::Ui| {
            ui.set_max_width(theme::ENROLLMENT_INPUT_WIDTH);

            let card_bg = theme::bg_secondary();
            let card_stroke = egui::Stroke::new(theme::BORDER_THIN, theme::border());

            egui::Frame::new()
                .fill(card_bg)
                .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
                .stroke(card_stroke)
                .inner_margin(egui::Margin::same(theme::SPACE_XL as i8))
                .show(ui, |ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("ADMIN CONFIGURATION")
                            .font(theme::font_heading())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new("Define the administrative password for this agent.")
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );

                    ui.add_space(theme::SPACE_LG);

                    // Default password toggle
                    ui.checkbox(&mut self.use_default_password, "Use default password (agent_admin)");
                    
                    if !self.use_default_password {
                        ui.add_space(theme::SPACE_MD);
                        ui.label(
                            egui::RichText::new("CUSTOM PASSWORD")
                                .font(theme::font_small())
                                .color(theme::text_tertiary()),
                        );
                        ui.add_space(theme::SPACE_XS);

                        let input_bg = theme::bg_tertiary();
                        egui::Frame::new()
                            .fill(input_bg)
                            .corner_radius(egui::CornerRadius::same(theme::INPUT_ROUNDING))
                            .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::border().linear_multiply(theme::OPACITY_MODERATE)))
                            .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
                            .show(ui, |ui: &mut egui::Ui| {
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    ui.add(
                                        egui::TextEdit::singleline(&mut self.admin_password)
                                            .desired_width((ui.available_width() - 40.0).max(0.0))
                                            .frame(false)
                                            .font(egui::TextStyle::Monospace)
                                            .password(!self.show_password)
                                            .hint_text("Enter secure password"),
                                    );

                                    let vis_icon = if self.show_password { icons::EYE_SLASH } else { icons::EYE };
                                    if widgets::button::icon_button(ui, vis_icon, None).clicked() {
                                        self.show_password = !self.show_password;
                                    }
                                });
                            });
                    }

                    ui.add_space(theme::SPACE_LG);

                    // Actions
                    ui.horizontal(|ui: &mut egui::Ui| {
                        if widgets::button::secondary_button(ui, "Back", true).clicked() {
                            self.step = EnrollmentStep::TokenEntry;
                        }

                        let is_valid = self.use_default_password || !self.admin_password.trim().is_empty();
                        ui.add_enabled_ui(is_valid, |ui: &mut egui::Ui| {
                            if widgets::button::primary_button(ui, "ENROLL AGENT", true).clicked() {
                                let token = self.token_input.trim().to_string();
                                let password = if self.use_default_password {
                                    None
                                } else {
                                    Some(self.admin_password.trim().to_string())
                                };
                                
                                self.step = EnrollmentStep::InProgress;
                                self.progress_message = "Connecting to server...".to_string();
                                command = Some(EnrollmentCommand::SubmitEnrollment { token, admin_password: password });
                            }
                        });
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

        command
    }

    fn show_token_entry(&mut self, ui: &mut Ui) -> Option<EnrollmentCommand> {
        let command = None;

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
                        egui::RichText::new("AUTHENTICATION")
                            .font(theme::font_heading())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new("Link this agent to your Sentinel GRC console.")
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
                        let anim_duration = if theme::is_reduced_motion() {
                            0.0
                        } else {
                            theme::ANIM_NORMAL
                        };
                        let pill_x = ui.ctx().animate_value_with_time(
                            response.id.with("pill_x"),
                            target_x,
                            anim_duration,
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
                            .shadow(theme::shadow_md()) // Use our new AAA layered shadow
                            .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::border().linear_multiply(theme::OPACITY_MEDIUM)));

                        // Create a child UI placed exactly at the pill's position
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
                            && let Some(pos) = response.interact_pointer_pos()
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
                            egui::RichText::new("QR CODE CONTENT")
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
                                        .hint_text("Paste here..."),
                                );
                            });
                    } else {
                        // Label
                        ui.label(
                            egui::RichText::new("ENROLLMENT TOKEN")
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
                                            "Hide token"
                                        } else {
                                            "Show token"
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
                                egui::RichText::new("Invalid format (expected: xxxxx-xxxxx-xxxxx)")
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
                        let btn_txt = egui::RichText::new("ENROLL AGENT").font(theme::font_body()).strong();
                        // Custom Hero Button Loop
                        let btn = ui.add_sized(
                            egui::Vec2::new(ui.available_width(), theme::BUTTON_HEIGHT_LG),
                            egui::Button::new(btn_txt)
                                .fill(theme::ACCENT)
                                .corner_radius(egui::CornerRadius::same(theme::ROUNDING_LG)),
                        );

                        if btn.clicked() {
                            self.step = EnrollmentStep::AdminSetup;
                        }
                    });

                    ui.add_space(theme::SPACE_MD);

                    // AUTH LINKS FOOTER
                    ui.vertical_centered(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("No token?")
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        );
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.spacing_mut().item_spacing.x = theme::SPACE_SM;
                            let link_attr = egui::RichText::new("Login")
                                .font(theme::font_small())
                                .color(theme::accent_text());
                            if ui.link(link_attr).clicked() {
                                ui.ctx().open_url(egui::OpenUrl::new_tab(
                                    format!("{}/login", crate::pages::about::branding::CONSOLE),
                                ));
                            }
                            ui.label(egui::RichText::new("•").color(theme::text_tertiary()));
                            let link_attr_reg = egui::RichText::new("Create account")
                                .font(theme::font_small())
                                .color(theme::accent_text());
                            if ui.link(link_attr_reg).clicked() {
                                ui.ctx().open_url(egui::OpenUrl::new_tab(
                                    format!("{}/register", crate::pages::about::branding::CONSOLE),
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
                if theme::is_reduced_motion() {
                    ui.label(
                        egui::RichText::new(icons::SYNC)
                            .size(theme::ICON_XL)
                            .color(theme::accent_text()),
                    );
                } else {
                    ui.spinner();
                }
                ui.add_space(theme::SPACE);
                ui.label(
                    egui::RichText::new(message)
                        .font(theme::font_body())
                        .color(theme::text_primary()),
                );
                ui.add_space(theme::SPACE);
                ui.label(
                    egui::RichText::new("Please wait...")
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
                        egui::RichText::new("Enrollment successful!")
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
                        egui::RichText::new("Enrollment failed")
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

                ui.add_space(theme::SPACE_LG);

                let btn_text = if success { "Continue" } else { "Retry" };

                if widgets::button::primary_button(ui, btn_text, true).clicked() {
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

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.spacing_mut().item_spacing.x = theme::SPACE_SM;
            
            for (i, label) in step_labels.iter().enumerate() {
                let is_past = i < current_idx;
                let is_current = i == current_idx;
                
                let color = if is_past {
                    theme::SUCCESS
                } else if is_current {
                    theme::ACCENT
                } else {
                    theme::text_tertiary()
                };

                // Node
                ui.vertical_centered(|ui| {
                    ui.label(
                        egui::RichText::new(if is_past { icons::CIRCLE_CHECK } else { icons::CIRCLE })
                            .font(theme::font_small())
                            .color(color),
                    );
                    let label_text = {
                        let rt = egui::RichText::new(*label)
                            .font(theme::font_min())
                            .color(color);
                        if is_current { rt.strong() } else { rt }
                    };
                    ui.label(label_text);
                });

                // Line separator
                if i < step_labels.len() - 1 {
                    let line_color = if is_past { theme::SUCCESS } else { theme::border() };
                    ui.add_space(theme::SPACE_XS);
                    let (rect, _) = ui.allocate_exact_size(egui::Vec2::new(32.0, 2.0), egui::Sense::hover());
                    ui.painter().rect_filled(
                        rect.translate(egui::Vec2::new(0.0, -8.0)), // Align with icons
                        egui::CornerRadius::ZERO,
                        line_color,
                    );
                    ui.add_space(theme::SPACE_XS);
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
