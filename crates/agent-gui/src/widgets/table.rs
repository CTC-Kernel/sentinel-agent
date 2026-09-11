// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Cell primitives for the `egui_extras` tables on the product pages.
//!
//! Every list page builds its table with `TableBuilder`; before this module,
//! each of them declared its own header labels, its own row heights and its
//! own idea of what happens when a hostname, a file path or a CVE description
//! is wider than its column. The answer was usually "it wraps onto a second
//! line and gets cut off by the row", or "it paints over the next column".
//!
//! These helpers make that one decision:
//!
//! - a cell is a single line, truncated with an ellipsis, with the full value
//!   in a tooltip when it was truncated;
//! - a two-line cell ([`cell_stack`]) declares that it needs
//!   [`theme::TABLE_DATA_ROW_HEIGHT`], and never a third line;
//! - columns are clipped to their width ([`column`], [`column_remainder`]), so
//!   a wide value cannot push the table past its card.

use egui::{Color32, FontId, Response, RichText, Ui};
use egui_extras::{Column, TableBuilder};

use crate::theme;

/// The table every list page starts from.
///
/// It never scrolls on its own: the page is the scroll container, and a
/// table that grabbed the wheel whenever the pointer crossed it was the
/// reason "the page would not scroll". Rows are striped, the header and
/// cells centre vertically, and the widths come from the [`column`] helpers.
pub fn builder(ui: &mut Ui) -> TableBuilder<'_> {
    TableBuilder::new(ui)
        .striped(true)
        .resizable(false)
        .vscroll(false)
        .auto_shrink([false, true])
        .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
}

/// [`builder`] whose rows report clicks, for lists that open a detail
/// drawer. Pair it with [`row_interaction`].
pub fn clickable(ui: &mut Ui) -> TableBuilder<'_> {
    builder(ui).sense(egui::Sense::click())
}

/// One column of a fluid table: a floor in points and a share of the width
/// left once every floor is paid. A share of zero is a fixed column.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Col {
    pub min: f32,
    pub share: f32,
}

impl Col {
    /// A column that grows with the table.
    pub const fn fluid(min: f32, share: f32) -> Self {
        Self { min, share }
    }

    /// A column that stays at `width` whatever the table does.
    pub const fn fixed(width: f32) -> Self {
        Self {
            min: width,
            share: 0.0,
        }
    }
}

/// Widths for `cols` inside `available` points, `gap` between columns.
///
/// Every column gets its floor; what remains is split by share. When the
/// floors alone do not fit, they scale down together — the cells truncate,
/// the table never leaves its card.
pub fn layout(available: f32, gap: f32, cols: &[Col]) -> Vec<f32> {
    if cols.is_empty() {
        return Vec::new();
    }
    let usable = (available - gap * (cols.len() as f32 - 1.0)).max(0.0);
    let floors: f32 = cols.iter().map(|c| c.min).sum();
    if floors >= usable {
        let scale = if floors > 0.0 { usable / floors } else { 0.0 };
        return cols.iter().map(|c| (c.min * scale).floor()).collect();
    }
    let shares: f32 = cols.iter().map(|c| c.share.max(0.0)).sum();
    let spare = usable - floors;
    let mut widths: Vec<f32> = cols
        .iter()
        .map(|c| {
            let extra = if shares > 0.0 {
                spare * c.share.max(0.0) / shares
            } else {
                0.0
            };
            (c.min + extra).floor()
        })
        .collect();
    // Rounding leaves a few points over; give them to the widest column so
    // the sum matches the table width exactly.
    let used: f32 = widths.iter().sum();
    let mut widest = 0;
    for (i, width) in widths.iter().enumerate() {
        if *width > widths[widest] {
            widest = i;
        }
    }
    widths[widest] += (usable - used).max(0.0).floor();
    widths
}

/// A [`builder`] whose columns are laid out with [`layout`] over the width
/// the table has, so it fills its card at every window size and never
/// grows past it. This is the table the list pages use.
pub fn fluid<'a>(ui: &'a mut Ui, cols: &[Col]) -> TableBuilder<'a> {
    let available = ui.available_width();
    let gap = ui.spacing().item_spacing.x;
    let widths = layout(available, gap, cols);
    let mut table = builder(ui);
    for width in widths {
        table = table.column(Column::exact(width).clip(true));
    }
    table
}

/// [`fluid`] with clickable rows.
pub fn fluid_clickable<'a>(ui: &'a mut Ui, cols: &[Col]) -> TableBuilder<'a> {
    fluid(ui, cols).sense(egui::Sense::click())
}

/// A fixed-start column that clips its content and can be resized down to
/// `min`. Use for every column that is not the remainder.
pub fn column(initial: f32, min: f32) -> Column {
    Column::initial(initial).at_least(min).clip(true)
}

/// A column that cannot be narrower than `min` nor wider than `max`.
pub fn column_ranged(initial: f32, min: f32, max: f32) -> Column {
    Column::initial(initial).range(min..=max).clip(true)
}

