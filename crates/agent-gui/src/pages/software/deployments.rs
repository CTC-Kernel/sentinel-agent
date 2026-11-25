// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! « Déploiements MDM » tab of the software page: the software
//! deployments the platform ordered on this machine, as the agent kept
//! them, and what the local configuration lets the platform deploy.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GuiMdmDeployment, GuiMdmPolicy, MdmStatus};
use crate::events::GuiCommand;
use crate::icons;
use crate::pages::assets::order;
use crate::theme;
use crate::widgets;

/// Rows of one table page.
const ROWS_PER_PAGE: usize = 25;

/// The status filters, in the order of their chips.
const FILTERS: [(MdmStatus, &str); 4] = [
    (MdmStatus::Succeeded, "Réussis"),
    (MdmStatus::Failed, "Échecs"),
    (MdmStatus::Refused, "Refusés"),
    (MdmStatus::Started, "En cours"),
];

/// Label and colour of a status.
pub(super) fn status_display(status: MdmStatus) -> (&'static str, egui::Color32) {
    match status {
        MdmStatus::Received => ("REÇU", theme::INFO),
        MdmStatus::Started => ("EN COURS", theme::INFO),
        MdmStatus::Succeeded => ("RÉUSSI", theme::SUCCESS),
        MdmStatus::Failed => ("ÉCHEC", theme::ERROR),
        MdmStatus::Refused => ("REFUSÉ", theme::WARNING),
    }
}

/// French name of an action as the platform sends it.
fn action_label(action: &str) -> &str {
    match action {
        "install" => "Installation",
        "update" => "Mise à jour",
        "uninstall" => "Désinstallation",
        other => other,
    }
}

/// What the row is called: the package name, else its platform identifier.
fn package_label(deployment: &GuiMdmDeployment) -> &str {
    deployment
        .package_name
        .as_deref()
        .or(deployment.software_id.as_deref())
        .unwrap_or("Paquet non nommé")
}

/// Whether `status` passes `filter`. « En cours » also covers a command
/// received and not yet started.
fn passes(status: MdmStatus, filter: Option<MdmStatus>) -> bool {
    match filter {
        None => true,
        Some(MdmStatus::Started) => matches!(status, MdmStatus::Started | MdmStatus::Received),
        Some(wanted) => status == wanted,
    }
}

/// Indices of the deployments matching the search (package, version,
/// action, source, identifiers) and the status filter, newest first as
/// received.
fn filtered(
    deployments: &[GuiMdmDeployment],
    search_upper: &str,
    filter: Option<MdmStatus>,
) -> Vec<usize> {
    deployments
        .iter()
        .enumerate()
        .filter(|(_, d)| {
            passes(d.status, filter)
                && (search_upper.is_empty()
                    || [
                        package_label(d),
                        d.version.as_deref().unwrap_or(""),
                        action_label(&d.action),
                        d.source.as_deref().unwrap_or(""),
                        d.deployment_id.as_deref().unwrap_or(""),
                        &d.id,
                    ]
                    .iter()
                    .any(|field| field.to_uppercase().contains(search_upper)))
        })
        .map(|(index, _)| index)
        .collect()
}

/// Rank of a status for sorting: what is still open first, then the
/// outcomes from the one to look at to the one that went well.
fn status_rank(status: MdmStatus) -> u8 {
    match status {
        MdmStatus::Received => 0,
        MdmStatus::Started => 1,
        MdmStatus::Failed => 2,
        MdmStatus::Refused => 3,
        MdmStatus::Succeeded => 4,
    }
}

/// Order two deployments under a column key, ascending.
fn compare(key: &str, a: &GuiMdmDeployment, b: &GuiMdmDeployment) -> std::cmp::Ordering {
    match key {
        "date" => a.requested_at.cmp(&b.requested_at),
        "package" => order::text(package_label(a), package_label(b)),
        "version" => order::opt_version(a.version.as_deref(), b.version.as_deref()),
        "action" => order::text(action_label(&a.action), action_label(&b.action)),
        "status" => status_rank(a.status).cmp(&status_rank(b.status)),
        "source" => order::opt_text(a.source.as_deref(), b.source.as_deref()),
        _ => std::cmp::Ordering::Equal,
    }
}

