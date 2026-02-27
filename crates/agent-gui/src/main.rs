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
        .with_max_level(tracing::Level::DEBUG)
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
    let (event_tx, event_rx) = std::sync::mpsc::channel();
    let (command_tx, _command_rx) = std::sync::mpsc::channel();
    let (enrollment_tx, enrollment_rx) = std::sync::mpsc::channel();

    // Spawn background thread to handle enrollment if not enrolled
    if !enrolled {
        let bg_event_tx = event_tx.clone();
        let config_clone = config.clone();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create background runtime");
            rt.block_on(async move {
                use agent_sync::{EnrollmentManager, CredentialsRepository};
                use agent_gui::enrollment::EnrollmentCommand;
                use agent_gui::events::AgentEvent;
                use agent_storage::{Database, DatabaseConfig, KeyManager};

                while let Ok(cmd) = enrollment_rx.recv() {
                    match cmd {
                        EnrollmentCommand::SubmitEnrollment { token, admin_password } => {
                            tracing::info!("GUI enrollment: processing submission");
                            let mut enroll_config = config_clone.clone();
                            enroll_config.enrollment_token = Some(token.clone());
                            
                            let db_result = KeyManager::new().and_then(|km| {
                                Database::open(DatabaseConfig::default(), &km)
                            });

                            match db_result {
                                Ok(db) => {
                                    let enrollment_manager = EnrollmentManager::new(&enroll_config, &db);
                                    match enrollment_manager.enroll(&token, admin_password).await {
                                        Ok(creds) => {
                                            let repo = CredentialsRepository::new(&db);
                                            if let Err(e) = repo.store(&creds).await {
                                                tracing::error!("Failed to store credentials: {}", e);
                                            }
                                            let _ = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                                success: true,
                                                message: "Enrôlement réussi !".to_string(),
                                                agent_id: Some(creds.agent_id.to_string()),
                                            });
                                        }
                                        Err(e) => {
                                            tracing::warn!("Enrollment failed: {}", e);
                                            let _ = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                                success: false,
                                                message: format!("Échec: {}", e),
                                                agent_id: None,
                                            });
                                        }
                                    }
                                }
                                Err(e) => {
                                    tracing::error!("Failed to open database for enrollment: {}", e);
                                    let _ = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                        success: false,
                                        message: format!("Erreur base de données: {}", e),
                                        agent_id: None,
                                    });
                                }
                            }
                        }
                        EnrollmentCommand::SubmitQr(qr_data) => {
                            tracing::info!("GUI enrollment: processing QR code");
                            // Simple token-based QR for now
                            let token = qr_data.trim().to_string();
                            let mut enroll_config = config_clone.clone();
                            enroll_config.enrollment_token = Some(token.clone());

                            let db_result = KeyManager::new().and_then(|km| {
                                Database::open(DatabaseConfig::default(), &km)
                            });

                            match db_result {
                                Ok(db) => {
                                    let enrollment_manager = EnrollmentManager::new(&enroll_config, &db);
                                    match enrollment_manager.enroll(&token, None).await {
                                        Ok(creds) => {
                                            let repo = CredentialsRepository::new(&db);
                                            let _ = repo.store(&creds).await;
                                            let _ = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                                success: true,
                                                message: "Enrôlement QR réussi !".to_string(),
                                                agent_id: Some(creds.agent_id.to_string()),
                                            });
                                        }
                                        Err(e) => {
                                            let _ = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                                success: false,
                                                message: format!("Échec QR: {}", e),
                                                agent_id: None,
                                            });
                                        }
                                    }
                                }
                                Err(e) => {
                                    let _ = bg_event_tx.send(AgentEvent::EnrollmentResult {
                                        success: false,
                                        message: format!("Erreur base de données: {}", e),
                                        agent_id: None,
                                    });
                                }
                            }
                        }
                        EnrollmentCommand::Finish => {
                            tracing::info!("Enrollment finished, closing handler");
                            break;
                        }
                        EnrollmentCommand::Cancel => {
                            tracing::info!("Enrollment cancelled");
                            break;
                        }
                    }
                }
            });
        });
    }

    // Run the GUI
    agent_gui::run_gui(enrolled, event_rx, command_tx, enrollment_tx)
}

#[cfg(not(feature = "render"))]
fn main() {
    eprintln!("Error: agent-gui requires the 'render' feature to be enabled");
    std::process::exit(1);
}
