// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Integration tests for agent-sync.
//!
//! These tests exercise the core components of the sync crate without
//! requiring a real SaaS endpoint:
//!
//! - `CircuitBreaker` — state machine transitions (Closed → Open → HalfOpen → Closed)
//! - `OfflineTracker` — offline duration tracking, the 7-day autonomy boundary
//! - `SyncOrchestrator` — initialization, status reporting, history management
//! - Conflict resolution helpers — `resolve_config_conflict`, `resolve_rule_conflict`
//! - `SyncQueueItem` — retry logic, exponential backoff
//!
//! No HTTP requests are made; the tests use only in-process state.

use agent_storage::{Database, DatabaseConfig, KeyManager};
use agent_sync::{
    CircuitBreaker, CircuitState, ConflictStrategy, OfflineTracker, SyncKind, SyncOrchestrator,
    SyncStatus,
    offline::{SyncEntityType, SyncQueueItem, resolve_config_conflict, resolve_rule_conflict},
};
use chrono::{Duration, Utc};
use std::sync::Arc;
use tempfile::TempDir;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Open an encrypted database in a temporary directory, wrapped in Arc.
fn open_temp_db() -> (TempDir, Arc<Database>) {
    let dir = TempDir::new().expect("TempDir::new should succeed");
    let path = dir.path().join("sync_test.db");
    let config = DatabaseConfig::with_path(&path);
    let km = KeyManager::new_with_test_key();
    let db = Database::open(config, &km).expect("Database::open should succeed with test key");
    (dir, Arc::new(db))
}

/// Build a `SyncQueueItem` with sensible defaults for testing.
fn make_queue_item(attempts: u32, max_attempts: u32, created_offset_hours: i64) -> SyncQueueItem {
    SyncQueueItem {
        id: 1,
        entity_type: SyncEntityType::CheckResult,
        entity_id: 42,
        payload: "{}".to_string(),
        priority: 0,
        attempts,
        max_attempts,
        last_attempt_at: None,
        last_error: None,
        created_at: Utc::now() + Duration::hours(created_offset_hours),
        next_retry_at: Utc::now(),
    }
}

// ─── CircuitBreaker state machine ─────────────────────────────────────────────

/// Initial state must be Closed and requests allowed.
#[tokio::test]
async fn test_circuit_breaker_starts_closed() {
    let cb = CircuitBreaker::new();
    assert_eq!(cb.state().await, CircuitState::Closed);
    assert!(
        cb.is_allowed().await,
        "Requests must be allowed when Closed"
    );
    assert_eq!(cb.failure_count(), 0);
}

/// After 5 consecutive failures (the documented threshold) state becomes Open
/// and requests are blocked.
#[tokio::test]
async fn test_circuit_breaker_opens_after_five_failures() {
    let cb = CircuitBreaker::new();

    // The circuit breaker threshold is 5 (documented in offline.rs)
    for _ in 0..5u32 {
        cb.record_failure().await;
    }

    assert_eq!(
        cb.state().await,
        CircuitState::Open,
        "Circuit must be Open after 5 failures"
    );
    assert!(
        !cb.is_allowed().await,
        "Requests must be blocked when circuit is Open"
    );
    assert_eq!(cb.failure_count(), 5);
}

/// A single success after some failures resets the breaker to Closed.
#[tokio::test]
async fn test_circuit_breaker_success_resets_to_closed() {
    let cb = CircuitBreaker::new();

    // Record some failures (below threshold of 5)
    cb.record_failure().await;
    cb.record_failure().await;
    assert_eq!(cb.state().await, CircuitState::Closed);

    cb.record_success().await;

    assert_eq!(cb.state().await, CircuitState::Closed);
    assert_eq!(
        cb.failure_count(),
        0,
        "Failure count must reset to 0 after success"
    );
    assert!(cb.is_allowed().await);
}

/// A success after the circuit opens resets it to Closed.
#[tokio::test]
async fn test_circuit_breaker_success_after_open_resets_to_closed() {
    let cb = CircuitBreaker::new();

    for _ in 0..5u32 {
        cb.record_failure().await;
    }
    assert_eq!(cb.state().await, CircuitState::Open);

    cb.record_success().await;
    assert_eq!(cb.state().await, CircuitState::Closed);
    assert_eq!(cb.failure_count(), 0);
    assert!(cb.is_allowed().await);
}

/// Failures below the threshold (4 of 5) do not open the circuit.
#[tokio::test]
async fn test_circuit_breaker_stays_closed_below_threshold() {
    let cb = CircuitBreaker::new();

    // 4 failures — one short of the threshold of 5
    for _ in 0..4u32 {
        cb.record_failure().await;
    }

    assert_eq!(
        cb.state().await,
        CircuitState::Closed,
        "Circuit must remain Closed with only 4 failures (threshold = 5)"
    );
    assert!(cb.is_allowed().await);
}

