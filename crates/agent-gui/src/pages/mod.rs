// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Application pages.

pub(crate) mod about;
mod assets;
mod audit_trail;
pub mod cartography;
mod compliance;
mod dashboard;
mod discovery;
mod fim;
mod monitoring;
mod network;
mod notifications;
mod reports;
mod risks;
mod settings;
mod software;
mod sync;
mod terminal;
mod threats;
mod vulnerabilities;

pub use about::AboutPage;
pub use assets::AssetsPage;
pub use audit_trail::AuditTrailPage;
pub use cartography::CartographyPage;
pub use compliance::CompliancePage;
pub use dashboard::{DashboardAction, DashboardPage};
pub use discovery::DiscoveryPage;
pub use fim::FimPage;
pub use monitoring::MonitoringPage;
pub use network::NetworkPage;
pub use notifications::NotificationsPage;
pub use reports::ReportsPage;
pub use risks::RisksPage;
pub use settings::SettingsPage;
pub use software::SoftwarePage;
pub use sync::SyncPage;
pub use terminal::TerminalPage;
pub use threats::ThreatsPage;
pub use vulnerabilities::VulnerabilitiesPage;

/// Compact operational shortcuts; each destination keeps its exact working view.
pub(crate) fn security_navigation(ui: &mut egui::Ui, state: &mut crate::state::AppState) {
    use crate::{app::Page, dto::EdrTab, theme, widgets};
    let destinations = [
        (
            "Alertes & événements",
            "Consulter, filtrer et acquitter les événements de sécurité.",
            0,
        ),
        (
            "Autorisations",
            "Gérer les exceptions IP, processus, fichiers et USB.",
            1,
        ),
        (
            "Acquittements",
            "Retrouver les événements déjà pris en charge.",
            2,
        ),
        (
            "Règles d’alerte",
            "Configurer les déclencheurs et les notifications.",
            3,
        ),
    ];
    ui.push_id("security_navigation", |ui| {
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing = egui::vec2(theme::SPACE_SM, theme::SPACE_XS);
            for (title, description, target) in &destinations {
                if widgets::button::ghost_button(ui, format!("{title}  →"))
                    .on_hover_text(*description)
                    .clicked()
                {
                    state.threats.selected_threat = None;
                    state.threats.detail_open = false;
                    state.threats.events_page = 0;
                    state.threats.search.clear();
                    state.threats.events_severity_filter = None;
                    state.threats.events_status_filter = if *target == 2 { 2 } else { 1 };
                    if *target == 3 {
                        state.notifications_active_tab = 1;
                        state.pending_navigation = Some(Page::Notifications);
                    } else {
                        state.threats.active_tab = if *target == 1 {
                            EdrTab::Authorizations
                        } else {
                            EdrTab::Events
                        };
                        state.pending_navigation = Some(Page::Threats);
                    }
                }
            }
        });
    });
}
