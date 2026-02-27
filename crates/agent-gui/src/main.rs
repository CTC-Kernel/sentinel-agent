//! Sentinel Agent GUI - Main entry point for Windows GUI application.
//!
//! This file ensures the console window is hidden on Windows systems
//! while providing the same GUI functionality as the library interface.

#[cfg(feature = "render")]
fn main() -> Result<(), eframe::Error> {
    /*
    // Hide console window on Windows - more robust approach
    #[cfg(windows)]
    unsafe {
        use winapi::um::wincon::{GetConsoleWindow, FreeConsole};
        use winapi::um::winuser::{ShowWindow, SW_HIDE};
        
        // Try to free console first (detaches from parent console)
        FreeConsole();
        
        // Then try to hide any remaining console window
        let console_window = GetConsoleWindow();
        if !console_window.is_null() {
            ShowWindow(console_window, SW_HIDE);
        }
        
        // Additional: Set console handle to null to prevent recreation
        use winapi::um::processenv::SetStdHandle;
        use winapi::um::handleapi::INVALID_HANDLE_VALUE;
        use winapi::um::winnt::HANDLE;
        use winapi::um::winbase::STD_OUTPUT_HANDLE;
        
        SetStdHandle(STD_OUTPUT_HANDLE, INVALID_HANDLE_VALUE as HANDLE);
    }
    */

    // Initialize logging for GUI
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .init();

    tracing::info!("Starting Sentinel Agent GUI");

    // Load configuration to find DB path
    use agent_common::config::AgentConfig;
    let config = AgentConfig::load(None).unwrap_or_else(|e| {
        tracing::warn!("Failed to load config, using defaults: {}", e);
        AgentConfig::default()
    });

    // Initialize database for enrollment check
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    let db_config = DatabaseConfig::default();
    let key_manager = KeyManager::new().unwrap_or_else(|e| {
        tracing::error!("Failed to initialize key manager: {}", e);
        // On Windows if DPAPI fails, we might still want to try to continue
        // but it's likely fatal for encrypted storage.
        panic!("KeyManager initialization failed: {}", e);
    });

    let db = Database::open(db_config, &key_manager).unwrap_or_else(|e| {
        tracing::error!("Failed to open database: {}", e);
        panic!("Database opening failed: {}", e);
    });

    // Create runtime for enrollment check
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

    // Check if enrolled
    use agent_sync::EnrollmentManager;
    let enrollment_manager = EnrollmentManager::new(&config, &db);
    let enrolled = rt
        .block_on(enrollment_manager.is_enrolled())
        .unwrap_or(false);

    if enrolled {
        tracing::info!("Agent detected as enrolled");
    } else {
        tracing::info!("Agent not enrolled, showing enrollment page");
    }

    // Create channels for agent communication
    let (_event_tx, event_rx) = std::sync::mpsc::channel();
    let (command_tx, _command_rx) = std::sync::mpsc::channel();
    let (enrollment_tx, _enrollment_rx) = std::sync::mpsc::channel();

    // Run the GUI
    agent_gui::run_gui(enrolled, event_rx, command_tx, enrollment_tx)
}

#[cfg(not(feature = "render"))]
fn main() {
    eprintln!("Error: agent-gui requires the 'render' feature to be enabled");
    std::process::exit(1);
}
