//! Local compliance score calculator.

use agent_common::types::{CheckResult, CheckSeverity, CheckStatus};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Default weights for check severities.
const WEIGHT_CRITICAL: f64 = 4.0;
const WEIGHT_HIGH: f64 = 3.0;
const WEIGHT_MEDIUM: f64 = 2.0;
const WEIGHT_LOW: f64 = 1.0;
const WEIGHT_INFO: f64 = 0.5;

/// Compliance score with detailed breakdown.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceScore {
    /// Overall compliance score (0-100).
    pub score: f64,

    /// Score from the previous scan (for trend calculation).
    #[serde(default)]
    pub previous_score: Option<f64>,

    /// Change from previous score.
    #[serde(default)]
    pub delta: Option<f64>,

    /// Number of passing checks.
    pub passed_count: usize,

    /// Number of failing checks.
    pub failed_count: usize,

    /// Number of checks with errors.
    pub error_count: usize,

    /// Number of skipped checks.
    pub skipped_count: usize,

    /// Total number of checks.
    pub total_count: usize,

    /// Score breakdown by category.
    #[serde(default)]
    pub category_scores: HashMap<String, CategoryScore>,

    /// Score breakdown by framework.
    #[serde(default)]
    pub framework_scores: HashMap<String, f64>,

    /// Timestamp when the score was calculated.
    pub calculated_at: DateTime<Utc>,
}

/// Score for a specific category.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryScore {
    /// Score for this category (0-100).
    pub score: f64,
    /// Number of passing checks.
    pub passed: usize,
    /// Number of failing checks.
    pub failed: usize,
    /// Total checks in this category.
    pub total: usize,
}

/// Configuration for weighted scoring.
#[derive(Debug, Clone)]
pub struct ScoringConfig {
    /// Weight for critical severity checks.
    pub weight_critical: f64,
    /// Weight for high severity checks.
    pub weight_high: f64,
    /// Weight for medium severity checks.
    pub weight_medium: f64,
    /// Weight for low severity checks.
    pub weight_low: f64,
    /// Weight for info severity checks.
    pub weight_info: f64,
}

impl Default for ScoringConfig {
    fn default() -> Self {
        Self {
            weight_critical: WEIGHT_CRITICAL,
            weight_high: WEIGHT_HIGH,
            weight_medium: WEIGHT_MEDIUM,
            weight_low: WEIGHT_LOW,
            weight_info: WEIGHT_INFO,
        }
    }
}

impl ScoringConfig {
    /// Get the weight for a given severity.
    pub fn weight_for(&self, severity: CheckSeverity) -> f64 {
        match severity {
            CheckSeverity::Critical => self.weight_critical,
            CheckSeverity::High => self.weight_high,
            CheckSeverity::Medium => self.weight_medium,
            CheckSeverity::Low => self.weight_low,
            CheckSeverity::Info => self.weight_info,
        }
    }
}

/// Input for score calculation.
#[derive(Debug, Clone)]
pub struct CheckScoreInput {
    /// The check result.
    pub result: CheckResult,
    /// The severity of the check.
    pub severity: CheckSeverity,
    /// The category name.
    pub category: String,
    /// Applicable frameworks.
    pub frameworks: Vec<String>,
}

/// Compliance score calculator.
pub struct ScoreCalculator {
    config: ScoringConfig,
}

impl ScoreCalculator {
    /// Create a new score calculator with default weights.
    pub fn new() -> Self {
        Self {
            config: ScoringConfig::default(),
        }
    }

    /// Create a score calculator with custom weights.
    pub fn with_config(config: ScoringConfig) -> Self {
        Self { config }
    }

    /// Calculate the compliance score from check results.
    pub fn calculate(&self, inputs: &[CheckScoreInput]) -> ComplianceScore {
        self.calculate_with_previous(inputs, None)
    }

