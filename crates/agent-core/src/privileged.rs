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

    /// Where the service listens.
    pub fn socket_path() -> PathBuf {
        if let Ok(path) = std::env::var("SENTINEL_PRIVILEGED_SOCKET") {
            return PathBuf::from(path);
        }
        PathBuf::from("/var/run/sentinel-agent.sock")
    }

    fn admin_gid() -> Option<libc::gid_t> {
        ADMIN_GROUPS.iter().find_map(|name| {
            let name = std::ffi::CString::new(*name).ok()?;
            // SAFETY: `name` is a valid NUL-terminated string; the returned
            // pointer is read immediately and not kept.
            let group = unsafe { libc::getgrnam(name.as_ptr()) };
            (!group.is_null()).then(|| unsafe { (*group).gr_gid })
        })
    }

    /// Bind the socket: root-owned, usable by the administrators' group only.
    fn bind(path: &Path) -> std::io::Result<UnixListener> {
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

        let mode = match admin_gid() {
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
        serve_at(&socket_path(), dispatch).await
    }

    pub(super) async fn serve_at<F, Fut>(path: &Path, handler: F) -> std::io::Result<()>
    where
        F: Fn(Request) -> Fut + Clone + Send + 'static,
        Fut: Future<Output = Response> + Send + 'static,
    {
        let listener = bind(path)?;
        info!("Privileged action socket ready at {}", path.display());

        loop {
            let (stream, _) = match listener.accept().await {
                Ok(accepted) => accepted,
                Err(e) => {
                    warn!("Privileged socket accept failed: {}", e);
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    continue;
                }
            };
            let handler = handler.clone();
            tokio::spawn(async move {
                if let Err(e) = handle(stream, handler).await {
                    warn!("Privileged request failed: {}", e);
                }
            });
        }
    }

    async fn handle<F, Fut>(mut stream: UnixStream, handler: F) -> std::io::Result<()>
    where
        F: Fn(Request) -> Fut,
        Fut: Future<Output = Response>,
    {
        let caller = stream.peer_cred().map(|c| c.uid()).ok();

        let mut buf = Vec::new();
        (&mut stream)
            .take(MAX_REQUEST_BYTES)
            .read_to_end(&mut buf)
            .await?;

        let response = match serde_json::from_slice::<Request>(&buf) {
            Ok(request) => {
                info!("Privileged request from uid {:?}: {:?}", caller, request);
                handler(request).await
            }
            Err(e) => Response::failure(format!("Malformed request: {e}")),
        };
        stream
            .write_all(&serde_json::to_vec(&response).unwrap_or_default())
            .await?;
        stream.shutdown().await
    }

    /// Ask the service to perform `request`.
    pub async fn forward(request: &Request) -> Result<Response, CommonError> {
        forward_to(&socket_path(), request).await
    }

    pub(super) async fn forward_to(
        path: &Path,
        request: &Request,
    ) -> Result<Response, CommonError> {
        let unavailable = |why: String| {
            CommonError::internal(format!(
                "Elevated privileges required: the Sentinel service is not reachable ({why}). \
                 Install and start it with `sudo sentinel-agent install` then \
                 `sudo sentinel-agent start`"
            ))
        };

        let mut stream = tokio::time::timeout(CONNECT_TIMEOUT, UnixStream::connect(path))
            .await
            .map_err(|_| unavailable("timeout".into()))?
            .map_err(|e| unavailable(e.to_string()))?;

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

        #[tokio::test]
        async fn request_round_trips_through_the_socket() {
            let path = temp_socket("roundtrip");
            let server_path = path.clone();
            tokio::spawn(async move {
                let _ = serve_at(&server_path, |request| async move {
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
                let _ = serve_at(&server_path, |_| async { Response::success(None) }).await;
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
