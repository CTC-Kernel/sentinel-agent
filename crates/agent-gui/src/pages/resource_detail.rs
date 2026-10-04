// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use crate::{app::AppState, icons, theme, widgets};
use egui_plot::{Line, Plot, PlotPoints};

pub(super) fn open(ctx: &egui::Context, memory: bool) {
    ctx.data_mut(|d| d.insert_temp(egui::Id::new("resource_inspector"), Some(memory)));
}

pub(super) fn show(ctx: &egui::Context, state: &AppState) {
    let id = egui::Id::new("resource_inspector");
    let Some(memory) = ctx.data_mut(|d| d.get_temp::<Option<bool>>(id).flatten()) else {
        return;
    };
    let title = if memory {
        "Mémoire du poste"
    } else {
        "Charge CPU"
    };
    let history = if memory {
        &state.monitoring.memory_history
    } else {
        &state.monitoring.cpu_history
    };
    let values: Vec<[f64; 2]> = history
        .iter()
        .copied()
        .filter(|p| p[0].is_finite() && p[1].is_finite())
        .collect();
    let mut visible = true;
    let action = widgets::DetailDrawer::new(id, title, icons::CHART_AREA).wide()
        .subtitle("Historique de cette session · Mesures réelles du poste")
        .show(ctx, &mut visible, |ui| {
            if values.is_empty() {
                widgets::empty_state(ui, icons::CHART_AREA, "En attente de mesures", Some("L’historique apparaîtra à la réception de la télémétrie de l’agent."));
                return;
            }
            let (min, max, mean) = statistics(&values).expect("nonempty finite samples");
            widgets::detail_field(ui, "Dernière mesure", &format!("{:.1} %", values.last().unwrap()[1]));
            widgets::detail_field(ui, "Minimum / moyenne / maximum", &format!("{min:.1} % / {mean:.1} % / {max:.1} %"));
            widgets::detail_field(ui, "Échantillons", &values.len().to_string());
            if memory {
                widgets::detail_field(ui, "Mémoire utilisée / totale", &format!("{} / {} Mo", state.resources.memory_used_mb, state.resources.memory_total_mb));
            }
            widgets::detail_text(ui, "Lecture", "Survolez la courbe pour lire une valeur. Les secondes sont relatives à la dernière mesure ; les données sont limitées à l’historique conservé pendant cette session.");
            let last_time = values.last().unwrap()[0];
            let relative: Vec<[f64; 2]> = values.iter().map(|p| [p[0] - last_time, p[1]]).collect();
            Plot::new(id.with("plot")).height(240.0).include_y(0.0).include_y(100.0)
                .x_axis_label("Secondes avant la dernière mesure").y_axis_label("Utilisation (%)")
                .show(ui, |plot| plot.line(Line::new(PlotPoints::from(relative)).name(title).color(theme::chart_color(theme::INFO))));
            widgets::detail_section(ui, "Dernières mesures");
            egui::Grid::new(id.with("samples")).striped(true).show(ui, |ui| {
                ui.strong("Ancienneté"); ui.strong("Utilisation"); ui.end_row();
                for p in values.iter().rev().take(20) {
                    ui.label(format!("{:.0} s", last_time - p[0])); ui.label(format!("{:.1} %", p[1])); ui.end_row();
                }
            });
        }, &[widgets::DetailAction::secondary("Copier les mesures CSV", icons::COPY).enabled(!values.is_empty())]);
    if action == Some(0) {
        let mut csv = String::from("uptime_seconds,usage_percent\n");
        for [time, value] in &values {
            csv.push_str(&format!("{time},{value}\n"));
        }
        ctx.copy_text(csv);
    }
    if !visible {
        ctx.data_mut(|d| d.insert_temp(id, Option::<bool>::None));
    }
}

fn statistics(values: &[[f64; 2]]) -> Option<(f64, f64, f64)> {
    if values.is_empty() {
        return None;
    }
    let min = values.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min);
    let max = values
        .iter()
        .map(|p| p[1])
        .fold(f64::NEG_INFINITY, f64::max);
    Some((
        min,
        max,
        values.iter().map(|p| p[1]).sum::<f64>() / values.len() as f64,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn statistics_do_not_invent_an_empty_measurement() {
        assert_eq!(statistics(&[]), None);
        assert_eq!(
            statistics(&[[5.0, 30.0], [7.0, 10.0], [8.0, 80.0]]),
            Some((10.0, 80.0, 40.0))
        );
    }
}
