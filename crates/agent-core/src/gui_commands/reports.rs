// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Reports and exports produced for the interface.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{debug, info, warn};

use super::CommandContext;

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    match command {
        GuiCommand::ExportSbom => export_sbom(ctx).await,
        GuiCommand::GenerateReport {
            report_type,
            framework,
        } => generate_report(ctx, report_type, framework).await,
        GuiCommand::ExportReportHtml { report_id } => export_report_html(report_id).await,
        GuiCommand::ExportCsvAuditTrail => export_csv_audit_trail().await,
        other => super::misrouted("reports", &other),
    }
}

/// Set the log level.
/// Write the software bill of materials (CycloneDX) of the last
/// vulnerability scan to the export folder.
async fn export_sbom(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested the SBOM export");
    let tx = ctx.events.clone();
    let cache = ctx.handle.state.last_vuln_findings.clone();
    tokio::spawn(async move {
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
                    agent_gui::dto::GuiNotification::error("Export SBOM impossible", e.to_string())
                }
            },
        };
        let _ = tx.send(AgentEvent::Notification { notification });
    });
}

/// Generate a report.
async fn generate_report(
    ctx: &mut CommandContext,
    report_type: agent_gui::dto::ReportType,
    framework: Option<String>,
) {
    info!(
        "[AUDIT] GUI requested report: {:?} framework={:?}",
        report_type, framework
    );
    let tx = ctx.events.clone();
    let svc = ctx.llm_service.clone();
    let fw = framework.clone();
    tokio::spawn(async move {
        let report_id = uuid::Uuid::new_v4();
        let title = match report_type {
            agent_gui::dto::ReportType::Executive => {
                format!(
                    "Rapport exécutif — {}",
                    chrono::Utc::now().format("%d/%m/%Y")
                )
            }
            agent_gui::dto::ReportType::ComplianceAudit => {
                format!(
                    "Audit de conformité{} — {}",
                    fw.as_deref()
                        .map(|f| format!(" ({})", f))
                        .unwrap_or_default(),
                    chrono::Utc::now().format("%d/%m/%Y")
                )
            }
            agent_gui::dto::ReportType::Incident => {
                format!(
                    "Rapport d'incidents — {}",
                    chrono::Utc::now().format("%d/%m/%Y")
                )
            }
        };

        // Build a base summary (static template)
        let base_summary = format!(
            "Rapport {} généré le {}.",
            report_type.label_fr(),
            chrono::Utc::now().format("%d/%m/%Y à %H:%M UTC")
        );

        // Attempt LLM-generated executive summary
        #[allow(unused_mut)]
        let mut summary = base_summary.clone();
        #[cfg(feature = "llm")]
        {
            if let Some(ref svc) = svc
                && let Some(manager) = svc.get_manager().await
            {
                let prompt = format!(
                    "Tu es un analyste GRC. Génère un résumé exécutif professionnel \
                     en français (3-5 phrases) pour un rapport de type « {} »{}. \
                     Le rapport est daté du {}. Sois concis et orienté décision.",
                    report_type.label_fr(),
                    fw.as_deref()
                        .map(|f| format!(", référentiel {}", f))
                        .unwrap_or_default(),
                    chrono::Utc::now().format("%d/%m/%Y")
                );
                let req = agent_llm::engine::InferenceRequest::new(&prompt)
                    .with_max_tokens(512)
                    .with_temperature(0.5);
                match manager.engine().infer(req).await {
                    Ok(resp) if !resp.text.trim().is_empty() => {
                        summary = resp.text.trim().to_string();
                        debug!("Report summary generated by LLM ({} chars)", summary.len());
                    }
                    Ok(_) => {
                        debug!("LLM returned empty summary, using static template");
                    }
                    Err(e) => {
                        warn!("LLM report summary generation failed: {}", e);
                    }
                }
            }
        }
        let _ = &svc; // suppress unused-variable warning when llm feature is off

        let html_content = format!(
            "<h1>{}</h1><p>{}</p><footer>Généré par Sentinel GRC Agent</footer>",
            title, summary
        );

        let report = agent_gui::dto::GeneratedReport {
            id: report_id,
            report_type,
            title,
            generated_at: chrono::Utc::now(),
            html_content,
            summary,
            compliance_score: None,
            framework: fw,
        };

        let _ = tx.send(AgentEvent::ReportGenerated {
            report: Box::new(report),
        });
    });
}

/// Export a report as HTML file.
async fn export_report_html(report_id: String) {
    info!(
        "[AUDIT] GUI requested HTML export for report: {}",
        report_id
    );
}

/// Export audit trail to CSV.
async fn export_csv_audit_trail() {
    info!("[AUDIT] GUI requested audit trail CSV export");
    // CSV export is handled client-side in the GUI
}
