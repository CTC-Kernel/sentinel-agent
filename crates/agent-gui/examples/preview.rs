//! Design preview harness.
//!
//! Renders the application chrome and a gallery of the shared widgets without
//! an agent runtime or a system tray behind it, so the design system can be
//! reviewed (and screenshotted) in isolation.
//!
//! `cargo run -p agent-gui --all-features --example preview`

use agent_gui::app::{AppState, Page};
use agent_gui::{icons, pages, theme, widgets};
use eframe::egui;

struct Preview {
    page: Page,
    /// Render a real page against a default AppState instead of the gallery.
    state: Option<Box<AppState>>,
    /// Page name requested through PREVIEW_PAGE.
    requested: String,
    dark: bool,
    collapsed: bool,
    started: bool,
    /// Screenshot after N frames, then quit (set via PREVIEW_SHOT).
    shot_after: Option<u32>,
    frame_count: u32,
}

impl Default for Preview {
    fn default() -> Self {
        Self {
            page: Page::Dashboard,
            state: std::env::var("PREVIEW_PAGE")
                .is_ok()
                .then(|| Box::new(AppState::default())),
            requested: std::env::var("PREVIEW_PAGE").unwrap_or_default(),
            dark: std::env::var("PREVIEW_LIGHT").is_err(),
            collapsed: std::env::var("PREVIEW_RAIL").is_ok(),
            started: false,
            shot_after: std::env::var("PREVIEW_SHOT")
                .ok()
                .and_then(|v| v.parse().ok()),
            frame_count: 0,
        }
    }
}

impl eframe::App for Preview {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if !self.started {
            theme::apply_theme(ctx, self.dark);
            egui_extras::install_image_loaders(ctx);
            self.started = true;
        }

        let sync = widgets::sidebar::SidebarSyncState {
            syncing: false,
            pending_count: 3,
            last_sync_at: Some(chrono::Utc::now() - chrono::Duration::minutes(4)),
            error: None,
        };

        if let Some(action) = widgets::top_bar(
            ctx,
            &widgets::TopBarContext {
                page_icon: icons::DASHBOARD,
                page_label: "Tableau de bord",
                page_section: Some("Vue d'ensemble"),
                organization: Some("Cyber Threat Consulting"),
                unread: 7,
                syncing: false,
                scanning: false,
                dark_mode: self.dark,
                sidebar_collapsed: self.collapsed,
                sidebar_width: widgets::Sidebar::width(self.collapsed),
            },
        ) {
            match action {
                widgets::TopBarAction::ToggleSidebar => self.collapsed = !self.collapsed,
                widgets::TopBarAction::ToggleTheme => {
                    self.dark = !self.dark;
                    theme::apply_theme(ctx, self.dark);
                }
                _ => {}
            }
        }

        egui::SidePanel::left("sidebar")
            .exact_width(widgets::Sidebar::width(self.collapsed))
            .frame(egui::Frame::new().inner_margin(egui::Margin::ZERO))
            .show(ctx, |ui| {
                widgets::Sidebar::paint_background(ui, ui.max_rect());
                if let Some(page) = widgets::Sidebar::show(
                    ui,
                    &widgets::SidebarContext {
                        current: &self.page,
                        scanning: false,
                        unread_notifications: 7,
                        sync: &sync,
                        organization: Some("Cyber Threat Consulting"),
                        ai_ready: true,
                        voice_active: false,
                        collapsed: self.collapsed,
                    },
                ) {
                    self.page = page;
                }
            });

        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(theme::bg_primary()).inner_margin(
                egui::Margin::symmetric(theme::SPACE_LG as i8, theme::SPACE_LG as i8),
            ))
            .show(ctx, |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| match self.state.as_mut() {
                    Some(state) => real_page(ui, &self.requested, state),
                    None => gallery(ui),
                });
            });

        self.frame_count += 1;
        if let Some(n) = self.shot_after
            && self.frame_count >= n
        {
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
        }
        ctx.request_repaint();
    }
}

