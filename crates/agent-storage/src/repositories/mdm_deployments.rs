// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! History of the software deployments the platform ordered on this
//! machine: what was asked, from where, and how it ended.
//!
//! One row per deployment command, updated as the command moves from
//! received to started to its outcome. The table is capped: the oldest rows
//! go when it holds more than [`MAX_DEPLOYMENTS`].

use crate::database::Database;
use crate::error::{StorageError, StorageResult};
use chrono::{DateTime, Utc};
use rusqlite::Row;
use serde::{Deserialize, Serialize};

/// Rows kept. A machine receives a handful of deployments a month: this is
/// years of history, and still a table read in one go.
pub const MAX_DEPLOYMENTS: usize = 500;

/// Where a deployment command stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MdmDeploymentStatus {
    /// Received from the platform, not yet examined.
    Received,
    /// Admitted and running.
    Started,
    /// Ended well.
    Succeeded,
    /// Ran, or tried to, and did not end well.
    Failed,
    /// Refused by this machine before anything ran.
    Refused,
}

impl MdmDeploymentStatus {
    /// The value stored in the table.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Received => "received",
            Self::Started => "started",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Refused => "refused",
        }
    }

    /// The status a stored value names; an unknown one reads as received.
    pub fn parse(value: &str) -> Self {
        match value {
            "started" => Self::Started,
            "succeeded" => Self::Succeeded,
            "failed" => Self::Failed,
            "refused" => Self::Refused,
            _ => Self::Received,
        }
    }

    /// Whether the command is over.
    pub fn is_final(self) -> bool {
        matches!(self, Self::Succeeded | Self::Failed | Self::Refused)
    }
}

/// One deployment command as the table keeps it. Never the install
/// arguments, which may carry a licence key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StoredMdmDeployment {
    /// Identifier of the platform command: the key of the row.
    pub id: String,
    /// Deployment the command belongs to on the platform, when it names one.
    pub deployment_id: Option<String>,
    /// Software document on the platform.
    pub software_id: Option<String>,
    /// Name of the package, when the command carries it.
    pub package_name: Option<String>,
    /// Version asked for.
    pub version: Option<String>,
    /// `install`, `update` or `uninstall`.
    pub action: String,
    /// Installer format (`msi`, `pkg`, `deb`…).
    pub method: Option<String>,
    /// Where the package comes from.
    pub source: Option<String>,
    pub status: MdmDeploymentStatus,
    pub requested_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    /// Outcome in words: the installer's last lines or the error.
    pub message: Option<String>,
    /// What refused the command on this machine (a setting, a check).
    pub refused_by: Option<String>,
}

/// Repository of the deployment history.
pub struct MdmDeploymentsRepository<'a> {
    db: &'a Database,
}

impl<'a> MdmDeploymentsRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Write a deployment, or move the one with the same `id` forward. The
    /// time the command was received is kept from the first write; the
    /// table is then pruned to [`MAX_DEPLOYMENTS`].
    pub async fn record(&self, deployment: &StoredMdmDeployment) -> StorageResult<()> {
        let d = deployment.clone();
        self.db
            .with_connection(move |conn| {
                conn.execute(
                    r#"
                    INSERT INTO mdm_deployments (
                        id, deployment_id, software_id, package_name, version, action,
                        method, source, status, requested_at, finished_at, message, refused_by
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                    ON CONFLICT(id) DO UPDATE SET
                        deployment_id = COALESCE(?2, deployment_id),
                        software_id = COALESCE(?3, software_id),
                        package_name = COALESCE(?4, package_name),
                        version = COALESCE(?5, version),
                        action = ?6,
                        method = COALESCE(?7, method),
                        source = COALESCE(?8, source),
                        status = ?9,
                        finished_at = ?11,
                        message = ?12,
                        refused_by = ?13
                    "#,
                    rusqlite::params![
                        d.id,
                        d.deployment_id,
                        d.software_id,
                        d.package_name,
                        d.version,
                        d.action,
                        d.method,
                        d.source,
                        d.status.as_str(),
                        d.requested_at.to_rfc3339(),
                        d.finished_at.map(|at| at.to_rfc3339()),
                        d.message,
                        d.refused_by,
                    ],
                )
                .map_err(|e| {
                    StorageError::Query(format!("Failed to record MDM deployment: {}", e))
                })?;
                prune(conn, MAX_DEPLOYMENTS)?;
                Ok(())
            })
            .await
    }

    /// The `limit` most recent deployments, newest first.
    pub async fn recent(&self, limit: usize) -> StorageResult<Vec<StoredMdmDeployment>> {
        let limit = i64::try_from(limit).unwrap_or(i64::MAX);
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, deployment_id, software_id, package_name, version, action,
                               method, source, status, requested_at, finished_at, message,
                               refused_by
                        FROM mdm_deployments
                        ORDER BY requested_at DESC, rowid DESC
                        LIMIT ?1
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;
                let rows = stmt
                    .query_map([limit], row_to_deployment)
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to query MDM deployments: {}", e))
                    })?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to read MDM deployments: {}", e))
                    })?;
                Ok(rows)
            })
            .await
    }

    /// Keep the `keep` most recent deployments; returns how many went.
    pub async fn prune(&self, keep: usize) -> StorageResult<usize> {
        self.db.with_connection(move |conn| prune(conn, keep)).await
    }
}

fn prune(conn: &rusqlite::Connection, keep: usize) -> StorageResult<usize> {
    let keep = i64::try_from(keep).unwrap_or(i64::MAX);
    conn.execute(
        r#"
        DELETE FROM mdm_deployments
        WHERE id NOT IN (
            SELECT id FROM mdm_deployments
            ORDER BY requested_at DESC, rowid DESC
            LIMIT ?1
        )
        "#,
        [keep],
    )
    .map_err(|e| StorageError::Query(format!("Failed to prune MDM deployments: {}", e)))
}

