// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Administrator password: policy, hashing, verification and lockout.
//!
//! The administrator password guards every change that weakens protection —
//! pausing the agent, disabling or deleting detection content, releasing an
//! isolated host, adding a webhook that receives security data. It is stored
//! as an Argon2id PHC string with a random per-install salt.
//!
//! Hashes written by versions up to 4.0.38 (SHA-256 with a salt shared by
//! every installation, or plain SHA-256) are still accepted so nobody is
//! locked out by an upgrade; [`Verification::Accepted::rehash`] tells the
//! caller to replace them with an Argon2id hash on that successful unlock.
//! No password is ever accepted when none is configured: there is no default.

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Minimum length, in characters, of a new administrator password.
pub const MIN_PASSWORD_CHARS: usize = 12;

/// Failed attempts tolerated before a lockout starts.
pub const ATTEMPTS_BEFORE_LOCKOUT: u32 = 5;
/// First lockout; it doubles with every further failure.
const LOCKOUT_BASE_SECS: i64 = 30;
/// Longest lockout.
const LOCKOUT_MAX_SECS: i64 = 15 * 60;

/// Salt that versions up to 4.0.38 shared across every installation.
const LEGACY_SHARED_SALT: &str = "sentinel-grc-v2-admin-salt-2026";
const LEGACY_SALTED_PREFIX: &str = "salted:";

/// Passwords refused whatever their length once trailing digits and
/// punctuation are removed ("Motdepasse2026!" is still "motdepasse").
const COMMON_BASES: &[&str] = &[
    "admin",
    "administrateur",
    "administrator",
    "azerty",
    "azertyuiop",
    "bienvenue",
    "changeme",
    "cybersecurite",
    "letmein",
    "motdepasse",
    "password",
    "qwerty",
    "qwertyuiop",
    "sentinel",
    "sentinelgrc",
    "soleil",
    "welcome",
];

/// Why a new password is refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PasswordIssue {
    /// Fewer than [`MIN_PASSWORD_CHARS`] characters.
    TooShort,
    /// A well-known password, a keyboard walk or a single repeated character.
    Guessable,
    /// The confirmation differs from the password.
    Mismatch,
}

impl PasswordIssue {
    /// Operator-facing explanation, in French.
    pub fn message(self) -> String {
        match self {
            Self::TooShort => format!(
                "Le mot de passe doit contenir au moins {MIN_PASSWORD_CHARS} caractères. \
                 Une phrase de passe de plusieurs mots convient très bien."
            ),
            Self::Guessable => "Ce mot de passe est trop courant ou trop prévisible.".to_string(),
            Self::Mismatch => "Les deux saisies ne correspondent pas.".to_string(),
        }
    }
}

/// Check a new password and its confirmation against the policy.
///
/// Characters are counted, not bytes, and nothing is trimmed: the password
/// is used exactly as typed.
pub fn check_new_password(password: &str, confirmation: &str) -> Result<(), PasswordIssue> {
    if password.chars().count() < MIN_PASSWORD_CHARS {
        return Err(PasswordIssue::TooShort);
    }
    if is_guessable(password) {
        return Err(PasswordIssue::Guessable);
    }
    if password != confirmation {
        return Err(PasswordIssue::Mismatch);
    }
    Ok(())
}

fn is_guessable(password: &str) -> bool {
    let lower = password.to_lowercase();
    let mut chars = lower.chars();
    if let Some(first) = chars.next()
        && chars.all(|c| c == first)
    {
        return true;
    }
    let base = lower.trim_end_matches(|c: char| c.is_ascii_digit() || c.is_ascii_punctuation());
    // Digits and punctuation alone ("123456789012"), or a common word with
    // a suffix bolted on.
    if base.is_empty() || COMMON_BASES.contains(&base) {
        return true;
    }
    // Digit or letter runs such as "123456789012" or "abcdefghijkl".
    let bytes = lower.as_bytes();
    bytes.len() >= 2 && bytes.windows(2).all(|w| w[1] == w[0].wrapping_add(1))
}

