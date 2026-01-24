//! Windows Service implementation for the Sentinel GRC Agent.
//!
//! This module provides Windows Service Control Manager (SCM) integration,
//! allowing the agent to run as a Windows service with automatic startup.

use super::{
    SERVICE_DESCRIPTION, SERVICE_DISPLAY_NAME, SERVICE_NAME, ServiceError, ServiceResult,
    ServiceState,
};
use std::ffi::OsString;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tracing::{error, info, warn};
use windows_service::{
    define_windows_service,
    service::{
        ServiceAccess, ServiceControl, ServiceControlAccept, ServiceErrorControl, ServiceExitCode,
        ServiceInfo, ServiceStartType, ServiceState as WinServiceState, ServiceStatus, ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher,
    service_manager::{ServiceManager, ServiceManagerAccess},
};

/// Global shutdown flag for the service.
static SERVICE_SHUTDOWN: AtomicBool = AtomicBool::new(false);

/// Windows service entry point.
///
/// This function is called by the Windows Service Control Manager when the
/// service is started.
define_windows_service!(ffi_service_main, service_main);

/// Service main function called by the SCM.
fn service_main(arguments: Vec<OsString>) {
    if let Err(e) = run_service(arguments) {
        error!("Service error: {}", e);
    }
}

/// Run the Windows service.
fn run_service(_arguments: Vec<OsString>) -> windows_service::Result<()> {
    // Create the service control handler
    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop => {
                info!("Received stop control");
                SERVICE_SHUTDOWN.store(true, Ordering::SeqCst);
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            ServiceControl::Shutdown => {
                info!("Received shutdown control");
                SERVICE_SHUTDOWN.store(true, Ordering::SeqCst);
                ServiceControlHandlerResult::NoError
            }
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    // Register the service control handler
    let status_handle = service_control_handler::register(SERVICE_NAME, event_handler)?;

    // Report that we're starting
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: WinServiceState::StartPending,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::from_secs(10),
        process_id: None,
    })?;

    // Initialize the agent
    info!("Initializing Sentinel GRC Agent service");

    // Report that we're running
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: WinServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    info!("Sentinel GRC Agent service started");

    // Main service loop
    while !SERVICE_SHUTDOWN.load(Ordering::SeqCst) {
        // TODO: Run actual agent work here
        std::thread::sleep(Duration::from_secs(1));
    }

    // Report that we're stopping
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: WinServiceState::StopPending,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::from_secs(10),
        process_id: None,
    })?;

    info!("Sentinel GRC Agent service stopping");

    // Report that we've stopped
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: WinServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    info!("Sentinel GRC Agent service stopped");
    Ok(())
}

/// Start the service dispatcher.
///
/// This function should be called from main() when running as a service.
/// It blocks until the service is stopped.
pub fn run_as_service() -> ServiceResult<()> {
    service_dispatcher::start(SERVICE_NAME, ffi_service_main)
        .map_err(|e| ServiceError::System(format!("Failed to start service dispatcher: {}", e)))
}

/// Install the Windows service.
///
/// Requires administrator privileges.
pub fn install_service(executable_path: &str) -> ServiceResult<()> {
    let manager_access = ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE;
    let service_manager =
        ServiceManager::local_computer(None::<&str>, manager_access).map_err(|e| {
            ServiceError::System(format!("Failed to connect to service manager: {}", e))
        })?;

    // Check if service already exists
    if service_manager
        .open_service(SERVICE_NAME, ServiceAccess::QUERY_STATUS)
        .is_ok()
    {
        return Err(ServiceError::AlreadyInstalled);
    }

    let service_info = ServiceInfo {
        name: OsString::from(SERVICE_NAME),
        display_name: OsString::from(SERVICE_DISPLAY_NAME),
        service_type: ServiceType::OWN_PROCESS,
        start_type: ServiceStartType::AutoStart,
        error_control: ServiceErrorControl::Normal,
        executable_path: std::path::PathBuf::from(executable_path),
        launch_arguments: vec![OsString::from("--service")],
        dependencies: vec![],
        account_name: None, // LocalSystem
        account_password: None,
    };

    let service = service_manager
        .create_service(
            &service_info,
            ServiceAccess::CHANGE_CONFIG | ServiceAccess::START,
        )
        .map_err(|e| ServiceError::System(format!("Failed to create service: {}", e)))?;

    // Set service description
    service
        .set_description(SERVICE_DESCRIPTION)
        .map_err(|e| ServiceError::System(format!("Failed to set description: {}", e)))?;

    // Configure recovery options (AC4)
    // First failure: Restart after 60 seconds
    // Second failure: Restart after 300 seconds (5 minutes)
    // Subsequent failures: Restart after 600 seconds (10 minutes)
    if let Err(e) = configure_service_recovery() {
        warn!(
            "Failed to configure service recovery: {}. Service will still work but won't auto-restart on failure.",
            e
        );
    }

    info!("Service '{}' installed successfully", SERVICE_NAME);
    Ok(())
}

