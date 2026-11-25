// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Reports and exports produced for the interface.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{info, warn};

use super::{CommandContext, expected};

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    match command {
        GuiCommand::ExportSbom => export_sbom(ctx).await,
        GuiCommand::ExportCsvAuditTrail => export_csv_audit_trail().await,
        other => super::misrouted("reports", &other),
    }
}

/// Write the software bill of materials (CycloneDX) of the last
/// vulnerability scan to the export folder.
async fn export_sbom(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested the SBOM export");
    let tx = ctx.events.clone();
    let cache = ctx.handle.state.last_vuln_findings.clone();
    ctx.tasks
        .spawn_expected("export sbom", expected::SHORT, async move {
            let scan = cache.read().await.clone();
            let notification = match scan {
                None => agent_gui::dto::GuiNotification::error(
                    "Export SBOM impossible",
                    "Aucun inventaire disponible : lancez d'abord une analyse des vulnérabilités.",
                ),
                Some(scan) => match agent_core::export_sbom(&scan).await {
                    Ok(path) => agent_gui::dto::GuiNotification::info(
                        "SBOM exporté",
                        format!(
                            "{} composants, {} vulnérabilités : {}",
                            scan.packages.len(),
                            scan.vulnerabilities.len(),
                            path.display()
                        ),
                    ),
                    Err(e) => {
                        warn!("SBOM export failed: {}", e);
                        agent_gui::dto::GuiNotification::error(
                            "Export SBOM impossible",
                            e.to_string(),
                        )
                    }
                },
            };
            let _ = tx.send(AgentEvent::Notification { notification });
        });
}

/// Export audit trail to CSV.
async fn export_csv_audit_trail() {
    info!("[AUDIT] GUI requested audit trail CSV export");
    // CSV export is handled client-side in the GUI
}
