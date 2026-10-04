//! Scan files with YARA rules through the `sentinel-yara` helper, as the
//! agent does; prints the incident each matching file would raise.
//!
//! ```sh
//! (cd tools/sentinel-yara && cargo build)
//! cargo run -p agent-scanner --example live_yara_scan -- \
//!     tools/sentinel-yara/target/debug/sentinel-yara <rules dir> <file>...
//! ```
use agent_scanner::security::yara::{YaraScanner, incident};
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let (Some(helper), Some(rules)) = (args.next(), args.next()) else {
        return Err("usage: <helper> <rules dir> <file>...".into());
    };
    let (mut scanner, report) = YaraScanner::start(Path::new(&helper), Path::new(&rules))?;
    println!("rules: {}, refused: {:?}", report.rules, report.errors);
    for file in args {
        match scanner.scan(Path::new(&file)) {
            Ok(matches) => match incident(Path::new(&file), &matches) {
                Some(found) => println!(
                    "{file}: {:?} — {} — {}",
                    found.severity, found.title, found.description
                ),
                None => println!("{file}: clean"),
            },
            Err(e) => println!("{file}: not scanned ({e})"),
        }
    }
    Ok(())
}
