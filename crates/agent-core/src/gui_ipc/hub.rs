// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Service side of the channel: fan-out of the agent's events, snapshot
//! for an interface that connects, and intake of its commands.

use std::collections::{BTreeMap, HashMap, VecDeque};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use agent_gui::events::{AgentEvent, GuiCommand, ServiceAdminOutcome};
use tokio::io::{AsyncRead, AsyncWrite, BufReader};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

use super::admin::{AdminGate, SecureStore};
use super::frame::{
    self, ClientFrame, CommandResult, FrameError, FrameReader, MAX_CLIENT_FRAME_BYTES,
    MAX_SERVER_FRAME_BYTES, PROTOCOL_VERSION, Resume, ServerFrame,
};
use super::policy::{self, Replay};

/// How long a connection may stay silent before its `hello`.
const HELLO_TIMEOUT: Duration = Duration::from_secs(10);

/// Name of the settings journal in the store.
const SETTINGS: &str = "settings";

/// What the service is built with.
pub struct HubConfig {
    /// Version announced in `hello`.
    pub agent_version: String,
    /// Whether the service runs this command at all; the others belong to
    /// the interface's own session and are refused as `local_only`.
    pub accepts: fn(&GuiCommand) -> bool,
    /// Lines a connection may have waiting before events are dropped for it.
    pub client_queue: usize,
    /// Recent stream items (alerts, actions) kept for replay.
    pub recent_capacity: usize,
    /// How long a connection stays in administrator mode after an unlock.
    pub admin_session: Duration,
}

impl HubConfig {
    pub fn new(agent_version: impl Into<String>, accepts: fn(&GuiCommand) -> bool) -> Self {
        Self {
            agent_version: agent_version.into(),
            accepts,
            client_queue: 4096,
            recent_capacity: 500,
            admin_session: Duration::from_secs(super::admin::ADMIN_SESSION_SECS),
        }
    }
}

/// A serialized event and its place in the stream.
#[derive(Clone)]
struct Entry {
    seq: u64,
    line: Arc<str>,
}

/// One connected interface, as the fan-out sees it.
struct Slot {
    id: u64,
    tx: mpsc::Sender<Arc<str>>,
    /// Last event queued for this connection.
    delivered_seq: u64,
    /// Events dropped since its queue filled up; `0`: up to date.
    dropped: u64,
}

#[derive(Default)]
struct Inner {
    seq: u64,
    latest: HashMap<String, Entry>,
    recent: VecDeque<Entry>,
    clients: Vec<Slot>,
    next_client: u64,
    /// Last accepted value of each persistent setting.
    settings: BTreeMap<String, GuiCommand>,
}

impl Inner {
    /// What brings an interface up to date: every latest state, and the
    /// recent items it has not received (`since`: the last one it has).
    fn snapshot(&self, since: Option<u64>) -> Vec<Arc<str>> {
        let since = since.unwrap_or(0);
        let mut entries: Vec<&Entry> = self
            .latest
            .values()
            .chain(self.recent.iter().filter(|entry| entry.seq > since))
            .collect();
        entries.sort_by_key(|entry| entry.seq);
        entries
            .into_iter()
            .map(|entry| entry.line.clone())
            .collect()
    }
}

/// What a new connection starts with.
pub struct Registration {
    id: u64,
    rx: mpsc::Receiver<Arc<str>>,
}

/// The service end of the channel, shared by every connection.
pub struct Hub {
    config: HubConfig,
    /// Changes at every start: an interface that reconnects to another
    /// instance is replayed everything.
    instance: u64,
    admin: AdminGate,
    store: Arc<dyn SecureStore>,
    commands: Mutex<std::sync::mpsc::Sender<GuiCommand>>,
    inner: Mutex<Inner>,
}

impl Hub {
    /// `commands` feeds the agent's command handlers; `store` keeps the
    /// administrator record and the settings journal.
    pub fn new(
        config: HubConfig,
        store: Arc<dyn SecureStore>,
        commands: std::sync::mpsc::Sender<GuiCommand>,
    ) -> Self {
        Self {
            config,
            instance: rand::random::<u64>() | 1,
            admin: AdminGate::load(store.clone()),
            store,
            commands: Mutex::new(commands),
            inner: Mutex::new(Inner::default()),
        }
    }

    fn inner(&self) -> MutexGuard<'_, Inner> {
        self.inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Number of connected interfaces.
    pub fn client_count(&self) -> usize {
        self.inner().clients.len()
    }

