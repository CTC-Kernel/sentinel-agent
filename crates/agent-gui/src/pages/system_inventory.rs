// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Inventory of the endpoint: the machine and its system, accounts, groups,
//! services, listening ports and Windows updates as the agent last
//! collected them, and what changed in them.
//!
//! The agent takes the inventory every ten minutes (`system_inventory`
//! option); a change an intruder leaves behind (an account, an
//! administration group member, a service, a listening port) also raises an
//! incident, shown in the threats.

use crate::app::AppState;
use crate::dto::{
    GuiInventoryAccount, GuiInventoryChange, GuiInventoryContainer, GuiInventoryGroup,
    GuiInventoryHotfix, GuiInventoryPort, GuiInventoryService, GuiSystemDescription,
    GuiSystemInventory,
};
use crate::events::GuiCommand;
use crate::icons;
use crate::pages::assets::order;
use crate::theme;
use crate::widgets;
use egui::Ui;

/// Rows of one table page.
const ROWS_PER_PAGE: usize = 25;

/// The tabs of the page.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Tab {
    System,
    Accounts,
    Groups,
    Services,
    Ports,
    Containers,
    Hotfixes,
    Changes,
}

impl Tab {
    fn label(self) -> &'static str {
        match self {
            Self::System => "Système",
            Self::Accounts => "Comptes",
            Self::Groups => "Groupes",
            Self::Services => "Services",
            Self::Ports => "Ports en écoute",
            Self::Containers => "Conteneurs",
            Self::Hotfixes => "Correctifs",
            Self::Changes => "Changements",
        }
    }

    fn icon(self) -> &'static str {
        match self {
            Self::System => icons::DESKTOP,
            Self::Accounts => icons::USER,
            Self::Groups => icons::USERS,
            Self::Services => icons::SERVER,
            Self::Ports => icons::NETWORK,
            Self::Containers => icons::CUBE,
            Self::Hotfixes => icons::DOWNLOAD,
            Self::Changes => icons::CLOCK,
        }
    }

    fn placeholder(self) -> &'static str {
        match self {
            Self::System => "",
            Self::Accounts => "Rechercher un compte, un identifiant, un shell…",
            Self::Groups => "Rechercher un groupe ou un membre…",
            Self::Services => "Rechercher un service ou une commande…",
            Self::Ports => "Rechercher un port, une adresse ou un programme…",
            Self::Containers => "Rechercher un conteneur, une image ou un risque…",
            Self::Hotfixes => "Rechercher un correctif (KB…) ou un type…",
            Self::Changes => "Rechercher un changement…",
        }
    }
}

/// The tabs of this inventory: the containers are listed when Docker runs,
/// the updates on Windows.
fn tabs_of(inventory: &GuiSystemInventory) -> Vec<Tab> {
    let mut tabs = vec![
        Tab::System,
        Tab::Accounts,
        Tab::Groups,
        Tab::Services,
        Tab::Ports,
    ];
    if !inventory.containers.is_empty() {
        tabs.push(Tab::Containers);
    }
    if !inventory.hotfixes.is_empty() {
        tabs.push(Tab::Hotfixes);
    }
    tabs.push(Tab::Changes);
    tabs
}

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

fn filtered_containers(containers: &[GuiInventoryContainer], needle: &str) -> Vec<usize> {
    (0..containers.len())
        .filter(|&i| {
            let c = &containers[i];
            found(
                needle,
                &[&c.name, &c.image, &c.id, &c.state, &c.user, &c.engine],
            ) || c.risks.iter().any(|risk| found(needle, &[risk]))
        })
        .collect()
}

