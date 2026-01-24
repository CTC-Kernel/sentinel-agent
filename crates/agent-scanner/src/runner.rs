//! Check runner for parallel execution.

use crate::check::{Check, CheckRegistry};
use crate::error::{ScannerError, ScannerResult};
use crate::proof::ProofGenerator;
use agent_common::types::{CheckResult, CheckStatus, Proof};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;
use tokio::time::timeout;
use tracing::{debug, error, info, warn};

/// Default timeout for individual checks (30 seconds).
const DEFAULT_CHECK_TIMEOUT_MS: u64 = 30_000;

/// Default concurrency limit for parallel checks.
const DEFAULT_CONCURRENCY: usize = 4;

/// Maximum time for a full scan (NFR: 30 seconds for 20 checks).
const MAX_SCAN_DURATION_MS: u64 = 30_000;

/// Maximum time for a single check (NFR: 2 seconds).
const MAX_CHECK_DURATION_MS: u64 = 2_000;

/// Result of running a single check.
#[derive(Debug)]
pub struct CheckExecutionResult {
    /// The check result.
    pub result: CheckResult,
    /// The generated proof (if any).
    pub proof: Option<Proof>,
    /// Execution duration in milliseconds.
    pub duration_ms: u64,
}

/// Configuration for the check runner.
#[derive(Debug, Clone)]
pub struct RunnerConfig {
    /// Timeout for individual checks in milliseconds.
    pub check_timeout_ms: u64,
    /// Maximum concurrent checks.
    pub concurrency: usize,
    /// Whether to generate proofs.
    pub generate_proofs: bool,
}

impl Default for RunnerConfig {
    fn default() -> Self {
        Self {
            check_timeout_ms: DEFAULT_CHECK_TIMEOUT_MS,
            concurrency: DEFAULT_CONCURRENCY,
            generate_proofs: true,
        }
    }
}

/// Check runner for executing compliance checks.
pub struct CheckRunner {
    registry: Arc<CheckRegistry>,
    config: RunnerConfig,
    proof_generator: ProofGenerator,
}

impl CheckRunner {
    /// Create a new check runner.
    pub fn new(registry: Arc<CheckRegistry>, config: RunnerConfig) -> Self {
        Self {
            registry,
            config,
            proof_generator: ProofGenerator::new(),
        }
    }

    /// Create a check runner with default configuration.
    pub fn with_defaults(registry: Arc<CheckRegistry>) -> Self {
        Self::new(registry, RunnerConfig::default())
    }

    /// Run a single check by ID.
    pub async fn run_check(&self, check_id: &str) -> ScannerResult<CheckExecutionResult> {
        let check = self
            .registry
            .get(check_id)
            .ok_or_else(|| ScannerError::CheckNotFound(check_id.to_string()))?;

        if !check.is_enabled() {
            return Err(ScannerError::CheckDisabled(check_id.to_string()));
        }

        if !check.is_platform_supported() {
            return Err(ScannerError::PlatformNotSupported(check_id.to_string()));
        }

        self.execute_check(check).await
    }

    /// Run all enabled checks.
    pub async fn run_all(&self) -> Vec<CheckExecutionResult> {
        let checks = self.registry.enabled_checks();
        self.run_checks(checks).await
    }

    /// Run a specific set of checks.
    pub async fn run_checks(&self, checks: Vec<Arc<dyn Check>>) -> Vec<CheckExecutionResult> {
        let start = Instant::now();
        let check_count = checks.len();

        info!("Starting scan of {} checks", check_count);

        let semaphore = Arc::new(Semaphore::new(self.config.concurrency));
        let mut handles = Vec::new();

        for check in checks {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let runner_clone = self.clone_for_task();

            let handle = tokio::spawn(async move {
                let result = runner_clone.execute_check(check).await;
                drop(permit);
                result
            });

            handles.push(handle);
        }

        let mut results = Vec::new();
        for handle in handles {
            match handle.await {
                Ok(Ok(result)) => results.push(result),
                Ok(Err(e)) => {
                    error!("Check execution error: {}", e);
                }
                Err(e) => {
                    error!("Task join error: {}", e);
                }
            }
        }

        let duration = start.elapsed();
        let duration_ms = duration.as_millis() as u64;

        info!(
            "Scan completed: {} checks in {}ms",
            results.len(),
            duration_ms
        );

        if duration_ms > MAX_SCAN_DURATION_MS {
            warn!(
                "Full scan exceeded NFR limit: {}ms > {}ms",
                duration_ms, MAX_SCAN_DURATION_MS
            );
        }

        results
    }

