//! Read-only live inventory of packages installed with pip, npm -g and
//! cargo install; nothing is uploaded or looked up.
use agent_scanner::vulnerability::language_scanner::LanguagePackageScanner;
use agent_scanner::vulnerability::package_scanner::PackageScanner;
use std::collections::BTreeMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let packages = LanguagePackageScanner::new().installed_packages().await?;
    let mut by_ecosystem: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for package in &packages {
        by_ecosystem
            .entry(package.ecosystem.clone().unwrap_or_default())
            .or_default()
            .push(format!("{}@{}", package.name, package.version));
    }
    let summary: BTreeMap<&String, serde_json::Value> = by_ecosystem
        .iter()
        .map(|(ecosystem, names)| {
            (
                ecosystem,
                serde_json::json!({ "count": names.len(), "sample": names.iter().take(3).collect::<Vec<_>>() }),
            )
        })
        .collect();
    println!(
        "{}",
        serde_json::json!({ "total": packages.len(), "ecosystems": summary })
    );
    Ok(())
}