/// Additional failures after the circuit opens do not change the state further.
#[tokio::test]
async fn test_circuit_breaker_stays_open_on_additional_failures() {
    let cb = CircuitBreaker::new();

    for _ in 0..5u32 {
        cb.record_failure().await;
    }
    assert_eq!(cb.state().await, CircuitState::Open);

    // Record more failures — should stay Open
    cb.record_failure().await;
    cb.record_failure().await;

    assert_eq!(cb.state().await, CircuitState::Open);
}

/// Multiple successes keep the circuit Closed with zero failure count.
#[tokio::test]
async fn test_circuit_breaker_multiple_successes_stay_closed() {
    let cb = CircuitBreaker::new();

    cb.record_success().await;
    cb.record_success().await;
    cb.record_success().await;

    assert_eq!(cb.state().await, CircuitState::Closed);
    assert_eq!(cb.failure_count(), 0);
}

// ─── OfflineTracker ───────────────────────────────────────────────────────────

/// Initially the tracker is online.
#[tokio::test]
async fn test_offline_tracker_starts_online() {
    let tracker = OfflineTracker::new();
    assert!(!tracker.is_offline(), "Tracker must start online");
    assert!(
        tracker.offline_duration().await.is_none(),
        "Duration must be None when online"
    );
}

/// Entering offline mode sets the offline flag and records a start time.
#[tokio::test]
async fn test_offline_tracker_enter_offline_mode() {
    let tracker = OfflineTracker::new();
    tracker.enter_offline_mode().await;

    assert!(
        tracker.is_offline(),
        "Must be offline after enter_offline_mode"
    );
    let duration = tracker.offline_duration().await;
    assert!(duration.is_some(), "Duration must be Some when offline");
    assert!(
        duration.unwrap().num_seconds() >= 0,
        "Duration must be non-negative"
    );
}

/// Exiting offline mode clears the flag.
#[tokio::test]
async fn test_offline_tracker_exit_offline_mode() {
    let tracker = OfflineTracker::new();
    tracker.enter_offline_mode().await;
    assert!(tracker.is_offline());

    tracker.exit_offline_mode().await;
    assert!(
        !tracker.is_offline(),
        "Must be online after exit_offline_mode"
    );
    assert!(
        tracker.offline_duration().await.is_none(),
        "Duration must be None after exiting offline mode"
    );
}

/// Multiple `enter_offline_mode` calls are idempotent (no panic, state stays offline).
#[tokio::test]
async fn test_offline_tracker_enter_is_idempotent() {
    let tracker = OfflineTracker::new();
    tracker.enter_offline_mode().await;
    tracker.enter_offline_mode().await; // second call must be a no-op
    assert!(tracker.is_offline());
}

/// When online, `is_within_autonomy_period` is `true`.
#[tokio::test]
async fn test_offline_tracker_autonomy_period_true_when_online() {
    let tracker = OfflineTracker::new();
    assert!(
        tracker.is_within_autonomy_period().await,
        "Must be within autonomy period when online"
    );
}

/// When offline for a short duration, `is_within_autonomy_period` is `true`.
#[tokio::test]
async fn test_offline_tracker_autonomy_period_true_for_short_offline() {
    let tracker = OfflineTracker::new();
    tracker.enter_offline_mode().await;
    // Just entered offline — well within 7 days
    assert!(
        tracker.is_within_autonomy_period().await,
        "Must be within autonomy period when just offline"
    );
}

/// Verify the boundary math for the 7-day (168-hour) offline autonomy limit.
/// We cannot manipulate `offline_since` directly (private field), so we verify
/// the boundary arithmetic that `OfflineTracker` applies internally.
#[test]
fn test_offline_autonomy_boundary_arithmetic() {
    // MAX_OFFLINE_DAYS = 7, enforced as 7 * 24 = 168 hours
    let max_offline_hours: i64 = 7 * 24;
    assert_eq!(max_offline_hours, 168);

    // 193 hours is outside the limit
    let eight_days_duration = Duration::hours(193);
    assert!(
        eight_days_duration.num_hours() > max_offline_hours,
        "193 hours must exceed the 168-hour autonomy limit"
    );

    // 160 hours is within the limit
    let six_days_duration = Duration::hours(160);
    assert!(
        six_days_duration.num_hours() <= max_offline_hours,
        "160 hours must be within the 7-day limit"
    );

    // The exact boundary: 168 hours must be within the limit
    // (`is_within_autonomy_period` uses `<= MAX_OFFLINE_DAYS * 24`)
    let boundary = Duration::hours(168);
    assert!(
        boundary.num_hours() <= max_offline_hours,
        "168 hours must be at the boundary (within)"
    );
}

