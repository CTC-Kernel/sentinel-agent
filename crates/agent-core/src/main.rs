//! Sentinel GRC Agent - Main entry point.
//!
//! This binary can run in multiple modes:
//! - Foreground: `sentinel-agent` or `sentinel-agent run` (with tray icon)
//! - Headless: `sentinel-agent run --no-tray` (for servers)
//! - Service: `sentinel-agent --service` (called by SCM/systemd)
//! - Install: `sentinel-agent install` (requires admin/root)
//! - Uninstall: `sentinel-agent uninstall` (requires admin/root)

use agent_common::config::AgentConfig;
#[cfg(feature = "tray")]
use agent_core::tray;
use agent_core::{AgentRuntime, init_logging, service};
use clap::{Parser, Subcommand};
#[cfg(feature = "tray")]
use muda::MenuEvent;
use std::process::ExitCode;
#[cfg(feature = "tray")]
use std::sync::atomic::Ordering;
#[cfg(feature = "tray")]
use tao::event_loop::{ControlFlow, EventLoopBuilder};
#[cfg(feature = "gui")]
use tracing::debug;
use tracing::{error, info, warn};

#[derive(Parser)]
#[command(name = "sentinel-agent")]
#[command(author = "Sentinel GRC")]
#[command(version)]
#[command(about = "Endpoint compliance monitoring agent for Sentinel GRC", long_about = None)]
struct Cli {
    /// Run as a Windows Service (internal use)
    #[arg(long, hide = true)]
    service: bool,

    /// Configuration file path
    #[arg(short, long)]
    config: Option<String>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(short, long, default_value = "info")]
    log_level: String,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Enroll the agent with an enrollment token
    Enroll {
        /// The enrollment token from the Sentinel GRC dashboard
        #[arg(short, long)]
        token: String,
    },
    /// Install the agent as a system service
    Install,
    /// Uninstall the agent service
    Uninstall {
        /// Remove all data including config, logs, and database
        #[arg(long)]
        purge: bool,

        /// Keep log files even with --purge
        #[arg(long)]
        keep_logs: bool,
    },
    /// Start the agent service
    Start,
    /// Stop the agent service
    Stop,
    /// Show the agent service status
    Status,
    /// Run in foreground mode
    Run {
        /// Run without system tray icon (headless mode for servers)
        #[arg(long)]
        no_tray: bool,
    },
}

fn main() -> ExitCode {
    // Install a panic hook early so panics are always logged to stderr and
    // never silently swallowed (e.g. in background threads).
    std::panic::set_hook(Box::new(|panic_info| {
        let payload = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic".to_string()
        };
        let location = panic_info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());
        eprintln!("PANIC at {}: {}", location, payload);
        // Let the natural unwind complete so destructors run (DB WAL merge, key zeroize).
        // Do NOT call std::process::exit() here as it skips all destructors.
    }));

    let cli = Cli::parse();

    // Handle --service flag (called by SCM/systemd)
    if cli.service {
        return run_as_service();
    }

    // Determine if we'll launch the GUI (feature enabled + not headless).
    // GUI mode defers logging init to use the terminal-aware tracing subscriber.
    #[cfg(feature = "gui")]
    let gui_mode = match &cli.command {
        Some(Commands::Run { no_tray }) => !no_tray,
        None => true, // default mode = run with tray/GUI
        _ => false,   // enroll, install, etc. don't use GUI
    };
    #[cfg(not(feature = "gui"))]
    let gui_mode = false;

    if !gui_mode {
        init_logging(&cli.log_level);
    }

    // Handle subcommands
    match cli.command {
        Some(Commands::Enroll { token }) => handle_enroll(&token),
        Some(Commands::Install) => handle_install(),
        Some(Commands::Uninstall { purge, keep_logs }) => handle_uninstall(purge, keep_logs),
        Some(Commands::Start) => handle_start(),
        Some(Commands::Stop) => handle_stop(),
        Some(Commands::Status) => handle_status(),
        Some(Commands::Run { no_tray }) => handle_run(cli.config, no_tray, &cli.log_level),
        None => handle_run(cli.config, false, &cli.log_level),
    }
}

