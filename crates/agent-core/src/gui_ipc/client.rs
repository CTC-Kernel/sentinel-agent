// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Interface side of the channel: connect to the service, keep connected,
//! hand its events to the interface and carry the interface's commands.

use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use agent_gui::dto::GuiNotification;
use agent_gui::events::{AgentEvent, GuiCommand, Secret, ServiceAdminOutcome};
use tokio::io::{AsyncRead, AsyncWrite, BufReader};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

use super::frame::{
    self, ClientFrame, CommandResult, FrameError, FrameReader, MAX_SERVER_FRAME_BYTES,
    PROTOCOL_VERSION, Resume, ServerFrame,
};

/// First delay before trying to connect again; doubles up to the maximum.
const RETRY_MIN: Duration = Duration::from_millis(500);
const RETRY_MAX: Duration = Duration::from_secs(10);

/// How long the service may take to answer `hello`.
const HELLO_TIMEOUT: Duration = Duration::from_secs(10);

/// A command that waited longer than this for the service is not sent any
/// more: the operator asked for it in another situation.
const STALE_AFTER: Duration = Duration::from_secs(30);

/// Commands that may wait while the channel is being established.
const OUTBOUND_QUEUE: usize = 256;

/// Commands whose result is still awaited, at most.
const MAX_PENDING: usize = 256;

/// What the interface sends to the service.
#[derive(Debug)]
pub enum Outbound {
    Command(GuiCommand),
    Unlock(Secret),
    SetPassword(Secret),
    Lock,
}

/// The interface's handle on the channel: queue what goes to the service.
#[derive(Clone)]
pub struct ClientHandle {
    tx: mpsc::Sender<(Instant, Outbound)>,
    connected: Arc<AtomicBool>,
    ever_connected: Arc<AtomicBool>,
}

/// Why something was not queued for the service.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotSent {
    /// The service was reached before and is not answering now.
    Unreachable,
    /// Too many commands are already waiting.
    Busy,
}

impl ClientHandle {
    /// Queue `item` for the service. Before the first connection commands
    /// wait (the interface sends some as it starts); once the service was
    /// reached and is lost, they are refused at once so the operator is
    /// told, instead of being run minutes later.
    pub fn send(&self, item: Outbound) -> Result<(), NotSent> {
        if self.ever_connected.load(Ordering::Acquire) && !self.connected.load(Ordering::Acquire) {
            return Err(NotSent::Unreachable);
        }
        self.tx
            .try_send((Instant::now(), item))
            .map_err(|_| NotSent::Busy)
    }

    /// Whether the service answers right now.
    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Acquire)
    }
}

/// The receiving end of a [`ClientHandle`], consumed by [`run`].
pub struct OutboundQueue {
    rx: mpsc::Receiver<(Instant, Outbound)>,
    connected: Arc<AtomicBool>,
    ever_connected: Arc<AtomicBool>,
}

impl OutboundQueue {
    /// The next item waiting for the service, if any (diagnostics, tests).
    pub fn try_next(&mut self) -> Option<Outbound> {
        self.rx.try_recv().ok().map(|(_, item)| item)
    }
}

/// Create the queue between the interface and its channel task.
pub fn handle() -> (ClientHandle, OutboundQueue) {
    let (tx, rx) = mpsc::channel(OUTBOUND_QUEUE);
    let connected = Arc::new(AtomicBool::new(false));
    let ever_connected = Arc::new(AtomicBool::new(false));
    (
        ClientHandle {
            tx,
            connected: connected.clone(),
            ever_connected: ever_connected.clone(),
        },
        OutboundQueue {
            rx,
            connected,
            ever_connected,
        },
    )
}

/// What survives a reconnection.
#[derive(Default)]
struct Session {
    /// Where to resume the event stream.
    resume: Option<Resume>,
    next_id: u64,
    /// Commands sent whose result has not come back: a refusal gives the
    /// command back to the interface.
    pending: HashMap<u64, GuiCommand>,
    admin_configured: bool,
}

