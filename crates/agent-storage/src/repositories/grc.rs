// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! GRC Entities repositories.

use crate::Database;
use crate::error::{StorageError, StorageResult};
use serde::{Deserialize, Serialize};

// ============================================================================
// RISKS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredRisk {
    pub id: String,
    pub title: String,
    pub description: String,
    pub probability: i32,
    pub impact: i32,
    pub owner: String,
    pub status: String,
    pub mitigation: String,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
    pub sla_target_days: Option<i32>,
    pub synced: bool,
}

pub struct RiskRepository<'a> {
    db: &'a Database,
}

impl<'a> RiskRepository<'a> {
    /// Apply remote records without overwriting dirty local edits or pending deletes.
    /// Only callers with a complete, unfiltered response may remove absent records.
    pub async fn reconcile_remote(&self, items: &[StoredRisk], complete: bool) -> StorageResult<()> {
        let ids = serde_json::to_string(&items.iter().map(|item| &item.id).collect::<Vec<_>>())
            .map_err(|e| StorageError::Query(e.to_string()))?;
        self.db.with_connection_mut(|conn| {
            let tx = conn.transaction().map_err(|e| StorageError::Query(e.to_string()))?;
            if complete {
                tx.execute("DELETE FROM risks WHERE synced=1 AND id NOT IN (SELECT value FROM json_each(?1)) AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type='risk' AND entity_id=risks.id)", [&ids])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            for item in items {
                let deleted: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM sync_queue WHERE entity_type='risk_delete' AND entity_id=?1)", [&item.id], |row| row.get(0))
                    .map_err(|e| StorageError::Query(e.to_string()))?;
                if deleted { continue; }
                tx.execute("INSERT INTO risks (id, title, description, probability, impact, owner, status, mitigation, source, created_at, updated_at, sla_target_days, synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, probability=excluded.probability, impact=excluded.impact, owner=excluded.owner, status=excluded.status, mitigation=excluded.mitigation, source=excluded.source, created_at=excluded.created_at, updated_at=excluded.updated_at, sla_target_days=excluded.sla_target_days, synced=excluded.synced WHERE risks.synced=1 AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type='risk' AND entity_id=risks.id)", rusqlite::params![item.id, item.title, item.description, item.probability, item.impact, item.owner, item.status, item.mitigation, item.source, item.created_at, item.updated_at, item.sla_target_days, 1])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            tx.commit().map_err(|e| StorageError::Query(e.to_string()))
        }).await
    }

    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub async fn upsert(&self, entity: &StoredRisk) -> StorageResult<()> {
        let synced_int = if entity.synced { 1 } else { 0 };
        self.db.with_connection(|conn| {
            conn.execute(
                r#"
                INSERT OR REPLACE INTO risks
                (id, title, description, probability, impact, owner, status, mitigation, source, created_at, updated_at, sla_target_days, synced)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                "#,
                rusqlite::params![
                    entity.id, entity.title, entity.description, entity.probability, entity.impact,
                    entity.owner, entity.status, entity.mitigation, entity.source, entity.created_at,
                    entity.updated_at, entity.sla_target_days, synced_int
                ],
            ).map_err(|e| StorageError::Query(format!("Failed to upsert risk: {}", e)))?;
            Ok(())
        }).await
    }

    pub async fn get_all(&self) -> StorageResult<Vec<StoredRisk>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare("SELECT * FROM risks")
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok(StoredRisk {
                            id: row.get(0)?,
                            title: row.get(1)?,
                            description: row.get(2)?,
                            probability: row.get(3)?,
                            impact: row.get(4)?,
                            owner: row.get(5)?,
                            status: row.get(6)?,
                            mitigation: row.get(7)?,
                            source: row.get(8)?,
                            created_at: row.get(9)?,
                            updated_at: row.get(10)?,
                            sla_target_days: row.get(11)?,
                            synced: row.get::<_, i32>(12)? != 0,
                        })
                    })
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;
                Ok(rows)
            })
            .await
    }

    pub async fn delete(&self, id: &str) -> StorageResult<()> {
        let id_cloned = id.to_string();
        self.db
            .with_connection(move |conn| {
                conn.execute("DELETE FROM risks WHERE id = ?", [id_cloned])
                    .map_err(|e| StorageError::Query(format!("Failed to delete risk: {}", e)))?;
                Ok(())
            })
            .await
    }
}

