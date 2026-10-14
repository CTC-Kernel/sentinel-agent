// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Inventory of the endpoint: accounts, groups, services and listening
//! ports as the agent last collected them, and what changed in them.
//!
//! The agent takes the inventory every ten minutes (`system_inventory`
//! option); a change an intruder leaves behind (an account, an
//! administration group member, a service, a listening port) also raises an
//! incident, shown in the threats.

use crate::app::AppState;
use crate::dto::{
    GuiInventoryAccount, GuiInventoryChange, GuiInventoryGroup, GuiInventoryPort,
    GuiInventoryService, GuiSystemInventory,
};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use egui::Ui;

/// Rows of one table page.
const ROWS_PER_PAGE: usize = 25;

/// The tabs of the page, in order.
const TABS: [&str; 5] = [
    "Comptes",
    "Groupes",
    "Services",
    "Ports en écoute",
    "Changements",
];

pub struct SystemInventoryPage;

/// Whether `needle` (already upper-case) appears in one of `fields`.
fn found(needle: &str, fields: &[&str]) -> bool {
    needle.is_empty()
        || fields
            .iter()
            .any(|field| field.to_uppercase().contains(needle))
}

fn filtered_accounts(accounts: &[GuiInventoryAccount], needle: &str) -> Vec<usize> {
    (0..accounts.len())
        .filter(|&i| {
            let a = &accounts[i];
            found(
                needle,
                &[
                    &a.name,
                    &a.id,
                    a.home.as_deref().unwrap_or(""),
                    a.shell.as_deref().unwrap_or(""),
                ],
            )
        })
        .collect()
}

fn filtered_groups(groups: &[GuiInventoryGroup], needle: &str) -> Vec<usize> {
    (0..groups.len())
        .filter(|&i| {
            let g = &groups[i];
            found(needle, &[&g.name, g.id.as_deref().unwrap_or("")])
                || g.members.iter().any(|member| found(needle, &[member]))
        })
        .collect()
}

fn filtered_services(services: &[GuiInventoryService], needle: &str) -> Vec<usize> {
    (0..services.len())
        .filter(|&i| {
            let s = &services[i];
            found(
                needle,
                &[&s.name, &s.state, s.command.as_deref().unwrap_or("")],
            )
        })
        .collect()
}

fn filtered_ports(ports: &[GuiInventoryPort], needle: &str) -> Vec<usize> {
    (0..ports.len())
        .filter(|&i| {
            let p = &ports[i];
            found(
                needle,
                &[
                    &p.protocol,
                    &p.address,
                    &p.port.to_string(),
                    p.process.as_deref().unwrap_or(""),
                ],
            )
        })
        .collect()
}

fn filtered_changes(changes: &[GuiInventoryChange], needle: &str) -> Vec<usize> {
    (0..changes.len())
        .filter(|&i| found(needle, &[&changes[i].label]))
        .collect()
}

/// The rows of the active tab that match the search.
fn rows_of(inventory: &GuiSystemInventory, tab: usize, needle: &str) -> Vec<usize> {
    match tab {
        0 => filtered_accounts(&inventory.accounts, needle),
        1 => filtered_groups(&inventory.groups, needle),
        2 => filtered_services(&inventory.services, needle),
        3 => filtered_ports(&inventory.ports, needle),
        _ => filtered_changes(&inventory.changes, needle),
    }
}