    /// Publish an event of the agent. Never blocks: a connection that does
    /// not read fast enough loses events and is resynchronised later.
    pub fn publish(&self, event: &AgentEvent) {
        let class = policy::replay(event);
        if class == Replay::Private {
            return;
        }
        let mut inner = self.inner();
        let seq = inner.seq + 1;
        let line: Arc<str> = match frame::event_line(seq, event) {
            Ok(line) if line.len() <= MAX_SERVER_FRAME_BYTES => line.into(),
            Ok(line) => {
                warn!(
                    "Event of {} bytes is too large for the service channel",
                    line.len()
                );
                return;
            }
            Err(e) => {
                warn!("Event not serialized for the service channel: {}", e);
                return;
            }
        };
        inner.seq = seq;
        let entry = Entry {
            seq,
            line: line.clone(),
        };
        match class {
            Replay::Latest(key) => {
                inner.latest.insert(key, entry);
            }
            Replay::Recent => {
                inner.recent.push_back(entry);
                while inner.recent.len() > self.config.recent_capacity {
                    inner.recent.pop_front();
                }
            }
            Replay::Transient | Replay::Private => {}
        }

        let mut clients = std::mem::take(&mut inner.clients);
        clients.retain_mut(|client| Self::deliver(&inner, client, seq, &line));
        inner.clients = clients;
    }

    /// Queue `line` for one connection; `false` when the connection is gone.
    fn deliver(inner: &Inner, client: &mut Slot, seq: u64, line: &Arc<str>) -> bool {
        if client.tx.is_closed() {
            return false;
        }
        if client.dropped == 0 {
            match client.tx.try_send(line.clone()) {
                Ok(()) => client.delivered_seq = seq,
                Err(mpsc::error::TrySendError::Full(_)) => client.dropped = 1,
                Err(mpsc::error::TrySendError::Closed(_)) => return false,
            }
            return true;
        }
        // Behind: catch up from the snapshot once it fits in the queue,
        // rather than replaying what was dropped.
        let lines = inner.snapshot(Some(client.delivered_seq));
        if client.tx.capacity() <= lines.len() {
            client.dropped += 1;
            return true;
        }
        let lagged = serde_json::to_string(&ServerFrame::Lagged {
            dropped: client.dropped,
        })
        .unwrap_or_default();
        let mut queued = client.tx.try_send(lagged.into()).is_ok();
        for line in lines {
            queued &= client.tx.try_send(line).is_ok();
        }
        if queued {
            client.delivered_seq = seq;
            client.dropped = 0;
        }
        !client.tx.is_closed()
    }

    /// Register a connection: its queue starts with the snapshot, taken
    /// under the same lock as the fan-out, so no event falls in between.
    fn register(&self, resume: Option<Resume>) -> Registration {
        let mut inner = self.inner();
        let since = resume
            .filter(|resume| resume.instance == self.instance)
            .map(|resume| resume.last_seq);
        let lines = inner.snapshot(since);
        let capacity = self.config.client_queue.max(lines.len() * 2 + 64);
        let (tx, rx) = mpsc::channel(capacity);
        for line in lines {
            // Cannot fail: the queue was sized for the snapshot.
            let _ = tx.try_send(line);
        }
        inner.next_client += 1;
        let id = inner.next_client;
        let delivered_seq = inner.seq;
        inner.clients.push(Slot {
            id,
            tx,
            delivered_seq,
            dropped: 0,
        });
        Registration { id, rx }
    }

    /// Queue an answer for one connection behind the events already queued
    /// for it, so everything the service sends on a connection is in one
    /// order: an answer never overtakes an event published before it.
    ///
    /// Gives the line back when it cannot be queued (the connection is
    /// behind, its queue is full): the caller then writes it directly, an
    /// answer is never dropped. Order means nothing for a connection that
    /// is about to be resynchronised from the snapshot anyway.
    fn queue_reply(&self, id: u64, line: Arc<str>) -> Result<(), Arc<str>> {
        let inner = self.inner();
        match inner.clients.iter().find(|client| client.id == id) {
            Some(client) if client.dropped == 0 => {
                client.tx.try_send(line).map_err(|refused| match refused {
                    mpsc::error::TrySendError::Full(line)
                    | mpsc::error::TrySendError::Closed(line) => line,
                })
            }
            _ => Err(line),
        }
    }

    fn unregister(&self, id: u64) {
        self.inner().clients.retain(|client| client.id != id);
    }

    fn hello(&self) -> ServerFrame {
        ServerFrame::Hello {
            version: PROTOCOL_VERSION,
            agent_version: self.config.agent_version.clone(),
            instance: self.instance,
            admin_configured: self.admin.is_configured(),
        }
    }

