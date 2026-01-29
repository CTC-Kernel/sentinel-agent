//! Sentinel GRC Agent - Main entry point.
//!
//! This binary can run in multiple modes:
//! - Foreground: `sentinel-agent` or `sentinel-agent run` (with tray icon)
//! - Headless: `sentinel-agent run --no-tray` (for servers)
//! - Service: `sentinel-agent --service` (called by SCM/systemd)
//! - Install: `sentinel-agent install` (requires admin/root)
//! - Uninstall: `sentinel-agent uninstall` (requires admin/root)

use agent_common::config::AgentConfig;
use agent_core::{AgentRuntime, init_logging, service};
#[cfg(feature = "tray")]
use agent_core::tray;
use clap::{Parser, Subcommand};
#[cfg(feature = "tray")]
use muda::MenuEvent;
use std::process::ExitCode;
#[cfg(feature = "tray")]
use std::sync::atomic::Ordering;
#[cfg(feature = "tray")]
use tao::event_loop::{ControlFlow, EventLoopBuilder};
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
    let cli = Cli::parse();

    // Handle --service flag (called by SCM/systemd)
    if cli.service {
        return run_as_service();
    }

    // Initialize logging for CLI commands
    init_logging(&cli.log_level);

    // Handle subcommands
    match cli.command {
        Some(Commands::Enroll { token }) => handle_enroll(&token),
        Some(Commands::Install) => handle_install(),
        Some(Commands::Uninstall { purge, keep_logs }) => handle_uninstall(purge, keep_logs),
        Some(Commands::Start) => handle_start(),
        Some(Commands::Stop) => handle_stop(),
        Some(Commands::Status) => handle_status(),
        Some(Commands::Run { no_tray }) => handle_run(cli.config, no_tray),
        None => handle_run(cli.config, false), // Default: run with tray
    }
}

