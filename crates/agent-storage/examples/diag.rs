use rusqlite::Connection;
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_paths = [
        "C:\\ProgramData\\Sentinel\\data\\agent.db",
        "agent.db",
        "data/agent.db",
    ];

    let mut found = false;
    for path in &db_paths {
        if Path::new(path).exists() {
            println!("Opening database at: {}", path);
            let conn = Connection::open(path)?;
            
            // Check schema version
            let version: i32 = conn.query_row(
                "SELECT MAX(version) FROM schema_version",
                [],
                |row| row.get(0)
            )?;
            println!("Database Schema Version: {}", version);

            // Check software inventory count
            let sw_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM software_inventory",
                [],
                |row| row.get(0)
            )?;
            println!("Software Inventory Count: {}", sw_count);

            // Check if hostname is populated in software_inventory
            let hostname_populated: i64 = conn.query_row(
                "SELECT COUNT(*) FROM software_inventory WHERE hostname IS NOT NULL",
                [],
                |row| row.get(0)
            )?;
            println!("Software entries with hostname: {}", hostname_populated);

            // Check compliance results
            let check_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM check_results",
                [],
                |row| row.get(0)
            )?;
            println!("Compliance Check Results Count: {}", check_count);

            // Print last 5 checks
            println!("\nLast 5 Compliance Checks:");
            let mut stmt = conn.prepare("SELECT check_id, status, message FROM check_results ORDER BY timestamp DESC LIMIT 5")?;
            let rows = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
            })?;
            for row in rows {
                let (id, status, msg) = row?;
                println!("- {}: [{}] {}", id, status, msg);
            }

            found = true;
            break;
        }
    }

    if !found {
        println!("Could not find agent.db in common locations.");
    }

    Ok(())
}
