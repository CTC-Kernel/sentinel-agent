// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

pub mod button;
mod card;
pub mod chat_input;
mod compliance_gauge;
pub mod copy_button;
mod data_card;
mod design;
mod detection_hero;
mod empty_state;
mod header;
mod help_info;
mod icon_tile;
pub mod layout;
pub mod list_keys;
pub mod modal;
pub mod progress;
mod protected_state;
mod search_filter_bar;
mod security_hero;
pub mod sentinel_ai_core;
pub mod sidebar;
pub mod splash;
mod status_badge;
mod toggle_switch;
pub mod topbar;
pub mod tray_radar;
pub mod voice;

// UX feedback & input widgets
pub mod loading_state;
pub mod text_input;
pub mod toast;

// Navigation & selection widgets
pub mod dropdown;
pub mod form;
pub mod tabs;

// Visual components
pub mod badge;
pub mod divider;
pub mod skeleton;

// Data display & navigation
pub mod alert;
pub mod data_table;
pub mod pagination;
pub mod table;

// Form components
pub mod checkbox;
pub mod command_palette;
pub mod slider;

// Premium dashboard widgets
mod activity_feed;
pub mod detail_drawer;
mod org_banner;
mod sparkline;

pub use card::{Card, CardVariant, card, clickable_card, danger_card, flat_card};
pub use chat_input::{ChatInput, ChatInputResponse};
pub use compliance_gauge::{compliance_gauge, compliance_gauge_captioned};
pub use data_card::{data_card, open_data_panel};
pub use design::{instrument_glyph, metric_card, surface_light};
pub use detection_hero::detection_hero;
pub use empty_state::{
    empty_state, empty_state_compact, empty_state_with_action, no_results_state, pending_state,
};
pub use header::{eyebrow, page_header, page_header_nav, section_header};
pub use help_info::help_button;
pub use icon_tile::icon_tile;
pub use layout::ResponsiveGrid;
pub use list_keys::navigate_list;
pub use protected_state::{hero_state, protected_state};
pub use search_filter_bar::SearchFilterBar;
pub use security_hero::security_hero;
pub use sentinel_ai_core::SentinelAICore;
pub use sidebar::{Sidebar, SidebarContext};
pub use splash::splash_screen;
pub use status_badge::status_badge;
pub use toggle_switch::{toggle_switch, toggle_switch_labeled};
pub use topbar::{TopBarAction, TopBarContext, top_bar};
pub use tray_radar::TrayRadar;

// Premium dashboard exports
pub use activity_feed::{ActivityEvent, ActivityEventType, activity_feed};
pub use detail_drawer::{
    ActionStyle, DetailAction, DetailDrawer, detail_ai_proposal, detail_field, detail_field_badge,
    detail_field_colored, detail_mono, detail_progress, detail_section, detail_text,
};
pub use org_banner::org_banner;
pub use sparkline::{
    SparklineConfig, mini_gauge, sparkline, sparkline_card_body, sparkline_with_value,
};

// UX feedback & input exports
pub use loading_state::{error_state, loading_skeleton};
pub use text_input::{
    InputValidation, PasswordInput, PasswordInputResponse, SearchInput, SearchInputResponse,
    ValidationState, form_field, search_input, text_input, text_input_clearable,
    text_input_validated, text_input_with_limit, text_input_with_options,
};
pub use toast::{Toast, ToastLevel, ToastPosition, render_toasts, render_toasts_at};

// Modal/Dialog exports
pub use modal::{
    Modal, ModalResult, ModalStyle, confirm_dialog, danger_dialog, info_dialog, success_dialog,
};

// Progress indicators exports
pub use progress::{
    ProgressStyle, circular_progress, circular_progress_styled, progress_bar,
    progress_bar_indeterminate, progress_bar_styled, progress_bar_with_label, step_indicator,
};

// Button variants exports
pub use button::{
    ButtonSize, button_group, chip_button, destructive_button, destructive_button_loading,
    fab_button, ghost_button, icon_button, icon_button_with_color, primary_button,
    primary_button_loading, secondary_button, secondary_button_loading,
};
pub use voice::voice_toggle_button;

// Navigation & selection exports
pub use dropdown::{Dropdown, dropdown, dropdown_width};
pub use tabs::{Tab, TabBar, TabStyle, tabs, tabs_boxed, tabs_pills};

// Visual components exports
pub use badge::{
    Badge, BadgeVariant, badge, badge_count, badge_error, badge_info, badge_outline, badge_pill,
    badge_success, badge_variant, badge_warning, status_dot, status_dot_animated,
};
pub use divider::{
    Divider, DividerOrientation, DividerStyle, divider, divider_dashed, divider_gradient,
    divider_thin, divider_vertical, divider_with_label, section_divider,
};
pub use skeleton::{
    Skeleton, SkeletonShape, skeleton, skeleton_card, skeleton_circle, skeleton_content_card,
    skeleton_list_item, skeleton_paragraph, skeleton_stats_grid, skeleton_table_row, skeleton_text,
};

// Data display & navigation exports
pub use alert::{
    Alert, AlertLevel, AlertResult, alert_compact, alert_error, alert_error_dismissible,
    alert_info, alert_info_dismissible, alert_success, alert_warning, alert_warning_dismissible,
    alert_with_action, banner,
};
pub use data_table::{
    ColumnAlign, ColumnWidth, DataTable, SortDirection, TableColumn, TableRow, TableSort,
    simple_table,
};
pub use pagination::{
    Pagination, PaginationState, PaginationStyle, page_window, paginate_controls, pagination,
    pagination_compact, pagination_minimal,
};

// Copy-to-clipboard exports
pub use copy_button::{copy_button, copyable_value};

// Form components exports
pub use checkbox::{
    Checkbox, CheckboxGroup, CheckboxSize, RadioButton, RadioGroup, checkbox, checkbox_group,
    radio, radio_group, radio_group_horizontal, switch,
};
pub use command_palette::{
    CommandItem, CommandPalette, CommandPaletteState, check_palette_shortcut,
};
pub use slider::{
    Slider, SliderStyle, slider, slider_minimal, slider_percentage, slider_stepped,
    slider_with_labels,
};