// ============================================================================
// PLAYBOOKS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredPlaybook {
    pub id: String,
    pub name: String,
    pub description: String,
    pub trigger_type: String,
    pub severity: String,
    pub steps: String, // JSON of actions
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
    pub synced: bool,
    pub conditions: String, // JSON of conditions
}

pub struct PlaybookRepository<'a> {
    db: &'a Database,
}

impl<'a> PlaybookRepository<'a> {
    /// Apply a complete platform snapshot atomically. Pending local edits survive;
    /// only acknowledged records absent from the platform are deleted.
    pub async fn reconcile_snapshot(&self, items: &[StoredPlaybook]) -> StorageResult<()> {
        let ids = serde_json::to_string(&items.iter().map(|item| &item.id).collect::<Vec<_>>())
            .map_err(|e| StorageError::Query(e.to_string()))?;
        self.db.with_connection_mut(|conn| {
            let tx = conn.transaction().map_err(|e| StorageError::Query(e.to_string()))?;
            tx.execute("DELETE FROM playbooks WHERE synced = 1 AND id NOT IN (SELECT value FROM json_each(?1)) AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type = 'playbook' AND entity_id = playbooks.id)", [&ids])
                .map_err(|e| StorageError::Query(e.to_string()))?;
            for item in items {
                let deleted: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM sync_queue WHERE entity_type = 'playbook_delete' AND entity_id = ?1)", [&item.id], |row| row.get(0))
                    .map_err(|e| StorageError::Query(e.to_string()))?;
                if deleted { continue; }
                tx.execute("INSERT INTO playbooks (id, name, description, trigger_type, severity, steps, enabled, created_at, updated_at, synced, conditions) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, trigger_type=excluded.trigger_type, severity=excluded.severity, steps=excluded.steps, enabled=excluded.enabled, created_at=excluded.created_at, updated_at=excluded.updated_at, synced=excluded.synced, conditions=excluded.conditions WHERE playbooks.synced = 1 AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type = 'playbook' AND entity_id = playbooks.id)", rusqlite::params![item.id, item.name, item.description, item.trigger_type, item.severity, item.steps, i32::from(item.enabled), item.created_at, item.updated_at, 1, item.conditions])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            tx.commit().map_err(|e| StorageError::Query(e.to_string()))
        }).await
    }

    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub async fn upsert(&self, entity: &StoredPlaybook) -> StorageResult<()> {
        let enabled_int = if entity.enabled { 1 } else { 0 };
        let synced_int = if entity.synced { 1 } else { 0 };
        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                INSERT OR REPLACE INTO playbooks
                (id, name, description, trigger_type, severity, steps, enabled, created_at, updated_at, synced, conditions)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                    rusqlite::params![
                        entity.id,
                        entity.name,
                        entity.description,
                        entity.trigger_type,
                        entity.severity,
                        entity.steps,
                        enabled_int,
                        entity.created_at,
                        entity.updated_at,
                        synced_int,
                        entity.conditions
                    ],
                )
                .map_err(|e| StorageError::Query(format!("Failed to upsert playbook: {}", e)))?;
                Ok(())
            })
            .await
    }

    pub async fn get_all(&self) -> StorageResult<Vec<StoredPlaybook>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare("SELECT id, name, description, trigger_type, severity, steps, enabled, created_at, updated_at, synced, conditions FROM playbooks")
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok(StoredPlaybook {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            description: row.get(2)?,
                            trigger_type: row.get(3)?,
                            severity: row.get::<_, String>(4).unwrap_or_else(|_| "medium".to_string()),
                            steps: row.get(5)?,
                            enabled: row.get::<_, i32>(6).unwrap_or(1) != 0,
                            created_at: row.get(7)?,
                            updated_at: row.get(8)?,
                            synced: row.get::<_, i32>(9)? != 0,
                            conditions: row.get::<_, String>(10).unwrap_or_else(|_| "[]".to_string()),
                        })
                    })
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;
                Ok(rows)
            })
            .await
    }

    pub async fn delete(&self, id: &str) -> StorageResult<()> {
        let id_cloned = id.to_string();
        self.db
            .with_connection(move |conn| {
                conn.execute("DELETE FROM playbooks WHERE id = ?", [id_cloned])
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete playbook: {}", e))
                    })?;
                Ok(())
            })
            .await
    }
}