/// Enroll the agent with a token.
fn handle_enroll(token: &str) -> ExitCode {
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    use agent_sync::EnrollmentManager;

    info!("Enrolling Sentinel Agent...");

    // Create runtime for async operations
    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            error!("Failed to create runtime: {}", e);
            return ExitCode::FAILURE;
        }
    };

    // Load config with the enrollment token
    let mut config = match AgentConfig::load(None) {
        Ok(config) => config,
        Err(e) => {
            // Use default config if none exists
            warn!("No config found, using defaults: {}", e);
            AgentConfig::default()
        }
    };
    config.enrollment_token = Some(token.to_string());

    // Initialize database
    let db_config = DatabaseConfig::default();
    let key_manager = match KeyManager::new() {
        Ok(km) => km,
        Err(e) => {
            error!("Failed to initialize key manager: {}", e);
            return ExitCode::FAILURE;
        }
    };

    let db = match Database::open(db_config, &key_manager) {
        Ok(db) => db,
        Err(e) => {
            error!("Failed to open database: {}", e);
            return ExitCode::FAILURE;
        }
    };

    // Perform enrollment
    let enrollment_manager = EnrollmentManager::new(&config, &db);

    match rt.block_on(enrollment_manager.ensure_enrolled()) {
        Ok(credentials) => {
            info!(
                "Enrollment successful! Agent ID: {}, Organization: {}",
                credentials.agent_id, credentials.organization_id
            );
            info!("You can now start the agent with: sentinel-agent");
            ExitCode::SUCCESS
        }
        Err(e) => {
            error!("Enrollment failed: {}. Please check: the token is valid and not expired, you have network connectivity, the token hasn't reached its usage limit", e);
            ExitCode::FAILURE
        }
    }
}

