//! MITRE ATT&CK mapping for EDR detections.

use crate::dto::{MitreTactic, MitreTechnique};
use crate::theme;
use crate::widgets;

/// Map a detection (kind + subtype) to a MITRE ATT&CK technique.
pub(super) fn mitre_mapping(kind: &str, subtype: &str) -> Option<MitreTechnique> {
    let sub = subtype.to_ascii_lowercase();
    match kind {
        "process" => {
            if sub.contains("powershell") {
                Some(MitreTechnique { id: "T1059.001", name_fr: "Interpr\u{00e9}teur PowerShell", tactic: MitreTactic::Execution })
            } else if sub.contains("reverse") || sub.contains("netcat") || sub.contains("ncat") || sub.contains("nc ") {
                Some(MitreTechnique { id: "T1059.004", name_fr: "Shell Unix/Reverse shell", tactic: MitreTactic::Execution })
            } else if sub.contains("curl") || sub.contains("wget") {
                Some(MitreTechnique { id: "T1105", name_fr: "Transfert d'outils", tactic: MitreTactic::CommandAndControl })
            } else if sub.contains("certutil") || sub.contains("mshta") || sub.contains("regsvr32") {
                Some(MitreTechnique { id: "T1218", name_fr: "Ex\u{00e9}cution via proxy binaire", tactic: MitreTactic::DefenseEvasion })
            } else if sub.contains("macro") || sub.contains("office") {
                Some(MitreTechnique { id: "T1204.002", name_fr: "Fichier malveillant", tactic: MitreTactic::Execution })
            } else {
                None
            }
        }
        "system" => {
            if sub.contains("crypto_miner") || sub.contains("miner") {
                Some(MitreTechnique { id: "T1496", name_fr: "D\u{00e9}tournement de ressources", tactic: MitreTactic::Impact })
            } else if sub.contains("credential") {
                Some(MitreTechnique { id: "T1003", name_fr: "Extraction d'identifiants", tactic: MitreTactic::CredentialAccess })
            } else if sub.contains("privilege") || sub.contains("escalation") {
                Some(MitreTechnique { id: "T1068", name_fr: "Exploitation de vuln\u{00e9}rabilit\u{00e9}", tactic: MitreTactic::PrivilegeEscalation })
            } else if sub.contains("firewall") {
                Some(MitreTechnique { id: "T1562.004", name_fr: "D\u{00e9}sactivation du pare-feu", tactic: MitreTactic::DefenseEvasion })
            } else if sub.contains("antivirus") {
                Some(MitreTechnique { id: "T1562.001", name_fr: "D\u{00e9}sactivation d'outils de s\u{00e9}curit\u{00e9}", tactic: MitreTactic::DefenseEvasion })
            } else if sub.contains("exfiltration") || sub.contains("data_exfiltration") {
                Some(MitreTechnique { id: "T1041", name_fr: "Exfiltration via C2", tactic: MitreTactic::Exfiltration })
            } else {
                None
            }
        }
        "network" => {
            if sub.contains("c2") && !sub.contains("beaconing") {
                Some(MitreTechnique { id: "T1071", name_fr: "Protocole de couche application", tactic: MitreTactic::CommandAndControl })
            } else if sub.contains("beaconing") {
                Some(MitreTechnique { id: "T1071.001", name_fr: "Balise HTTP/S", tactic: MitreTactic::CommandAndControl })
            } else if sub.contains("mining") {
                Some(MitreTechnique { id: "T1496", name_fr: "D\u{00e9}tournement de ressources", tactic: MitreTactic::Impact })
            } else if sub.contains("exfiltration") {
                Some(MitreTechnique { id: "T1048", name_fr: "Exfiltration alternative", tactic: MitreTactic::Exfiltration })
            } else if sub.contains("dga") {
                Some(MitreTechnique { id: "T1568.002", name_fr: "Algorithme de g\u{00e9}n\u{00e9}ration de domaines", tactic: MitreTactic::CommandAndControl })
            } else if sub.contains("port_scan") || sub.contains("scan") {
                Some(MitreTechnique { id: "T1046", name_fr: "D\u{00e9}couverte de services r\u{00e9}seau", tactic: MitreTactic::Discovery })
            } else if sub.contains("dns_tunneling") || sub.contains("dns") {
                Some(MitreTechnique { id: "T1071.004", name_fr: "Tunnel DNS", tactic: MitreTactic::CommandAndControl })
            } else if sub.contains("suspicious_port") || sub.contains("port") {
                Some(MitreTechnique { id: "T1571", name_fr: "Port non standard", tactic: MitreTactic::CommandAndControl })
            } else {
                None
            }
        }
        "fim" => {
            Some(MitreTechnique { id: "T1565.001", name_fr: "Manipulation de donn\u{00e9}es stock\u{00e9}es", tactic: MitreTactic::Impact })
        }
        "usb" => {
            Some(MitreTechnique { id: "T1091", name_fr: "R\u{00e9}plication via m\u{00e9}dias amovibles", tactic: MitreTactic::InitialAccess })
        }
        _ => None,
    }
}