fn parse_time(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .map(|at| at.with_timezone(&Utc))
        .ok()
}

fn row_to_deployment(row: &Row<'_>) -> rusqlite::Result<StoredMdmDeployment> {
    let status: String = row.get(8)?;
    let requested_at: String = row.get(9)?;
    let finished_at: Option<String> = row.get(10)?;
    Ok(StoredMdmDeployment {
        id: row.get(0)?,
        deployment_id: row.get(1)?,
        software_id: row.get(2)?,
        package_name: row.get(3)?,
        version: row.get(4)?,
        action: row.get(5)?,
        method: row.get(6)?,
        source: row.get(7)?,
        status: MdmDeploymentStatus::parse(&status),
        requested_at: parse_time(&requested_at).unwrap_or_else(|| {
            tracing::warn!("Unreadable MDM deployment time '{}'", requested_at);
            Utc::now()
        }),
        finished_at: finished_at.as_deref().and_then(parse_time),
        message: row.get(11)?,
        refused_by: row.get(12)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseConfig, KeyManager};

    fn open() -> (tempfile::TempDir, Database) {
        let dir = tempfile::tempdir().unwrap();
        let key = KeyManager::new_with_key(b"01234567890123456789012345678901");
        let db =
            Database::open(DatabaseConfig::with_path(dir.path().join("test.db")), &key).unwrap();
        (dir, db)
    }

    fn at(minute: i64) -> DateTime<Utc> {
        parse_time("2026-11-20T09:00:00+00:00").unwrap() + chrono::Duration::minutes(minute)
    }

    fn deployment(id: &str, minute: i64) -> StoredMdmDeployment {
        StoredMdmDeployment {
            id: id.to_string(),
            deployment_id: Some(format!("dep-{id}")),
            software_id: Some("sw-1".to_string()),
            package_name: Some("7-Zip".to_string()),
            version: Some("24.08".to_string()),
            action: "install".to_string(),
            method: Some("msi".to_string()),
            source: Some("https://cdn.example.com/7zip.msi".to_string()),
            status: MdmDeploymentStatus::Received,
            requested_at: at(minute),
            finished_at: None,
            message: None,
            refused_by: None,
        }
    }

    #[tokio::test]
    async fn a_deployment_moves_forward_in_its_own_row() {
        let (_dir, db) = open();
        let repo = MdmDeploymentsRepository::new(&db);
        let received = deployment("cmd-1", 0);
        repo.record(&received).await.unwrap();

        // The outcome is written later, by a caller that only knows the end.
        let done = StoredMdmDeployment {
            status: MdmDeploymentStatus::Failed,
            requested_at: at(5),
            finished_at: Some(at(6)),
            message: Some("checksum mismatch".to_string()),
            package_name: None,
            ..received.clone()
        };
        repo.record(&done).await.unwrap();

        let rows = repo.recent(10).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].status, MdmDeploymentStatus::Failed);
        assert!(rows[0].status.is_final());
        // Received at the first write, whatever later writes say.
        assert_eq!(rows[0].requested_at, at(0));
        assert_eq!(rows[0].finished_at, Some(at(6)));
        assert_eq!(rows[0].message.as_deref(), Some("checksum mismatch"));
        // A later write that does not know the name keeps it.
        assert_eq!(rows[0].package_name.as_deref(), Some("7-Zip"));
    }

    #[tokio::test]
    async fn a_refusal_names_what_refused() {
        let (_dir, db) = open();
        let repo = MdmDeploymentsRepository::new(&db);
        repo.record(&StoredMdmDeployment {
            status: MdmDeploymentStatus::Refused,
            finished_at: Some(at(0)),
            message: Some("software deployment is disabled".to_string()),
            refused_by: Some("mdm_enabled".to_string()),
            ..deployment("cmd-2", 0)
        })
        .await
        .unwrap();
        let rows = repo.recent(10).await.unwrap();
        assert_eq!(rows[0].status, MdmDeploymentStatus::Refused);
        assert_eq!(rows[0].refused_by.as_deref(), Some("mdm_enabled"));
    }

    #[tokio::test]
    async fn the_history_is_newest_first_and_capped() {
        let (_dir, db) = open();
        let repo = MdmDeploymentsRepository::new(&db);
        for minute in 0..6 {
            repo.record(&deployment(&format!("cmd-{minute}"), minute))
                .await
                .unwrap();
        }
        let rows = repo.recent(3).await.unwrap();
        assert_eq!(
            rows.iter().map(|d| d.id.as_str()).collect::<Vec<_>>(),
            ["cmd-5", "cmd-4", "cmd-3"]
        );

        assert_eq!(repo.prune(2).await.unwrap(), 4);
        let rows = repo.recent(10).await.unwrap();
        assert_eq!(
            rows.iter().map(|d| d.id.as_str()).collect::<Vec<_>>(),
            ["cmd-5", "cmd-4"]
        );
    }

    #[test]
    fn a_status_reads_back_as_written() {
        for status in [
            MdmDeploymentStatus::Received,
            MdmDeploymentStatus::Started,
            MdmDeploymentStatus::Succeeded,
            MdmDeploymentStatus::Failed,
            MdmDeploymentStatus::Refused,
        ] {
            assert_eq!(MdmDeploymentStatus::parse(status.as_str()), status);
        }
        assert_eq!(
            MdmDeploymentStatus::parse("???"),
            MdmDeploymentStatus::Received
        );
    }
}