/// Strength meter: 0 (refused) to 4, for the bar under a new password.
pub fn strength(password: &str) -> u8 {
    let len = password.chars().count();
    if len < MIN_PASSWORD_CHARS || is_guessable(password) {
        return 0;
    }
    let classes = [
        password.chars().any(|c| c.is_lowercase()),
        password.chars().any(|c| c.is_uppercase()),
        password.chars().any(|c| c.is_ascii_digit()),
        password.chars().any(|c| !c.is_alphanumeric()),
    ]
    .iter()
    .filter(|present| **present)
    .count();
    match (len, classes) {
        (20.., _) | (16.., 3..) => 4,
        (16.., _) | (_, 3..) => 3,
        (_, 2) => 2,
        _ => 1,
    }
}

/// Argon2id at the OWASP minimum: 19 MiB, two passes, one lane.
fn argon2() -> Argon2<'static> {
    let params = Params::new(19 * 1024, 2, 1, None).expect("static Argon2 parameters are valid");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

/// Hash a password into an Argon2id PHC string with a fresh random salt.
pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    argon2()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| format!("hachage du mot de passe impossible : {e}"))
}

/// Outcome of a password attempt.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verification {
    /// No administrator password exists yet: nothing unlocks.
    NotConfigured,
    /// Wrong password, or a stored value that is not a known hash.
    Rejected,
    /// Correct password. `rehash` asks the caller to store a new Argon2id
    /// hash in place of a legacy one.
    Accepted { rehash: bool },
}

/// Check `attempt` against the stored hash.
pub fn verify_password(attempt: &str, stored: &str) -> Verification {
    if stored.is_empty() {
        return Verification::NotConfigured;
    }
    if stored.starts_with("$argon2") {
        // Parameters, salt and variant come from the PHC string itself.
        return match PasswordHash::new(stored) {
            Ok(parsed)
                if argon2()
                    .verify_password(attempt.as_bytes(), &parsed)
                    .is_ok() =>
            {
                Verification::Accepted { rehash: false }
            }
            _ => Verification::Rejected,
        };
    }

    let (salt, expected) = match stored.strip_prefix(LEGACY_SALTED_PREFIX) {
        Some(hex) => (LEGACY_SHARED_SALT, hex),
        None => ("", stored),
    };
    if expected.len() != 64 || !expected.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Verification::Rejected;
    }
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(attempt.as_bytes());
    let computed = format!("{:x}", hasher.finalize());
    if constant_time_eq(
        computed.as_bytes(),
        expected.to_ascii_lowercase().as_bytes(),
    ) {
        Verification::Accepted { rehash: true }
    } else {
        Verification::Rejected
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Failed-attempt counter with exponential lockout. Persisted with the GUI
/// preferences so restarting the application does not reset it.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Lockout {
    /// Consecutive failures since the last success.
    pub failures: u32,
    /// No attempt is evaluated before this instant.
    pub until: Option<DateTime<Utc>>,
}

impl Lockout {
    /// Time left before the next attempt is allowed, if any.
    pub fn remaining(&self, now: DateTime<Utc>) -> Option<Duration> {
        self.until
            .filter(|until| *until > now)
            .map(|until| until - now)
    }

    /// Count a failure and start a lockout once the allowance is spent.
    pub fn record_failure(&mut self, now: DateTime<Utc>) {
        self.failures = self.failures.saturating_add(1);
        if self.failures >= ATTEMPTS_BEFORE_LOCKOUT {
            let doublings = (self.failures - ATTEMPTS_BEFORE_LOCKOUT).min(16);
            let secs = (LOCKOUT_BASE_SECS << doublings).min(LOCKOUT_MAX_SECS);
            self.until = Some(now + Duration::seconds(secs));
        }
    }

