// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Premium n8n security-orchestration workspace.
//!
//! The page deliberately presents the integration as an operator cockpit,
//! rather than exposing n8n's technical API surface directly. Workflows stay
//! understandable, auditable and safe to launch from the agent.

use egui::{Color32, CornerRadius, RichText, Ui, Vec2};

use crate::{icons, theme, widgets};

pub struct OrchestrationPage;

#[derive(Clone, Copy)]
struct Workflow {
    name: &'static str,
    description: &'static str,
    trigger: &'static str,
    nodes: u8,
    success: &'static str,
    accent: Color32,
    icon: &'static str,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum WorkspaceView {
    Overview,
    Workflows,
    Marketplace,
    Executions,
    Governance,
}

impl WorkspaceView {
    const ALL: [(Self, &'static str, &'static str); 5] = [
        (Self::Overview, icons::GAUGE_HIGH, "Vue d'ensemble"),
        (Self::Workflows, icons::ORCHESTRATION, "Workflows"),
        (Self::Marketplace, icons::CUBE, "Marketplace"),
        (Self::Executions, icons::STREAM, "Exécutions"),
        (Self::Governance, icons::LOCK, "Gouvernance"),
    ];

    fn index(self) -> u8 {
        match self {
            Self::Overview => 0,
            Self::Workflows => 1,
            Self::Marketplace => 2,
            Self::Executions => 3,
            Self::Governance => 4,
        }
    }

    fn from_index(index: u8) -> Self {
        Self::ALL
            .get(index as usize)
            .map(|(view, ..)| *view)
            .unwrap_or(Self::Overview)
    }
}

#[derive(Clone, Copy)]
struct WorkflowTemplate {
    name: &'static str,
    category: &'static str,
    description: &'static str,
    installs: &'static str,
    nodes: &'static str,
    color: Color32,
    verified: bool,
}

const TEMPLATES: [WorkflowTemplate; 6] = [
    WorkflowTemplate {
        name: "CVE Critical Response",
        category: "VULNÉRABILITÉS",
        description: "Qualifie, priorise et ouvre automatiquement un incident pour chaque CVE critique.",
        installs: "2,4 k",
        nodes: "Qualys · OpenAI · TheHive",
        color: theme::ERROR,
        verified: true,
    },
    WorkflowTemplate {
        name: "Threat Intel Fusion",
        category: "THREAT INTEL",
        description: "Corrèle les IOC avec VirusTotal, Shodan et vos événements Wazuh.",
        installs: "1,8 k",
        nodes: "VirusTotal · Shodan · Wazuh",
        color: theme::AI,
        verified: true,
    },
    WorkflowTemplate {
        name: "ISO 27001 Evidence",
        category: "CONFORMITÉ",
        description: "Collecte les preuves, contrôle leur fraîcheur et génère le dossier d'audit.",
        installs: "986",
        nodes: "Sentinel · PDF · Email",
        color: theme::SUCCESS,
        verified: true,
    },
    WorkflowTemplate {
        name: "Executive Risk Brief",
        category: "REPORTING",
        description: "Produit un rapport exécutif contextualisé et prêt pour le comité des risques.",
        installs: "754",
        nodes: "LLM privé · PDF · Slack",
        color: theme::INFO,
        verified: true,
    },
    WorkflowTemplate {
        name: "Phishing Triage",
        category: "INCIDENT",
        description: "Analyse une pièce jointe, enrichit les indicateurs et propose une réponse.",
        installs: "1,2 k",
        nodes: "Email · Sandbox · TheHive",
        color: theme::WARNING,
        verified: true,
    },
    WorkflowTemplate {
        name: "Asset Exposure Watch",
        category: "SURFACE D'ATTAQUE",
        description: "Surveille les nouveaux services exposés et avertit les propriétaires d'actifs.",
        installs: "643",
        nodes: "Shodan · Sentinel · SMS",
        color: theme::ACCENT_LIGHT,
        verified: false,
    },
];

const WORKFLOWS: [Workflow; 3] = [
    Workflow {
        name: "Vulnerability Radar",
        description: "Qualys → enrichissement Shodan & VirusTotal → ticket TheHive",
        trigger: "Toutes les 4 h",
        nodes: 8,
        success: "99,8 %",
        accent: theme::INFO,
        icon: icons::SHIELD_VIRUS,
    },
    Workflow {
        name: "Incident Containment",
        description: "Wazuh → analyse IA → validation humaine → isolement de l'hôte",
        trigger: "Webhook signé",
        nodes: 6,
        success: "100 %",
        accent: theme::AI,
        icon: icons::BOLT,
    },
    Workflow {
        name: "Executive Reporting",
        description: "Agrégation SSI → synthèse LLM → rapport PDF → email chiffré",
        trigger: "Chaque lundi",
        nodes: 7,
        success: "98,4 %",
        accent: theme::SUCCESS,
        icon: icons::FILE_EXPORT,
    },
];

