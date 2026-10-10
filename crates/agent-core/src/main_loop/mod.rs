// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The agent's main loop: [`AgentRuntime::run`](crate::AgentRuntime::run),
//! one stage at a time.

mod detection;
mod fim;
mod network;
mod pass;
mod siem;
mod startup;
mod state;
#[cfg(test)]
pub(crate) mod testing;

pub(crate) use pass::LoopPass;
pub(crate) use state::{CERT_CHECK_INTERVAL_SECS, LoopState};