// ============================================================================
// MANAGED ASSETS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredManagedAsset {
    pub id: String,
    pub ip: String,
    pub hostname: Option<String>,
    pub mac: Option<String>,
    pub vendor: Option<String>,
    pub device_type: String,
    pub criticality: String,
    pub lifecycle: String,
    pub tags: String, // JSON array
    pub risk_score: f64,
    pub vulnerability_count: i32,
    pub open_ports: String, // JSON array
    pub software: String,   // JSON array
    pub first_seen: String,
    pub last_seen: String,
    pub synced: bool,
}

pub struct ManagedAssetRepository<'a> {
    db: &'a Database,
}

impl<'a> ManagedAssetRepository<'a> {
    /// Apply remote records without overwriting dirty local edits or pending deletes.
    /// Only callers with a complete, unfiltered response may remove absent records.
    pub async fn reconcile_remote(&self, items: &[StoredManagedAsset], complete: bool) -> StorageResult<()> {
        let ids = serde_json::to_string(&items.iter().map(|item| &item.id).collect::<Vec<_>>())
            .map_err(|e| StorageError::Query(e.to_string()))?;
        self.db.with_connection_mut(|conn| {
            let tx = conn.transaction().map_err(|e| StorageError::Query(e.to_string()))?;
            if complete {
                tx.execute("DELETE FROM managed_assets WHERE synced=1 AND id NOT IN (SELECT value FROM json_each(?1)) AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type='asset' AND entity_id=managed_assets.id)", [&ids])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            for item in items {
                let deleted: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM sync_queue WHERE entity_type='asset_delete' AND entity_id=?1)", [&item.id], |row| row.get(0))
                    .map_err(|e| StorageError::Query(e.to_string()))?;
                if deleted { continue; }
                tx.execute("INSERT INTO managed_assets (id, ip, hostname, mac, vendor, device_type, criticality, lifecycle, tags, risk_score, vulnerability_count, open_ports, software, first_seen, last_seen, synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16) ON CONFLICT(id) DO UPDATE SET ip=excluded.ip, hostname=excluded.hostname, mac=excluded.mac, vendor=excluded.vendor, device_type=excluded.device_type, criticality=excluded.criticality, lifecycle=excluded.lifecycle, tags=excluded.tags, risk_score=excluded.risk_score, vulnerability_count=excluded.vulnerability_count, open_ports=excluded.open_ports, software=excluded.software, first_seen=excluded.first_seen, last_seen=excluded.last_seen, synced=excluded.synced WHERE managed_assets.synced=1 AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type='asset' AND entity_id=managed_assets.id)", rusqlite::params![item.id, item.ip, item.hostname, item.mac, item.vendor, item.device_type, item.criticality, item.lifecycle, item.tags, item.risk_score, item.vulnerability_count, item.open_ports, item.software, item.first_seen, item.last_seen, 1])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            tx.commit().map_err(|e| StorageError::Query(e.to_string()))
        }).await
    }

    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub async fn upsert(&self, entity: &StoredManagedAsset) -> StorageResult<()> {
        let synced_int = if entity.synced { 1 } else { 0 };
        self.db.with_connection(|conn| {
            conn.execute(
                r#"
                INSERT OR REPLACE INTO managed_assets
                (id, ip, hostname, mac, vendor, device_type, criticality, lifecycle, tags, risk_score, vulnerability_count, open_ports, software, first_seen, last_seen, synced)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                "#,
                rusqlite::params![
                    entity.id, entity.ip, entity.hostname, entity.mac, entity.vendor,
                    entity.device_type, entity.criticality, entity.lifecycle, entity.tags,
                    entity.risk_score, entity.vulnerability_count, entity.open_ports,
                    entity.software, entity.first_seen, entity.last_seen, synced_int
                ],
            ).map_err(|e| StorageError::Query(format!("Failed to upsert managed asset: {}", e)))?;
            Ok(())
        }).await
    }

    pub async fn get_all(&self) -> StorageResult<Vec<StoredManagedAsset>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare("SELECT id, ip, hostname, mac, vendor, device_type, criticality, lifecycle, tags, risk_score, vulnerability_count, open_ports, software, first_seen, last_seen, synced FROM managed_assets")
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok(StoredManagedAsset {
                            id: row.get(0)?,
                            ip: row.get(1)?,
                            hostname: row.get(2)?,
                            mac: row.get(3)?,
                            vendor: row.get(4)?,
                            device_type: row.get(5)?,
                            criticality: row.get(6)?,
                            lifecycle: row.get(7)?,
                            tags: row.get(8)?,
                            risk_score: row.get(9)?,
                            vulnerability_count: row.get(10)?,
                            open_ports: row.get(11)?,
                            software: row.get(12)?,
                            first_seen: row.get(13)?,
                            last_seen: row.get(14)?,
                            synced: row.get::<_, i32>(15)? != 0,
                        })
                    })
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;
                Ok(rows)
            })
            .await
    }

    pub async fn delete(&self, id: &str) -> StorageResult<()> {
        let id_cloned = id.to_string();
        self.db
            .with_connection(move |conn| {
                conn.execute("DELETE FROM managed_assets WHERE id = ?", [id_cloned])
                    .map_err(|e| StorageError::Query(format!("Failed to delete asset: {}", e)))?;
                Ok(())
            })
            .await
    }
}