impl OrchestrationPage {
    pub fn show(ui: &mut Ui) {
        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Automatisation", "Orchestration"],
            "Orchestration",
            Some("Automatisez votre SOC avec des workflows gouvernés, augmentés par l'IA."),
            Some(
                "Les exécutions n8n sont isolées par tenant, soumises aux droits du rôle actif et journalisées de bout en bout.",
            ),
        );
        let view = Self::workspace_tabs(ui);
        ui.add_space(theme::SPACE_LG);
        match view {
            WorkspaceView::Overview => Self::overview(ui),
            WorkspaceView::Workflows => Self::workflow_workspace(ui),
            WorkspaceView::Marketplace => Self::marketplace(ui),
            WorkspaceView::Executions => Self::execution_history(ui),
            WorkspaceView::Governance => Self::governance(ui),
        }
    }

    fn workspace_tabs(ui: &mut Ui) -> WorkspaceView {
        let id = egui::Id::new("orchestration_workspace_view");
        let current = WorkspaceView::from_index(ui.ctx().data(|d| d.get_temp(id).unwrap_or(0)));
        egui::Frame::new()
            .fill(theme::bg_secondary())
            .stroke(egui::Stroke::new(
                theme::BORDER_HAIRLINE,
                theme::border_subtle(),
            ))
            .corner_radius(CornerRadius::same(theme::ROUNDING_MD))
            .inner_margin(egui::Margin::same(4))
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    for (view, icon, label) in WorkspaceView::ALL {
                        let selected = current == view;
                        let button = egui::Button::new(
                            RichText::new(format!("{icon}  {label}"))
                                .font(theme::font_body_sm_medium())
                                .color(if selected {
                                    theme::text_on_accent()
                                } else {
                                    theme::text_secondary()
                                }),
                        )
                        .fill(if selected {
                            theme::ACCENT
                        } else {
                            Color32::TRANSPARENT
                        })
                        .stroke(egui::Stroke::NONE)
                        .corner_radius(CornerRadius::same(theme::ROUNDING_SM));
                        if ui.add_sized([140.0, 36.0], button).clicked() {
                            ui.ctx().data_mut(|d| d.insert_temp(id, view.index()));
                        }
                    }
                });
            });
        WorkspaceView::from_index(ui.ctx().data(|d| d.get_temp(id).unwrap_or(0)))
    }

    fn overview(ui: &mut Ui) {
        Self::command_deck(ui);
        ui.add_space(theme::SPACE_LG);
        Self::metrics(ui);
        ui.add_space(theme::SPACE_LG);
        let wide = ui.available_width() >= 920.0;
        if wide {
            ui.columns(2, |columns| {
                Self::workflows(&mut columns[0]);
                Self::ai_copilot(&mut columns[1]);
            });
        } else {
            Self::workflows(ui);
            ui.add_space(theme::SPACE_LG);
            Self::ai_copilot(ui);
        }
        ui.add_space(theme::SPACE_LG);
        Self::execution_stream(ui);
        ui.add_space(theme::SPACE_LG);
        Self::connectors(ui);
    }

    fn command_deck(ui: &mut Ui) {
        let rect = widgets::Card::new().accent(theme::AI).show(ui, |ui| {
            widgets::eyebrow(ui, "NEXUS AUTOMATION CLOUD");
            ui.add_space(theme::SPACE_SM);
            ui.label(
                RichText::new("Votre défense, orchestrée en temps réel.")
                    .font(theme::font_title())
                    .color(theme::text_primary()),
            );
            ui.add_space(theme::SPACE_SM);
            ui.label(
                RichText::new("n8n auto-hébergé · SSO actif · Webhooks HMAC · Journal immuable")
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_LG);
            ui.horizontal_wrapped(|ui| {
                widgets::status_badge(ui, "n8n connecté", theme::SUCCESS);
                if widgets::primary_button(ui, format!("{}  Nouveau workflow", icons::PLUS), true)
                    .clicked()
                {
                    ui.ctx()
                        .data_mut(|d| d.insert_temp(egui::Id::new("orchestration_ai_open"), true));
                }
            });
        });

        // A quiet violet bloom makes this card the page's command surface
        // without competing with semantic status colors.
        ui.painter().circle_filled(
            rect.right_top() + egui::vec2(-72.0, 28.0),
            64.0,
            theme::AI.linear_multiply(0.035),
        );
    }

    fn metrics(ui: &mut Ui) {
        let metrics = [
            ("12", "Workflows actifs", "+2 ce mois", theme::ACCENT_LIGHT),
            (
                "1 284",
                "Exécutions / 30 j",
                "99,6 % réussies",
                theme::SUCCESS,
            ),
            ("38 h", "Temps SOC économisé", "+18 %", theme::AI),
            ("4,2 s", "Temps de réponse", "P95 · 8,7 s", theme::INFO),
        ];
        widgets::ResponsiveGrid::new(190.0, theme::SPACE_MD).show(
            ui,
            &metrics,
            |ui, width, &(value, label, detail, color)| {
                ui.set_width(width);
                widgets::Card::new()
                    .padding(theme::SPACE_MD)
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            widgets::status_dot(ui, color);
                            ui.label(
                                RichText::new(label)
                                    .font(theme::font_body_sm_medium())
                                    .color(theme::text_secondary()),
                            );
                        });
                        ui.add_space(theme::SPACE_SM);
                        ui.label(
                            RichText::new(value)
                                .font(theme::font_heading())
                                .color(theme::text_primary()),
                        );
                        ui.label(
                            RichText::new(detail)
                                .font(theme::font_caption())
                                .color(theme::readable_color(color)),
                        );
                    });
            },
        );
    }

    fn workflows(ui: &mut Ui) {
        Self::section_title(ui, "Workflows critiques", "3 actifs", theme::SUCCESS);
        for (index, workflow) in WORKFLOWS.iter().enumerate() {
            ui.add_space(theme::SPACE_SM);
            widgets::Card::new()
                .padding(theme::SPACE_MD)
                .accent(workflow.accent)
                .interactive(true)
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        Self::icon_tile(ui, workflow.icon, workflow.accent);
                        ui.vertical(|ui| {
                            ui.set_max_width((ui.available_width() - theme::SPACE_SM).max(120.0));
                            ui.label(
                                RichText::new(workflow.name)
                                    .font(theme::font_body_strong())
                                    .color(theme::text_primary()),
                            );
                            ui.label(
                                RichText::new(workflow.description)
                                    .font(theme::font_body_sm())
                                    .color(theme::text_secondary()),
                            );
                        });
                    });
                    ui.add_space(theme::SPACE_MD);
                    ui.horizontal_wrapped(|ui| {
                        Self::metadata(ui, icons::CLOCK, workflow.trigger);
                        Self::metadata(
                            ui,
                            icons::LAYER_GROUP,
                            &format!("{} nœuds", workflow.nodes),
                        );
                        Self::metadata(ui, icons::CHECK, workflow.success);
                    });
                    ui.add_space(theme::SPACE_SM);
                    let id = egui::Id::new(("workflow_running", index));
                    let running = ui.ctx().data(|d| d.get_temp::<bool>(id).unwrap_or(false));
                    let label = if running {
                        "Exécution lancée"
                    } else {
                        "Exécuter"
                    };
                    if widgets::secondary_button(
                        ui,
                        format!(
                            "{}  {label}",
                            if running { icons::CHECK } else { icons::PLAY }
                        ),
                        !running,
                    )
                    .clicked()
                    {
                        ui.ctx().data_mut(|d| d.insert_temp(id, true));
                    }
                });
        }
    }

    fn ai_copilot(ui: &mut Ui) {
        Self::section_title(ui, "Architecte IA", "Contexte sécurisé", theme::AI);
        ui.add_space(theme::SPACE_SM);
        widgets::Card::new().accent(theme::AI).show(ui, |ui| {
            ui.horizontal(|ui| {
                Self::icon_tile(ui, icons::WAND_SPARKLES, theme::AI);
                ui.vertical(|ui| {
                    widgets::eyebrow(ui, "SUGGESTION CONTEXTUELLE");
                    ui.label(
                        RichText::new("Réponse zero-day adaptative")
                            .font(theme::font_body_strong())
                            .color(theme::text_primary()),
                    );
                });
            });
            ui.add_space(theme::SPACE_MD);
            ui.label(
                RichText::new("J'ai détecté 2 actifs exposés et 5 vulnérabilités élevées. Je recommande un workflow de qualification puis d'isolement avec validation humaine.")
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_MD);
            for (icon, text) in [
                (icons::GLOBE, "Enrichir avec Shodan + VirusTotal"),
                (icons::BRAIN, "Classer la menace avec le LLM privé"),
                (icons::USER, "Obtenir l'approbation du responsable SOC"),
                (icons::SHIELD, "Isoler via Wazuh et notifier Slack"),
            ] {
                ui.horizontal(|ui| {
                    ui.label(RichText::new(icon).color(theme::readable_color(theme::AI)));
                    ui.label(RichText::new(text).font(theme::font_body_sm()).color(theme::text_secondary()));
                });
            }
            ui.add_space(theme::SPACE_LG);
            let open = ui.ctx().data(|d| d.get_temp::<bool>(egui::Id::new("orchestration_ai_open")).unwrap_or(false));
            if widgets::primary_button(ui, if open { "Brouillon prêt à réviser" } else { "Générer le workflow" }, !open).clicked() {
                ui.ctx().data_mut(|d| d.insert_temp(egui::Id::new("orchestration_ai_open"), true));
            }
            ui.add_space(theme::SPACE_SM);
            ui.label(RichText::new("Aucune action destructive sans approbation · RBAC appliqué")
                .font(theme::font_caption()).color(theme::text_tertiary()));
        });
    }

    fn execution_stream(ui: &mut Ui) {
        Self::section_title(ui, "Flux d'exécution", "Temps réel", theme::INFO);
        ui.add_space(theme::SPACE_SM);
        widgets::Card::new()
            .padding(theme::SPACE_MD)
            .show(ui, |ui| {
                let rows = [
                    (
                        "14:32:08",
                        "Vulnerability Radar",
                        "8 / 8 étapes",
                        "Réussie",
                        theme::SUCCESS,
                    ),
                    (
                        "14:18:41",
                        "Incident Containment",
                        "En attente d'approbation",
                        "Suspendue",
                        theme::WARNING,
                    ),
                    (
                        "13:00:02",
                        "Threat Intel Daily",
                        "12 / 12 étapes",
                        "Réussie",
                        theme::SUCCESS,
                    ),
                ];
                for (i, (time, name, detail, status, color)) in rows.iter().enumerate() {
                    if i > 0 {
                        widgets::divider_thin(ui);
                    }
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(*time)
                                .font(theme::font_mono_sm())
                                .color(theme::text_tertiary()),
                        );
                        widgets::status_dot_animated(ui, *color, *status == "Suspendue");
                        ui.vertical(|ui| {
                            ui.label(
                                RichText::new(*name)
                                    .font(theme::font_body_sm_medium())
                                    .color(theme::text_primary()),
                            );
                            ui.label(
                                RichText::new(*detail)
                                    .font(theme::font_caption())
                                    .color(theme::text_tertiary()),
                            );
                        });
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            widgets::status_badge(ui, status, *color);
                        });
                    });
                }
            });
    }

    fn workflow_workspace(ui: &mut Ui) {
        ui.label(
            RichText::new("Bibliothèque de workflows")
                .font(theme::font_h2())
                .color(theme::text_primary()),
        );
        ui.label(
            RichText::new("Déclenchez, planifiez et paramétrez vos automatisations n8n.")
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );
        ui.add_space(theme::SPACE_MD);
        ui.horizontal_wrapped(|ui| {
            widgets::primary_button(ui, format!("{}  Créer", icons::PLUS), true);
            widgets::secondary_button(ui, format!("{}  Importer", icons::DOWNLOAD), true);
        });
        ui.add_space(theme::SPACE_LG);

        let selected_id = egui::Id::new("orchestration_selected_workflow");
        let selected = ui
            .ctx()
            .data(|d| d.get_temp::<usize>(selected_id).unwrap_or(0));
        let wide = ui.available_width() >= 900.0;
        if wide {
            ui.columns(2, |columns| {
                for (index, workflow) in WORKFLOWS.iter().enumerate() {
                    Self::workflow_selector(
                        &mut columns[0],
                        workflow,
                        index,
                        selected == index,
                        selected_id,
                    );
                }
                Self::launch_configuration(
                    &mut columns[1],
                    &WORKFLOWS[selected.min(WORKFLOWS.len() - 1)],
                    selected,
                );
            });
        } else {
            for (index, workflow) in WORKFLOWS.iter().enumerate() {
                Self::workflow_selector(ui, workflow, index, selected == index, selected_id);
            }
            ui.add_space(theme::SPACE_LG);
            Self::launch_configuration(ui, &WORKFLOWS[selected.min(WORKFLOWS.len() - 1)], selected);
        }
        ui.add_space(theme::SPACE_LG);
        Self::workflow_canvas(ui);
    }

    fn workflow_selector(
        ui: &mut Ui,
        workflow: &Workflow,
        index: usize,
        selected: bool,
        id: egui::Id,
    ) {
        ui.add_space(theme::SPACE_SM);
        let response = widgets::clickable_card(ui, ("workflow_selector", index), |ui| {
            ui.horizontal(|ui| {
                Self::icon_tile(ui, workflow.icon, workflow.accent);
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(workflow.name)
                            .font(theme::font_body_strong())
                            .color(theme::text_primary()),
                    );
                    ui.label(
                        RichText::new(workflow.trigger)
                            .font(theme::font_caption())
                            .color(theme::text_tertiary()),
                    );
                });
                widgets::status_badge(
                    ui,
                    if selected { "Sélectionné" } else { "Actif" },
                    if selected {
                        theme::INFO
                    } else {
                        theme::SUCCESS
                    },
                );
            });
        });
        if response.clicked() {
            ui.ctx().data_mut(|d| d.insert_temp(id, index));
        }
    }

    fn launch_configuration(ui: &mut Ui, workflow: &Workflow, index: usize) {
        Self::section_title(
            ui,
            "Paramètres d'exécution",
            "Validation requise",
            theme::WARNING,
        );
        ui.add_space(theme::SPACE_SM);
        widgets::Card::new().accent(workflow.accent).show(ui, |ui| {
            ui.label(RichText::new(workflow.name).font(theme::font_h3()).color(theme::text_primary()));
            ui.label(RichText::new("Les secrets sont injectés côté backend et ne transitent jamais dans l'interface.").font(theme::font_caption()).color(theme::text_tertiary()));
            ui.add_space(theme::SPACE_MD);

            widgets::eyebrow(ui, "MODE D'EXÉCUTION");
            let mode_id = egui::Id::new(("workflow_run_mode", index));
            let run_id = egui::Id::new(("workflow_config_run", index));
            let approval_id = egui::Id::new(("workflow_approval", index));
            let mut mode = ui.ctx().data(|d| d.get_temp::<usize>(mode_id).unwrap_or(0));
            if let Some(next) = widgets::button_group(ui, &["Dry-run", "Production"], mode) {
                mode = next;
                ui.ctx().data_mut(|d| {
                    d.insert_temp(mode_id, mode);
                    d.insert_temp(run_id, false);
                    d.insert_temp(approval_id, false);
                });
            }
            ui.label(
                RichText::new(if mode == 0 {
                    "Simulation isolée : aucun changement ne sera appliqué aux actifs."
                } else {
                    "Mode réel : les actions approuvées pourront modifier les actifs ciblés."
                })
                .font(theme::font_caption())
                .color(if mode == 0 { theme::text_tertiary() } else { theme::readable_color(theme::WARNING) }),
            );

            ui.add_space(theme::SPACE_LG);
            let scope = Self::dynamic_field(ui, (index, "scope"), "Périmètre cible", "production-eu/*", false);
            let severity = Self::dynamic_field(ui, (index, "severity"), "Sévérité minimale", "high", false);
            let ticket = Self::dynamic_field(ui, (index, "ticket"), "Ticket de changement", "CHG-2026-", false);
            let _token = Self::dynamic_field(ui, (index, "token"), "Jeton API", "Secret géré par Vault", true);

            let scope_valid = !scope.trim().is_empty() && scope.trim() != "*";
            let severity_valid = ["critical", "high", "medium", "low"].contains(&severity.trim());
            let ticket_valid = ticket.starts_with("CHG-") && ticket.len() > 9;
            if !scope_valid {
                Self::field_error(ui, "Le périmètre global « * » est interdit. Sélectionnez un tenant, une zone ou un actif.");
            }
            if !severity_valid {
                Self::field_error(ui, "Valeur attendue : critical, high, medium ou low.");
            }
            if !ticket_valid {
                Self::field_error(ui, "Un ticket de changement complet au format CHG-… est requis.");
            }

            ui.add_space(theme::SPACE_SM);
            egui::Frame::new()
                .fill(theme::tinted_surface(if mode == 0 { theme::INFO } else { theme::WARNING }))
                .corner_radius(CornerRadius::same(theme::ROUNDING_MD))
                .inner_margin(egui::Margin::same(12))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        widgets::icon_tile(ui, if mode == 0 { icons::EYE } else { icons::SHIELD }, if mode == 0 { theme::INFO } else { theme::WARNING }, 32.0);
                        ui.vertical(|ui| {
                            ui.label(RichText::new(if mode == 0 { "Impact nul" } else { "Impact contrôlé" }).font(theme::font_body_sm_medium()).color(theme::text_primary()));
                            ui.label(RichText::new(format!("{} nœuds · périmètre {} · rollback journalisé", workflow.nodes, if scope_valid { "validé" } else { "invalide" })).font(theme::font_caption()).color(theme::text_secondary()));
                        });
                    });
                });
            ui.add_space(theme::SPACE_MD);
            let mut approved = ui.ctx().data(|d| d.get_temp(approval_id).unwrap_or(false));
            let approval_label = if mode == 0 {
                "J'ai vérifié le périmètre de simulation"
            } else {
                "J'ai vérifié le périmètre et autorise cette exécution en production"
            };
            if ui.checkbox(&mut approved, approval_label).changed() {
                ui.ctx().data_mut(|d| d.insert_temp(approval_id, approved));
            }
            ui.add_space(theme::SPACE_MD);
            let launched = ui.ctx().data(|d| d.get_temp(run_id).unwrap_or(false));
            let valid = scope_valid && severity_valid && ticket_valid && approved;
            if widgets::primary_button(
                ui,
                if launched {
                    "Exécution créée · #EX-2841"
                } else if mode == 0 {
                    "Simuler le workflow"
                } else {
                    "Lancer en sécurité"
                },
                valid && !launched,
            )
            .clicked()
            {
                ui.ctx().data_mut(|d| d.insert_temp(run_id, true));
            }
            if launched {
                ui.add_space(theme::SPACE_SM);
                widgets::alert_success(
                    ui,
                    "#EX-2841 créée, signée et inscrite au journal d'audit. Suivez-la dans Exécutions.",
                );
                if widgets::ghost_button(ui, "Préparer une nouvelle exécution").clicked() {
                    ui.ctx().data_mut(|d| {
                        d.insert_temp(run_id, false);
                        d.insert_temp(approval_id, false);
                    });
                }
            } else {
                ui.label(RichText::new("Validation de schéma · Signature HMAC · Idempotence · Trace d'audit").font(theme::font_caption()).color(theme::text_tertiary()));
            }
        });
    }

    fn dynamic_field(
        ui: &mut Ui,
        salt: impl std::hash::Hash,
        label: &str,
        placeholder: &str,
        secret: bool,
    ) -> String {
        let id = ui.id().with(salt);
        let mut value = ui.ctx().data(|d| {
            d.get_temp::<String>(id).unwrap_or_else(|| {
                if secret {
                    String::new()
                } else {
                    placeholder.to_owned()
                }
            })
        });
        ui.label(
            RichText::new(label)
                .font(theme::font_body_sm_medium())
                .color(theme::text_secondary()),
        );
        let edit = egui::TextEdit::singleline(&mut value)
            .hint_text(placeholder)
            .password(secret)
            .desired_width(f32::INFINITY);
        if ui.add(edit).changed() {
            ui.ctx().data_mut(|d| d.insert_temp(id, value.clone()));
        }
        ui.add_space(theme::SPACE_SM);
        value
    }

    fn field_error(ui: &mut Ui, message: &str) {
        ui.horizontal(|ui| {
            ui.label(RichText::new(icons::WARNING).color(theme::readable_color(theme::ERROR)));
            ui.label(
                RichText::new(message)
                    .font(theme::font_caption())
                    .color(theme::readable_color(theme::ERROR)),
            );
        });
    }

    fn workflow_canvas(ui: &mut Ui) {
        Self::section_title(ui, "Aperçu low-code", "Lecture seule", theme::AI);
        ui.add_space(theme::SPACE_SM);
        widgets::Card::new().show(ui, |ui| {
            ui.horizontal_wrapped(|ui| {
                let nodes = [
                    (icons::BOLT, "Webhook", theme::INFO),
                    (icons::FILTER, "Filtrer", theme::ACCENT_LIGHT),
                    (icons::GLOBE, "Enrichir", theme::AI),
                    (icons::BRAIN, "Analyser IA", theme::AI),
                    (icons::USER, "Approuver", theme::WARNING),
                    (icons::SHIELD, "Répondre", theme::SUCCESS),
                ];
                for (position, (icon, name, color)) in nodes.iter().enumerate() {
                    egui::Frame::new()
                        .fill(theme::tinted_surface(*color))
                        .stroke(egui::Stroke::new(
                            theme::BORDER_THIN,
                            theme::readable_color(*color).linear_multiply(0.45),
                        ))
                        .corner_radius(CornerRadius::same(theme::ROUNDING_MD))
                        .inner_margin(egui::Margin::symmetric(14, 12))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                ui.label(RichText::new(*icon).color(theme::readable_color(*color)));
                                ui.label(
                                    RichText::new(*name)
                                        .font(theme::font_body_sm_medium())
                                        .color(theme::text_primary()),
                                );
                            });
                        });
                    if position + 1 < nodes.len() {
                        ui.label(RichText::new(icons::ARROW_RIGHT).color(theme::text_tertiary()));
                    }
                }
            });
        });
    }

    fn marketplace(ui: &mut Ui) {
        ui.label(
            RichText::new("Marketplace SSI")
                .font(theme::font_h2())
                .color(theme::text_primary()),
        );
        ui.label(
            RichText::new("Templates vérifiés, versionnés et prêts à déployer dans votre tenant.")
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );
        ui.add_space(theme::SPACE_LG);
        widgets::Card::new().accent(theme::AI).show(ui, |ui| {
            ui.horizontal(|ui| {
                Self::icon_tile(ui, icons::WAND_SPARKLES, theme::AI);
                ui.vertical(|ui| {
                    ui.label(RichText::new("Décrivez votre besoin, Sentinel construit le workflow").font(theme::font_body_strong()).color(theme::text_primary()));
                    ui.label(RichText::new("Exemple : surveiller mes domaines, enrichir les nouveaux ports et créer une alerte critique.").font(theme::font_body_sm()).color(theme::text_secondary()));
                });
            });
            ui.add_space(theme::SPACE_MD);
            widgets::primary_button(ui, "Composer avec l'IA", true);
        });
        ui.add_space(theme::SPACE_LG);
        widgets::ResponsiveGrid::new(330.0, theme::SPACE_MD).show(
            ui,
            &TEMPLATES,
            |ui, width, template| {
                ui.set_width(width);
                widgets::Card::new().accent(template.color).show(ui, |ui| {
                    ui.horizontal(|ui| {
                        widgets::eyebrow(ui, template.category);
                        if template.verified {
                            widgets::status_badge(ui, "Vérifié", theme::SUCCESS);
                        }
                    });
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        RichText::new(template.name)
                            .font(theme::font_h3())
                            .color(theme::text_primary()),
                    );
                    ui.label(
                        RichText::new(template.description)
                            .font(theme::font_body_sm())
                            .color(theme::text_secondary()),
                    );
                    ui.add_space(theme::SPACE_MD);
                    ui.label(
                        RichText::new(template.nodes)
                            .font(theme::font_caption())
                            .color(theme::text_tertiary()),
                    );
                    ui.horizontal(|ui| {
                        Self::metadata(ui, icons::DOWNLOAD, template.installs);
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            let install_id = egui::Id::new(("marketplace_install", template.name));
                            let installed = ui
                                .ctx()
                                .data(|d| d.get_temp::<bool>(install_id).unwrap_or(false));
                            if widgets::secondary_button(
                                ui,
                                if installed {
                                    "Installé dans le tenant"
                                } else {
                                    "Installer"
                                },
                                !installed,
                            )
                            .clicked()
                            {
                                ui.ctx().data_mut(|d| d.insert_temp(install_id, true));
                            }
                            if installed {
                                widgets::status_badge(ui, "Signé", theme::SUCCESS);
                            }
                        });
                    });
                });
            },
        );
    }

    fn execution_history(ui: &mut Ui) {
        ui.horizontal_wrapped(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("Historique d'exécution")
                        .font(theme::font_h2())
                        .color(theme::text_primary()),
                );
                ui.label(
                    RichText::new(
                        "Traçabilité complète des déclenchements manuels, planifiés et webhook.",
                    )
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );
            });
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                widgets::secondary_button(ui, format!("{}  Exporter CSV", icons::DOWNLOAD), true);
            });
        });
        ui.add_space(theme::SPACE_LG);
        Self::execution_stream(ui);
        ui.add_space(theme::SPACE_LG);
        widgets::Card::new().show(ui, |ui| {
            Self::section_title(ui, "Exécution #EX-2837", "Suspendue", theme::WARNING);
            ui.add_space(theme::SPACE_MD);
            for (time, title, detail, color) in [
                (
                    "14:18:41.002",
                    "Webhook authentifié",
                    "Signature HMAC vérifiée · tenant acme-eu",
                    theme::SUCCESS,
                ),
                (
                    "14:18:41.419",
                    "Contexte Wazuh chargé",
                    "Alerte 160503 · poste FIN-WS-042",
                    theme::SUCCESS,
                ),
                (
                    "14:18:43.108",
                    "Analyse LLM terminée",
                    "Confiance 96 % · données sensibles expurgées",
                    theme::AI,
                ),
                (
                    "14:18:43.251",
                    "Approbation humaine requise",
                    "Expiration dans 12 min · SOC Manager",
                    theme::WARNING,
                ),
            ] {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(time)
                            .font(theme::font_mono_sm())
                            .color(theme::text_tertiary()),
                    );
                    widgets::status_dot(ui, color);
                    ui.vertical(|ui| {
                        ui.label(
                            RichText::new(title)
                                .font(theme::font_body_sm_medium())
                                .color(theme::text_primary()),
                        );
                        ui.label(
                            RichText::new(detail)
                                .font(theme::font_caption())
                                .color(theme::text_tertiary()),
                        );
                    });
                });
                ui.add_space(theme::SPACE_MD);
            }

            widgets::divider_thin(ui);
            ui.add_space(theme::SPACE_SM);
            let decision_id = egui::Id::new("execution_2837_decision");
            let decision = ui
                .ctx()
                .data(|d| d.get_temp::<u8>(decision_id).unwrap_or(0));
            ui.horizontal_wrapped(|ui| {
                if decision == 0 {
                    if widgets::primary_button(
                        ui,
                        format!("{}  Approuver et reprendre", icons::CHECK),
                        true,
                    )
                    .clicked()
                    {
                        ui.ctx().data_mut(|d| d.insert_temp(decision_id, 1));
                    }
                    if widgets::destructive_button(ui, "Refuser", true).clicked() {
                        ui.ctx().data_mut(|d| d.insert_temp(decision_id, 2));
                    }
                    ui.label(
                        RichText::new(
                            "Principe des quatre yeux : le demandeur ne peut pas approuver.",
                        )
                        .font(theme::font_caption())
                        .color(theme::text_tertiary()),
                    );
                } else {
                    widgets::status_badge(
                        ui,
                        if decision == 1 {
                            "Approuvée · reprise"
                        } else {
                            "Refusée · clôturée"
                        },
                        if decision == 1 {
                            theme::SUCCESS
                        } else {
                            theme::ERROR
                        },
                    );
                    ui.label(
                        RichText::new("Décision signée, horodatée et ajoutée à la chaîne d'audit.")
                            .font(theme::font_caption())
                            .color(theme::text_secondary()),
                    );
                }
            });
        });
    }

    fn governance(ui: &mut Ui) {
        ui.label(
            RichText::new("Gouvernance & sécurité")
                .font(theme::font_h2())
                .color(theme::text_primary()),
        );
        ui.label(
            RichText::new("Contrôles tenant, permissions par workflow et garanties de transport.")
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );
        ui.add_space(theme::SPACE_LG);
        let controls = [
            (
                icons::BUILDING,
                "Isolation multi-tenant",
                "Espaces, credentials et journaux cloisonnés",
                "Actif",
                theme::SUCCESS,
            ),
            (
                icons::KEY,
                "SSO OAuth 2.1 + PKCE",
                "Session courte, rotation et révocation centralisées",
                "Forcé",
                theme::SUCCESS,
            ),
            (
                icons::FINGERPRINT,
                "Webhooks HMAC-SHA256",
                "Anti-rejeu, timestamp et secret rotatif",
                "Vérifié",
                theme::SUCCESS,
            ),
            (
                icons::CLIPBOARD_CHECK,
                "Journal d'audit",
                "Identité, paramètres masqués, résultat et empreinte",
                "365 jours",
                theme::INFO,
            ),
        ];
        widgets::ResponsiveGrid::new(320.0, theme::SPACE_MD).show(
            ui,
            &controls,
            |ui, width, &(icon, title, detail, status, color)| {
                ui.set_width(width);
                widgets::Card::new().accent(color).show(ui, |ui| {
                    ui.horizontal(|ui| {
                        Self::icon_tile(ui, icon, color);
                        ui.vertical(|ui| {
                            ui.label(
                                RichText::new(title)
                                    .font(theme::font_body_strong())
                                    .color(theme::text_primary()),
                            );
                            ui.label(
                                RichText::new(detail)
                                    .font(theme::font_body_sm())
                                    .color(theme::text_secondary()),
                            );
                        });
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            widgets::status_badge(ui, status, color);
                        });
                    });
                });
            },
        );
        ui.add_space(theme::SPACE_LG);
        Self::section_title(ui, "Matrice des autorisations", "RBAC", theme::AI);
        ui.add_space(theme::SPACE_SM);
        widgets::Card::new().show(ui, |ui| {
            egui::Grid::new("orchestration_rbac")
                .num_columns(5)
                .striped(true)
                .spacing([28.0, 14.0])
                .show(ui, |ui| {
                    for title in ["Rôle", "Consulter", "Exécuter", "Modifier", "Approuver"] {
                        ui.label(
                            RichText::new(title)
                                .font(theme::font_body_sm_medium())
                                .color(theme::text_secondary()),
                        );
                    }
                    ui.end_row();
                    for (role, rights) in [
                        ("SOC Manager", [true, true, true, true]),
                        ("Analyste", [true, true, false, false]),
                        ("Auditeur", [true, false, false, false]),
                        ("Administrateur tenant", [true, true, true, false]),
                    ] {
                        ui.label(
                            RichText::new(role)
                                .font(theme::font_body_sm_medium())
                                .color(theme::text_primary()),
                        );
                        for granted in rights {
                            ui.label(
                                RichText::new(if granted {
                                    icons::CIRCLE_CHECK
                                } else {
                                    icons::XMARK
                                })
                                .color(if granted {
                                    theme::SUCCESS
                                } else {
                                    theme::text_tertiary()
                                }),
                            );
                        }
                        ui.end_row();
                    }
                });
        });
        ui.add_space(theme::SPACE_LG);
        Self::connectors(ui);
    }

    fn connectors(ui: &mut Ui) {
        Self::section_title(ui, "Écosystème connecté", "8 intégrations", theme::SUCCESS);
        ui.add_space(theme::SPACE_SM);
        ui.horizontal_wrapped(|ui| {
            for (name, state) in [
                ("VirusTotal", true),
                ("Shodan", true),
                ("TheHive", true),
                ("Wazuh", true),
                ("Qualys", true),
                ("Slack", true),
                ("Email", true),
                ("OpenAI", false),
            ] {
                egui::Frame::new()
                    .fill(theme::bg_secondary())
                    .stroke(egui::Stroke::new(
                        theme::BORDER_HAIRLINE,
                        theme::border_subtle(),
                    ))
                    .corner_radius(CornerRadius::same(theme::ROUNDING_MD))
                    .inner_margin(egui::Margin::symmetric(12, 9))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            widgets::status_dot(
                                ui,
                                if state {
                                    theme::SUCCESS
                                } else {
                                    theme::WARNING
                                },
                            );
                            ui.label(
                                RichText::new(name)
                                    .font(theme::font_body_sm_medium())
                                    .color(theme::text_primary()),
                            );
                            ui.label(
                                RichText::new(if state { "Actif" } else { "À configurer" })
                                    .font(theme::font_caption())
                                    .color(theme::text_tertiary()),
                            );
                        });
                    });
            }
        });
        ui.add_space(theme::SPACE_2XL);
    }

    fn section_title(ui: &mut Ui, title: &str, badge: &str, color: Color32) {
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(title)
                    .font(theme::font_h3())
                    .color(theme::text_primary()),
            );
            widgets::status_badge(ui, badge, color);
        });
    }

    fn icon_tile(ui: &mut Ui, icon: &str, color: Color32) {
        let (rect, _) = ui.allocate_exact_size(Vec2::splat(38.0), egui::Sense::hover());
        ui.painter()
            .rect_filled(rect, CornerRadius::same(10), theme::tinted_surface(color));
        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            icon,
            theme::font_body_lg(),
            theme::readable_color(color),
        );
    }

    fn metadata(ui: &mut Ui, icon: &str, text: &str) {
        ui.label(
            RichText::new(format!("{icon}  {text}"))
                .font(theme::font_caption())
                .color(theme::text_tertiary()),
        );
        ui.add_space(theme::SPACE_MD);
    }
}
