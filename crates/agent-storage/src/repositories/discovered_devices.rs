//! Repository for persisting discovered network devices.

use crate::database::Database;
use crate::error::{StorageError, StorageResult};
use chrono::{DateTime, Utc};
use rusqlite::Row;
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

/// A discovered network device stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredDevice {
    pub ip: String,
    pub mac: Option<String>,
    pub hostname: Option<String>,
    pub vendor: Option<String>,
    pub device_type: String,
    pub open_ports: Vec<u16>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub is_gateway: bool,
    pub subnet: String,
}

/// Repository for discovered devices.
pub struct DiscoveredDevicesRepository<'a> {
    db: &'a Database,
}

impl<'a> DiscoveredDevicesRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Upsert multiple devices in a batch.
    pub async fn upsert_batch(&self, devices: &[StoredDevice]) -> StorageResult<usize> {
        let devices = devices.to_vec();
        self.db
            .with_connection(move |conn| {
                let mut count = 0;

                for device in &devices {
                    let open_ports_json = serde_json::to_string(&device.open_ports).unwrap_or_default();

                    conn.execute(
                        r#"
                        INSERT INTO discovered_devices (ip, mac, hostname, vendor, device_type, open_ports, first_seen, last_seen, is_gateway, subnet)
                        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                        ON CONFLICT(ip) DO UPDATE SET
                            mac = COALESCE(?2, mac),
                            hostname = COALESCE(?3, hostname),
                            vendor = COALESCE(?4, vendor),
                            device_type = ?5,
                            open_ports = ?6,
                            last_seen = ?8,
                            is_gateway = ?9,
                            subnet = ?10
                        "#,
                        rusqlite::params![
                            device.ip,
                            device.mac,
                            device.hostname,
                            device.vendor,
                            device.device_type,
                            open_ports_json,
                            device.first_seen.to_rfc3339(),
                            device.last_seen.to_rfc3339(),
                            device.is_gateway as i32,
                            device.subnet,
                        ],
                    ).map_err(|e| StorageError::Query(format!("Failed to upsert device: {}", e)))?;
                    count += 1;
                }

                info!("Upserted {} discovered devices", count);
                Ok(count)
            })
            .await
    }

    /// Get all discovered devices.
    pub async fn get_all(&self) -> StorageResult<Vec<StoredDevice>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT ip, mac, hostname, vendor, device_type, open_ports, first_seen, last_seen, is_gateway, subnet
                        FROM discovered_devices
                        ORDER BY last_seen DESC
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let devices = stmt
                    .query_map([], Self::row_to_device)
                    .map_err(|e| StorageError::Query(format!("Failed to query devices: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| StorageError::Query(format!("Failed to collect devices: {}", e)))?;

                debug!("Retrieved {} devices from database", devices.len());
                Ok(devices)
            })
            .await
    }

    /// Count total discovered devices.
    pub async fn count(&self) -> StorageResult<usize> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM discovered_devices", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count devices: {}", e)))?;
                Ok(count as usize)
            })
            .await
    }

    /// Delete devices not seen since the given timestamp.
    pub async fn delete_stale(&self, older_than: DateTime<Utc>) -> StorageResult<usize> {
        let older_than_str = older_than.to_rfc3339();
        self.db
            .with_connection(move |conn| {
                let deleted = conn
                    .execute(
                        "DELETE FROM discovered_devices WHERE last_seen < ?1",
                        [&older_than_str],
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to delete stale devices: {}", e)))?;
                info!("Deleted {} stale devices", deleted);
                Ok(deleted)
            })
            .await
    }

    /// Convert a database row to a StoredDevice.
    fn row_to_device(row: &Row<'_>) -> rusqlite::Result<StoredDevice> {
        let open_ports_json: String = row.get(5)?;
        let open_ports: Vec<u16> = serde_json::from_str(&open_ports_json).unwrap_or_default();
        let first_seen_str: String = row.get(6)?;
        let last_seen_str: String = row.get(7)?;

        Ok(StoredDevice {
            ip: row.get(0)?,
            mac: row.get(1)?,
            hostname: row.get(2)?,
            vendor: row.get(3)?,
            device_type: row.get(4)?,
            open_ports,
            first_seen: DateTime::parse_from_rfc3339(&first_seen_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            last_seen: DateTime::parse_from_rfc3339(&last_seen_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            is_gateway: row.get::<_, i32>(8)? != 0,
            subnet: row.get(9)?,
        })
    }
}
