// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

#![windows_subsystem = "windows"]
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
        /// Server URL (overrides config file)
        #[arg(short, long)]
        server: Option<String>,
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
    // Windows: write a startup breadcrumb before anything else so silent crashes
    // leave a trace in C:\ProgramData\Sentinel\logs\startup.log.
    #[cfg(windows)]
    {
        // Even though we are a "windows" subsystem (so double-clicking doesn't spawn a console),
        // we still want printf/println to work if launched from an existing cmd/powershell.
        unsafe {
            let _ = windows::Win32::System::Console::AttachConsole(
                windows::Win32::System::Console::ATTACH_PARENT_PROCESS,
            );
        }

        use std::fs::{self, OpenOptions};
        use std::io::Write;
        let log_dir = r"C:\ProgramData\Sentinel\logs";
        let log_file = r"C:\ProgramData\Sentinel\logs\startup.log";
        let _ = fs::create_dir_all(log_dir);

        // Prevent infinite growth by keeping it under 5MB
        if let Ok(metadata) = fs::metadata(log_file) {
            if metadata.len() > 5 * 1024 * 1024 {
                let _ = fs::rename(log_file, format!("{}.old", log_file));
            }
        }

        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_file) {
            let _ = writeln!(
                f,
                "[{}] starting, args: {:?}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                std::env::args().collect::<Vec<_>>()
            );
        }
    }

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

        let msg = format!("PANIC at {}: {}", location, payload);
        eprintln!("{}", msg);

        // Also log to a file on Windows so we can see it even if stderr is hidden
        #[cfg(windows)]
        {
            use std::fs::{self, OpenOptions};
            use std::io::Write;
            let log_dir = r"C:\ProgramData\Sentinel\logs";
            let panic_log = r"C:\ProgramData\Sentinel\logs\panic.log";
            let _ = fs::create_dir_all(log_dir);

            // Prevent infinite growth
            if let Ok(metadata) = fs::metadata(panic_log) {
                if metadata.len() > 5 * 1024 * 1024 {
                    let _ = fs::rename(panic_log, format!("{}.old", panic_log));
                }
            }

            if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(panic_log) {
                let _ = writeln!(
                    f,
                    "[{}] {}",
                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                    msg
                );
            }
        }

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

    // Initialize logging immediately to capture setup errors.
    // In GUI mode, logging is deferred to run_with_gui() which installs
    // the tracing subscriber with the GUI terminal bridge and connects
    // the event sender.  Initializing here would install a subscriber
    // whose bridge is never connected, and the second init in
    // run_with_gui() would silently fail (global subscriber already set).
    if !gui_mode {
        init_logging(&cli.log_level);
    }

    // Handle subcommands
    match cli.command {
        Some(Commands::Enroll { token, server }) => handle_enroll(&token, server.as_deref()),
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
fn handle_enroll(token: &str, server_url: Option<&str>) -> ExitCode {
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
    if let Some(url) = server_url {
        config.server_url = url.to_string();
    }

    // Initialize database (with recovery for encryption mismatches since enrollment
    // is always done on a non-enrolled agent)
    let db_config = DatabaseConfig::default();
    let key_manager = match KeyManager::new() {
        Ok(km) => km,
        Err(e) => {
            if let agent_storage::StorageError::EncryptionLost(_) = &e {
                warn!(
                    "Encryption context lost during enrollment. Resetting to recover: {}",
                    e
                );
                let db_path = std::path::PathBuf::from(&config.db_path);
                #[cfg(windows)]
                let key_file = "key.dpapi";
                #[cfg(not(windows))]
                let key_file = ".sentinel-key";
                let key_path = db_path
                    .parent()
                    .map(|p| p.join(key_file))
                    .unwrap_or_else(|| std::path::PathBuf::from(key_file));

                let _ = std::fs::remove_file(&db_path);
                if let Err(re) = std::fs::remove_file(&key_path) {
                    warn!("Failed to remove old key file: {}", re);
                }
                match KeyManager::new() {
                    Ok(km) => km,
                    Err(retry_err) => {
                        error!("Failed to recover key manager: {}", retry_err);
                        return ExitCode::FAILURE;
                    }
                }
            } else {
                error!("Failed to initialize key manager: {}", e);
                return ExitCode::FAILURE;
            }
        }
    };

    let db = match Database::open(db_config.clone(), &key_manager) {
        Ok(db) => db,
        Err(e) => {
            if matches!(&e, agent_storage::StorageError::Encryption(_)) {
                warn!(
                    "Database encryption mismatch during enrollment: {}. Resetting.",
                    e
                );
                let db_path = std::path::PathBuf::from(&config.db_path);
                #[cfg(windows)]
                let key_file = "key.dpapi";
                #[cfg(not(windows))]
                let key_file = ".sentinel-key";
                let key_path = db_path
                    .parent()
                    .map(|p| p.join(key_file))
                    .unwrap_or_else(|| std::path::PathBuf::from(key_file));

                if db_path.exists() {
                    let backup_path = db_path.with_extension("db.bak");
                    if let Err(re) = std::fs::rename(&db_path, &backup_path) {
                        warn!("Failed to backup database: {}", re);
                        let _ = std::fs::remove_file(&db_path);
                    } else {
                        info!("Backed up old database to {:?}", backup_path);
                    }
                }
                if let Err(re) = std::fs::remove_file(&key_path) {
                    warn!("Failed to remove old key file: {}", re);
                }

                let key_manager = match KeyManager::new() {
                    Ok(km) => km,
                    Err(retry_err) => {
                        error!("Failed to recover key manager after reset: {}", retry_err);
                        return ExitCode::FAILURE;
                    }
                };
                match Database::open(db_config, &key_manager) {
                    Ok(db) => {
                        info!("Database recreated successfully for enrollment");
                        db
                    }
                    Err(retry_err) => {
                        error!("Failed to open database after reset: {}", retry_err);
                        return ExitCode::FAILURE;
                    }
                }
            } else {
                error!("Failed to open database: {}", e);
                return ExitCode::FAILURE;
            }
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
            error!(
                "Enrollment failed: {}. Please check: the token is valid and not expired, you have network connectivity, the token hasn't reached its usage limit",
                e
            );
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
            info!(
                "Service installed successfully. Use 'sentinel-agent start' to start the service."
            );
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
        info!(
            "Agent service removed. Configuration and data preserved. Use '--purge' to remove all data."
        );
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
            // If encryption is lost and agent is NOT enrolled, we can safely reset.
            // This happens after MSI upgrades if DPAPI context changes.
            if let agent_storage::StorageError::EncryptionLost(_) = &e {
                if !config.is_enrolled() {
                    warn!(
                        "Encryption context lost on un-enrolled agent. Resetting database to recover."
                    );
                    let db_path = std::path::PathBuf::from(&config.db_path);
                    #[cfg(windows)]
                    let key_file = "key.dpapi";
                    #[cfg(not(windows))]
                    let key_file = ".sentinel-key";
                    let key_path = db_path
                        .parent()
                        .map(|p| p.join(key_file))
                        .unwrap_or_else(|| std::path::PathBuf::from(key_file));

                    // Back up existing DB before deleting
                    if db_path.exists() {
                        let backup_path = db_path.with_extension("db.bak");
                        if let Err(e) = std::fs::rename(&db_path, &backup_path) {
                            warn!("Failed to backup database: {}", e);
                            let _ = std::fs::remove_file(&db_path);
                        } else {
                            info!("Backed up old database to {:?}", backup_path);
                        }
                    }
                    if let Err(e) = std::fs::remove_file(&key_path) {
                        warn!("Failed to remove old key file: {}", e);
                    }

                    // Retry once
                    match KeyManager::new() {
                        Ok(km) => km,
                        Err(retry_err) => {
                            error!("Failed to recover from encryption loss: {}", retry_err);
                            #[cfg(windows)]
                            if !no_tray {
                                show_fatal_error(&format!(
                                    "Erreur critique de chiffrement : {}\n\nL'agent ne peut pas démarrer.",
                                    retry_err
                                ));
                            }
                            return ExitCode::FAILURE;
                        }
                    }
                } else {
                    error!(
                        "Encryption context lost on ENROLLED agent. Manual recovery required: {}",
                        e
                    );
                    #[cfg(windows)]
                    if !no_tray {
                        show_fatal_error(&format!(
                            "Clé de chiffrement perdue sur un agent déjà enrôlé : {}\n\nUne intervention manuelle ou un ré-enrôlement est requis.\n\nErreur : {}",
                            e, e
                        ));
                    }
                    return ExitCode::FAILURE;
                }
            } else {
                error!("Failed to initialize key manager: {}", e);
                #[cfg(windows)]
                if !no_tray {
                    show_fatal_error(&format!(
                        "Échec de l'initialisation de la clé de sécurité : {}\n\nL'agent ne peut pas démarrer.",
                        e
                    ));
                }
                return ExitCode::FAILURE;
            }
        }
    };

    let db = match Database::open(db_config.clone(), &key_manager) {
        Ok(db) => db,
        Err(e) => {
            // If encryption verification fails and agent is NOT enrolled, reset DB and key
            // to recover. This can happen when the DB was created without encryption or with
            // a different key (e.g. after an upgrade or platform key context change).
            let is_encryption_error = matches!(&e, agent_storage::StorageError::Encryption(_));
            if is_encryption_error && !config.is_enrolled() {
                warn!(
                    "Database encryption mismatch on un-enrolled agent: {}. Resetting to recover.",
                    e
                );
                let db_path = std::path::PathBuf::from(&config.db_path);
                #[cfg(windows)]
                let key_file = "key.dpapi";
                #[cfg(not(windows))]
                let key_file = ".sentinel-key";
                let key_path = db_path
                    .parent()
                    .map(|p| p.join(key_file))
                    .unwrap_or_else(|| std::path::PathBuf::from(key_file));

                // Back up existing DB before deleting
                if db_path.exists() {
                    let backup_path = db_path.with_extension("db.bak");
                    if let Err(e) = std::fs::rename(&db_path, &backup_path) {
                        warn!("Failed to backup database: {}", e);
                        let _ = std::fs::remove_file(&db_path);
                    } else {
                        info!("Backed up old database to {:?}", backup_path);
                    }
                }
                if let Err(e) = std::fs::remove_file(&key_path) {
                    warn!("Failed to remove old key file: {}", e);
                }

                // Recreate key manager and database
                let key_manager = match KeyManager::new() {
                    Ok(km) => km,
                    Err(retry_err) => {
                        error!("Failed to recover key manager after reset: {}", retry_err);
                        return ExitCode::FAILURE;
                    }
                };
                match Database::open(db_config, &key_manager) {
                    Ok(db) => {
                        info!("Database recreated successfully after encryption reset");
                        db
                    }
                    Err(retry_err) => {
                        error!("Failed to open database after reset: {}", retry_err);
                        return ExitCode::FAILURE;
                    }
                }
            } else {
                error!("Failed to open database: {}", e);
                return ExitCode::FAILURE;
            }
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

    // ── GUI mode: delegate enrollment + runtime to GUI ──
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
    let (agent_tray, _command_rx): (tray::AgentTray, _) =
        match tray::AgentTray::new(shutdown.clone()) {
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
                        Some(EnrollmentCommand::SubmitEnrollment { token, admin_password }) => {
                            info!("GUI enrollment: received token and password");
                            config.enrollment_token = Some(token);
                            config.admin_password = admin_password.clone();

                            // Open DB and attempt enrollment
                            let result = enroll_with_config(&config, admin_password).await;
                            match result {
                                Ok(enrollment) => {
                                    config.agent_id = Some(enrollment.agent_id.clone());
                                    config.organization_id = Some(enrollment.organization_id.clone());
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

                            let result = enroll_with_config(&config, None).await;
                            match result {
                                Ok(enrollment) => {
                                    config.agent_id = Some(enrollment.agent_id.clone());
                                    config.organization_id = Some(enrollment.organization_id.clone());
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

            // Run v2 persistence migrations (GUI tables: events, notifications, policy_snapshots)
            #[cfg(feature = "gui")]
            if let Some(ref db) = db_arc {
                match db.with_connection_mut(|conn| {
                    agent_persistence::run_v2_migrations(conn)
                        .map_err(|e| agent_storage::StorageError::Migration(e.to_string()))
                }).await {
                    Ok(()) => info!("Persistence v2 migrations applied"),
                    Err(e) => warn!("Failed to apply v2 migrations (non-fatal): {}", e),
                }
            }

            let db_for_commands = db_arc.clone();
            let mut runtime = AgentRuntime::new(config);
            if let Some(db) = db_arc {
                runtime = runtime.with_database(db);
            }
            runtime.set_gui_event_tx(bg_event_tx.clone());
            let sync_client = runtime.sync_client();
            let handle = runtime.handle();

            // Initialize LLM service for AI-powered analysis
            #[cfg(feature = "llm")]
            let llm_service = {
                let svc = agent_core::llm_service::LLMService::new(None).await;
                match svc {
                    Ok(s) => {
                        let arc_svc = std::sync::Arc::new(s);
                        // Emit initial LLM status to GUI
                        let status = arc_svc.get_status().await;
                        let (model_name, status_str, mem) = match &status {
                            agent_core::llm_service::LLMServiceStatus::Ready { model_name, memory_usage_mb, .. } => {
                                (model_name.clone(), "ready".to_string(), *memory_usage_mb)
                            }
                            agent_core::llm_service::LLMServiceStatus::Error(reason) => {
                                ("N/A".to_string(), format!("error: {}", reason), 0)
                            }
                            _ => ("N/A".to_string(), "not_configured".to_string(), 0),
                        };
                        let _ = bg_event_tx.send(AgentEvent::LlmStatusUpdate {
                            model_name,
                            status: status_str,
                            inference_count: 0,
                            memory_mb: mem,
                        });
                        info!("LLM service initialized for command processing");
                        Some(arc_svc)
                    }
                    Err(e) => {
                        warn!("Failed to init LLM service: {}", e);
                        let _ = bg_event_tx.send(AgentEvent::LlmStatusUpdate {
                            model_name: "N/A".to_string(),
                            status: format!("error: {}", e),
                            inference_count: 0,
                            memory_mb: 0,
                        });
                        None
                    }
                }
            };
            #[cfg(not(feature = "llm"))]
            let llm_service: Option<std::sync::Arc<()>> = None;

            // Spawn command processor
            let handle_for_commands = handle.clone();
            tokio::spawn(async move {
                loop {
                    match command_rx.try_recv() {
                        Ok(GuiCommand::Pause) => {
                            info!("[AUDIT] GUI user requested agent pause");
                            handle_for_commands.pause();
                        }
                        Ok(GuiCommand::Resume) => {
                            info!("[AUDIT] GUI user requested agent resume");
                            handle_for_commands.resume();
                        }
                        Ok(GuiCommand::Shutdown) => {
                            info!("[AUDIT] GUI user requested agent shutdown");
                            handle_for_commands.request_shutdown();
                            break;
                        }
                        Ok(GuiCommand::RunCheck) => {
                            info!("[AUDIT] GUI user requested manual check run");
                            handle_for_commands.trigger_check();
                        }
                        Ok(GuiCommand::ForceSync) => {
                            info!("GUI requested force sync");
                            handle_for_commands.trigger_sync();
                        }
                        Ok(GuiCommand::StartDiscovery) => {
                            info!("GUI requested network discovery");
                            handle_for_commands.trigger_discovery();
                        }
                        Ok(GuiCommand::StopDiscovery) => {
                            info!("GUI requested discovery cancellation");
                            handle_for_commands.cancel_discovery();
                        }
                        Ok(GuiCommand::CheckUpdate) => {
                            info!("[AUDIT] GUI user requested manual update check");
                            handle_for_commands.trigger_update();
                        }
                        Ok(GuiCommand::ProposeAsset {
                            ip,
                            hostname,
                            device_type,
                        }) => {
                            info!("[AUDIT] GUI user proposed asset: {}", ip);
                            handle_for_commands.propose_asset(ip, hostname, device_type);
                        }
                        Ok(GuiCommand::UpdateCheckInterval { interval_secs }) => {
                            info!("[AUDIT] GUI user updated check interval to {} seconds", interval_secs);
                            handle_for_commands.set_check_interval(interval_secs);
                        }
                        Ok(GuiCommand::SetLogLevel { level }) => {
                            handle_for_commands.set_log_level(level);
                        }
                        Ok(GuiCommand::Remediate { check_id }) => {
                            info!("[AUDIT] GUI user requested remediation for check: {}", check_id);
                            handle_for_commands.remediate(check_id);
                        }
                        Ok(GuiCommand::RemediatePreview { check_id }) => {
                            info!("[AUDIT] GUI user previewed remediation for check: {}", check_id);
                            handle_for_commands.remediate_preview(check_id);
                        }
                        Ok(GuiCommand::RunSync) => {
                            info!("[AUDIT] GUI user requested sync");
                            handle_for_commands.trigger_sync();
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
                        Ok(GuiCommand::KillProcess { process_name, pid }) => {
                            info!("[AUDIT] GUI requested process kill: {} (PID {})", process_name, pid);
                            let tx = bg_event_tx.clone();
                            let pname = process_name.clone();
                            tokio::spawn(async move {
                                let action_id = uuid::Uuid::new_v4();
                                match agent_core::edr_actions::kill_process(&pname, pid).await {
                                    Ok(()) => {
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: true,
                                            error: None,
                                        });
                                    }
                                    Err(e) => {
                                        warn!("Kill process failed: {}", e);
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: false,
                                            error: Some(e.to_string()),
                                        });
                                    }
                                }
                            });
                        }
                        Ok(GuiCommand::QuarantineFile { path }) => {
                            info!("[AUDIT] GUI requested file quarantine: {}", path);
                            let tx = bg_event_tx.clone();
                            let file_path = path.clone();
                            tokio::spawn(async move {
                                let action_id = uuid::Uuid::new_v4();
                                match agent_core::edr_actions::quarantine_file(&file_path).await {
                                    Ok(quarantine_id) => {
                                        info!("File quarantined successfully: {}", quarantine_id);
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: true,
                                            error: None,
                                        });
                                    }
                                    Err(e) => {
                                        warn!("Quarantine file failed: {}", e);
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: false,
                                            error: Some(e.to_string()),
                                        });
                                    }
                                }
                            });
                        }
                        Ok(GuiCommand::RestoreQuarantinedFile { quarantine_id }) => {
                            info!("[AUDIT] GUI requested quarantine restore: {}", quarantine_id);
                            let tx = bg_event_tx.clone();
                            let qid = quarantine_id.clone();
                            tokio::spawn(async move {
                                let action_id = uuid::Uuid::new_v4();
                                match agent_core::edr_actions::restore_quarantined_file(&qid).await {
                                    Ok(()) => {
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: true,
                                            error: None,
                                        });
                                    }
                                    Err(e) => {
                                        warn!("Restore quarantined file failed: {}", e);
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: false,
                                            error: Some(e.to_string()),
                                        });
                                    }
                                }
                            });
                        }
                        Ok(GuiCommand::BlockIp { ip, duration_secs }) => {
                            info!("[AUDIT] GUI requested IP block: {} ({}s)", ip, duration_secs);
                            let tx = bg_event_tx.clone();
                            let ip_addr = ip.clone();
                            tokio::spawn(async move {
                                let action_id = uuid::Uuid::new_v4();
                                match agent_core::edr_actions::block_ip(&ip_addr, duration_secs).await {
                                    Ok(()) => {
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: true,
                                            error: None,
                                        });
                                    }
                                    Err(e) => {
                                        warn!("Block IP failed: {}", e);
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: false,
                                            error: Some(e.to_string()),
                                        });
                                    }
                                }
                            });
                        }
                        Ok(GuiCommand::UnblockIp { ip }) => {
                            info!("[AUDIT] GUI requested IP unblock: {}", ip);
                            let tx = bg_event_tx.clone();
                            let ip_addr = ip.clone();
                            tokio::spawn(async move {
                                let action_id = uuid::Uuid::new_v4();
                                match agent_core::edr_actions::unblock_ip(&ip_addr).await {
                                    Ok(()) => {
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: true,
                                            error: None,
                                        });
                                    }
                                    Err(e) => {
                                        warn!("Unblock IP failed: {}", e);
                                        let _ = tx.send(AgentEvent::ResponseActionResult {
                                            action_id,
                                            success: false,
                                            error: Some(e.to_string()),
                                        });
                                    }
                                }
                            });
                        }
                        Ok(GuiCommand::GenerateReport { report_type, framework }) => {
                            info!("[AUDIT] GUI requested report: {:?} framework={:?}", report_type, framework);
                            let tx = bg_event_tx.clone();
                            let svc = llm_service.clone();
                            let fw = framework.clone();
                            tokio::spawn(async move {
                                let report_id = uuid::Uuid::new_v4();
                                let title = match report_type {
                                    agent_gui::dto::ReportType::Executive => {
                                        format!("Rapport exécutif — {}", chrono::Utc::now().format("%d/%m/%Y"))
                                    }
                                    agent_gui::dto::ReportType::ComplianceAudit => {
                                        format!(
                                            "Audit de conformité{} — {}",
                                            fw.as_deref().map(|f| format!(" ({})", f)).unwrap_or_default(),
                                            chrono::Utc::now().format("%d/%m/%Y")
                                        )
                                    }
                                    agent_gui::dto::ReportType::Incident => {
                                        format!("Rapport d'incidents — {}", chrono::Utc::now().format("%d/%m/%Y"))
                                    }
                                };

                                // Build a base summary (static template)
                                let base_summary = format!(
                                    "Rapport {} généré le {}.",
                                    report_type.label_fr(),
                                    chrono::Utc::now().format("%d/%m/%Y à %H:%M UTC")
                                );

                                // Attempt LLM-generated executive summary
                                #[allow(unused_mut)]
                                let mut summary = base_summary.clone();
                                #[cfg(feature = "llm")]
                                {
                                    if let Some(ref svc) = svc
                                        && let Some(manager) = svc.get_manager().await
                                    {
                                        let prompt = format!(
                                            "Tu es un analyste GRC. Génère un résumé exécutif professionnel \
                                             en français (3-5 phrases) pour un rapport de type « {} »{}. \
                                             Le rapport est daté du {}. Sois concis et orienté décision.",
                                            report_type.label_fr(),
                                            fw.as_deref().map(|f| format!(", référentiel {}", f)).unwrap_or_default(),
                                            chrono::Utc::now().format("%d/%m/%Y")
                                        );
                                        let req = agent_llm::engine::InferenceRequest::new(&prompt)
                                            .with_max_tokens(512)
                                            .with_temperature(0.5);
                                        match manager.engine().infer(req).await {
                                            Ok(resp) if !resp.text.trim().is_empty() => {
                                                summary = resp.text.trim().to_string();
                                                debug!("Report summary generated by LLM ({} chars)", summary.len());
                                            }
                                            Ok(_) => {
                                                debug!("LLM returned empty summary, using static template");
                                            }
                                            Err(e) => {
                                                warn!("LLM report summary generation failed: {}", e);
                                            }
                                        }
                                    }
                                }
                                let _ = &svc; // suppress unused-variable warning when llm feature is off

                                let html_content = format!(
                                    "<h1>{}</h1><p>{}</p><footer>Généré par Sentinel GRC Agent</footer>",
                                    title, summary
                                );

                                let report = agent_gui::dto::GeneratedReport {
                                    id: report_id,
                                    report_type,
                                    title,
                                    generated_at: chrono::Utc::now(),
                                    html_content,
                                    summary,
                                    compliance_score: None,
                                    framework: fw,
                                };

                                let _ = tx.send(AgentEvent::ReportGenerated {
                                    report: Box::new(report),
                                });
                            });
                        }
                        Ok(GuiCommand::ExportReportHtml { report_id }) => {
                            info!("[AUDIT] GUI requested HTML export for report: {}", report_id);
                        }
                        Ok(GuiCommand::ExecutePlaybook { playbook_id }) => {
                            info!("[AUDIT] GUI requested playbook execution: {}", playbook_id);
                            let tx = bg_event_tx.clone();
                            let pid = playbook_id.clone();
                            let db_clone = db_for_commands.clone();
                            let sync_client_clone = sync_client.clone();
                            tokio::spawn(async move {
                                // Load playbook from local SQLite
                                let playbook_opt = if let Some(ref db_arc) = db_clone {
                                    let repo = agent_storage::repositories::grc::PlaybookRepository::new(db_arc);
                                    match repo.get_all().await {
                                        Ok(all) => {
                                            all.into_iter().find(|s| s.id == pid).map(|stored| {
                                                let actions: Vec<agent_gui::dto::PlaybookAction> =
                                                    serde_json::from_str(&stored.steps).unwrap_or_default();
                                                agent_gui::dto::Playbook {
                                                    id: uuid::Uuid::parse_str(&stored.id)
                                                        .unwrap_or_else(|_| uuid::Uuid::new_v4()),
                                                    name: stored.title.clone(),
                                                    description: stored.description.clone(),
                                                    enabled: stored.status == "active",
                                                    conditions: vec![],
                                                    actions,
                                                    created_at: chrono::DateTime::parse_from_rfc3339(&stored.created_at)
                                                        .map(|dt| dt.with_timezone(&chrono::Utc))
                                                        .unwrap_or_else(|_| chrono::Utc::now()),
                                                    last_triggered: None,
                                                    trigger_count: 0,
                                                    is_template: false,
                                                }
                                            })
                                        }
                                        Err(e) => {
                                            warn!("Failed to load playbooks from database: {}", e);
                                            None
                                        }
                                    }
                                } else {
                                    None
                                };

                                if let Some(playbook) = playbook_opt {
                                    // Execute playbook actions directly (manual trigger bypasses condition evaluation)
                                    let mut resolved_actions = Vec::new();
                                    for action in &playbook.actions {
                                        match action.action_type {
                                            agent_gui::dto::PlaybookActionType::KillProcess => {
                                                // parameters format: "process_name:pid"
                                                let parts: Vec<&str> = action.parameters.splitn(2, ':').collect();
                                                if parts.len() == 2
                                                    && let Ok(pid_val) = parts[1].parse::<u32>()
                                                {
                                                    resolved_actions.push(
                                                        agent_core::playbook_engine::ResolvedAction::KillProcess {
                                                            name: parts[0].to_string(),
                                                            pid: pid_val,
                                                        },
                                                    );
                                                }
                                            }
                                            agent_gui::dto::PlaybookActionType::QuarantineFile => {
                                                resolved_actions.push(
                                                    agent_core::playbook_engine::ResolvedAction::QuarantineFile {
                                                        path: action.parameters.clone(),
                                                    },
                                                );
                                            }
                                            agent_gui::dto::PlaybookActionType::BlockIp => {
                                                // parameters format: "ip:duration_secs"
                                                let parts: Vec<&str> = action.parameters.splitn(2, ':').collect();
                                                let ip = parts.first().unwrap_or(&"").to_string();
                                                let duration = parts.get(1).and_then(|s| s.parse::<u64>().ok()).unwrap_or(3600);
                                                resolved_actions.push(
                                                    agent_core::playbook_engine::ResolvedAction::BlockIp {
                                                        ip,
                                                        duration_secs: duration,
                                                    },
                                                );
                                            }
                                            agent_gui::dto::PlaybookActionType::SendSiemAlert => {
                                                resolved_actions.push(
                                                    agent_core::playbook_engine::ResolvedAction::Alert {
                                                        title: format!("Playbook '{}' SIEM alert", playbook.name),
                                                        severity: "medium".to_string(),
                                                        description: action.parameters.clone(),
                                                    },
                                                );
                                            }
                                            agent_gui::dto::PlaybookActionType::CreateNotification => {
                                                resolved_actions.push(
                                                    agent_core::playbook_engine::ResolvedAction::Notify {
                                                        message: action.parameters.clone(),
                                                    },
                                                );
                                            }
                                        }
                                    }

                                    let results = {
                                        let audit_trail = db_clone.as_ref().map(|db| {
                                            std::sync::Arc::new(agent_core::audit_trail::LocalAuditTrail::new(db.clone()))
                                        });
                                        agent_core::playbook_engine::execute_playbook_actions(
                                            &playbook.name,
                                            &resolved_actions,
                                            audit_trail.as_ref()
                                        ).await
                                    };
                                    let actions_executed: Vec<String> = results.iter().map(|r| r.action.clone()).collect();
                                    let all_success = results.iter().all(|r| r.success);
                                    let first_error = results.iter().find(|r| !r.success).and_then(|r| r.error.clone());

                                    // Build playbook log entry
                                    let log_entry = agent_gui::dto::PlaybookLogEntry {
                                        id: uuid::Uuid::new_v4(),
                                        playbook_id: playbook.id,
                                        playbook_name: playbook.name.clone(),
                                        triggered_at: chrono::Utc::now(),
                                        trigger_event: "Manual execution".to_string(),
                                        actions_executed,
                                        success: all_success,
                                        error: first_error,
                                    };

                                    // Sync playbook log to platform
                                    if let Some(ref client) = sync_client_clone {
                                        let payload = agent_sync::PlaybookLogPayload {
                                            id: log_entry.id.to_string(),
                                            playbook_id: log_entry.playbook_id.to_string(),
                                            playbook_name: log_entry.playbook_name.clone(),
                                            triggered_at: log_entry.triggered_at,
                                            trigger_event: log_entry.trigger_event.clone(),
                                            actions_executed: log_entry.actions_executed.clone(),
                                            success: log_entry.success,
                                            error: log_entry.error.clone(),
                                        };
                                        if let Err(e) = client.sync_playbook_logs(vec![payload]).await {
                                            tracing::warn!("Failed to sync manual playbook log: {}", e);
                                        }
                                    }

                                    // Emit PlaybookTriggered event to GUI
                                    let _ = tx.send(AgentEvent::PlaybookTriggered {
                                        log_entry: Box::new(log_entry),
                                    });
                                } else {
                                    warn!("Cannot execute playbook '{}': not found in database", pid);
                                }
                            });
                        }
                        Ok(GuiCommand::TogglePlaybook { playbook_id, enabled }) => {
                            info!("[AUDIT] GUI toggled playbook {}: enabled={}", playbook_id, enabled);
                            if let Some(ref c) = sync_client {
                                let c = std::sync::Arc::clone(c);
                                let pid = playbook_id.clone();
                                tokio::spawn(async move {
                                    if let Err(e) = c.toggle_playbook(&pid, enabled).await {
                                        warn!("Failed to sync playbook toggle: {}", e);
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::SavePlaybook { playbook }) => {
                            info!("[AUDIT] GUI saved playbook: {}", playbook.name);
                            let payload = agent_core::sync_converters::playbook_to_payload(&playbook);
                            // Persist to dedicated SQLite table for offline resilience
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let pb_clone = playbook.clone();
                                let payload_clone = payload.clone();
                                tokio::spawn(async move {
                                    let now = chrono::Utc::now().to_rfc3339();
                                    let stored = agent_storage::repositories::grc::StoredPlaybook {
                                        id: pb_clone.id.to_string(),
                                        title: pb_clone.name.clone(),
                                        description: pb_clone.description.clone(),
                                        category: "general".to_string(),
                                        steps: serde_json::to_string(&pb_clone.actions).unwrap_or_default(),
                                        status: if pb_clone.enabled { "active".to_string() } else { "inactive".to_string() },
                                        created_at: pb_clone.created_at.to_rfc3339(),
                                        updated_at: now,
                                        synced: false,
                                    };
                                    let repo = agent_storage::repositories::grc::PlaybookRepository::new(&db_clone);
                                    if let Err(e) = repo.upsert(&stored).await {
                                        warn!("Failed to persist playbook to SQLite: {}", e);
                                    }
                                    if let Ok(json) = serde_json::to_string(&payload_clone) {
                                        let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                                        let entry = agent_storage::SyncQueueEntry::new(
                                            agent_storage::SyncEntityType::Playbook,
                                            pb_clone.id.to_string(),
                                            json,
                                        );
                                        let _ = repo2.enqueue(&entry).await;
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::DeletePlaybook { playbook_id }) => {
                            info!("[AUDIT] GUI deleted playbook: {}", playbook_id);
                            // Delete from local SQLite (offline-first)
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let pid = playbook_id.clone();
                                tokio::spawn(async move {
                                    let repo = agent_storage::repositories::grc::PlaybookRepository::new(&db_clone);
                                    if let Err(e) = repo.delete(&pid).await {
                                        warn!("Failed to delete playbook from SQLite: {}", e);
                                    }
                                });
                            }
                            // Also delete from SaaS when online
                            if let Some(ref c) = sync_client {
                                let c = std::sync::Arc::clone(c);
                                let pid = playbook_id.clone();
                                tokio::spawn(async move {
                                    if let Err(e) = c.delete_playbook(&pid).await {
                                        warn!("Failed to sync playbook delete to SaaS: {}", e);
                                    }
                                });
                            }
                        }

                        Ok(GuiCommand::SaveDetectionRule { rule }) => {
                            info!("[AUDIT] GUI saved detection rule: {}", rule.name);
                            let payload = agent_core::sync_converters::detection_rule_to_payload(&rule);
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let rule_clone = rule.clone();
                                let payload_clone = payload.clone();
                                tokio::spawn(async move {
                                    let stored = agent_storage::repositories::grc::StoredDetectionRule {
                                        id: rule_clone.id.to_string(),
                                        name: rule_clone.name.clone(),
                                        description: rule_clone.description.clone(),
                                        severity: rule_clone.severity.as_str().to_string(),
                                        conditions: serde_json::to_string(&rule_clone.conditions).unwrap_or_default(),
                                        actions: serde_json::to_string(&rule_clone.actions).unwrap_or_default(),
                                        enabled: rule_clone.enabled,
                                        created_at: rule_clone.created_at.to_rfc3339(),
                                        last_match: rule_clone.last_match.map(|d| d.to_rfc3339()),
                                        match_count: rule_clone.match_count as i32,
                                        synced: false,
                                    };
                                    let repo = agent_storage::repositories::grc::DetectionRuleRepository::new(&db_clone);
                                    if let Err(e) = repo.upsert(&stored).await {
                                        warn!("Failed to persist detection rule to SQLite: {}", e);
                                    }
                                    if let Ok(json) = serde_json::to_string(&payload_clone) {
                                        let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                                        let entry = agent_storage::SyncQueueEntry::new(
                                            agent_storage::SyncEntityType::DetectionRule,
                                            rule_clone.id.to_string(),
                                            json,
                                        );
                                        let _ = repo2.enqueue(&entry).await;
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::DeleteDetectionRule { rule_id }) => {
                            info!("[AUDIT] GUI deleted detection rule: {}", rule_id);
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let rid = rule_id.clone();
                                tokio::spawn(async move {
                                    let repo = agent_storage::repositories::grc::DetectionRuleRepository::new(&db_clone);
                                    if let Err(e) = repo.delete(&rid).await {
                                        warn!("Failed to delete detection rule from SQLite: {}", e);
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::ToggleDetectionRule { rule_id, enabled }) => {
                            info!("[AUDIT] GUI toggled detection rule {}: enabled={}", rule_id, enabled);
                        }

                        Ok(GuiCommand::SaveRisk { risk }) => {
                            info!("[AUDIT] GUI saved risk entry: {}", risk.title);
                            let payload = agent_core::sync_converters::risk_to_payload(&risk);
                            // Persist to dedicated SQLite table for offline resilience
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let risk_clone = risk.clone();
                                let payload_clone = payload.clone();
                                tokio::spawn(async move {
                                    let stored = agent_storage::repositories::grc::StoredRisk {
                                        id: risk_clone.id.to_string(),
                                        title: risk_clone.title.clone(),
                                        description: risk_clone.description.clone(),
                                        probability: risk_clone.probability as i32,
                                        impact: risk_clone.impact as i32,
                                        owner: risk_clone.owner.clone(),
                                        status: format!("{:?}", risk_clone.status),
                                        mitigation: risk_clone.mitigation.clone(),
                                        source: risk_clone.source.clone(),
                                        created_at: risk_clone.created_at.to_rfc3339(),
                                        updated_at: risk_clone.updated_at.to_rfc3339(),
                                        sla_target_days: risk_clone.sla_target_days.map(|v| v as i32),
                                        synced: false,
                                    };
                                    let repo = agent_storage::repositories::grc::RiskRepository::new(&db_clone);
                                    if let Err(e) = repo.upsert(&stored).await {
                                        warn!("Failed to persist risk to SQLite: {}", e);
                                    }
                                    // Also queue for remote sync
                                    if let Ok(json) = serde_json::to_string(&payload_clone) {
                                        let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                                        let entry = agent_storage::SyncQueueEntry::new(
                                            agent_storage::SyncEntityType::Risk,
                                            risk_clone.id.to_string(),
                                            json,
                                        );
                                        let _ = repo2.enqueue(&entry).await;
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::DeleteRisk { risk_id }) => {
                            info!("[AUDIT] GUI deleted risk entry: {}", risk_id);
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let rid = risk_id.clone();
                                tokio::spawn(async move {
                                    let repo = agent_storage::repositories::grc::RiskRepository::new(&db_clone);
                                    if let Err(e) = repo.delete(&rid).await {
                                        warn!("Failed to delete risk from SQLite: {}", e);
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::SaveAsset { asset }) => {
                            info!("[AUDIT] GUI saved asset: {} ({})", asset.hostname.as_deref().unwrap_or("?"), asset.ip);
                            let payload = agent_core::sync_converters::asset_to_payload(&asset);
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let asset_clone = asset.clone();
                                let payload_clone = payload.clone();
                                tokio::spawn(async move {
                                    let stored = agent_storage::repositories::grc::StoredManagedAsset {
                                        id: asset_clone.id.to_string(),
                                        name: asset_clone.hostname.clone().unwrap_or_else(|| asset_clone.ip.clone()),
                                        asset_type: asset_clone.device_type.clone(),
                                        criticality: format!("{:?}", asset_clone.criticality),
                                        owner: "unknown".to_string(),
                                        location: asset_clone.ip.clone(),
                                        status: format!("{:?}", asset_clone.lifecycle),
                                        created_at: asset_clone.first_seen.to_rfc3339(),
                                        updated_at: asset_clone.last_seen.to_rfc3339(),
                                        synced: false,
                                    };
                                    let repo = agent_storage::repositories::grc::ManagedAssetRepository::new(&db_clone);
                                    if let Err(e) = repo.upsert(&stored).await {
                                        warn!("Failed to persist asset to SQLite: {}", e);
                                    }
                                    if let Ok(json) = serde_json::to_string(&payload_clone) {
                                        let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                                        let entry = agent_storage::SyncQueueEntry::new(
                                            agent_storage::SyncEntityType::Asset,
                                            asset_clone.id.to_string(),
                                            json,
                                        );
                                        let _ = repo2.enqueue(&entry).await;
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::UpdateAssetLifecycle { asset_id, lifecycle }) => {
                            info!("[AUDIT] GUI updated asset lifecycle {}: {:?}", asset_id, lifecycle);
                        }
                        Ok(GuiCommand::SaveAlertRule { rule }) => {
                            info!("[AUDIT] GUI saved alert rule: {}", rule.name);
                            let payload = agent_core::sync_converters::alert_rule_to_payload(&rule);
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let rule_clone = rule.clone();
                                let payload_clone = payload.clone();
                                tokio::spawn(async move {
                                    let now = chrono::Utc::now().to_rfc3339();
                                    let stored = agent_storage::repositories::grc::StoredAlertRule {
                                        id: rule_clone.id.to_string(),
                                        name: rule_clone.name.clone(),
                                        description: rule_clone.rule_type.as_str().to_string(),
                                        severity: rule_clone.severity_threshold.map(|s| s.as_str().to_string()).unwrap_or_else(|| "medium".to_string()),
                                        condition: serde_json::to_string(&rule_clone.detection_types).unwrap_or_default(),
                                        actions: "[]".to_string(),
                                        enabled: rule_clone.enabled,
                                        created_at: rule_clone.created_at.to_rfc3339(),
                                        updated_at: now,
                                        synced: false,
                                    };
                                    let repo = agent_storage::repositories::grc::AlertRuleRepository::new(&db_clone);
                                    if let Err(e) = repo.upsert(&stored).await {
                                        warn!("Failed to persist alert rule to SQLite: {}", e);
                                    }
                                    if let Ok(json) = serde_json::to_string(&payload_clone) {
                                        let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                                        let entry = agent_storage::SyncQueueEntry::new(
                                            agent_storage::SyncEntityType::AlertRule,
                                            rule_clone.id.to_string(),
                                            json,
                                        );
                                        let _ = repo2.enqueue(&entry).await;
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::DeleteAlertRule { rule_id }) => {
                            info!("[AUDIT] GUI deleted alert rule: {}", rule_id);
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let rid = rule_id.clone();
                                tokio::spawn(async move {
                                    let repo = agent_storage::repositories::grc::AlertRuleRepository::new(&db_clone);
                                    if let Err(e) = repo.delete(&rid).await {
                                        warn!("Failed to delete alert rule from SQLite: {}", e);
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::SaveWebhook { webhook }) => {
                            info!("[AUDIT] GUI saved webhook: {}", webhook.name);
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let wh_clone = webhook.clone();
                                tokio::spawn(async move {
                                    let now = chrono::Utc::now().to_rfc3339();
                                    let stored = agent_storage::repositories::grc::StoredWebhook {
                                        id: wh_clone.id.to_string(),
                                        name: wh_clone.name.clone(),
                                        url: wh_clone.url.clone(),
                                        events: wh_clone.format.clone(),
                                        secret: None,
                                        enabled: wh_clone.enabled,
                                        created_at: now.clone(),
                                        updated_at: now,
                                        synced: false,
                                    };
                                    let repo = agent_storage::repositories::grc::WebhookRepository::new(&db_clone);
                                    if let Err(e) = repo.upsert(&stored).await {
                                        warn!("Failed to persist webhook to SQLite: {}", e);
                                    }
                                    let payload = agent_core::sync_converters::webhook_to_payload(&wh_clone);
                                    if let Ok(json) = serde_json::to_string(&payload) {
                                        let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                                        let entry = agent_storage::SyncQueueEntry::new(
                                            agent_storage::SyncEntityType::Webhook,
                                            wh_clone.id.to_string(),
                                            json,
                                        );
                                        let _ = repo2.enqueue(&entry).await;
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::DeleteWebhook { webhook_id }) => {
                            info!("[AUDIT] GUI deleted webhook: {}", webhook_id);
                            if let Some(ref db_arc) = db_for_commands {
                                let db_clone = std::sync::Arc::clone(db_arc);
                                let wid = webhook_id.clone();
                                tokio::spawn(async move {
                                    let repo = agent_storage::repositories::grc::WebhookRepository::new(&db_clone);
                                    if let Err(e) = repo.delete(&wid).await {
                                        warn!("Failed to delete webhook from SQLite: {}", e);
                                    }
                                });
                            }
                        }
                        Ok(GuiCommand::TestWebhook { webhook_id }) => {
                            info!("[AUDIT] GUI requested webhook test: {}", webhook_id);
                        }

                        // ── LLM commands ──────────────────────────────────────
                        Ok(GuiCommand::LlmPrompt { prompt, context: _context }) => {
                            info!("[AUDIT] GUI sent LLM prompt ({} chars)", prompt.len());
                            let tx = bg_event_tx.clone();
                            let svc = llm_service.clone();
                            tokio::spawn(async move {
                                let start = std::time::Instant::now();
                                #[cfg(feature = "llm")]
                                {
                                    if let Some(ref svc) = svc {
                                        if let Some(manager) = svc.get_manager().await {
                                            let req = agent_llm::engine::InferenceRequest::new(&prompt);
                                            match manager.engine().infer(req).await {
                                                Ok(resp) => {
                                                    let _ = tx.send(AgentEvent::LlmChatResponse {
                                                        message: resp.text,
                                                        processing_time_ms: resp.duration_ms,
                                                    });
                                                }
                                                Err(e) => {
                                                    warn!("LLM inference error: {}", e);
                                                    let _ = tx.send(AgentEvent::LlmChatResponse {
                                                        message: format!("Erreur d'inférence : {}", e),
                                                        processing_time_ms: start.elapsed().as_millis() as u64,
                                                    });
                                                }
                                            }
                                            return;
                                        }
                                        // Manager not available — get the specific reason
                                        let reason = svc.unavailable_reason().await
                                            .unwrap_or_else(|| "Raison inconnue".to_string());
                                        let _ = tx.send(AgentEvent::LlmChatResponse {
                                            message: format!("Modèle IA non disponible.\n\n{}", reason),
                                            processing_time_ms: start.elapsed().as_millis() as u64,
                                        });
                                        return;
                                    }
                                }
                                // LLM not available (feature disabled or no service)
                                let _ = &svc; // suppress unused-variable warning when llm feature is off
                                let _ = tx.send(AgentEvent::LlmChatResponse {
                                    message: "Module IA non compilé (feature 'llm' désactivée). Recompilez avec --features llm.".to_string(),
                                    processing_time_ms: start.elapsed().as_millis() as u64,
                                });
                            });
                        }

                        Ok(GuiCommand::LlmGetStatus) => {
                            info!("[AUDIT] GUI requested LLM status");
                            let tx = bg_event_tx.clone();
                            #[cfg(feature = "llm")]
                            {
                                let svc = llm_service.clone();
                                tokio::spawn(async move {
                                    if let Some(ref svc) = svc {
                                        match svc.get_status().await {
                                            agent_core::llm_service::LLMServiceStatus::Ready {
                                                model_name,
                                                inference_count,
                                                memory_usage_mb,
                                            } => {
                                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                    model_name,
                                                    status: "ready".to_string(),
                                                    inference_count,
                                                    memory_mb: memory_usage_mb,
                                                });
                                            }
                                            agent_core::llm_service::LLMServiceStatus::NotConfigured => {
                                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                    model_name: "N/A".to_string(),
                                                    status: "not_configured".to_string(),
                                                    inference_count: 0,
                                                    memory_mb: 0,
                                                });
                                            }
                                            agent_core::llm_service::LLMServiceStatus::NotAvailable => {
                                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                    model_name: "N/A".to_string(),
                                                    status: "not_available".to_string(),
                                                    inference_count: 0,
                                                    memory_mb: 0,
                                                });
                                            }
                                            agent_core::llm_service::LLMServiceStatus::Error(err) => {
                                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                    model_name: "N/A".to_string(),
                                                    status: format!("error: {}", err),
                                                    inference_count: 0,
                                                    memory_mb: 0,
                                                });
                                            }
                                            agent_core::llm_service::LLMServiceStatus::Downloading {
                                                model_name,
                                                progress_percent,
                                                downloaded_mb,
                                                total_mb,
                                            } => {
                                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                    model_name,
                                                    status: format!(
                                                        "downloading: {}% ({}/{} MB)",
                                                        progress_percent, downloaded_mb, total_mb
                                                    ),
                                                    inference_count: 0,
                                                    memory_mb: 0,
                                                });
                                            }
                                        }
                                    } else {
                                        let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                            model_name: "N/A".to_string(),
                                            status: "not_available".to_string(),
                                            inference_count: 0,
                                            memory_mb: 0,
                                        });
                                    }
                                });
                            }
                            #[cfg(not(feature = "llm"))]
                            {
                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                    model_name: "N/A".to_string(),
                                    status: "not_available".to_string(),
                                    inference_count: 0,
                                    memory_mb: 0,
                                });
                            }
                        }

                        Ok(GuiCommand::LlmReloadModel) => {
                            info!("[AUDIT] GUI requested LLM model reload");
                            let tx = bg_event_tx.clone();
                            #[cfg(feature = "llm")]
                            {
                                let svc = llm_service.clone();
                                tokio::spawn(async move {
                                    if let Some(ref svc) = svc {
                                        if let Err(e) = svc.reload().await {
                                            warn!("Failed to reload LLM model: {}", e);
                                            let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                model_name: "N/A".to_string(),
                                                status: format!("reload_error: {}", e),
                                                inference_count: 0,
                                                memory_mb: 0,
                                            });
                                            return;
                                        }
                                        match svc.get_status().await {
                                            agent_core::llm_service::LLMServiceStatus::Ready {
                                                model_name,
                                                inference_count,
                                                memory_usage_mb,
                                            } => {
                                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                    model_name,
                                                    status: "ready".to_string(),
                                                    inference_count,
                                                    memory_mb: memory_usage_mb,
                                                });
                                            }
                                            other => {
                                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                    model_name: "N/A".to_string(),
                                                    status: format!("{:?}", other),
                                                    inference_count: 0,
                                                    memory_mb: 0,
                                                });
                                            }
                                        }
                                    } else {
                                        let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                            model_name: "N/A".to_string(),
                                            status: "not_available".to_string(),
                                            inference_count: 0,
                                            memory_mb: 0,
                                        });
                                    }
                                });
                            }
                            #[cfg(not(feature = "llm"))]
                            {
                                let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                    model_name: "N/A".to_string(),
                                    status: "not_available".to_string(),
                                    inference_count: 0,
                                    memory_mb: 0,
                                });
                            }
                        }

                        Ok(GuiCommand::LlmStartDownload) => {
                            info!("[AUDIT] GUI requested LLM model download");
                            let tx = bg_event_tx.clone();
                            #[cfg(feature = "llm")]
                            {
                                let svc = llm_service.clone();
                                tokio::spawn(async move {
                                    if let Some(ref svc) = svc {
                                        let config = match svc.get_config().await {
                                            Ok(c) => c,
                                            Err(e) => {
                                                let _ = tx.send(AgentEvent::LlmDownloadFailed {
                                                    model_name: "N/A".to_string(),
                                                    error: format!("Configuration invalide: {}", e),
                                                });
                                                return;
                                            }
                                        };
                                        let model_name = config.model.name.clone();
                                        let tx2 = tx.clone();
                                        let name2 = model_name.clone();
                                        let progress_fn: agent_core::llm_service::DownloadProgressFn =
                                            Box::new(move |percent, downloaded, total, speed| {
                                                let _ = tx2.send(AgentEvent::LlmDownloadProgress {
                                                    model_name: name2.clone(),
                                                    progress_percent: percent,
                                                    downloaded_bytes: downloaded,
                                                    total_bytes: total,
                                                    speed_bps: speed,
                                                });
                                            });
                                        match svc.download_model_with_progress(&config, Some(progress_fn)).await {
                                            Ok(()) => {
                                                info!("LLM model download completed");
                                                let total = config.model.path.metadata()
                                                    .map(|m| m.len()).unwrap_or(0);
                                                let _ = tx.send(AgentEvent::LlmDownloadComplete {
                                                    model_name: model_name.clone(),
                                                    total_bytes: total,
                                                });
                                                // Auto-initialize after download
                                                if let Err(e) = svc.reload().await {
                                                    warn!("Failed to initialize model after download: {}", e);
                                                    let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                        model_name,
                                                        status: format!("init_error: {}", e),
                                                        inference_count: 0,
                                                        memory_mb: 0,
                                                    });
                                                } else if let agent_core::llm_service::LLMServiceStatus::Ready {
                                                    model_name: name,
                                                    inference_count,
                                                    memory_usage_mb,
                                                } = svc.get_status().await {
                                                    let _ = tx.send(AgentEvent::LlmStatusUpdate {
                                                        model_name: name,
                                                        status: "ready".to_string(),
                                                        inference_count,
                                                        memory_mb: memory_usage_mb,
                                                    });
                                                }
                                            }
                                            Err(e) => {
                                                warn!("LLM model download failed: {}", e);
                                                let _ = tx.send(AgentEvent::LlmDownloadFailed {
                                                    model_name,
                                                    error: e.to_string(),
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                            #[cfg(not(feature = "llm"))]
                            {
                                let _ = tx.send(AgentEvent::LlmDownloadFailed {
                                    model_name: "N/A".to_string(),
                                    error: "Module IA non compilé".to_string(),
                                });
                            }
                        }

                        Ok(GuiCommand::LlmPauseDownload) => {
                            info!("[AUDIT] GUI requested download pause");
                            #[cfg(feature = "llm")]
                            {
                                let svc = llm_service.clone();
                                tokio::spawn(async move {
                                    if let Some(ref svc) = svc {
                                        svc.pause_download().await;
                                    }
                                });
                            }
                        }

                        Ok(GuiCommand::LlmResumeDownload) => {
                            info!("[AUDIT] GUI requested download resume");
                            #[cfg(feature = "llm")]
                            {
                                let svc = llm_service.clone();
                                tokio::spawn(async move {
                                    if let Some(ref svc) = svc {
                                        svc.resume_download().await;
                                    }
                                });
                            }
                        }

                        Ok(GuiCommand::LlmCancelDownload) => {
                            info!("[AUDIT] GUI requested download cancel");
                            #[cfg(feature = "llm")]
                            {
                                let svc = llm_service.clone();
                                tokio::spawn(async move {
                                    if let Some(ref svc) = svc {
                                        svc.cancel_download().await;
                                    }
                                });
                            }
                        }

                        Ok(GuiCommand::LlmAnalyzeVulnerability { finding_index }) => {
                            info!("[AUDIT] GUI requested LLM vulnerability analysis for finding #{}", finding_index);
                            let tx = bg_event_tx.clone();
                            let svc = llm_service.clone();
                            tokio::spawn(async move {
                                let target = format!("finding#{}", finding_index);
                                let start = std::time::Instant::now();
                                #[cfg(feature = "llm")]
                                {
                                    if let Some(ref svc) = svc
                                        && let Some(manager) = svc.get_manager().await
                                    {
                                        let prompt = format!(
                                            "Analyze the following vulnerability finding (index {}). \
                                             Assess its severity, exploitability, and provide a brief \
                                             remediation recommendation.",
                                            finding_index
                                        );
                                        let req = agent_llm::engine::InferenceRequest::new(&prompt)
                                            .with_max_tokens(512);
                                        match manager.engine().infer(req).await {
                                            Ok(resp) => {
                                                let _ = tx.send(AgentEvent::LlmAnalysisComplete {
                                                    target: target.clone(),
                                                    analysis: resp.text,
                                                    severity_override: None,
                                                    is_false_positive: None,
                                                    confidence: None,
                                                });
                                            }
                                            Err(e) => {
                                                warn!("LLM vulnerability analysis error: {}", e);
                                                let _ = tx.send(AgentEvent::LlmAnalysisComplete {
                                                    target,
                                                    analysis: format!("Erreur d'analyse : {}", e),
                                                    severity_override: None,
                                                    is_false_positive: None,
                                                    confidence: None,
                                                });
                                            }
                                        }
                                        return;
                                    }
                                }
                                let _ = svc; // suppress unused warning when llm feature is off
                                let _ = start;
                                let _ = tx.send(AgentEvent::LlmAnalysisComplete {
                                    target,
                                    analysis: "Modèle IA non disponible pour l'analyse de vulnérabilité.".to_string(),
                                    severity_override: None,
                                    is_false_positive: None,
                                    confidence: None,
                                });
                            });
                        }

                        Ok(GuiCommand::LlmClassifyThreat { event_description, target_id }) => {
                            info!("[AUDIT] GUI requested LLM threat classification: {}", &event_description[..event_description.len().min(80)]);
                            let tx = bg_event_tx.clone();
                            let svc = llm_service.clone();
                            tokio::spawn(async move {
                                let start = std::time::Instant::now();
                                #[cfg(feature = "llm")]
                                {
                                    if let Some(ref svc) = svc
                                        && let Some(manager) = svc.get_manager().await
                                    {
                                        let event = agent_llm::security::SecurityEvent {
                                            id: uuid::Uuid::new_v4().to_string(),
                                            event_type: "user_submitted".to_string(),
                                            description: event_description.clone(),
                                            system_info: String::new(),
                                            historical_context: String::new(),
                                            timestamp: chrono::Utc::now(),
                                            source: "gui".to_string(),
                                            severity: "unknown".to_string(),
                                            raw_data: serde_json::Value::Null,
                                        };
                                        match manager.classifier().classify_event(&event).await {
                                            Ok(classification) => {
                                                let analysis = format!(
                                                    "Type: {:?}\nNiveau: {:?}\nConfiance: {}%\nVecteur d'attaque: {:?}\nImpact: {}",
                                                    classification.threat_type,
                                                    classification.threat_level,
                                                    classification.confidence,
                                                    classification.attack_vector,
                                                    classification.impact_assessment,
                                                );
                                                let _ = tx.send(AgentEvent::LlmAnalysisComplete {
                                                    target: target_id.clone(),
                                                    analysis,
                                                    severity_override: Some(format!("{:?}", classification.threat_level)),
                                                    is_false_positive: None,
                                                    confidence: Some(classification.confidence),
                                                });
                                            }
                                            Err(e) => {
                                                warn!("LLM threat classification error: {}", e);
                                                let _ = tx.send(AgentEvent::LlmAnalysisComplete {
                                                    target: target_id.clone(),
                                                    analysis: format!("Erreur de classification : {}", e),
                                                    severity_override: None,
                                                    is_false_positive: None,
                                                    confidence: None,
                                                });
                                            }
                                        }
                                        return;
                                    }
                                }
                                let _ = svc;
                                let _ = start;
                                let _ = tx.send(AgentEvent::LlmAnalysisComplete {
                                    target: target_id,
                                    analysis: "Modèle IA non disponible pour la classification des menaces.".to_string(),
                                    severity_override: None,
                                    is_false_positive: None,
                                    confidence: None,
                                });
                            });
                        }

                        Ok(GuiCommand::LlmAnalyzeRisk {
                            risk_id,
                            risk_title,
                            risk_description,
                            current_probability,
                            current_impact,
                        }) => {
                            info!(
                                "[AUDIT] GUI requested AI risk analysis for: {} (prob={}, impact={})",
                                risk_title, current_probability, current_impact
                            );
                            let _ = &risk_description; // used inside #[cfg(feature = "llm")] below
                            let tx = bg_event_tx.clone();
                            let svc = llm_service.clone();
                            let rid = risk_id.clone();
                            tokio::spawn(async move {
                                #[cfg(feature = "llm")]
                                {
                                    if let Some(ref svc) = svc
                                        && let Some(manager) = svc.get_manager().await
                                    {
                                        let prompt = format!(
                                            "Tu es un analyste de risques en cybersécurité (GRC). Analyse le risque suivant et fournis :\n\
                                             1. Une évaluation de la probabilité (1-5) et de l'impact (1-5)\n\
                                             2. Une analyse détaillée (3-5 phrases)\n\
                                             3. Des suggestions de mitigation concrètes (2-4 points)\n\n\
                                             Risque : {risk_title}\n\
                                             Description : {risk_description}\n\
                                             Probabilité actuelle : {current_probability}/5\n\
                                             Impact actuel : {current_impact}/5\n\n\
                                             Réponds en JSON avec ce schéma :\n\
                                             {{\n\
                                               \"suggested_probability\": 1-5,\n\
                                               \"suggested_impact\": 1-5,\n\
                                               \"analysis\": \"texte d'analyse\",\n\
                                               \"mitigation_suggestions\": [\"suggestion1\", \"suggestion2\"]\n\
                                             }}"
                                        );
                                        let req = agent_llm::engine::InferenceRequest::new(&prompt)
                                            .with_max_tokens(1024)
                                            .with_temperature(0.4);
                                        match manager.engine().infer(req).await {
                                            Ok(resp) => {
                                                // Try to parse structured JSON from the response
                                                let (sugg_prob, sugg_impact, analysis, mitigations) =
                                                    parse_risk_analysis_response(&resp.text);
                                                let _ = tx.send(AgentEvent::LlmRiskAnalysis {
                                                    risk_id: rid,
                                                    suggested_probability: sugg_prob,
                                                    suggested_impact: sugg_impact,
                                                    analysis,
                                                    mitigation_suggestions: mitigations,
                                                });
                                            }
                                            Err(e) => {
                                                warn!("LLM risk analysis error: {}", e);
                                                let _ = tx.send(AgentEvent::LlmRiskAnalysis {
                                                    risk_id: rid,
                                                    suggested_probability: None,
                                                    suggested_impact: None,
                                                    analysis: format!("Erreur d'analyse IA : {}", e),
                                                    mitigation_suggestions: vec![],
                                                });
                                            }
                                        }
                                        return;
                                    }
                                }
                                let _ = &svc;
                                let _ = tx.send(AgentEvent::LlmRiskAnalysis {
                                    risk_id: rid,
                                    suggested_probability: None,
                                    suggested_impact: None,
                                    analysis: "Modèle IA non disponible pour l'analyse des risques.".to_string(),
                                    mitigation_suggestions: vec![],
                                });
                            });
                        }

                        Err(mpsc::TryRecvError::Empty) => {
                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                        }
                        Err(mpsc::TryRecvError::Disconnected) => break,
                    }
                }
            });

            // On Windows, check whether the background service is already
            // running.  If it is, skip the full agent runtime to avoid
            // duplicate scans, heartbeats, and sync.  The service handles
            // all of that; the GUI just provides the user interface.
            #[cfg(windows)]
            let service_is_running = matches!(
                crate::service::get_service_state(),
                Ok(crate::service::ServiceState::Running)
            );
            #[cfg(not(windows))]
            let service_is_running = false;

            if service_is_running {
                info!("SentinelGRCAgent service is running — GUI entering companion mode (no duplicate runtime)");
                // Wait until the GUI requests shutdown.
                loop {
                    if handle.is_shutdown_requested() {
                        break;
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            } else {
                // No service running — run the full agent runtime.
                if let Err(e) = runtime.run().await {
                    error!("Agent runtime error: {}", e);
                }
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
    organization_id: String,
    client_certificate: String,
    client_key: String,
}

#[cfg(feature = "gui")]
async fn enroll_with_config(
    config: &AgentConfig,
    admin_password: Option<String>,
) -> Result<EnrollmentResult, String> {
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    use agent_sync::{CredentialsRepository, EnrollmentManager};

    let db_config = DatabaseConfig::default();
    let key_manager = KeyManager::new().map_err(|e| format!("KeyManager: {}", e))?;
    let db = Database::open(db_config, &key_manager).map_err(|e| format!("DB: {}", e))?;
    let enrollment_manager = EnrollmentManager::new(config, &db);

    let token = config
        .enrollment_token
        .as_ref()
        .ok_or_else(|| "No enrollment token".to_string())?;

    let creds = enrollment_manager
        .enroll(token, admin_password)
        .await
        .map_err(|e| e.to_string())?;

    // Store credentials to DB (enroll() doesn't do this, only ensure_enrolled() does)
    let credentials_repo = CredentialsRepository::new(&db);
    credentials_repo
        .store(&creds)
        .await
        .map_err(|e| format!("Failed to store credentials: {}", e))?;

    Ok(EnrollmentResult {
        agent_id: creds.agent_id.to_string(),
        organization_id: creds.organization_id.to_string(),
        client_certificate: creds.client_certificate,
        client_key: creds.client_private_key,
    })
}

/// Wait for the user to click "Continuer" after successful enrollment.
#[cfg(feature = "gui")]
async fn wait_for_finish(rx: &std::sync::mpsc::Receiver<agent_gui::enrollment::EnrollmentCommand>) {
    loop {
        match rx.try_recv() {
            Ok(agent_gui::enrollment::EnrollmentCommand::Finish)
            | Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
            Ok(_) => {}
            Err(std::sync::mpsc::TryRecvError::Empty) => {
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
        }
    }
}

/// Parse a JSON (or free-text) response from the LLM risk analysis prompt.
///
/// Returns `(suggested_probability, suggested_impact, analysis, mitigation_suggestions)`.
#[cfg(all(feature = "gui", feature = "llm"))]
fn parse_risk_analysis_response(text: &str) -> (Option<u8>, Option<u8>, String, Vec<String>) {
    #[derive(Default, serde::Deserialize)]
    #[serde(default)]
    struct RawRiskAnalysis {
        suggested_probability: Option<u8>,
        suggested_impact: Option<u8>,
        analysis: String,
        mitigation_suggestions: Vec<String>,
    }

    // Strategy 1: direct JSON
    if let Ok(raw) = serde_json::from_str::<RawRiskAnalysis>(text) {
        return (
            raw.suggested_probability.map(|v| v.clamp(1, 5)),
            raw.suggested_impact.map(|v| v.clamp(1, 5)),
            if raw.analysis.is_empty() {
                text.to_string()
            } else {
                raw.analysis
            },
            raw.mitigation_suggestions,
        );
    }

    // Strategy 2: extract JSON block from surrounding text
    if let Some(start) = text.find('{')
        && let Some(end) = text.rfind('}')
        && end > start
    {
        let json_block = &text[start..=end];
        if let Ok(raw) = serde_json::from_str::<RawRiskAnalysis>(json_block) {
            return (
                raw.suggested_probability.map(|v| v.clamp(1, 5)),
                raw.suggested_impact.map(|v| v.clamp(1, 5)),
                if raw.analysis.is_empty() {
                    text.to_string()
                } else {
                    raw.analysis
                },
                raw.mitigation_suggestions,
            );
        }
    }

    // Strategy 3: fallback — use the raw text as the analysis
    (None, None, text.to_string(), vec![])
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
    use agent_common::process::silent_command;

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

    let output = silent_command("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .ok()?;

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() { None } else { Some(token) }
}

#[cfg(target_os = "windows")]
fn show_enrollment_dialog() -> Option<String> {
    use agent_common::process::silent_command;

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

    let output = silent_command("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .ok()?;

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() { None } else { Some(token) }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn show_enrollment_dialog() -> Option<String> {
    // Linux - try zenity or kdialog
    use agent_common::process::silent_command;

    // Try zenity first (GNOME/GTK)
    if let Ok(output) = silent_command("zenity")
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
    if let Ok(output) = silent_command("kdialog")
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
    use agent_common::process::silent_command;

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

    let _ = silent_command("osascript").arg("-e").arg(script).output();
}

#[cfg(target_os = "windows")]
fn show_error_dialog(title: &str, message: &str) {
    use agent_common::process::silent_command;

    // Sanitize inputs for PowerShell: escape single quotes and backticks
    fn sanitize_powershell(s: &str) -> String {
        s.replace('\'', "''").replace('`', "``").replace('$', "`$")
    }

    let script = format!(
        r#"Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('{}', '{}', 'OK', 'Error')"#,
        sanitize_powershell(message),
        sanitize_powershell(title)
    );

    let _ = silent_command("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output();
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn show_error_dialog(title: &str, message: &str) {
    use agent_common::process::silent_command;

    // Try zenity
    let _ = silent_command("zenity")
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
                            tracing::info!(
                                "Received SIGINT (Ctrl+C), initiating graceful shutdown..."
                            );
                        }
                        signal_hook::consts::SIGTERM => {
                            tracing::info!("Received SIGTERM, initiating graceful shutdown...");
                        }
                        signal_hook::consts::SIGHUP => {
                            tracing::info!("Received SIGHUP, initiating graceful shutdown...");
                        }
                        _ => {
                            tracing::info!(
                                "Received signal {}, initiating graceful shutdown...",
                                sig
                            );
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
            unsafe extern "system" fn console_handler(ctrl_type: u32) -> windows::core::BOOL {
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

/// Show a fatal error message box on Windows for GUI mode.
#[cfg(windows)]
fn show_fatal_error(message: &str) {
    use windows::Win32::UI::WindowsAndMessaging::{
        MB_ICONERROR, MB_OK, MB_SYSTEMMODAL, MessageBoxW,
    };
    use windows::core::HSTRING;

    let title = HSTRING::from("Sentinel Agent Error");
    let msg = HSTRING::from(message);

    unsafe {
        MessageBoxW(None, &msg, &title, MB_OK | MB_ICONERROR | MB_SYSTEMMODAL);
    }
}
