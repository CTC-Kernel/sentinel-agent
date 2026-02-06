//! Font Awesome 6 Free Solid icon constants.
//!
//! Each constant is a `&str` containing the single Unicode codepoint
//! from the Private Use Area that maps to the Font Awesome glyph.
//! The FA Solid font is registered as a fallback so these render
//! automatically inside any `RichText` / `painter.text()` call.

// ── Sidebar / Navigation ─────────────────────────────────────────────
pub const HOME: &str = "\u{f015}"; // fa-house
pub const DASHBOARD: &str = "\u{f3fd}"; // fa-chart-column (was fa-columns)
pub const COMPLIANCE: &str = "\u{f46c}"; // fa-clipboard-check
pub const SOFTWARE: &str = "\u{f1b2}"; // fa-cube
pub const VULNERABILITIES: &str = "\u{f3ed}"; // fa-shield-halved
pub const NETWORK: &str = "\u{f6ff}"; // fa-network-wired
pub const DISCOVERY: &str = "\u{f002}"; // fa-magnifying-glass
pub const CARTOGRAPHY: &str = "\u{f279}"; // fa-map
pub const SYNC: &str = "\u{f021}"; // fa-arrows-rotate
pub const TERMINAL: &str = "\u{f120}"; // fa-terminal
pub const SETTINGS: &str = "\u{f013}"; // fa-gear
pub const ABOUT: &str = "\u{f05a}"; // fa-circle-info

// ── Status ───────────────────────────────────────────────────────────
pub const CHECK: &str = "\u{f00c}"; // fa-check
pub const XMARK: &str = "\u{f00d}"; // fa-xmark
pub const CIRCLE_CHECK: &str = "\u{f058}"; // fa-circle-check
pub const CIRCLE_XMARK: &str = "\u{f057}"; // fa-circle-xmark
pub const WARNING: &str = "\u{f071}"; // fa-triangle-exclamation
pub const ERROR: &str = "\u{f06a}"; // fa-circle-exclamation
pub const INFO_CIRCLE: &str = "\u{f05a}"; // fa-circle-info

// ── Severity ─────────────────────────────────────────────────────────
pub const SEVERITY_CRITICAL: &str = "\u{f057}"; // fa-circle-xmark
pub const SEVERITY_HIGH: &str = "\u{f071}"; // fa-triangle-exclamation
pub const SEVERITY_MEDIUM: &str = "\u{f06a}"; // fa-circle-exclamation
pub const SEVERITY_LOW: &str = "\u{f05a}"; // fa-circle-info

// ── Actions / misc ───────────────────────────────────────────────────
pub const ARROW_UP: &str = "\u{f062}"; // fa-arrow-up
pub const ARROW_RIGHT: &str = "\u{f061}"; // fa-arrow-right
pub const EXTERNAL_LINK: &str = "\u{f08e}"; // fa-up-right-from-square
pub const PLAY: &str = "\u{f04b}"; // fa-play
pub const STOP: &str = "\u{f04d}"; // fa-stop
pub const SQUARE: &str = "\u{f0c8}"; // fa-square
pub const CIRCLE: &str = "\u{f111}"; // fa-circle
pub const SPINNER: &str = "\u{f110}"; // fa-spinner
pub const GLOBE: &str = "\u{f0ac}"; // fa-globe
pub const ENVELOPE: &str = "\u{f0e0}"; // fa-envelope
pub const BOOK: &str = "\u{f02d}"; // fa-book
pub const BUG: &str = "\u{f188}"; // fa-bug
pub const BOLT: &str = "\u{f0e7}"; // fa-bolt
pub const CUBE: &str = "\u{f1b3}"; // fa-cubes
pub const EYE: &str = "\u{f06e}"; // fa-eye
pub const CLOCK: &str = "\u{f017}"; // fa-clock
pub const FILTER: &str = "\u{f0b0}"; // fa-filter
pub const DOWNLOAD: &str = "\u{f019}"; // fa-download
pub const WIFI: &str = "\u{f1eb}"; // fa-wifi
pub const LOCK: &str = "\u{f023}"; // fa-lock
pub const UNLOCK: &str = "\u{f09c}"; // fa-unlock
pub const SERVER: &str = "\u{f233}"; // fa-server
pub const DATABASE: &str = "\u{f1c0}"; // fa-database
pub const WRENCH: &str = "\u{f0ad}"; // fa-wrench
pub const TRASH: &str = "\u{f1f8}"; // fa-trash-can
pub const REFRESH: &str = "\u{f021}"; // fa-arrows-rotate (same as SYNC)
pub const LINK: &str = "\u{f0c1}"; // fa-link
pub const ARROW_DOWN: &str = "\u{f063}"; // fa-arrow-down
pub const BELL: &str = "\u{f0f3}"; // fa-bell
pub const PAUSE: &str = "\u{f04c}"; // fa-pause
pub const PLUS: &str = "\u{f067}"; // fa-plus
pub const LAYER_GROUP: &str = "\u{f5fd}"; // fa-layer-group
pub const PLUG: &str = "\u{f1e6}"; // fa-plug

