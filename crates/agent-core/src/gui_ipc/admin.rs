// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The administrator password as the service knows it.
//!
//! The interface used to check the password itself, against a hash in the
//! user's own preferences: good enough while the agent ran inside the
//! interface, worthless once commands cross a process boundary. The service
//! keeps its own hash and its own lockout, in a store user processes cannot
//! write, and checks every attempt here.

use std::sync::{Arc, Mutex};

use agent_gui::admin_auth::{self, ATTEMPTS_BEFORE_LOCKOUT, Lockout, Verification};
use agent_gui::events::ServiceAdminOutcome;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

/// How long a connection stays in administrator mode after an unlock: the
/// length of the interface's own administrator session.
pub const ADMIN_SESSION_SECS: u64 = 5 * 60;

/// Named values kept where only the service and administrators can write.
pub trait SecureStore: Send + Sync {
    /// The value stored under `name`, if any.
    fn read(&self, name: &str) -> Option<String>;
    /// Replace the value stored under `name`.
    fn write(&self, name: &str, value: &str) -> std::io::Result<()>;
}

/// A store that lives in memory: tests, and systems without a service.
#[derive(Default)]
pub struct MemoryStore(Mutex<std::collections::HashMap<String, String>>);

impl SecureStore for MemoryStore {
    fn read(&self, name: &str) -> Option<String> {
        self.0.lock().ok()?.get(name).cloned()
    }

    fn write(&self, name: &str, value: &str) -> std::io::Result<()> {
        self.0
            .lock()
            .map_err(|_| std::io::Error::other("store poisoned"))?
            .insert(name.to_string(), value.to_string());
        Ok(())
    }
}

/// Name of the administrator record in the store.
const RECORD: &str = "admin_auth";

/// What is stored: the Argon2id hash and the failed-attempt counter, so
/// restarting the service does not reset a lockout.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct AdminRecord {
    hash: String,
    lockout: Lockout,
}

/// Checks administrator passwords for the service.
pub struct AdminGate {
    store: Arc<dyn SecureStore>,
    /// Held during a verification: attempts are evaluated one at a time.
    record: Mutex<AdminRecord>,
}

impl AdminGate {
    /// Load the record from `store` (empty when there is none yet).
    pub fn load(store: Arc<dyn SecureStore>) -> Self {
        let record = store
            .read(RECORD)
            .and_then(|json| match serde_json::from_str(&json) {
                Ok(record) => Some(record),
                Err(e) => {
                    warn!("Stored administrator record is unreadable: {}", e);
                    None
                }
            })
            .unwrap_or_default();
        Self {
            store,
            record: Mutex::new(record),
        }
    }

    fn record(&self) -> std::sync::MutexGuard<'_, AdminRecord> {
        self.record
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn save(&self, record: &AdminRecord) -> std::io::Result<()> {
        let json = serde_json::to_string(record).map_err(std::io::Error::other)?;
        self.store.write(RECORD, &json)
    }

    /// Whether an administrator password exists.
    pub fn is_configured(&self) -> bool {
        !self.record().hash.is_empty()
    }

    /// Evaluate an unlock attempt at `now`. Hashing takes tens of
    /// milliseconds: call it from a blocking task.
    pub fn unlock(&self, password: &str, now: DateTime<Utc>) -> ServiceAdminOutcome {
        let mut record = self.record();
        if record.hash.is_empty() {
            return ServiceAdminOutcome::NotConfigured;
        }
        if let Some(remaining) = record.lockout.remaining(now) {
            return ServiceAdminOutcome::LockedOut {
                retry_after_secs: remaining.num_seconds().max(1) as u64,
            };
        }
        match admin_auth::verify_password(password, &record.hash) {
            Verification::Accepted { rehash } => {
                record.lockout.record_success();
                if rehash {
                    // Replace a digest written by an earlier version.
                    match admin_auth::hash_password(password) {
                        Ok(hash) => record.hash = hash,
                        Err(e) => warn!("Administrator password re-hash failed: {}", e),
                    }
                }
                if let Err(e) = self.save(&record) {
                    warn!("Administrator record not saved: {}", e);
                }
                info!("[AUDIT] Administrator mode opened over the service channel");
                ServiceAdminOutcome::Unlocked {
                    session_secs: ADMIN_SESSION_SECS,
                }
            }
            Verification::Rejected | Verification::NotConfigured => {
                record.lockout.record_failure(now);
                if let Err(e) = self.save(&record) {
                    warn!("Administrator record not saved: {}", e);
                }
                warn!(
                    "[AUDIT] Failed administrator unlock over the service channel ({} consecutive)",
                    record.lockout.failures
                );
                match record.lockout.remaining(now) {
                    Some(remaining) => ServiceAdminOutcome::LockedOut {
                        retry_after_secs: remaining.num_seconds().max(1) as u64,
                    },
                    None => ServiceAdminOutcome::Rejected {
                        attempts_left: ATTEMPTS_BEFORE_LOCKOUT
                            .saturating_sub(record.lockout.failures),
                    },
                }
            }
        }
    }

