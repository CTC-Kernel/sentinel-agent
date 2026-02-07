//! LLM integration panel for the GUI.

#[cfg(feature = "llm_simple")]
use {
    agent_llm::{LLMManager, AnalysisResult, RemediationPlan, SecurityClassification, ModelStats},
    anyhow::Result,
    std::sync::Arc,
    egui::{Color32, RichText, Stroke, Vec2},
    chrono::Local,
};

#[cfg(not(feature = "llm_simple"))]
use egui::{Color32, RichText};

/// LLM management panel for the GUI.
pub struct LLMPanel {
    #[cfg(feature = "llm_simple")]
    llm_manager: Option<Arc<LLMManager>>,
    #[cfg(feature = "llm_simple")]
    model_stats: Option<ModelStats>,
    #[cfg(feature = "llm_simple")]
    last_analysis: Option<AnalysisResult>,
    #[cfg(feature = "llm_simple")]
    last_remediation: Option<RemediationPlan>,
    #[cfg(feature = "llm_simple")]
    last_classifications: Vec<SecurityClassification>,
    #[cfg(feature = "llm_simple")]
    show_analysis: bool,
    #[cfg(feature = "llm_simple")]
    show_remediation: bool,
    #[cfg(feature = "llm_simple")]
    show_classifications: bool,
    #[cfg(feature = "llm_simple")]
    show_model_info: bool,
}

impl Default for LLMPanel {
    fn default() -> Self {
        Self {
            #[cfg(feature = "llm_simple")]
            llm_manager: None,
            #[cfg(feature = "llm_simple")]
            model_stats: None,
            #[cfg(feature = "llm_simple")]
            last_analysis: None,
            #[cfg(feature = "llm_simple")]
            last_remediation: None,
            #[cfg(feature = "llm_simple")]
            last_classifications: Vec::new(),
            #[cfg(feature = "llm_simple")]
            show_analysis: false,
            #[cfg(feature = "llm_simple")]
            show_remediation: false,
            #[cfg(feature = "llm_simple")]
            show_classifications: false,
            #[cfg(feature = "llm_simple")]
            show_model_info: false,
        }
    }
}

impl LLMPanel {
    /// Create new LLM panel.
    #[cfg(feature = "llm_simple")]
    pub fn new(llm_manager: Option<Arc<LLMManager>>) -> Self {
        let mut panel = Self {
            llm_manager,
            ..Default::default()
        };
        panel.refresh_model_stats();
        panel
    }

    /// Create new LLM panel without LLM support.
    #[cfg(not(feature = "llm_simple"))]
    pub fn new() -> Self {
        Self::default()
    }

    /// Set LLM manager.
    #[cfg(feature = "llm_simple")]
    pub fn set_llm_manager(&mut self, llm_manager: Option<Arc<LLMManager>>) {
        self.llm_manager = llm_manager;
        self.refresh_model_stats();
    }

    /// Update analysis results.
    #[cfg(feature = "llm_simple")]
    pub fn update_analysis(&mut self, analysis: AnalysisResult) {
        self.last_analysis = Some(analysis);
        self.show_analysis = true;
    }

    /// Update remediation plan.
    #[cfg(feature = "llm_simple")]
    pub fn update_remediation(&mut self, plan: RemediationPlan) {
        self.last_remediation = Some(plan);
        self.show_remediation = true;
    }

    /// Update security classifications.
    #[cfg(feature = "llm_simple")]
    pub fn update_classifications(&mut self, classifications: Vec<SecurityClassification>) {
        self.last_classifications = classifications;
        self.show_classifications = !self.last_classifications.is_empty();
    }

    /// Refresh model statistics.
    #[cfg(feature = "llm_simple")]
    pub async fn refresh_model_stats(&mut self) {
        if let Some(manager) = &self.llm_manager {
            match manager.get_stats().await {
                Ok(stats) => self.model_stats = Some(stats),
                Err(e) => tracing::warn!("Failed to get LLM stats: {}", e),
            }
        }
    }

    /// Show the LLM panel.
    pub fn show(&mut self, ui: &mut egui::Ui) {
        ui.heading("🤖 Intelligence Artificielle");
        ui.separator();

        #[cfg(feature = "llm_simple")]
        {
            self.show_model_status(ui);
            ui.separator();
            self.show_action_buttons(ui);
            ui.separator();
            self.show_results_panels(ui);
        }

        #[cfg(not(feature = "llm_simple"))]
        {
            ui.label(RichText::new("⚠️ LLM non disponible").color(Color32::YELLOW));
            ui.label("Compilez avec --features llm pour activer les fonctionnalités IA.");
        }
    }

