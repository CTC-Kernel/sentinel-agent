// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Installs the detection rules shipped with the agent
//! ([`agent_gui::detection_catalog`]) among the endpoint's rules.

use std::collections::BTreeMap;

use agent_gui::detection_catalog;
use agent_gui::dto::DetectionRule;
use agent_storage::repositories::grc::DetectionRuleRepository;
use agent_storage::{
    ConfigRepository, Database, StorageResult, SyncEntityType, SyncQueueEntry, SyncQueueRepository,
};
use tracing::{info, warn};

use crate::threat_pipeline::{rule_to_stored, stored_rules_to_dto};

/// Local setting: the definition installed for each shipped rule, by id.
const INSTALLED_KEY: &str = "detection_rules.defaults_installed";

/// Install the shipped rules not installed yet, and the new version of those
/// the operator left as installed. `restore_deleted`: the shipped rules that
/// were deleted come back too. `queue_for_upload`: the rules installed are
/// sent to the platform, as a rule created in the interface is.
///
/// Returns the number of rules installed or updated.
pub async fn install_default_rules(
    db: &Database,
    queue_for_upload: bool,
    restore_deleted: bool,
) -> StorageResult<usize> {
    let repo = DetectionRuleRepository::new(db);
    let existing = stored_rules_to_dto(&repo.get_all().await?);
    let config = ConfigRepository::new(db);
    let mut installed: BTreeMap<String, String> =
        config.get_typed(INSTALLED_KEY).await?.unwrap_or_default();
    if restore_deleted {
        installed = detection_catalog::forget_deleted(&installed, &existing);
    }

    let catalog = detection_catalog::default_rules(chrono::Utc::now());
    let plan = detection_catalog::plan_install(&catalog, &existing, &installed);
    let changed: Vec<&DetectionRule> = plan.insert.iter().chain(&plan.update).collect();
    for rule in &changed {
        repo.upsert(&rule_to_stored(rule, false)).await?;
        if queue_for_upload {
            queue_rule_upload(db, rule).await;
        }
    }
    if plan.installed != installed {
        let value = serde_json::to_string(&plan.installed).unwrap_or_else(|_| "{}".into());
        config.set(INSTALLED_KEY, &value).await?;
    }
    if !changed.is_empty() {
        info!(
            "Shipped detection rules: {} installed, {} updated",
            plan.insert.len(),
            plan.update.len()
        );
    }
    Ok(changed.len())
}

/// Queue a rule for the platform.
async fn queue_rule_upload(db: &Database, rule: &DetectionRule) {
    let payload = crate::sync_converters::detection_rule_to_payload(rule);
    match serde_json::to_string(&payload) {
        Ok(json) => {
            let entry = SyncQueueEntry::new(SyncEntityType::DetectionRule, rule.id.clone(), json);
            if let Err(e) = SyncQueueRepository::new(db).enqueue(&entry).await {
                warn!(
                    "Shipped detection rule {} not queued for the platform: {}",
                    rule.id, e
                );
            }
        }
        Err(e) => warn!("Shipped detection rule {} not serialised: {}", rule.id, e),
    }
}

/// The endpoint's rules, as the interface shows them.
pub async fn load_rules(db: &Database) -> StorageResult<Vec<DetectionRule>> {
    Ok(stored_rules_to_dto(
        &DetectionRuleRepository::new(db).get_all().await?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::{DatabaseConfig, KeyManager};

    fn open_db() -> (tempfile::TempDir, Database) {
        let dir = tempfile::TempDir::new().expect("tempdir");
        let config = DatabaseConfig::with_path(dir.path().join("rules.db"));
        let key = KeyManager::new_with_key(b"01234567890123456789012345678901");
        (dir, Database::open(config, &key).expect("open"))
    }

    #[tokio::test]
    async fn shipped_rules_are_installed_once_active_and_queued_for_the_platform() {
        let (_dir, db) = open_db();
        let count = detection_catalog::default_rules(chrono::Utc::now()).len();

        assert_eq!(
            install_default_rules(&db, true, false).await.unwrap(),
            count
        );
        let rules = load_rules(&db).await.unwrap();
        assert_eq!(rules.len(), count);
        assert!(rules.iter().all(|rule| rule.enabled));
        let queued = SyncQueueRepository::new(&db).count().await.expect("count");
        assert_eq!(queued as usize, count);

        // The next start changes nothing.
        assert_eq!(install_default_rules(&db, true, false).await.unwrap(), 0);
    }

    #[tokio::test]
    async fn a_deleted_shipped_rule_comes_back_only_on_request() {
        let (_dir, db) = open_db();
        install_default_rules(&db, false, false).await.unwrap();
        let gone = load_rules(&db).await.unwrap().remove(0);
        DetectionRuleRepository::new(&db)
            .delete(&gone.id)
            .await
            .unwrap();

        assert_eq!(install_default_rules(&db, false, false).await.unwrap(), 0);
        assert!(
            !load_rules(&db)
                .await
                .unwrap()
                .iter()
                .any(|r| r.id == gone.id)
        );

        assert_eq!(install_default_rules(&db, false, true).await.unwrap(), 1);
        assert!(
            load_rules(&db)
                .await
                .unwrap()
                .iter()
                .any(|r| r.id == gone.id)
        );
    }

    #[tokio::test]
    async fn a_shipped_rule_turned_off_stays_off() {
        let (_dir, db) = open_db();
        install_default_rules(&db, false, false).await.unwrap();
        let repo = DetectionRuleRepository::new(&db);
        let mut rule = repo.get_all().await.unwrap().remove(0);
        rule.enabled = false;
        repo.upsert(&rule).await.unwrap();

        install_default_rules(&db, false, true).await.unwrap();
        let after = load_rules(&db).await.unwrap();
        assert!(!after.iter().find(|r| r.id == rule.id).unwrap().enabled);
    }
}