    /// Decide what happens to a command received from an interface whose
    /// connection is, or is not, in administrator mode.
    pub fn accept_command(&self, command: GuiCommand, unlocked: bool) -> CommandResult {
        if !(self.config.accepts)(&command) {
            return CommandResult::LocalOnly;
        }
        let name = policy::command_name(&command);
        if let Some(reason) = policy::admin_reason(&command)
            && !unlocked
        {
            info!(
                "[AUDIT] Service channel: {} refused, administrator mode required",
                name
            );
            return CommandResult::AdminRequired {
                reason: reason.to_string(),
            };
        }
        info!("[AUDIT] Service channel: {} accepted", name);
        if let Some(key) = policy::persistent_setting(&command) {
            self.journal_setting(key, &command);
        }
        let sent = self
            .commands
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .send(command);
        if sent.is_err() {
            warn!(
                "Service channel: {} accepted but the command handlers are gone",
                name
            );
        }
        CommandResult::Accepted
    }

    /// Remember the last accepted value of a setting, so the service
    /// applies it again at its next start (see [`Hub::restore_settings`]).
    fn journal_setting(&self, key: &str, command: &GuiCommand) {
        let mut inner = self.inner();
        inner.settings.insert(key.to_string(), command.clone());
        match serde_json::to_string(&inner.settings) {
            Ok(json) => {
                if let Err(e) = self.store.write(SETTINGS, &json) {
                    warn!("Setting {} applied but not saved: {}", key, e);
                }
            }
            Err(e) => warn!("Setting {} applied but not saved: {}", key, e),
        }
    }

    /// Apply the settings journaled by earlier runs of the service. Called
    /// once, before any interface connects. Returns how many were sent.
    pub fn restore_settings(&self) -> usize {
        let Some(json) = self.store.read(SETTINGS) else {
            return 0;
        };
        let settings: BTreeMap<String, GuiCommand> = match serde_json::from_str(&json) {
            Ok(settings) => settings,
            Err(e) => {
                warn!("Settings journal is unreadable, ignored: {}", e);
                return 0;
            }
        };
        let commands = self
            .commands
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut restored = 0;
        for (key, command) in &settings {
            // Only what the journal may hold: the store is trusted, a
            // command that slipped into it is still not run.
            if policy::persistent_setting(command) == Some(key.as_str())
                && commands.send(command.clone()).is_ok()
            {
                restored += 1;
            }
        }
        drop(commands);
        self.inner().settings = settings;
        restored
    }
}

/// Removes the connection from the fan-out when its task ends, however it
/// ends.
struct Registered<'a> {
    hub: &'a Hub,
    id: u64,
}

impl Drop for Registered<'_> {
    fn drop(&mut self) {
        self.hub.unregister(self.id);
    }
}

/// Serve one interface over `stream` until it disconnects or sends
/// something that is not a valid frame.
pub async fn serve_connection<S>(hub: Arc<Hub>, stream: S) -> Result<(), FrameError>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let (read_half, mut writer) = tokio::io::split(stream);
    let mut reader = FrameReader::new(BufReader::new(read_half), MAX_CLIENT_FRAME_BYTES);

    // ── hello ──
    let first = match tokio::time::timeout(HELLO_TIMEOUT, reader.next()).await {
        Ok(frame) => frame?,
        Err(_) => return refuse(&mut writer, "aucun hello reçu").await,
    };
    let Some(bytes) = first else {
        return Ok(());
    };
    let resume = match serde_json::from_slice::<ClientFrame>(bytes) {
        Ok(ClientFrame::Hello { version, resume }) if version == PROTOCOL_VERSION => resume,
        Ok(ClientFrame::Hello { version, .. }) => {
            return refuse(
                &mut writer,
                &format!("version {version} du protocole non prise en charge"),
            )
            .await;
        }
        Ok(_) => return refuse(&mut writer, "hello attendu").await,
        Err(e) => {
            let _ = refuse(&mut writer, "trame invalide").await;
            return Err(e.into());
        }
    };
    frame::write_frame(&mut writer, &hub.hello()).await?;

    let Registration { id, mut rx } = hub.register(resume);
    let _registered = Registered { hub: &hub, id };
    debug!("Service channel: interface {} connected", id);
    let mut unlocked_until: Option<Instant> = None;

    loop {
        tokio::select! {
            line = rx.recv() => match line {
                Some(line) => frame::write_line(&mut writer, &line).await?,
                None => break,
            },
            received = reader.next() => {
                let parsed = match received {
                    Ok(Some(bytes)) => serde_json::from_slice::<ClientFrame>(bytes),
                    Ok(None) => break,
                    Err(e) => {
                        let _ = refuse(&mut writer, "trame invalide ou trop grande").await;
                        return Err(e);
                    }
                };
                // The frame may have carried the password.
                reader.wipe();
                let frame = match parsed {
                    Ok(frame) => frame,
                    Err(e) => {
                        let _ = refuse(&mut writer, "trame inconnue").await;
                        return Err(e.into());
                    }
                };
                let unlocked = unlocked_until.is_some_and(|until| Instant::now() < until);
                let reply = match frame {
                    ClientFrame::Hello { .. } => {
                        return refuse(&mut writer, "hello déjà reçu").await;
                    }
                    ClientFrame::Ping => ServerFrame::Pong,
                    ClientFrame::Lock => {
                        unlocked_until = None;
                        ServerFrame::Admin { outcome: ServiceAdminOutcome::Locked }
                    }
                    ClientFrame::Command { id, command } => ServerFrame::CommandResult {
                        id,
                        result: hub.accept_command(*command, unlocked),
                    },
                    ClientFrame::Unlock { password } => {
                        let gate = hub.clone();
                        let outcome = blocking(move || {
                            gate.admin.unlock(password.expose(), chrono::Utc::now())
                        })
                        .await;
                        if matches!(outcome, ServiceAdminOutcome::Unlocked { .. }) {
                            unlocked_until = Some(Instant::now() + hub.config.admin_session);
                        }
                        ServerFrame::Admin { outcome }
                    }
                    ClientFrame::SetPassword { password } => {
                        let gate = hub.clone();
                        let outcome = blocking(move || {
                            gate.admin.set_password(password.expose(), unlocked)
                        })
                        .await;
                        if matches!(outcome, ServiceAdminOutcome::PasswordSet { .. }) {
                            unlocked_until = Some(Instant::now() + hub.config.admin_session);
                        }
                        ServerFrame::Admin { outcome }
                    }
                };
                // Through the same queue as the events: taken under the
                // lock of the fan-out, the answer has its place in the
                // stream and is written by the branch above, in order.
                let line: Arc<str> = serde_json::to_string(&reply)
                    .map_err(FrameError::from)?
                    .into();
                if let Err(line) = hub.queue_reply(id, line) {
                    frame::write_line(&mut writer, &line).await?;
                }
            }
        }
    }
    debug!("Service channel: interface {} disconnected", id);
    Ok(())
}

