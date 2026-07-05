// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Coherence guardrails for the technical-to-regulatory compliance link.
//!
//! These tests enforce that the two independent representations of the
//! technical↔regulatory mapping stay in sync:
//!
//! 1. Each compliance check tags itself with regulatory frameworks
//!    (`CheckDefinition::frameworks`) — used to decide which checks run.
//! 2. The [`FrameworkRegistry`] maps individual checks to specific framework
//!    controls (loaded from embedded TOML) — used for compliance scoring.
//!
//! Drift between the two (a framework tag nobody recognizes, or a control
//! mapping pointing at a check that no longer exists) silently corrupts
//! compliance reporting, so we fail the build instead.

use agent_common::frameworks::{FrameworkRegistry, normalize_framework_id};
use agent_core::register_builtin_checks;
use agent_scanner::CheckRegistry;
use std::collections::HashSet;

/// Every framework tag on every built-in check must resolve to a canonical
/// framework identifier. An unrecognized tag means the check claims compliance
/// with a framework the rest of the system cannot reason about.
#[test]
fn every_check_framework_tag_is_canonical() {
    let mut registry = CheckRegistry::new();
    register_builtin_checks(&mut registry);

    let mut offenders = Vec::new();
    for check in registry.all() {
        let def = check.definition();
        for fw in &def.frameworks {
            if normalize_framework_id(fw).is_none() {
                offenders.push(format!(
                    "check '{}' tags unknown framework '{}'",
                    check.id(),
                    fw
                ));
            }
        }
    }

    assert!(
        offenders.is_empty(),
        "non-canonical framework tags found:\n{}",
        offenders.join("\n")
    );
}

/// Every control mapping in the scoring registry must point at a check that is
/// actually registered. Orphan mappings are dead compliance evidence.
#[test]
fn every_control_mapping_targets_a_real_check() {
    let mut registry = CheckRegistry::new();
    register_builtin_checks(&mut registry);
    let real_ids: HashSet<String> = registry.all().iter().map(|c| c.id().to_string()).collect();

    let fw_registry = FrameworkRegistry::new();
    let orphans: Vec<String> = fw_registry
        .all_mapped_check_ids()
        .into_iter()
        .filter(|id| !real_ids.contains(id))
        .collect();

    assert!(
        orphans.is_empty(),
        "framework control mappings reference unknown checks: {:?}\n\
         (registered checks: {:?})",
        orphans,
        {
            let mut v: Vec<_> = real_ids.iter().cloned().collect();
            v.sort();
            v
        }
    );
}

/// The canonical framework list and the check tags should not diverge silently:
/// at least the frameworks that ship with a scoring catalog must each be tagged
/// by one or more checks, otherwise the framework has zero technical coverage.
#[test]
fn scored_frameworks_have_technical_coverage() {
    let mut registry = CheckRegistry::new();
    register_builtin_checks(&mut registry);

    // Collect the canonical frameworks tagged by at least one check.
    let mut tagged: HashSet<&'static str> = HashSet::new();
    for check in registry.all() {
        for fw in &check.definition().frameworks {
            if let Some(canon) = normalize_framework_id(fw) {
                tagged.insert(canon);
            }
        }
    }

    // Every framework that has a scoring catalog must have technical coverage.
    let fw_registry = FrameworkRegistry::new();
    let mut uncovered = Vec::new();
    for info in fw_registry.frameworks() {
        if let Some(canon) = normalize_framework_id(&info.id)
            && !tagged.contains(canon)
        {
            uncovered.push(info.id.clone());
        }
    }

    assert!(
        uncovered.is_empty(),
        "these scored frameworks have no check tagging them (zero technical coverage): {:?}",
        uncovered
    );
}
