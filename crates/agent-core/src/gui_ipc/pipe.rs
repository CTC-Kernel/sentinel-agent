// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Windows transport of the service channel: a named pipe, and the
//! registry key where the service keeps what user processes must not write.
//!
//! # Who may connect
//!
//! The pipe is created with `PIPE_REJECT_REMOTE_CLIENTS`, and the first
//! instance with `FILE_FLAG_FIRST_PIPE_INSTANCE`: if another process holds
//! the name, the service does not join it, it waits for the name. Its DACL
//! is protected and names four principals only:
//!
//! * network and anonymous logons: denied everything;
//! * SYSTEM and Administrators: everything;
//! * interactive users (console and remote desktop sessions): read and
//!   write on an instance, without the right to create an instance
//!   (`0x12019b`, `FILE_GENERIC_READ | FILE_GENERIC_WRITE` less
//!   `FILE_CREATE_PIPE_INSTANCE`).
//!
//! Connecting gives an interface the harmless requests only; the rest
//! needs the administrator password (see [`super::policy`]).
//!
//! # Who the interface talks to
//!
//! The interface sends the administrator password over this pipe, so it
//! checks the other end first: the process serving the pipe must be the
//! process of the `SentinelGRCAgent` service, as the service manager
//! reports it. It also connects with `SECURITY_IDENTIFICATION`, so a
//! process that would serve the pipe cannot act as the user.

use std::ffi::c_void;
use std::os::windows::io::AsRawHandle;
use std::sync::Arc;
use std::time::Duration;

use tokio::net::windows::named_pipe::{
    ClientOptions, NamedPipeClient, NamedPipeServer, PipeMode, ServerOptions,
};
use tracing::{error, info, warn};
use windows::Win32::Foundation::{ERROR_SUCCESS, HANDLE, HLOCAL, LocalFree};
use windows::Win32::Security::Authorization::{
    ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
use windows::Win32::Security::{PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES};
use windows::Win32::System::Pipes::GetNamedPipeServerProcessId;
use windows::Win32::System::Registry::{
    HKEY, HKEY_LOCAL_MACHINE, KEY_QUERY_VALUE, KEY_SET_VALUE, REG_OPTION_NON_VOLATILE, REG_SZ,
    RRF_RT_REG_SZ, RegCloseKey, RegCreateKeyExW, RegGetValueW, RegSetValueExW,
};
use windows::core::{HSTRING, PCWSTR};

use super::admin::SecureStore;
use super::hub::{Hub, serve_connection};

/// Name of the pipe. The suffix is the protocol generation: an interface
/// and a service of different generations do not even meet.
pub const PIPE_NAME: &str = r"\\.\pipe\SentinelGRCAgent-gui-v1";

/// DACL of the pipe (see the module documentation).
const PIPE_SDDL: &str = "D:P(D;;GA;;;NU)(D;;GA;;;AN)(A;;GA;;;SY)(A;;GA;;;BA)(A;;0x12019b;;;IU)";

/// DACL of the registry key: SYSTEM and Administrators only, inherited by
/// what is created under it. Interactive users cannot even read the hash.
const STORE_SDDL: &str = "D:P(A;CI;KA;;;SY)(A;CI;KA;;;BA)";

/// Registry key of the store, under `HKEY_LOCAL_MACHINE`.
const STORE_KEY: &str = r"SOFTWARE\CyberThreatConsulting\SentinelAgent\Service";

/// Interfaces served at the same time (one per user session, with room).
const MAX_INSTANCES: usize = 16;

/// `SECURITY_IDENTIFICATION`: the server may identify the client, not act
/// as it.
const SECURITY_IDENTIFICATION: u32 = 0x0001_0000;

/// A security descriptor built from SDDL, freed with the value.
struct Descriptor(PSECURITY_DESCRIPTOR);

// The descriptor is an immutable block of memory owned by this value.
unsafe impl Send for Descriptor {}
unsafe impl Sync for Descriptor {}

impl Descriptor {
    fn from_sddl(sddl: &str) -> std::io::Result<Self> {
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        // SAFETY: `descriptor` is a valid out pointer; the string is a
        // NUL-terminated UTF-16 buffer that lives for the call.
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                &HSTRING::from(sddl),
                SDDL_REVISION_1,
                &mut descriptor,
                None,
            )
        }
        .map_err(std::io::Error::other)?;
        Ok(Self(descriptor))
    }

    fn attributes(&self) -> SECURITY_ATTRIBUTES {
        SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: self.0.0,
            bInheritHandle: false.into(),
        }
    }
}