/// The column that takes whatever width the others leave.
pub fn column_remainder(min: f32) -> Column {
    Column::remainder().at_least(min).clip(true)
}

/// An exact-width column (icons, checkboxes, a single badge).
pub fn column_exact(width: f32) -> Column {
    Column::exact(width).clip(true)
}

/// Uppercase header label in the eyebrow style, truncated to its column.
pub fn header_cell(ui: &mut Ui, label: &str) -> Response {
    let font = theme::font_label();
    truncated(
        ui,
        RichText::new(label)
            .font(font.clone())
            .color(theme::text_tertiary())
            .strong()
            .extra_letter_spacing(theme::TRACKING_NORMAL),
        label,
        &font,
    )
}

/// Header label aligned to the trailing edge, for numeric columns.
pub fn header_cell_right(ui: &mut Ui, label: &str) -> Response {
    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
        header_cell(ui, label)
    })
    .inner
}

/// Body text in the primary colour.
pub fn cell(ui: &mut Ui, text: &str) -> Response {
    cell_styled(ui, text, theme::font_body(), theme::text_primary())
}

/// Body text with the medium weight, for the leading identifier of a row.
pub fn cell_strong(ui: &mut Ui, text: &str) -> Response {
    cell_styled(ui, text, theme::font_body_medium(), theme::text_primary())
}

/// Body text in the secondary colour, for supporting values.
pub fn cell_secondary(ui: &mut Ui, text: &str) -> Response {
    cell_styled(ui, text, theme::font_body(), theme::text_secondary())
}

/// Small text in the secondary colour, for descriptions beside an identifier.
pub fn cell_small(ui: &mut Ui, text: &str) -> Response {
    cell_styled(ui, text, theme::font_small(), theme::text_secondary())
}

/// Small text in the tertiary colour, for timestamps and counts.
pub fn cell_muted(ui: &mut Ui, text: &str) -> Response {
    cell_styled(ui, text, theme::font_small(), theme::text_tertiary())
}

/// Monospace value: hashes, paths, identifiers, addresses.
pub fn cell_mono(ui: &mut Ui, text: &str) -> Response {
    cell_styled(ui, text, theme::font_mono(), theme::text_primary())
}

/// Small monospace value in the tertiary colour: timestamps, ports.
pub fn cell_mono_muted(ui: &mut Ui, text: &str) -> Response {
    cell_styled(ui, text, theme::font_mono_sm(), theme::text_tertiary())
}

/// A value in a semantic colour (a score, a status word).
pub fn cell_colored(ui: &mut Ui, text: &str, color: Color32) -> Response {
    cell_styled(ui, text, theme::font_body_medium(), color)
}

/// Number aligned to the trailing edge of the cell.
pub fn cell_number(ui: &mut Ui, text: &str) -> Response {
    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
        cell_styled(ui, text, theme::font_mono(), theme::text_primary())
    })
    .inner
}

/// The placeholder for a value the row does not have.
pub fn cell_empty(ui: &mut Ui) -> Response {
    cell_styled(ui, "—", theme::font_body(), theme::text_tertiary())
}

/// One line of `text` in `font` and `color`, truncated to the cell with the
/// full value on hover when it did not fit.
pub fn cell_styled(ui: &mut Ui, text: &str, font: FontId, color: Color32) -> Response {
    truncated(
        ui,
        RichText::new(text).font(font.clone()).color(color),
        text,
        &font,
    )
}

/// An icon in `color` followed by one truncated line of body text: a
/// protocol with its glyph, a level with its marker.
pub fn cell_icon(ui: &mut Ui, icon: &str, color: Color32, text: &str) -> Response {
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = theme::SPACE_XS;
        ui.label(
            RichText::new(icon)
                .font(theme::font_icon(theme::ICON_XS))
                .color(color),
        );
        cell(ui, text)
    })
    .inner
}