    /// Show model status and statistics.
    #[cfg(feature = "llm_simple")]
    fn show_model_status(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label("Status du modèle:");
            
            if let Some(stats) = &self.model_stats {
                let status_color = match stats.status {
                    Color32::GREEN => Color32::GREEN,
                    Color32::YELLOW => Color32::YELLOW,
                    Color32::RED => Color32::RED,
                    _ => Color32::GRAY,
                };

                ui.label(RichText::new(format!("{:?}", stats.status)).color(status_color));
                ui.separator();
                ui.label(format!("Inférences: {}", stats.inference_count));
                ui.separator();
                ui.label(format!("Mémoire: {}MB", stats.memory_usage.allocated_mb));
            } else {
                ui.label(RichText::new("Non initialisé").color(Color32::GRAY));
            }

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.button("🔄").on_hover_text("Rafraîchir").clicked() {
                    // Trigger async refresh - in real implementation would use proper async handling
                }
                if ui.button("ℹ️").on_hover_text("Informations").clicked() {
                    self.show_model_info = !self.show_model_info;
                }
            });
        });

        // Show model info popup
        if self.show_model_info {
            self.show_model_info_popup(ui);
        }
    }

    /// Show model information popup.
    #[cfg(feature = "llm_simple")]
    fn show_model_info_popup(&mut self, ui: &mut egui::Ui) {
        let popup_id = egui::Id::new("llm_model_info");
        
        egui::Window::new("Informations du Modèle")
            .id(popup_id)
            .collapsible(false)
            .resizable(false)
            .default_size(Vec2::new(400.0, 300.0))
            .show(ui.ctx(), |ui| {
                if let Some(stats) = &self.model_stats {
                    ui.label(format!("Modèle: {}", stats.model_name));
                    ui.label(format!("Status: {:?}", stats.status));
                    ui.label(format!("Inférences totales: {}", stats.inference_count));
                    
                    ui.separator();
                    ui.heading("Utilisation Mémoire:");
                    ui.label(format!("Allouée: {}MB", stats.memory_usage.allocated_mb));
                    ui.label(format!("Pic: {}MB", stats.memory_usage.peak_mb));
                    ui.label(format!("Disponible: {}MB", stats.memory_usage.available_mb));
                } else {
                    ui.label("Aucune information disponible");
                }
                
                ui.separator();
                if ui.button("Fermer").clicked() {
                    self.show_model_info = false;
                }
            });
        }

    /// Show action buttons.
    #[cfg(feature = "llm_simple")]
    fn show_action_buttons(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label("Actions:");
            
            if ui.button("🔍 Analyser").clicked() {
                // Trigger analysis - would send command to backend
                tracing::info!("LLM analysis requested from GUI");
            }
            
            if ui.button("🔧 Remédiation").clicked() {
                // Trigger remediation - would send command to backend
                tracing::info!("LLM remediation requested from GUI");
            }
            
            if ui.button("🛡️ Classification").clicked() {
                // Trigger classification - would send command to backend
                tracing::info!("LLM classification requested from GUI");
            }
        });
    }

    /// Show results panels.
    #[cfg(feature = "llm_simple")]
    fn show_results_panels(&mut self, ui: &mut egui::Ui) {
        // Analysis results
        if let Some(analysis) = &self.last_analysis {
            ui.collapsing("📊 Analyse de Sécurité", |ui| {
                self.show_analysis_results(ui, analysis);
            });
        }

        // Remediation plan
        if let Some(plan) = &self.last_remediation {
            ui.collapsing("🔧 Plan de Remédiation", |ui| {
                self.show_remediation_plan(ui, plan);
            });
        }

        // Security classifications
        if !self.last_classifications.is_empty() {
            ui.collapsing("🛡️ Classifications de Sécurité", |ui| {
                self.show_security_classifications(ui);
            });
        }
    }

    /// Show analysis results.
    #[cfg(feature = "llm_simple")]
    fn show_analysis_results(&self, ui: &mut egui::Ui, analysis: &AnalysisResult) {
        ui.horizontal(|ui| {
            ui.label("Niveau de Risque:");
            let risk_color = match analysis.risk_level.as_str() {
                "low" => Color32::GREEN,
                "medium" => Color32::YELLOW,
                "high" => Color32::ORANGE,
                "critical" => Color32::RED,
                _ => Color32::GRAY,
            };
            ui.label(RichText::new(format!("{:?}", analysis.risk_level)).color(risk_color));
            ui.separator();
            ui.label(format!("Score: {}/100", analysis.confidence * 100.0));
        });

        ui.separator();
        ui.label("Description:");
        ui.label(&analysis.evidence.join(" "));

        if !analysis.recommendations.is_empty() {
            ui.separator();
            ui.heading("Issues Prioritaires:");
            for issue in &analysis.recommendations {
                ui.horizontal(|ui| {
                    let severity_color = match "medium" {
                        "Low" => Color32::GREEN,
                        "Medium" => Color32::YELLOW,
                        "High" => Color32::ORANGE,
                        "Critical" => Color32::RED,
                        _ => Color32::GRAY,
                    };
                    ui.label(RichText::new("medium").color(severity_color));
                    ui.label(issue.clone());
                });
                ui.indent(1, |ui| {
                    ui.label(issue.clone());
                    ui.label(format!("Impact: {}", "high"));
                });
            }
        }

        if !analysis.recommendations.is_empty() {
            ui.separator();
            ui.heading("Recommandations:");
            for rec in &analysis.recommendations {
                ui.horizontal(|ui| {
                    ui.label(format!("• {}", rec));
                    ui.label(format!("({})", "high"));
                });
                ui.indent(1, |ui| {
                    ui.label(rec);
                });
            }
        }
    }

    /// Show remediation plan.
    #[cfg(feature = "llm_simple")]
    fn show_remediation_plan(&self, ui: &mut egui::Ui, plan: &RemediationPlan) {
        ui.label(&plan.description);
        ui.horizontal(|ui| {
            ui.label(format!("Actions: {}", plan.actions.len()));
            ui.label(format!("Durée estimée: {}", plan.estimated_total_duration));
        });

        for (i, action) in plan.actions.iter().enumerate() {
            ui.collapsing(format!("{}. {}", i + 1, action.title), |ui| {
                ui.label(&action.description);
                
                ui.horizontal(|ui| {
                    let priority_color = match action.priority {
                        "critical" => Color32::RED,
                _ => Color32::GRAY,
                        "high" => Color32::ORANGE,
                        "medium" => Color32::YELLOW,
                        "low" => Color32::GREEN,
                    };
                    ui.label(RichText::new(format!("Priorité: {:?}", action.priority)).color(priority_color));
                    ui.label(format!("Durée: {}", action.estimated_duration));
                });

                if !action.commands.is_empty() {
                    ui.collapsing("Commandes", |ui| {
                        for cmd in &action.commands {
                            ui.monospace(cmd);
                        }
                    });
                }

                if !action.verification_steps.is_empty() {
                    ui.collapsing("Vérification", |ui| {
                        for (i, step) in action.verification_steps.iter().enumerate() {
                            ui.label(format!("{}. {}", i + 1, step));
                        }
                    });
                }
            });
        }
    }

    /// Show security classifications.
    #[cfg(feature = "llm_simple")]
    fn show_security_classifications(&self, ui: &mut egui::Ui) {
        for classification in &self.last_classifications {
            ui.horizontal(|ui| {
                let threat_color = match classification.threat_level {
                    "low" => Color32::GREEN,
                    "medium" => Color32::YELLOW,
                    "high" => Color32::ORANGE,
                    "critical" => Color32::RED,
                _ => Color32::GRAY,
                };
                ui.label(RichText::new(format!("{:?}", classification.threat_type)).color(threat_color));
                ui.label(format!("Confiance: {}%", classification.confidence));
                ui.separator();
                ui.label(&classification.impact_assessment);
            });
        }
    }
}