// ============================================================================
// KPI SNAPSHOTS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredKpiSnapshot {
    pub id: i64,
    pub timestamp: String,
    pub compliance_score: f64,
    pub incident_count: i32,
    pub open_vulns: i32,
    pub closed_vulns: i32,
    pub remediation_sla_pct: f64,
    pub synced: bool,
}

pub struct KpiSnapshotRepository<'a> {
    db: &'a Database,
}

impl<'a> KpiSnapshotRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub async fn insert(&self, entity: &StoredKpiSnapshot) -> StorageResult<()> {
        let synced_int = if entity.synced { 1 } else { 0 };
        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                INSERT INTO kpi_snapshots
                (timestamp, compliance_score, incident_count, open_vulns, closed_vulns, remediation_sla_pct, synced)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                "#,
                    rusqlite::params![
                        entity.timestamp,
                        entity.compliance_score,
                        entity.incident_count,
                        entity.open_vulns,
                        entity.closed_vulns,
                        entity.remediation_sla_pct,
                        synced_int
                    ],
                )
                .map_err(|e| {
                    StorageError::Query(format!("Failed to insert kpi snapshot: {}", e))
                })?;
                Ok(())
            })
            .await
    }

    pub async fn get_all(&self) -> StorageResult<Vec<StoredKpiSnapshot>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare("SELECT id, timestamp, compliance_score, incident_count, open_vulns, closed_vulns, remediation_sla_pct, synced FROM kpi_snapshots")
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok(StoredKpiSnapshot {
                            id: row.get(0)?,
                            timestamp: row.get(1)?,
                            compliance_score: row.get(2)?,
                            incident_count: row.get(3)?,
                            open_vulns: row.get(4)?,
                            closed_vulns: row.get(5)?,
                            remediation_sla_pct: row.get(6)?,
                            synced: row.get::<_, i32>(7)? != 0,
                        })
                    })
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;
                Ok(rows)
            })
            .await
    }

    pub async fn delete(&self, id: i64) -> StorageResult<()> {
        self.db
            .with_connection(move |conn| {
                conn.execute("DELETE FROM kpi_snapshots WHERE id = ?", [id])
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete kpi snapshot: {}", e))
                    })?;
                Ok(())
            })
            .await
    }
}

// ============================================================================
// ALERT RULES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAlertRule {
    pub id: String,
    pub name: String,
    pub rule_type: String,
    pub severity_threshold: Option<String>,
    pub detection_types: String, // JSON array
    pub escalation_minutes: Option<i32>,
    pub enabled: bool,
    pub created_at: String,
    pub synced: bool,
}

pub struct AlertRuleRepository<'a> {
    db: &'a Database,
}