    /// Clear the counter after a successful unlock.
    pub fn record_success(&mut self) {
        *self = Self::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn legacy_salted(password: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(LEGACY_SHARED_SALT.as_bytes());
        hasher.update(password.as_bytes());
        format!("{LEGACY_SALTED_PREFIX}{:x}", hasher.finalize())
    }

    #[test]
    fn no_password_is_accepted_when_none_is_configured() {
        assert_eq!(verify_password("admin", ""), Verification::NotConfigured);
        assert_eq!(verify_password("", ""), Verification::NotConfigured);
    }

    #[test]
    fn argon2id_round_trip_with_unique_salts() {
        let first = hash_password("correct horse battery").expect("hash");
        let second = hash_password("correct horse battery").expect("hash");
        assert!(first.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"));
        assert_ne!(first, second, "every hash carries its own salt");
        assert_eq!(
            verify_password("correct horse battery", &first),
            Verification::Accepted { rehash: false }
        );
        assert_eq!(
            verify_password("correct horse battery ", &first),
            Verification::Rejected,
            "the password is used exactly as typed"
        );
    }

    #[test]
    fn legacy_hashes_unlock_once_and_ask_for_a_rehash() {
        let salted = legacy_salted("ancien mot de passe");
        assert_eq!(
            verify_password("ancien mot de passe", &salted),
            Verification::Accepted { rehash: true }
        );
        assert_eq!(verify_password("autre", &salted), Verification::Rejected);

        let unsalted = format!("{:x}", Sha256::digest(b"ancien mot de passe"));
        assert_eq!(
            verify_password("ancien mot de passe", &unsalted),
            Verification::Accepted { rehash: true }
        );
    }

    #[test]
    fn unknown_stored_values_never_unlock() {
        for stored in ["admin", "salted:", "salted:zz", "$argon2id$broken", "0123"] {
            assert_eq!(
                verify_password("admin", stored),
                Verification::Rejected,
                "{stored}"
            );
        }
    }

    #[test]
    fn policy_counts_characters_and_refuses_guessable_passwords() {
        assert_eq!(
            check_new_password("éééééééééé1", "éééééééééé1"),
            Err(PasswordIssue::TooShort)
        );
        assert_eq!(
            check_new_password("Motdepasse2026!", "Motdepasse2026!"),
            Err(PasswordIssue::Guessable)
        );
        assert_eq!(
            check_new_password("aaaaaaaaaaaaaa", "aaaaaaaaaaaaaa"),
            Err(PasswordIssue::Guessable)
        );
        assert_eq!(
            check_new_password("123456789012", "123456789012"),
            Err(PasswordIssue::Guessable)
        );
        assert_eq!(
            check_new_password("trois chats gris", "trois chats gros"),
            Err(PasswordIssue::Mismatch)
        );
        assert_eq!(
            check_new_password("trois chats gris", "trois chats gris"),
            Ok(())
        );
        assert_eq!(
            check_new_password("  espaces  autour  ", "  espaces  autour  "),
            Ok(()),
            "nothing is trimmed"
        );
    }

    #[test]
    fn strength_grows_with_length_and_variety() {
        assert_eq!(strength("court"), 0);
        assert_eq!(strength("password12345"), 0);
        assert!(strength("trois chats gris") >= 2);
        assert_eq!(strength("Trois chats gris sur le toit !"), 4);
    }

    #[test]
    fn lockout_doubles_and_is_capped() {
        let now = Utc::now();
        let mut lockout = Lockout::default();
        for _ in 0..ATTEMPTS_BEFORE_LOCKOUT - 1 {
            lockout.record_failure(now);
        }
        assert_eq!(lockout.remaining(now), None, "a few typos are free");

        lockout.record_failure(now);
        assert_eq!(lockout.remaining(now), Some(Duration::seconds(30)));
        lockout.record_failure(now);
        assert_eq!(lockout.remaining(now), Some(Duration::seconds(60)));

        for _ in 0..200 {
            lockout.record_failure(now);
        }
        assert_eq!(
            lockout.remaining(now),
            Some(Duration::seconds(LOCKOUT_MAX_SECS)),
            "no overflow, no lockout longer than the cap"
        );
        assert_eq!(
            lockout.remaining(now + Duration::seconds(LOCKOUT_MAX_SECS)),
            None
        );

        lockout.record_success();
        assert_eq!(lockout, Lockout::default());
    }
}