fn filtered_hotfixes(hotfixes: &[GuiInventoryHotfix], needle: &str) -> Vec<usize> {
    (0..hotfixes.len())
        .filter(|&i| {
            let h = &hotfixes[i];
            found(
                needle,
                &[
                    &h.id,
                    h.description.as_deref().unwrap_or(""),
                    h.installed_on.as_deref().unwrap_or(""),
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

/// The rows of a table tab that match the search.
fn rows_of(inventory: &GuiSystemInventory, tab: Tab, needle: &str) -> Vec<usize> {
    match tab {
        Tab::System => Vec::new(),
        Tab::Accounts => filtered_accounts(&inventory.accounts, needle),
        Tab::Groups => filtered_groups(&inventory.groups, needle),
        Tab::Services => filtered_services(&inventory.services, needle),
        Tab::Ports => filtered_ports(&inventory.ports, needle),
        Tab::Containers => filtered_containers(&inventory.containers, needle),
        Tab::Hotfixes => filtered_hotfixes(&inventory.hotfixes, needle),
        Tab::Changes => filtered_changes(&inventory.changes, needle),
    }
}

/// The name the sort of a tab's table is kept under.
fn sort_table(tab: Tab) -> Option<&'static str> {
    match tab {
        Tab::System => None,
        Tab::Accounts => Some("inventory_accounts"),
        Tab::Groups => Some("inventory_groups"),
        Tab::Services => Some("inventory_services"),
        Tab::Ports => Some("inventory_ports"),
        Tab::Containers => Some("inventory_containers"),
        Tab::Hotfixes => Some("inventory_hotfixes"),
        Tab::Changes => Some("inventory_changes"),
    }
}

/// Rank of a severity, least severe first.
fn severity_rank(severity: Option<&crate::dto::Severity>) -> u8 {
    match severity {
        None => 0,
        Some(crate::dto::Severity::Info) => 1,
        Some(crate::dto::Severity::Low) => 2,
        Some(crate::dto::Severity::Medium) => 3,
        Some(crate::dto::Severity::High) => 4,
        Some(crate::dto::Severity::Critical) => 5,
    }
}

/// Order the rows `a` and `b` of `tab` under a column key, ascending.
fn compare_rows(
    inventory: &GuiSystemInventory,
    tab: Tab,
    key: &str,
    a: usize,
    b: usize,
) -> std::cmp::Ordering {
    use std::cmp::Ordering::Equal;
    match tab {
        Tab::System => Equal,
        Tab::Accounts => {
            let (a, b) = (&inventory.accounts[a], &inventory.accounts[b]);
            match key {
                "name" => order::text(&a.name, &b.name),
                // UIDs by value; Windows SIDs by their numbers too.
                "id" => order::version(&a.id, &b.id),
                "shell" => order::opt_text(a.shell.as_deref(), b.shell.as_deref()),
                "session" => a.can_log_in.cmp(&b.can_log_in),
                "rights" => a.privileged.cmp(&b.privileged),
                _ => Equal,
            }
        }
        Tab::Groups => {
            let (a, b) = (&inventory.groups[a], &inventory.groups[b]);
            match key {
                "name" => order::text(&a.name, &b.name),
                "members" => a.members.len().cmp(&b.members.len()),
                "rights" => a.privileged.cmp(&b.privileged),
                _ => Equal,
            }
        }
        Tab::Services => {
            let (a, b) = (&inventory.services[a], &inventory.services[b]);
            match key {
                "name" => order::text(&a.name, &b.name),
                "state" => order::text(&a.state, &b.state),
                "command" => order::opt_text(a.command.as_deref(), b.command.as_deref()),
                _ => Equal,
            }
        }
        Tab::Ports => {
            let (a, b) = (&inventory.ports[a], &inventory.ports[b]);
            match key {
                "port" => a
                    .port
                    .cmp(&b.port)
                    .then_with(|| order::text(&a.protocol, &b.protocol)),
                "address" => order::ip(&a.address, &b.address),
                "process" => order::opt_text(a.process.as_deref(), b.process.as_deref()),
                // Local only first: descending puts the exposed ports on top.
                "exposure" => b.local_only.cmp(&a.local_only),
                _ => Equal,
            }
        }
        Tab::Containers => {
            let (a, b) = (&inventory.containers[a], &inventory.containers[b]);
            match key {
                "name" => order::text(&a.name, &b.name),
                "state" => order::text(&a.state, &b.state),
                "user" => order::text(&a.user, &b.user),
                // Isolated first, then by how much is opened to the host.
                "isolation" => a
                    .can_take_host
                    .cmp(&b.can_take_host)
                    .then_with(|| a.risks.len().cmp(&b.risks.len())),
                _ => Equal,
            }
        }
        Tab::Hotfixes => {
            let (a, b) = (&inventory.hotfixes[a], &inventory.hotfixes[b]);
            match key {
                "id" => order::version(&a.id, &b.id),
                "description" => {
                    order::opt_text(a.description.as_deref(), b.description.as_deref())
                }
                // ISO days: their text order is the chronological one.
                "installed_on" => {
                    order::opt_text(a.installed_on.as_deref(), b.installed_on.as_deref())
                }
                _ => Equal,
            }
        }
        Tab::Changes => {
            let (a, b) = (&inventory.changes[a], &inventory.changes[b]);
            match key {
                "at" => a.at.cmp(&b.at),
                "label" => order::text(&a.label, &b.label),
                "severity" => {
                    severity_rank(a.severity.as_ref()).cmp(&severity_rank(b.severity.as_ref()))
                }
                _ => Equal,
            }
        }
    }
}

/// "Oui" or "Non", for the CSV exports.
fn yes_no(value: bool) -> String {
    if value { "Oui" } else { "Non" }.to_string()
}

/// The file name, headers and lines of the CSV export of `rows` of `tab`.
fn csv_of(
    inventory: &GuiSystemInventory,
    tab: Tab,
    rows: &[usize],
) -> (&'static str, Vec<&'static str>, Vec<Vec<String>>) {
    let text = |value: &Option<String>| value.clone().unwrap_or_default();
    match tab {
        Tab::System => ("inventaire_systeme.csv", Vec::new(), Vec::new()),
        Tab::Accounts => (
            "inventaire_comptes.csv",
            vec![
                "compte",
                "identifiant",
                "repertoire",
                "shell",
                "session",
                "admin",
            ],
            rows.iter()
                .filter_map(|&i| inventory.accounts.get(i))
                .map(|a| {
                    vec![
                        a.name.clone(),
                        a.id.clone(),
                        text(&a.home),
                        text(&a.shell),
                        yes_no(a.can_log_in),
                        yes_no(a.privileged),
                    ]
                })
                .collect(),
        ),
        Tab::Groups => (
            "inventaire_groupes.csv",
            vec!["groupe", "identifiant", "membres", "admin"],
            rows.iter()
                .filter_map(|&i| inventory.groups.get(i))
                .map(|g| {
                    vec![
                        g.name.clone(),
                        text(&g.id),
                        g.members.join(", "),
                        yes_no(g.privileged),
                    ]
                })
                .collect(),
        ),
        Tab::Services => (
            "inventaire_services.csv",
            vec!["service", "etat", "commande"],
            rows.iter()
                .filter_map(|&i| inventory.services.get(i))
                .map(|s| vec![s.name.clone(), s.state.clone(), text(&s.command)])
                .collect(),
        ),
        Tab::Ports => (
            "inventaire_ports.csv",
            vec![
                "protocole",
                "port",
                "adresse",
                "programme",
                "local_seulement",
            ],
            rows.iter()
                .filter_map(|&i| inventory.ports.get(i))
                .map(|p| {
                    vec![
                        p.protocol.clone(),
                        p.port.to_string(),
                        p.address.clone(),
                        text(&p.process),
                        yes_no(p.local_only),
                    ]
                })
                .collect(),
        ),
        Tab::Containers => (
            "inventaire_conteneurs.csv",
            vec![
                "conteneur",
                "identifiant",
                "image",
                "moteur",
                "etat",
                "compte",
                "risques",
                "peut_prendre_l_hote",
            ],
            rows.iter()
                .filter_map(|&i| inventory.containers.get(i))
                .map(|c| {
                    vec![
                        c.name.clone(),
                        c.id.clone(),
                        c.image.clone(),
                        c.engine.clone(),
                        c.state.clone(),
                        c.user.clone(),
                        c.risks.join(" ; "),
                        yes_no(c.can_take_host),
                    ]
                })
                .collect(),
        ),
        Tab::Hotfixes => (
            "inventaire_correctifs.csv",
            vec!["correctif", "type", "installe_le"],
            rows.iter()
                .filter_map(|&i| inventory.hotfixes.get(i))
                .map(|h| vec![h.id.clone(), text(&h.description), text(&h.installed_on)])
                .collect(),
        ),
        Tab::Changes => (
            "inventaire_changements.csv",
            vec!["quand", "changement", "incident"],
            rows.iter()
                .filter_map(|&i| inventory.changes.get(i))
                .map(|c| {
                    vec![
                        crate::format::local_datetime(c.at),
                        c.label.clone(),
                        c.severity
                            .as_ref()
                            .map(|s| s.label().to_string())
                            .unwrap_or_default(),
                    ]
                })
                .collect(),
        ),
    }
}

/// The memory in binary units, as the systems count it: `16 Gio`,
/// `7,8 Gio`.
fn memory_label(bytes: u64) -> String {
    let gib = bytes as f64 / f64::from(1u32 << 30);
    let decimals = if (gib * 10.0).round() % 10.0 == 0.0 {
        0
    } else {
        1
    };
    format!("{} Gio", crate::format::decimal(gib, decimals))
}

/// `16 physiques · 32 logiques`, or what of it the system says.
fn cores_label(system: &GuiSystemDescription) -> Option<String> {
    match (system.cores, system.threads) {
        (Some(cores), Some(threads)) if cores != threads => {
            Some(format!("{cores} physiques · {threads} logiques"))
        }
        (Some(cores), _) => Some(cores.to_string()),
        (None, Some(threads)) => Some(format!("{threads} logiques")),
        (None, None) => None,
    }
}

/// `2026-10-08` as `08/10/2026`; anything else as it is.
fn day_label(day: &str) -> String {
    chrono::NaiveDate::parse_from_str(day, "%Y-%m-%d")
        .map(|day| day.format("%d/%m/%Y").to_string())
        .unwrap_or_else(|_| day.to_string())
}

/// One field of the system cards; `—` for what the system does not say.
fn field(ui: &mut Ui, label: &str, value: Option<&str>) {
    widgets::detail_field(ui, label, value.unwrap_or("—"));
}

impl SystemInventoryPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Actifs & inventaire", "Système & comptes"],
            "Inventaire du poste",
            Some(
                "Système et matériel, comptes, groupes, services, ports en écoute et conteneurs \
                 de cet hôte, et ce qui y change.",
            ),
            Some(
                "L'agent relève l'inventaire toutes les dix minutes. Un compte créé, un membre \
                 ajouté à un groupe d'administration, un service installé ou un port qui se met \
                 à écouter lève en plus un incident, visible dans Menaces. Un changement du \
                 système, du matériel ou des correctifs Windows est enregistré. Un conteneur qui peut \
                 prendre l'hôte (privilégié, racine ou socket du moteur montés…) est signalé sur \
                 son onglet.",
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

        let tabs = tabs_of(&inventory);
        // The containers that can take the host, on their tab.
        let risky = inventory
            .containers
            .iter()
            .filter(|c| c.can_take_host)
            .count();
        let bar: Vec<widgets::Tab> = tabs
            .iter()
            .map(|tab| {
                let bar_tab = widgets::Tab::new(tab.label()).icon(tab.icon());
                if *tab == Tab::Containers && risky > 0 {
                    bar_tab.urgent_badge(u32::try_from(risky).unwrap_or(u32::MAX))
                } else {
                    bar_tab
                }
            })
            .collect();
        if let Some(index) = widgets::TabBar::new(bar, state.system_inventory.active_tab).show(ui)
            && index != state.system_inventory.active_tab
        {
            state.system_inventory.active_tab = index;
            state.system_inventory.page = 0;
            // One search field serves every table: a port is not an account.
            state.system_inventory.search.clear();
        }
        ui.add_space(theme::SPACE_MD);

        let tab = tabs[state.system_inventory.active_tab.min(tabs.len() - 1)];
        if tab == Tab::System {
            Self::system(ui, &inventory);
            return None;
        }
        let needle = state.system_inventory.search.trim().to_uppercase();
        let mut rows = rows_of(&inventory, tab, &needle);
        if let Some(table_name) = sort_table(tab) {
            order::sort(ui.ctx(), table_name, &mut rows, |key, a, b| {
                compare_rows(&inventory, tab, key, a, b)
            });
        }
        // As the headers leave it: a click on one goes back to page one.
        let sort_before = sort_table(tab)
            .map(|table_name| format!("{:?}", widgets::table::sort_of(ui.ctx(), table_name)));
        let search_before = state.system_inventory.search.clone();
        let (_, export) =
            widgets::SearchFilterBar::new(&mut state.system_inventory.search, tab.placeholder())
                .result_count(rows.len())
                .action(format!("{}  CSV", icons::DOWNLOAD))
                .show_with_action(ui);
        if state.system_inventory.search != search_before {
            state.system_inventory.page = 0;
        }
        if export {
            let (file, headers, lines) = csv_of(&inventory, tab, &rows);
            let path = crate::export::default_export_path(file);
            let toast = match crate::export::export_csv(&headers, &lines, &path) {
                Ok(_) => crate::widgets::toast::Toast::success("Export CSV réussi"),
                Err(e) => {
                    tracing::warn!("Export CSV failed: {}", e);
                    crate::widgets::toast::Toast::error("Échec de l'export CSV")
                }
            };
            state.push_toast(toast, ui.ctx());
        }
        ui.add_space(theme::SPACE_SM);

        widgets::data_card(ui, tab.label(), |ui: &mut egui::Ui| {
            if rows.is_empty() {
                let (title, detail) = if needle.is_empty() {
                    match tab {
                        Tab::Changes => (
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
                Tab::System => {}
                Tab::Accounts => Self::accounts_table(ui, &inventory.accounts, page),
                Tab::Groups => Self::groups_table(ui, &inventory.groups, page),
                Tab::Services => Self::services_table(ui, &inventory.services, page),
                Tab::Ports => Self::ports_table(ui, &inventory.ports, page),
                Tab::Containers => Self::containers_table(ui, &inventory.containers, page),
                Tab::Hotfixes => Self::hotfixes_table(ui, &inventory.hotfixes, page),
                Tab::Changes => Self::changes_table(ui, &inventory.changes, page),
            }
            widgets::paginate_controls(
                ui,
                rows.len(),
                ROWS_PER_PAGE,
                &mut state.system_inventory.page,
            );
        });
        let sort_after = sort_table(tab)
            .map(|table_name| format!("{:?}", widgets::table::sort_of(ui.ctx(), table_name)));
        if sort_after != sort_before {
            state.system_inventory.page = 0;
        }
        None
    }

    /// One card per part of the inventory; a click opens its tab.
    fn summary(ui: &mut Ui, state: &mut AppState, inventory: &GuiSystemInventory) {
        let tabs = tabs_of(inventory);
        let index = |tab: Tab| tabs.iter().position(|t| *t == tab).unwrap_or(0);
        let privileged = inventory.accounts.iter().filter(|a| a.privileged).count();
        let exposed = inventory.ports.iter().filter(|p| !p.local_only).count();
        let raised = inventory
            .changes
            .iter()
            .filter(|c| c.severity.is_some())
            .count();
        let items: Vec<(usize, &str, String, egui::Color32, &str)> = vec![
            (
                index(Tab::Accounts),
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
                index(Tab::Services),
                "SERVICES",
                crate::format::int(inventory.services.len() as u64),
                theme::ACCENT,
                icons::SERVER,
            ),
            (
                index(Tab::Ports),
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
                index(Tab::Changes),
                "CHANGEMENTS",
                format!(
                    "{} · {}",
                    inventory.changes.len(),
                    crate::format::count(raised, "incident")
                ),
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
                if state.system_inventory.active_tab != *tab {
                    state.system_inventory.search.clear();
                }
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

    /// The machine and its system, in two cards side by side when there is
    /// room.
    fn system(ui: &mut Ui, inventory: &GuiSystemInventory) {
        let Some(system) = &inventory.system else {
            widgets::data_card(ui, "Système", |ui: &mut egui::Ui| {
                widgets::empty_state(
                    ui,
                    icons::DESKTOP,
                    "Système pas encore décrit",
                    Some(
                        "La description du système et du matériel arrive avec le prochain relevé.",
                    ),
                );
            });
            return;
        };
        // The most recent update, by the day it was installed.
        let latest =
            inventory
                .hotfixes
                .first()
                .map(|hotfix| match hotfix.installed_on.as_deref() {
                    Some(day) => format!("{} · {}", hotfix.id, day_label(day)),
                    None => hotfix.id.clone(),
                });
        let os = |ui: &mut Ui| {
            widgets::detail_section(ui, "SYSTÈME D'EXPLOITATION");
            field(ui, "Nom de la machine", system.hostname.as_deref());
            field(ui, "Système", system.os_label.as_deref());
            field(ui, "Noyau", system.kernel.as_deref());
            field(ui, "Architecture", system.architecture.as_deref());
            let booted = system.booted_at.map(|at| {
                format!(
                    "{} · {}",
                    crate::format::local_datetime(at),
                    crate::format::ago(chrono::Utc::now(), at)
                )
            });
            field(ui, "Démarré le", booted.as_deref());
            if let Some(latest) = &latest {
                field(ui, "Dernier correctif", Some(latest));
            }
        };
        let hardware = |ui: &mut Ui| {
            widgets::detail_section(ui, "MATÉRIEL");
            field(ui, "Fabricant", system.manufacturer.as_deref());
            field(ui, "Modèle", system.model.as_deref());
            match &system.serial_number {
                Some(serial) => widgets::detail_mono(ui, "Numéro de série", serial),
                None => field(ui, "Numéro de série", None),
            }
            field(ui, "Processeur", system.processor.as_deref());
            field(ui, "Cœurs", cores_label(system).as_deref());
            field(
                ui,
                "Mémoire",
                system.memory_bytes.map(memory_label).as_deref(),
            );
        };
        // One card, its two halves side by side when there is room.
        widgets::card(ui, |ui: &mut egui::Ui| {
            if ui.available_width() >= 760.0 {
                ui.columns(2, |columns| {
                    os(&mut columns[0]);
                    hardware(&mut columns[1]);
                });
            } else {
                os(ui);
                hardware(ui);
            }
        });
    }

    fn accounts_table(ui: &mut Ui, accounts: &[GuiInventoryAccount], page: &[usize]) {
        use widgets::table;
        table::fluid(
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
            order::headers(
                &mut header,
                "inventory_accounts",
                &[
                    ("COMPTE", Some("name")),
                    ("IDENTIFIANT", Some("id")),
                    ("SHELL", Some("shell")),
                    ("SESSION", Some("session")),
                    ("DROITS", Some("rights")),
                ],
            );
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
        table::fluid(
            ui,
            &[
                table::Col::fluid(170.0, 1.5),
                table::Col::fluid(240.0, 4.0),
                table::Col::fluid(130.0, 0.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            order::headers(
                &mut header,
                "inventory_groups",
                &[
                    ("GROUPE", Some("name")),
                    ("MEMBRES", Some("members")),
                    ("DROITS", Some("rights")),
                ],
            );
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
        table::fluid(
            ui,
            &[
                table::Col::fluid(200.0, 2.0),
                table::Col::fluid(110.0, 0.0),
                table::Col::fluid(240.0, 4.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            order::headers(
                &mut header,
                "inventory_services",
                &[
                    ("SERVICE", Some("name")),
                    ("ÉTAT", Some("state")),
                    ("COMMANDE", Some("command")),
                ],
            );
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
        table::fluid(
            ui,
            &[
                table::Col::fluid(100.0, 0.0),
                table::Col::fluid(150.0, 1.5),
                table::Col::fluid(180.0, 2.0),
                table::Col::fluid(120.0, 0.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            order::headers(
                &mut header,
                "inventory_ports",
                &[
                    ("PORT", Some("port")),
                    ("ADRESSE", Some("address")),
                    ("PROGRAMME", Some("process")),
                    ("EXPOSITION", Some("exposure")),
                ],
            );
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

    fn containers_table(ui: &mut Ui, containers: &[GuiInventoryContainer], page: &[usize]) {
        use widgets::table;
        table::fluid(
            ui,
            &[
                table::Col::fluid(200.0, 2.0),
                table::Col::fluid(110.0, 0.0),
                table::Col::fluid(110.0, 0.0),
                table::Col::fluid(230.0, 2.5),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            order::headers(
                &mut header,
                "inventory_containers",
                &[
                    ("CONTENEUR", Some("name")),
                    ("ÉTAT", Some("state")),
                    ("COMPTE", Some("user")),
                    ("ISOLATION", Some("isolation")),
                ],
            );
        })
        .body(|body| {
            body.rows(theme::TABLE_DATA_ROW_HEIGHT, page.len(), |mut row| {
                let Some(container) = page.get(row.index()).and_then(|&i| containers.get(i)) else {
                    return;
                };
                row.col(|ui| {
                    let engine = match container.engine.as_str() {
                        "podman" => "Podman",
                        _ => "Docker",
                    };
                    table::cell_stack(
                        ui,
                        &container.name,
                        &format!("{} · {engine}", container.image),
                    )
                    .on_hover_text(format!("{} · {}", container.id, container.image));
                });
                row.col(|ui| {
                    let (label, color) = match container.state.as_str() {
                        "running" => ("EN COURS", theme::SUCCESS),
                        "exited" => ("ARRÊTÉ", theme::text_tertiary()),
                        "paused" => ("EN PAUSE", theme::INFO),
                        "restarting" => ("REDÉMARRE", theme::WARNING),
                        _ => ("CRÉÉ", theme::INFO),
                    };
                    widgets::status_badge(ui, label, color);
                });
                row.col(|ui| {
                    table::cell_mono_muted(ui, &container.user);
                });
                row.col(|ui| match container.risks.first() {
                    None => {
                        table::cell_muted(ui, "Isolé");
                    }
                    Some(first) => {
                        let color = if container.can_take_host {
                            theme::SEVERITY_HIGH
                        } else {
                            theme::WARNING
                        };
                        let response = ui
                            .horizontal(|ui| {
                                widgets::status_badge(ui, &first.to_uppercase(), color);
                                if container.risks.len() > 1 {
                                    table::cell_muted(
                                        ui,
                                        &format!("+{}", container.risks.len() - 1),
                                    );
                                }
                            })
                            .response;
                        response.on_hover_text(container.risks.join("\n"));
                    }
                });
            });
        });
    }

    fn hotfixes_table(ui: &mut Ui, hotfixes: &[GuiInventoryHotfix], page: &[usize]) {
        use widgets::table;
        table::fluid(
            ui,
            &[
                table::Col::fluid(150.0, 1.0),
                table::Col::fluid(220.0, 3.0),
                table::Col::fluid(130.0, 0.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            order::headers(
                &mut header,
                "inventory_hotfixes",
                &[
                    ("CORRECTIF", Some("id")),
                    ("TYPE", Some("description")),
                    ("INSTALLÉ LE", Some("installed_on")),
                ],
            );
        })
        .body(|body| {
            body.rows(theme::TABLE_DATA_ROW_HEIGHT, page.len(), |mut row| {
                let Some(hotfix) = page.get(row.index()).and_then(|&i| hotfixes.get(i)) else {
                    return;
                };
                row.col(|ui| {
                    table::cell_mono_muted(ui, &hotfix.id);
                });
                row.col(|ui| {
                    table::cell(ui, hotfix.description.as_deref().unwrap_or("—"));
                });
                row.col(|ui| {
                    table::cell_muted(
                        ui,
                        &hotfix
                            .installed_on
                            .as_deref()
                            .map_or_else(|| "—".to_string(), day_label),
                    );
                });
            });
        });
    }

    fn changes_table(ui: &mut Ui, changes: &[GuiInventoryChange], page: &[usize]) {
        use widgets::table;
        table::fluid(
            ui,
            &[
                table::Col::fluid(150.0, 0.0),
                table::Col::fluid(320.0, 5.0),
                table::Col::fluid(120.0, 0.0),
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            order::headers(
                &mut header,
                "inventory_changes",
                &[
                    ("QUAND", Some("at")),
                    ("CHANGEMENT", Some("label")),
                    ("INCIDENT", Some("severity")),
                ],
            );
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
        assert_eq!(rows_of(&inventory, Tab::Accounts, ""), [0, 1]);
        assert_eq!(rows_of(&inventory, Tab::Accounts, "VAR/BACKUP"), [1]);
        // A group is found by one of its members.
        assert_eq!(rows_of(&inventory, Tab::Groups, "ALICE"), [0]);
        assert_eq!(rows_of(&inventory, Tab::Ports, "22"), [0]);
        assert_eq!(rows_of(&inventory, Tab::Ports, "SSHD"), [0]);
        assert!(rows_of(&inventory, Tab::Ports, "HTTPD").is_empty());
        assert!(rows_of(&inventory, Tab::Changes, "").is_empty());
    }

    /// The updates tab is there when the system lists updates: on Windows.
    #[test]
    fn the_updates_tab_comes_with_the_updates() {
        let mut inventory = GuiSystemInventory::default();
        assert!(!tabs_of(&inventory).contains(&Tab::Hotfixes));
        inventory.hotfixes.push(GuiInventoryHotfix {
            id: "KB5034441".to_string(),
            description: Some("Security Update".to_string()),
            installed_on: Some("2026-10-08".to_string()),
        });
        let tabs = tabs_of(&inventory);
        assert_eq!(tabs.first(), Some(&Tab::System));
        assert_eq!(tabs.last(), Some(&Tab::Changes));
        assert!(tabs.contains(&Tab::Hotfixes));
        assert_eq!(rows_of(&inventory, Tab::Hotfixes, "SECURITY"), [0]);
        assert_eq!(day_label("2026-10-08"), "08/10/2026");
        assert_eq!(day_label("8/10/2026"), "8/10/2026");
    }

    #[test]
    fn the_containers_tab_comes_with_docker_and_finds_a_risk() {
        let mut inventory = GuiSystemInventory::default();
        assert!(!tabs_of(&inventory).contains(&Tab::Containers));
        inventory.containers.push(GuiInventoryContainer {
            engine: "podman".to_string(),
            id: "4f2a9c0d1e2b".to_string(),
            name: "escape".to_string(),
            image: "alpine:3.20".to_string(),
            state: "running".to_string(),
            user: "root".to_string(),
            risks: vec![
                "Privilégié".to_string(),
                "Racine de l'hôte montée".to_string(),
            ],
            can_take_host: true,
        });
        let tabs = tabs_of(&inventory);
        assert_eq!(
            tabs.iter().position(|t| *t == Tab::Containers),
            Some(tabs.iter().position(|t| *t == Tab::Ports).unwrap() + 1)
        );
        assert_eq!(rows_of(&inventory, Tab::Containers, "RACINE"), [0]);
        assert_eq!(rows_of(&inventory, Tab::Containers, "ALPINE"), [0]);
        assert!(rows_of(&inventory, Tab::Containers, "NGINX").is_empty());
        assert_eq!(rows_of(&inventory, Tab::Containers, "PODMAN"), [0]);
    }

    #[test]
    fn rows_sort_by_value_not_by_spelling() {
        use std::cmp::Ordering::{Greater, Less};
        let port = |address: &str, port: u16, local_only: bool| GuiInventoryPort {
            protocol: "tcp".to_string(),
            address: address.to_string(),
            port,
            process: None,
            local_only,
        };
        let mut inventory = GuiSystemInventory {
            accounts: vec![account("root", "/root"), account("alice", "/home/alice")],
            ports: vec![port("10.0.0.10", 443, false), port("10.0.0.9", 8080, true)],
            ..Default::default()
        };
        inventory.accounts[0].id = "0".to_string();
        inventory.accounts[1].id = "1001".to_string();
        inventory.accounts[0].privileged = true;
        assert_eq!(compare_rows(&inventory, Tab::Accounts, "id", 0, 1), Less);
        assert_eq!(
            compare_rows(&inventory, Tab::Accounts, "name", 0, 1),
            Greater
        );
        assert_eq!(
            compare_rows(&inventory, Tab::Accounts, "rights", 0, 1),
            Greater
        );
        // 10.0.0.9 before 10.0.0.10, 443 before 8080.
        assert_eq!(
            compare_rows(&inventory, Tab::Ports, "address", 0, 1),
            Greater
        );
        assert_eq!(compare_rows(&inventory, Tab::Ports, "port", 0, 1), Less);
        assert_eq!(
            compare_rows(&inventory, Tab::Ports, "exposure", 0, 1),
            Greater
        );
    }

    /// The export carries the rows the search kept, with every column.
    #[test]
    fn the_export_follows_the_search() {
        let inventory = GuiSystemInventory {
            accounts: vec![
                account("alice", "/home/alice"),
                account("backup", "/var/backup"),
            ],
            ..Default::default()
        };
        let rows = rows_of(&inventory, Tab::Accounts, "BACKUP");
        let (file, headers, lines) = csv_of(&inventory, Tab::Accounts, &rows);
        assert_eq!(file, "inventaire_comptes.csv");
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].len(), headers.len());
        assert_eq!(lines[0][0], "backup");
        assert_eq!(lines[0][4], "Oui");
        assert_eq!(lines[0][5], "Non");
    }

    #[test]
    fn memory_and_cores_read_as_the_system_counts_them() {
        assert_eq!(memory_label(16 * (1 << 30)), "16 Gio");
        assert_eq!(memory_label(8_392_605_696), "7,8 Gio");
        let system = GuiSystemDescription {
            cores: Some(16),
            threads: Some(32),
            ..Default::default()
        };
        assert_eq!(
            cores_label(&system).as_deref(),
            Some("16 physiques · 32 logiques")
        );
        let apple = GuiSystemDescription {
            cores: Some(10),
            threads: Some(10),
            ..Default::default()
        };
        assert_eq!(cores_label(&apple).as_deref(), Some("10"));
        assert_eq!(cores_label(&GuiSystemDescription::default()), None);
    }
}