impl SystemInventoryPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Actifs & inventaire", "Comptes & services"],
            "Inventaire du poste",
            Some("Comptes, groupes, services et ports en écoute de cet hôte, et ce qui y change."),
            Some(
                "L'agent relève l'inventaire toutes les dix minutes. Un compte créé, un membre \
                 ajouté à un groupe d'administration, un service installé ou un port qui se met \
                 à écouter lève en plus un incident, visible dans Menaces.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        let Some(inventory) = state.system_inventory.inventory.clone() else {
            widgets::data_card(ui, "Inventaire du poste", |ui: &mut egui::Ui| {
                let detail = if state.summary.detection.system_inventory {
                    "Le premier relevé arrive dans la minute qui suit le démarrage de l'agent, \
                     puis toutes les dix minutes."
                } else {
                    "L'inventaire du poste est désactivé : activez-le dans Paramètres, \
                     Détection et conformité."
                };
                widgets::empty_state(
                    ui,
                    icons::USERS,
                    "Inventaire pas encore relevé",
                    Some(detail),
                );
            });
            return None;
        };

        Self::summary(ui, state, &inventory);
        ui.add_space(theme::SPACE_MD);

        let tabs: Vec<widgets::Tab> = TABS
            .iter()
            .zip([
                icons::USER,
                icons::USERS,
                icons::SERVER,
                icons::NETWORK,
                icons::CLOCK,
            ])
            .map(|(label, icon)| widgets::Tab::new(label).icon(icon))
            .collect();
        if let Some(tab) = widgets::TabBar::new(tabs, state.system_inventory.active_tab).show(ui)
            && tab != state.system_inventory.active_tab
        {
            state.system_inventory.active_tab = tab;
            state.system_inventory.page = 0;
        }
        ui.add_space(theme::SPACE_MD);

        let tab = state.system_inventory.active_tab.min(TABS.len() - 1);
        let needle = state.system_inventory.search.trim().to_uppercase();
        let rows = rows_of(&inventory, tab, &needle);
        let placeholder = match tab {
            0 => "Rechercher un compte, un identifiant, un shell…",
            1 => "Rechercher un groupe ou un membre…",
            2 => "Rechercher un service ou une commande…",
            3 => "Rechercher un port, une adresse ou un programme…",
            _ => "Rechercher un changement…",
        };
        let _ = widgets::SearchFilterBar::new(&mut state.system_inventory.search, placeholder)
            .result_count(rows.len())
            .show(ui);
        ui.add_space(theme::SPACE_SM);

        widgets::data_card(ui, TABS[tab], |ui: &mut egui::Ui| {
            if rows.is_empty() {
                let (title, detail) = if needle.is_empty() {
                    match tab {
                        4 => (
                            "Aucun changement",
                            "Rien n'a changé dans l'inventaire depuis le démarrage de l'agent.",
                        ),
                        _ => (
                            "Rien de relevé",
                            "Le système n'a rien donné pour cette partie de l'inventaire.",
                        ),
                    }
                } else {
                    ("Aucun résultat", "Ajustez votre recherche.")
                };
                widgets::empty_state(ui, icons::SEARCH, title, Some(detail));
                return;
            }
            let (start, len, _) =
                widgets::page_window(rows.len(), ROWS_PER_PAGE, &mut state.system_inventory.page);
            let page = &rows[start..start + len];
            match tab {
                0 => Self::accounts_table(ui, &inventory.accounts, page),
                1 => Self::groups_table(ui, &inventory.groups, page),
                2 => Self::services_table(ui, &inventory.services, page),
                3 => Self::ports_table(ui, &inventory.ports, page),
                _ => Self::changes_table(ui, &inventory.changes, page),
            }
            widgets::paginate_controls(
                ui,
                rows.len(),
                ROWS_PER_PAGE,
                &mut state.system_inventory.page,
            );
        });
        None
    }

    /// One card per part of the inventory; a click opens its tab.
    fn summary(ui: &mut Ui, state: &mut AppState, inventory: &GuiSystemInventory) {
        let privileged = inventory.accounts.iter().filter(|a| a.privileged).count();
        let exposed = inventory.ports.iter().filter(|p| !p.local_only).count();
        let raised = inventory
            .changes
            .iter()
            .filter(|c| c.severity.is_some())
            .count();
        let items: Vec<(usize, &str, String, egui::Color32, &str)> = vec![
            (
                0,
                "COMPTES",
                format!(
                    "{} · {} admin.",
                    crate::format::int(inventory.accounts.len() as u64),
                    privileged
                ),
                theme::INFO,
                icons::USER,
            ),
            (
                2,
                "SERVICES",
                crate::format::int(inventory.services.len() as u64),
                theme::ACCENT,
                icons::SERVER,
            ),
            (
                3,
                "PORTS EXPOSÉS",
                format!("{exposed} / {}", inventory.ports.len()),
                if exposed > 0 {
                    theme::WARNING
                } else {
                    theme::SUCCESS
                },
                icons::NETWORK,
            ),
            (
                4,
                "CHANGEMENTS",
                format!("{} · {raised} incident(s)", inventory.changes.len()),
                if raised > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::CLOCK,
            ),
        ];
        let grid = widgets::ResponsiveGrid::new(200.0, theme::SPACE_SM);
        grid.show(ui, &items, |ui, width, (tab, label, value, color, icon)| {
            if widgets::metric_card(ui, width, label, value, *color, icon) {
                state.system_inventory.active_tab = *tab;
                state.system_inventory.page = 0;
            }
        });
        if let Some(at) = inventory.collected_at {
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(format!(
                    "{}  Relevé le {}",
                    icons::INFO_CIRCLE,
                    crate::format::local_datetime(at)
                ))
                .font(theme::font_caption())
                .color(theme::text_secondary()),
            );
        }
    }

    fn accounts_table(ui: &mut Ui, accounts: &[GuiInventoryAccount], page: &[usize]) {
        use widgets::table;
        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(170.0, 2.0),
                table::Col::fluid(90.0, 1.0),
                table::Col::fluid(140.0, 1.5),
                table::Col::fluid(130.0, 0.0),
                table::Col::fluid(130.0, 0.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            for title in ["COMPTE", "IDENTIFIANT", "SHELL", "SESSION", "DROITS"] {
                header.col(|ui| {
                    table::header_cell(ui, title);
                });
            }
        })
        .body(|body| {
            body.rows(theme::TABLE_DATA_ROW_HEIGHT, page.len(), |mut row| {
                let Some(account) = page.get(row.index()).and_then(|&i| accounts.get(i)) else {
                    return;
                };
                row.col(|ui| {
                    table::cell_stack(ui, &account.name, account.home.as_deref().unwrap_or("—"));
                });
                row.col(|ui| {
                    table::cell_mono_muted(ui, &account.id);
                });
                row.col(|ui| {
                    table::cell_mono_muted(ui, account.shell.as_deref().unwrap_or("—"));
                });
                row.col(|ui| {
                    if account.can_log_in {
                        widgets::status_badge(ui, "AUTORISÉE", theme::INFO);
                    } else {
                        table::cell_muted(ui, "Aucune");
                    }
                });
                row.col(|ui| {
                    if account.privileged {
                        widgets::status_badge(ui, "ADMIN", theme::SEVERITY_HIGH);
                    } else {
                        table::cell_muted(ui, "Standard");
                    }
                });
            });
        });
    }

    fn groups_table(ui: &mut Ui, groups: &[GuiInventoryGroup], page: &[usize]) {
        use widgets::table;
        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(170.0, 1.5),
                table::Col::fluid(240.0, 4.0),
                table::Col::fluid(130.0, 0.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            for title in ["GROUPE", "MEMBRES", "DROITS"] {
                header.col(|ui| {
                    table::header_cell(ui, title);
                });
            }
        })
        .body(|body| {
            body.rows(theme::TABLE_DATA_ROW_HEIGHT, page.len(), |mut row| {
                let Some(group) = page.get(row.index()).and_then(|&i| groups.get(i)) else {
                    return;
                };
                row.col(|ui| {
                    table::cell_stack(ui, &group.name, group.id.as_deref().unwrap_or("—"));
                });
                row.col(|ui| {
                    if group.members.is_empty() {
                        table::cell_muted(ui, "Aucun membre déclaré");
                    } else {
                        table::cell_small(ui, &group.members.join(", "))
                            .on_hover_text(group.members.join("\n"));
                    }
                });
                row.col(|ui| {
                    if group.privileged {
                        widgets::status_badge(ui, "ADMIN", theme::SEVERITY_HIGH);
                    } else {
                        table::cell_muted(ui, "Standard");
                    }
                });
            });
        });
    }

    fn services_table(ui: &mut Ui, services: &[GuiInventoryService], page: &[usize]) {
        use widgets::table;
        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(200.0, 2.0),
                table::Col::fluid(110.0, 0.0),
                table::Col::fluid(240.0, 4.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            for title in ["SERVICE", "ÉTAT", "COMMANDE"] {
                header.col(|ui| {
                    table::header_cell(ui, title);
                });
            }
        })
        .body(|body| {
            body.rows(theme::TABLE_DATA_ROW_HEIGHT, page.len(), |mut row| {
                let Some(service) = page.get(row.index()).and_then(|&i| services.get(i)) else {
                    return;
                };
                row.col(|ui| {
                    table::cell(ui, &service.name);
                });
                row.col(|ui| {
                    let color = match service.state.to_ascii_lowercase().as_str() {
                        "enabled" | "auto" | "automatic" | "running" | "installed" => {
                            theme::SUCCESS
                        }
                        "disabled" | "masked" => theme::text_tertiary(),
                        _ => theme::INFO,
                    };
                    widgets::status_badge(ui, &service.state.to_uppercase(), color);
                });
                row.col(|ui| match &service.command {
                    Some(command) => {
                        table::cell_mono_muted(ui, command).on_hover_text(command);
                    }
                    None => {
                        table::cell_muted(ui, "—");
                    }
                });
            });
        });
    }

    fn ports_table(ui: &mut Ui, ports: &[GuiInventoryPort], page: &[usize]) {
        use widgets::table;
        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(100.0, 0.0),
                table::Col::fluid(150.0, 1.5),
                table::Col::fluid(180.0, 2.0),
                table::Col::fluid(120.0, 0.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            for title in ["PORT", "ADRESSE", "PROGRAMME", "EXPOSITION"] {
                header.col(|ui| {
                    table::header_cell(ui, title);
                });
            }
        })
        .body(|body| {
            body.rows(theme::TABLE_DATA_ROW_HEIGHT, page.len(), |mut row| {
                let Some(port) = page.get(row.index()).and_then(|&i| ports.get(i)) else {
                    return;
                };
                row.col(|ui| {
                    table::cell_mono_muted(ui, &format!("{}/{}", port.protocol, port.port));
                });
                row.col(|ui| {
                    table::cell_mono_muted(ui, &port.address);
                });
                row.col(|ui| {
                    table::cell(ui, port.process.as_deref().unwrap_or("Programme inconnu"));
                });
                row.col(|ui| {
                    if port.local_only {
                        table::cell_muted(ui, "Local seulement");
                    } else {
                        widgets::status_badge(ui, "RÉSEAU", theme::WARNING);
                    }
                });
            });
        });
    }

    fn changes_table(ui: &mut Ui, changes: &[GuiInventoryChange], page: &[usize]) {
        use widgets::table;
        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(150.0, 0.0),
                table::Col::fluid(320.0, 5.0),
                table::Col::fluid(120.0, 0.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            for title in ["QUAND", "CHANGEMENT", "INCIDENT"] {
                header.col(|ui| {
                    table::header_cell(ui, title);
                });
            }
        })
        .body(|body| {
            body.rows(theme::TABLE_DATA_ROW_HEIGHT, page.len(), |mut row| {
                let Some(change) = page.get(row.index()).and_then(|&i| changes.get(i)) else {
                    return;
                };
                row.col(|ui| {
                    table::cell_muted(ui, &crate::format::local_datetime(change.at));
                });
                row.col(|ui| {
                    table::cell(ui, &change.label).on_hover_text(&change.label);
                });
                row.col(|ui| match &change.severity {
                    Some(severity) => widgets::status_badge(
                        ui,
                        &severity.label().to_uppercase(),
                        theme::severity_color_typed(severity),
                    ),
                    None => {
                        table::cell_muted(ui, "Enregistré");
                    }
                });
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn account(name: &str, home: &str) -> GuiInventoryAccount {
        GuiInventoryAccount {
            name: name.to_string(),
            id: "1001".to_string(),
            home: Some(home.to_string()),
            shell: Some("/bin/bash".to_string()),
            can_log_in: true,
            privileged: false,
        }
    }

    #[test]
    fn the_search_looks_in_every_column_of_the_tab() {
        let inventory = GuiSystemInventory {
            accounts: vec![
                account("alice", "/home/alice"),
                account("backup", "/var/backup"),
            ],
            groups: vec![GuiInventoryGroup {
                name: "sudo".to_string(),
                id: Some("27".to_string()),
                members: vec!["alice".to_string()],
                privileged: true,
            }],
            ports: vec![GuiInventoryPort {
                protocol: "tcp".to_string(),
                address: "0.0.0.0".to_string(),
                port: 22,
                process: Some("sshd".to_string()),
                local_only: false,
            }],
            ..Default::default()
        };
        assert_eq!(rows_of(&inventory, 0, ""), [0, 1]);
        assert_eq!(rows_of(&inventory, 0, "VAR/BACKUP"), [1]);
        // A group is found by one of its members.
        assert_eq!(rows_of(&inventory, 1, "ALICE"), [0]);
        assert_eq!(rows_of(&inventory, 3, "22"), [0]);
        assert_eq!(rows_of(&inventory, 3, "SSHD"), [0]);
        assert!(rows_of(&inventory, 3, "HTTPD").is_empty());
        assert!(rows_of(&inventory, 4, "").is_empty());
    }
}