impl Drop for Descriptor {
    fn drop(&mut self) {
        // SAFETY: allocated by ConvertStringSecurityDescriptor..., which
        // documents LocalFree as its release.
        unsafe {
            let _ = LocalFree(Some(HLOCAL(self.0.0)));
        }
    }
}

/// Create one instance of the pipe.
fn create_instance(descriptor: &Descriptor, first: bool) -> std::io::Result<NamedPipeServer> {
    let mut attributes = descriptor.attributes();
    let mut options = ServerOptions::new();
    options
        .first_pipe_instance(first)
        .reject_remote_clients(true)
        .access_inbound(true)
        .access_outbound(true)
        .pipe_mode(PipeMode::Byte)
        .max_instances(MAX_INSTANCES)
        .in_buffer_size(64 * 1024)
        .out_buffer_size(64 * 1024);
    // SAFETY: `attributes` is a valid SECURITY_ATTRIBUTES whose descriptor
    // outlives the call; the system copies it into the pipe object.
    unsafe {
        options.create_with_security_attributes_raw(
            PIPE_NAME,
            &mut attributes as *mut SECURITY_ATTRIBUTES as *mut c_void,
        )
    }
}

/// Serve interfaces on the named pipe until the service stops. Never
/// returns an error: what fails is logged and tried again, the agent runs
/// with or without an interface.
pub async fn serve(hub: Arc<Hub>) {
    let descriptor = match Descriptor::from_sddl(PIPE_SDDL) {
        Ok(descriptor) => descriptor,
        Err(e) => {
            error!(
                "Service channel disabled: the pipe's access list was refused ({})",
                e
            );
            return;
        }
    };
    // The first instance claims the name: failing means another process
    // already serves it, which is never joined.
    let mut server = loop {
        match create_instance(&descriptor, true) {
            Ok(server) => break server,
            Err(e) => {
                error!(
                    "Service channel: the pipe {} cannot be claimed ({}); retrying",
                    PIPE_NAME, e
                );
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    };
    info!("Service channel listening on {}", PIPE_NAME);
    loop {
        if let Err(e) = server.connect().await {
            warn!("Service channel: connection not accepted: {}", e);
            tokio::time::sleep(Duration::from_millis(200)).await;
            continue;
        }
        // The next instance exists before this one is served, so the name
        // is never left without an owner.
        let connected = match create_instance(&descriptor, false) {
            Ok(next) => std::mem::replace(&mut server, next),
            Err(e) => {
                warn!("Service channel: no further pipe instance ({})", e);
                // Serve nobody rather than lose the only instance.
                let _ = server.disconnect();
                tokio::time::sleep(Duration::from_secs(1)).await;
                continue;
            }
        };
        let hub = hub.clone();
        tokio::spawn(async move {
            if let Err(e) = serve_connection(hub, connected).await {
                warn!("Service channel: connection closed on an error: {}", e);
            }
        });
    }
}

/// Open the pipe from the interface, after checking that the service is
/// the process behind it.
pub async fn connect() -> std::io::Result<NamedPipeClient> {
    let client = ClientOptions::new()
        .security_qos_flags(SECURITY_IDENTIFICATION)
        .open(PIPE_NAME)?;
    let mut server_pid = 0u32;
    // SAFETY: the handle is the open pipe; `server_pid` is a valid out
    // pointer.
    unsafe { GetNamedPipeServerProcessId(HANDLE(client.as_raw_handle() as _), &mut server_pid) }
        .map_err(std::io::Error::other)?;
    match crate::service::service_process_id() {
        Some(service_pid) if service_pid == server_pid => Ok(client),
        service_pid => Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            format!(
                "pipe served by process {server_pid}, the service is {service_pid:?}: not trusted"
            ),
        )),
    }
}

