//! Durable command results, separate from the evictable telemetry queue.
use crate::{Database, StorageError, StorageResult};

pub struct CommandResultRepository<'a> {
    db: &'a Database,
    agent_id: &'a str,
}
impl<'a> CommandResultRepository<'a> {
    pub fn new(db: &'a Database, agent_id: &'a str) -> Self {
        Self { db, agent_id }
    }
    /// Keep the first outcome immutable. A different outcome for the same command
    /// is an error, not permission to overwrite an outcome awaiting delivery.
    pub async fn store(&self, id: &str, payload: &str) -> StorageResult<()> {
        self.db.with_connection_mut(|conn| {
            let tx = conn.transaction().map_err(|e| StorageError::Query(e.to_string()))?;
            tx.execute("INSERT OR IGNORE INTO command_result_outbox (command_id,payload,agent_id) VALUES (?1,?2,?3)", [id,payload,self.agent_id])
                .map_err(|e| StorageError::Query(e.to_string()))?;
            let saved: String = tx.query_row("SELECT payload FROM command_result_outbox WHERE command_id=?1 AND agent_id=?2", [id,self.agent_id], |r| r.get(0))
                .map_err(|e| StorageError::Query(e.to_string()))?;
            if saved != payload { return Err(StorageError::Query("Conflicting command outcome".into())); }
            tx.commit().map_err(|e| StorageError::Query(e.to_string()))
        }).await
    }
    pub async fn pending(&self, limit: usize) -> StorageResult<Vec<(String, String)>> {
        self.db.with_connection(|conn| {
            let mut query=conn.prepare("SELECT command_id,payload FROM command_result_outbox WHERE agent_id=?2 ORDER BY last_attempt_at,created_at,command_id LIMIT ?1")
                .map_err(|e| StorageError::Query(e.to_string()))?;
            query.query_map(rusqlite::params![limit as i64,self.agent_id],|r| Ok((r.get(0)?,r.get(1)?)))
                .map_err(|e| StorageError::Query(e.to_string()))?
                .collect::<Result<Vec<_>,_>>().map_err(|e| StorageError::Query(e.to_string()))
        }).await
    }
    /// Rotate attempted entries so a permanently rejected result cannot starve newer results.
    pub async fn mark_attempt(&self, id: &str) -> StorageResult<()> {
        self.db.with_connection(|conn| {
            conn.execute("UPDATE command_result_outbox SET last_attempt_at=CAST(strftime('%s','now') AS INTEGER) WHERE command_id=?1 AND agent_id=?2", [id,self.agent_id])
                .map_err(|e| StorageError::Query(e.to_string()))?;
            Ok(())
        }).await
    }
    pub async fn count(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM command_result_outbox WHERE agent_id=?1",
                    [self.agent_id],
                    |row| row.get(0),
                )
                .map_err(|e| StorageError::Query(e.to_string()))
            })
            .await
    }
    pub async fn acknowledge(&self, id: &str, payload: &str) -> StorageResult<()> {
        self.db.with_connection(|conn| {
            conn.execute("DELETE FROM command_result_outbox WHERE command_id=?1 AND payload=?2 AND agent_id=?3", [id,payload,self.agent_id])
                .map_err(|e| StorageError::Query(e.to_string()))?;
            Ok(())
        }).await
    }
}
