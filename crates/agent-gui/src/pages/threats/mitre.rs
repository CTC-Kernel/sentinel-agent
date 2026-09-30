// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! MITRE ATT&CK mapping for EDR detections.

use super::types::ThreatEvent;
use crate::dto::{MitreTactic, MitreTechnique};
use crate::theme;
use crate::widgets;

/// Map a detection (kind + subtype) to a MITRE ATT&CK technique.
pub(super) fn mitre_mapping(kind: &str, subtype: &str) -> Option<MitreTechnique> {
    let sub = subtype.to_lowercase();
    match kind {
        "process" => {
            if sub.contains("powershell") {
                Some(MitreTechnique {
                    id: "T1059.001",
                    name_fr: "Interpr\u{00e9}teur PowerShell",
                    tactic: MitreTactic::Execution,
                })
            } else if sub.contains("reverse")
                || sub.contains("netcat")
                || sub.contains("ncat")
                || sub.contains("nc ")
            {
                Some(MitreTechnique {
                    id: "T1059.004",
                    name_fr: "Shell Unix/Reverse shell",
                    tactic: MitreTactic::Execution,
                })
            } else if sub.contains("curl") || sub.contains("wget") {
                Some(MitreTechnique {
                    id: "T1105",
                    name_fr: "Transfert d'outils",
                    tactic: MitreTactic::CommandAndControl,
                })
            } else if sub.contains("certutil") || sub.contains("mshta") || sub.contains("regsvr32")
            {
                Some(MitreTechnique {
                    id: "T1218",
                    name_fr: "Ex\u{00e9}cution via proxy binaire",
                    tactic: MitreTactic::DefenseEvasion,
                })
            } else if sub.contains("macro") || sub.contains("office") {
                Some(MitreTechnique {
                    id: "T1204.002",
                    name_fr: "Fichier malveillant",
                    tactic: MitreTactic::Execution,
                })
            } else {
                None
            }
        }
        "system" => {
            if sub.contains("crypto_miner") || sub.contains("miner") {
                Some(MitreTechnique {
                    id: "T1496",
                    name_fr: "D\u{00e9}tournement de ressources",
                    tactic: MitreTactic::Impact,
                })
            } else if sub.contains("credential") {
                Some(MitreTechnique {
                    id: "T1003",
                    name_fr: "Extraction d'identifiants",
                    tactic: MitreTactic::CredentialAccess,
                })
            } else if sub.contains("privilege") || sub.contains("escalation") {
                Some(MitreTechnique {
                    id: "T1068",
                    name_fr: "Exploitation de vuln\u{00e9}rabilit\u{00e9}",
                    tactic: MitreTactic::PrivilegeEscalation,
                })
            } else if sub.contains("firewall") {
                Some(MitreTechnique {
                    id: "T1562.004",
                    name_fr: "D\u{00e9}sactivation du pare-feu",
                    tactic: MitreTactic::DefenseEvasion,
                })
            } else if sub.contains("antivirus") {
                Some(MitreTechnique {
                    id: "T1562.001",
                    name_fr: "D\u{00e9}sactivation d'outils de s\u{00e9}curit\u{00e9}",
                    tactic: MitreTactic::DefenseEvasion,
                })
            } else if sub.contains("exfiltration") || sub.contains("data_exfiltration") {
                Some(MitreTechnique {
                    id: "T1041",
                    name_fr: "Exfiltration via C2",
                    tactic: MitreTactic::Exfiltration,
                })
            } else {
                None
            }
        }
        "network" => {
            if sub.contains("c2") && !sub.contains("beaconing") {
                Some(MitreTechnique {
                    id: "T1071",
                    name_fr: "Protocole de couche application",
                    tactic: MitreTactic::CommandAndControl,
                })
            } else if sub.contains("beaconing") {
                Some(MitreTechnique {
                    id: "T1071.001",
                    name_fr: "Balise HTTP/S",
                    tactic: MitreTactic::CommandAndControl,
                })
            } else if sub.contains("mining") {
                Some(MitreTechnique {
                    id: "T1496",
                    name_fr: "D\u{00e9}tournement de ressources",
                    tactic: MitreTactic::Impact,
                })
            } else if sub.contains("exfiltration") {
                Some(MitreTechnique {
                    id: "T1048",
                    name_fr: "Exfiltration alternative",
                    tactic: MitreTactic::Exfiltration,
                })
            } else if sub.contains("dga") {
                Some(MitreTechnique {
                    id: "T1568.002",
                    name_fr: "Algorithme de g\u{00e9}n\u{00e9}ration de domaines",
                    tactic: MitreTactic::CommandAndControl,
                })
            } else if sub.contains("port_scan") || sub.contains("scan") {
                Some(MitreTechnique {
                    id: "T1046",
                    name_fr: "D\u{00e9}couverte de services r\u{00e9}seau",
                    tactic: MitreTactic::Discovery,
                })
            } else if sub.contains("dns_tunneling") || sub.contains("dns") {
                Some(MitreTechnique {
                    id: "T1071.004",
                    name_fr: "Tunnel DNS",
                    tactic: MitreTactic::CommandAndControl,
                })
            } else if sub.contains("suspicious_port") || sub.contains("port") {
                Some(MitreTechnique {
                    id: "T1571",
                    name_fr: "Port non standard",
                    tactic: MitreTactic::CommandAndControl,
                })
            } else {
                None
            }
        }
        "fim" => Some(MitreTechnique {
            id: "T1565.001",
            name_fr: "Manipulation de donn\u{00e9}es stock\u{00e9}es",
            tactic: MitreTactic::Impact,
        }),
        "usb" => Some(MitreTechnique {
            id: "T1091",
            name_fr: "R\u{00e9}plication via m\u{00e9}dias amovibles",
            tactic: MitreTactic::InitialAccess,
        }),
        _ => None,
    }
}