    /// Calculate the compliance score with previous score for trend.
    pub fn calculate_with_previous(
        &self,
        inputs: &[CheckScoreInput],
        previous_score: Option<f64>,
    ) -> ComplianceScore {
        let now = Utc::now();

        if inputs.is_empty() {
            return ComplianceScore {
                score: 0.0,
                previous_score,
                delta: None,
                passed_count: 0,
                failed_count: 0,
                error_count: 0,
                skipped_count: 0,
                total_count: 0,
                category_scores: HashMap::new(),
                framework_scores: HashMap::new(),
                calculated_at: now,
            };
        }

        let mut passed_count = 0;
        let mut failed_count = 0;
        let mut error_count = 0;
        let mut skipped_count = 0;

        let mut weighted_pass = 0.0;
        let mut weighted_total = 0.0;

        let mut category_data: HashMap<String, (usize, usize)> = HashMap::new();
        let mut framework_data: HashMap<String, (f64, f64)> = HashMap::new();

        for input in inputs {
            let weight = self.config.weight_for(input.severity);

            match input.result.status {
                CheckStatus::Pass => {
                    passed_count += 1;
                    weighted_pass += weight;
                    weighted_total += weight;

                    // Category tracking
                    let entry = category_data
                        .entry(input.category.clone())
                        .or_insert((0, 0));
                    entry.0 += 1;
                    entry.1 += 1;

                    // Framework tracking
                    for framework in &input.frameworks {
                        let entry = framework_data
                            .entry(framework.clone())
                            .or_insert((0.0, 0.0));
                        entry.0 += weight;
                        entry.1 += weight;
                    }
                }
                CheckStatus::Fail => {
                    failed_count += 1;
                    weighted_total += weight;

                    let entry = category_data
                        .entry(input.category.clone())
                        .or_insert((0, 0));
                    entry.1 += 1;

                    for framework in &input.frameworks {
                        let entry = framework_data
                            .entry(framework.clone())
                            .or_insert((0.0, 0.0));
                        entry.1 += weight;
                    }
                }
                CheckStatus::Error => {
                    error_count += 1;
                    // Errors contribute partially to score (50% penalty)
                    // This prevents masking systematic issues while not being as harsh as failure
                    weighted_pass += weight * 0.5;
                    weighted_total += weight;

                    // Track in category as partial (counted as 0.5 pass)
                    let entry = category_data
                        .entry(input.category.clone())
                        .or_insert((0, 0));
                    entry.1 += 1; // Add to total

                    for framework in &input.frameworks {
                        let entry = framework_data
                            .entry(framework.clone())
                            .or_insert((0.0, 0.0));
                        entry.0 += weight * 0.5; // Partial pass
                        entry.1 += weight;
                    }
                }
                CheckStatus::Skipped => {
                    skipped_count += 1;
                    // Skipped checks don't affect score calculation
                }
                CheckStatus::Pending => {
                    // Pending checks don't affect score
                }
            }
        }

        // Calculate overall score
        let score = if weighted_total > 0.0 {
            (weighted_pass / weighted_total) * 100.0
        } else {
            0.0
        };

        // Calculate delta
        let delta = previous_score.map(|prev| score - prev);

        // Calculate category scores
        let category_scores: HashMap<String, CategoryScore> = category_data
            .into_iter()
            .map(|(category, (passed, total))| {
                let cat_score = if total > 0 {
                    (passed as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                (
                    category,
                    CategoryScore {
                        score: cat_score,
                        passed,
                        failed: total - passed,
                        total,
                    },
                )
            })
            .collect();

        // Calculate framework scores
        let framework_scores: HashMap<String, f64> = framework_data
            .into_iter()
            .map(|(framework, (passed, total))| {
                let fw_score = if total > 0.0 {
                    (passed / total) * 100.0
                } else {
                    0.0
                };
                (framework, fw_score)
            })
            .collect();

        ComplianceScore {
            score,
            previous_score,
            delta,
            passed_count,
            failed_count,
            error_count,
            skipped_count,
            total_count: inputs.len(),
            category_scores,
            framework_scores,
            calculated_at: now,
        }
    }

    /// Calculate a simple unweighted score.
    pub fn calculate_simple(&self, results: &[CheckResult]) -> f64 {
        let countable: Vec<_> = results
            .iter()
            .filter(|r| matches!(r.status, CheckStatus::Pass | CheckStatus::Fail))
            .collect();

        if countable.is_empty() {
            return 0.0;
        }

        let passed = countable
            .iter()
            .filter(|r| r.status == CheckStatus::Pass)
            .count();

        (passed as f64 / countable.len() as f64) * 100.0
    }
}

impl Default for ScoreCalculator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_pass_input(category: &str, severity: CheckSeverity) -> CheckScoreInput {
        CheckScoreInput {
            result: CheckResult::pass("test"),
            severity,
            category: category.to_string(),
            frameworks: vec!["NIS2".to_string()],
        }
    }

    fn create_fail_input(category: &str, severity: CheckSeverity) -> CheckScoreInput {
        CheckScoreInput {
            result: CheckResult::fail("test", "failed"),
            severity,
            category: category.to_string(),
            frameworks: vec!["NIS2".to_string()],
        }
    }

    #[test]
    fn test_empty_inputs() {
        let calculator = ScoreCalculator::new();
        let score = calculator.calculate(&[]);

        assert_eq!(score.score, 0.0);
        assert_eq!(score.total_count, 0);
    }

    #[test]
    fn test_all_passing() {
        let calculator = ScoreCalculator::new();
        let inputs = vec![
            create_pass_input("encryption", CheckSeverity::High),
            create_pass_input("firewall", CheckSeverity::High),
            create_pass_input("antivirus", CheckSeverity::Medium),
        ];

        let score = calculator.calculate(&inputs);

        assert_eq!(score.score, 100.0);
        assert_eq!(score.passed_count, 3);
        assert_eq!(score.failed_count, 0);
    }

    #[test]
    fn test_all_failing() {
        let calculator = ScoreCalculator::new();
        let inputs = vec![
            create_fail_input("encryption", CheckSeverity::High),
            create_fail_input("firewall", CheckSeverity::High),
        ];

        let score = calculator.calculate(&inputs);

        assert_eq!(score.score, 0.0);
        assert_eq!(score.passed_count, 0);
        assert_eq!(score.failed_count, 2);
    }

    #[test]
    fn test_mixed_results() {
        let calculator = ScoreCalculator::new();
        let inputs = vec![
            create_pass_input("encryption", CheckSeverity::High), // weight 3.0
            create_fail_input("firewall", CheckSeverity::Medium), // weight 2.0
        ];

        let score = calculator.calculate(&inputs);

        // Score = (3.0 / 5.0) * 100 = 60.0
        assert!((score.score - 60.0).abs() < 0.01);
        assert_eq!(score.passed_count, 1);
        assert_eq!(score.failed_count, 1);
    }

    #[test]
    fn test_weighted_scoring() {
        let calculator = ScoreCalculator::new();

        // Critical failure vs Low pass
        let inputs = vec![
            create_fail_input("critical", CheckSeverity::Critical), // weight 4.0
            create_pass_input("low", CheckSeverity::Low),           // weight 1.0
        ];

        let score = calculator.calculate(&inputs);

        // Score = (1.0 / 5.0) * 100 = 20.0
        assert!((score.score - 20.0).abs() < 0.01);
    }

    #[test]
    fn test_category_scores() {
        let calculator = ScoreCalculator::new();
        let inputs = vec![
            create_pass_input("encryption", CheckSeverity::High),
            create_pass_input("encryption", CheckSeverity::High),
            create_fail_input("firewall", CheckSeverity::High),
        ];

        let score = calculator.calculate(&inputs);

        assert!(score.category_scores.contains_key("encryption"));
        assert!(score.category_scores.contains_key("firewall"));

        let encryption_score = &score.category_scores["encryption"];
        assert_eq!(encryption_score.score, 100.0);
        assert_eq!(encryption_score.passed, 2);

        let firewall_score = &score.category_scores["firewall"];
        assert_eq!(firewall_score.score, 0.0);
        assert_eq!(firewall_score.failed, 1);
    }

    #[test]
    fn test_framework_scores() {
        let calculator = ScoreCalculator::new();
        let inputs = vec![
            CheckScoreInput {
                result: CheckResult::pass("test1"),
                severity: CheckSeverity::High,
                category: "encryption".to_string(),
                frameworks: vec!["NIS2".to_string(), "DORA".to_string()],
            },
            CheckScoreInput {
                result: CheckResult::fail("test2", "failed"),
                severity: CheckSeverity::High,
                category: "firewall".to_string(),
                frameworks: vec!["NIS2".to_string()],
            },
        ];

        let score = calculator.calculate(&inputs);

        assert!(score.framework_scores.contains_key("NIS2"));
        assert!(score.framework_scores.contains_key("DORA"));

        // NIS2: 1 pass (3.0) / 2 total (6.0) = 50%
        assert!((score.framework_scores["NIS2"] - 50.0).abs() < 0.01);

        // DORA: 1 pass (3.0) / 1 total (3.0) = 100%
        assert!((score.framework_scores["DORA"] - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_delta_calculation() {
        let calculator = ScoreCalculator::new();
        let inputs = vec![
            create_pass_input("test", CheckSeverity::High),
            create_fail_input("test", CheckSeverity::High),
        ];

        let score = calculator.calculate_with_previous(&inputs, Some(40.0));

        assert!(score.delta.is_some());
        // Score = 50%, delta = 50 - 40 = 10
        assert!((score.delta.unwrap() - 10.0).abs() < 0.01);
    }

    #[test]
    fn test_simple_score() {
        let calculator = ScoreCalculator::new();
        let results = vec![
            CheckResult::pass("test1"),
            CheckResult::pass("test2"),
            CheckResult::fail("test3", "failed"),
            CheckResult::error("test4", "error"), // excluded
        ];

        let score = calculator.calculate_simple(&results);

        // 2 pass / 3 countable = 66.67%
        assert!((score - 66.67).abs() < 0.01);
    }

    #[test]
    fn test_scoring_config_weights() {
        let config = ScoringConfig::default();

        assert_eq!(config.weight_for(CheckSeverity::Critical), WEIGHT_CRITICAL);
        assert_eq!(config.weight_for(CheckSeverity::High), WEIGHT_HIGH);
        assert_eq!(config.weight_for(CheckSeverity::Medium), WEIGHT_MEDIUM);
        assert_eq!(config.weight_for(CheckSeverity::Low), WEIGHT_LOW);
        assert_eq!(config.weight_for(CheckSeverity::Info), WEIGHT_INFO);
    }

    #[test]
    fn test_compliance_score_serialization() {
        let calculator = ScoreCalculator::new();
        let inputs = vec![create_pass_input("test", CheckSeverity::High)];

        let score = calculator.calculate(&inputs);

        let json = serde_json::to_string(&score).unwrap();
        assert!(json.contains("score"));
        assert!(json.contains("passed_count"));
        assert!(json.contains("calculated_at"));

        let parsed: ComplianceScore = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.score, 100.0);
    }
}