/// (succeeded, failed, refused, running) among `deployments`.
fn counts(deployments: &[GuiMdmDeployment]) -> (usize, usize, usize, usize) {
    let of = |wanted: MdmStatus| {
        deployments
            .iter()
            .filter(|d| passes(d.status, Some(wanted)))
            .count()
    };
    (
        of(MdmStatus::Succeeded),
        of(MdmStatus::Failed),
        of(MdmStatus::Refused),
        of(MdmStatus::Started),
    )
}

/// The lines of the CSV export of `indices`.
fn csv_rows(deployments: &[GuiMdmDeployment], indices: &[usize]) -> Vec<Vec<String>> {
    let text = |value: &Option<String>| value.clone().unwrap_or_default();
    indices
        .iter()
        .filter_map(|&i| deployments.get(i))
        .map(|d| {
            vec![
                crate::format::local_datetime(d.requested_at),
                d.finished_at
                    .map(crate::format::local_datetime)
                    .unwrap_or_default(),
                package_label(d).to_string(),
                text(&d.version),
                action_label(&d.action).to_string(),
                status_display(d.status).0.to_string(),
                text(&d.method),
                text(&d.source),
                text(&d.refused_by),
                text(&d.message),
                text(&d.deployment_id),
                d.id.clone(),
            ]
        })
        .collect()
}

const CSV_HEADERS: [&str; 12] = [
    "demande_le",
    "termine_le",
    "paquet",
    "version",
    "action",
    "statut",
    "format",
    "source",
    "refuse_par",
    "message",
    "id_deploiement",
    "id_commande",
];

/// What the local configuration lets the platform deploy, read-only: it is
/// set in the agent's configuration file, not from this interface.
fn policy_card(ui: &mut Ui, policy: &GuiMdmPolicy) {
    // A plain card: there is nothing more to open behind these two lines.
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("RÉGLAGES DE CE POSTE")
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);
        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("Déploiements de la plateforme")
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
            if policy.enabled {
                widgets::status_badge(ui, "ACCEPTÉS", theme::SUCCESS);
            } else {
                widgets::status_badge(ui, "REFUSÉS", theme::WARNING);
            }
            ui.add_space(theme::SPACE_MD);
            ui.label(
                egui::RichText::new("Sources de paquets autorisées")
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
            if policy.allowed_hosts.is_empty() {
                widgets::status_badge(ui, "AUCUNE", theme::WARNING);
            }
            for host in &policy.allowed_hosts {
                let label = if host == "*" { "tout hôte" } else { host };
                widgets::status_badge(ui, label, theme::INFO);
            }
        });
        ui.add_space(theme::SPACE_XS);
        ui.label(
            egui::RichText::new(
                "Lecture seule : ces réglages (mdm_enabled, mdm_allowed_hosts) se modifient \
                 dans le fichier de configuration de l'agent. Un paquet n'est téléchargé \
                 qu'en HTTPS, depuis une source autorisée, et installé seulement si son \
                 empreinte SHA-256 correspond.",
            )
            .font(theme::font_min())
            .color(theme::text_secondary()),
        );
    });
}