/// `status()` returns the correct `is_offline` and `within_autonomy_period` flags.
#[tokio::test]
async fn test_offline_tracker_status_reflects_current_state() {
    let tracker = OfflineTracker::new();
    tracker.set_queued_count(7);

    let status_online = tracker.status().await;
    assert!(!status_online.is_offline);
    assert!(status_online.within_autonomy_period);
    assert_eq!(status_online.queued_item_count, 7);
    assert!(status_online.offline_duration_hours.is_none());

    tracker.enter_offline_mode().await;

    let status_offline = tracker.status().await;
    assert!(status_offline.is_offline);
    assert!(status_offline.within_autonomy_period); // just went offline
    assert_eq!(status_offline.queued_item_count, 7);
    assert!(status_offline.offline_duration_hours.is_some());
}

/// `increment_queued` and `decrement_queued` update the counter via
/// observable `status()` and `queued_item_count`.
#[tokio::test]
async fn test_offline_tracker_queued_count_operations() {
    let tracker = OfflineTracker::new();

    tracker.set_queued_count(10);
    assert_eq!(tracker.status().await.queued_item_count, 10);

    tracker.increment_queued();
    assert_eq!(tracker.status().await.queued_item_count, 11);

    tracker.decrement_queued();
    assert_eq!(tracker.status().await.queued_item_count, 10);
}

/// `decrement_queued` saturates at 0 and does not wrap around.
#[tokio::test]
async fn test_offline_tracker_decrement_saturates_at_zero() {
    let tracker = OfflineTracker::new();
    tracker.set_queued_count(0);

    tracker.decrement_queued();
    assert_eq!(
        tracker.status().await.queued_item_count,
        0,
        "Decrement below 0 must saturate at 0"
    );
}

// ─── SyncOrchestrator initialization ─────────────────────────────────────────

/// After construction the orchestrator reports `Idle` status with no history.
#[tokio::test]
async fn test_orchestrator_starts_idle_with_empty_history() {
    let (_dir, db) = open_temp_db();
    let orch = SyncOrchestrator::new(db);

    let status = orch.status().await;
    assert_eq!(
        status.status,
        SyncStatus::Idle,
        "Orchestrator must start Idle"
    );
    assert!(
        status.last_success_at.is_none(),
        "No successful sync yet, last_success_at must be None"
    );
    assert!(!status.is_offline, "Must not be offline at init");
    assert!(
        status.last_error.is_none(),
        "No error yet, last_error must be None"
    );

    let history = orch.history(100).await;
    assert!(
        history.is_empty(),
        "History must be empty after construction"
    );
}

/// The circuit breaker accessor returns a `CircuitBreaker` in Closed state.
#[tokio::test]
async fn test_orchestrator_circuit_breaker_starts_closed() {
    let (_dir, db) = open_temp_db();
    let orch = SyncOrchestrator::new(db);

    let cb = orch.circuit_breaker();
    assert_eq!(cb.state().await, CircuitState::Closed);
    assert!(cb.is_allowed().await);
}

/// The offline tracker accessor reflects the current offline state.
#[tokio::test]
async fn test_orchestrator_offline_tracker_starts_online() {
    let (_dir, db) = open_temp_db();
    let orch = SyncOrchestrator::new(db);

    let tracker = orch.offline_tracker();
    assert!(!tracker.is_offline());
}

/// The orchestrator's circuit breaker integrates with `OfflineTracker`;
/// manipulating the breaker through the orchestrator's accessor is reflected
/// in the status summary.
#[tokio::test]
async fn test_orchestrator_circuit_breaker_state_visible_in_status() {
    let (_dir, db) = open_temp_db();
    let orch = SyncOrchestrator::new(db);

    // Initially Closed
    let status = orch.status().await;
    assert!(
        status.circuit_breaker.contains("Closed"),
        "Circuit breaker status must say Closed, got: {}",
        status.circuit_breaker
    );

    // Open the circuit
    let cb = orch.circuit_breaker();
    for _ in 0..5u32 {
        cb.record_failure().await;
    }

    let status_open = orch.status().await;
    assert!(
        status_open.circuit_breaker.contains("Open"),
        "Circuit breaker status must say Open after 5 failures, got: {}",
        status_open.circuit_breaker
    );
}

