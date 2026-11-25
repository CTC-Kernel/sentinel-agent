// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Frames of the service channel and their line codec.

use agent_gui::events::{AgentEvent, GuiCommand, Secret, ServiceAdminOutcome};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncWrite, AsyncWriteExt};

/// Version of the frames below. A peer that announces another one is told
/// so and disconnected: both ends ship in the same installer.
pub const PROTOCOL_VERSION: u32 = 1;

/// Largest frame the service reads from an interface (commands are small).
pub const MAX_CLIENT_FRAME_BYTES: usize = 1024 * 1024;

/// Largest frame the interface reads from the service (an event may carry
/// the whole software inventory).
pub const MAX_SERVER_FRAME_BYTES: usize = 32 * 1024 * 1024;

/// Where an interface that reconnects stopped reading.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Resume {
    /// The service instance it was connected to.
    pub instance: u64,
    /// Sequence number of the last event it received.
    pub last_seq: u64,
}

/// What the interface sends.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum ClientFrame {
    /// First frame of a connection.
    Hello {
        version: u32,
        #[serde(default)]
        resume: Option<Resume>,
    },
    /// A command for the agent; `id` comes back in the result.
    Command {
        id: u64,
        command: Box<GuiCommand>,
    },
    /// Open the administrator mode of this connection.
    Unlock {
        password: Secret,
    },
    /// Store a new administrator password.
    SetPassword {
        password: Secret,
    },
    /// Close the administrator mode of this connection.
    Lock,
    Ping,
}

/// What the service did with a command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum CommandResult {
    /// Handed to the agent's command handlers.
    Accepted,
    /// Refused: the connection is not in administrator mode.
    AdminRequired { reason: String },
    /// Refused: this command belongs to the interface's own session.
    LocalOnly,
}

/// What the service sends.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum ServerFrame {
    /// Answer to the interface's `hello`.
    Hello {
        version: u32,
        agent_version: String,
        /// Changes every time the service starts.
        instance: u64,
        /// The service holds an administrator password.
        admin_configured: bool,
    },
    /// An event of the agent, numbered in the order it was published.
    Event {
        seq: u64,
        event: Box<AgentEvent>,
    },
    CommandResult {
        id: u64,
        #[serde(flatten)]
        result: CommandResult,
    },
    /// Answer to `unlock`, `set_password` or `lock`.
    Admin {
        outcome: ServiceAdminOutcome,
    },
    /// Events were dropped because this connection read too slowly; the
    /// snapshot follows.
    Lagged {
        dropped: u64,
    },
    Pong,
    /// The connection is about to be closed, and why.
    Error {
        message: String,
    },
}

/// An event frame, serialized without taking the event.
#[derive(Serialize)]
struct EventLine<'a> {
    t: &'static str,
    seq: u64,
    event: &'a AgentEvent,
}

/// The line of an [`ServerFrame::Event`].
pub fn event_line(seq: u64, event: &AgentEvent) -> serde_json::Result<String> {
    serde_json::to_string(&EventLine {
        t: "event",
        seq,
        event,
    })
}