    /// Store a new password. Allowed when none exists yet (the first one,
    /// as in the interface) or from a connection in administrator mode.
    pub fn set_password(&self, password: &str, connection_unlocked: bool) -> ServiceAdminOutcome {
        let mut record = self.record();
        if !record.hash.is_empty() && !connection_unlocked {
            return ServiceAdminOutcome::Refused {
                message: "Le mode administrateur est requis pour changer le mot de passe."
                    .to_string(),
            };
        }
        if let Err(issue) = admin_auth::check_new_password(password, password) {
            return ServiceAdminOutcome::Refused {
                message: issue.message(),
            };
        }
        let hash = match admin_auth::hash_password(password) {
            Ok(hash) => hash,
            Err(message) => return ServiceAdminOutcome::Refused { message },
        };
        let updated = AdminRecord {
            hash,
            lockout: Lockout::default(),
        };
        // Stored first: a password that would be forgotten at the next
        // start of the service is not a password.
        if let Err(e) = self.save(&updated) {
            warn!("Administrator password not stored: {}", e);
            return ServiceAdminOutcome::Refused {
                message: "Le service n'a pas pu enregistrer le mot de passe.".to_string(),
            };
        }
        *record = updated;
        info!("[AUDIT] Administrator password set over the service channel");
        ServiceAdminOutcome::PasswordSet {
            session_secs: ADMIN_SESSION_SECS,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    const PASSWORD: &str = "correct horse battery";

    fn configured() -> (AdminGate, Arc<MemoryStore>) {
        let store = Arc::new(MemoryStore::default());
        let gate = AdminGate::load(store.clone());
        assert!(!gate.is_configured());
        assert_eq!(
            gate.set_password(PASSWORD, false),
            ServiceAdminOutcome::PasswordSet {
                session_secs: ADMIN_SESSION_SECS
            }
        );
        (gate, store)
    }

    #[test]
    fn nothing_unlocks_without_a_password_and_only_the_right_one_does() {
        let gate = AdminGate::load(Arc::new(MemoryStore::default()));
        let now = Utc::now();
        assert_eq!(gate.unlock("", now), ServiceAdminOutcome::NotConfigured);
        assert_eq!(
            gate.unlock(PASSWORD, now),
            ServiceAdminOutcome::NotConfigured
        );

        let (gate, _store) = configured();
        assert_eq!(
            gate.unlock("wrong password here", now),
            ServiceAdminOutcome::Rejected {
                attempts_left: ATTEMPTS_BEFORE_LOCKOUT - 1
            }
        );
        assert!(matches!(
            gate.unlock(PASSWORD, now),
            ServiceAdminOutcome::Unlocked { .. }
        ));
    }

    #[test]
    fn repeated_failures_lock_out_even_the_right_password_until_the_delay_passes() {
        let (gate, store) = configured();
        let now = Utc::now();
        let mut last = ServiceAdminOutcome::Locked;
        for _ in 0..ATTEMPTS_BEFORE_LOCKOUT {
            last = gate.unlock("wrong password here", now);
        }
        assert!(
            matches!(last, ServiceAdminOutcome::LockedOut { .. }),
            "{last:?}"
        );
        assert!(matches!(
            gate.unlock(PASSWORD, now),
            ServiceAdminOutcome::LockedOut { .. }
        ));

        // The lockout is stored: a restarted service still enforces it.
        let restarted = AdminGate::load(store);
        assert!(matches!(
            restarted.unlock(PASSWORD, now),
            ServiceAdminOutcome::LockedOut { .. }
        ));
        assert!(matches!(
            restarted.unlock(PASSWORD, now + Duration::hours(1)),
            ServiceAdminOutcome::Unlocked { .. }
        ));
    }

    #[test]
    fn changing_the_password_needs_the_administrator_mode_and_a_sound_password() {
        let (gate, _store) = configured();
        assert!(matches!(
            gate.set_password("another solid passphrase", false),
            ServiceAdminOutcome::Refused { .. }
        ));
        assert!(matches!(
            gate.set_password("short", true),
            ServiceAdminOutcome::Refused { .. }
        ));
        assert!(matches!(
            gate.set_password("another solid passphrase", true),
            ServiceAdminOutcome::PasswordSet { .. }
        ));
        let now = Utc::now();
        assert!(matches!(
            gate.unlock(PASSWORD, now),
            ServiceAdminOutcome::Rejected { .. }
        ));
        assert!(matches!(
            gate.unlock("another solid passphrase", now),
            ServiceAdminOutcome::Unlocked { .. }
        ));
    }

    #[test]
    fn a_store_that_refuses_the_write_refuses_the_password() {
        struct ReadOnly;
        impl SecureStore for ReadOnly {
            fn read(&self, _: &str) -> Option<String> {
                None
            }
            fn write(&self, _: &str, _: &str) -> std::io::Result<()> {
                Err(std::io::Error::other("read-only"))
            }
        }
        let gate = AdminGate::load(Arc::new(ReadOnly));
        assert!(matches!(
            gate.set_password(PASSWORD, false),
            ServiceAdminOutcome::Refused { .. }
        ));
        assert!(!gate.is_configured());
    }
}