/// The technique a feed event maps to, from the same hints the detail
/// views use: the alert title for network events, the incident text for
/// system events, the process name and command line for processes.
fn technique_for(t: &ThreatEvent) -> Option<MitreTechnique> {
    let subtype = match t.kind {
        "network" => t.title.to_lowercase(),
        "system" => t.description.to_lowercase(),
        "process" => {
            format!("{} {}", t.title, t.command_line.as_deref().unwrap_or("")).to_lowercase()
        }
        _ => String::new(),
    };
    mitre_mapping(t.kind, &subtype)
}

fn severity_rank(severity: &str) -> u8 {
    match severity {
        "critical" => 3,
        "high" => 2,
        "medium" => 1,
        _ => 0,
    }
}

const SEVERITY_BY_RANK: [&str; 4] = ["low", "medium", "high", "critical"];

/// What the feed shows of one tactic.
#[derive(Default)]
struct TacticHits {
    detections: usize,
    worst_rank: u8,
    /// Technique id, French name and detection count, most frequent first.
    techniques: Vec<(&'static str, &'static str, usize)>,
}

impl TacticHits {
    fn worst_severity(&self) -> &'static str {
        SEVERITY_BY_RANK[self.worst_rank as usize]
    }
}

/// Detections per tactic, in `MitreTactic::all()` order.
fn tactic_hits(threats: &[ThreatEvent]) -> Vec<TacticHits> {
    let tactics = MitreTactic::all();
    let mut hits: Vec<TacticHits> = tactics.iter().map(|_| TacticHits::default()).collect();
    for threat in threats {
        let Some(technique) = technique_for(threat) else {
            continue;
        };
        let Some(slot) = tactics.iter().position(|t| *t == technique.tactic) else {
            continue;
        };
        let entry = &mut hits[slot];
        entry.detections += 1;
        entry.worst_rank = entry.worst_rank.max(severity_rank(threat.severity));
        match entry
            .techniques
            .iter_mut()
            .find(|(id, _, _)| *id == technique.id)
        {
            Some((_, _, count)) => *count += 1,
            None => entry.techniques.push((technique.id, technique.name_fr, 1)),
        }
    }
    for entry in &mut hits {
        entry
            .techniques
            .sort_by(|a, b| b.2.cmp(&a.2).then(a.0.cmp(b.0)));
    }
    hits
}

/// Tiles per row: the whole chain on one line when each stage gets a
/// readable width, otherwise two, three or four rows of the chain.
fn chain_columns(width: f32, gap: f32) -> usize {
    [12_usize, 6, 4, 3]
        .into_iter()
        .find(|&columns| (width - gap * (columns as f32 - 1.0)) / columns as f32 >= 104.0)
        .unwrap_or(3)
}

/// Room for a two-line tactic name above a full-size detection count.
const TILE_HEIGHT: f32 = 128.0;
const TILE_GAP: f32 = 12.0;
const TILE_PAD: f32 = 10.0;