/// Uninstall the Windows service.
///
/// Requires administrator privileges.
pub fn uninstall_service() -> ServiceResult<()> {
    let manager_access = ServiceManagerAccess::CONNECT;
    let service_manager =
        ServiceManager::local_computer(None::<&str>, manager_access).map_err(|e| {
            ServiceError::System(format!("Failed to connect to service manager: {}", e))
        })?;

    let service_access = ServiceAccess::QUERY_STATUS | ServiceAccess::STOP | ServiceAccess::DELETE;
    let service = service_manager
        .open_service(SERVICE_NAME, service_access)
        .map_err(|_| ServiceError::NotInstalled)?;

    // Stop the service if running
    let status = service
        .query_status()
        .map_err(|e| ServiceError::System(format!("Failed to query status: {}", e)))?;

    if status.current_state != WinServiceState::Stopped {
        info!("Stopping service before uninstall");
        service
            .stop()
            .map_err(|e| ServiceError::System(format!("Failed to stop service: {}", e)))?;

        // Wait for service to stop
        let mut attempts = 0;
        loop {
            std::thread::sleep(Duration::from_secs(1));
            let status = service
                .query_status()
                .map_err(|e| ServiceError::System(format!("Failed to query status: {}", e)))?;

            if status.current_state == WinServiceState::Stopped {
                break;
            }

            attempts += 1;
            if attempts > 30 {
                warn!("Service did not stop in time, proceeding with uninstall");
                break;
            }
        }
    }

    // Delete the service
    service
        .delete()
        .map_err(|e| ServiceError::System(format!("Failed to delete service: {}", e)))?;

    info!("Service '{}' uninstalled successfully", SERVICE_NAME);
    Ok(())
}

/// Get the current service state.
pub fn get_service_state() -> ServiceResult<ServiceState> {
    let manager_access = ServiceManagerAccess::CONNECT;
    let service_manager =
        ServiceManager::local_computer(None::<&str>, manager_access).map_err(|e| {
            ServiceError::System(format!("Failed to connect to service manager: {}", e))
        })?;

    let service = service_manager
        .open_service(SERVICE_NAME, ServiceAccess::QUERY_STATUS)
        .map_err(|_| ServiceError::NotInstalled)?;

    let status = service
        .query_status()
        .map_err(|e| ServiceError::System(format!("Failed to query status: {}", e)))?;

    Ok(match status.current_state {
        WinServiceState::Stopped => ServiceState::Stopped,
        WinServiceState::StartPending => ServiceState::Starting,
        WinServiceState::Running => ServiceState::Running,
        WinServiceState::StopPending => ServiceState::Stopping,
        WinServiceState::Paused
        | WinServiceState::PausePending
        | WinServiceState::ContinuePending => ServiceState::Paused,
    })
}

/// Start the service.
pub fn start_service() -> ServiceResult<()> {
    let manager_access = ServiceManagerAccess::CONNECT;
    let service_manager =
        ServiceManager::local_computer(None::<&str>, manager_access).map_err(|e| {
            ServiceError::System(format!("Failed to connect to service manager: {}", e))
        })?;

    let service = service_manager
        .open_service(
            SERVICE_NAME,
            ServiceAccess::START | ServiceAccess::QUERY_STATUS,
        )
        .map_err(|_| ServiceError::NotInstalled)?;

    let status = service
        .query_status()
        .map_err(|e| ServiceError::System(format!("Failed to query status: {}", e)))?;

    if status.current_state == WinServiceState::Running {
        return Err(ServiceError::AlreadyRunning);
    }

    service
        .start::<OsString>(&[])
        .map_err(|e| ServiceError::System(format!("Failed to start service: {}", e)))?;

    info!("Service '{}' started", SERVICE_NAME);
    Ok(())
}

