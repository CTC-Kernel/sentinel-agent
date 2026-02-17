//! EDR module — Detection, Investigation & Response.

mod events;
mod investigation;
mod mitre;
mod overview;
mod response;
mod timeline;
mod types;

use egui::Ui;

use crate::app::AppState;
use crate::dto::EdrTab;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::tabs::{Tab, TabBar};

pub struct ThreatsPage;

impl ThreatsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Sys & Network", "EDR"],
            "D\u{00e9}tection & R\u{00e9}ponse",
            Some("MODULE EDR \u{2014} D\u{00c9}TECTION, INVESTIGATION ET R\u{00c9}PONSE AUX MENACES"),
            Some(
                "Surveillez les menaces en temps r\u{00e9}el, investiguez les indicateurs de compromission et d\u{00e9}clenchez des actions de r\u{00e9}ponse.",
            ),
        );
        ui.add_space(theme::SPACE_MD);

        // ── Tab bar with badges ─────────────────────────────────────
        let total_events = state.threats.suspicious_processes.len()
            + state.threats.usb_events.len()
            + state.threats.system_incidents.len()
            + state.fim.alerts.len()
            + state.network.alerts.len()
            + state.vulnerability_findings.len();

        let pending_response = state.threats.pending_actions.iter()
            .filter(|a| matches!(a.status, crate::dto::ResponseStatus::Pending | crate::dto::ResponseStatus::InProgress))
            .count() as u32;

        let selected_idx = match state.threats.active_tab {
            EdrTab::Overview => 0,
            EdrTab::Events => 1,
            EdrTab::Investigation => 2,
            EdrTab::Response => 3,
        };

        let mut event_tab = Tab::new("\u{00c9}V\u{00c9}NEMENTS").icon(icons::LIST);
        if total_events > 0 {
            event_tab = event_tab.badge(total_events.min(999) as u32);
        }
        let mut response_tab = Tab::new("R\u{00c9}PONSE").icon(icons::SHIELD);
        if pending_response > 0 {
            response_tab = response_tab.badge(pending_response);
        }

        let tabs = vec![
            Tab::new("VUE D'ENSEMBLE").icon(icons::EYE),
            event_tab,
            Tab::new("INVESTIGATION").icon(icons::SEARCH),
            response_tab,
        ];

        if let Some(new_idx) = TabBar::new(tabs, selected_idx).full_width().show(ui) {
            state.threats.active_tab = match new_idx {
                0 => EdrTab::Overview,
                1 => EdrTab::Events,
                2 => EdrTab::Investigation,
                3 => EdrTab::Response,
                _ => EdrTab::Overview,
            };
        }

        ui.add_space(theme::SPACE_LG);

        // ── Route to active tab ─────────────────────────────────────
        match state.threats.active_tab {
            EdrTab::Overview => overview::show(ui, state),
            EdrTab::Events => events::show(ui, state),
            EdrTab::Investigation => investigation::show(ui, state),
            EdrTab::Response => response::show(ui, state),
        }
    }
}