/// The ATT&CK kill chain as seen in the current feed: one tile per tactic,
/// in chain order, sized and tinted by what was detected there.
pub(super) fn mitre_minimap(ui: &mut egui::Ui, threats: &[ThreatEvent]) {
    let tactics = MitreTactic::all();
    let hits = tactic_hits(threats);
    let observed = hits.iter().filter(|h| h.detections > 0).count();
    let busiest = hits.iter().map(|h| h.detections).max().unwrap_or(0).max(1);

    widgets::card(ui, |ui: &mut egui::Ui| {
        chain_header(ui, observed, tactics.len());
        ui.add_space(theme::SPACE_MD);

        let width = ui.available_width();
        let columns = chain_columns(width, TILE_GAP);
        let rows = tactics.len().div_ceil(columns);
        let tile_w = (width - TILE_GAP * (columns as f32 - 1.0)) / columns as f32;
        let height = rows as f32 * TILE_HEIGHT + (rows as f32 - 1.0) * TILE_GAP;
        let (area, _) = ui.allocate_exact_size(egui::vec2(width, height), egui::Sense::hover());

        let tile_rect = |index: usize| {
            let (row, col) = (index / columns, index % columns);
            egui::Rect::from_min_size(
                area.min
                    + egui::vec2(
                        col as f32 * (tile_w + TILE_GAP),
                        row as f32 * (TILE_HEIGHT + TILE_GAP),
                    ),
                egui::vec2(tile_w, TILE_HEIGHT),
            )
        };

        // Chevrons between neighbours on a row; lit when the chain runs
        // through both stages, so a progression reads at a glance.
        for index in 0..tactics.len() {
            let next = index + 1;
            if next >= tactics.len() || next % columns == 0 {
                continue;
            }
            let (a, b) = (tile_rect(index), tile_rect(next));
            let linked = hits[index].detections > 0 && hits[next].detections > 0;
            let color = if linked {
                theme::readable_color(theme::severity_color(
                    SEVERITY_BY_RANK[hits[index].worst_rank.max(hits[next].worst_rank) as usize],
                ))
            } else {
                theme::border()
            };
            let mid = egui::pos2((a.right() + b.left()) * 0.5, a.center().y);
            let arm = 3.5;
            ui.painter().add(egui::Shape::line(
                vec![
                    mid + egui::vec2(-arm * 0.6, -arm),
                    mid + egui::vec2(arm * 0.6, 0.0),
                    mid + egui::vec2(-arm * 0.6, arm),
                ],
                egui::Stroke::new(
                    if linked {
                        theme::BORDER_THICK
                    } else {
                        theme::BORDER_THIN
                    },
                    color,
                ),
            ));
        }

        for (index, (tactic, hit)) in tactics.iter().zip(&hits).enumerate() {
            let rect = tile_rect(index);
            let response = ui.interact(
                rect,
                ui.make_persistent_id(("mitre_tactic", index)),
                egui::Sense::hover(),
            );
            let hover = crate::animation::animate_hover(
                ui.ctx(),
                response.id.with("hover"),
                response.hovered(),
            );
            paint_tactic_tile(ui, rect, index, tactic, hit, busiest, hover);
            response.on_hover_ui(|ui| tactic_tooltip(ui, tactic, hit));
        }

        ui.add_space(theme::SPACE_MD);
        chain_legend(ui);
    });
}

fn chain_header(ui: &mut egui::Ui, observed: usize, total: usize) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(crate::icons::CROSSHAIRS)
                .size(theme::ICON_SM)
                .color(theme::accent_text()),
        );
        ui.vertical(|ui| {
            ui.label(
                egui::RichText::new("CHA\u{00ce}NE D'ATTAQUE MITRE ATT&CK")
                    .font(theme::font_label())
                    .color(theme::text_secondary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.label(
                egui::RichText::new(
                    "\u{00c9}tapes de l'attaque o\u{00f9} les d\u{00e9}tections actuelles se situent",
                )
                .font(theme::font_caption())
                .color(theme::text_tertiary()),
            );
        });
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            let fraction = observed as f32 / total.max(1) as f32;
            let color = match observed {
                0 => theme::SUCCESS,
                1..=3 => theme::SEVERITY_MEDIUM,
                4..=6 => theme::SEVERITY_HIGH,
                _ => theme::ERROR,
            };
            let (bar, _) = ui.allocate_exact_size(egui::vec2(96.0, 6.0), egui::Sense::hover());
            let radius = egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
            ui.painter().rect_filled(bar, radius, theme::bg_tertiary());
            if fraction > 0.0 {
                ui.painter().rect_filled(
                    egui::Rect::from_min_size(bar.min, egui::vec2(bar.width() * fraction, 6.0)),
                    radius,
                    theme::readable_color(color),
                );
            }
            ui.add_space(theme::SPACE_SM);
            ui.label(
                egui::RichText::new(format!("{observed} / {total} tactiques observ\u{00e9}es"))
                    .font(theme::font_body_strong())
                    .color(if observed == 0 {
                        theme::text_secondary()
                    } else {
                        theme::readable_color(color)
                    }),
            );
        });
    });
}