/// Why reading a frame failed.
#[derive(Debug, thiserror::Error)]
pub enum FrameError {
    #[error("frame larger than {0} bytes")]
    TooLarge(usize),
    #[error("stream ended in the middle of a frame")]
    Truncated,
    #[error("frame is not a known message: {0}")]
    Invalid(#[from] serde_json::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

/// Reads newline-delimited frames of at most `max` bytes.
///
/// [`FrameReader::next`] can be dropped at any await point and called again
/// (it is used inside `select!`): what was read so far is kept.
pub struct FrameReader<R> {
    reader: R,
    max: usize,
    buf: Vec<u8>,
    /// `buf` holds a frame that was already returned.
    consumed: bool,
}

impl<R: AsyncBufRead + Unpin> FrameReader<R> {
    pub fn new(reader: R, max: usize) -> Self {
        Self {
            reader,
            max,
            buf: Vec::new(),
            consumed: false,
        }
    }

    /// The next frame, without its newline; `None` at a clean end of stream.
    pub async fn next(&mut self) -> Result<Option<&[u8]>, FrameError> {
        if self.consumed {
            self.wipe();
        }
        loop {
            let available = self.reader.fill_buf().await?;
            if available.is_empty() {
                return if self.buf.is_empty() {
                    Ok(None)
                } else {
                    Err(FrameError::Truncated)
                };
            }
            let (chunk, found) = match available.iter().position(|b| *b == b'\n') {
                Some(pos) => (&available[..pos], true),
                None => (available, false),
            };
            if self.buf.len() + chunk.len() > self.max {
                return Err(FrameError::TooLarge(self.max));
            }
            self.buf.extend_from_slice(chunk);
            let used = chunk.len() + usize::from(found);
            self.reader.consume(used);
            if found {
                self.consumed = true;
                return Ok(Some(&self.buf));
            }
        }
    }

    /// Forget the last frame, overwriting it: it may have carried a secret.
    pub fn wipe(&mut self) {
        zeroize::Zeroize::zeroize(&mut self.buf);
        self.consumed = false;
    }
}

/// Write one frame line and flush it.
pub async fn write_line<W: AsyncWrite + Unpin>(writer: &mut W, line: &str) -> std::io::Result<()> {
    writer.write_all(line.as_bytes()).await?;
    writer.write_all(b"\n").await?;
    writer.flush().await
}

/// Serialize and write one frame.
pub async fn write_frame<W: AsyncWrite + Unpin, F: Serialize>(
    writer: &mut W,
    frame: &F,
) -> std::io::Result<()> {
    let mut line = serde_json::to_string(frame).map_err(std::io::Error::other)?;
    let result = write_line(writer, &line).await;
    // The line of an `unlock` frame holds the password.
    zeroize::Zeroize::zeroize(&mut line);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::BufReader;

    #[tokio::test]
    async fn frames_are_read_line_by_line_whatever_the_chunking() {
        let (mut tx, rx) = tokio::io::duplex(8);
        let writer = tokio::spawn(async move {
            // Smaller than a frame: the reader must assemble the chunks.
            tx.write_all(b"{\"t\":\"ping\"}\n{\"t\":\"lock\"}\n")
                .await
                .unwrap();
        });
        let mut reader = FrameReader::new(BufReader::new(rx), 64);
        let first: ClientFrame =
            serde_json::from_slice(reader.next().await.unwrap().unwrap()).unwrap();
        assert!(matches!(first, ClientFrame::Ping));
        let second: ClientFrame =
            serde_json::from_slice(reader.next().await.unwrap().unwrap()).unwrap();
        assert!(matches!(second, ClientFrame::Lock));
        writer.await.unwrap();
        assert!(
            reader.next().await.unwrap().is_none(),
            "clean end of stream"
        );
    }

    #[tokio::test]
    async fn an_oversized_frame_is_an_error_before_it_is_buffered() {
        let (mut tx, rx) = tokio::io::duplex(1024);
        tokio::spawn(async move {
            let _ = tx.write_all(&[b'x'; 300]).await;
        });
        let mut reader = FrameReader::new(BufReader::new(rx), 100);
        assert!(matches!(
            reader.next().await,
            Err(FrameError::TooLarge(100))
        ));
    }

    #[tokio::test]
    async fn a_stream_cut_inside_a_frame_is_reported() {
        let (mut tx, rx) = tokio::io::duplex(64);
        tx.write_all(b"{\"t\":").await.unwrap();
        drop(tx);
        let mut reader = FrameReader::new(BufReader::new(rx), 100);
        assert!(matches!(reader.next().await, Err(FrameError::Truncated)));
    }

    #[test]
    fn an_event_line_is_an_event_frame() {
        let event = AgentEvent::FimStats {
            monitored_count: 12,
            changes_today: 3,
        };
        let line = event_line(7, &event).unwrap();
        assert!(!line.contains('\n'));
        match serde_json::from_str::<ServerFrame>(&line).unwrap() {
            ServerFrame::Event { seq: 7, event } => assert!(matches!(
                *event,
                AgentEvent::FimStats {
                    monitored_count: 12,
                    changes_today: 3
                }
            )),
            other => panic!("unexpected frame: {other:?}"),
        }
    }

    #[test]
    fn frames_round_trip_and_never_print_a_password() {
        let frame = ClientFrame::Unlock {
            password: Secret::new("phrase de passe solide"),
        };
        assert!(!format!("{frame:?}").contains("phrase"));
        let line = serde_json::to_string(&frame).unwrap();
        assert!(matches!(
            serde_json::from_str::<ClientFrame>(&line).unwrap(),
            ClientFrame::Unlock { password } if password.expose() == "phrase de passe solide"
        ));

        let result = ServerFrame::CommandResult {
            id: 4,
            result: CommandResult::AdminRequired {
                reason: "Mettre en pause".into(),
            },
        };
        let line = serde_json::to_string(&result).unwrap();
        assert!(matches!(
            serde_json::from_str::<ServerFrame>(&line).unwrap(),
            ServerFrame::CommandResult {
                id: 4,
                result: CommandResult::AdminRequired { .. }
            }
        ));
        assert!(serde_json::from_str::<ClientFrame>("{\"t\":\"format_disk\"}").is_err());
    }
}
