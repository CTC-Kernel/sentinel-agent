// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! A runtime the stage tests can run against: standalone (no platform to
//! reach), with its own encrypted database and the interface's event channel.

use std::sync::Arc;

use agent_common::config::AgentConfig;
use agent_storage::{Database, DatabaseConfig, KeyManager};

use crate::AgentRuntime;

pub(crate) struct TestRuntime {
    pub runtime: AgentRuntime,
    /// The runtime's database, for the tests that seed or read it.
    #[cfg_attr(not(feature = "gui"), allow(dead_code))]
    pub db: Arc<Database>,
    #[cfg(feature = "gui")]
    pub events: std::sync::mpsc::Receiver<agent_gui::events::AgentEvent>,
    _dir: tempfile::TempDir,
}

pub(crate) fn standalone_runtime() -> TestRuntime {
    let dir = tempfile::tempdir().expect("temporary directory");
    let db = Arc::new(
        Database::open(
            DatabaseConfig::with_path(dir.path().join("agent.db")),
            &KeyManager::new_with_key(&[7; 32]),
        )
        .expect("test database"),
    );
    let config = AgentConfig {
        standalone: true,
        ..AgentConfig::default()
    };
    #[cfg(not(feature = "gui"))]
    let runtime = AgentRuntime::new(config).with_database(Arc::clone(&db));
    #[cfg(feature = "gui")]
    let (runtime, events) = {
        let mut runtime = AgentRuntime::new(config).with_database(Arc::clone(&db));
        let (tx, events) = std::sync::mpsc::channel();
        runtime.set_gui_event_tx(tx);
        (runtime, events)
    };
    TestRuntime {
        runtime,
        db,
        #[cfg(feature = "gui")]
        events,
        _dir: dir,
    }
}