/// Run as a system service (Windows SCM or systemd).
fn run_as_service() -> ExitCode {
    // Initialize logging to file for service mode
    init_logging("info");

    match service::run_as_service() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            error!("Service error: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Install the service.
fn handle_install() -> ExitCode {
    let executable = match std::env::current_exe() {
        Ok(path) => path.to_string_lossy().to_string(),
        Err(e) => {
            error!("Failed to get executable path: {}", e);
            return ExitCode::FAILURE;
        }
    };

    match service::install_service(&executable) {
        Ok(()) => {
            info!("Service installed successfully. Use 'sentinel-agent start' to start the service.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::AlreadyInstalled) => {
            info!("Service is already installed.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::PermissionDenied(msg)) => {
            error!("Permission denied: {}. Run as Administrator/root.", msg);
            ExitCode::FAILURE
        }
        Err(e) => {
            error!("Failed to install service: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Uninstall the service.
fn handle_uninstall(purge: bool, keep_logs: bool) -> ExitCode {
    use agent_core::cleanup::{CleanupOptions, cleanup_data, print_cleanup_summary};

    // First, uninstall the service
    match service::uninstall_service() {
        Ok(()) => {
            info!("Service uninstalled successfully");
        }
        Err(service::ServiceError::NotInstalled) => {
            info!("Service is not installed.");
        }
        Err(service::ServiceError::PermissionDenied(msg)) => {
            error!("Permission denied: {}. Run as Administrator/root.", msg);
            return ExitCode::FAILURE;
        }
        Err(e) => {
            error!("Failed to uninstall service: {}", e);
            return ExitCode::FAILURE;
        }
    }

    // Perform data cleanup based on options
    let options = CleanupOptions { purge, keep_logs };
    let result = cleanup_data(&options);
    print_cleanup_summary(&result);

    if !result.errors.is_empty() {
        warn!("Uninstallation completed with some warnings.");
    } else if purge {
        info!("Agent completely removed.");
    } else {
        info!("Agent service removed. Configuration and data preserved. Use '--purge' to remove all data.");
    }

    ExitCode::SUCCESS
}

/// Start the service.
fn handle_start() -> ExitCode {
    match service::start_service() {
        Ok(()) => {
            info!("Service started.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::AlreadyRunning) => {
            info!("Service is already running.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::NotInstalled) => {
            warn!("Service is not installed. Run 'sentinel-agent install' first.");
            ExitCode::FAILURE
        }
        Err(e) => {
            error!("Failed to start service: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Stop the service.
fn handle_stop() -> ExitCode {
    match service::stop_service() {
        Ok(()) => {
            info!("Service stopped.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::NotRunning) => {
            info!("Service is not running.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::NotInstalled) => {
            info!("Service is not installed.");
            ExitCode::FAILURE
        }
        Err(e) => {
            error!("Failed to stop service: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Show service status.
fn handle_status() -> ExitCode {
    match service::get_service_state() {
        Ok(state) => {
            info!("Service status: {}", state);
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::NotInstalled) => {
            info!("Service is not installed.");
            ExitCode::SUCCESS
        }
        Err(e) => {
            error!("Failed to get service status: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Run in foreground mode.
#[allow(unused_variables)] // log_level used only with "gui" feature
fn handle_run(config_path: Option<String>, no_tray: bool, log_level: &str) -> ExitCode {
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    use agent_sync::EnrollmentManager;

    info!("Starting Sentinel GRC Agent in foreground mode");

    // Load configuration
    let mut config = match AgentConfig::load(config_path.as_deref()) {
        Ok(config) => config,
        Err(e) => {
            warn!("No config found, using defaults: {}", e);
            AgentConfig::default()
        }
    };

    // Initialize database for enrollment check
    let db_config = DatabaseConfig::default();
    let key_manager = match KeyManager::new() {
        Ok(km) => km,
        Err(e) => {
            error!("Failed to initialize key manager: {}", e);
            return ExitCode::FAILURE;
        }
    };

    let db = match Database::open(db_config, &key_manager) {
        Ok(db) => db,
        Err(e) => {
            error!("Failed to open database: {}", e);
            return ExitCode::FAILURE;
        }
    };

    // Create runtime for enrollment check
    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            error!("Failed to create Tokio runtime: {}", e);
            return ExitCode::FAILURE;
        }
    };

    // Check if enrolled
    let enrollment_manager = EnrollmentManager::new(&config, &db);
    let is_enrolled = rt
        .block_on(enrollment_manager.is_enrolled())
        .unwrap_or(false);

    // If enrolled, load credentials from database into config so AgentRuntime can use them
    if is_enrolled {
        use agent_sync::CredentialsRepository;
        let credentials_repo = CredentialsRepository::new(&db);
        if let Ok(Some(creds)) = rt.block_on(credentials_repo.load()) {
            config.agent_id = Some(creds.agent_id.to_string());
            config.organization_id = Some(creds.organization_id.to_string());
            config.client_certificate = Some(creds.client_certificate.clone());
            config.client_key = Some(creds.client_private_key.clone());
            info!(
                "Loaded agent credentials from database: agent={}, org={}",
                creds.agent_id, creds.organization_id
            );
        }
    }

    // ── GUI mode: delegate enrollment + runtime to the GUI ──
    #[cfg(feature = "gui")]
    if !no_tray {
        return run_with_gui(config, is_enrolled, log_level);
    }

    // ── Legacy / headless enrollment flow ──
    if !is_enrolled {
        info!("Agent not enrolled. Requesting enrollment token.");

        // Try to get token from config or prompt user
        let token = config.enrollment_token.clone().or_else(|| {
            if no_tray {
                warn!("Agent is not enrolled. Run 'sentinel-agent enroll --token <TOKEN>' first.");
                None
            } else {
                show_enrollment_dialog()
            }
        });

        match token {
            Some(token) => {
                config.enrollment_token = Some(token.clone());
                let enrollment_manager = EnrollmentManager::new(&config, &db);

                info!("Enrolling agent...");
                match rt.block_on(enrollment_manager.ensure_enrolled()) {
                    Ok(creds) => {
                        config.agent_id = Some(creds.agent_id.to_string());
                        info!("Enrollment successful! Agent ID: {}", creds.agent_id);
                    }
                    Err(e) => {
                        error!("Enrollment failed: {}", e);
                        show_error_dialog(
                            "Échec de l'enrôlement",
                            &format!(
                                "L'enrôlement a échoué: {}\n\nVérifiez que le token est valide et non expiré.",
                                e
                            ),
                        );
                        return ExitCode::FAILURE;
                    }
                }
            }
            None => {
                return ExitCode::FAILURE;
            }
        }
    }

    // Create runtime with enrolled config and database
    let db = std::sync::Arc::new(db);
    let runtime = AgentRuntime::new(config).with_database(db);
    let shutdown = runtime.shutdown_signal();

    // Set up Ctrl+C handler
    ctrlc_handler(shutdown.clone());

    if no_tray {
        // Headless mode
        info!("Running in headless mode (no tray icon)");
        let rt = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(e) => {
                error!("Failed to create Tokio runtime: {}", e);
                return ExitCode::FAILURE;
            }
        };
        match rt.block_on(runtime.run()) {
            Ok(()) => ExitCode::SUCCESS,
            Err(e) => {
                error!("Agent error: {}", e);
                ExitCode::FAILURE
            }
        }
    } else {
        #[cfg(feature = "tray")]
        {
            run_with_tray(runtime)
        }
        #[cfg(not(feature = "tray"))]
        {
            info!("Tray feature not enabled, running in headless mode");
            let rt = match tokio::runtime::Runtime::new() {
                Ok(rt) => rt,
                Err(e) => {
                    error!("Failed to create Tokio runtime: {}", e);
                    return ExitCode::FAILURE;
                }
            };
            match rt.block_on(runtime.run()) {
                Ok(()) => ExitCode::SUCCESS,
                Err(e) => {
                    error!("Agent error: {}", e);
                    ExitCode::FAILURE
                }
            }
        }
    }
}

/// Run the agent with a system tray icon.
#[cfg(feature = "tray")]
fn run_with_tray(runtime: AgentRuntime) -> ExitCode {
    info!("Starting with system tray icon");

    let shutdown = runtime.shutdown_signal();

    // Create the tao event loop (required for tray icon on macOS)
    #[allow(unused_mut)] // mut needed on macOS for set_activation_policy
    let mut event_loop = EventLoopBuilder::new().build();

    // On macOS, set activation policy to Accessory (no dock icon, no window)
    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::{ActivationPolicy, EventLoopExtMacOS};
        event_loop.set_activation_policy(ActivationPolicy::Accessory);
    }

    // Create tray icon
    let (agent_tray, _command_rx): (tray::AgentTray, _) = match tray::AgentTray::new(shutdown.clone()) {
        Ok(tray) => tray,
        Err(e) => {
            warn!(
                "Failed to create tray icon: {}. Running in headless mode.",
                e
            );
            // Fall back to headless mode
            let rt = match tokio::runtime::Runtime::new() {
                Ok(rt) => rt,
                Err(e) => {
                    error!("Failed to create Tokio runtime: {}", e);
                    return ExitCode::FAILURE;
                }
            };
            return match rt.block_on(runtime.run()) {
                Ok(()) => ExitCode::SUCCESS,
                Err(e) => {
                    error!("Agent error: {}", e);
                    ExitCode::FAILURE
                }
            };
        }
    };

    // Create Tokio runtime for async operations
    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            error!("Failed to create Tokio runtime: {}", e);
            return ExitCode::FAILURE;
        }
    };

    // Spawn the agent loop in a background task
    // Note: We use _ prefix because event_loop.run() never returns,
    // so we can't await this handle. The agent runs until tray shutdown.
    let _agent_handle = rt.spawn(async move { runtime.run().await });

    // Subscribe to menu events
    let menu_channel = MenuEvent::receiver();

    info!("Sentinel GRC Agent is running. Use tray icon to pause, resume, or quit.");

    // Run the tao event loop (required for tray to work on macOS)
    // Note: event_loop.run() never returns - it exits the process directly
    let mut shutdown_logged = false;
    event_loop.run(move |_event, _, control_flow| {
        // Check if shutdown was requested first
        if shutdown.load(Ordering::SeqCst) {
            if !shutdown_logged {
                info!("Shutdown requested, stopping agent...");
                shutdown_logged = true;
            }
            *control_flow = ControlFlow::Exit;
            return;
        }

        // Check for menu events (non-blocking, drain all pending)
        while let Ok(event) = menu_channel.try_recv() {
            agent_tray.handle_menu_event(&event);
        }

        // Use WaitUntil with 1 second interval to check shutdown periodically
        // This keeps CPU near 0% while still responding to Ctrl+C within 1s
        *control_flow =
            ControlFlow::WaitUntil(std::time::Instant::now() + std::time::Duration::from_secs(1));
    })
}

/// Run the agent with the egui desktop GUI.
///
/// The GUI handles enrollment (if not yet enrolled), dashboard, and all
/// pages.  The agent runtime is spawned in a background thread.
#[cfg(feature = "gui")]
fn run_with_gui(config: AgentConfig, enrolled: bool, log_level: &str) -> ExitCode {
    use agent_gui::enrollment::EnrollmentCommand;
    use agent_gui::events::{AgentEvent, GuiCommand};
    use std::sync::mpsc;

    // Initialize logging with the GUI terminal bridge.
    // This installs a custom tracing layer that captures all tracing events
    // and forwards them to the GUI terminal page.
    let tracing_bridge = agent_core::init_logging_with_terminal(log_level);

    info!(
        "Starting Sentinel Agent with egui GUI (enrolled={})",
        enrolled
    );

    let (event_tx, event_rx) = mpsc::channel::<AgentEvent>();
    let (command_tx, command_rx) = mpsc::channel::<GuiCommand>();
    let (enrollment_tx, enrollment_rx) = mpsc::channel::<EnrollmentCommand>();

    // Connect the tracing bridge so log events flow to the GUI terminal
    tracing_bridge.set_sender(event_tx.clone());

    // Spawn background thread for runtime + enrollment
    let bg_event_tx = event_tx.clone();
    std::thread::spawn(move || {
        let rt = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(e) => {
                tracing::error!(
                    "Failed to create Tokio runtime in GUI background thread: {}",
                    e
                );
                return;
            }
        };
        rt.block_on(async move {
            let mut config = config;

            // ── Handle enrollment from GUI if not yet enrolled ──
            if !enrolled {
                loop {
                    // Poll for enrollment commands (non-blocking in async)
                    let cmd = loop {
                        match enrollment_rx.try_recv() {
                            Ok(cmd) => break Some(cmd),
                            Err(mpsc::TryRecvError::Empty) => {
                                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                            }
                            Err(mpsc::TryRecvError::Disconnected) => break None,
                        }
                    };

                    match cmd {
                        Some(EnrollmentCommand::SubmitToken(token)) => {
                            info!("GUI enrollment: received token");
                            config.enrollment_token = Some(token);

                            // Open DB and attempt enrollment
                            let result = enroll_with_config(&config).await;
                            match result {
                                Ok(enrollment) => {
                                    config.agent_id = Some(enrollment.agent_id.clone());
                                    config.client_certificate = Some(enrollment.client_certificate);
                                    config.client_key = Some(enrollment.client_key);
                                    if let Err(e) = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                        success: true,
                                        message: format!(
                                            "Agent enrôlé avec succès.\nID: {}",
                                            enrollment.agent_id
                                        ),
                                        agent_id: Some(enrollment.agent_id),
                                    }) {
                                        error!("Failed to send enrollment success event: {}", e);
                                    }
                                    // Wait for Finish before starting runtime
                                    wait_for_finish(&enrollment_rx).await;
                                    break;
                                }
                                Err(e) => {
                                    warn!("GUI enrollment failed: {}", e);
                                    if let Err(e2) = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                        success: false,
                                        message: format!("Échec: {}", e),
                                        agent_id: None,
                                    }) {
                                        error!("Failed to send enrollment failure event: {}", e2);
                                    }
                                    // Continue loop -- user can retry
                                }
                            }
                        }
                        Some(EnrollmentCommand::SubmitQr(qr_data)) => {
                            info!("GUI enrollment: received QR data");
                            // QR payload is JSON with { server_url, token, ... }
                            if let Ok(payload) = serde_json::from_str::<serde_json::Value>(&qr_data)
                            {
                                if let Some(token) = payload
                                    .get("enrollment_token")
                                    .or_else(|| payload.get("token"))
                                    .and_then(|v| v.as_str())
                                {
                                    config.enrollment_token = Some(token.to_string());
                                    if let Some(url) =
                                        payload.get("server_url").and_then(|v| v.as_str())
                                    {
                                        // Validate server URL to prevent phishing via malicious QR codes
                                        if url.starts_with("https://") && !url.contains('@') && !url.contains(' ') {
                                            config.server_url = url.to_string();
                                        } else {
                                            warn!("Rejected invalid server_url from QR code: must be HTTPS without credentials");
                                        }
                                    }
                                }
                            } else {
                                // Treat raw QR data as token
                                config.enrollment_token = Some(qr_data);
                            }

                            let result = enroll_with_config(&config).await;
                            match result {
                                Ok(enrollment) => {
                                    config.agent_id = Some(enrollment.agent_id.clone());
                                    config.client_certificate = Some(enrollment.client_certificate);
                                    config.client_key = Some(enrollment.client_key);
                                    if let Err(e) = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                        success: true,
                                        message: format!(
                                            "Agent enrôlé avec succès.\nID: {}",
                                            enrollment.agent_id
                                        ),
                                        agent_id: Some(enrollment.agent_id),
                                    }) {
                                        error!("Failed to send QR enrollment success event: {}", e);
                                    }
                                    wait_for_finish(&enrollment_rx).await;
                                    break;
                                }
                                Err(e) => {
                                    if let Err(e2) = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                        success: false,
                                        message: format!("Échec: {}", e),
                                        agent_id: None,
                                    }) {
                                        error!("Failed to send QR enrollment failure event: {}", e2);
                                    }
                                }
                            }
                        }
                        Some(EnrollmentCommand::Cancel) | None => {
                            info!("Enrollment cancelled or channel closed");
                            return;
                        }
                        Some(EnrollmentCommand::Finish) => {
                            // User clicked finish on a retry -- just break
                            break;
                        }
                    }
                }
            }

            // ── Run the agent runtime ──
            // Open database for sync services
            let db_arc = {
                use agent_storage::{Database, DatabaseConfig, KeyManager};
                let db_config = DatabaseConfig::default();
                match KeyManager::new().and_then(|km| Database::open(db_config, &km)) {
                    Ok(db) => Some(std::sync::Arc::new(db)),
                    Err(e) => {
                        tracing::warn!("Failed to open database for sync services: {}", e);
                        None
                    }
                }
            };

            let mut runtime = AgentRuntime::new(config);
            if let Some(db) = db_arc {
                runtime = runtime.with_database(db);
            }
            runtime.set_gui_event_tx(bg_event_tx.clone());
            let handle = runtime.handle();

            // Spawn command processor
            tokio::spawn(async move {
                loop {
                    match command_rx.try_recv() {
                        Ok(GuiCommand::Pause) => {
                            info!("[AUDIT] GUI user requested agent pause");
                            handle.pause();
                        }
                        Ok(GuiCommand::Resume) => {
                            info!("[AUDIT] GUI user requested agent resume");
                            handle.resume();
                        }
                        Ok(GuiCommand::Shutdown) => {
                            info!("[AUDIT] GUI user requested agent shutdown");
                            handle.request_shutdown();
                            break;
                        }
                        Ok(GuiCommand::RunCheck) => {
                            info!("[AUDIT] GUI user requested manual check run");
                            handle.trigger_check();
                        }
                        Ok(GuiCommand::ForceSync) => {
                            info!("GUI requested force sync");
                            handle.trigger_sync();
                        }
                        Ok(GuiCommand::StartDiscovery) => {
                            info!("GUI requested network discovery");
                            handle.trigger_discovery();
                        }
                        Ok(GuiCommand::StopDiscovery) => {
                            info!("GUI requested discovery cancellation");
                            handle.cancel_discovery();
                        }
                        Ok(GuiCommand::CheckUpdate) => {
                            info!("[AUDIT] GUI user requested manual update check");
                            handle.trigger_update();
                        }
                        Ok(GuiCommand::ProposeAsset {
                            ip,
                            hostname,
                            device_type,
                        }) => {
                            info!("[AUDIT] GUI user proposed asset: {}", ip);
                            handle.propose_asset(ip, hostname, device_type);
                        }
                        Ok(GuiCommand::UpdateCheckInterval { interval_secs }) => {
                            info!("[AUDIT] GUI user updated check interval to {} seconds", interval_secs);
                            handle.set_check_interval(interval_secs);
                        }
                        Ok(GuiCommand::SetLogLevel { level }) => {
                            handle.set_log_level(level);
                        }
                        Ok(GuiCommand::Remediate { check_id }) => {
                            info!("[AUDIT] GUI user requested remediation for check: {}", check_id);
                            handle.remediate(check_id);
                        }
                        Ok(GuiCommand::RemediatePreview { check_id }) => {
                            info!("[AUDIT] GUI user previewed remediation for check: {}", check_id);
                            handle.remediate_preview(check_id);
                        }
                        Ok(GuiCommand::RunSync) => {
                            info!("[AUDIT] GUI user requested sync");
                            handle.trigger_sync();
                        }
                        Ok(GuiCommand::GetSummary) => {
                            // Summary is emitted continuously via status updates; this is a no-op
                            debug!("GUI requested summary (already sent via periodic updates)");
                        }
                        Ok(GuiCommand::GetCheckResults) => {
                            // Check results are emitted via CheckCompleted events; this is a no-op
                            debug!("GUI requested check results (already sent via events)");
                        }
                        Ok(GuiCommand::MarkNotificationRead { notification_id }) => {
                            info!("[AUDIT] GUI marked notification {} as read", notification_id);
                            // Notification read state is managed in GUI state
                        }
                        Ok(GuiCommand::MarkAllNotificationsRead) => {
                            info!("[AUDIT] GUI marked all notifications as read");
                            // Notification read state is managed in GUI state
                        }
                        Ok(GuiCommand::AcknowledgeFimAlert { alert_id }) => {
                            info!("[AUDIT] GUI acknowledged FIM alert: {}", alert_id);
                            // FIM acknowledgment state is managed in GUI state
                        }
                        Ok(GuiCommand::ExportCsvAuditTrail) => {
                            info!("[AUDIT] GUI requested audit trail CSV export");
                            // CSV export is handled client-side in the GUI
                        }
                        Err(mpsc::TryRecvError::Empty) => {
                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                        }
                        Err(mpsc::TryRecvError::Disconnected) => break,
                    }
                }
            });

            // Run the agent (blocks until shutdown)
            if let Err(e) = runtime.run().await {
                error!("Agent runtime error: {}", e);
            }
        });
    });

    // Launch GUI on main thread (blocks until window closes)
    match agent_gui::run_gui(enrolled, event_rx, command_tx, enrollment_tx) {
        Ok(()) => {
            info!("GUI exited normally");
            ExitCode::SUCCESS
        }
        Err(e) => {
            error!("GUI error: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Perform enrollment using the current config. Returns the agent ID on success.
/// Enrollment result containing credentials needed by the runtime.
#[cfg(feature = "gui")]
struct EnrollmentResult {
    agent_id: String,
    client_certificate: String,
    client_key: String,
}

#[cfg(feature = "gui")]
async fn enroll_with_config(config: &AgentConfig) -> Result<EnrollmentResult, String> {
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    use agent_sync::EnrollmentManager;

    let db_config = DatabaseConfig::default();
    let key_manager = KeyManager::new().map_err(|e| format!("KeyManager: {}", e))?;
    let db = Database::open(db_config, &key_manager).map_err(|e| format!("DB: {}", e))?;
    let enrollment_manager = EnrollmentManager::new(config, &db);

    let creds = enrollment_manager
        .ensure_enrolled()
        .await
        .map_err(|e| e.to_string())?;

    Ok(EnrollmentResult {
        agent_id: creds.agent_id.to_string(),
        client_certificate: creds.client_certificate,
        client_key: creds.client_private_key,
    })
}

/// Wait for the user to click "Continuer" after successful enrollment.
#[cfg(feature = "gui")]
async fn wait_for_finish(rx: &std::sync::mpsc::Receiver<agent_gui::enrollment::EnrollmentCommand>) {
    loop {
        match rx.try_recv() {
            Ok(agent_gui::enrollment::EnrollmentCommand::Finish) => break,
            Ok(_) => continue,
            Err(std::sync::mpsc::TryRecvError::Empty) => {
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
            Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
        }
    }
}

/// Set up Ctrl+C handler for graceful shutdown.
fn ctrlc_handler(shutdown: agent_core::ShutdownSignal) {
    if let Err(e) = ctrlc::handle(move || {
        info!("Received Ctrl+C, initiating shutdown...");
        shutdown.store(true, std::sync::atomic::Ordering::SeqCst);
    }) {
        warn!(
            "Failed to set Ctrl+C handler: {}. Agent may not shut down gracefully on signal.",
            e
        );
    }
}

/// Show enrollment dialog to get token from user.
#[cfg(target_os = "macos")]
fn show_enrollment_dialog() -> Option<String> {
    use std::process::Command;

    // AppleScript dialog for enrollment token
    let script = r#"
        set dialogResult to display dialog "Bienvenue dans Sentinel Agent!

Pour enrôler cet agent, entrez le token d'enrôlement fourni par votre administrateur.

Vous pouvez obtenir ce token depuis:
Sentinel GRC → Paramètres → Agents → Enrôler un Agent" default answer "" with title "Sentinel Agent - Enrôlement" with icon note buttons {"Annuler", "Enrôler"} default button "Enrôler"
        if button returned of dialogResult is "Enrôler" then
            return text returned of dialogResult
        else
            return ""
        end if
    "#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .ok()?;

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() { None } else { Some(token) }
}

#[cfg(target_os = "windows")]
fn show_enrollment_dialog() -> Option<String> {
    use std::process::Command;

    // PowerShell input dialog
    let script = r#"
        Add-Type -AssemblyName Microsoft.VisualBasic
        $token = [Microsoft.VisualBasic.Interaction]::InputBox(
            "Pour enrôler cet agent, entrez le token d'enrôlement fourni par votre administrateur.`n`nVous pouvez obtenir ce token depuis:`nSentinel GRC → Paramètres → Agents → Enrôler un Agent",
            "Sentinel Agent - Enrôlement",
            ""
        )
        Write-Output $token
    "#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .ok()?;

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() { None } else { Some(token) }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn show_enrollment_dialog() -> Option<String> {
    // Linux - try zenity or kdialog
    use std::process::Command;

    // Try zenity first (GNOME/GTK)
    if let Ok(output) = Command::new("zenity")
        .args([
            "--entry",
            "--title=Sentinel Agent - Enrôlement",
            "--text=Entrez le token d'enrôlement:",
            "--width=400",
        ])
        .output()
    {
        let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !token.is_empty() {
            return Some(token);
        }
    }

    // Try kdialog (KDE)
    if let Ok(output) = Command::new("kdialog")
        .args([
            "--inputbox",
            "Entrez le token d'enrôlement:",
            "--title",
            "Sentinel Agent - Enrôlement",
        ])
        .output()
    {
        let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !token.is_empty() {
            return Some(token);
        }
    }

    // Fallback: prompt in terminal
    println!("Token d'enrôlement:");
    let mut token = String::new();
    if std::io::stdin().read_line(&mut token).is_ok() {
        let token = token.trim().to_string();
        if !token.is_empty() {
            return Some(token);
        }
    }

    None
}

/// Show error dialog.
#[cfg(target_os = "macos")]
fn show_error_dialog(title: &str, message: &str) {
    use std::process::Command;

    // Sanitize inputs for AppleScript: escape backslashes, quotes, and ampersands
    fn sanitize_applescript(s: &str) -> String {
        s.replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('&', "and")
    }

    let script = format!(
        r#"display dialog "{}" with title "{}" buttons {{"OK"}} default button "OK" with icon stop"#,
        sanitize_applescript(message),
        sanitize_applescript(title)
    );

    let _ = Command::new("osascript").arg("-e").arg(script).output();
}

#[cfg(target_os = "windows")]
fn show_error_dialog(title: &str, message: &str) {
    use std::process::Command;

    // Sanitize inputs for PowerShell: escape single quotes and backticks
    fn sanitize_powershell(s: &str) -> String {
        s.replace('\'', "''").replace('`', "``").replace('$', "`$")
    }

    let script = format!(
        r#"Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('{}', '{}', 'OK', 'Error')"#,
        sanitize_powershell(message),
        sanitize_powershell(title)
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output();
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn show_error_dialog(title: &str, message: &str) {
    use std::process::Command;

    // Try zenity
    let _ = Command::new("zenity")
        .args([
            "--error",
            &format!("--title={}", title),
            &format!("--text={}", message),
        ])
        .output();
}

/// Wrapper module for ctrlc since we can't add it as a dependency easily
mod ctrlc {
    use std::sync::atomic::{AtomicBool, Ordering};

    static HANDLER_SET: AtomicBool = AtomicBool::new(false);

    #[cfg(windows)]
    static SHUTDOWN_FLAG: AtomicBool = AtomicBool::new(false);

    #[cfg(windows)]
    static HANDLER_CALLBACK: std::sync::OnceLock<Box<dyn Fn() + Send + Sync + 'static>> =
        std::sync::OnceLock::new();

    pub fn handle<F>(handler: F) -> Result<(), &'static str>
    where
        F: Fn() + Send + Sync + 'static,
    {
        if HANDLER_SET.swap(true, Ordering::SeqCst) {
            return Err("Handler already set");
        }

        #[cfg(unix)]
        {
            use std::thread;
            thread::spawn(move || {
                let mut signals = match signal_hook::iterator::Signals::new([
                    signal_hook::consts::SIGINT,
                    signal_hook::consts::SIGTERM,
                    signal_hook::consts::SIGHUP,
                ]) {
                    Ok(s) => s,
                    Err(e) => {
                        tracing::warn!(
                            "Failed to create signal iterator: {}. Signal handling disabled.",
                            e
                        );
                        return;
                    }
                };

                if let Some(sig) = signals.forever().next() {
                    match sig {
                        signal_hook::consts::SIGINT => {
                            tracing::info!("Received SIGINT (Ctrl+C), initiating graceful shutdown...");
                        }
                        signal_hook::consts::SIGTERM => {
                            tracing::info!("Received SIGTERM, initiating graceful shutdown...");
                        }
                        signal_hook::consts::SIGHUP => {
                            tracing::info!("Received SIGHUP, initiating graceful shutdown...");
                        }
                        _ => {
                            tracing::info!("Received signal {}, initiating graceful shutdown...", sig);
                        }
                    }
                    handler();
                }
            });
        }

        #[cfg(windows)]
        {
            use windows::Win32::System::Console::SetConsoleCtrlHandler;

            // Store the handler in a thread-safe way using OnceLock (no UB)
            let _ = HANDLER_CALLBACK.set(Box::new(handler));

            // Console control handler function
            unsafe extern "system" fn console_handler(
                ctrl_type: u32,
            ) -> windows::Win32::Foundation::BOOL {
                // CTRL_C_EVENT = 0, CTRL_BREAK_EVENT = 1, CTRL_CLOSE_EVENT = 2
                // CTRL_LOGOFF_EVENT = 5, CTRL_SHUTDOWN_EVENT = 6
                if ctrl_type <= 2 || ctrl_type == 5 || ctrl_type == 6 {
                    SHUTDOWN_FLAG.store(true, Ordering::SeqCst);

                    // Trigger the callback if it exists (safe: OnceLock is Sync)
                    if let Some(callback) = HANDLER_CALLBACK.get() {
                        callback();
                    }

                    return true.into(); // TRUE - we handled it
                }
                false.into() // FALSE - pass to next handler
            }

            unsafe {
                if SetConsoleCtrlHandler(Some(console_handler), true).is_err() {
                    tracing::warn!("Failed to set Windows console control handler.");
                }
            }
        }

        Ok(())
    }
}