fn paint_tactic_tile(
    ui: &egui::Ui,
    rect: egui::Rect,
    index: usize,
    tactic: &MitreTactic,
    hit: &TacticHits,
    busiest: usize,
    hover: f32,
) {
    if !ui.is_rect_visible(rect) {
        return;
    }
    let painter = ui.painter();
    let seen = hit.detections > 0;
    let severity = theme::severity_color(hit.worst_severity());
    let ink = theme::readable_color(severity);
    let radius = egui::CornerRadius::same(theme::ROUNDING_MD);

    // Surface: tinted by the worst severity, deeper with more detections.
    let (fill, stroke) = if seen {
        let intensity = hit.detections as f32 / busiest as f32;
        (
            theme::color_blend_pub(theme::bg_secondary(), severity, 0.08 + 0.12 * intensity),
            egui::Stroke::new(
                theme::BORDER_THIN,
                theme::color_blend_pub(theme::bg_secondary(), severity, 0.45 + 0.3 * hover),
            ),
        )
    } else {
        (
            theme::bg_tertiary().linear_multiply(0.6),
            egui::Stroke::new(
                theme::BORDER_HAIRLINE,
                crate::animation::lerp_color(theme::border_subtle(), theme::border(), hover),
            ),
        )
    };
    painter.rect(rect, radius, fill, stroke, egui::StrokeKind::Inside);
    if seen {
        painter.rect_filled(
            egui::Rect::from_min_size(
                rect.min + egui::vec2(TILE_PAD, 0.0),
                egui::vec2(rect.width() - TILE_PAD * 2.0, 3.0),
            ),
            egui::CornerRadius {
                nw: 0,
                ne: 0,
                sw: 2,
                se: 2,
            },
            ink,
        );
    }

    let inner = rect.shrink(TILE_PAD);
    let muted = theme::text_tertiary();

    // Stage number and official tactic id.
    painter.text(
        inner.left_top() + egui::vec2(0.0, 2.0),
        egui::Align2::LEFT_TOP,
        format!("{:02}", index + 1),
        theme::font_mono_sm(),
        if seen { ink } else { muted },
    );
    painter.text(
        inner.right_top() + egui::vec2(0.0, 2.0),
        egui::Align2::RIGHT_TOP,
        tactic.id(),
        theme::font_mono_sm(),
        muted,
    );

    // Tactic name, wrapped on up to two lines.
    let name = painter.layout(
        tactic.label_fr().to_owned(),
        theme::font_label(),
        if seen {
            theme::text_primary()
        } else {
            theme::text_secondary()
        },
        inner.width(),
    );
    painter.galley(
        inner.left_top() + egui::vec2(0.0, 20.0),
        name,
        theme::text_primary(),
    );

    // Detection count, or a dash for a stage nothing reached.
    let count_y = inner.bottom() - 30.0;
    if seen {
        let count = painter.text(
            egui::pos2(inner.left(), count_y),
            egui::Align2::LEFT_BOTTOM,
            hit.detections.to_string(),
            theme::font_h3(),
            ink,
        );
        painter.text(
            egui::pos2(count.right() + theme::SPACE_XS, count_y - 2.0),
            egui::Align2::LEFT_BOTTOM,
            if hit.detections > 1 {
                "d\u{00e9}tections"
            } else {
                "d\u{00e9}tection"
            },
            theme::font_caption(),
            theme::text_secondary(),
        );
    } else {
        painter.text(
            egui::pos2(inner.left(), count_y),
            egui::Align2::LEFT_BOTTOM,
            "\u{2014}",
            theme::font_h3(),
            muted,
        );
    }

    // Leading technique ids, clipped to the tile.
    let techniques = if seen {
        let mut ids = hit.techniques.first().map(|t| t.0).unwrap_or("").to_owned();
        if hit.techniques.len() > 1 {
            ids.push_str(&format!(" +{}", hit.techniques.len() - 1));
        }
        ids
    } else {
        "Non observ\u{00e9}e".to_owned()
    };
    painter.with_clip_rect(inner).text(
        inner.left_bottom(),
        egui::Align2::LEFT_BOTTOM,
        techniques,
        if seen {
            theme::font_mono_sm()
        } else {
            theme::font_caption()
        },
        muted,
    );
}