impl<'a> AlertRuleRepository<'a> {
    /// Apply remote records without overwriting dirty local edits or pending deletes.
    /// Only callers with a complete, unfiltered response may remove absent records.
    pub async fn reconcile_remote(&self, items: &[StoredAlertRule], complete: bool) -> StorageResult<()> {
        let ids = serde_json::to_string(&items.iter().map(|item| &item.id).collect::<Vec<_>>())
            .map_err(|e| StorageError::Query(e.to_string()))?;
        self.db.with_connection_mut(|conn| {
            let tx = conn.transaction().map_err(|e| StorageError::Query(e.to_string()))?;
            if complete {
                tx.execute("DELETE FROM alert_rules WHERE synced=1 AND id NOT IN (SELECT value FROM json_each(?1)) AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type='alert_rule' AND entity_id=alert_rules.id)", [&ids])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            for item in items {
                let deleted: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM sync_queue WHERE entity_type='alert_rule_delete' AND entity_id=?1)", [&item.id], |row| row.get(0))
                    .map_err(|e| StorageError::Query(e.to_string()))?;
                if deleted { continue; }
                tx.execute("INSERT INTO alert_rules (id, name, rule_type, severity_threshold, detection_types, escalation_minutes, enabled, created_at, synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(id) DO UPDATE SET name=excluded.name, rule_type=excluded.rule_type, severity_threshold=excluded.severity_threshold, detection_types=excluded.detection_types, escalation_minutes=excluded.escalation_minutes, enabled=excluded.enabled, created_at=excluded.created_at, synced=excluded.synced WHERE alert_rules.synced=1 AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type='alert_rule' AND entity_id=alert_rules.id)", rusqlite::params![item.id, item.name, item.rule_type, item.severity_threshold, item.detection_types, item.escalation_minutes, item.enabled, item.created_at, 1])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            tx.commit().map_err(|e| StorageError::Query(e.to_string()))
        }).await
    }

    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub async fn upsert(&self, entity: &StoredAlertRule) -> StorageResult<()> {
        let enabled_int = if entity.enabled { 1 } else { 0 };
        let synced_int = if entity.synced { 1 } else { 0 };
        self.db.with_connection(|conn| {
            conn.execute(
                r#"
                INSERT OR REPLACE INTO alert_rules
                (id, name, rule_type, severity_threshold, detection_types, escalation_minutes, enabled, created_at, synced)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                rusqlite::params![
                    entity.id, entity.name, entity.rule_type, entity.severity_threshold,
                    entity.detection_types, entity.escalation_minutes, enabled_int,
                    entity.created_at, synced_int
                ],
            ).map_err(|e| StorageError::Query(format!("Failed to upsert alert rule: {}", e)))?;
            Ok(())
        }).await
    }

    pub async fn get_all(&self) -> StorageResult<Vec<StoredAlertRule>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare("SELECT id, name, rule_type, severity_threshold, detection_types, escalation_minutes, enabled, created_at, synced FROM alert_rules")
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok(StoredAlertRule {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            rule_type: row.get(2)?,
                            severity_threshold: row.get(3)?,
                            detection_types: row.get(4)?,
                            escalation_minutes: row.get(5)?,
                            enabled: row.get::<_, i32>(6)? != 0,
                            created_at: row.get(7)?,
                            synced: row.get::<_, i32>(8)? != 0,
                        })
                    })
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;
                Ok(rows)
            })
            .await
    }

    pub async fn delete(&self, id: &str) -> StorageResult<()> {
        let id_cloned = id.to_string();
        self.db
            .with_connection(move |conn| {
                conn.execute("DELETE FROM alert_rules WHERE id = ?", [id_cloned])
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete alert rule: {}", e))
                    })?;
                Ok(())
            })
            .await
    }
}

// ============================================================================
// WEBHOOKS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredWebhook {
    pub id: String,
    pub name: String,
    pub url: String,
    pub events: String, // JSON
    pub secret: Option<String>,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
    pub synced: bool,
}

pub struct WebhookRepository<'a> {
    db: &'a Database,
}

