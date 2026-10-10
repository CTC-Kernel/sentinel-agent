// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The agent's main loop: [`AgentRuntime::run`](crate::AgentRuntime::run),
//! one stage at a time.

mod state;

pub(crate) use state::{CERT_CHECK_INTERVAL_SECS, LoopState};