/// The tab: local settings, summary, filters and the history table.
pub(super) fn show(
    ui: &mut Ui,
    state: &mut AppState,
    search_upper: &str,
    command: &mut Option<GuiCommand>,
) {
    // The history is read from the database when the tab opens: another
    // process (the service) may have run deployments since the last event.
    if !state.software.deployments_requested {
        state.software.deployments_requested = true;
        *command = Some(GuiCommand::RefreshMdmDeployments);
    }

    if let Some(policy) = state.software.mdm_policy.clone() {
        policy_card(ui, &policy);
        ui.add_space(theme::SPACE_MD);
    }

    let total = state.software.deployments.len();
    let (succeeded, failed, refused, running) = counts(&state.software.deployments);
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(crate::format::int(total as u64))
                    .font(theme::font_card_value())
                    .color(theme::text_primary())
                    .strong(),
            );
            ui.label(
                egui::RichText::new(if total > 1 {
                    "déploiements ordonnés par la plateforme"
                } else {
                    "déploiement ordonné par la plateforme"
                })
                .font(theme::font_body())
                .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_MD);
            for (count, singular, plural, color) in [
                (succeeded, "réussi", "réussis", theme::SUCCESS),
                (failed, "échec", "échecs", theme::ERROR),
                (refused, "refusé", "refusés", theme::WARNING),
                (running, "en cours", "en cours", theme::INFO),
            ] {
                // « En cours » only when something is: the three outcomes
                // always, so a zero reads as a zero.
                if count == 0 && singular == "en cours" {
                    continue;
                }
                let label = if count > 1 { plural } else { singular };
                widgets::status_badge(
                    ui,
                    &format!("{count} {label}"),
                    if count == 0 {
                        theme::text_tertiary()
                    } else {
                        color
                    },
                );
            }
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  Actualiser", icons::REFRESH))
                        .on_hover_text("Relit l'historique conservé sur ce poste.")
                        .clicked()
                    {
                        *command = Some(GuiCommand::RefreshMdmDeployments);
                    }
                },
            );
        });
    });

    ui.add_space(theme::SPACE_MD);

    let filter = state.software.deployment_filter;
    let mut rows = filtered(&state.software.deployments, search_upper, filter);
    order::sort(ui.ctx(), "software_deployments", &mut rows, |key, a, b| {
        let deployments = &state.software.deployments;
        compare(key, &deployments[a], &deployments[b])
    });

    let mut bar = widgets::SearchFilterBar::new(
        &mut state.software.search,
        "Rechercher un paquet, une version, une source ou un identifiant…",
    );
    for (status, label) in FILTERS {
        bar = bar.chip(label, filter == Some(status), status_display(status).1);
    }
    let (toggled, export) = bar
        .result_count(rows.len())
        .action(format!("{}  CSV", icons::DOWNLOAD))
        .show_with_action(ui);
    if let Some((status, _)) = toggled.and_then(|index| FILTERS.get(index)) {
        state.software.deployment_filter = if filter == Some(*status) {
            None
        } else {
            Some(*status)
        };
        state.software.deployments_page = 0;
    }
    if export {
        // The export is what the table shows: search and filter applied.
        let lines = csv_rows(&state.software.deployments, &rows);
        let path = crate::export::default_export_path("logiciels_deploiements_mdm.csv");
        let toast = match crate::export::export_csv(&CSV_HEADERS, &lines, &path) {
            Ok(()) => crate::widgets::toast::Toast::success("Export CSV réussi"),
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                crate::widgets::toast::Toast::error("Échec de l'export CSV")
            }
        };
        state.push_toast(toast, ui.ctx());
    }

    ui.add_space(theme::SPACE_SM);

    widgets::data_card(ui, "Déploiements MDM", |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("HISTORIQUE DES DÉPLOIEMENTS")
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.add_space(theme::SPACE_MD);

        if total == 0 {
            let detail = if state.summary.standalone {
                "Ce poste fonctionne en mode autonome : aucune plateforme ne peut y ordonner \
                 de déploiement. Une fois le poste relié à une plateforme, les installations, \
                 mises à jour et désinstallations qu'elle ordonne apparaîtront ici."
            } else {
                "Les installations, mises à jour et désinstallations ordonnées depuis la \
                 plateforme apparaissent ici, avec leur résultat : réussies, en échec, ou \
                 refusées par ce poste."
            };
            widgets::empty_state(ui, icons::CLOUD, "Aucun déploiement reçu", Some(detail));
            return;
        }
        if rows.is_empty() {
            widgets::empty_state(
                ui,
                icons::SEARCH,
                "Aucun résultat",
                Some("Aucun déploiement ne correspond à la recherche ou au filtre."),
            );
            if widgets::ghost_button(ui, "Effacer la recherche").clicked() {
                state.software.search.clear();
                state.software.deployment_filter = None;
                state.software.deployments_page = 0;
            }
            return;
        }

        use widgets::table;
        let (start, len, _) = widgets::page_window(
            rows.len(),
            ROWS_PER_PAGE,
            &mut state.software.deployments_page,
        );
        let selected = state.software.selected_package;
        let mut clicked: Option<usize> = None;
        let mut resorted = false;

        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(130.0, 0.0), // Date
                table::Col::fluid(160.0, 2.0), // Paquet
                table::Col::fluid(90.0, 0.5),  // Version
                table::Col::fluid(120.0, 0.0), // Action
                table::Col::fluid(100.0, 0.0), // Statut
                table::Col::fluid(180.0, 3.0), // Source
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            if order::headers(
                &mut header,
                "software_deployments",
                &[
                    ("DATE", Some("date")),
                    ("PAQUET", Some("package")),
                    ("VERSION", Some("version")),
                    ("ACTION", Some("action")),
                    ("STATUT", Some("status")),
                    ("SOURCE", Some("source")),
                ],
            ) {
                resorted = true;
            }
        })
        .body(|body| {
            body.rows(theme::TABLE_DATA_ROW_HEIGHT, len, |mut row| {
                let Some(&real_idx) = rows.get(start + row.index()) else {
                    return;
                };
                let Some(deployment) = state.software.deployments.get(real_idx) else {
                    return;
                };
                let is_selected = selected == Some(real_idx);
                row.set_selected(is_selected);

                row.col(|ui| {
                    table::cell_muted(ui, &crate::format::local_datetime(deployment.requested_at))
                        .on_hover_text(crate::format::local_datetime_secs(deployment.requested_at));
                });
                row.col(|ui| {
                    table::cell_stack(
                        ui,
                        package_label(deployment),
                        deployment.method.as_deref().unwrap_or(""),
                    );
                });
                row.col(|ui| {
                    match deployment.version.as_deref() {
                        Some(version) => table::cell_mono(ui, version),
                        None => table::cell_empty(ui),
                    };
                });
                row.col(|ui| {
                    table::cell(ui, action_label(&deployment.action));
                });
                row.col(|ui| {
                    let (label, color) = status_display(deployment.status);
                    widgets::status_badge(ui, label, color);
                });
                row.col(|ui| {
                    match deployment.source.as_deref() {
                        Some(source) => table::cell_mono_muted(ui, source),
                        None => table::cell_empty(ui),
                    };
                });

                if table::row_interaction(&row, is_selected) {
                    clicked = Some(real_idx);
                }
            });
        });

        if resorted {
            state.software.deployments_page = 0;
        }
        if let Some(index) = clicked {
            state.software.selected_package = Some(index);
            state.software.detail_open = true;
        }

        // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer,
        // and the page follows the selection.
        let mut position = state
            .software
            .selected_package
            .and_then(|real| rows.iter().position(|&r| r == real));
        if widgets::navigate_list(
            ui.ctx(),
            &mut position,
            rows.len(),
            &mut state.software.detail_open,
        ) && let Some(pos) = position
        {
            state.software.selected_package = Some(rows[pos]);
            state.software.deployments_page = pos / ROWS_PER_PAGE;
        }

        widgets::paginate_controls(
            ui,
            rows.len(),
            ROWS_PER_PAGE,
            &mut state.software.deployments_page,
        );
    });
}