/// Collect all active MITRE tactics from current threat data.
pub(super) fn active_tactics(threats: &[super::types::ThreatEvent]) -> std::collections::HashSet<MitreTactic> {
    let mut tactics = std::collections::HashSet::new();
    for t in threats {
        // Use the description/title as subtype hint for mapping
        let subtype = match t.kind {
            "network" => t.title.to_ascii_lowercase(),
            "system" => t.description.to_ascii_lowercase(),
            "process" => format!("{} {}", t.title, t.command_line.as_deref().unwrap_or("")).to_ascii_lowercase(),
            _ => String::new(),
        };
        if let Some(technique) = mitre_mapping(t.kind, &subtype) {
            tactics.insert(technique.tactic);
        }
    }
    tactics
}

/// Render a compact MITRE ATT&CK mini-map (12-column grid, one per tactic).
pub(super) fn mitre_minimap(ui: &mut egui::Ui, threats: &[super::types::ThreatEvent]) {
    let active = active_tactics(threats);
    let all_tactics = MitreTactic::all();

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("COUVERTURE MITRE ATT&CK")
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        let available_w = ui.available_width();
        let cell_w = (available_w - (all_tactics.len() as f32 - 1.0) * 2.0) / all_tactics.len() as f32;
        let cell_h = 28.0_f32;

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.spacing_mut().item_spacing.x = 2.0;
            for tactic in all_tactics {
                let is_active = active.contains(tactic);
                let (rect, resp) = ui.allocate_exact_size(
                    egui::vec2(cell_w, cell_h),
                    egui::Sense::hover(),
                );

                if ui.is_rect_visible(rect) {
                    let bg = if is_active {
                        theme::ACCENT.linear_multiply(theme::OPACITY_TINT)
                    } else {
                        theme::bg_tertiary()
                    };
                    let border = if is_active {
                        egui::Stroke::new(theme::BORDER_THIN, theme::ACCENT.linear_multiply(theme::OPACITY_MODERATE))
                    } else {
                        egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border())
                    };
                    ui.painter().rect(
                        rect,
                        egui::CornerRadius::same(theme::ROUNDING_SM),
                        bg,
                        border,
                        egui::StrokeKind::Inside,
                    );

                    // Small indicator dot
                    if is_active {
                        ui.painter().circle_filled(
                            rect.center(),
                            3.0,
                            theme::ACCENT,
                        );
                    }
                }

                resp.on_hover_ui(|ui| {
                    ui.label(
                        egui::RichText::new(tactic.label_fr())
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                    );
                    if is_active {
                        ui.label(
                            egui::RichText::new("D\u{00e9}tections actives")
                                .font(theme::font_label())
                                .color(theme::accent_text()),
                        );
                    }
                });
            }
        });

        // Legend
        ui.add_space(theme::SPACE_SM);
        ui.horizontal(|ui: &mut egui::Ui| {
            let active_count = active.len();
            let total = all_tactics.len();
            ui.label(
                egui::RichText::new(format!("{}/{} tactiques couvertes", active_count, total))
                    .font(theme::font_label())
                    .color(if active_count > 6 { theme::accent_text() } else { theme::text_tertiary() }),
            );
        });
    });
}