    /// Execute a single check with timeout.
    async fn execute_check(&self, check: Arc<dyn Check>) -> ScannerResult<CheckExecutionResult> {
        let check_id = check.id().to_string();
        let start = Instant::now();

        debug!("Executing check: {}", check_id);

        let timeout_duration = Duration::from_millis(self.config.check_timeout_ms);

        let output = match timeout(timeout_duration, check.execute()).await {
            Ok(Ok(output)) => output,
            Ok(Err(e)) => {
                error!("Check {} failed: {}", check_id, e);
                return Ok(self.create_error_result(&check_id, start, e.to_string()));
            }
            Err(_) => {
                error!("Check {} timed out", check_id);
                return Ok(self.create_timeout_result(&check_id, start));
            }
        };

        let duration_ms = start.elapsed().as_millis() as u64;

        // Log NFR warning if check took too long
        if duration_ms > MAX_CHECK_DURATION_MS {
            warn!(
                "Check {} exceeded NFR limit: {}ms > {}ms",
                check_id, duration_ms, MAX_CHECK_DURATION_MS
            );
        }

        // Create check result
        let mut result = if output.passed {
            CheckResult::pass(&check_id)
        } else {
            CheckResult::fail(&check_id, &output.message)
        };

        result = result
            .with_duration(duration_ms)
            .with_details(output.raw_data.clone());

        // Generate proof if enabled
        let proof = if self.config.generate_proofs {
            let proof =
                self.proof_generator
                    .generate(result.id, &check_id, &output, check.definition());
            result = result.with_proof(proof.id);
            Some(proof)
        } else {
            None
        };

        debug!(
            "Check {} completed: {:?} in {}ms",
            check_id, result.status, duration_ms
        );

        Ok(CheckExecutionResult {
            result,
            proof,
            duration_ms,
        })
    }

    /// Create an error result for a failed check.
    fn create_error_result(
        &self,
        check_id: &str,
        start: Instant,
        error: String,
    ) -> CheckExecutionResult {
        let duration_ms = start.elapsed().as_millis() as u64;
        let result = CheckResult::error(check_id, error).with_duration(duration_ms);

        CheckExecutionResult {
            result,
            proof: None,
            duration_ms,
        }
    }

    /// Create a timeout result.
    fn create_timeout_result(&self, check_id: &str, start: Instant) -> CheckExecutionResult {
        let duration_ms = start.elapsed().as_millis() as u64;
        let result =
            CheckResult::error(check_id, format!("Check timed out after {}ms", duration_ms))
                .with_duration(duration_ms);

        CheckExecutionResult {
            result,
            proof: None,
            duration_ms,
        }
    }

    /// Clone the runner for use in a spawned task.
    fn clone_for_task(&self) -> Self {
        Self {
            registry: self.registry.clone(),
            config: self.config.clone(),
            proof_generator: ProofGenerator::new(),
        }
    }
}

/// Summary of a scan run.
#[derive(Debug, Clone)]
pub struct ScanSummary {
    /// Total number of checks executed.
    pub total_checks: usize,
    /// Number of passing checks.
    pub passed: usize,
    /// Number of failing checks.
    pub failed: usize,
    /// Number of checks with errors.
    pub errors: usize,
    /// Number of skipped checks.
    pub skipped: usize,
    /// Total scan duration in milliseconds.
    pub duration_ms: u64,
    /// Compliance score (0-100).
    pub score: f64,
}

