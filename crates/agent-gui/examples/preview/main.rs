//! Design preview harness.
//!
//! Renders the application chrome and a gallery of the shared widgets without
//! an agent runtime or a system tray behind it, so the design system can be
//! reviewed (and screenshotted) in isolation.
//!
//! `cargo run -p agent-gui --all-features --example preview`

mod fixtures;

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
    /// Where the capture is written when PREVIEW_OUT names a PNG file.
    shot_path: Option<String>,
    /// The capture has been requested from the viewport.
    shot_requested: bool,
    /// PREVIEW_DRAWER, re-applied once the page has built its caches.
    drawer: Option<String>,
    /// Command palette state, opened by PREVIEW_PAGE=palette.
    palette: widgets::CommandPaletteState,
    /// Toasts shown by PREVIEW_PAGE=overlays.
    toasts: Vec<widgets::Toast>,
    /// Enrollment wizard, rendered by PREVIEW_PAGE=enrollment at PREVIEW_STEP.
    wizard: agent_gui::enrollment::EnrollmentWizard,
}

impl Default for Preview {
    fn default() -> Self {
        let requested = std::env::var("PREVIEW_PAGE").unwrap_or_default();
        let state = std::env::var("PREVIEW_PAGE").is_ok().then(|| {
            let mut state = Box::new(AppState::default());
            if std::env::var("PREVIEW_DATA").is_ok() {
                fixtures::seed(&mut state);
            }
            if std::env::var("PREVIEW_STANDALONE").is_ok() {
                fixtures::standalone(&mut state);
            }
            if let Some(tab) = std::env::var("PREVIEW_TAB")
                .ok()
                .and_then(|v| v.parse().ok())
            {
                fixtures::select_tab(&mut state, &requested, tab);
            }
            if let Ok(drawer) = std::env::var("PREVIEW_DRAWER") {
                fixtures::open_drawer(&mut state, &drawer);
            }
            state
        });
        Self {
            page: page_from(&requested),
            state,
            requested,
            dark: std::env::var("PREVIEW_LIGHT").is_err(),
            collapsed: std::env::var("PREVIEW_RAIL").is_ok(),
            started: false,
            shot_after: std::env::var("PREVIEW_SHOT")
                .ok()
                .and_then(|v| v.parse().ok()),
            frame_count: 0,
            shot_path: std::env::var("PREVIEW_OUT").ok(),
            shot_requested: false,
            drawer: std::env::var("PREVIEW_DRAWER").ok(),
            palette: widgets::CommandPaletteState::new(),
            toasts: Vec::new(),
            wizard: {
                use agent_gui::enrollment::{EnrollmentStep, EnrollmentWizard};
                let requested_step = std::env::var("PREVIEW_STEP").unwrap_or_default();
                // `standalone-<step>` previews the wizard's standalone branch;
                // `connect-<step>` the wizard reopened from a standalone agent
                // to join a platform.
                let standalone = requested_step.starts_with("standalone-");
                let connect_later = requested_step.starts_with("connect-");
                let step = match requested_step
                    .trim_start_matches("standalone-")
                    .trim_start_matches("connect-")
                {
                    "token" => EnrollmentStep::TokenEntry,
                    "admin" => EnrollmentStep::AdminSetup,
                    "progress" => EnrollmentStep::InProgress,
                    "done" if standalone => EnrollmentStep::Complete {
                        success: true,
                        message: "Mode autonome activé. Ce poste est protégé localement, sans plateforme.".into(),
                    },
                    "done" if connect_later => EnrollmentStep::Complete {
                        success: true,
                        message: "Agent enrôlé avec succès.\nID: 7f3c9a2e-1b4d-4e8f-9a6c-2d5e8f1a3b7c\n\
                                  La synchronisation démarre au prochain lancement de l'agent ; \
                                  d'ici là, la protection locale continue."
                            .into(),
                    },
                    "done" => EnrollmentStep::Complete {
                        success: true,
                        message: "Agent enrôlé auprès de Cyber Threat Consulting.".into(),
                    },
                    "failed" => EnrollmentStep::Complete {
                        success: false,
                        message:
                            "Jeton expiré. Demandez un nouveau QR code à votre administrateur."
                                .into(),
                    },
                    _ => EnrollmentStep::Welcome,
                };
                EnrollmentWizard {
                    step,
                    standalone,
                    connect_later,
                    ..Default::default()
                }
            },
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

        // First-run surfaces replace the whole shell, exactly as in the app.
        match self.requested.as_str() {
            "splash" => {
                widgets::splash_screen(ctx, 1.2);
                self.end_frame(ctx);
                ctx.request_repaint();
                return;
            }
            "enrollment" => {
                egui::CentralPanel::default()
                    .frame(
                        egui::Frame::new()
                            .fill(theme::bg_primary())
                            .inner_margin(0.0),
                    )
                    .show(ctx, |ui| {
                        let _ = self.wizard.show(ui);
                    });
                self.end_frame(ctx);
                ctx.request_repaint();
                return;
            }
            _ => {}
        }

        let (org, unread, pending, last_sync, scanning, standalone) = match self.state.as_deref() {
            Some(st) => (
                st.summary.organization.clone(),
                st.unread_notification_count,
                st.summary.pending_sync_count,
                st.summary.last_sync_at,
                st.summary.status == agent_gui::dto::GuiAgentStatus::Scanning,
                st.summary.standalone,
            ),
            None => (
                Some("Cyber Threat Consulting".to_string()),
                7,
                3,
                Some(chrono::Utc::now() - chrono::Duration::minutes(4)),
                false,
                false,
            ),
        };
        let sync = widgets::sidebar::SidebarSyncState {
            syncing: false,
            pending_count: pending,
            last_sync_at: last_sync,
            error: None,
        };

        // Same rule as the shell: below the breakpoint the rail is forced.
        let collapsed = self.collapsed || ctx.screen_rect().width() < theme::SIDEBAR_BREAKPOINT;
        let (page_icon, page_label, page_section) = location(&self.requested);
        if let Some(action) = widgets::top_bar(
            ctx,
            &widgets::TopBarContext {
                page_icon,
                page_label,
                page_section: Some(page_section),
                organization: org.as_deref(),
                standalone,
                unread,
                syncing: false,
                scanning,
                dark_mode: self.dark,
                sidebar_collapsed: collapsed,
                sidebar_width: widgets::Sidebar::width(collapsed),
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
            .exact_width(widgets::Sidebar::width(collapsed))
            .frame(egui::Frame::new().inner_margin(egui::Margin::ZERO))
            .show(ctx, |ui| {
                widgets::Sidebar::paint_background(ui, ui.max_rect());
                if let Some(page) = widgets::Sidebar::show(
                    ui,
                    &widgets::SidebarContext {
                        current: &self.page,
                        scanning,
                        unread_notifications: unread,
                        sync: &sync,
                        organization: org.as_deref(),
                        standalone,
                        ai_ready: true,
                        voice_active: false,
                        collapsed,
                    },
                ) {
                    self.page = page;
                }
            });

        // Pages that cache their filtered list reset the selection on the
        // first frame; re-open the requested drawer once that has settled.
        if self.frame_count == 3
            && let (Some(state), Some(drawer)) = (self.state.as_mut(), self.drawer.as_deref())
        {
            fixtures::open_drawer(state, drawer);
        }

        egui::CentralPanel::default()
            .frame(
                egui::Frame::new()
                    .fill(theme::bg_primary())
                    .inner_margin(egui::Margin::symmetric(0, theme::SPACE_LG as i8)),
            )
            .show(ctx, |ui| {
                egui::ScrollArea::vertical()
                    .auto_shrink(egui::Vec2b::new(false, false))
                    .show(ui, |ui| {
                        agent_gui::app::page_column(ui, |ui| match self.state.as_mut() {
                            Some(state) => real_page(ui, &self.requested, state),
                            None => gallery(ui),
                        });
                    });
            });

        self.overlays(ctx);

        self.end_frame(ctx);
        ctx.request_repaint();
    }
}

impl Preview {
    /// Count the frame and, when a capture was asked for, request it and
    /// write it out; every surface the harness renders ends its frame here,
    /// the first-run ones included.
    fn end_frame(&mut self, ctx: &egui::Context) {
        self.frame_count += 1;
        if std::env::var("PREVIEW_DEBUG").is_ok() {
            eprintln!("frame {}", self.frame_count);
        }
        if let Some(n) = self.shot_after
            && self.frame_count >= n
        {
            if self.shot_path.is_none() {
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            } else if !self.shot_requested {
                // Ask the viewport for its pixels once, then quit as soon as
                // they have been written: a capture that measures what the
                // shell shows, without an X11 grab or a compositor.
                self.shot_requested = true;
                ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot(Default::default()));
            }
        }
        if let Some(path) = self.shot_path.as_deref() {
            let image = ctx.input(|i| {
                i.events.iter().find_map(|event| match event {
                    egui::Event::Screenshot { image, .. } => Some(image.clone()),
                    _ => None,
                })
            });
            if let Some(image) = image {
                let bytes: Vec<u8> = image.pixels.iter().flat_map(|p| p.to_array()).collect();
                eprintln!(
                    "PREVIEW_OUT: {}x{} (screen {:?})",
                    image.width(),
                    image.height(),
                    ctx.screen_rect().size()
                );
                if let Err(err) = image::save_buffer(
                    path,
                    &bytes,
                    image.width() as u32,
                    image.height() as u32,
                    image::ColorType::Rgba8,
                ) {
                    eprintln!("PREVIEW_OUT: {err}");
                }
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            }
        }
    }

    /// Overlay surfaces the real shell layers over the content: toasts, a
    /// modal, and the command palette. Selected by PREVIEW_PAGE.
    fn overlays(&mut self, ctx: &egui::Context) {
        match self.requested.as_str() {
            "overlays" => {
                if self.toasts.is_empty() {
                    let t = ctx.input(|i| i.time);
                    self.toasts = vec![
                        widgets::Toast::success("Analyse terminée : 21 contrôles évalués")
                            .with_time(t)
                            .persistent(),
                        widgets::Toast::warning("3 éléments en attente de synchronisation")
                            .with_time(t)
                            .persistent(),
                        widgets::Toast::error("Échec de l'export CSV : permission refusée")
                            .with_time(t)
                            .persistent(),
                        widgets::Toast::info("Nouvelle version disponible : 4.1.0")
                            .with_time(t)
                            .persistent(),
                    ];
                }
                egui::Area::new(egui::Id::new("toast_overlay"))
                    .fixed_pos(egui::pos2(0.0, 0.0))
                    .order(egui::Order::Foreground)
                    .show(ctx, |ui| {
                        ui.set_min_size(ctx.screen_rect().size());
                        self.toasts = widgets::render_toasts(ui, &self.toasts);
                    });

                if self.frame_count == 2 {
                    widgets::Modal::open(ctx, "preview_modal");
                }
                widgets::Modal::new("preview_modal", "Mettre le poste en quarantaine ?")
                    .message(
                        "Le poste sera isolé du réseau et toutes les connexions sortantes \
                         seront bloquées. Cette action est journalisée et réversible depuis \
                         la console.",
                    )
                    .style(widgets::ModalStyle::Danger)
                    .confirm_text("Mettre en quarantaine")
                    .cancel_text(Some("Annuler".to_string()))
                    .show(ctx);
            }
            "palette" => {
                if self.frame_count == 2 {
                    self.palette.open();
                    self.palette.query = if self.state.is_some() {
                        "cve-2024".to_string()
                    } else {
                        "vul".to_string()
                    };
                }
                let mut commands = palette_commands();
                if let Some(state) = self.state.as_deref() {
                    commands.extend(agent_gui::app::entity_commands(state));
                }
                widgets::CommandPalette::new(&commands)
                    .placeholder("Rechercher une page, une action, une CVE, un actif…")
                    .max_results(commands.len())
                    .show(ctx, &mut self.palette);
            }
            _ => {}
        }
    }
}

/// The same catalogue the shell feeds its palette, so the preview shows the
/// real thing rather than a stand-in.
fn palette_commands() -> Vec<widgets::CommandItem> {
    vec![
        widgets::CommandItem::new("nav:dashboard", "Tableau de bord")
            .icon(icons::DASHBOARD)
            .category("Vue d'ensemble"),
        widgets::CommandItem::new("nav:vulnerabilities", "Vulnérabilités")
            .icon(icons::VULNERABILITIES)
            .category("Détection & réponse"),
        widgets::CommandItem::new("nav:threats", "Menaces")
            .icon(icons::SKULL)
            .category("Détection & réponse"),
        widgets::CommandItem::new("nav:compliance", "Conformité")
            .icon(icons::COMPLIANCE)
            .category("Conformité & risques"),
        widgets::CommandItem::new("action:run_check", "Lancer l'analyse")
            .icon(icons::PLAY)
            .shortcut("⌘R")
            .category("Actions"),
        widgets::CommandItem::new("action:force_sync", "Synchroniser maintenant")
            .icon(icons::SYNC)
            .shortcut("⌘⇧S")
            .category("Actions"),
    ]
}

/// Route name to the page it selects, so the sidebar highlights what is on
/// screen instead of always pointing at the dashboard.
fn page_from(name: &str) -> Page {
    match name {
        "compliance" => Page::Compliance,
        "vulnerabilities" => Page::Vulnerabilities,
        "threats" => Page::Threats,
        "network" => Page::Network,
        "settings" => Page::Settings,
        "assets" => Page::Assets,
        "monitoring" => Page::Monitoring,
        "about" => Page::About,
        "ai" => Page::AI,
        "notifications" => Page::Notifications,
        "reports" => Page::Reports,
        "risks" => Page::Risks,
        "discovery" => Page::Discovery,
        "cartography" => Page::Cartography,
        "terminal" => Page::Terminal,
        "audit" => Page::AuditTrail,
        "fim" => Page::FileIntegrity,
        "software" => Page::Software,
        "sync" => Page::Sync,
        _ => Page::Dashboard,
    }
}

/// Icon, label and section for the page the harness is rendering, so the top
/// bar tells the truth about what is on screen.
fn location(page: &str) -> (&'static str, &'static str, &'static str) {
    match page {
        "compliance" => (icons::COMPLIANCE, "Conformité", "Conformité & risques"),
        "vulnerabilities" => (
            icons::VULNERABILITIES,
            "Vulnérabilités",
            "Détection & réponse",
        ),
        "threats" => (icons::SKULL, "Menaces", "Détection & réponse"),
        "network" => (icons::NETWORK, "Réseau", "Détection & réponse"),
        "settings" => (icons::SETTINGS, "Paramètres", "Système"),
        "assets" => (icons::BOXES_STACKED, "Inventaire", "Actifs & inventaire"),
        "monitoring" => (icons::CHART_LINE, "Surveillance", "Vue d'ensemble"),
        "about" => (icons::ABOUT, "À propos", "Système"),
        "ai" => (icons::BRAIN, "Assistant IA", "Assistant"),
        "notifications" => (icons::BELL, "Notifications", "Vue d'ensemble"),
        "reports" => (icons::FILE_EXPORT, "Rapports", "Conformité & risques"),
        "risks" => (icons::SCALE_BALANCED, "Risques", "Conformité & risques"),
        "discovery" => (icons::DISCOVERY, "Shadow IT", "Actifs & inventaire"),
        "cartography" => (icons::CARTOGRAPHY, "Cartographie", "Actifs & inventaire"),
        "terminal" => (icons::TERMINAL, "Terminal", "Système"),
        "audit" => (icons::CLIPBOARD, "Journal d'audit", "Système"),
        "fim" => (
            icons::FILE_SHIELD,
            "Intégrité des fichiers",
            "Détection & réponse",
        ),
        "software" => (icons::SOFTWARE, "Logiciels & MDM", "Actifs & inventaire"),
        "sync" => (icons::SYNC, "Synchronisation", "Système"),
        _ => (icons::DASHBOARD, "Tableau de bord", "Vue d'ensemble"),
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
        "ai" => {
            agent_gui::llm_panel::LLMPanel.show(ui, state);
        }
        "notifications" => {
            pages::NotificationsPage::show(ui, state);
        }
        "reports" => {
            pages::ReportsPage::show(ui, state);
        }
        "risks" => {
            pages::RisksPage::show(ui, state);
        }
        "discovery" => {
            pages::DiscoveryPage::show(ui, state);
        }
        "cartography" => {
            pages::CartographyPage::show(ui, state);
        }
        "terminal" => {
            pages::TerminalPage::show(ui, state);
        }
        "audit" => {
            pages::AuditTrailPage::show(ui, state);
        }
        "fim" => {
            pages::FimPage::show(ui, state);
        }
        "software" => {
            pages::SoftwarePage::show(ui, state);
        }
        "sync" => {
            pages::SyncPage::show(ui, state);
        }
        "overlays" => feedback_gallery(ui),
        _ => {
            pages::DashboardPage::show(ui, state);
        }
    }
}

/// Every feedback and input primitive on one page: the surfaces a user meets
/// when something is loading, missing, wrong, or asking for a decision.
fn feedback_gallery(ui: &mut egui::Ui) {
    widgets::page_header(
        ui,
        "Retours et saisie",
        Some("Alertes, progression, chargement, états vides et contrôles de formulaire."),
        None,
    );

    widgets::section_header(ui, "Alertes", None);
    for (level, title, msg) in [
        (
            widgets::alert::AlertLevel::Info,
            "Mise à jour disponible",
            "La version 4.1.0 corrige 3 vulnérabilités de l'agent.",
        ),
        (
            widgets::alert::AlertLevel::Success,
            "Synchronisation réussie",
            "151 actifs poussés vers la plateforme il y a 2 min.",
        ),
        (
            widgets::alert::AlertLevel::Warning,
            "Certificat proche de l'expiration",
            "Le certificat mTLS expire dans 6 jours.",
        ),
        (
            widgets::alert::AlertLevel::Error,
            "Perte de contact avec la plateforme",
            "Dernier heartbeat accepté il y a 47 min.",
        ),
    ] {
        widgets::alert::Alert::new(msg)
            .level(level)
            .title(title)
            .dismissible()
            .action("Détails", false)
            .show(ui);
        ui.add_space(theme::SPACE_SM);
    }

    widgets::section_header(ui, "Progression", None);
    widgets::card(ui, |ui| {
        widgets::progress_bar_with_label(ui, 0.62, "Analyse des paquets — 94 / 151");
        ui.add_space(theme::SPACE_MD);
        widgets::progress_bar_indeterminate(ui);
        ui.add_space(theme::SPACE_MD);
        ui.horizontal(|ui| {
            widgets::circular_progress(ui, 0.87, 56.0);
            ui.add_space(theme::SPACE_LG);
            widgets::step_indicator(ui, &["Jeton", "Administrateur", "Enrôlement", "Terminé"], 2);
        });
    });

    widgets::section_header(ui, "Chargement", None);
    widgets::card(ui, |ui| {
        widgets::loading_skeleton(ui, 3);
    });

    widgets::section_header(ui, "Formulaire", None);
    widgets::card(ui, |ui| {
        let mut on = true;
        let mut off = false;
        let mut checked = true;
        let mut unchecked = false;
        let mut sel = 1usize;
        ui.horizontal(|ui| {
            widgets::toggle_switch(ui, &mut on);
            ui.add_space(theme::SPACE_SM);
            widgets::toggle_switch(ui, &mut off);
            ui.add_space(theme::SPACE_LG);
            widgets::checkbox::checkbox(ui, "Chiffrement du disque", &mut checked);
            ui.add_space(theme::SPACE_MD);
            widgets::checkbox::checkbox(ui, "Pare-feu actif", &mut unchecked);
            ui.add_space(theme::SPACE_LG);
            widgets::dropdown(ui, "fmt", &["CEF", "LEEF", "JSON"], &mut sel);
        });
    });

    widgets::section_header(ui, "États vides et erreurs", None);
    ui.columns(3, |cols| {
        widgets::card(&mut cols[0], |ui| {
            widgets::empty_state(
                ui,
                icons::FOLDER_OPEN,
                "Aucun rapport généré",
                Some("Les rapports apparaîtront ici après la première analyse."),
            );
        });
        widgets::card(&mut cols[1], |ui| widgets::no_results_state(ui, "CVE-2099"));
        widgets::card(&mut cols[2], |ui| {
            widgets::error_state(ui, "Impossible de lire la base locale.");
        });
    });
    widgets::card(ui, |ui| {
        widgets::pending_state(ui, "Chargement du modèle local…")
    });
    ui.add_space(theme::SPACE_XL);
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
            viewport: egui::ViewportBuilder::default().with_inner_size([
                std::env::var("PREVIEW_W")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(theme::WINDOW_WIDTH),
                std::env::var("PREVIEW_H")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(theme::WINDOW_HEIGHT),
            ]),
            // A capture must measure the size it was asked for, not the one
            // the previous run left in the window store.
            persist_window: false,
            ..Default::default()
        },
        Box::new(|cc| {
            theme::configure_fonts(&cc.egui_ctx);
            Ok(Box::<Preview>::default())
        }),
    )
}
