//! Sentinel Agent GUI - Main entry point for Windows GUI application.
//!
//! This file ensures the console window is hidden on Windows systems
//! while providing the same GUI functionality as the library interface.

#[cfg(feature = "render")]
fn main() -> Result<(), eframe::Error> {
    // Hide console window on Windows - more robust approach
    #[cfg(windows)]
    unsafe {
        use winapi::um::wincon::{GetConsoleWindow, ShowWindow, FreeConsole};
        use winapi::um::winuser::SW_HIDE;
        
        // Try to free console first (detaches from parent console)
        FreeConsole();
        
        // Then try to hide any remaining console window
        let console_window = GetConsoleWindow();
        if !console_window.is_null() {
            ShowWindow(console_window, SW_HIDE);
        }
        
        // Additional: Set console handle to null to prevent recreation
        use winapi::um::processenv::SetStdHandle;
        use winapi::um::fileapi::{INVALID_HANDLE_VALUE, HANDLE};
        use winapi::um::winbase::STD_OUTPUT_HANDLE;
        
        SetStdHandle(STD_OUTPUT_HANDLE, INVALID_HANDLE_VALUE as HANDLE);
    }

    // Initialize logging for GUI
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .init();

    // Create channels for agent communication
    let (_event_tx, event_rx) = std::sync::mpsc::channel();
    let (command_tx, _command_rx) = std::sync::mpsc::channel();
    let (enrollment_tx, _enrollment_rx) = std::sync::mpsc::channel();

    // TODO: Initialize agent runtime in background thread
    // For now, run in enrollment mode
    let enrolled = false;

    // Run the GUI
    agent_gui::run_gui(enrolled, event_rx, command_tx, enrollment_tx)
}

#[cfg(not(feature = "render"))]
fn main() {
    eprintln!("Error: agent-gui requires the 'render' feature to be enabled");
    std::process::exit(1);
}