/// Stop the service.
pub fn stop_service() -> ServiceResult<()> {
    let manager_access = ServiceManagerAccess::CONNECT;
    let service_manager =
        ServiceManager::local_computer(None::<&str>, manager_access).map_err(|e| {
            ServiceError::System(format!("Failed to connect to service manager: {}", e))
        })?;

    let service = service_manager
        .open_service(
            SERVICE_NAME,
            ServiceAccess::STOP | ServiceAccess::QUERY_STATUS,
        )
        .map_err(|_| ServiceError::NotInstalled)?;

    let status = service
        .query_status()
        .map_err(|e| ServiceError::System(format!("Failed to query status: {}", e)))?;

    if status.current_state == WinServiceState::Stopped {
        return Err(ServiceError::NotRunning);
    }

    service
        .stop()
        .map_err(|e| ServiceError::System(format!("Failed to stop service: {}", e)))?;

    info!("Service '{}' stopped", SERVICE_NAME);
    Ok(())
}

/// Configure service recovery options (AC4).
///
/// Sets up automatic restart on failure:
/// - First failure: Restart after 60 seconds
/// - Second failure: Restart after 300 seconds (5 minutes)
/// - Subsequent failures: Restart after 600 seconds (10 minutes)
fn configure_service_recovery() -> ServiceResult<()> {
    use std::ptr;
    use windows::Win32::System::Services::{
        ChangeServiceConfig2W, CloseServiceHandle, OpenSCManagerW, OpenServiceW, SC_ACTION,
        SC_ACTION_TYPE, SC_MANAGER_CONNECT, SERVICE_CHANGE_CONFIG, SERVICE_CONFIG_FAILURE_ACTIONS,
        SERVICE_FAILURE_ACTIONSW,
    };
    use windows::core::PCWSTR;

    unsafe {
        // Open Service Control Manager
        let scm = OpenSCManagerW(PCWSTR::null(), PCWSTR::null(), SC_MANAGER_CONNECT)
            .map_err(|e| ServiceError::System(format!("Failed to open SCM: {}", e)))?;

        // Convert service name to wide string
        let service_name_wide: Vec<u16> = SERVICE_NAME
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        // Open the service
        let service = OpenServiceW(
            scm,
            PCWSTR(service_name_wide.as_ptr()),
            SERVICE_CHANGE_CONFIG,
        )
        .map_err(|e| {
            let _ = CloseServiceHandle(scm);
            ServiceError::System(format!("Failed to open service: {}", e))
        })?;

        // Configure failure actions
        // SC_ACTION_RESTART = 1
        let actions = [
            SC_ACTION {
                Type: SC_ACTION_TYPE(1), // SC_ACTION_RESTART
                Delay: 60_000,           // 60 seconds (in milliseconds)
            },
            SC_ACTION {
                Type: SC_ACTION_TYPE(1), // SC_ACTION_RESTART
                Delay: 300_000,          // 5 minutes
            },
            SC_ACTION {
                Type: SC_ACTION_TYPE(1), // SC_ACTION_RESTART
                Delay: 600_000,          // 10 minutes
            },
        ];

        let failure_actions = SERVICE_FAILURE_ACTIONSW {
            dwResetPeriod: 86400, // Reset failure count after 1 day (in seconds)
            lpRebootMsg: PCWSTR::null(),
            lpCommand: PCWSTR::null(),
            cActions: actions.len() as u32,
            lpsaActions: actions.as_ptr() as *mut SC_ACTION,
        };

        let result = ChangeServiceConfig2W(
            service,
            SERVICE_CONFIG_FAILURE_ACTIONS,
            Some(&failure_actions as *const _ as *const _),
        );

        let _ = CloseServiceHandle(service);
        let _ = CloseServiceHandle(scm);

        result.map_err(|e| ServiceError::System(format!("Failed to configure recovery: {}", e)))?;
    }

    info!("Service recovery options configured successfully");
    Ok(())
}

/// Check if running with administrator privileges.
///
/// Uses Windows API to check if the current process has admin rights.
pub fn is_elevated() -> bool {
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Security::{
        GetTokenInformation, TOKEN_ELEVATION, TOKEN_QUERY, TokenElevation,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token_handle = HANDLE::default();
        let process = GetCurrentProcess();

        if OpenProcessToken(process, TOKEN_QUERY, &mut token_handle).is_err() {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut return_length = 0u32;

        let result = GetTokenInformation(
            token_handle,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut return_length,
        );

        // Close the token handle
        let _ = windows::Win32::Foundation::CloseHandle(token_handle);

        result.is_ok() && elevation.TokenIsElevated != 0
    }
}