// ── New pages / features ────────────────────────────────────────────
pub const CHART_LINE: &str = "\u{f201}"; // fa-chart-line (monitoring)
pub const FILE_SHIELD: &str = "\u{e4f0}"; // fa-file-shield (FIM)
pub const SKULL: &str = "\u{f54c}"; // fa-skull-crossbones (threats)
pub const SHIELD_VIRUS: &str = "\u{e06c}"; // fa-shield-virus
pub const USB: &str = "\u{f287}"; // fa-usb
pub const MICROCHIP: &str = "\u{f2db}"; // fa-microchip
pub const MEMORY: &str = "\u{f538}"; // fa-memory
pub const HARD_DRIVE: &str = "\u{f0a0}"; // fa-hard-drive
pub const FILE: &str = "\u{f15b}"; // fa-file
pub const WRENCH_FA: &str = "\u{f7d9}"; // fa-screwdriver-wrench (remediation)
pub const SHIELD: &str = "\u{f132}"; // fa-shield
pub const SHIELD_CHECK: &str = "\u{f305}"; // fa-shield-check (or similar)

// ── Premium dashboard ───────────────────────────────────────────────
pub const BUILDING: &str = "\u{f1ad}"; // fa-building
pub const STREAM: &str = "\u{f550}"; // fa-stream
pub const CHART_PIE: &str = "\u{f200}"; // fa-chart-pie
pub const GAUGE_HIGH: &str = "\u{f625}"; // fa-gauge-high

// ── Additional icons for UX improvements ────────────────────────────
pub const SEARCH: &str = "\u{f002}"; // fa-magnifying-glass (same as DISCOVERY)
pub const INFO: &str = "\u{f05a}"; // fa-circle-info (alias for consistency)
pub const EXPAND: &str = "\u{f065}"; // fa-expand
pub const COMPRESS: &str = "\u{f066}"; // fa-compress
pub const COPY: &str = "\u{f0c5}"; // fa-copy
pub const PASTE: &str = "\u{f0ea}"; // fa-paste
pub const UNDO: &str = "\u{f0e2}"; // fa-rotate-left
pub const REDO: &str = "\u{f01e}"; // fa-rotate-right
pub const SORT_UP: &str = "\u{f0de}"; // fa-sort-up
pub const SORT_DOWN: &str = "\u{f0dd}"; // fa-sort-down
pub const SORT: &str = "\u{f0dc}"; // fa-sort
pub const ELLIPSIS: &str = "\u{f141}"; // fa-ellipsis (horizontal)
pub const ELLIPSIS_V: &str = "\u{f142}"; // fa-ellipsis-vertical
pub const CHEVRON_LEFT: &str = "\u{f053}"; // fa-chevron-left
pub const CHEVRON_RIGHT: &str = "\u{f054}"; // fa-chevron-right
pub const CHEVRON_UP: &str = "\u{f077}"; // fa-chevron-up
pub const CHEVRON_DOWN: &str = "\u{f078}"; // fa-chevron-down
pub const BARS: &str = "\u{f0c9}"; // fa-bars (hamburger menu)
pub const GRIP: &str = "\u{f58d}"; // fa-grip
pub const MOON: &str = "\u{f186}"; // fa-moon (dark mode)
pub const SUN: &str = "\u{f185}"; // fa-sun (light mode)
pub const USER: &str = "\u{f007}"; // fa-user
pub const USERS: &str = "\u{f0c0}"; // fa-users
pub const COG: &str = "\u{f013}"; // fa-cog (alias for SETTINGS)
pub const PENCIL: &str = "\u{f303}"; // fa-pencil
pub const SAVE: &str = "\u{f0c7}"; // fa-floppy-disk
pub const TIMES: &str = "\u{f00d}"; // fa-xmark (alias for XMARK)
pub const CHECK_DOUBLE: &str = "\u{f560}"; // fa-check-double
pub const STAR: &str = "\u{f005}"; // fa-star
pub const STAR_HALF: &str = "\u{f089}"; // fa-star-half-stroke
pub const HEART: &str = "\u{f004}"; // fa-heart
pub const THUMBS_UP: &str = "\u{f164}"; // fa-thumbs-up
pub const THUMBS_DOWN: &str = "\u{f165}"; // fa-thumbs-down
pub const COMMENT: &str = "\u{f075}"; // fa-comment
pub const COMMENTS: &str = "\u{f086}"; // fa-comments
pub const PAPER_PLANE: &str = "\u{f1d8}"; // fa-paper-plane
pub const CALENDAR: &str = "\u{f133}"; // fa-calendar
pub const FOLDER: &str = "\u{f07b}"; // fa-folder
pub const FOLDER_OPEN: &str = "\u{f07c}"; // fa-folder-open
pub const TAG: &str = "\u{f02b}"; // fa-tag
pub const TAGS: &str = "\u{f02c}"; // fa-tags
pub const BOOKMARK: &str = "\u{f02e}"; // fa-bookmark
pub const FLAG: &str = "\u{f024}"; // fa-flag
pub const PRINT: &str = "\u{f02f}"; // fa-print
pub const SHARE: &str = "\u{f064}"; // fa-share
pub const SHARE_NODES: &str = "\u{f1e0}"; // fa-share-nodes
pub const QR_CODE: &str = "\u{f029}"; // fa-qrcode
pub const FINGERPRINT: &str = "\u{f577}"; // fa-fingerprint
pub const KEY: &str = "\u{f084}"; // fa-key
pub const ROBOT: &str = "\u{f544}"; // fa-robot
pub const BRAIN: &str = "\u{f5dc}"; // fa-brain