fn tactic_tooltip(ui: &mut egui::Ui, tactic: &MitreTactic, hit: &TacticHits) {
    ui.set_max_width(theme::TOOLTIP_MAX_WIDTH);
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(tactic.label_fr())
                .font(theme::font_body_strong())
                .color(theme::text_primary()),
        );
        ui.label(
            egui::RichText::new(tactic.id())
                .font(theme::font_mono_sm())
                .color(theme::text_tertiary()),
        );
    });
    if hit.detections == 0 {
        ui.label(
            egui::RichText::new("Aucune d\u{00e9}tection \u{00e0} cette \u{00e9}tape")
                .font(theme::font_caption())
                .color(theme::text_tertiary()),
        );
        return;
    }
    let severity = hit.worst_severity();
    let label = match severity {
        "critical" => "Critique",
        "high" => "\u{00c9}lev\u{00e9}e",
        "medium" => "Moyenne",
        _ => "Faible",
    };
    ui.horizontal(|ui| {
        widgets::status_badge(ui, label, theme::severity_color(severity));
        ui.label(
            egui::RichText::new(format!(
                "{} d\u{00e9}tection{}",
                hit.detections,
                if hit.detections > 1 { "s" } else { "" }
            ))
            .font(theme::font_caption())
            .color(theme::text_secondary()),
        );
    });
    ui.separator();
    for (id, name, count) in &hit.techniques {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(*id)
                    .font(theme::font_mono_sm())
                    .color(theme::accent_text()),
            );
            ui.label(
                egui::RichText::new(*name)
                    .font(theme::font_caption())
                    .color(theme::text_primary()),
            );
            ui.label(
                egui::RichText::new(format!("\u{00d7}{count}"))
                    .font(theme::font_caption())
                    .color(theme::text_tertiary()),
            );
        });
    }
}

fn chain_legend(ui: &mut egui::Ui) {
    ui.horizontal_wrapped(|ui| {
        for (label, severity) in [
            ("Critique", "critical"),
            ("\u{00c9}lev\u{00e9}", "high"),
            ("Moyen", "medium"),
            ("Faible", "low"),
        ] {
            let (dot, _) = ui.allocate_exact_size(egui::vec2(8.0, 8.0), egui::Sense::hover());
            ui.painter().circle_filled(
                dot.center(),
                3.5,
                theme::readable_color(theme::severity_color(severity)),
            );
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_caption())
                    .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_SM);
        }
        ui.label(
            egui::RichText::new(
                "\u{00b7}  Teinte = d\u{00e9}tection la plus grave, intensit\u{00e9} = volume  \u{00b7}  Survoler une \u{00e9}tape pour ses techniques",
            )
            .font(theme::font_caption())
            .color(theme::text_tertiary()),
        );
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(kind: &'static str, title: &str, severity: &'static str) -> ThreatEvent {
        ThreatEvent {
            kind,
            severity,
            title: title.into(),
            ..Default::default()
        }
    }

    #[test]
    fn hits_group_by_tactic_with_worst_severity_and_techniques() {
        let threats = [
            event("usb", "SanDisk", "medium"),
            event("usb", "Kingston", "high"),
            event("fim", "/etc/sudoers", "critical"),
            event("process", "unmapped.exe", "critical"),
        ];
        let hits = tactic_hits(&threats);
        let initial = &hits[0];
        assert_eq!(initial.detections, 2);
        assert_eq!(initial.worst_severity(), "high");
        assert_eq!(
            initial.techniques,
            vec![("T1091", initial.techniques[0].1, 2)]
        );
        let impact = hits.last().unwrap();
        assert_eq!(impact.detections, 1);
        assert_eq!(impact.worst_severity(), "critical");
        // An event with no technique mapping lands nowhere.
        assert_eq!(hits.iter().map(|h| h.detections).sum::<usize>(), 3);
    }

    #[test]
    fn chain_wraps_before_tiles_get_cramped() {
        assert_eq!(chain_columns(1600.0, TILE_GAP), 12);
        assert_eq!(chain_columns(900.0, TILE_GAP), 6);
        assert_eq!(chain_columns(500.0, TILE_GAP), 4);
        assert_eq!(chain_columns(300.0, TILE_GAP), 3);
    }
}