/// Why a connection ended.
#[derive(Debug)]
enum End {
    /// The interface is gone: stop for good.
    InterfaceClosed,
    /// The service closed the stream or sent something invalid.
    Lost(String),
}

/// Keep the interface connected to the service for as long as the interface
/// lives: `connect` is called again, with a growing delay, whenever the
/// channel cannot be opened or is lost.
pub async fn run<C, Fut, S>(
    mut connect: C,
    events: std::sync::mpsc::Sender<AgentEvent>,
    mut queue: OutboundQueue,
) where
    C: FnMut() -> Fut,
    Fut: Future<Output = std::io::Result<S>>,
    S: AsyncRead + AsyncWrite + Unpin,
{
    let mut session = Session::default();
    let mut delay = RETRY_MIN;
    let mut reported_down = false;
    loop {
        match connect().await {
            Ok(stream) => {
                let end = serve(stream, &mut session, &events, &mut queue).await;
                let was_connected = queue.connected.swap(false, Ordering::AcqRel);
                if was_connected {
                    delay = RETRY_MIN;
                    reported_down = false;
                }
                match end {
                    End::InterfaceClosed => return,
                    End::Lost(reason) => info!("Service channel lost: {}", reason),
                }
            }
            Err(e) => debug!("Service channel not available: {}", e),
        }
        // Said once per outage: the interface shows it until the link is
        // back, and the administrator mode of the lost connection is over.
        if !reported_down {
            reported_down = true;
            session.pending.clear();
            let down = AgentEvent::ServiceLink {
                connected: false,
                admin_configured: session.admin_configured,
            };
            let locked = AgentEvent::ServiceAdmin {
                outcome: ServiceAdminOutcome::Locked,
            };
            if events.send(down).is_err() || events.send(locked).is_err() {
                return;
            }
        }
        tokio::time::sleep(delay).await;
        delay = (delay * 2).min(RETRY_MAX);
    }
}

/// One connection, from `hello` to its end.
async fn serve<S>(
    stream: S,
    session: &mut Session,
    events: &std::sync::mpsc::Sender<AgentEvent>,
    queue: &mut OutboundQueue,
) -> End
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let (read_half, mut writer) = tokio::io::split(stream);
    let mut reader = FrameReader::new(BufReader::new(read_half), MAX_SERVER_FRAME_BYTES);

    let hello = ClientFrame::Hello {
        version: PROTOCOL_VERSION,
        resume: session.resume,
    };
    if let Err(e) = frame::write_frame(&mut writer, &hello).await {
        return End::Lost(e.to_string());
    }
    let answer = match tokio::time::timeout(HELLO_TIMEOUT, reader.next()).await {
        Ok(Ok(Some(bytes))) => serde_json::from_slice::<ServerFrame>(bytes),
        Ok(Ok(None)) => return End::Lost("closed before hello".into()),
        Ok(Err(e)) => return End::Lost(e.to_string()),
        Err(_) => return End::Lost("no hello from the service".into()),
    };
    match answer {
        Ok(ServerFrame::Hello {
            version,
            agent_version,
            instance,
            admin_configured,
        }) if version == PROTOCOL_VERSION => {
            info!("Service channel open (service {})", agent_version);
            if session
                .resume
                .is_none_or(|resume| resume.instance != instance)
            {
                session.resume = Some(Resume {
                    instance,
                    last_seq: 0,
                });
            }
            session.admin_configured = admin_configured;
        }
        Ok(ServerFrame::Error { message }) => return End::Lost(message),
        Ok(other) => return End::Lost(format!("unexpected answer to hello: {other:?}")),
        Err(e) => return End::Lost(e.to_string()),
    }
    queue.connected.store(true, Ordering::Release);
    queue.ever_connected.store(true, Ordering::Release);
    let up = AgentEvent::ServiceLink {
        connected: true,
        admin_configured: session.admin_configured,
    };
    if events.send(up).is_err() {
        return End::InterfaceClosed;
    }

    loop {
        tokio::select! {
            received = reader.next() => {
                let frame = match received {
                    Ok(Some(bytes)) => match serde_json::from_slice::<ServerFrame>(bytes) {
                        Ok(frame) => frame,
                        Err(e) => return End::Lost(FrameError::from(e).to_string()),
                    },
                    Ok(None) => return End::Lost("closed by the service".into()),
                    Err(e) => return End::Lost(e.to_string()),
                };
                if let Err(end) = receive(frame, session, events) {
                    return end;
                }
            }
            item = queue.rx.recv() => {
                let Some((queued_at, item)) = item else {
                    return End::InterfaceClosed;
                };
                let frame = match outbound_frame(queued_at, item, session, events) {
                    Ok(Some(frame)) => frame,
                    Ok(None) => continue,
                    Err(end) => return end,
                };
                if let Err(e) = frame::write_frame(&mut writer, &frame).await {
                    return End::Lost(e.to_string());
                }
            }
        }
    }
}