/// Enroll the agent with a token.
fn handle_enroll(token: &str) -> ExitCode {
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    use agent_sync::EnrollmentManager;

    println!("🔐 Enrolling Sentinel Agent...");

    // Create runtime for async operations
    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            error!("Failed to create runtime: {}", e);
            println!("Error: Failed to initialize runtime");
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
            println!("Error: Failed to initialize secure storage");
            return ExitCode::FAILURE;
        }
    };

    let db = match Database::open(db_config, &key_manager) {
        Ok(db) => db,
        Err(e) => {
            error!("Failed to open database: {}", e);
            println!("Error: Failed to open database");
            return ExitCode::FAILURE;
        }
    };

    // Perform enrollment
    let enrollment_manager = EnrollmentManager::new(&config, &db);

    match rt.block_on(enrollment_manager.ensure_enrolled()) {
        Ok(credentials) => {
            println!("✅ Enrollment successful!");
            println!("   Agent ID: {}", credentials.agent_id);
            println!("   Organization: {}", credentials.organization_id);
            println!();
            println!("You can now start the agent with: sentinel-agent");
            ExitCode::SUCCESS
        }
        Err(e) => {
            error!("Enrollment failed: {}", e);
            println!("❌ Enrollment failed: {}", e);
            println!();
            println!("Please check:");
            println!("  • The token is valid and not expired");
            println!("  • You have network connectivity");
            println!("  • The token hasn't reached its usage limit");
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
            info!("Service installed successfully");
            println!("Service installed successfully.");
            println!("Use 'sentinel-agent start' to start the service.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::AlreadyInstalled) => {
            println!("Service is already installed.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::PermissionDenied(msg)) => {
            error!("Permission denied: {}", msg);
            println!("Error: Permission denied. Run as Administrator/root.");
            ExitCode::FAILURE
        }
        Err(e) => {
            error!("Failed to install service: {}", e);
            println!("Error: {}", e);
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
            println!("Service uninstalled successfully.");
        }
        Err(service::ServiceError::NotInstalled) => {
            println!("Service is not installed.");
        }
        Err(service::ServiceError::PermissionDenied(msg)) => {
            error!("Permission denied: {}", msg);
            println!("Error: Permission denied. Run as Administrator/root.");
            return ExitCode::FAILURE;
        }
        Err(e) => {
            error!("Failed to uninstall service: {}", e);
            println!("Error: {}", e);
            return ExitCode::FAILURE;
        }
    }

    // Perform data cleanup based on options
    let options = CleanupOptions { purge, keep_logs };
    let result = cleanup_data(&options);
    print_cleanup_summary(&result);

    if !result.errors.is_empty() {
        println!("\nUninstallation completed with some warnings.");
    } else if purge {
        println!("\nAgent completely removed.");
    } else {
        println!("\nAgent service removed. Configuration and data preserved.");
        println!("Use '--purge' to remove all data.");
    }

    ExitCode::SUCCESS
}

/// Start the service.
fn handle_start() -> ExitCode {
    match service::start_service() {
        Ok(()) => {
            println!("Service started.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::AlreadyRunning) => {
            println!("Service is already running.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::NotInstalled) => {
            println!("Service is not installed. Run 'sentinel-agent install' first.");
            ExitCode::FAILURE
        }
        Err(e) => {
            error!("Failed to start service: {}", e);
            println!("Error: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Stop the service.
fn handle_stop() -> ExitCode {
    match service::stop_service() {
        Ok(()) => {
            println!("Service stopped.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::NotRunning) => {
            println!("Service is not running.");
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::NotInstalled) => {
            println!("Service is not installed.");
            ExitCode::FAILURE
        }
        Err(e) => {
            error!("Failed to stop service: {}", e);
            println!("Error: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Show service status.
fn handle_status() -> ExitCode {
    match service::get_service_state() {
        Ok(state) => {
            println!("Service status: {}", state);
            ExitCode::SUCCESS
        }
        Err(service::ServiceError::NotInstalled) => {
            println!("Service is not installed.");
            ExitCode::SUCCESS
        }
        Err(e) => {
            error!("Failed to get service status: {}", e);
            println!("Error: {}", e);
            ExitCode::FAILURE
        }
    }
}

/// Run in foreground mode.
fn handle_run(config_path: Option<String>, no_tray: bool) -> ExitCode {
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
            println!("Error: Failed to initialize secure storage: {}", e);
            return ExitCode::FAILURE;
        }
    };

    let db = match Database::open(db_config, &key_manager) {
        Ok(db) => db,
        Err(e) => {
            error!("Failed to open database: {}", e);
            println!("Error: Failed to open database: {}", e);
            return ExitCode::FAILURE;
        }
    };

    // Create runtime for enrollment check
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

    // Check if enrolled
    let enrollment_manager = EnrollmentManager::new(&config, &db);
    let is_enrolled = rt
        .block_on(enrollment_manager.is_enrolled())
        .unwrap_or(false);

    if !is_enrolled {
        info!("Agent not enrolled. Requesting enrollment token.");

        // Try to get token from config or prompt user
        let token = config.enrollment_token.clone().or_else(|| {
            if no_tray {
                // Headless mode - can't show dialog
                println!("❌ Agent is not enrolled.");
                println!("Run 'sentinel-agent enroll --token <TOKEN>' first.");
                None
            } else {
                // Show enrollment dialog
                show_enrollment_dialog()
            }
        });

        match token {
            Some(token) => {
                config.enrollment_token = Some(token.clone());
                let enrollment_manager = EnrollmentManager::new(&config, &db);

                println!("🔐 Enrolling agent...");
                match rt.block_on(enrollment_manager.ensure_enrolled()) {
                    Ok(creds) => {
                        println!("✅ Enrollment successful! Agent ID: {}", creds.agent_id);
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

    // Create runtime with enrolled config
    let runtime = AgentRuntime::new(config);
    let shutdown = runtime.shutdown_signal();

    // Set up Ctrl+C handler
    ctrlc_handler(shutdown.clone());

    if no_tray {
        // Headless mode - just run the agent loop
        info!("Running in headless mode (no tray icon)");
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        match rt.block_on(runtime.run()) {
            Ok(()) => ExitCode::SUCCESS,
            Err(e) => {
                error!("Agent error: {}", e);
                ExitCode::FAILURE
            }
        }
    } else {
        // Desktop mode with tray icon
        #[cfg(feature = "tray")]
        {
            run_with_tray(runtime)
        }
        #[cfg(not(feature = "tray"))]
        {
            info!("Tray feature not enabled, running in headless mode");
            let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
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
    let (agent_tray, _command_rx) = match tray::AgentTray::new(shutdown.clone()) {
        Ok(tray) => tray,
        Err(e) => {
            warn!(
                "Failed to create tray icon: {}. Running in headless mode.",
                e
            );
            // Fall back to headless mode
            let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
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
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

    // Spawn the agent loop in a background task
    // Note: We use _ prefix because event_loop.run() never returns,
    // so we can't await this handle. The agent runs until tray shutdown.
    let _agent_handle = rt.spawn(async move { runtime.run().await });

    // Subscribe to menu events
    let menu_channel = MenuEvent::receiver();

    info!("Agent running. Use tray icon to control.");
    println!("Sentinel GRC Agent is running.");
    println!("Look for the icon in your system tray to pause, resume, or quit.");

    // Run the tao event loop (required for tray to work on macOS)
    // Note: event_loop.run() never returns - it exits the process directly
    event_loop.run(move |_event, _, control_flow| {
        // Check if shutdown was requested first
        if shutdown.load(Ordering::SeqCst) {
            info!("Shutdown requested, stopping agent...");
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

/// Set up Ctrl+C handler for graceful shutdown.
fn ctrlc_handler(shutdown: agent_core::ShutdownSignal) {
    ctrlc::handle(move || {
        info!("Received Ctrl+C, initiating shutdown...");
        shutdown.store(true, std::sync::atomic::Ordering::SeqCst);
    })
    .expect("Failed to set Ctrl+C handler");
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

    let script = format!(
        r#"display dialog "{}" with title "{}" buttons {{"OK"}} default button "OK" with icon stop"#,
        message.replace('"', r#"\""#),
        title.replace('"', r#"\""#)
    );

    let _ = Command::new("osascript").arg("-e").arg(script).output();
}

#[cfg(target_os = "windows")]
fn show_error_dialog(title: &str, message: &str) {
    use std::process::Command;

    let script = format!(
        r#"Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('{}', '{}', 'OK', 'Error')"#,
        message.replace('\'', "''"),
        title.replace('\'', "''")
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
    static mut HANDLER_CALLBACK: Option<Box<dyn Fn() + Send + 'static>> = None;

    pub fn handle<F>(handler: F) -> Result<(), &'static str>
    where
        F: Fn() + Send + 'static,
    {
        if HANDLER_SET.swap(true, Ordering::SeqCst) {
            return Err("Handler already set");
        }

        #[cfg(unix)]
        {
            use std::thread;
            thread::spawn(move || {
                let mut signals = signal_hook::iterator::Signals::new([
                    signal_hook::consts::SIGINT,
                    signal_hook::consts::SIGTERM,
                ])
                .expect("Failed to create signal iterator");

                // Wait for the first signal
                if signals.forever().next().is_some() {
                    handler();
                }
            });
        }

        #[cfg(windows)]
        {
            use std::thread;

            // Store the handler in a thread-safe way
            // SAFETY: We only set this once, protected by HANDLER_SET
            unsafe {
                HANDLER_CALLBACK = Some(Box::new(handler));
            }

            // Spawn a thread to monitor the shutdown flag
            thread::spawn(|| {
                while !SHUTDOWN_FLAG.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                // SAFETY: Handler is set before this thread starts
                unsafe {
                    if let Some(ref callback) = HANDLER_CALLBACK {
                        callback();
                    }
                }
            });

            // Set up console control handler (defined but not currently used)
            #[allow(dead_code)]
            extern "system" fn console_handler(ctrl_type: u32) -> i32 {
                // CTRL_C_EVENT = 0, CTRL_BREAK_EVENT = 1, CTRL_CLOSE_EVENT = 2
                if ctrl_type <= 2 {
                    SHUTDOWN_FLAG.store(true, Ordering::SeqCst);
                    return 1; // TRUE - we handled it
                }
                0 // FALSE - pass to next handler
            }

            // SetConsoleCtrlHandler via windows crate would be ideal,
            // but for simplicity we use the signal-hook approach on Windows too
            // if available, or fall back to a polling approach
            let _ = console_handler; // Suppress unused warning
        }

        Ok(())
    }
}