/// LLM status widget for the main dashboard.
pub struct LLMStatusWidget {
    #[cfg(feature = "llm_simple")]
    llm_manager: Option<Arc<LLMManager>>,
}

impl Default for LLMStatusWidget {
    fn default() -> Self {
        Self {
            #[cfg(feature = "llm_simple")]
            llm_manager: None,
        }
    }
}

impl LLMStatusWidget {
    #[cfg(feature = "llm_simple")]
    pub fn new(llm_manager: Option<Arc<LLMManager>>) -> Self {
        Self { llm_manager }
    }

    #[cfg(not(feature = "llm_simple"))]
    pub fn new() -> Self {
        Self::default()
    }

    /// Show compact LLM status.
    pub fn show(&self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label("🤖 IA:");
            
            #[cfg(feature = "llm_simple")]
            {
                if let Some(manager) = &self.llm_manager {
                    // In real implementation, would check status asynchronously
                    ui.label(RichText::new("Prêt").color(Color32::GREEN));
                } else {
                    ui.label(RichText::new("Non configuré").color(Color32::GRAY));
                }
            }

            #[cfg(not(feature = "llm_simple"))]
            {
                ui.label(RichText::new("Désactivé").color(Color32::GRAY));
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_panel_creation() {
        let _panel = LLMPanel::default();
        // Fields show_analysis/show_remediation/show_classifications only exist with llm_simple feature
    }

    #[test]
    fn test_llm_status_widget() {
        let _widget = LLMStatusWidget::default();
        // Widget creation test - actual rendering would need egui context
    }
}
