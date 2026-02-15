//! Compliance checking, scoring, and result storage.

use agent_common::types::CheckSeverity;
use agent_scanner::{
    CheckExecutionResult, CheckRunner, CheckScoreInput, ComplianceScore, ScanSummary,
    ScoreCalculator,
};
use agent_storage::{
    CheckResult as StorageCheckResult, CheckResultsRepository, CheckRule as StorageCheckRule,
    CheckRulesRepository, CheckStatus as StorageCheckStatus, Severity as StorageSeverity,
};
use tracing::{debug, info, warn};

use super::AgentRuntime;

impl AgentRuntime {
    /// Run all compliance checks, calculate score, store results in DB.
    ///
    /// Returns the execution results and the calculated compliance score.
    pub(crate) async fn run_compliance_checks(
        &self,
    ) -> (Vec<CheckExecutionResult>, ComplianceScore) {
        info!("Running compliance checks...");

        let active_frameworks = self
            .active_frameworks
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        if let Some(ref audit) = self.audit_trail {
            audit
                .log(
                    crate::audit_trail::AuditAction::ScanStarted {
                        scan_type: format!(
                            "{:?}",
                            active_frameworks.as_deref().unwrap_or(&["all".to_string()])
                        ),
                    },
                    "user",
                    None,
                )
                .await;
        }

        let runner = CheckRunner::with_defaults(self.check_registry.clone());
        let results = runner.run_filtered(active_frameworks.as_deref()).await;

        let summary = ScanSummary::from_results(&results, 0);
        info!(
            "Compliance checks complete: {} passed, {} failed, {} errors out of {} total",
            summary.passed, summary.failed, summary.errors, summary.total_checks
        );

        // Build score inputs from results + check definitions
        let score_inputs: Vec<CheckScoreInput> = results
            .iter()
            .map(|exec_result| {
                let check_id = &exec_result.result.check_id;
                let check = self.check_registry.get(check_id);
                let (severity, category, frameworks) = match check {
                    Some(c) => {
                        let def = c.definition();
                        (
                            def.severity,
                            format!("{:?}", def.category).to_lowercase(),
                            def.frameworks.clone(),
                        )
                    }
                    None => (CheckSeverity::Medium, "general".to_string(), vec![]),
                };
                CheckScoreInput {
                    result: exec_result.result.clone(),
                    severity,
                    category,
                    frameworks,
                }
            })
            .collect();

        // Calculate weighted compliance score
        let calculator = ScoreCalculator::new();
        let score = calculator.calculate(&score_inputs);

        info!(
            "Compliance score: {:.1}% (passed: {}, failed: {}, errors: {})",
            score.score, score.passed_count, score.failed_count, score.error_count
        );

        if let Some(ref audit) = self.audit_trail {
            audit
                .log(
                    crate::audit_trail::AuditAction::ScanFinished {
                        scan_type: "compliance".to_string(),
                        score: score.score as f32,
                    },
                    "system",
                    Some(format!(
                        "Passed: {}, Failed: {}, Errors: {}",
                        score.passed_count, score.failed_count, score.error_count
                    )),
                )
                .await;
        }

        (results, score)
    }

    /// Store compliance check results in the local database.
    pub(crate) async fn store_check_results(&self, results: &[CheckExecutionResult]) {
        let db = match self.db {
            Some(ref db) => db,
            None => {
                debug!("No database available, skipping check result storage");
                return;
            }
        };

        let repo = CheckResultsRepository::new(db);
        let mut stored = 0;

        for exec_result in results {
            let common_result = &exec_result.result;

            let storage_status = match common_result.status {
                agent_common::types::CheckStatus::Pass => StorageCheckStatus::Pass,
                agent_common::types::CheckStatus::Fail => StorageCheckStatus::Fail,
                agent_common::types::CheckStatus::Error => StorageCheckStatus::Error,
                agent_common::types::CheckStatus::Skipped => StorageCheckStatus::Skip,
                agent_common::types::CheckStatus::Pending => StorageCheckStatus::Skip,
            };

            let mut storage_result =
                StorageCheckResult::new(&common_result.check_id, storage_status);

            if let Some(ref msg) = common_result.message {
                storage_result = storage_result.with_message(msg.clone());
            }

            if common_result.details != serde_json::Value::Null
                && let Ok(json_str) = serde_json::to_string(&common_result.details)
            {
                storage_result = storage_result.with_raw_data(json_str);
            }

            storage_result = storage_result.with_duration_ms(common_result.duration_ms as i64);

            match repo.insert(&storage_result).await {
                Ok(_) => stored += 1,
                Err(e) => warn!(
                    "Failed to store check result for {}: {}",
                    common_result.check_id, e
                ),
            }
        }

        info!("Stored {} check results in database", stored);
    }

    /// Upload pending check results to the SaaS platform.
    pub(crate) async fn upload_check_results(&self) {
        let uploader = self.result_uploader.read().await;
        if let Some(ref uploader) = *uploader {
            match uploader.upload_pending().await {
                Ok(result) => {
                    if result.uploaded > 0 {
                        info!("Uploaded {} check results to server", result.uploaded);
                    }
                }
                Err(e) => warn!("Failed to upload check results: {}", e),
            }
        }
    }

    /// Pre-seed the check_rules table with the built-in compliance checks.
    pub(crate) async fn seed_builtin_check_rules(&self) {
        let db = match self.db {
            Some(ref db) => db,
            None => return,
        };

        let repo = CheckRulesRepository::new(db);
        let checks = self.check_registry.all();

        let rules: Vec<StorageCheckRule> = checks
            .iter()
            .map(|check| {
                let def = check.definition();
                let severity = match def.severity {
                    CheckSeverity::Critical => StorageSeverity::Critical,
                    CheckSeverity::High => StorageSeverity::High,
                    CheckSeverity::Medium => StorageSeverity::Medium,
                    CheckSeverity::Low => StorageSeverity::Low,
                    CheckSeverity::Info => StorageSeverity::Info,
                };
                StorageCheckRule::new(
                    &def.id,
                    &def.name,
                    format!("{:?}", def.category).to_lowercase(),
                    severity,
                    &def.id,
                    "builtin-1.0",
                )
                .with_description(&def.description)
                .with_frameworks(def.frameworks.clone())
            })
            .collect();

        match repo.upsert_batch(&rules).await {
            Ok(count) => info!("Seeded {} built-in check rules into database", count),
            Err(e) => warn!("Failed to seed built-in check rules: {}", e),
        }
    }
}