impl<'a> WebhookRepository<'a> {
    /// Apply remote records without overwriting dirty local edits or pending deletes.
    /// Only callers with a complete, unfiltered response may remove absent records.
    pub async fn reconcile_remote(&self, items: &[StoredWebhook], complete: bool) -> StorageResult<()> {
        let ids = serde_json::to_string(&items.iter().map(|item| &item.id).collect::<Vec<_>>())
            .map_err(|e| StorageError::Query(e.to_string()))?;
        self.db.with_connection_mut(|conn| {
            let tx = conn.transaction().map_err(|e| StorageError::Query(e.to_string()))?;
            if complete {
                tx.execute("DELETE FROM webhooks WHERE synced=1 AND id NOT IN (SELECT value FROM json_each(?1)) AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type='webhook' AND entity_id=webhooks.id)", [&ids])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            for item in items {
                let deleted: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM sync_queue WHERE entity_type='webhook_delete' AND entity_id=?1)", [&item.id], |row| row.get(0))
                    .map_err(|e| StorageError::Query(e.to_string()))?;
                if deleted { continue; }
                tx.execute("INSERT INTO webhooks (id, name, url, events, secret, enabled, created_at, updated_at, synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, events=excluded.events, secret=excluded.secret, enabled=excluded.enabled, created_at=excluded.created_at, updated_at=excluded.updated_at, synced=excluded.synced WHERE webhooks.synced=1 AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type='webhook' AND entity_id=webhooks.id)", rusqlite::params![item.id, item.name, item.url, item.events, item.secret, item.enabled, item.created_at, item.updated_at, 1])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            tx.commit().map_err(|e| StorageError::Query(e.to_string()))
        }).await
    }

    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub async fn upsert(&self, entity: &StoredWebhook) -> StorageResult<()> {
        let enabled_int = if entity.enabled { 1 } else { 0 };
        let synced_int = if entity.synced { 1 } else { 0 };
        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                INSERT OR REPLACE INTO webhooks
                (id, name, url, events, secret, enabled, created_at, updated_at, synced)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                    rusqlite::params![
                        entity.id,
                        entity.name,
                        entity.url,
                        entity.events,
                        entity.secret,
                        enabled_int,
                        entity.created_at,
                        entity.updated_at,
                        synced_int
                    ],
                )
                .map_err(|e| StorageError::Query(format!("Failed to upsert webhook: {}", e)))?;
                Ok(())
            })
            .await
    }

    pub async fn get_all(&self) -> StorageResult<Vec<StoredWebhook>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare("SELECT id, name, url, events, secret, enabled, created_at, updated_at, synced FROM webhooks")
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok(StoredWebhook {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            url: row.get(2)?,
                            events: row.get(3)?,
                            secret: row.get(4)?,
                            enabled: row.get::<_, i32>(5)? != 0,
                            created_at: row.get(6)?,
                            updated_at: row.get(7)?,
                            synced: row.get::<_, i32>(8)? != 0,
                        })
                    })
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;
                Ok(rows)
            })
            .await
    }

    pub async fn delete(&self, id: &str) -> StorageResult<()> {
        let id_cloned = id.to_string();
        self.db
            .with_connection(move |conn| {
                conn.execute("DELETE FROM webhooks WHERE id = ?", [id_cloned])
                    .map_err(|e| StorageError::Query(format!("Failed to delete webhook: {}", e)))?;
                Ok(())
            })
            .await
    }
}

// ============================================================================
// DETECTION RULES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredDetectionRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub severity: String,
    pub conditions: String, // JSON array of conditions
    pub actions: String,    // JSON array of actions
    pub enabled: bool,
    pub created_at: String,
    pub last_match: Option<String>,
    pub match_count: i32,
    pub synced: bool,
}

pub struct DetectionRuleRepository<'a> {
    db: &'a Database,
}

impl<'a> DetectionRuleRepository<'a> {
    /// Apply a complete platform snapshot atomically. Pending local edits survive;
    /// only acknowledged records absent from the platform are deleted.
    pub async fn reconcile_snapshot(&self, items: &[StoredDetectionRule]) -> StorageResult<()> {
        let ids = serde_json::to_string(&items.iter().map(|item| &item.id).collect::<Vec<_>>())
            .map_err(|e| StorageError::Query(e.to_string()))?;
        self.db.with_connection_mut(|conn| {
            let tx = conn.transaction().map_err(|e| StorageError::Query(e.to_string()))?;
            tx.execute("DELETE FROM detection_rules WHERE synced = 1 AND id NOT IN (SELECT value FROM json_each(?1)) AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type = 'detection_rule' AND entity_id = detection_rules.id)", [&ids])
                .map_err(|e| StorageError::Query(e.to_string()))?;
            for item in items {
                let deleted: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM sync_queue WHERE entity_type = 'detection_rule_delete' AND entity_id = ?1)", [&item.id], |row| row.get(0))
                    .map_err(|e| StorageError::Query(e.to_string()))?;
                if deleted { continue; }
                tx.execute("INSERT INTO detection_rules (id, name, description, severity, conditions, actions, enabled, created_at, last_match, match_count, synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, severity=excluded.severity, conditions=excluded.conditions, actions=excluded.actions, enabled=excluded.enabled, created_at=excluded.created_at, last_match=excluded.last_match, match_count=excluded.match_count, synced=excluded.synced WHERE detection_rules.synced = 1 AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE entity_type = 'detection_rule' AND entity_id = detection_rules.id)", rusqlite::params![item.id, item.name, item.description, item.severity, item.conditions, item.actions, i32::from(item.enabled), item.created_at, item.last_match, item.match_count, 1])
                    .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            tx.commit().map_err(|e| StorageError::Query(e.to_string()))
        }).await
    }

    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub async fn upsert(&self, entity: &StoredDetectionRule) -> StorageResult<()> {
        let enabled_int = if entity.enabled { 1 } else { 0 };
        let synced_int = if entity.synced { 1 } else { 0 };
        self.db.with_connection(|conn| {
            conn.execute(
                r#"
                INSERT OR REPLACE INTO detection_rules
                (id, name, description, severity, conditions, actions, enabled, created_at, last_match, match_count, synced)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                rusqlite::params![
                    entity.id, entity.name, entity.description, entity.severity,
                    entity.conditions, entity.actions, enabled_int, entity.created_at,
                    entity.last_match, entity.match_count, synced_int
                ],
            ).map_err(|e| StorageError::Query(format!("Failed to upsert detection rule: {}", e)))?;
            Ok(())
        }).await
    }