/// The service's store: string values under a registry key of
/// `HKEY_LOCAL_MACHINE` that only SYSTEM and Administrators can open.
pub struct RegistryStore;

/// An open registry key, closed with the value.
struct Key(HKEY);

impl Drop for Key {
    fn drop(&mut self) {
        // SAFETY: the key was opened by this value.
        unsafe {
            let _ = RegCloseKey(self.0);
        }
    }
}

impl RegistryStore {
    /// Open the key, creating it with its restricted access list.
    fn open(&self) -> std::io::Result<Key> {
        let descriptor = Descriptor::from_sddl(STORE_SDDL)?;
        let attributes = descriptor.attributes();
        let mut key = HKEY::default();
        // SAFETY: every pointer is valid for the call; the access list only
        // applies when the key is created.
        let status = unsafe {
            RegCreateKeyExW(
                HKEY_LOCAL_MACHINE,
                &HSTRING::from(STORE_KEY),
                None,
                PCWSTR::null(),
                REG_OPTION_NON_VOLATILE,
                KEY_QUERY_VALUE | KEY_SET_VALUE,
                Some(&attributes as *const SECURITY_ATTRIBUTES),
                &mut key,
                None,
            )
        };
        if status != ERROR_SUCCESS {
            return Err(std::io::Error::from_raw_os_error(status.0 as i32));
        }
        Ok(Key(key))
    }
}

impl SecureStore for RegistryStore {
    fn read(&self, name: &str) -> Option<String> {
        let key = self.open().ok()?;
        let name = HSTRING::from(name);
        let mut bytes = 0u32;
        // SAFETY: size query; no buffer is written.
        let status = unsafe {
            RegGetValueW(
                key.0,
                PCWSTR::null(),
                &name,
                RRF_RT_REG_SZ,
                None,
                None,
                Some(&mut bytes as *mut u32),
            )
        };
        if status != ERROR_SUCCESS || bytes == 0 {
            return None;
        }
        let mut buffer = vec![0u16; (bytes as usize).div_ceil(2)];
        let mut bytes = (buffer.len() * 2) as u32;
        // SAFETY: `buffer` holds `bytes` writable bytes.
        let status = unsafe {
            RegGetValueW(
                key.0,
                PCWSTR::null(),
                &name,
                RRF_RT_REG_SZ,
                None,
                Some(buffer.as_mut_ptr() as *mut c_void),
                Some(&mut bytes as *mut u32),
            )
        };
        if status != ERROR_SUCCESS {
            return None;
        }
        let len = buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len());
        String::from_utf16(&buffer[..len]).ok()
    }

    fn write(&self, name: &str, value: &str) -> std::io::Result<()> {
        let key = self.open()?;
        let wide: Vec<u16> = value.encode_utf16().chain(std::iter::once(0)).collect();
        let bytes: Vec<u8> = wide.iter().flat_map(|unit| unit.to_le_bytes()).collect();
        // SAFETY: `bytes` is a NUL-terminated UTF-16 string, as REG_SZ asks.
        let status = unsafe {
            RegSetValueExW(
                key.0,
                &HSTRING::from(name),
                None,
                REG_SZ,
                Some(bytes.as_slice()),
            )
        };
        if status != ERROR_SUCCESS {
            return Err(std::io::Error::from_raw_os_error(status.0 as i32));
        }
        Ok(())
    }
}