impl ScanSummary {
    /// Create a summary from check results.
    pub fn from_results(results: &[CheckExecutionResult], duration_ms: u64) -> Self {
        let total_checks = results.len();
        let mut passed = 0;
        let mut failed = 0;
        let mut errors = 0;
        let mut skipped = 0;

        for result in results {
            match result.result.status {
                CheckStatus::Pass => passed += 1,
                CheckStatus::Fail => failed += 1,
                CheckStatus::Error => errors += 1,
                CheckStatus::Skipped => skipped += 1,
                CheckStatus::Pending => {}
            }
        }

        // Calculate score excluding errors and skipped
        let countable = passed + failed;
        let score = if countable > 0 {
            (passed as f64 / countable as f64) * 100.0
        } else {
            0.0
        };

        Self {
            total_checks,
            passed,
            failed,
            errors,
            skipped,
            duration_ms,
            score,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::check::{CheckDefinitionBuilder, CheckOutput};
    use agent_common::types::CheckCategory;
    use async_trait::async_trait;

    struct PassingCheck {
        definition: agent_common::types::CheckDefinition,
    }

    #[async_trait]
    impl Check for PassingCheck {
        fn definition(&self) -> &agent_common::types::CheckDefinition {
            &self.definition
        }

        async fn execute(&self) -> ScannerResult<CheckOutput> {
            Ok(CheckOutput::pass(
                "Check passed",
                serde_json::json!({"status": "ok"}),
            ))
        }
    }

    struct FailingCheck {
        definition: agent_common::types::CheckDefinition,
    }

    #[async_trait]
    impl Check for FailingCheck {
        fn definition(&self) -> &agent_common::types::CheckDefinition {
            &self.definition
        }

        async fn execute(&self) -> ScannerResult<CheckOutput> {
            Ok(CheckOutput::fail(
                "Check failed",
                serde_json::json!({"error": "non-compliant"}),
            ))
        }
    }

    struct SlowCheck {
        definition: agent_common::types::CheckDefinition,
        delay_ms: u64,
    }

    #[async_trait]
    impl Check for SlowCheck {
        fn definition(&self) -> &agent_common::types::CheckDefinition {
            &self.definition
        }

        async fn execute(&self) -> ScannerResult<CheckOutput> {
            tokio::time::sleep(Duration::from_millis(self.delay_ms)).await;
            Ok(CheckOutput::pass(
                "Slow check passed",
                serde_json::json!({}),
            ))
        }
    }

    fn create_passing_check(id: &str) -> Arc<dyn Check> {
        Arc::new(PassingCheck {
            definition: CheckDefinitionBuilder::new(id)
                .name(format!("Passing Check {}", id))
                .category(CheckCategory::General)
                .build(),
        })
    }

    fn create_failing_check(id: &str) -> Arc<dyn Check> {
        Arc::new(FailingCheck {
            definition: CheckDefinitionBuilder::new(id)
                .name(format!("Failing Check {}", id))
                .category(CheckCategory::General)
                .build(),
        })
    }

    #[tokio::test]
    async fn test_run_single_passing_check() {
        let mut registry = CheckRegistry::new();
        registry.register(create_passing_check("pass1"));

        let runner = CheckRunner::with_defaults(Arc::new(registry));
        let result = runner.run_check("pass1").await.unwrap();

        assert_eq!(result.result.status, CheckStatus::Pass);
        assert!(result.proof.is_some());
    }

    #[tokio::test]
    async fn test_run_single_failing_check() {
        let mut registry = CheckRegistry::new();
        registry.register(create_failing_check("fail1"));

        let runner = CheckRunner::with_defaults(Arc::new(registry));
        let result = runner.run_check("fail1").await.unwrap();

        assert_eq!(result.result.status, CheckStatus::Fail);
    }

    #[tokio::test]
    async fn test_run_nonexistent_check() {
        let registry = CheckRegistry::new();
        let runner = CheckRunner::with_defaults(Arc::new(registry));

        let result = runner.run_check("nonexistent").await;
        assert!(matches!(result, Err(ScannerError::CheckNotFound(_))));
    }

    #[tokio::test]
    async fn test_run_all_checks() {
        let mut registry = CheckRegistry::new();
        registry.register(create_passing_check("pass1"));
        registry.register(create_passing_check("pass2"));
        registry.register(create_failing_check("fail1"));

        let runner = CheckRunner::with_defaults(Arc::new(registry));
        let results = runner.run_all().await;

        assert_eq!(results.len(), 3);
    }

    #[tokio::test]
    async fn test_check_timeout() {
        let mut registry = CheckRegistry::new();
        registry.register(Arc::new(SlowCheck {
            definition: CheckDefinitionBuilder::new("slow")
                .name("Slow Check")
                .build(),
            delay_ms: 5000, // 5 seconds
        }));

        let config = RunnerConfig {
            check_timeout_ms: 100, // 100ms timeout
            concurrency: 1,
            generate_proofs: false,
        };

        let runner = CheckRunner::new(Arc::new(registry), config);
        let result = runner.run_check("slow").await.unwrap();

        assert_eq!(result.result.status, CheckStatus::Error);
        assert!(result.result.message.unwrap().contains("timed out"));
    }

    #[tokio::test]
    async fn test_concurrent_execution() {
        let mut registry = CheckRegistry::new();
        for i in 0..10 {
            registry.register(create_passing_check(&format!("check{}", i)));
        }

        let config = RunnerConfig {
            check_timeout_ms: DEFAULT_CHECK_TIMEOUT_MS,
            concurrency: 4,
            generate_proofs: false,
        };

        let runner = CheckRunner::new(Arc::new(registry), config);
        let results = runner.run_all().await;

        assert_eq!(results.len(), 10);
    }

    #[test]
    fn test_scan_summary() {
        let results = vec![
            CheckExecutionResult {
                result: CheckResult::pass("check1"),
                proof: None,
                duration_ms: 100,
            },
            CheckExecutionResult {
                result: CheckResult::pass("check2"),
                proof: None,
                duration_ms: 150,
            },
            CheckExecutionResult {
                result: CheckResult::fail("check3", "failed"),
                proof: None,
                duration_ms: 200,
            },
        ];

        let summary = ScanSummary::from_results(&results, 500);

        assert_eq!(summary.total_checks, 3);
        assert_eq!(summary.passed, 2);
        assert_eq!(summary.failed, 1);
        assert_eq!(summary.errors, 0);
        assert!((summary.score - 66.67).abs() < 0.1);
    }

    #[test]
    fn test_runner_config_default() {
        let config = RunnerConfig::default();
        assert_eq!(config.check_timeout_ms, DEFAULT_CHECK_TIMEOUT_MS);
        assert_eq!(config.concurrency, DEFAULT_CONCURRENCY);
        assert!(config.generate_proofs);
    }
}