    pub async fn get_all(&self) -> StorageResult<Vec<StoredDetectionRule>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare("SELECT id, name, description, severity, conditions, actions, enabled, created_at, last_match, match_count, synced FROM detection_rules").map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
            let rows = stmt.query_map([], |row| {
                Ok(StoredDetectionRule {
                    id: row.get(0)?, name: row.get(1)?, description: row.get(2)?,
                    severity: row.get(3)?, conditions: row.get(4)?, actions: row.get(5)?,
                    enabled: row.get::<_, i32>(6)? != 0,
                    created_at: row.get(7)?, last_match: row.get(8)?,
                    match_count: row.get(9)?,
                    synced: row.get::<_, i32>(10)? != 0,
                })
            }).map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
            .collect::<Result<Vec<_>, _>>().map_err(|e| StorageError::Query(format!("Failed to collect results: {}", e)))?;
            Ok(rows)
        }).await
    }

    pub async fn delete(&self, id: &str) -> StorageResult<()> {
        let id_cloned = id.to_string();
        self.db
            .with_connection(move |conn| {
                conn.execute("DELETE FROM detection_rules WHERE id = ?", [id_cloned])
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete detection rule: {}", e))
                    })?;
                Ok(())
            })
            .await
    }
}

// ============================================================================
// SOFTWARE INVENTORY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSoftwareInventory {
    pub id: String,
    pub hostname: String,
    pub software_name: String,
    pub version: String,
    pub vendor: String,
    pub install_date: Option<String>,
    pub synced: bool,
}

pub struct SoftwareInventoryRepository<'a> {
    db: &'a Database,
}

impl<'a> SoftwareInventoryRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub async fn upsert(&self, entity: &StoredSoftwareInventory) -> StorageResult<()> {
        let synced_int = if entity.synced { 1 } else { 0 };
        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                INSERT OR REPLACE INTO software_inventory
                (id, hostname, software_name, version, vendor, install_date, synced)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                "#,
                    rusqlite::params![
                        entity.id,
                        entity.hostname,
                        entity.software_name,
                        entity.version,
                        entity.vendor,
                        entity.install_date,
                        synced_int
                    ],
                )
                .map_err(|e| {
                    StorageError::Query(format!("Failed to upsert software inventory: {}", e))
                })?;
                Ok(())
            })
            .await
    }

    pub async fn get_all(&self) -> StorageResult<Vec<StoredSoftwareInventory>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare("SELECT * FROM software_inventory")
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok(StoredSoftwareInventory {
                            id: row.get(0)?,
                            hostname: row.get(1)?,
                            software_name: row.get(2)?,
                            version: row.get(3)?,
                            vendor: row.get(4)?,
                            install_date: row.get(5)?,
                            synced: row.get::<_, i32>(6)? != 0,
                        })
                    })
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;
                Ok(rows)
            })
            .await
    }

    pub async fn delete(&self, id: &str) -> StorageResult<()> {
        let id_cloned = id.to_string();
        self.db
            .with_connection(move |conn| {
                conn.execute("DELETE FROM software_inventory WHERE id = ?", [id_cloned])
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete software inventory: {}", e))
                    })?;
                Ok(())
            })
            .await
    }
}
