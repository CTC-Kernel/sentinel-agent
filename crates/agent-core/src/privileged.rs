// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Privilege separation between the desktop app and the root service.
//!
//! Changing the firewall or isolating the host needs root. The desktop app runs
//! as the logged-in user and must stay that way, so those few actions are
//! delegated to the agent service (launchd / systemd), which already runs as
//! root, over a local Unix socket.
//!
//! * The socket is created by the service only, owned by root and restricted
//!   to the administrators' group: a standard user cannot even connect.
//! * Belonging to that group is not enough: the service asks the system which
//!   program is connected and serves only root and the Sentinel application
//!   itself (the same executable and, on macOS, code signed like the
//!   service). A client the system cannot name is refused like any other
//!   program. Otherwise any program started by an administrator, malware
//!   included, could lift an isolation or unblock an address by writing one
//!   line to the socket.
//! * The client is named in a way a reused PID cannot fool (audit token on
//!   macOS, pidfd on Linux), once before it may send its request and again
//!   once the request is read. The request must carry a challenge the
//!   service sends after the first check, and the client must still be the
//!   same process running the same program at the second: a request written
//!   before the check, or by a process that has exited or become another
//!   program since, is refused.
//! * The protocol is a closed enum, not a command line: the service never runs
//!   anything the client sends, it calls the same audited functions
//!   (`block_ip`, `isolate_host`, ...) which validate their arguments.
//! * Per connection: the service's challenge, one JSON request, one JSON
//!   answer.

use agent_common::error::CommonError;
use serde::{Deserialize, Serialize};

/// An action the service performs on behalf of the desktop app.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Request {
    BlockIp { ip: String, duration_secs: u64 },
    UnblockIp { ip: String },
    IsolateHost { reason: String, duration_secs: u64 },
    ReleaseHost,
    DisableAccount { user: String, duration_secs: u64 },
    EnableAccount { user: String },
}

/// The service's answer.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Response {
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Result payload, when the action has one (the isolation state).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl Response {
    fn success(data: Option<serde_json::Value>) -> Self {
        Self {
            ok: true,
            error: None,
            data,
        }
    }

    fn failure(error: impl Into<String>) -> Self {
        Self {
            ok: false,
            error: Some(error.into()),
            data: None,
        }
    }
}

/// Largest request accepted; real ones are a few hundred bytes.
#[cfg_attr(not(unix), allow(dead_code))] // The helper only listens on Unix.
const MAX_REQUEST_BYTES: u64 = 8 * 1024;

/// Run `request` with this process' own privileges.
pub async fn dispatch(request: Request) -> Response {
    let outcome = match request {
        Request::BlockIp { ip, duration_secs } => crate::edr_actions::block_ip(&ip, duration_secs)
            .await
            .map(|()| None),
        Request::UnblockIp { ip } => crate::edr_actions::unblock_ip(&ip).await.map(|()| None),
        Request::IsolateHost {
            reason,
            duration_secs,
        } => crate::host_isolation::isolate_host(&reason, duration_secs)
            .await
            .map(|state| serde_json::to_value(state).ok()),
        Request::ReleaseHost => crate::host_isolation::release_host().await.map(|()| None),
        Request::DisableAccount {
            user,
            duration_secs,
        } => crate::edr_actions::account::disable_account(&user, duration_secs)
            .await
            .map(|()| None),
        Request::EnableAccount { user } => crate::edr_actions::account::enable_account(&user)
            .await
            .map(|()| None),
    };
    match outcome {
        Ok(data) => Response::success(data),
        Err(e) => Response::failure(e.to_string()),
    }
}

#[cfg(unix)]
pub use unix::{forward, serve};