/// `SyncKind::as_str` returns the expected canonical string for all variants.
#[test]
fn test_sync_kind_as_str_values() {
    let cases = [
        (SyncKind::Full, "full"),
        (SyncKind::Manual, "manual"),
        (SyncKind::Playbooks, "playbooks"),
        (SyncKind::DetectionRules, "detection_rules"),
        (SyncKind::Risks, "risks"),
        (SyncKind::Assets, "assets"),
        (SyncKind::Kpi, "kpi"),
        (SyncKind::Alerting, "alerting"),
    ];

    for (kind, expected) in &cases {
        assert_eq!(
            kind.as_str(),
            *expected,
            "SyncKind::{:?}.as_str() should be '{}'",
            kind,
            expected
        );
    }
}

/// `history(limit)` returns at most `limit` entries.
#[tokio::test]
async fn test_orchestrator_history_limit_returns_empty_when_no_history() {
    let (_dir, db) = open_temp_db();
    let orch = SyncOrchestrator::new(db);

    // History starts empty — limit 0 and limit 10 both give empty
    let empty = orch.history(0).await;
    assert!(empty.is_empty(), "Limit 0 must return empty slice");

    let also_empty = orch.history(10).await;
    assert!(also_empty.is_empty(), "No history recorded yet");
}

// ─── Conflict resolution helpers ─────────────────────────────────────────────

/// `resolve_config_conflict` always uses `ServerWins` regardless of timestamps.
#[test]
fn test_resolve_config_conflict_server_always_wins() {
    let local_ts = Utc::now() - Duration::hours(1);
    let remote_ts = Utc::now();

    let resolution = resolve_config_conflict(
        "check_interval_secs",
        "3600", // local
        "7200", // remote
        local_ts,
        remote_ts,
    );

    assert_eq!(
        resolution.strategy,
        ConflictStrategy::ServerWins,
        "Strategy must always be ServerWins for config"
    );
    assert_eq!(resolution.after, "7200", "Server (remote) value must win");
    assert_eq!(resolution.before, "3600");
    assert_eq!(resolution.key, "check_interval_secs");
    assert!(
        !resolution.needs_review,
        "Config conflicts never need review"
    );
}

/// `resolve_config_conflict` still uses `ServerWins` even when local is newer.
#[test]
fn test_resolve_config_conflict_server_wins_even_if_local_is_newer() {
    let local_ts = Utc::now(); // local is newer
    let remote_ts = Utc::now() - Duration::hours(2);

    let resolution = resolve_config_conflict("sync_batch_size", "200", "100", local_ts, remote_ts);

    assert_eq!(resolution.strategy, ConflictStrategy::ServerWins);
    assert_eq!(
        resolution.after, "100",
        "Server value wins even when local timestamp is newer"
    );
}

/// `resolve_rule_conflict` uses `MostRecent`; the entry with the newer
/// timestamp wins.
#[test]
fn test_resolve_rule_conflict_most_recent_remote_wins() {
    let old_ts = Utc::now() - Duration::hours(3);
    let new_ts = Utc::now();

    let res = resolve_rule_conflict(
        "disk_encryption_v2",
        "1.0",  // local
        "2.0",  // remote
        old_ts, // local is older
        new_ts, // remote is newer
    );

    assert_eq!(res.strategy, ConflictStrategy::MostRecent);
    assert_eq!(res.after, "2.0", "Remote (newer) version should win");
}

/// When local is newer, local wins in `resolve_rule_conflict`.
#[test]
fn test_resolve_rule_conflict_most_recent_local_wins() {
    let new_ts = Utc::now();
    let old_ts = Utc::now() - Duration::hours(3);

    let res = resolve_rule_conflict(
        "av_rule", "3.0",  // local
        "2.0",  // remote
        new_ts, // local is newer
        old_ts, // remote is older
    );

    assert_eq!(res.strategy, ConflictStrategy::MostRecent);
    assert_eq!(res.after, "3.0", "Local (newer) version should win");
}

// ─── SyncQueueItem retry logic ────────────────────────────────────────────────

/// `should_retry` returns true when attempts < max and within 24-hour window.
#[test]
fn test_sync_queue_item_should_retry_when_eligible() {
    let item = make_queue_item(0, 10, 0);
    assert!(item.should_retry(), "Fresh item must be retryable");
}

/// `should_retry` returns false when max attempts is reached.
#[test]
fn test_sync_queue_item_should_not_retry_when_max_attempts_reached() {
    let item = make_queue_item(10, 10, 0);
    assert!(
        !item.should_retry(),
        "Item at max_attempts must not be retryable"
    );
}

