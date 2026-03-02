use rusqlite::{Connection, Result};
use std::path::Path;

fn main() -> Result<()> {
    let db_path = r"C:\ProgramData\Sentinel\data\agent.db";
    let conn = Connection::open(db_path)?;

    println!("--- Database Tables ---");
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")?;
    let table_names = stmt.query_map([], |row| row.get::<_, String>(0))?;

    for name in table_names {
        let name = name?;
        let count: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM {}", name), [], |row| row.get(0))?;
        println!("Table: {:<25} Count: {}", name, count);
    }

    println!("\n--- Software Inventory (Sample) ---");
    let mut stmt = conn.prepare("SELECT hostname, software_name, version FROM software_inventory LIMIT 5")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    for row in rows {
        let (host, name, ver) = row?;
        println!("Host: {:<15} App: {:<30} Ver: {}", host, name, ver);
    }

    println!("\n--- Vulnerabilities (Sample) ---");
    // Check if table exists first
    let table_exists: i64 = conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='vulnerabilities'",
        [],
        |row| row.get(0),
    )?;

    if table_exists > 0 {
        let mut stmt = conn.prepare("SELECT package_name, vulnerability_id, severity FROM vulnerabilities LIMIT 5")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        for row in rows {
            let (pkg, id, sev) = row?;
            println!("Package: {:<20} ID: {:<15} Severity: {}", pkg, id, sev);
        }
    } else {
        println!("Table 'vulnerabilities' does not exist.");
    }

    println!("\n--- Check Results (Sample) ---");
    let mut stmt = conn.prepare("SELECT check_id, status, last_run FROM check_results LIMIT 5")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    for row in rows {
        let (id, status, last) = row?;
        println!("Check: {:<25} Status: {:<10} Last: {}", id, status, last);
    }

    Ok(())
}
