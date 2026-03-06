use rusqlite::{Connection, Result};

fn main() -> Result<()> {
    let db_path = r"C:\ProgramData\Sentinel\data\agent.db";
    println!("Opening database at: {}", db_path);

    let conn = Connection::open(db_path)?;

    println!("--- Database Tables ---");
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")?;
    let table_names = stmt.query_map([], |row| row.get::<_, String>(0))?;

    for name in table_names {
        let name = name?;
        match conn.query_row(&format!("SELECT COUNT(*) FROM {}", name), [], |row| {
            row.get::<_, i64>(0)
        }) {
            Ok(count) => println!("Table: {:<25} Count: {}", name, count),
            Err(e) => println!("Table: {:<25} Error: {}", name, e),
        }
    }

    println!("\n--- Software Inventory Columns ---");
    let mut stmt = conn.prepare("PRAGMA table_info(software_inventory)")?;
    let cols = stmt.query_map([], |row| {
        Ok(format!(
            "{}: {}",
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?
        ))
    })?;
    for col in cols {
        println!("  Column: {}", col?);
    }

    println!("\n--- Software Inventory (Sample) ---");
    // Try to query normally, but check if columns exist first via the PRAGMA above
    match conn.prepare("SELECT * FROM software_inventory LIMIT 5") {
        Ok(mut stmt) => {
            let column_count = stmt.column_count();
            let column_names: Vec<String> = stmt
                .column_names()
                .into_iter()
                .map(|s| s.to_string())
                .collect();
            println!("Columns found: {:?}", column_names);

            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                for i in 0..column_count {
                    let val: rusqlite::types::Value = row.get(i)?;
                    print!("{}: {:?} | ", column_names[i], val);
                }
                println!();
            }
        }
        Err(e) => println!("Failed to query software_inventory: {}", e),
    }

    println!("\n--- Check Results (Sample) ---");
    match conn.prepare("SELECT check_rule_id, status, executed_at FROM check_results LIMIT 5") {
        Ok(mut stmt) => {
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let id: String = row.get(0)?;
                let status: String = row.get(1)?;
                let last: String = row.get(2)?;
                println!("Check: {:<25} Status: {:<10} Last: {}", id, status, last);
            }
        }
        Err(e) => println!("Failed to query check_results: {}", e),
    }

    Ok(())
}
