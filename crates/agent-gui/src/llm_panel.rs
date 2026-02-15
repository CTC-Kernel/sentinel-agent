//! LLM / AI integration panel for the GUI.
//!
//! When the LLM engine is not connected, a premium empty state is shown
//! describing the upcoming feature. The panel is always compiled regardless
//! of feature flags.

use crate::icons;
use crate::theme;
use crate::widgets;

/// LLM management panel for the GUI.
#[derive(Default, Clone)]
pub struct LLMPanel;

impl LLMPanel {
    /// Show the LLM / AI panel.
    pub fn show(&mut self, ui: &mut egui::Ui) {
        ui.add_space(theme::SPACE_MD);

        widgets::page_header(
            ui,
            "Intelligence Artificielle",
            Some("MODULE D'ANALYSE IA ET RECOMMANDATIONS AUTOMATIQUES"),
            None,
        );

        ui.add_space(theme::SPACE_MD);
        ui.separator();
        ui.add_space(theme::SPACE_LG);

        // Currently no LLM engine is connected -- show premium empty state.
        self.show_empty_state(ui);
    }

    /// Render the premium empty state when the AI engine is not available.
    fn show_empty_state(&self, ui: &mut egui::Ui) {
        widgets::empty_state(
            ui,
            icons::BRAIN,
            "Module IA en cours de d\u{00e9}ploiement",
            Some(
                "L'assistant IA analysera automatiquement vos r\u{00e9}sultats de conformit\u{00e9} \
                 et proposera des rem\u{00e9}diations intelligentes.",
            ),
        );

        // Feature preview cards
        ui.add_space(theme::SPACE_LG);

        ui.vertical_centered(|ui: &mut egui::Ui| {
            ui.set_max_width(600.0);

            ui.label(
                egui::RichText::new("FONCTIONNALIT\u{00c9}S \u{00c0} VENIR")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .strong(),
            );

            ui.add_space(theme::SPACE_MD);

            Self::feature_card(
                ui,
                icons::SEARCH,
                "Analyse de s\u{00e9}curit\u{00e9}",
                "\u{00c9}valuation automatique du niveau de risque et identification des vuln\u{00e9}rabilit\u{00e9}s prioritaires.",
            );

            ui.add_space(theme::SPACE_SM);

            Self::feature_card(
                ui,
                icons::WRENCH_FA,
                "Plans de rem\u{00e9}diation",
                "G\u{00e9}n\u{00e9}ration de plans d'action d\u{00e9}taill\u{00e9}s avec commandes et \u{00e9}tapes de v\u{00e9}rification.",
            );

            ui.add_space(theme::SPACE_SM);

            Self::feature_card(
                ui,
                icons::SHIELD,
                "Classification de menaces",
                "Cat\u{00e9}gorisation intelligente des \u{00e9}v\u{00e9}nements de s\u{00e9}curit\u{00e9} par niveau de criticit\u{00e9}.",
            );
        });
    }

    /// Render a single feature preview card.
    fn feature_card(ui: &mut egui::Ui, icon: &str, title: &str, description: &str) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icon)
                        .size(theme::ICON_MD)
                        .color(theme::ACCENT.linear_multiply(theme::OPACITY_MEDIUM)),
                );
                ui.add_space(theme::SPACE_SM);
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(title)
                            .font(theme::font_body())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new(description)
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );
                });
            });
        });
    }
}

/// LLM status widget for the main dashboard.
#[derive(Default)]
pub struct LLMStatusWidget;

impl LLMStatusWidget {
    /// Show compact LLM status on the dashboard.
    pub fn show(&self, ui: &mut egui::Ui) {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(icons::BRAIN)
                    .size(theme::ICON_SM)
                    .color(theme::text_tertiary()),
            );
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new("IA:")
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
            );
            ui.label(
                egui::RichText::new("En attente")
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
            );
        });
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
}
