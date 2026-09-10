// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Keyboard navigation for the list pages.
//!
//! ↑ and ↓ move the selection, Enter opens the detail drawer; Escape is the
//! drawer's own business. Nothing happens while a text field owns the
//! keyboard, a popup is open or a modal is up, so a search box never scrolls
//! the table behind it and Enter never confirms two things at once.

use egui::Key;

/// Apply the arrow keys to a selection over `len` rows, in display order.
///
/// `position` is the index in the displayed list — the caller maps it to
/// whatever its rows really point at. Returns `true` when the selection
/// moved, so the caller can scroll the new row into view.
pub fn navigate_list(
    ctx: &egui::Context,
    position: &mut Option<usize>,
    len: usize,
    open: &mut bool,
) -> bool {
    if len == 0
        || ctx.wants_keyboard_input()
        || ctx.memory(|m| m.any_popup_open())
        || crate::widgets::modal::any_modal_open(ctx)
    {
        return false;
    }
    let (up, down, enter) = ctx.input(|i| {
        (
            i.key_pressed(Key::ArrowUp),
            i.key_pressed(Key::ArrowDown),
            i.key_pressed(Key::Enter),
        )
    });
    if down {
        *position = Some(position.map_or(0, |p| (p + 1).min(len - 1)));
        return true;
    }
    if up {
        *position = Some(position.map_or(0, |p| p.saturating_sub(1)));
        return true;
    }
    if enter && position.is_some() {
        *open = true;
    }
    false
}