/// Handle one frame of the service.
fn receive(
    frame: ServerFrame,
    session: &mut Session,
    events: &std::sync::mpsc::Sender<AgentEvent>,
) -> Result<(), End> {
    let forward = |event: AgentEvent| events.send(event).map_err(|_| End::InterfaceClosed);
    match frame {
        ServerFrame::Event { seq, event } => {
            if let Some(resume) = session.resume.as_mut() {
                resume.last_seq = resume.last_seq.max(seq);
            }
            forward(*event)
        }
        ServerFrame::CommandResult { id, result } => {
            let command = session.pending.remove(&id);
            match (result, command) {
                (CommandResult::Accepted, _) => Ok(()),
                (CommandResult::AdminRequired { reason }, Some(command)) => {
                    // The interface asks for the password, then sends the
                    // command again.
                    forward(AgentEvent::ServiceCommandRefused {
                        command: Box::new(command),
                        reason,
                    })
                }
                (CommandResult::AdminRequired { reason }, None) => {
                    forward(AgentEvent::Notification {
                        notification: GuiNotification::error(
                            "Action refusée par le service",
                            format!("Mode administrateur requis : {reason}."),
                        ),
                    })
                }
                (CommandResult::LocalOnly, command) => {
                    warn!(
                        "The service refused a command that belongs to the interface: {:?}",
                        command.as_ref().map(super::policy::command_name)
                    );
                    Ok(())
                }
            }
        }
        ServerFrame::Admin { outcome } => {
            if matches!(outcome, ServiceAdminOutcome::PasswordSet { .. }) {
                session.admin_configured = true;
            }
            forward(AgentEvent::ServiceAdmin { outcome })
        }
        ServerFrame::Lagged { dropped } => {
            debug!(
                "Service channel: {} event(s) dropped, snapshot follows",
                dropped
            );
            Ok(())
        }
        ServerFrame::Pong => Ok(()),
        ServerFrame::Hello { .. } => Err(End::Lost("second hello".into())),
        ServerFrame::Error { message } => Err(End::Lost(message)),
    }
}