/// `should_retry` returns false when the 24-hour retry window has expired.
/// MAX_RETRY_HOURS = 24, so we create the item 25 hours in the past.
#[test]
fn test_sync_queue_item_should_not_retry_when_24h_window_expired() {
    let item = make_queue_item(0, 10, -25); // created 25 hours ago
    assert!(
        !item.should_retry(),
        "Item older than 24 hours must not be retryable"
    );
}

/// `calculate_next_retry` returns a timestamp in the future.
#[test]
fn test_sync_queue_item_next_retry_is_in_future() {
    let item = make_queue_item(0, 10, 0);
    let next = item.calculate_next_retry();
    assert!(next > Utc::now(), "Next retry must be in the future");
}

/// Exponential backoff: delay approximately doubles with each attempt.
/// Delays: attempt 0 → ~1s, attempt 1 → ~2s, attempt 2 → ~4s.
#[test]
fn test_sync_queue_item_exponential_backoff_increases_delay() {
    let item_a0 = make_queue_item(0, 10, 0);
    let item_a1 = make_queue_item(1, 10, 0);
    let item_a2 = make_queue_item(2, 10, 0);

    let now = Utc::now();
    let delay_0 = (item_a0.calculate_next_retry() - now).num_seconds();
    let delay_1 = (item_a1.calculate_next_retry() - now).num_seconds();
    let delay_2 = (item_a2.calculate_next_retry() - now).num_seconds();

    // 2^0 = 1s, 2^1 = 2s, 2^2 = 4s (allow ±1s tolerance for timing)
    assert!(
        (1..=2).contains(&delay_0),
        "Attempt 0 delay ~1s, got {}s",
        delay_0
    );
    assert!(
        (2..=3).contains(&delay_1),
        "Attempt 1 delay ~2s, got {}s",
        delay_1
    );
    assert!(
        (4..=5).contains(&delay_2),
        "Attempt 2 delay ~4s, got {}s",
        delay_2
    );
}

/// At high attempt counts the backoff is capped at MAX_RETRY_DELAY_SECS (3600s).
#[test]
fn test_sync_queue_item_backoff_is_capped_at_max() {
    // 20 attempts: 2^20 = ~1M seconds, far above the 3600s cap
    let item = make_queue_item(20, 100, 0);
    let now = Utc::now();
    let delay = (item.calculate_next_retry() - now).num_seconds();

    assert!(
        delay <= 3601,
        "Backoff must be capped at MAX_RETRY_DELAY_SECS (3600s), got {}s",
        delay
    );
}

/// `is_ready_for_retry` is false when `next_retry_at` is in the future.
#[test]
fn test_sync_queue_item_not_ready_when_next_retry_in_future() {
    let mut item = make_queue_item(0, 10, 0);
    item.next_retry_at = Utc::now() + Duration::hours(1);
    assert!(
        !item.is_ready_for_retry(),
        "Item must not be ready when next_retry_at is in the future"
    );
}

/// `is_ready_for_retry` is true when `next_retry_at` is in the past and
/// `should_retry` is true.
#[test]
fn test_sync_queue_item_ready_when_next_retry_in_past() {
    let mut item = make_queue_item(0, 10, 0);
    item.next_retry_at = Utc::now() - Duration::seconds(1);
    assert!(
        item.is_ready_for_retry(),
        "Item must be ready when next_retry_at is in the past"
    );
}

// ─── SyncEntityType round-trip ─────────────────────────────────────────────

/// `SyncEntityType::as_str` / `parse_str` round-trip for every variant.
#[test]
fn test_sync_entity_type_round_trip() {
    let variants = [
        SyncEntityType::CheckResult,
        SyncEntityType::Proof,
        SyncEntityType::Heartbeat,
        SyncEntityType::Config,
        SyncEntityType::Playbook,
        SyncEntityType::DetectionRule,
        SyncEntityType::Risk,
        SyncEntityType::Asset,
        SyncEntityType::Kpi,
        SyncEntityType::AlertRule,
        SyncEntityType::Webhook,
    ];

    for variant in &variants {
        let s = variant.as_str();
        let parsed = SyncEntityType::parse_str(s)
            .unwrap_or_else(|| panic!("parse_str('{}') returned None for {:?}", s, variant));
        assert_eq!(
            &parsed, variant,
            "Round-trip failed for {:?}: '{}' → {:?}",
            variant, s, parsed
        );
    }
}

/// `parse_str` returns `None` for unknown strings.
#[test]
fn test_sync_entity_type_parse_str_unknown_returns_none() {
    assert!(
        SyncEntityType::parse_str("completely_unknown_type").is_none(),
        "Unknown entity type string must return None"
    );
}
