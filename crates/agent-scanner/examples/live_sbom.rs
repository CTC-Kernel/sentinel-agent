//! Read-only live SBOM: inventories the installed packages (no CVE lookup,
//! nothing leaves the host) and prints the CycloneDX document.
use agent_scanner::vulnerability::sbom::{SbomSubject, cyclonedx};
use agent_scanner::{ScanType, VulnerabilityScanner};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let scan = VulnerabilityScanner::new().scan(ScanType::Packages).await?;
    let document = cyclonedx(
        &scan,
        &SbomSubject {
            hostname: "live-example".to_string(),
            os: None,
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
        },
        uuid::Uuid::new_v4(),
        chrono::Utc::now(),
    );
    println!("{}", serde_json::to_string(&document)?);
    Ok(())
}