/// Render one of the product's real pages against a default state, so the
/// design system can be checked against live layouts rather than a mock.
fn real_page(ui: &mut egui::Ui, page: &str, state: &mut AppState) {
    match page {
        "compliance" => {
            pages::CompliancePage::show(ui, state);
        }
        "vulnerabilities" => {
            pages::VulnerabilitiesPage::show(ui, state);
        }
        "threats" => {
            pages::ThreatsPage::show(ui, state);
        }
        "settings" => {
            pages::SettingsPage::show(ui, state);
        }
        "assets" => {
            pages::AssetsPage::show(ui, state);
        }
        "network" => {
            pages::NetworkPage::show(ui, state);
        }
        "monitoring" => {
            pages::MonitoringPage::show(ui, state);
        }
        "about" => {
            pages::AboutPage::show(ui);
        }
        _ => {
            pages::DashboardPage::show(ui, state);
        }
    }
}

fn gallery(ui: &mut egui::Ui) {
    widgets::page_header(
        ui,
        "Tableau de bord",
        Some("Posture de conformité et de sécurité de ce poste, en temps réel."),
        Some("Les scores sont recalculés à chaque analyse."),
    );

    ui.horizontal_top(|ui| {
        for (label, value, delta, color) in [
            ("Score de conformité", "87%", "+4 pts", theme::SUCCESS),
            ("Vulnérabilités", "12", "3 critiques", theme::ERROR),
            ("Actifs découverts", "151", "+8", theme::INFO),
            ("Menaces bloquées", "1 284", "24 h", theme::WARNING),
        ] {
            ui.allocate_ui(egui::vec2(232.0, 108.0), |ui| {
                widgets::card(ui, |ui| {
                    ui.set_width(232.0 - theme::SPACE_LG * 2.0);
                    ui.label(
                        egui::RichText::new(label.to_uppercase())
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_WIDE),
                    );
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(value)
                            .font(theme::font_card_value())
                            .color(theme::text_primary()),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new(delta)
                            .font(theme::font_body_sm())
                            .color(theme::readable_color(color)),
                    );
                });
            });
        }
    });

    ui.add_space(theme::SPACE_LG);
    widgets::section_header(
        ui,
        "Typographie",
        Some("Inter · échelle 1.25 · chiffres tabulaires"),
    );
    widgets::card(ui, |ui| {
        for (name, font) in [
            ("Display 34 / Bold", theme::font_display()),
            ("H1 26 / Bold", theme::font_h1()),
            ("H2 20 / SemiBold", theme::font_h2()),
            ("H3 16 / SemiBold", theme::font_h3()),
            ("Body 13 / Regular — 0123456789", theme::font_body()),
            ("Body 13 / SemiBold — 0123456789", theme::font_body_strong()),
            ("Caption 11 / Regular", theme::font_small()),
            (
                "Mono 12 — 9f8a2b1c 192.168.1.24 CVE-2024-3094",
                theme::font_mono(),
            ),
        ] {
            ui.label(
                egui::RichText::new(name)
                    .font(font)
                    .color(theme::text_primary()),
            );
        }
    });

    ui.add_space(theme::SPACE_LG);
    widgets::section_header(ui, "Composants", None);
    ui.horizontal(|ui| {
        widgets::primary_button(ui, "Lancer l'analyse", true);
        widgets::secondary_button(ui, "Exporter", true);
        widgets::destructive_button(ui, "Mettre en quarantaine", true);
        widgets::ghost_button(ui, "Annuler");
    });
    ui.add_space(theme::SPACE_MD);
    ui.horizontal(|ui| {
        widgets::badge::badge_error(ui, "Critique");
        widgets::badge::badge_warning(ui, "Élevé");
        widgets::badge::badge_variant(ui, "Moyen", widgets::badge::BadgeVariant::Warning);
        widgets::badge::badge_info(ui, "Faible");
        widgets::badge::badge_success(ui, "Conforme");
        widgets::badge::badge_count(ui, 7);
    });

    ui.add_space(theme::SPACE_LG);
    ui.horizontal_top(|ui| {
        ui.allocate_ui(egui::vec2(420.0, 0.0), |ui| {
            widgets::card(ui, |ui| {
                ui.set_width(420.0 - theme::SPACE_LG * 2.0);
                ui.label(
                    egui::RichText::new("Carte standard")
                        .font(theme::font_h3())
                        .color(theme::text_primary()),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(
                        "Élévation à deux couches, liseré haut éclairé, surface un cran \
                         au-dessus du canevas.",
                    )
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );
            });
        });
        ui.allocate_ui(egui::vec2(420.0, 0.0), |ui| {
            widgets::danger_card(ui, |ui| {
                ui.set_width(420.0 - theme::SPACE_LG * 2.0);
                ui.label(
                    egui::RichText::new("Zone sensible")
                        .font(theme::font_h3())
                        .color(theme::readable_color(theme::ERROR)),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new("Actions irréversibles sur l'agent.")
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );
            });
        });
    });
    ui.add_space(theme::SPACE_LG);
    widgets::section_header(ui, "Saisie et navigation", None);
    widgets::card(ui, |ui| {
        ui.horizontal(|ui| {
            let mut tab = 1usize;
            widgets::tabs(ui, &["Contrôles", "Écarts", "Historique"], &mut tab);
        });
        ui.add_space(theme::SPACE_MD);
        let mut query = String::from("CVE-2024");
        widgets::search_input(ui, &mut query, "Filtrer les vulnérabilités…");
        ui.add_space(theme::SPACE_MD);
        let mut host = String::from("srv-paris-01.ctc.local");
        widgets::text_input_validated(ui, &mut host, "Nom d'hôte", widgets::InputValidation::Valid);
    });

    ui.add_space(theme::SPACE_LG);
    widgets::section_header(ui, "Tableau", None);
    widgets::card(ui, |ui| {
        let columns = vec![
            widgets::data_table::TableColumn::new("host", "Hôte")
                .sortable()
                .width(widgets::data_table::ColumnWidth::Fill),
            widgets::data_table::TableColumn::new("cve", "Identifiant")
                .sortable()
                .width(widgets::data_table::ColumnWidth::Fixed(160.0)),
            widgets::data_table::TableColumn::new("sev", "Sévérité")
                .width(widgets::data_table::ColumnWidth::Fixed(110.0)),
            widgets::data_table::TableColumn::new("seen", "Détecté")
                .width(widgets::data_table::ColumnWidth::Fixed(140.0))
                .align(widgets::data_table::ColumnAlign::Right),
        ];
        let table = widgets::data_table::DataTable::new("demo", columns).selectable();
        let mut sort = widgets::data_table::TableSort::by(
            "cve",
            widgets::data_table::SortDirection::Descending,
        );
        table.show_header(ui, &mut sort);
        for (i, row) in [
            [
                "srv-paris-01.ctc.local",
                "CVE-2024-3094",
                "Critique",
                "il y a 2 min",
            ],
            [
                "poste-dsi-114-tres-long-nom-de-machine.ctc.local",
                "CVE-2024-21762",
                "Élevé",
                "il y a 18 min",
            ],
            [
                "nas-archive-02.ctc.local",
                "CVE-2023-44487",
                "Moyen",
                "hier",
            ],
        ]
        .iter()
        .enumerate()
        {
            table.show_row(ui, i, i == 1, row.as_ref());
        }
    });

    ui.add_space(theme::SPACE_XL);
}

fn main() -> eframe::Result<()> {
    eframe::run_native(
        "Sentinel GRC Agent — preview",
        eframe::NativeOptions {
            renderer: eframe::Renderer::Wgpu,
            viewport: egui::ViewportBuilder::default().with_inner_size([1500.0, 1900.0]),
            ..Default::default()
        },
        Box::new(|cc| {
            theme::configure_fonts(&cc.egui_ctx);
            Ok(Box::<Preview>::default())
        }),
    )
}