/// Run a password check off the async threads (Argon2 is slow on purpose).
async fn blocking(
    check: impl FnOnce() -> ServiceAdminOutcome + Send + 'static,
) -> ServiceAdminOutcome {
    tokio::task::spawn_blocking(check)
        .await
        .unwrap_or_else(|_| ServiceAdminOutcome::Refused {
            message: "Le service n'a pas pu vérifier le mot de passe.".to_string(),
        })
}

/// Tell the interface why it is disconnected, then end the connection.
async fn refuse<W: AsyncWrite + Unpin>(writer: &mut W, message: &str) -> Result<(), FrameError> {
    warn!("Service channel: connection refused ({})", message);
    let frame = ServerFrame::Error {
        message: message.to_string(),
    };
    // Bounded: a peer that does not read must not hold the task.
    let _ = tokio::time::timeout(Duration::from_secs(2), frame::write_frame(writer, &frame)).await;
    Ok(())
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::gui_ipc::MemoryStore;
    use agent_gui::dto::GuiNotification;
    use agent_gui::events::Secret;
    use tokio::io::{AsyncWriteExt, DuplexStream, ReadHalf, WriteHalf};

    pub(crate) const PASSWORD: &str = "correct horse battery";

    /// The routing used by the tests: the assistant stays in the interface.
    pub(crate) fn accepts(command: &GuiCommand) -> bool {
        !matches!(command, GuiCommand::LlmCancel | GuiCommand::Shutdown)
    }

    pub(crate) fn hub_with(
        config: HubConfig,
    ) -> (
        Arc<Hub>,
        std::sync::mpsc::Receiver<GuiCommand>,
        Arc<MemoryStore>,
    ) {
        let store = Arc::new(MemoryStore::default());
        let (commands, received) = std::sync::mpsc::channel();
        let hub = Arc::new(Hub::new(config, store.clone(), commands));
        (hub, received, store)
    }

    pub(crate) fn hub() -> (
        Arc<Hub>,
        std::sync::mpsc::Receiver<GuiCommand>,
        Arc<MemoryStore>,
    ) {
        hub_with(HubConfig::new("9.9.9", accepts))
    }

    fn sync_status(pending_count: u32) -> AgentEvent {
        AgentEvent::SyncStatus {
            syncing: false,
            pending_count,
            last_sync_at: None,
            error: None,
        }
    }

    fn notification(title: &str) -> AgentEvent {
        AgentEvent::Notification {
            notification: GuiNotification::info(title, "corps"),
        }
    }

    /// A raw interface: writes lines, reads frames.
    struct Peer {
        reader: FrameReader<BufReader<ReadHalf<DuplexStream>>>,
        writer: WriteHalf<DuplexStream>,
    }

    impl Peer {
        fn connect(hub: &Arc<Hub>) -> Self {
            let (near, far) = tokio::io::duplex(64 * 1024);
            let hub = hub.clone();
            tokio::spawn(async move {
                let _ = serve_connection(hub, far).await;
            });
            let (read_half, writer) = tokio::io::split(near);
            Self {
                reader: FrameReader::new(BufReader::new(read_half), MAX_SERVER_FRAME_BYTES),
                writer,
            }
        }

        async fn send(&mut self, frame: &ClientFrame) {
            frame::write_frame(&mut self.writer, frame).await.unwrap();
        }

        /// The next frame; `None` once the service closed the connection.
        async fn recv(&mut self) -> Option<ServerFrame> {
            let next = tokio::time::timeout(Duration::from_secs(5), self.reader.next())
                .await
                .expect("the service answers");
            match next {
                Ok(Some(bytes)) => Some(serde_json::from_slice(bytes).expect("a server frame")),
                _ => None,
            }
        }

        async fn hello(hub: &Arc<Hub>, resume: Option<Resume>) -> (Self, u64) {
            let mut peer = Self::connect(hub);
            peer.send(&ClientFrame::Hello {
                version: PROTOCOL_VERSION,
                resume,
            })
            .await;
            match peer.recv().await {
                Some(ServerFrame::Hello {
                    version, instance, ..
                }) => {
                    assert_eq!(version, PROTOCOL_VERSION);
                    (peer, instance)
                }
                other => panic!("expected hello, got {other:?}"),
            }
        }

        async fn command(&mut self, id: u64, command: GuiCommand) -> CommandResult {
            self.send(&ClientFrame::Command {
                id,
                command: Box::new(command),
            })
            .await;
            loop {
                match self.recv().await {
                    Some(ServerFrame::CommandResult { id: got, result }) if got == id => {
                        return result;
                    }
                    Some(ServerFrame::Event { .. }) => continue,
                    other => panic!("expected the result of {id}, got {other:?}"),
                }
            }
        }

        async fn admin(&mut self, frame: ClientFrame) -> ServiceAdminOutcome {
            self.send(&frame).await;
            loop {
                match self.recv().await {
                    Some(ServerFrame::Admin { outcome }) => return outcome,
                    Some(ServerFrame::Event { .. }) => continue,
                    other => panic!("expected an administrator answer, got {other:?}"),
                }
            }
        }

        /// The events queued so far, ended by a ping answered in order.
        async fn events(&mut self) -> Vec<(u64, AgentEvent)> {
            self.send(&ClientFrame::Ping).await;
            let mut events = Vec::new();
            loop {
                match self.recv().await {
                    Some(ServerFrame::Event { seq, event }) => events.push((seq, *event)),
                    Some(ServerFrame::Pong) => return events,
                    Some(ServerFrame::Lagged { .. }) => continue,
                    other => panic!("unexpected frame: {other:?}"),
                }
            }
        }
    }

    fn unlock(password: &str) -> ClientFrame {
        ClientFrame::Unlock {
            password: Secret::new(password),
        }
    }

    // ── protocol ──

    #[tokio::test]
    async fn another_protocol_version_is_refused_with_the_reason() {
        let (hub, _commands, _store) = hub();
        let mut peer = Peer::connect(&hub);
        peer.send(&ClientFrame::Hello {
            version: PROTOCOL_VERSION + 1,
            resume: None,
        })
        .await;
        assert!(matches!(peer.recv().await, Some(ServerFrame::Error { .. })));
        assert!(peer.recv().await.is_none(), "connection closed");
        assert_eq!(hub.client_count(), 0);
    }

    #[tokio::test]
    async fn a_command_before_hello_closes_the_connection() {
        let (hub, commands, _store) = hub();
        let mut peer = Peer::connect(&hub);
        peer.send(&ClientFrame::Command {
            id: 1,
            command: Box::new(GuiCommand::RunCheck),
        })
        .await;
        assert!(matches!(peer.recv().await, Some(ServerFrame::Error { .. })));
        assert!(peer.recv().await.is_none());
        assert!(commands.try_recv().is_err(), "nothing reached the agent");
    }

    #[tokio::test]
    async fn an_unknown_or_oversized_frame_closes_the_connection() {
        let (hub, commands, _store) = hub();

        let (mut peer, _) = Peer::hello(&hub, None).await;
        peer.writer
            .write_all(b"{\"t\":\"format_disk\"}\n")
            .await
            .unwrap();
        assert!(matches!(peer.recv().await, Some(ServerFrame::Error { .. })));
        assert!(peer.recv().await.is_none());

        let (mut peer, _) = Peer::hello(&hub, None).await;
        let huge = vec![b'x'; MAX_CLIENT_FRAME_BYTES + 16];
        let _ = peer.writer.write_all(&huge).await;
        assert!(matches!(peer.recv().await, Some(ServerFrame::Error { .. })));
        assert!(peer.recv().await.is_none());

        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(hub.client_count(), 0, "closed connections are forgotten");
        assert!(commands.try_recv().is_err());
    }

    // ── snapshot and fan-out ──

    #[tokio::test]
    async fn an_interface_that_connects_is_replayed_the_current_state() {
        let (hub, _commands, _store) = hub();
        hub.publish(&sync_status(1));
        hub.publish(&notification("première"));
        hub.publish(&sync_status(2));
        hub.publish(&AgentEvent::DiscoveryFailed {
            reason: "transitoire".into(),
        });
        hub.publish(&AgentEvent::AdminPasswordSet {
            hash: "$argon2id$secret".into(),
        });
        hub.publish(&notification("seconde"));

        let (mut peer, _) = Peer::hello(&hub, None).await;
        let events = peer.events().await;
        let seqs: Vec<u64> = events.iter().map(|(seq, _)| *seq).collect();
        assert!(seqs.windows(2).all(|w| w[0] < w[1]), "in order: {seqs:?}");
        assert_eq!(events.len(), 3, "one state, two alerts: {events:?}");
        assert!(matches!(
            &events[0].1,
            AgentEvent::Notification { notification } if notification.title == "première"
        ));
        assert!(matches!(
            events[1].1,
            AgentEvent::SyncStatus {
                pending_count: 2,
                ..
            }
        ));
        assert!(matches!(
            &events[2].1,
            AgentEvent::Notification { notification } if notification.title == "seconde"
        ));

        // Then the events flow as they happen, to every interface.
        let (mut other, _) = Peer::hello(&hub, None).await;
        other.events().await;
        hub.publish(&sync_status(3));
        for peer in [&mut peer, &mut other] {
            let live = peer.events().await;
            assert!(matches!(
                live.as_slice(),
                [(
                    _,
                    AgentEvent::SyncStatus {
                        pending_count: 3,
                        ..
                    }
                )]
            ));
        }
    }

    /// Connecting takes the snapshot and joins the fan-out under one lock:
    /// whatever is published while interfaces connect, each of them ends
    /// with the latest state, in order, and an answer never overtakes an
    /// event published before it was asked for.
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn publishes_racing_connections_leave_every_interface_up_to_date() {
        const PUBLISHED: u32 = 2_000;
        const INTERFACES: usize = 24;
        let (hub, _commands, _store) = hub();

        let publisher = {
            let hub = hub.clone();
            std::thread::spawn(move || {
                // Start once an interface is there, and take long enough
                // for the others to connect in the middle of the stream.
                while hub.client_count() == 0 {
                    std::thread::yield_now();
                }
                for n in 0..PUBLISHED {
                    hub.publish(&sync_status(n));
                    if n % 8 == 0 {
                        std::thread::sleep(Duration::from_micros(20));
                    }
                }
            })
        };
        let mut connecting = Vec::new();
        for _ in 0..INTERFACES {
            let hub = hub.clone();
            connecting.push(tokio::spawn(async move {
                let (mut peer, _) = Peer::hello(&hub, None).await;
                let early = peer.events().await;
                (peer, early)
            }));
            tokio::task::yield_now().await;
        }
        let mut peers = Vec::new();
        for task in connecting {
            peers.push(task.await.expect("the interface connected"));
        }
        publisher.join().expect("the publisher ended");

        for (mut peer, early) in peers {
            // Published before this ping, so before its answer.
            let mut events = early;
            events.extend(peer.events().await);
            let seqs: Vec<u64> = events.iter().map(|(seq, _)| *seq).collect();
            assert!(
                seqs.windows(2).all(|w| w[0] < w[1]),
                "no event repeated or out of order"
            );
            assert!(
                matches!(
                    events.last(),
                    Some((
                        _,
                        AgentEvent::SyncStatus { pending_count, .. }
                    )) if *pending_count == PUBLISHED - 1
                ),
                "ends with the latest state, got {:?}",
                events.last()
            );
            // Nothing is missing after the first event it received.
            assert_eq!(
                seqs.last().unwrap() - seqs.first().unwrap() + 1,
                seqs.len() as u64,
                "a gap in the stream"
            );
        }
    }

    #[tokio::test]
    async fn an_answer_never_overtakes_an_event_published_before_it() {
        let (hub, _commands, _store) = hub();
        let (mut peer, _) = Peer::hello(&hub, None).await;
        for round in 0..500 {
            hub.publish(&sync_status(round));
            // Asked after the publish: the event must come first.
            let events = peer.events().await;
            assert!(
                matches!(
                    events.as_slice(),
                    [(_, AgentEvent::SyncStatus { pending_count, .. })] if *pending_count == round
                ),
                "round {round}: {events:?}"
            );
        }
    }

    #[tokio::test]
    async fn an_interface_that_reconnects_is_not_replayed_the_alerts_it_has() {
        let (hub, _commands, _store) = hub();
        hub.publish(&notification("déjà vue"));
        hub.publish(&sync_status(1));
        let (mut peer, instance) = Peer::hello(&hub, None).await;
        let last_seq = peer.events().await.last().expect("snapshot").0;
        drop(peer);

        hub.publish(&notification("nouvelle"));
        let resume = Some(Resume { instance, last_seq });
        let (mut peer, _) = Peer::hello(&hub, resume).await;
        let events = peer.events().await;
        let titles: Vec<&str> = events
            .iter()
            .filter_map(|(_, event)| match event {
                AgentEvent::Notification { notification } => Some(notification.title.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(titles, ["nouvelle"]);
        assert!(
            events
                .iter()
                .any(|(_, event)| matches!(event, AgentEvent::SyncStatus { .. })),
            "states are replayed again: they are idempotent"
        );

        // Another service instance: everything is new to the interface.
        let stale = Some(Resume {
            instance: instance.wrapping_add(2),
            last_seq,
        });
        let (mut peer, _) = Peer::hello(&hub, stale).await;
        assert_eq!(peer.events().await.len(), 3);
    }

    #[tokio::test]
    async fn a_slow_interface_never_blocks_the_agent_and_catches_up_from_the_snapshot() {
        let mut config = HubConfig::new("9.9.9", accepts);
        config.client_queue = 8;
        let (hub, _commands, _store) = hub_with(config);
        let (mut peer, _) = Peer::hello(&hub, None).await;

        // Nobody reads: publishing must return at once, thousands of times.
        let started = Instant::now();
        for n in 0..5_000 {
            hub.publish(&sync_status(n));
            hub.publish(&AgentEvent::DiscoveryFailed {
                reason: "bruit".into(),
            });
        }
        assert!(started.elapsed() < Duration::from_secs(5));
        assert_eq!(hub.client_count(), 1, "the slow interface is kept");

        // It reads again: told it lagged, then given the latest state.
        let mut lagged = false;
        let mut last_pending = None;
        let deadline = Instant::now() + Duration::from_secs(5);
        while last_pending != Some(9_999) {
            assert!(Instant::now() < deadline, "never caught up");
            match tokio::time::timeout(Duration::from_millis(50), peer.reader.next()).await {
                Ok(Ok(Some(bytes))) => match serde_json::from_slice(bytes).unwrap() {
                    ServerFrame::Lagged { dropped } => {
                        assert!(dropped > 0);
                        lagged = true;
                    }
                    ServerFrame::Event { event, .. } => {
                        if let AgentEvent::SyncStatus { pending_count, .. } = *event {
                            last_pending = Some(pending_count);
                        }
                    }
                    other => panic!("unexpected frame: {other:?}"),
                },
                // Queue drained: the next event triggers the resync.
                _ => hub.publish(&sync_status(9_999)),
            }
        }
        assert!(lagged, "the interface is told that events were dropped");
    }

    // ── commands and the administrator mode ──

    #[tokio::test]
    async fn an_open_command_reaches_the_agent_and_a_local_one_is_refused() {
        let (hub, commands, _store) = hub();
        let (mut peer, _) = Peer::hello(&hub, None).await;
        assert_eq!(
            peer.command(1, GuiCommand::RunCheck).await,
            CommandResult::Accepted
        );
        assert!(matches!(commands.try_recv(), Ok(GuiCommand::RunCheck)));
        assert_eq!(
            peer.command(2, GuiCommand::LlmCancel).await,
            CommandResult::LocalOnly
        );
        // Stopping the service is never an interface's call.
        assert_eq!(
            peer.command(3, GuiCommand::Shutdown).await,
            CommandResult::LocalOnly
        );
        assert!(commands.try_recv().is_err());
    }

    #[tokio::test]
    async fn a_gated_command_is_refused_until_the_connection_unlocks() {
        let (hub, commands, _store) = hub();
        let (mut peer, _) = Peer::hello(&hub, None).await;

        // No password exists: nothing unlocks, the command stays refused.
        assert!(matches!(
            peer.command(1, GuiCommand::Pause).await,
            CommandResult::AdminRequired { .. }
        ));
        assert_eq!(
            peer.admin(unlock(PASSWORD)).await,
            ServiceAdminOutcome::NotConfigured
        );
        assert!(commands.try_recv().is_err());

        // First password: stored by the service, the connection unlocks.
        assert!(matches!(
            peer.admin(ClientFrame::SetPassword {
                password: Secret::new(PASSWORD)
            })
            .await,
            ServiceAdminOutcome::PasswordSet { .. }
        ));
        assert_eq!(
            peer.command(2, GuiCommand::Pause).await,
            CommandResult::Accepted
        );
        assert!(matches!(commands.try_recv(), Ok(GuiCommand::Pause)));

        // Locked again on request.
        assert_eq!(
            peer.admin(ClientFrame::Lock).await,
            ServiceAdminOutcome::Locked
        );
        assert!(matches!(
            peer.command(3, GuiCommand::Pause).await,
            CommandResult::AdminRequired { .. }
        ));

        // The unlock belongs to the connection that sent the password.
        let (mut other, _) = Peer::hello(&hub, None).await;
        assert!(matches!(
            peer.admin(unlock(PASSWORD)).await,
            ServiceAdminOutcome::Unlocked { .. }
        ));
        assert!(matches!(
            other.command(1, GuiCommand::Pause).await,
            CommandResult::AdminRequired { .. }
        ));
        // A command the interface considers protective runs as SYSTEM here.
        assert!(matches!(
            other
                .command(2, GuiCommand::IsolateHost { duration_secs: 0 })
                .await,
            CommandResult::AdminRequired { .. }
        ));
        assert_eq!(
            peer.command(4, GuiCommand::ReleaseHost).await,
            CommandResult::Accepted
        );
        assert!(matches!(commands.try_recv(), Ok(GuiCommand::ReleaseHost)));
        assert!(commands.try_recv().is_err());
    }

    #[tokio::test]
    async fn wrong_passwords_lock_the_service_out_for_every_connection() {
        let (hub, commands, _store) = hub();
        let (mut peer, _) = Peer::hello(&hub, None).await;
        peer.admin(ClientFrame::SetPassword {
            password: Secret::new(PASSWORD),
        })
        .await;
        peer.admin(ClientFrame::Lock).await;

        let mut last = ServiceAdminOutcome::Locked;
        for _ in 0..agent_gui::admin_auth::ATTEMPTS_BEFORE_LOCKOUT {
            last = peer.admin(unlock("wrong password here")).await;
        }
        assert!(
            matches!(last, ServiceAdminOutcome::LockedOut { .. }),
            "{last:?}"
        );

        // Reconnecting does not reset the counter, and the right password
        // is not even evaluated during the lockout.
        let (mut other, _) = Peer::hello(&hub, None).await;
        assert!(matches!(
            other.admin(unlock(PASSWORD)).await,
            ServiceAdminOutcome::LockedOut { .. }
        ));
        assert!(matches!(
            other.command(1, GuiCommand::Pause).await,
            CommandResult::AdminRequired { .. }
        ));
        assert!(commands.try_recv().is_err());
    }

    #[tokio::test]
    async fn the_administrator_mode_of_a_connection_ends_by_itself() {
        let mut config = HubConfig::new("9.9.9", accepts);
        config.admin_session = Duration::from_millis(40);
        let (hub, commands, _store) = hub_with(config);
        let (mut peer, _) = Peer::hello(&hub, None).await;
        peer.admin(ClientFrame::SetPassword {
            password: Secret::new(PASSWORD),
        })
        .await;
        tokio::time::sleep(Duration::from_millis(80)).await;
        assert!(matches!(
            peer.command(1, GuiCommand::Pause).await,
            CommandResult::AdminRequired { .. }
        ));
        assert!(commands.try_recv().is_err());
    }

    #[tokio::test]
    async fn accepted_settings_are_applied_again_when_the_service_restarts() {
        let (hub, commands, store) = hub();
        let (mut peer, _) = Peer::hello(&hub, None).await;
        peer.admin(ClientFrame::SetPassword {
            password: Secret::new(PASSWORD),
        })
        .await;
        for level in [1, 3] {
            assert_eq!(
                peer.command(u64::from(level), GuiCommand::SetLogLevel { level })
                    .await,
                CommandResult::Accepted
            );
        }
        // Refused, so not journaled either.
        peer.admin(ClientFrame::Lock).await;
        peer.command(9, GuiCommand::SetLogLevel { level: 0 }).await;
        while commands.try_recv().is_ok() {}

        let (restarted_commands, received) = std::sync::mpsc::channel();
        let restarted = Hub::new(HubConfig::new("9.9.9", accepts), store, restarted_commands);
        assert_eq!(restarted.restore_settings(), 1);
        assert!(matches!(
            received.try_recv(),
            Ok(GuiCommand::SetLogLevel { level: 3 })
        ));
        assert!(received.try_recv().is_err());
    }
}
