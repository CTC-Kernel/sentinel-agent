// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Channel between the background service and the desktop interface.
//!
//! On Windows the agent runs as the `SentinelGRCAgent` service (SYSTEM) and
//! the desktop application is only its interface: it must not start a second
//! agent. This module carries the interface's [`GuiCommand`]s to the service
//! and the service's [`AgentEvent`]s back, over one duplex byte stream.
//!
//! # Protocol
//!
//! Newline-delimited JSON, one [`frame::ClientFrame`] or
//! [`frame::ServerFrame`] per line, UTF-8.
//!
//! 1. The interface sends `hello` with [`frame::PROTOCOL_VERSION`] and, on a
//!    reconnection, the last event it received.
//! 2. The service answers `hello`, then replays its snapshot: the latest
//!    event of every state-carrying kind, and the recent alerts the
//!    interface has not seen yet ([`policy::replay`]).
//! 3. Events then flow as they happen. Commands, administrator requests and
//!    their answers travel as their own frames.
//!
//! A frame that is too large, is not valid JSON or is not a known frame
//! closes the connection.
//!
//! # Privilege boundary
//!
//! The service runs as SYSTEM and takes commands from user processes. It
//! therefore decides by itself, whatever the interface checked:
//!
//! * which commands it runs at all (the others belong to the interface's
//!   own session: assistant, voice, file exports);
//! * which commands need the administrator mode ([`policy::admin_reason`]:
//!   everything that is not on an explicit list of harmless requests);
//! * whether a connection is in administrator mode: only after it sent the
//!   administrator password, checked here against the hash the service
//!   keeps in a store user processes cannot write ([`admin::AdminGate`]),
//!   with the lockout of [`agent_gui::admin_auth`], and for a bounded time.
//!
//! # Back-pressure
//!
//! The agent never waits for an interface. Each connection has a bounded
//! queue; when it is full the events are dropped for that connection, which
//! is brought up to date from the snapshot as soon as it reads again.
//!
//! The transport is not chosen here: [`hub::serve_connection`] and
//! [`client::run`] work on any `AsyncRead + AsyncWrite` stream, which is how
//! they are tested on every system. [`pipe`] binds them to a Windows named
//! pipe.
//!
//! [`GuiCommand`]: agent_gui::events::GuiCommand
//! [`AgentEvent`]: agent_gui::events::AgentEvent

pub mod admin;
pub mod client;
pub mod frame;
pub mod hub;
#[cfg(windows)]
pub mod pipe;
pub mod policy;

pub use admin::{AdminGate, MemoryStore, SecureStore};
pub use client::{ClientHandle, Outbound};
pub use hub::{Hub, HubConfig, serve_connection};