/// The frame that carries `item`, or `None` when it waited too long.
fn outbound_frame(
    queued_at: Instant,
    item: Outbound,
    session: &mut Session,
    events: &std::sync::mpsc::Sender<AgentEvent>,
) -> Result<Option<ClientFrame>, End> {
    if queued_at.elapsed() > STALE_AFTER {
        if let Outbound::Command(command) = &item {
            let name = super::policy::command_name(command);
            warn!("Service channel: {} waited too long, not sent", name);
            events
                .send(AgentEvent::Notification {
                    notification: GuiNotification::error(
                        "Action non transmise",
                        "Le service Sentinel était injoignable : recommencez l'action.",
                    ),
                })
                .map_err(|_| End::InterfaceClosed)?;
        }
        return Ok(None);
    }
    Ok(Some(match item {
        Outbound::Command(command) => {
            session.next_id += 1;
            let id = session.next_id;
            if session.pending.len() >= MAX_PENDING {
                session.pending.clear();
            }
            session.pending.insert(id, command.clone());
            ClientFrame::Command {
                id,
                command: Box::new(command),
            }
        }
        Outbound::Unlock(password) => ClientFrame::Unlock { password },
        Outbound::SetPassword(password) => ClientFrame::SetPassword { password },
        Outbound::Lock => ClientFrame::Lock,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gui_ipc::hub::tests::{PASSWORD, hub};
    use crate::gui_ipc::{Hub, serve_connection};
    use std::sync::atomic::AtomicUsize;

    /// The next event of the interface, skipping what the test ignores.
    fn next(
        events: &std::sync::mpsc::Receiver<AgentEvent>,
        mut wanted: impl FnMut(&AgentEvent) -> bool,
    ) -> AgentEvent {
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            let event = events.recv_timeout(left).expect("the event arrives");
            if wanted(&event) {
                return event;
            }
        }
    }

    /// Connects to `hub` over an in-memory stream; fails `failures` times
    /// first, as a service that is still starting would.
    fn connector(
        hub: Arc<Hub>,
        failures: usize,
    ) -> (
        impl FnMut() -> std::future::Ready<std::io::Result<tokio::io::DuplexStream>>,
        Arc<AtomicUsize>,
    ) {
        let attempts = Arc::new(AtomicUsize::new(0));
        let counter = attempts.clone();
        let connect = move || {
            let attempt = counter.fetch_add(1, Ordering::SeqCst);
            std::future::ready(if attempt < failures {
                Err(std::io::Error::from(std::io::ErrorKind::NotFound))
            } else {
                let (near, far) = tokio::io::duplex(64 * 1024);
                let hub = hub.clone();
                tokio::spawn(async move {
                    let _ = serve_connection(hub, far).await;
                });
                Ok(near)
            })
        };
        (connect, attempts)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn the_interface_receives_the_snapshot_then_the_live_events() {
        let (hub, _commands, _store) = hub();
        hub.publish(&AgentEvent::FimStats {
            monitored_count: 7,
            changes_today: 1,
        });
        let (connect, _) = connector(hub.clone(), 0);
        let (events_tx, events) = std::sync::mpsc::channel();
        let (handle, queue) = handle();
        tokio::spawn(run(connect, events_tx, queue));

        assert!(matches!(
            next(&events, |e| matches!(e, AgentEvent::ServiceLink { .. })),
            AgentEvent::ServiceLink {
                connected: true,
                admin_configured: false
            }
        ));
        next(&events, |e| {
            matches!(
                e,
                AgentEvent::FimStats {
                    monitored_count: 7,
                    ..
                }
            )
        });
        assert!(handle.is_connected());
        hub.publish(&AgentEvent::FimStats {
            monitored_count: 8,
            changes_today: 2,
        });
        next(&events, |e| {
            matches!(
                e,
                AgentEvent::FimStats {
                    monitored_count: 8,
                    ..
                }
            )
        });
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn commands_reach_the_agent_and_a_refusal_comes_back_with_the_command() {
        let (hub, commands, _store) = hub();
        let (connect, _) = connector(hub.clone(), 0);
        let (events_tx, events) = std::sync::mpsc::channel();
        let (handle, queue) = handle();
        tokio::spawn(run(connect, events_tx, queue));

        // Queued before the channel is open: sent once it is.
        handle
            .send(Outbound::Command(GuiCommand::RunCheck))
            .unwrap();
        handle.send(Outbound::Command(GuiCommand::Pause)).unwrap();
        match next(&events, |e| {
            matches!(e, AgentEvent::ServiceCommandRefused { .. })
        }) {
            AgentEvent::ServiceCommandRefused { command, reason } => {
                assert!(matches!(*command, GuiCommand::Pause));
                assert!(!reason.is_empty());
            }
            _ => unreachable!(),
        }
        assert!(matches!(
            commands.recv_timeout(Duration::from_secs(5)),
            Ok(GuiCommand::RunCheck)
        ));

        // The password goes to the service, which answers; the command is
        // then accepted.
        handle
            .send(Outbound::SetPassword(Secret::new(PASSWORD)))
            .unwrap();
        assert!(matches!(
            next(&events, |e| matches!(e, AgentEvent::ServiceAdmin { .. })),
            AgentEvent::ServiceAdmin {
                outcome: ServiceAdminOutcome::PasswordSet { .. }
            }
        ));
        handle.send(Outbound::Command(GuiCommand::Pause)).unwrap();
        assert!(matches!(
            commands.recv_timeout(Duration::from_secs(5)),
            Ok(GuiCommand::Pause)
        ));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn an_unreachable_service_is_reported_once_then_reached_again() {
        let (hub, _commands, _store) = hub();
        let (connect, attempts) = connector(hub.clone(), 2);
        let (events_tx, events) = std::sync::mpsc::channel();
        let (handle, queue) = handle();
        tokio::spawn(run(connect, events_tx, queue));

        // Down first, said once although two attempts failed.
        assert!(matches!(
            next(&events, |e| matches!(e, AgentEvent::ServiceLink { .. })),
            AgentEvent::ServiceLink {
                connected: false,
                ..
            }
        ));
        assert!(matches!(
            next(&events, |e| matches!(e, AgentEvent::ServiceLink { .. })),
            AgentEvent::ServiceLink {
                connected: true,
                ..
            }
        ));
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
        assert!(handle.is_connected());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_lost_service_locks_the_interface_and_refuses_commands_at_once() {
        let (hub, _commands, _store) = hub();
        // One connection only: the service "stops" after it.
        let served = Arc::new(AtomicUsize::new(0));
        let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
        let mut stop_rx = Some(stop_rx);
        let connect = {
            let hub = hub.clone();
            let served = served.clone();
            move || {
                let first = served.fetch_add(1, Ordering::SeqCst) == 0;
                std::future::ready(match (first, stop_rx.take()) {
                    (true, Some(stop)) => {
                        let (near, far) = tokio::io::duplex(64 * 1024);
                        let hub = hub.clone();
                        tokio::spawn(async move {
                            tokio::select! {
                                _ = serve_connection(hub, far) => {}
                                _ = stop => {}
                            }
                        });
                        Ok(near)
                    }
                    _ => Err(std::io::Error::from(std::io::ErrorKind::NotFound)),
                })
            }
        };
        let (events_tx, events) = std::sync::mpsc::channel();
        let (handle, queue) = handle();
        tokio::spawn(run(connect, events_tx, queue));
        next(&events, |e| {
            matches!(
                e,
                AgentEvent::ServiceLink {
                    connected: true,
                    ..
                }
            )
        });

        stop_tx.send(()).unwrap();
        next(&events, |e| {
            matches!(
                e,
                AgentEvent::ServiceLink {
                    connected: false,
                    ..
                }
            )
        });
        assert!(matches!(
            next(&events, |e| matches!(e, AgentEvent::ServiceAdmin { .. })),
            AgentEvent::ServiceAdmin {
                outcome: ServiceAdminOutcome::Locked
            }
        ));
        assert!(!handle.is_connected());
        assert_eq!(
            handle.send(Outbound::Command(GuiCommand::RunCheck)),
            Err(NotSent::Unreachable)
        );
    }

    #[test]
    fn a_command_that_waited_too_long_is_dropped_and_said() {
        let (events_tx, events) = std::sync::mpsc::channel();
        let mut session = Session::default();
        let Some(long_ago) = Instant::now().checked_sub(STALE_AFTER + Duration::from_secs(1))
        else {
            return; // The clock of this machine started less than 31 s ago.
        };
        let frame = outbound_frame(
            long_ago,
            Outbound::Command(GuiCommand::IsolateHost { duration_secs: 0 }),
            &mut session,
            &events_tx,
        )
        .unwrap();
        assert!(frame.is_none());
        assert!(session.pending.is_empty());
        assert!(matches!(
            events.try_recv(),
            Ok(AgentEvent::Notification { .. })
        ));
    }
}