/// A clickable identifier (a CVE id, a hostname) that opens the row's detail.
///
/// Painted in the accent colour so it reads as the row's link, with the
/// pointer cursor every other link in the product shows.
pub fn cell_link(ui: &mut Ui, text: &str) -> Response {
    let font = theme::font_mono_strong();
    let response = truncated(
        ui,
        RichText::new(text)
            .font(font.clone())
            .color(theme::accent_text()),
        text,
        &font,
    )
    .interact(egui::Sense::click());
    if response.hovered() {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    response
}

/// A clickable identifier over a muted secondary line: a CVE id over its
/// discovery date, a hostname over its address. Needs a data row.
pub fn cell_link_stack(ui: &mut Ui, primary: &str, secondary: &str) -> Response {
    ui.vertical(|ui| {
        ui.spacing_mut().item_spacing.y = 0.0;
        let link = cell_link(ui, primary);
        if !secondary.is_empty() {
            cell_muted(ui, secondary);
        }
        link
    })
    .inner
}

/// Two lines: a primary value over a secondary one.
///
/// Needs a row of [`theme::TABLE_DATA_ROW_HEIGHT`]; both lines truncate to
/// the column independently, so the pair can never grow a third line.
pub fn cell_stack(ui: &mut Ui, primary: &str, secondary: &str) -> Response {
    stacked(
        ui,
        (primary, theme::font_body_medium(), theme::text_primary()),
        (secondary, theme::font_small(), theme::text_tertiary()),
    )
}

/// Two lines with a monospace primary value: a path over its hash, an
/// address over its hostname.
pub fn cell_stack_mono(ui: &mut Ui, primary: &str, secondary: &str) -> Response {
    stacked(
        ui,
        (primary, theme::font_mono(), theme::text_primary()),
        (secondary, theme::font_mono_sm(), theme::text_tertiary()),
    )
}

fn stacked(
    ui: &mut Ui,
    (primary, primary_font, primary_color): (&str, FontId, Color32),
    (secondary, secondary_font, secondary_color): (&str, FontId, Color32),
) -> Response {
    ui.vertical(|ui| {
        ui.spacing_mut().item_spacing.y = 0.0;
        let first = cell_styled(ui, primary, primary_font, primary_color);
        if !secondary.is_empty() {
            cell_styled(ui, secondary, secondary_font, secondary_color);
        }
        first
    })
    .inner
}

/// Lay `text` out on one line, clipped to the cell with an ellipsis, and
/// attach the full value as a tooltip when it was cut.
fn truncated(ui: &mut Ui, text: RichText, full: &str, font: &FontId) -> Response {
    let response = ui.add(egui::Label::new(text).truncate().selectable(false));
    if full.is_empty() {
        return response;
    }
    // The label was given the cell's width; the unwrapped measure says
    // whether that was enough for the whole value.
    let needed = ui.fonts(|fonts| {
        fonts
            .layout_no_wrap(full.to_owned(), font.clone(), Color32::PLACEHOLDER)
            .size()
            .x
    });
    if needed > response.rect.width() + 0.5 {
        response.on_hover_text(full)
    } else {
        response
    }
}

/// Pointer cursor over a clickable row, the accent bar on the selected one,
/// and the row's click. Call it after the row's cells, on a table built
/// with [`clickable`].
pub fn row_interaction(row: &egui_extras::TableRow<'_, '_>, selected: bool) -> bool {
    let response = row.response();
    if response.hovered() {
        response.ctx.set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    if selected {
        response.ctx.layer_painter(response.layer_id).rect_filled(
            egui::Rect::from_min_size(
                response.rect.left_top(),
                egui::vec2(theme::ACCENT_BAR_WIDTH, response.rect.height()),
            ),
            0,
            theme::accent_text(),
        );
    }
    response.clicked()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fluid_layout_fills_the_width_and_never_exceeds_it() {
        let cols = [
            Col::fluid(120.0, 2.0),
            Col::fluid(80.0, 1.0),
            Col::fixed(90.0),
        ];
        for available in [200.0, 300.0, 600.0, 1400.0] {
            let widths = layout(available, 8.0, &cols);
            let total: f32 = widths.iter().sum::<f32>() + 16.0;
            assert!(total <= available + 0.01, "{available}: {widths:?}");
            if available >= 306.0 {
                assert!(total >= available - 1.5, "{available}: {widths:?}");
                assert_eq!(widths[2], 90.0);
                assert!(widths[0] > widths[1]);
            }
        }
    }

    #[test]
    fn a_long_value_stays_on_one_line_inside_its_cell() {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let long =
            "C:\\Program Files\\Cyber Threat Consulting\\Sentinel\\bin\\sentinel-agent-service.exe";
        let mut painted = None;
        // Two frames: egui lays the first one out as a sizing pass, in which
        // labels extend instead of truncating.
        for _ in 0..2 {
            let _ = ctx.run(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(400.0, 100.0),
                    )),
                    ..Default::default()
                },
                |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        let cell = egui::Rect::from_min_size(
                            ui.cursor().min,
                            egui::vec2(120.0, theme::TABLE_ROW_HEIGHT),
                        );
                        ui.scope_builder(egui::UiBuilder::new().max_rect(cell), |ui| {
                            painted = Some(cell_mono(ui, long).rect);
                        });
                    });
                },
            );
        }
        let rect = painted.expect("cell painted");
        assert!(rect.width() <= 120.5, "cell overflowed: {}", rect.width());
        let line = ctx.fonts(|f| f.row_height(&theme::font_mono()));
        assert!(
            rect.height() <= line * 1.5,
            "cell wrapped: {}",
            rect.height()
        );
    }

    #[test]
    fn a_stack_fits_the_data_row_height() {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let mut height = 0.0;
        let _ = ctx.run(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::vec2(400.0, 100.0),
                )),
                ..Default::default()
            },
            |ctx| {
                egui::CentralPanel::default().show(ctx, |ui| {
                    let r = ui.vertical(|ui| {
                        cell_stack(ui, "OpenSSL", "3.0.2-0ubuntu1.15");
                    });
                    height = r.response.rect.height();
                });
            },
        );
        assert!(
            height <= theme::TABLE_DATA_ROW_HEIGHT - 2.0 * theme::SPACE_XS,
            "stack too tall for a data row: {height}"
        );
    }
}
