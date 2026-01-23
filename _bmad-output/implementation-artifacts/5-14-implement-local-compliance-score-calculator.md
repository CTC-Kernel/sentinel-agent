# Story 5.14: Implement Local Compliance Score Calculator

Status: review

## Story

As a **CISO**,
I want **the agent to calculate a local compliance score**,
So that **endpoints can display their compliance status even offline**.

## Acceptance Criteria

1. **AC1** - Score Calculation
   - Weighted scoring based on check severity
   - Score range 0-100
   - Category-based subscores

2. **AC2** - Severity Weights
   - Critical: 4x weight
   - High: 3x weight
   - Medium: 2x weight
   - Low: 1x weight
   - Info: 0.5x weight

3. **AC3** - Framework Scores
   - NIS2 compliance score
   - DORA compliance score
   - Per-framework filtering

4. **AC4** - Score Trends
   - Delta calculation from previous score
   - Score history tracking

## Implementation Note

**This story was implemented as part of Story 5-1 (Check Runner Framework).**

The ScoreCalculator module in `agent-scanner/src/score.rs` provides:
- Weighted severity scoring
- Category-based subscores
- Framework-specific scores
- Delta/trend calculation

## Tasks / Subtasks

- [x] Task 1: Implement ScoreCalculator (AC: 1, 2, 3, 4)
  - [x] ComplianceScore struct
  - [x] ScoringConfig with weights
  - [x] calculate method
  - [x] calculate_with_previous method
  - [x] calculate_for_framework method

- [x] Task 2: Add Tests (AC: All)
  - [x] Basic scoring tests
  - [x] Weighted scoring tests
  - [x] Category scores tests
  - [x] Framework scores tests
  - [x] Delta calculation tests

## Dev Notes

### ComplianceScore Structure

```rust
ComplianceScore {
    overall_score: f64,
    passed_checks: u32,
    failed_checks: u32,
    total_checks: u32,
    category_scores: HashMap<String, f64>,
    framework_scores: HashMap<String, f64>,
    score_delta: Option<f64>,
    calculated_at: DateTime<Utc>,
}
```

### Severity Weights (ScoringConfig)

| Severity | Weight |
|----------|--------|
| Critical | 4.0 |
| High | 3.0 |
| Medium | 2.0 |
| Low | 1.0 |
| Info | 0.5 |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented in Story 5-1 as part of Check Runner Framework
- ScoreCalculator with configurable weights
- Category and framework subscores
- Delta tracking support
- 13 score-related tests in agent-scanner

### File List

**Files (from Story 5-1):**
- sentinel-agent/crates/agent-scanner/src/score.rs

### Change Log

- 2026-01-23: Implemented as part of Story 5-1

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW (merged with 5-1)
