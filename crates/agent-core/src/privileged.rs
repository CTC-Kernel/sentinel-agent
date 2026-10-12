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
//!   program is connected and refuses any other than the Sentinel application
//!   itself. Otherwise any program started by an administrator, malware
//!   included, could lift an isolation or unblock an address by writing one
//!   line to the socket.
//! * The protocol is a closed enum, not a command line: the service never runs
//!   anything the client sends, it calls the same audited functions
//!   (`block_ip`, `isolate_host`, ...) which validate their arguments.
//! * One JSON request per connection, one JSON answer back.

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
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
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

    // ── Who is asking ───────────────────────────────────────────────────

    /// The program at the other end of a connection.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(super) enum Peer {
        /// Root, or the Sentinel executable this service runs.
        Trusted,
        /// The system did not say which program it is.
        Unverified,
        /// Another program.
        Foreign(PathBuf),
    }

    /// Executable of the process `pid`, when the system gives it.
    #[cfg(target_os = "macos")]
    fn executable_of(pid: libc::pid_t) -> Option<PathBuf> {
        use std::os::unix::ffi::OsStrExt;

        let mut buffer = vec![0u8; libc::PROC_PIDPATHINFO_MAXSIZE as usize];
        // SAFETY: `buffer` is writable for the length passed along with it.
        let length =
            unsafe { libc::proc_pidpath(pid, buffer.as_mut_ptr().cast(), buffer.len() as u32) };
        (length > 0).then(|| PathBuf::from(std::ffi::OsStr::from_bytes(&buffer[..length as usize])))
    }

    /// Executable of the process `pid`, when the system gives it.
    #[cfg(target_os = "linux")]
    fn executable_of(pid: libc::pid_t) -> Option<PathBuf> {
        let path = std::fs::read_link(format!("/proc/{pid}/exe")).ok()?;
        // A program replaced on disk while it runs (an update) no longer has
        // a path to compare.
        (!path.to_string_lossy().ends_with(" (deleted)")).then_some(path)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    fn executable_of(_pid: libc::pid_t) -> Option<PathBuf> {
        None
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
            warn!("Own executable unknown: clients of the privileged socket cannot be verified");
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
        let listener = bind(&path, group)?;
        info!("Privileged action socket ready at {}", path.display());
        let slots = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_REQUESTS));

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
            let own_exe = own_exe.clone();
            tokio::spawn(async move {
                let _slot = slot;
                if let Err(e) = handle(stream, own_exe.as_deref(), handler).await {
                    warn!("Privileged request failed: {}", e);
                }
            });
        }
    }

    async fn handle<F, Fut>(
        mut stream: UnixStream,
        own_exe: Option<&Path>,
        handler: F,
    ) -> std::io::Result<()>
    where
        F: Fn(Request) -> Fut,
        Fut: Future<Output = Response>,
    {
        let credentials = stream.peer_cred().ok();
        let caller = credentials.as_ref().map(|c| c.uid());
        let peer_exe = credentials
            .as_ref()
            .and_then(|c| c.pid())
            .and_then(executable_of);
        let peer = classify_peer(caller, peer_exe.as_deref(), own_exe);

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
            Ok(Ok(_)) => match (serde_json::from_slice::<Request>(&buf), &peer) {
                (Err(e), _) => Response::failure(format!("Malformed request: {e}")),
                (Ok(request), Peer::Foreign(program)) => {
                    warn!(
                        "Privileged request refused: uid {:?} asked {:?} from {}, \
                         which is not the Sentinel application",
                        caller,
                        request,
                        program.display()
                    );
                    Response::failure(
                        "Refused: privileged actions are only accepted from the Sentinel \
                         application installed with this service",
                    )
                }
                (Ok(request), _) => {
                    info!(
                        "Privileged request from uid {:?} ({}): {:?}",
                        caller,
                        if peer == Peer::Trusted {
                            "verified"
                        } else {
                            "program not verifiable"
                        },
                        request
                    );
                    handler(request).await
                }
            },
        };
        stream
            .write_all(&serde_json::to_vec(&response).unwrap_or_default())
            .await?;
        stream.shutdown().await
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

    /// Send `request` on a connected socket and read the answer.
    async fn exchange(mut stream: UnixStream, request: &Request) -> Result<Response, CommonError> {
        let body = serde_json::to_vec(request)
            .map_err(|e| CommonError::internal(format!("Cannot encode request: {e}")))?;
        let exchange = async {
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

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        #[test]
        fn the_system_names_the_executable_of_a_process() {
            let found = executable_of(std::process::id() as libc::pid_t).expect("own executable");
            assert_eq!(
                found.canonicalize().unwrap(),
                own_exe().unwrap().canonicalize().unwrap()
            );
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
            let response: Response = serde_json::from_slice(&reply).unwrap();
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
            stream
                .write_all(br#"{"op":"run_shell","cmd":"id"}"#)
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
