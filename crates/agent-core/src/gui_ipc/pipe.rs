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

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[test]
    fn the_access_lists_are_accepted_by_the_system() {
        Descriptor::from_sddl(PIPE_SDDL).expect("pipe access list");
        Descriptor::from_sddl(STORE_SDDL).expect("store access list");
        assert!(Descriptor::from_sddl("not an access list").is_err());
    }

    /// One test for everything that needs the pipe's name: two tests would
    /// claim it at the same time.
    #[tokio::test]
    async fn the_pipe_is_claimed_once_and_carries_both_directions() {
        let descriptor = Descriptor::from_sddl(PIPE_SDDL).unwrap();
        let server = create_instance(&descriptor, true).expect("first instance");
        // The name is taken: a second process asking to be the first
        // instance is refused, which is what keeps a squatter out. Wine
        // does not enforce FILE_FLAG_FIRST_PIPE_INSTANCE (SENTINEL_TEST_WINE
        // skips this one check there); Windows does.
        if std::env::var_os("SENTINEL_TEST_WINE").is_none() {
            assert!(create_instance(&descriptor, true).is_err());
        }

        let mut client = ClientOptions::new()
            .security_qos_flags(SECURITY_IDENTIFICATION)
            .open(PIPE_NAME)
            .expect("an interface opens the pipe");
        server.connect().await.expect("the service accepts it");
        // The next instance is created while the first is served.
        let next = create_instance(&descriptor, false).expect("next instance");

        // What `connect` checks against the service manager: the process
        // behind the pipe, here this very process.
        let mut server_pid = 0u32;
        unsafe {
            GetNamedPipeServerProcessId(HANDLE(client.as_raw_handle() as _), &mut server_pid)
        }
        .expect("the server's process is known");
        assert_eq!(server_pid, std::process::id());

        let mut server = server;
        client.write_all(b"{\"type\":\"ping\"}\n").await.unwrap();
        let mut line = [0u8; 16];
        server.read_exact(&mut line).await.unwrap();
        assert_eq!(&line, b"{\"type\":\"ping\"}\n");
        server.write_all(b"pong\n").await.unwrap();
        let mut answer = [0u8; 5];
        client.read_exact(&mut answer).await.unwrap();
        assert_eq!(&answer, b"pong\n");
        drop(next);
    }

    #[test]
    #[ignore = "writes under HKEY_LOCAL_MACHINE: run elevated"]
    fn the_store_gives_back_what_it_was_given() {
        let store = RegistryStore;
        let name = "test-value";
        store
            .write(name, "$argon2id$v=19$été")
            .expect("the key is writable");
        assert_eq!(store.read(name).as_deref(), Some("$argon2id$v=19$été"));
        store.write(name, "").unwrap();
        assert_eq!(store.read("never-written"), None);
    }

    /// The whole path, against an installed agent: the interface finds the
    /// pipe, recognises the service behind it, is greeted, and is refused a
    /// protected command while it has not given the administrator password.
    #[tokio::test]
    #[ignore = "needs the SentinelGRCAgent service running on this machine"]
    async fn the_installed_service_greets_an_interface_and_keeps_its_gate() {
        use crate::gui_ipc::frame::{ClientFrame, CommandResult, PROTOCOL_VERSION, ServerFrame};
        use agent_gui::events::GuiCommand;
        use tokio::io::AsyncBufReadExt;

        let client = connect()
            .await
            .expect("the pipe is there and the service is the process behind it");
        let (read, mut write) = tokio::io::split(client);
        let mut lines = tokio::io::BufReader::new(read).lines();
        let mut send = async |frame: ClientFrame| {
            let mut line = serde_json::to_string(&frame).unwrap();
            line.push('\n');
            write.write_all(line.as_bytes()).await.unwrap();
        };
        send(ClientFrame::Hello {
            version: PROTOCOL_VERSION,
            resume: None,
        })
        .await;
        send(ClientFrame::Command {
            id: 7,
            command: Box::new(GuiCommand::Pause),
        })
        .await;

        let mut greeted = false;
        let mut events = 0usize;
        let refused = loop {
            let line = tokio::time::timeout(Duration::from_secs(30), lines.next_line())
                .await
                .expect("the service answers in time")
                .unwrap()
                .expect("the service keeps the connection open");
            match serde_json::from_str::<ServerFrame>(&line).expect("a frame of this protocol") {
                ServerFrame::Hello { version, .. } => {
                    assert_eq!(version, PROTOCOL_VERSION);
                    greeted = true;
                }
                ServerFrame::Event { .. } => events += 1,
                ServerFrame::CommandResult { id: 7, result } => break result,
                _ => {}
            }
        };
        assert!(greeted, "hello comes before anything else");
        assert!(
            matches!(refused, CommandResult::AdminRequired { .. }),
            "a protected command is refused without the password: {refused:?}"
        );
        println!("greeted, {events} state events replayed, protected command refused");
    }
}