#[cfg(unix)]
mod unix {
    use super::*;
    use std::future::Future;
    use std::path::{Path, PathBuf};
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt};
    use tokio::net::{UnixListener, UnixStream};
    use tracing::{info, warn};

    /// Groups whose members administer the machine, in order of preference.
    const ADMIN_GROUPS: [&str; 3] = ["admin", "sudo", "wheel"];

    /// How long the client waits for the service to accept the connection.
    const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
    /// How long an action may take (pfctl, isolation) before the client gives up.
    const REPLY_TIMEOUT: Duration = Duration::from_secs(60);

    /// How long a connected client has to send its request.
    const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
    /// Requests handled at once; further clients wait for their turn.
    const MAX_CONCURRENT_REQUESTS: usize = 8;
    /// Largest first message of the service (its challenge) a client reads.
    const MAX_CHALLENGE_BYTES: u64 = 1024;

    /// Group of the unprivileged agent service the Linux packages create. It
    /// gets a socket of its own: a socket has one group, and the service
    /// account is no administrator.
    const SERVICE_GROUP: &str = "sentinel-grc";

    /// Where the service listens.
    pub fn socket_path() -> PathBuf {
        if let Ok(path) = std::env::var("SENTINEL_PRIVILEGED_SOCKET") {
            return PathBuf::from(path);
        }
        PathBuf::from("/var/run/sentinel-agent.sock")
    }

    /// Where the service listens for the unprivileged agent service.
    pub fn service_socket_path() -> PathBuf {
        PathBuf::from("/var/run/sentinel-agent-service.sock")
    }

    fn group_id(name: &str) -> Option<libc::gid_t> {
        let name = std::ffi::CString::new(name).ok()?;
        // SAFETY: `name` is a valid NUL-terminated string; the returned
        // pointer is read immediately and not kept.
        let group = unsafe { libc::getgrnam(name.as_ptr()) };
        (!group.is_null()).then(|| unsafe { (*group).gr_gid })
    }

    fn admin_gid() -> Option<libc::gid_t> {
        ADMIN_GROUPS.iter().find_map(|name| group_id(name))
    }

    // ── Protocol ────────────────────────────────────────────────────────

    /// First message of the service on a connection, one JSON line: the
    /// value the request must carry.
    #[derive(Debug, Serialize, Deserialize)]
    struct Challenge {
        challenge: String,
    }

    /// A request as written on the socket: the action, and the challenge of
    /// the connection it answers.
    #[derive(Debug, Serialize, Deserialize)]
    struct Envelope<R> {
        challenge: String,
        #[serde(flatten)]
        request: R,
    }

    // ── Who is asking ───────────────────────────────────────────────────

    /// The program at the other end of a connection.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(super) enum Peer {
        /// Root, or the Sentinel executable this service runs.
        Trusted,
        /// The system did not say which program it is, or it is no longer
        /// the process it was when its connection was accepted.
        Unverified,
        /// Another program.
        Foreign(PathBuf),
    }

    /// The client process as the system describes it at one moment.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(super) struct Identity {
        /// Its executable.
        pub(super) exe: PathBuf,
        /// What tells it apart from another process given the same PID
        /// before or after it (and, on macOS, from itself before an exec):
        /// the audit token there, the start time on Linux.
        instance: Instance,
    }

    #[cfg(target_os = "macos")]
    type Instance = macos::AuditToken;
    #[cfg(target_os = "linux")]
    type Instance = u64;
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    type Instance = ();

    #[cfg(target_os = "linux")]
    use linux::Client;
    #[cfg(target_os = "macos")]
    use macos::Client;
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    use other::Client;

    // What stays best-effort:
    // * Linux before 6.5 has no SO_PEERPIDFD: the PID recorded at connect time
    //   is opened afterwards (pidfd_open, Linux 5.3), or only read through
    //   /proc before 5.3. A client that exited and whose PID was given to
    //   another process in between cannot be told apart from it.
    // * Linux names the process that connected, not the one that wrote: a
    //   process sharing the connection (a fork) can send the request while
    //   the one that connected runs the Sentinel executable.
    // * On Linux the executable names the program, not the code it runs: a
    //   process of the same user can load a library into the Sentinel
    //   executable (LD_PRELOAD) or trace it. The group of the socket remains
    //   the main barrier there. On macOS the hardened runtime of the signed
    //   application prevents both, and the signature check below applies.

    /// macOS: the client is named by the audit token of the socket's peer.
    /// Its PID version changes on every exec and is checked by the calls
    /// that take the token, so a token never describes another process, nor
    /// the same one after it has become another program.
    ///
    /// The kernel finds that peer as the last process that used the client's
    /// end of the connection: a process sharing it that writes the request
    /// becomes the peer, and no longer matches the one first identified.
    #[cfg(target_os = "macos")]
    mod macos {
        use super::{Identity, UnixStream};
        use core_foundation::base::TCFType;
        use core_foundation::data::CFData;
        use core_foundation::string::{CFString, CFStringRef};
        use security_framework::os::macos::code_signing::{
            Flags, GuestAttributes, SecCode, SecRequirement,
        };
        use std::ffi::c_void;
        use std::os::fd::AsRawFd;
        use std::path::PathBuf;
        use std::str::FromStr;

        /// `audit_token_t`.
        #[repr(C)]
        #[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
        pub(in super::super) struct AuditToken([u32; 8]);

        unsafe extern "C" {
            // libproc.h, macOS 11: fails once the process of the token has
            // exited or exec'd.
            fn proc_pidpath_audittoken(
                token: *mut AuditToken,
                buffer: *mut c_void,
                size: u32,
            ) -> libc::c_int;
        }

        #[link(name = "Security", kind = "framework")]
        unsafe extern "C" {
            fn SecCodeCopyDesignatedRequirement(
                code: *const c_void,
                flags: u32,
                requirement: *mut *const c_void,
            ) -> i32;
            fn SecRequirementCopyString(
                requirement: *const c_void,
                flags: u32,
                text: *mut CFStringRef,
            ) -> i32;
        }

        /// Nothing to hold between the checks: the token is asked again.
        pub(in super::super) struct Client;

        impl Client {
            pub(in super::super) fn of(
                _stream: &UnixStream,
                _pid: Option<libc::pid_t>,
            ) -> Option<Self> {
                Some(Self)
            }

            /// The process at the other end of `stream` now; `None` when the
            /// system does not say, or it has exited.
            pub(in super::super) fn identity(&self, stream: &UnixStream) -> Option<Identity> {
                let mut token = AuditToken::default();
                let mut length = size_of::<AuditToken>() as libc::socklen_t;
                // SAFETY: `token` is writable for `length` bytes.
                let rc = unsafe {
                    libc::getsockopt(
                        stream.as_raw_fd(),
                        libc::SOL_LOCAL,
                        libc::LOCAL_PEERTOKEN,
                        (&raw mut token).cast(),
                        &mut length,
                    )
                };
                if rc != 0 || length as usize != size_of::<AuditToken>() {
                    return None;
                }
                let exe = executable_of(token)?;
                Some(Identity {
                    exe,
                    instance: token,
                })
            }
        }

        /// Executable of the process named by `token`, while it is that process.
        fn executable_of(mut token: AuditToken) -> Option<PathBuf> {
            use std::os::unix::ffi::OsStrExt;

            let mut buffer = vec![0u8; libc::PROC_PIDPATHINFO_MAXSIZE as usize];
            // SAFETY: `buffer` is writable for the length passed along with it.
            let length = unsafe {
                proc_pidpath_audittoken(&mut token, buffer.as_mut_ptr().cast(), buffer.len() as u32)
            };
            (length > 0)
                .then(|| PathBuf::from(std::ffi::OsStr::from_bytes(&buffer[..length as usize])))
        }

        /// The designated requirement of this process' own signature, as
        /// text: what the code of its clients must satisfy. `None` when it is
        /// not signed.
        pub(in super::super) fn own_requirement() -> Option<String> {
            let code = SecCode::for_self(Flags::NONE).ok()?;
            let mut requirement = std::ptr::null();
            // SAFETY: `code` is a valid code object; on success the call
            // stores a new reference, released by the wrapper below.
            let status = unsafe {
                SecCodeCopyDesignatedRequirement(code.as_CFTypeRef(), 0, &mut requirement)
            };
            if status != 0 || requirement.is_null() {
                return None;
            }
            // SAFETY: a requirement object returned under the Create rule.
            let requirement = unsafe { SecRequirement::wrap_under_create_rule(requirement as _) };
            let mut text = std::ptr::null();
            // SAFETY: as above, the string is returned under the Create rule.
            let status =
                unsafe { SecRequirementCopyString(requirement.as_CFTypeRef(), 0, &mut text) };
            if status != 0 || text.is_null() {
                return None;
            }
            // SAFETY: a string returned under the Create rule.
            Some(unsafe { CFString::wrap_under_create_rule(text) }.to_string())
        }

        /// Whether the process named by `token` runs valid code that
        /// satisfies `requirement`.
        pub(in super::super) fn satisfies(token: &AuditToken, requirement: &str) -> bool {
            let Ok(requirement) = SecRequirement::from_str(requirement) else {
                return false;
            };
            let bytes: Vec<u8> = token.0.iter().flat_map(|word| word.to_ne_bytes()).collect();
            let token = CFData::from_buffer(&bytes);
            let mut attributes = GuestAttributes::new();
            attributes.set_audit_token(token.as_concrete_TypeRef());
            SecCode::copy_guest_with_attribues(None, &attributes, Flags::NONE)
                .and_then(|code| code.check_validity(Flags::NONE, &requirement))
                .is_ok()
        }
    }

    /// Linux: the client is the process that connected, held by a pidfd so
    /// that what is read about it through its PID can be checked afterwards
    /// to have been about it.
    #[cfg(target_os = "linux")]
    mod linux {
        use super::{Identity, UnixStream};
        use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};

        /// `SO_PEERPIDFD` (Linux 6.5), not in the libc crate; its value on
        /// the architectures built here.
        #[cfg(any(target_arch = "x86_64", target_arch = "aarch64"))]
        const SO_PEERPIDFD: libc::c_int = 77;

        pub(in super::super) struct Client {
            pid: libc::pid_t,
            /// `None` on kernels without pidfds (before 5.3).
            pidfd: Option<OwnedFd>,
        }

        impl Client {
            /// The process that opened `stream`, `pid` as the kernel recorded
            /// it then. `None` when it has exited.
            pub(in super::super) fn of(
                stream: &UnixStream,
                pid: Option<libc::pid_t>,
            ) -> Option<Self> {
                let pid = pid.filter(|&pid| pid > 0)?;
                let gone = |e: &std::io::Error| e.raw_os_error() == Some(libc::ESRCH);
                let pidfd = match peer_pidfd(stream) {
                    Ok(pidfd) => Some(pidfd),
                    Err(e) if gone(&e) => return None,
                    // Before Linux 6.5: the process that has the PID now.
                    Err(_) => match pidfd_open(pid) {
                        Ok(pidfd) => Some(pidfd),
                        Err(e) if gone(&e) => return None,
                        Err(_) => None,
                    },
                };
                Some(Self { pid, pidfd })
            }

            /// What the system says about the process now; `None` once it
            /// has exited.
            pub(in super::super) fn identity(&self, _stream: &UnixStream) -> Option<Identity> {
                let exe = std::fs::read_link(format!("/proc/{}/exe", self.pid)).ok()?;
                // A program replaced on disk while it runs (an update) no
                // longer has a path to compare.
                if exe.to_string_lossy().ends_with(" (deleted)") {
                    return None;
                }
                let started = start_time(self.pid)?;
                // Read through the PID: about the pidfd's process only if it
                // still holds that PID now.
                if let Some(pidfd) = &self.pidfd
                    && !holds_its_pid(pidfd)
                {
                    return None;
                }
                Some(Identity {
                    exe,
                    instance: started,
                })
            }
        }

        #[cfg(any(target_arch = "x86_64", target_arch = "aarch64"))]
        fn peer_pidfd(stream: &UnixStream) -> std::io::Result<OwnedFd> {
            let mut fd: libc::c_int = -1;
            let mut length = size_of::<libc::c_int>() as libc::socklen_t;
            // SAFETY: `fd` is writable for `length` bytes.
            let rc = unsafe {
                libc::getsockopt(
                    stream.as_raw_fd(),
                    libc::SOL_SOCKET,
                    SO_PEERPIDFD,
                    (&raw mut fd).cast(),
                    &mut length,
                )
            };
            if rc != 0 {
                return Err(std::io::Error::last_os_error());
            }
            // SAFETY: a new descriptor the kernel handed over to us.
            Ok(unsafe { OwnedFd::from_raw_fd(fd) })
        }

        #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
        fn peer_pidfd(_stream: &UnixStream) -> std::io::Result<OwnedFd> {
            Err(std::io::Error::from_raw_os_error(libc::ENOPROTOOPT))
        }

        fn pidfd_open(pid: libc::pid_t) -> std::io::Result<OwnedFd> {
            // SAFETY: plain system call; a non-negative result is a new
            // descriptor.
            let fd = unsafe { libc::syscall(libc::SYS_pidfd_open, pid, 0) };
            if fd < 0 {
                return Err(std::io::Error::last_os_error());
            }
            // SAFETY: as above.
            Ok(unsafe { OwnedFd::from_raw_fd(fd as libc::c_int) })
        }

        /// Whether the process of `pidfd` still holds its PID (it has not
        /// been reaped). Signal 0 only checks; the service may lack the right
        /// to signal it, which says it exists all the same.
        fn holds_its_pid(pidfd: &OwnedFd) -> bool {
            // SAFETY: signal 0 to a pidfd we own, without siginfo.
            let rc = unsafe {
                libc::syscall(
                    libc::SYS_pidfd_send_signal,
                    pidfd.as_raw_fd(),
                    0,
                    std::ptr::null::<libc::siginfo_t>(),
                    0,
                )
            };
            rc == 0 || std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
        }

        /// Start time of the process `pid`, in clock ticks after boot: two
        /// processes given the same PID one after the other differ by it.
        fn start_time(pid: libc::pid_t) -> Option<u64> {
            let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
            // The command name (2nd field) may hold spaces and parentheses:
            // count after its closing one. The start time is the 22nd field.
            stat.rsplit_once(')')?
                .1
                .split_whitespace()
                .nth(19)?
                .parse()
                .ok()
        }
    }

    /// Elsewhere the system does not name the client: only root is served.
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    mod other {
        use super::{Identity, UnixStream};

        pub(in super::super) struct Client;

        impl Client {
            pub(in super::super) fn of(
                _stream: &UnixStream,
                _pid: Option<libc::pid_t>,
            ) -> Option<Self> {
                None
            }

            pub(in super::super) fn identity(&self, _stream: &UnixStream) -> Option<Identity> {
                None
            }
        }
    }

    /// Decide who a client is from its user and its executable.
    ///
    /// Root needs no socket to do what the service does. Anyone else must be
    /// the same executable as this service: the desktop app and the agent
    /// service are that one binary.
    pub(super) fn classify_peer(
        uid: Option<u32>,
        peer_exe: Option<&Path>,
        own_exe: Option<&Path>,
    ) -> Peer {
        if uid == Some(0) {
            return Peer::Trusted;
        }
        let (Some(peer), Some(own)) = (peer_exe, own_exe) else {
            return Peer::Unverified;
        };
        let same = match (peer.canonicalize(), own.canonicalize()) {
            (Ok(peer), Ok(own)) => peer == own,
            _ => peer == own,
        };
        if same {
            Peer::Trusted
        } else {
            Peer::Foreign(peer.to_path_buf())
        }
    }

    /// The verdict on a request. `peer` is who the client was when its
    /// connection was accepted; one let in for that must still be the same
    /// process running the same program once its request is read.
    pub(super) fn verdict(
        uid: Option<u32>,
        peer: Peer,
        before: Option<&Identity>,
        after: Option<&Identity>,
    ) -> Peer {
        match peer {
            Peer::Trusted if uid != Some(0) && (after.is_none() || after != before) => {
                Peer::Unverified
            }
            peer => peer,
        }
    }

    /// What a client must be for its requests to run.
    pub(super) struct Policy {
        /// This service's executable: the client must run the same one.
        own_exe: Option<PathBuf>,
        /// macOS: the designated requirement of this service's signature,
        /// which the client's code must satisfy too. `None` when the service
        /// is not signed (development builds).
        #[cfg(target_os = "macos")]
        requirement: Option<String>,
    }

    impl Policy {
        /// The policy of this service, running `own_exe`.
        fn of_this_service(own_exe: Option<PathBuf>) -> Self {
            Self {
                own_exe,
                #[cfg(target_os = "macos")]
                requirement: macos::own_requirement(),
            }
        }

        /// Who the client described by `identity` is, `uid` being the user
        /// that opened the connection.
        fn classify(&self, uid: Option<u32>, identity: Option<&Identity>) -> Peer {
            let peer = classify_peer(
                uid,
                identity.map(|identity| identity.exe.as_path()),
                self.own_exe.as_deref(),
            );
            #[cfg(target_os = "macos")]
            if peer == Peer::Trusted
                && uid != Some(0)
                && let (Some(requirement), Some(identity)) = (&self.requirement, identity)
                && !macos::satisfies(&identity.instance, requirement)
            {
                return Peer::Foreign(identity.exe.clone());
            }
            peer
        }
    }

    /// Bind the socket: root-owned, usable by `group` only (root alone when
    /// the group cannot be set).
    fn bind(path: &Path, group: Option<libc::gid_t>) -> std::io::Result<UnixListener> {
        use std::os::unix::fs::PermissionsExt;

        // Never take over a socket another helper is serving.
        if std::os::unix::net::UnixStream::connect(path).is_ok() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::AddrInUse,
                "another Sentinel helper already serves this socket",
            ));
        }
        // A stale socket from a previous run would make bind fail. The parent
        // directory is root-only, so no one else could have planted it.
        let _ = std::fs::remove_file(path);
        let listener = UnixListener::bind(path)?;

        let mode = match group {
            Some(gid) => {
                let c_path = std::ffi::CString::new(path.as_os_str().as_encoded_bytes())
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidInput, e))?;
                // SAFETY: valid path string; uid u32::MAX (-1) leaves the owner alone.
                let rc = unsafe { libc::chown(c_path.as_ptr(), u32::MAX, gid) };
                if rc == 0 { 0o660 } else { 0o600 }
            }
            None => 0o600,
        };
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode))?;
        Ok(listener)
    }

    /// Serve requests until the process ends. Call from the root helper only;
    /// it returns only when the socket cannot be bound.
    pub async fn serve() -> std::io::Result<()> {
        let own_exe = std::env::current_exe().ok();
        if own_exe.is_none() {
            warn!("Own executable unknown: the privileged socket will serve root only");
        }
        let desktop = serve_at(socket_path(), admin_gid(), own_exe.clone(), dispatch);

        // The agent service of the Linux packages runs under its own account.
        match group_id(SERVICE_GROUP) {
            Some(gid) => {
                let service = async {
                    if let Err(e) =
                        serve_at(service_socket_path(), Some(gid), own_exe, dispatch).await
                    {
                        warn!(
                            "Privileged socket of the agent service not available: {}",
                            e
                        );
                    }
                    // The desktop socket alone decides when `serve` returns.
                    std::future::pending::<()>().await
                };
                tokio::select! {
                    result = desktop => result,
                    () = service => Ok(()),
                }
            }
            None => desktop.await,
        }
    }

    pub(super) async fn serve_at<F, Fut>(
        path: PathBuf,
        group: Option<libc::gid_t>,
        own_exe: Option<PathBuf>,
        handler: F,
    ) -> std::io::Result<()>
    where
        F: Fn(Request) -> Fut + Clone + Send + 'static,
        Fut: Future<Output = Response> + Send + 'static,
    {
        serve_with(path, group, Policy::of_this_service(own_exe), handler).await
    }

    pub(super) async fn serve_with<F, Fut>(
        path: PathBuf,
        group: Option<libc::gid_t>,
        policy: Policy,
        handler: F,
    ) -> std::io::Result<()>
    where
        F: Fn(Request) -> Fut + Clone + Send + 'static,
        Fut: Future<Output = Response> + Send + 'static,
    {
        let listener = bind(&path, group)?;
        info!("Privileged action socket ready at {}", path.display());
        #[cfg(target_os = "macos")]
        if policy.requirement.is_none() {
            warn!(
                "This service is not code signed: clients of {} are checked by their \
                 executable only",
                path.display()
            );
        }
        let policy = Arc::new(policy);
        let slots = Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_REQUESTS));

        loop {
            // Taken before accepting: clients beyond the limit wait in the
            // listen queue instead of each holding a task.
            let Ok(slot) = slots.clone().acquire_owned().await else {
                return Ok(());
            };
            let (stream, _) = match listener.accept().await {
                Ok(accepted) => accepted,
                Err(e) => {
                    warn!("Privileged socket accept failed: {}", e);
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    continue;
                }
            };
            let handler = handler.clone();
            let policy = policy.clone();
            tokio::spawn(async move {
                let _slot = slot;
                if let Err(e) = handle(stream, &policy, handler).await {
                    warn!("Privileged request failed: {}", e);
                }
            });
        }
    }

    async fn handle<F, Fut>(
        mut stream: UnixStream,
        policy: &Policy,
        handler: F,
    ) -> std::io::Result<()>
    where
        F: Fn(Request) -> Fut,
        Fut: Future<Output = Response>,
    {
        // Who is connected, now that its turn has come: a client that sent
        // its request and left while waiting in the queue is not named.
        let credentials = stream.peer_cred().ok();
        let caller = credentials.as_ref().map(|c| c.uid());
        let client = Client::of(&stream, credentials.as_ref().and_then(|c| c.pid()));
        let before = client.as_ref().and_then(|c| c.identity(&stream));
        let peer = policy.classify(caller, before.as_ref());

        // The request must carry this, so it cannot have been written before
        // the client was identified above.
        let challenge = format!("{:032x}", rand::random::<u128>());
        let mut greeting = serde_json::to_vec(&Challenge {
            challenge: challenge.clone(),
        })
        .unwrap_or_default();
        greeting.push(b'\n');
        // A client already gone cannot read it; what it sent is still read
        // below, to be refused and logged.
        let _ = stream.write_all(&greeting).await;

        // A client that connects and stays silent must not hold its slot.
        let mut buf = Vec::new();
        let received = tokio::time::timeout(
            REQUEST_TIMEOUT,
            (&mut stream).take(MAX_REQUEST_BYTES).read_to_end(&mut buf),
        )
        .await;

        let response = match received {
            Err(_) => Response::failure("Request not received in time"),
            Ok(Err(e)) => return Err(e),
            Ok(Ok(_)) => {
                let after = client.as_ref().and_then(|c| c.identity(&stream));
                let peer = verdict(caller, peer, before.as_ref(), after.as_ref());
                match (peer, serde_json::from_slice::<Envelope<Request>>(&buf)) {
                    (Peer::Trusted, Err(e)) => Response::failure(format!("Malformed request: {e}")),
                    (Peer::Trusted, Ok(envelope)) if envelope.challenge != challenge => {
                        warn!(
                            "Privileged request refused: uid {:?} asked {:?} without the \
                             challenge of its connection",
                            caller, envelope.request
                        );
                        Response::failure(
                            "Refused: the request does not answer the challenge of its connection",
                        )
                    }
                    (Peer::Trusted, Ok(envelope)) => {
                        info!(
                            "Privileged request from uid {:?} ({}): {:?}",
                            caller,
                            if caller == Some(0) {
                                "root"
                            } else {
                                "verified"
                            },
                            envelope.request
                        );
                        handler(envelope.request).await
                    }
                    (peer, envelope) => refuse(caller, &peer, envelope.ok().map(|e| e.request)),
                }
            }
        };
        stream
            .write_all(&serde_json::to_vec(&response).unwrap_or_default())
            .await?;
        stream.shutdown().await
    }

    /// Answer, and log, the request of a client that is not served.
    fn refuse(caller: Option<u32>, peer: &Peer, request: Option<Request>) -> Response {
        let asked =
            request.map_or_else(|| "an unreadable request".to_string(), |r| format!("{r:?}"));
        match peer {
            Peer::Foreign(program) => {
                warn!(
                    "Privileged request refused: uid {:?} asked {} from {}, which is not the \
                     Sentinel application",
                    caller,
                    asked,
                    program.display()
                );
                Response::failure(
                    "Refused: privileged actions are only accepted from the Sentinel \
                     application installed with this service",
                )
            }
            _ => {
                warn!(
                    "Privileged request refused: uid {:?} asked {}, but the program that sent \
                     it could not be verified (gone, or changed since it connected)",
                    caller, asked
                );
                Response::failure(
                    "Refused: the program that sent this request could not be verified; \
                     privileged actions are only accepted from the Sentinel application \
                     installed with this service",
                )
            }
        }
    }

    /// Ask the service to perform `request`.
    pub async fn forward(request: &Request) -> Result<Response, CommonError> {
        forward_through(&[socket_path(), service_socket_path()], request).await
    }

    /// Connect to the service at `path`; on failure, say why in a few words.
    async fn connect(path: &Path) -> Result<UnixStream, String> {
        tokio::time::timeout(CONNECT_TIMEOUT, UnixStream::connect(path))
            .await
            .map_err(|_| "timeout".to_string())?
            .map_err(|e| e.to_string())
    }

    /// Ask through the first of `sockets` that accepts the connection: the
    /// desktop app may use the first one, the agent service the second.
    pub(super) async fn forward_through(
        sockets: &[PathBuf],
        request: &Request,
    ) -> Result<Response, CommonError> {
        let mut first_failure = None;
        for socket in sockets {
            match connect(socket).await {
                Ok(stream) => return exchange(stream, request).await,
                Err(why) => {
                    first_failure.get_or_insert(why);
                }
            }
        }
        Err(CommonError::internal(format!(
            "Elevated privileges required: the Sentinel service is not reachable ({}). \
             Install and start it with `sudo sentinel-agent install` then \
             `sudo sentinel-agent start`",
            first_failure.unwrap_or_else(|| "no socket configured".to_string())
        )))
    }

    #[cfg(test)]
    pub(super) async fn forward_to(
        path: &Path,
        request: &Request,
    ) -> Result<Response, CommonError> {
        forward_through(&[path.to_path_buf()], request).await
    }

    /// Answer the service's challenge with `request` and read the answer.
    async fn exchange(mut stream: UnixStream, request: &Request) -> Result<Response, CommonError> {
        let exchange = async {
            // The service speaks first: the challenge to put in the request.
            let mut greeting = Vec::new();
            tokio::io::BufReader::new((&mut stream).take(MAX_CHALLENGE_BYTES))
                .read_until(b'\n', &mut greeting)
                .await?;
            let Ok(Challenge { challenge }) = serde_json::from_slice(&greeting) else {
                // No challenge: the service answered at once.
                return Ok(greeting);
            };
            let body = serde_json::to_vec(&Envelope { challenge, request })
                .map_err(std::io::Error::other)?;
            stream.write_all(&body).await?;
            // Half-close: tells the service the request is complete.
            stream.shutdown().await?;
            let mut reply = Vec::new();
            stream.read_to_end(&mut reply).await?;
            Ok::<_, std::io::Error>(reply)
        };
        let reply = tokio::time::timeout(REPLY_TIMEOUT, exchange)
            .await
            .map_err(|_| CommonError::internal("The Sentinel service did not answer in time"))?
            .map_err(|e| CommonError::internal(format!("Service connection lost: {e}")))?;

        serde_json::from_slice(&reply)
            .map_err(|e| CommonError::internal(format!("Unreadable service answer: {e}")))
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::sync::Mutex;

        fn temp_socket(name: &str) -> PathBuf {
            std::env::temp_dir().join(format!("sentinel-test-{}-{name}.sock", std::process::id()))
        }

        /// The test binary: server and client of these tests are this process.
        fn own_exe() -> Option<PathBuf> {
            std::env::current_exe().ok()
        }

        async fn wait_for(path: &Path) {
            for _ in 0..50 {
                if path.exists() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        }

        fn is_root() -> bool {
            // SAFETY: `geteuid` has no precondition.
            unsafe { libc::geteuid() == 0 }
        }

        /// Read the challenge the service opens every connection with.
        async fn read_challenge(stream: &mut UnixStream) -> String {
            let mut line = Vec::new();
            tokio::io::BufReader::new(&mut *stream)
                .read_until(b'\n', &mut line)
                .await
                .unwrap();
            serde_json::from_slice::<Challenge>(&line)
                .unwrap()
                .challenge
        }

        /// The answer that follows the challenge in `reply`.
        fn answer_after_challenge(reply: &[u8]) -> Response {
            let start = reply.iter().position(|&b| b == b'\n').map_or(0, |i| i + 1);
            serde_json::from_slice(&reply[start..]).unwrap()
        }

        /// A handler that records the requests it is asked to run.
        fn recording(
            asked: &Arc<Mutex<Vec<Request>>>,
        ) -> impl Fn(Request) -> std::future::Ready<Response> + Clone + Send + 'static {
            let asked = asked.clone();
            move |request| {
                asked.lock().unwrap().push(request);
                std::future::ready(Response::success(None))
            }
        }

        /// Set in the child process of the tests below: where it connects.
        const EXITING_CLIENT_SOCKET: &str = "SENTINEL_TEST_EXITING_CLIENT_SOCKET";

        /// Not a test of its own: the body of the child process the tests
        /// below run, a client that sends a request and exits without
        /// waiting for the service. Does nothing without the variable.
        #[test]
        fn exiting_client() {
            use std::io::Write;

            let Some(path) = std::env::var_os(EXITING_CLIENT_SOCKET) else {
                return;
            };
            let mut stream = std::os::unix::net::UnixStream::connect(path).unwrap();
            stream
                .write_all(br#"{"challenge":"","op":"release_host"}"#)
                .unwrap();
        }

        /// Run `exiting_client` against `socket` in a process of its own,
        /// until it has exited.
        async fn run_exiting_client(socket: &Path) {
            let status = tokio::process::Command::new(own_exe().unwrap())
                .args([
                    "--exact",
                    "privileged::unix::tests::exiting_client",
                    "--test-threads=1",
                    "--quiet",
                ])
                .env(EXITING_CLIENT_SOCKET, socket)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .await
                .unwrap();
            assert!(status.success());
        }

        #[test]
        fn root_and_the_sentinel_executable_are_trusted() {
            let own = own_exe().unwrap();
            let other = Path::new("/bin/sh");
            assert_eq!(
                classify_peer(Some(0), Some(other), Some(&own)),
                Peer::Trusted
            );
            assert_eq!(
                classify_peer(Some(501), Some(&own), Some(&own)),
                Peer::Trusted
            );
        }

        #[test]
        fn another_program_is_foreign_whoever_runs_it() {
            let own = own_exe().unwrap();
            let other = Path::new("/bin/sh");
            assert_eq!(
                classify_peer(Some(501), Some(other), Some(&own)),
                Peer::Foreign(other.to_path_buf())
            );
            // No credentials at all, but a known and different program.
            assert_eq!(
                classify_peer(None, Some(other), Some(&own)),
                Peer::Foreign(other.to_path_buf())
            );
        }

        #[test]
        fn an_unknown_program_is_reported_as_unverified() {
            let own = own_exe().unwrap();
            assert_eq!(classify_peer(Some(501), None, Some(&own)), Peer::Unverified);
            assert_eq!(classify_peer(Some(501), Some(&own), None), Peer::Unverified);
        }

        #[test]
        fn a_client_must_stay_the_same_program_until_its_request_is_read() {
            let named = |exe: &str| Identity {
                exe: PathBuf::from(exe),
                instance: Instance::default(),
            };
            let sentinel = named("/usr/bin/sentinel-agent");
            assert_eq!(
                verdict(Some(501), Peer::Trusted, Some(&sentinel), Some(&sentinel)),
                Peer::Trusted
            );
            // Exited, or no longer named by the system, once it has written.
            assert_eq!(
                verdict(Some(501), Peer::Trusted, Some(&sentinel), None),
                Peer::Unverified
            );
            // Became another program once it was let in.
            assert_eq!(
                verdict(
                    Some(501),
                    Peer::Trusted,
                    Some(&sentinel),
                    Some(&named("/tmp/other"))
                ),
                Peer::Unverified
            );
            // Root needs no identification; refusals stay refusals.
            assert_eq!(verdict(Some(0), Peer::Trusted, None, None), Peer::Trusted);
            assert_eq!(
                verdict(Some(501), Peer::Unverified, None, None),
                Peer::Unverified
            );
        }

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        #[tokio::test]
        async fn the_system_names_the_program_at_the_other_end() {
            let (ours, _theirs) = UnixStream::pair().unwrap();
            let pid = ours.peer_cred().ok().and_then(|c| c.pid());
            let client = Client::of(&ours, pid).expect("this process");
            let found = client.identity(&ours).expect("its executable");
            assert_eq!(
                found.exe.canonicalize().unwrap(),
                own_exe().unwrap().canonicalize().unwrap()
            );
            // Asked again, the same process is described the same way.
            assert_eq!(client.identity(&ours), Some(found));
        }

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        #[tokio::test]
        async fn a_process_that_has_exited_is_not_named() {
            let path = temp_socket("exited");
            let listener = UnixListener::bind(&path).unwrap();
            run_exiting_client(&path).await;

            let (stream, _) = listener.accept().await.unwrap();
            let pid = stream.peer_cred().ok().and_then(|c| c.pid());
            let identity = Client::of(&stream, pid).and_then(|c| c.identity(&stream));
            assert_eq!(identity, None);
            let _ = std::fs::remove_file(&path);
        }

        /// The point of the check: an administrator's program that is not the
        /// Sentinel application cannot lift an isolation through the socket.
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        #[tokio::test]
        async fn requests_from_another_program_are_refused_not_executed() {
            if is_root() {
                return; // root is trusted whatever it runs
            }
            let path = temp_socket("foreign");
            let server_path = path.clone();
            let executed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
            let flag = executed.clone();
            tokio::spawn(async move {
                // The service believes it is another executable than the client.
                let _ = serve_at(
                    server_path,
                    None,
                    Some(PathBuf::from("/bin/sh")),
                    move |_| {
                        let flag = flag.clone();
                        async move {
                            flag.store(true, std::sync::atomic::Ordering::SeqCst);
                            Response::success(None)
                        }
                    },
                )
                .await;
            });
            wait_for(&path).await;

            let refused = forward_to(&path, &Request::ReleaseHost).await.unwrap();
            assert!(!refused.ok);
            assert!(
                refused
                    .error
                    .as_deref()
                    .unwrap_or_default()
                    .contains("Refused"),
                "{:?}",
                refused.error
            );
            assert!(
                !executed.load(std::sync::atomic::Ordering::SeqCst),
                "the action must not have run"
            );
            let _ = std::fs::remove_file(&path);
        }

        /// A client the service cannot name is refused like a foreign one,
        /// not given the benefit of the doubt.
        #[tokio::test]
        async fn a_client_that_cannot_be_verified_is_refused_not_executed() {
            if is_root() {
                return; // root is trusted whatever it runs
            }
            let path = temp_socket("unverified");
            let server_path = path.clone();
            let asked = Arc::new(Mutex::new(Vec::new()));
            let handler = recording(&asked);
            tokio::spawn(async move {
                // Without its own executable the service can verify no one.
                let _ = serve_at(server_path, None, None, handler).await;
            });
            wait_for(&path).await;

            let refused = forward_to(&path, &Request::ReleaseHost).await.unwrap();
            assert!(!refused.ok);
            let error = refused.error.unwrap_or_default();
            assert!(error.contains("could not be verified"), "{error}");
            assert!(
                asked.lock().unwrap().is_empty(),
                "the action must not have run"
            );
            let _ = std::fs::remove_file(&path);
        }

        /// The client is identified when its turn comes, not when it
        /// connects. One that sent its request and exited while waiting in
        /// the queue cannot be identified any more and must not be served,
        /// even though it ran the very program the service trusts.
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        #[tokio::test]
        async fn a_client_gone_before_its_turn_is_refused_not_executed() {
            if is_root() {
                return; // root is trusted whatever it runs
            }
            let path = temp_socket("gone");
            let server_path = path.clone();
            let asked = Arc::new(Mutex::new(Vec::new()));
            let handler = recording(&asked);
            tokio::spawn(async move {
                let _ = serve_at(server_path, None, own_exe(), handler).await;
            });
            wait_for(&path).await;

            // Hold every slot with clients that stay silent. The service sends
            // its challenge once it has accepted a connection.
            let mut silent = Vec::new();
            for _ in 0..MAX_CONCURRENT_REQUESTS {
                let mut stream = UnixStream::connect(&path).await.unwrap();
                read_challenge(&mut stream).await;
                silent.push(stream);
            }

            // Queued behind them: a client that sends its request and exits,
            // then one that waits for its answer.
            run_exiting_client(&path).await;
            let block = Request::BlockIp {
                ip: "203.0.113.7".into(),
                duration_secs: 0,
            };
            let waiting = tokio::spawn({
                let path = path.clone();
                let block = block.clone();
                async move { forward_to(&path, &block).await }
            });

            // One slot freed: the service takes the clients in turn, the one
            // that left first.
            drop(silent.pop());
            let answer = tokio::time::timeout(Duration::from_secs(30), waiting)
                .await
                .expect("the waiting client must be served")
                .unwrap()
                .unwrap();
            assert!(answer.ok, "{:?}", answer.error);
            tokio::time::sleep(Duration::from_millis(100)).await;
            assert_eq!(
                *asked.lock().unwrap(),
                vec![block],
                "the request of the client that left must not have run"
            );
            let _ = std::fs::remove_file(&path);
        }

        #[tokio::test]
        async fn a_request_must_answer_the_challenge_of_its_connection() {
            let path = temp_socket("challenge");
            let server_path = path.clone();
            let asked = Arc::new(Mutex::new(Vec::new()));
            let handler = recording(&asked);
            tokio::spawn(async move {
                let _ = serve_at(server_path, None, own_exe(), handler).await;
            });
            wait_for(&path).await;

            // Written without waiting for the challenge, as a request queued
            // before the service could identify its sender would be.
            let mut stream = UnixStream::connect(&path).await.unwrap();
            stream
                .write_all(
                    br#"{"challenge":"00000000000000000000000000000000","op":"release_host"}"#,
                )
                .await
                .unwrap();
            stream.shutdown().await.unwrap();
            let mut reply = Vec::new();
            stream.read_to_end(&mut reply).await.unwrap();
            let response = answer_after_challenge(&reply);
            assert!(!response.ok);
            let error = response.error.unwrap_or_default();
            assert!(error.contains("challenge"), "{error}");
            assert!(
                asked.lock().unwrap().is_empty(),
                "the action must not have run"
            );
            let _ = std::fs::remove_file(&path);
        }

        /// On macOS the client's code must also be signed like the service.
        #[cfg(target_os = "macos")]
        #[tokio::test]
        async fn a_client_signed_otherwise_than_the_service_is_refused() {
            if is_root() {
                return; // root is trusted whatever it runs
            }
            let path = temp_socket("signature");
            let server_path = path.clone();
            let asked = Arc::new(Mutex::new(Vec::new()));
            let handler = recording(&asked);
            tokio::spawn(async move {
                // The client runs the right executable, but the service
                // expects code signed by Apple.
                let policy = Policy {
                    own_exe: own_exe(),
                    requirement: Some("anchor apple".into()),
                };
                let _ = serve_with(server_path, None, policy, handler).await;
            });
            wait_for(&path).await;

            let refused = forward_to(&path, &Request::ReleaseHost).await.unwrap();
            assert!(!refused.ok);
            let error = refused.error.unwrap_or_default();
            assert!(error.contains("Refused"), "{error}");
            assert!(
                asked.lock().unwrap().is_empty(),
                "the action must not have run"
            );
            let _ = std::fs::remove_file(&path);
        }

        #[cfg(target_os = "macos")]
        #[tokio::test]
        async fn a_client_signed_like_the_service_satisfies_its_requirement() {
            let requirement = macos::own_requirement();
            if cfg!(target_arch = "aarch64") {
                // Apple silicon runs signed code only (ad hoc at least).
                assert!(requirement.is_some(), "the test binary must be signed");
            }
            let Some(requirement) = requirement else {
                return; // an unsigned build: only the executable is compared
            };
            let (ours, _theirs) = UnixStream::pair().unwrap();
            let identity = Client::of(&ours, None).unwrap().identity(&ours).unwrap();
            assert!(
                macos::satisfies(&identity.instance, &requirement),
                "{requirement}"
            );
            assert!(!macos::satisfies(&identity.instance, "anchor apple"));
        }

        #[tokio::test]
        async fn a_silent_client_is_answered_and_dropped() {
            let path = temp_socket("silent");
            let server_path = path.clone();
            tokio::spawn(async move {
                let _ = serve_at(server_path, None, own_exe(), |_| async {
                    Response::success(None)
                })
                .await;
            });
            wait_for(&path).await;

            // Connects and never sends: the service must give up on its own.
            let mut stream = UnixStream::connect(&path).await.unwrap();
            let mut reply = Vec::new();
            tokio::time::timeout(
                REQUEST_TIMEOUT + Duration::from_secs(5),
                stream.read_to_end(&mut reply),
            )
            .await
            .expect("the service must not wait forever")
            .unwrap();
            let response = answer_after_challenge(&reply);
            assert!(!response.ok);
            assert!(response.error.unwrap().contains("not received in time"));
            let _ = std::fs::remove_file(&path);
        }

        #[tokio::test]
        async fn the_second_socket_is_used_when_the_first_is_closed_to_the_caller() {
            let path = temp_socket("service");
            let server_path = path.clone();
            tokio::spawn(async move {
                let _ = serve_at(server_path, None, own_exe(), |_| async {
                    Response::success(None)
                })
                .await;
            });
            wait_for(&path).await;

            let sockets = [temp_socket("absent-desktop"), path.clone()];
            let answer = forward_through(&sockets, &Request::ReleaseHost)
                .await
                .unwrap();
            assert!(answer.ok);
            let _ = std::fs::remove_file(&path);
        }

        #[tokio::test]
        async fn request_round_trips_through_the_socket() {
            let path = temp_socket("roundtrip");
            let server_path = path.clone();
            tokio::spawn(async move {
                let _ = serve_at(server_path, None, own_exe(), |request| async move {
                    match request {
                        Request::BlockIp { ip, .. } if ip == "203.0.113.9" => {
                            Response::success(None)
                        }
                        _ => Response::failure("refused"),
                    }
                })
                .await;
            });
            for _ in 0..50 {
                if path.exists() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }

            let ok = forward_to(
                &path,
                &Request::BlockIp {
                    ip: "203.0.113.9".into(),
                    duration_secs: 0,
                },
            )
            .await
            .unwrap();
            assert!(ok.ok);

            let refused = forward_to(&path, &Request::ReleaseHost).await.unwrap();
            assert!(!refused.ok);
            assert_eq!(refused.error.as_deref(), Some("refused"));
            let _ = std::fs::remove_file(&path);
        }

        #[tokio::test]
        async fn missing_service_gives_actionable_error() {
            let err = forward_to(&temp_socket("absent"), &Request::ReleaseHost)
                .await
                .unwrap_err()
                .to_string();
            assert!(err.contains("Elevated privileges required"), "{err}");
            assert!(err.contains("sentinel-agent install"), "{err}");
        }

        #[tokio::test]
        async fn malformed_request_is_rejected_not_executed() {
            let path = temp_socket("malformed");
            let server_path = path.clone();
            tokio::spawn(async move {
                let _ = serve_at(server_path, None, own_exe(), |_| async {
                    Response::success(None)
                })
                .await;
            });
            for _ in 0..50 {
                if path.exists() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            let mut stream = UnixStream::connect(&path).await.unwrap();
            let challenge = read_challenge(&mut stream).await;
            stream
                .write_all(
                    format!(r#"{{"challenge":"{challenge}","op":"run_shell","cmd":"id"}}"#)
                        .as_bytes(),
                )
                .await
                .unwrap();
            stream.shutdown().await.unwrap();
            let mut reply = Vec::new();
            stream.read_to_end(&mut reply).await.unwrap();
            let response: Response = serde_json::from_slice(&reply).unwrap();
            assert!(!response.ok);
            let _ = std::fs::remove_file(&path);
        }
    }
}

/// Without a local socket (Windows) the action cannot be delegated yet.
#[cfg(not(unix))]
pub async fn forward(_request: &Request) -> Result<Response, CommonError> {
    Err(CommonError::internal(
        "Elevated privileges required: run the Sentinel service as Administrator",
    ))
}

/// Windows has no privileged socket yet.
#[cfg(not(unix))]
pub async fn serve() -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "the privileged helper is not available on this platform",
    ))
}

/// Run `request` through the service and turn its answer into a result.
pub async fn delegate(request: Request) -> Result<Option<serde_json::Value>, CommonError> {
    let response = forward(&request).await?;
    if response.ok {
        Ok(response.data)
    } else {
        Err(CommonError::internal(response.error.unwrap_or_else(|| {
            "The Sentinel service refused the action".into()
        })))
    }
}