/// Detail drawer of the deployment at `index`: everything the machine
/// kept, the whole message, and the identifiers to quote to the platform.
pub(super) fn drawer(ui: &mut Ui, state: &mut AppState, index: usize) {
    let Some(deployment) = state.software.deployments.get(index).cloned() else {
        return;
    };
    let (label, color) = status_display(deployment.status);
    let subtitle = format!(
        "{} · {}",
        action_label(&deployment.action),
        crate::format::local_datetime(deployment.requested_at)
    );
    let action = widgets::DetailDrawer::new(
        "software_deployment_detail",
        package_label(&deployment),
        icons::CLOUD,
    )
    .accent(color)
    .subtitle(&subtitle)
    .show(
        ui.ctx(),
        &mut state.software.detail_open,
        |ui| {
            widgets::detail_section(ui, "DÉPLOIEMENT");
            widgets::detail_field_badge(ui, "Statut", label, color);
            widgets::detail_field(ui, "Action", action_label(&deployment.action));
            widgets::detail_field(ui, "Paquet", package_label(&deployment));
            widgets::detail_mono(ui, "Version", deployment.version.as_deref().unwrap_or("—"));
            widgets::detail_field(
                ui,
                "Format",
                &deployment
                    .method
                    .as_deref()
                    .map_or_else(|| "—".to_string(), str::to_uppercase),
            );
            widgets::detail_mono(ui, "Source", deployment.source.as_deref().unwrap_or("—"));

            widgets::detail_section(ui, "DÉROULEMENT");
            widgets::detail_field(
                ui,
                "Demandé le",
                &crate::format::local_datetime_secs(deployment.requested_at),
            );
            widgets::detail_field(
                ui,
                "Terminé le",
                &deployment
                    .finished_at
                    .map_or_else(|| "—".to_string(), crate::format::local_datetime_secs),
            );
            if let Some(refused_by) = &deployment.refused_by {
                widgets::detail_field(ui, "Refusé par", refused_by);
            }
            if let Some(message) = &deployment.message {
                widgets::detail_text(
                    ui,
                    if deployment.status == MdmStatus::Succeeded {
                        "Résultat"
                    } else {
                        "Erreur"
                    },
                    message,
                );
            }

            widgets::detail_section(ui, "IDENTIFIANTS");
            widgets::detail_mono(
                ui,
                "Déploiement",
                deployment.deployment_id.as_deref().unwrap_or("—"),
            );
            widgets::detail_mono(ui, "Commande", &deployment.id);
            if let Some(software_id) = &deployment.software_id {
                widgets::detail_mono(ui, "Logiciel", software_id);
            }
        },
        &[widgets::DetailAction::secondary(
            "Copier l'identifiant",
            icons::COPY,
        )],
    );
    if action == Some(0) {
        // The identifier the platform knows the deployment by.
        ui.ctx().copy_text(
            deployment
                .deployment_id
                .clone()
                .unwrap_or_else(|| deployment.id.clone()),
        );
        state.push_toast(
            crate::widgets::toast::Toast::success("Identifiant copié"),
            ui.ctx(),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn deployment(id: &str, name: &str, status: MdmStatus) -> GuiMdmDeployment {
        GuiMdmDeployment {
            id: id.to_string(),
            deployment_id: Some(format!("dep-{id}")),
            software_id: Some("sw-1".to_string()),
            package_name: Some(name.to_string()),
            version: Some("1.0".to_string()),
            action: "install".to_string(),
            method: Some("pkg".to_string()),
            source: Some("https://cdn.example.com/app.pkg".to_string()),
            status,
            requested_at: chrono::Utc::now(),
            finished_at: None,
            message: None,
            refused_by: None,
        }
    }

    fn history() -> Vec<GuiMdmDeployment> {
        vec![
            deployment("1", "Firefox", MdmStatus::Succeeded),
            deployment("2", "7-Zip", MdmStatus::Failed),
            deployment("3", "TeamViewer", MdmStatus::Refused),
            deployment("4", "Slack", MdmStatus::Started),
            deployment("5", "Zoom", MdmStatus::Received),
        ]
    }

    #[test]
    fn the_filter_and_the_search_combine() {
        let history = history();
        assert_eq!(filtered(&history, "", None), [0, 1, 2, 3, 4]);
        assert_eq!(filtered(&history, "", Some(MdmStatus::Failed)), [1]);
        // A command received and not yet started is in progress too.
        assert_eq!(filtered(&history, "", Some(MdmStatus::Started)), [3, 4]);
        assert_eq!(filtered(&history, "ZIP", None), [1]);
        assert_eq!(filtered(&history, "DEP-3", None), [2]);
        assert_eq!(filtered(&history, "INSTALLATION", None).len(), 5);
        assert!(filtered(&history, "ZIP", Some(MdmStatus::Succeeded)).is_empty());
    }

    #[test]
    fn deployments_sort_by_status_rank_date_and_version() {
        use std::cmp::Ordering::{Greater, Less};
        let mut history = history();
        history[1].requested_at = history[0].requested_at + chrono::Duration::hours(1);
        history[1].version = Some("1.10".to_string());
        history[0].version = Some("1.9".to_string());
        // Failed before succeeded, in progress before both.
        assert_eq!(compare("status", &history[1], &history[0]), Less);
        assert_eq!(compare("status", &history[3], &history[1]), Less);
        assert_eq!(compare("date", &history[1], &history[0]), Greater);
        assert_eq!(compare("version", &history[1], &history[0]), Greater);
        assert_eq!(compare("package", &history[1], &history[0]), Less);
    }

    #[test]
    fn the_summary_counts_each_outcome_once() {
        assert_eq!(counts(&history()), (1, 1, 1, 2));
        assert_eq!(counts(&[]), (0, 0, 0, 0));
    }

    #[test]
    fn the_export_carries_the_shown_rows_with_every_column() {
        let mut history = history();
        history[2].refused_by = Some("Configuration de l'agent".to_string());
        let rows = filtered(&history, "", Some(MdmStatus::Refused));
        let lines = csv_rows(&history, &rows);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].len(), CSV_HEADERS.len());
        assert_eq!(lines[0][2], "TeamViewer");
        assert_eq!(lines[0][4], "Installation");
        assert_eq!(lines[0][5], "REFUSÉ");
        assert_eq!(lines[0][8], "Configuration de l'agent");
    }

    #[test]
    fn a_row_without_a_name_falls_back_on_its_identifier() {
        let mut unnamed = deployment("9", "", MdmStatus::Succeeded);
        unnamed.package_name = None;
        assert_eq!(package_label(&unnamed), "sw-1");
        unnamed.software_id = None;
        assert_eq!(package_label(&unnamed), "Paquet non nommé");
    }
}
