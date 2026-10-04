// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! PDF export of the reports.
//!
//! The reports are produced as HTML by the application itself, with a small
//! set of tags (headings, paragraphs, lists, tables, a few `div` blocks).
//! This module reads that HTML back into blocks and lays them out on A4
//! pages, writing the PDF directly: no rendering engine, no font file (the
//! standard Helvetica of every PDF reader, which covers French text).
//!
//! Each page carries the SHA-256 fingerprint of the report content, so a
//! printed or forwarded copy can be matched against the report it was made
//! from. This is an integrity mark, not a signature: it proves which content
//! the PDF was generated from, not who generated it.

use sha2::{Digest, Sha256};

/// One block of a report.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Block {
    Heading {
        level: u8,
        text: String,
    },
    Paragraph(String),
    /// A figure shown large (the global score).
    Figure(String),
    ListItem(String),
    /// Rows of cells; the first row is the header when `header` is true.
    Table {
        header: bool,
        rows: Vec<Vec<String>>,
    },
    /// Small print (the report footer).
    Note(String),
}

// ── HTML to blocks ──────────────────────────────────────────────────────────

fn decode_entity(name: &str) -> Option<char> {
    if let Some(code) = name.strip_prefix('#') {
        let value = match code.strip_prefix(['x', 'X']) {
            Some(hex) => u32::from_str_radix(hex, 16).ok()?,
            None => code.parse().ok()?,
        };
        return char::from_u32(value);
    }
    Some(match name {
        "amp" => '&',
        "lt" => '<',
        "gt" => '>',
        "quot" => '"',
        "apos" => '\'',
        "nbsp" => ' ',
        "eacute" => 'é',
        "egrave" => 'è',
        "ecirc" => 'ê',
        "euml" => 'ë',
        "agrave" => 'à',
        "acirc" => 'â',
        "ccedil" => 'ç',
        "ocirc" => 'ô',
        "icirc" => 'î',
        "iuml" => 'ï',
        "ugrave" => 'ù',
        "ucirc" => 'û',
        "Eacute" => 'É',
        "Egrave" => 'È',
        "Ecirc" => 'Ê',
        "Agrave" => 'À',
        "Ccedil" => 'Ç',
        "Ocirc" => 'Ô',
        "mdash" => '—',
        "ndash" => '–',
        "hellip" => '…',
        "laquo" => '«',
        "raquo" => '»',
        "rsquo" => '’',
        "lsquo" => '‘',
        "middot" => '·',
        "deg" => '°',
        "euro" => '€',
        "times" => '×',
        _ => return None,
    })
}

/// Decode entities and collapse whitespace.
fn clean_text(raw: &str) -> String {
    let mut decoded = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(start) = rest.find('&') {
        decoded.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        let entity = after
            .find(';')
            .filter(|end| *end <= 10)
            .and_then(|end| decode_entity(&after[..end]).map(|c| (c, end)));
        match entity {
            Some((c, end)) => {
                decoded.push(c);
                rest = &after[end + 1..];
            }
            None => {
                decoded.push('&');
                rest = after;
            }
        }
    }
    decoded.push_str(rest);
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Where the text being read goes.
#[derive(Clone, Copy, PartialEq)]
enum Target {
    Paragraph,
    Heading(u8),
    Figure,
    Note,
    ListItem,
    Cell,
}

/// Read a report's HTML into blocks. Text inside `head`, `style` and
/// `script` is ignored; inline tags only contribute their text.
pub fn html_to_blocks(html: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut text = String::new();
    let mut target = Target::Paragraph;
    // Depth of `div`s, and the depth at which a grouping `div` was opened
    // (`stat`: value and label on one line; `score`; `footer`).
    let mut div_depth = 0usize;
    let mut group: Option<(usize, Target)> = None;
    let mut skipping: Option<String> = None;
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut row: Vec<String> = Vec::new();
    let mut table_has_header = false;

    fn flush(blocks: &mut Vec<Block>, text: &mut String, target: Target) {
        let content = clean_text(text);
        text.clear();
        if content.is_empty() {
            return;
        }
        blocks.push(match target {
            Target::Heading(level) => Block::Heading {
                level,
                text: content,
            },
            Target::Figure => Block::Figure(content),
            Target::Note => Block::Note(content),
            Target::ListItem => Block::ListItem(content),
            Target::Paragraph | Target::Cell => Block::Paragraph(content),
        });
    }

    let mut rest = html;
    while !rest.is_empty() {
        let Some(open) = rest.find('<') else {
            if skipping.is_none() {
                text.push_str(rest);
            }
            break;
        };
        if skipping.is_none() {
            text.push_str(&rest[..open]);
        }
        let Some(close) = rest[open..].find('>') else {
            break;
        };
        let tag = &rest[open + 1..open + close];
        rest = &rest[open + close + 1..];

        let closing = tag.starts_with('/');
        let name: String = tag
            .trim_start_matches('/')
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric())
            .collect::<String>()
            .to_ascii_lowercase();

        if let Some(skipped) = &skipping {
            if closing && name == *skipped {
                skipping = None;
            }
            continue;
        }
        match (name.as_str(), closing) {
            ("head" | "style" | "script", false) => skipping = Some(name),
            ("h1" | "h2" | "h3", false) => {
                flush(&mut blocks, &mut text, target);
                target = Target::Heading(name.as_bytes()[1] - b'0');
            }
            ("h1" | "h2" | "h3", true) => {
                flush(&mut blocks, &mut text, target);
                target = Target::Paragraph;
            }
            ("li", false) => {
                flush(&mut blocks, &mut text, target);
                target = Target::ListItem;
            }
            ("li", true) => {
                flush(&mut blocks, &mut text, target);
                target = Target::Paragraph;
            }
            ("footer", false) => {
                flush(&mut blocks, &mut text, target);
                target = Target::Note;
            }
            ("footer", true) => {
                flush(&mut blocks, &mut text, target);
                target = Target::Paragraph;
            }
            ("table", false) => {
                flush(&mut blocks, &mut text, target);
                rows.clear();
                table_has_header = false;
            }
            ("table", true) => {
                if !rows.is_empty() {
                    blocks.push(Block::Table {
                        header: table_has_header,
                        rows: std::mem::take(&mut rows),
                    });
                }
                target = Target::Paragraph;
            }
            ("tr", false) => row.clear(),
            ("tr", true) => {
                if !row.is_empty() {
                    rows.push(std::mem::take(&mut row));
                }
            }
            ("th" | "td", false) => {
                text.clear();
                target = Target::Cell;
                if name == "th" && rows.is_empty() {
                    table_has_header = true;
                }
            }
            ("th" | "td", true) => {
                row.push(clean_text(&text));
                text.clear();
                target = Target::Paragraph;
            }
            ("div", false) => {
                div_depth += 1;
                if target == Target::Cell || group.is_some() {
                    text.push(' ');
                } else {
                    flush(&mut blocks, &mut text, target);
                    let class = tag
                        .split_once("class=\"")
                        .and_then(|(_, rest)| rest.split('"').next())
                        .unwrap_or("");
                    let grouped = match class {
                        "stat" => Some(Target::Paragraph),
                        "score" => Some(Target::Figure),
                        "footer" => Some(Target::Note),
                        _ => None,
                    };
                    if let Some(kind) = grouped {
                        group = Some((div_depth, kind));
                        target = kind;
                    }
                }
            }
            ("div", true) => {
                match group {
                    Some((depth, _)) if depth == div_depth => {
                        flush(&mut blocks, &mut text, target);
                        group = None;
                        target = Target::Paragraph;
                    }
                    Some(_) => text.push(' '),
                    None if target == Target::Cell => text.push(' '),
                    None => flush(&mut blocks, &mut text, target),
                }
                div_depth = div_depth.saturating_sub(1);
            }
            ("p" | "br" | "ul" | "ol" | "body" | "html" | "section", _) => {
                if target == Target::Cell || group.is_some() {
                    text.push(' ');
                } else {
                    flush(&mut blocks, &mut text, target);
                }
            }
            // Inline tags: only their text counts.
            _ => {}
        }
    }
    flush(&mut blocks, &mut text, target);
    blocks
}

// ── Text measurement and encoding ───────────────────────────────────────────

/// Helvetica advance widths of the printable ASCII characters, in
/// thousandths of the font size (Adobe font metrics).
const HELVETICA_WIDTHS: [u16; 95] = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
    278, // space - /
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, // 0 - 9
    278, 278, 584, 584, 584, 556, 1015, // : - @
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667,
    611, 722, 667, 944, 667, 667, 611, // A - Z
    278, 278, 278, 469, 556, 333, // [ - `
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
    278, 556, 500, 722, 500, 500, 500, // a - z
    334, 260, 334, 584, // { - ~
];

/// The unaccented letter a character is drawn as wide as.
fn base_letter(c: char) -> char {
    match c {
        'à' | 'â' | 'ä' | 'á' | 'ã' => 'a',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'î' | 'ï' | 'í' | 'ì' => 'i',
        'ô' | 'ö' | 'ó' | 'ò' | 'õ' => 'o',
        'ù' | 'û' | 'ü' | 'ú' => 'u',
        'ç' => 'c',
        'ñ' => 'n',
        'À' | 'Â' | 'Ä' | 'Á' => 'A',
        'É' | 'È' | 'Ê' | 'Ë' => 'E',
        'Î' | 'Ï' => 'I',
        'Ô' | 'Ö' => 'O',
        'Ù' | 'Û' | 'Ü' => 'U',
        'Ç' => 'C',
        '’' | '‘' => '\'',
        '«' | '»' => 'n',
        '–' => 'n',
        '—' | '…' | '€' | 'œ' | 'Œ' => 'W',
        other => other,
    }
}

/// Width of a text in points. Bold is a little wider than regular.
fn text_width(text: &str, size: f32, bold: bool) -> f32 {
    let units: u32 = text
        .chars()
        .map(|c| {
            let c = base_letter(c);
            match u32::from(c) {
                code @ 32..=126 => u32::from(HELVETICA_WIDTHS[(code - 32) as usize]),
                _ => 556,
            }
        })
        .sum();
    let width = units as f32 * size / 1000.0;
    if bold { width * 1.07 } else { width }
}

/// The byte of a character in the PDF `WinAnsiEncoding`, or `None` when the
/// standard fonts cannot draw it.
fn win_ansi(c: char) -> Option<u8> {
    Some(match c {
        ' '..='~' => c as u8,
        '\u{a0}' | '\u{202f}' | '\u{2009}' => b' ',
        '\u{a1}'..='\u{ff}' => c as u8,
        '€' => 0x80,
        '‚' => 0x82,
        '„' => 0x84,
        '…' => 0x85,
        'Œ' => 0x8c,
        '‘' => 0x91,
        '’' => 0x92,
        '“' => 0x93,
        '”' => 0x94,
        '•' => 0x95,
        '–' => 0x96,
        '—' => 0x97,
        '™' => 0x99,
        'œ' => 0x9c,
        _ => return None,
    })
}

/// A text as a PDF hexadecimal string. Characters outside the standard
/// fonts are replaced by a readable equivalent, or dropped.
fn pdf_text(text: &str) -> String {
    let mut hex = String::with_capacity(text.len() * 2 + 2);
    hex.push('<');
    for c in text.chars() {
        let replacement: &str = match c {
            '→' => "->",
            '←' => "<-",
            '≥' => ">=",
            '≤' => "<=",
            '▲' => "+",
            '▼' => "-",
            '✓' | '✔' => "oui",
            '✗' | '✘' => "non",
            _ => "",
        };
        if let Some(byte) = win_ansi(c) {
            hex.push_str(&format!("{byte:02X}"));
        } else {
            for byte in replacement.bytes() {
                hex.push_str(&format!("{byte:02X}"));
            }
        }
    }
    hex.push('>');
    hex
}

/// Break a text into lines no wider than `max_width`.
fn wrap(text: &str, size: f32, bold: bool, max_width: f32) -> Vec<String> {
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        let candidate = if line.is_empty() {
            word.to_string()
        } else {
            format!("{line} {word}")
        };
        if text_width(&candidate, size, bold) <= max_width {
            line = candidate;
            continue;
        }
        if !line.is_empty() {
            lines.push(std::mem::take(&mut line));
        }
        // A single word wider than the line (a path, a hash) is cut.
        let mut piece = String::new();
        for c in word.chars() {
            piece.push(c);
            if text_width(&piece, size, bold) > max_width && piece.chars().count() > 1 {
                let last = piece.pop().unwrap_or(c);
                lines.push(std::mem::take(&mut piece));
                piece.push(last);
            }
        }
        line = piece;
    }
    if !line.is_empty() {
        lines.push(line);
    }
    lines
}

// ── Layout ──────────────────────────────────────────────────────────────────

const PAGE_WIDTH: f32 = 595.0;
const PAGE_HEIGHT: f32 = 842.0;
const MARGIN: f32 = 50.0;
/// Room kept at the bottom of each page for the footer.
const FOOTER_HEIGHT: f32 = 46.0;
const CONTENT_WIDTH: f32 = PAGE_WIDTH - 2.0 * MARGIN;
const CELL_PADDING: f32 = 4.0;

struct Layout {
    pages: Vec<String>,
    /// Baseline the next line is written on.
    y: f32,
}

impl Layout {
    fn new() -> Self {
        Self {
            pages: vec![String::new()],
            y: PAGE_HEIGHT - MARGIN,
        }
    }

    fn page(&mut self) -> &mut String {
        if self.pages.is_empty() {
            self.pages.push(String::new());
        }
        let last = self.pages.len() - 1;
        &mut self.pages[last]
    }

    fn new_page(&mut self) {
        self.pages.push(String::new());
        self.y = PAGE_HEIGHT - MARGIN;
    }

    /// Start a new page unless `height` still fits on this one.
    fn ensure(&mut self, height: f32) {
        if self.y - height < MARGIN + FOOTER_HEIGHT {
            self.new_page();
        }
    }

    fn text(&mut self, x: f32, y: f32, size: f32, bold: bool, gray: f32, text: &str) {
        let font = if bold { "F2" } else { "F1" };
        let line = format!(
            "BT {gray:.2} g /{font} {size:.1} Tf {x:.2} {y:.2} Td {} Tj ET\n",
            pdf_text(text)
        );
        self.page().push_str(&line);
    }

    fn rule(&mut self, x1: f32, x2: f32, y: f32, gray: f32) {
        let line = format!("{gray:.2} G 0.5 w {x1:.2} {y:.2} m {x2:.2} {y:.2} l S\n");
        self.page().push_str(&line);
    }

    fn fill(&mut self, x: f32, y: f32, width: f32, height: f32, gray: f32) {
        let rect = format!("{gray:.2} g {x:.2} {y:.2} {width:.2} {height:.2} re f\n");
        self.page().push_str(&rect);
    }

    /// Write wrapped text at the left margin plus `indent`.
    fn lines(&mut self, text: &str, size: f32, bold: bool, gray: f32, indent: f32) {
        let leading = size * 1.4;
        for line in wrap(text, size, bold, CONTENT_WIDTH - indent) {
            self.ensure(leading);
            self.y -= leading;
            let y = self.y;
            self.text(MARGIN + indent, y, size, bold, gray, &line);
        }
    }

    fn block(&mut self, block: &Block) {
        match block {
            Block::Heading { level, text } => {
                let size = match level {
                    1 => 18.0,
                    2 => 13.0,
                    _ => 11.0,
                };
                // Keep a heading with the first lines of what follows it.
                self.ensure(size * 1.4 + 40.0);
                self.y -= if *level == 1 { 4.0 } else { 12.0 };
                self.lines(text, size, true, 0.0, 0.0);
                if *level <= 2 {
                    self.y -= 4.0;
                    let y = self.y;
                    self.rule(MARGIN, PAGE_WIDTH - MARGIN, y, 0.75);
                }
                self.y -= 4.0;
            }
            Block::Paragraph(text) => {
                self.lines(text, 10.0, false, 0.0, 0.0);
                self.y -= 4.0;
            }
            Block::Figure(text) => {
                self.y -= 6.0;
                self.lines(text, 26.0, true, 0.0, 0.0);
                self.y -= 2.0;
            }
            Block::ListItem(text) => {
                self.ensure(14.0);
                let y = self.y - 14.0;
                self.text(MARGIN + 6.0, y, 10.0, false, 0.0, "•");
                self.lines(text, 10.0, false, 0.0, 16.0);
                self.y -= 2.0;
            }
            Block::Note(text) => {
                self.y -= 8.0;
                self.lines(text, 8.0, false, 0.45, 0.0);
            }
            Block::Table { header, rows } => self.table(*header, rows),
        }
    }

    fn table(&mut self, has_header: bool, rows: &[Vec<String>]) {
        const SIZE: f32 = 9.0;
        const LEADING: f32 = 12.0;
        let columns = rows.iter().map(Vec::len).max().unwrap_or(0);
        if columns == 0 {
            return;
        }
        // Columns share the width in proportion to their widest content,
        // each keeping a readable minimum.
        let natural: Vec<f32> = (0..columns)
            .map(|column| {
                rows.iter()
                    .filter_map(|row| row.get(column))
                    .map(|cell| text_width(cell, SIZE, true) + 2.0 * CELL_PADDING)
                    .fold(40.0_f32, f32::max)
                    .min(CONTENT_WIDTH * 0.6)
            })
            .collect();
        let total: f32 = natural.iter().sum();
        let widths: Vec<f32> = natural
            .iter()
            .map(|width| width * CONTENT_WIDTH / total)
            .collect();

        // A row wrapped into its columns, and its height.
        let measure = |row: &[String], bold: bool| -> (Vec<Vec<String>>, f32) {
            let cells: Vec<Vec<String>> = (0..columns)
                .map(|column| {
                    let text = row.get(column).map(String::as_str).unwrap_or("");
                    wrap(text, SIZE, bold, widths[column] - 2.0 * CELL_PADDING)
                })
                .collect();
            let line_count = cells.iter().map(Vec::len).max().unwrap_or(1).max(1);
            (cells, line_count as f32 * LEADING + 2.0 * CELL_PADDING)
        };
        let draw = |layout: &mut Layout, cells: &[Vec<String>], height: f32, bold: bool| {
            let top = layout.y;
            if bold {
                layout.fill(MARGIN, top - height, CONTENT_WIDTH, height, 0.92);
            }
            let mut x = MARGIN;
            for (column, lines) in cells.iter().enumerate() {
                for (index, line) in lines.iter().enumerate() {
                    let y = top - CELL_PADDING - SIZE - index as f32 * LEADING;
                    layout.text(x + CELL_PADDING, y, SIZE, bold, 0.0, line);
                }
                x += widths[column];
            }
            layout.y = top - height;
            let y = layout.y;
            layout.rule(MARGIN, PAGE_WIDTH - MARGIN, y, 0.8);
        };

        self.y -= 4.0;
        let (header_row, body) = match (has_header, rows.split_first()) {
            (true, Some((first, rest))) => (Some(measure(first, true)), rest),
            _ => (None, rows),
        };
        if let Some((cells, height)) = &header_row {
            // The header never ends a page on its own.
            self.ensure(height + LEADING + 2.0 * CELL_PADDING);
            draw(self, cells, *height, true);
        }
        for row in body {
            let (cells, height) = measure(row, false);
            if self.y - height < MARGIN + FOOTER_HEIGHT {
                // The table continues on a new page, under its header.
                self.new_page();
                if let Some((header_cells, header_height)) = &header_row {
                    draw(self, header_cells, *header_height, true);
                }
            }
            draw(self, &cells, height, false);
        }
        self.y -= 8.0;
    }
}

// ── PDF file ────────────────────────────────────────────────────────────────

/// A PDF text string for the document information (UTF-16BE, any character).
fn info_string(text: &str) -> String {
    let mut hex = String::from("<FEFF");
    for unit in text.encode_utf16() {
        hex.push_str(&format!("{unit:04X}"));
    }
    hex.push('>');
    hex
}

/// SHA-256 of a report's content, in hexadecimal.
pub fn content_fingerprint(content: &str) -> String {
    Sha256::digest(content.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// SHA-256 of a file's bytes, in hexadecimal: what `sha256sum` prints.
pub fn file_fingerprint(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Lay the blocks out and write the PDF file.
///
/// `footer` is printed at the bottom of every page beside the page number;
/// `fingerprint` under it.
pub fn render(
    title: &str,
    blocks: &[Block],
    footer: &str,
    fingerprint: &str,
    created: chrono::DateTime<chrono::Utc>,
) -> Vec<u8> {
    let mut layout = Layout::new();
    for block in blocks {
        layout.block(block);
    }
    let page_count = layout.pages.len();
    for (index, page) in layout.pages.iter_mut().enumerate() {
        let mut footer_layout = Layout {
            pages: vec![std::mem::take(page)],
            y: 0.0,
        };
        footer_layout.rule(MARGIN, PAGE_WIDTH - MARGIN, MARGIN + 28.0, 0.75);
        footer_layout.text(MARGIN, MARGIN + 16.0, 8.0, false, 0.35, footer);
        let number = format!("Page {} / {}", index + 1, page_count);
        let x = PAGE_WIDTH - MARGIN - text_width(&number, 8.0, false);
        footer_layout.text(x, MARGIN + 16.0, 8.0, false, 0.35, &number);
        footer_layout.text(
            MARGIN,
            MARGIN + 5.0,
            6.5,
            false,
            0.45,
            &format!("Empreinte SHA-256 du contenu : {fingerprint}"),
        );
        *page = footer_layout.pages.remove(0);
    }

    // Objects: 1 catalog, 2 page tree, 3 and 4 fonts, 5 information, then a
    // page object and its content stream for every page.
    let mut objects: Vec<Vec<u8>> = Vec::new();
    objects.push(b"<< /Type /Catalog /Pages 2 0 R >>".to_vec());
    let kids: String = (0..page_count)
        .map(|index| format!("{} 0 R ", 6 + 2 * index))
        .collect();
    objects.push(format!("<< /Type /Pages /Kids [{kids}] /Count {page_count} >>").into_bytes());
    for font in ["Helvetica", "Helvetica-Bold"] {
        objects.push(
            format!(
                "<< /Type /Font /Subtype /Type1 /BaseFont /{font} /Encoding /WinAnsiEncoding >>"
            )
            .into_bytes(),
        );
    }
    objects.push(
        format!(
            "<< /Title {} /Producer {} /CreationDate (D:{}Z) >>",
            info_string(title),
            info_string("Sentinel GRC Nexus"),
            created.format("%Y%m%d%H%M%S")
        )
        .into_bytes(),
    );
    for (index, content) in layout.pages.iter().enumerate() {
        objects.push(
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] \
                 /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {} 0 R >>",
                7 + 2 * index
            )
            .into_bytes(),
        );
        let mut stream = format!("<< /Length {} >>\nstream\n", content.len()).into_bytes();
        stream.extend_from_slice(content.as_bytes());
        stream.extend_from_slice(b"\nendstream");
        objects.push(stream);
    }

    let mut pdf: Vec<u8> = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
    let mut offsets = Vec::with_capacity(objects.len());
    for (index, object) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n", index + 1).as_bytes());
        pdf.extend_from_slice(object);
        pdf.extend_from_slice(b"\nendobj\n");
    }
    let xref = pdf.len();
    pdf.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
    pdf.extend_from_slice(b"0000000000 65535 f \n");
    for offset in &offsets {
        pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R /Info 5 0 R >>\nstartxref\n{xref}\n%%EOF\n",
            objects.len() + 1
        )
        .as_bytes(),
    );
    pdf
}

/// The PDF of a report, from its HTML.
pub fn report_pdf(title: &str, html: &str, created: chrono::DateTime<chrono::Utc>) -> Vec<u8> {
    render(
        title,
        &html_to_blocks(html),
        &format!("Sentinel GRC Nexus \u{2014} {title}"),
        &content_fingerprint(html),
        created,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const REPORT: &str = r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Synth&egrave;se</title>
<style>body { color: red; } .stat > div { x: 1 }</style></head>
<body>
<h1>Synth&egrave;se Ex&eacute;cutive</h1>
<p>G&eacute;n&eacute;r&eacute; le 04/10/2026 &agrave; 08:00</p>
<div class="score">72 %</div>
<p>Score global de conformit&eacute;</p>
<h2>Indicateurs Cl&eacute;s</h2>
<div class="stat"><div class="stat-value">34</div><div class="stat-label">Contr&ocirc;les</div></div>
<div class="stat"><div class="stat-value">3</div><div class="stat-label">D&eacute;faillants</div></div>
<h2>Top 5</h2>
<ul><li>Pare-feu (&lt;d&eacute;sactiv&eacute;&gt;) &amp; <strong>critique</strong></li><li>Chiffrement</li></ul>
<table><tr><th>Contr&ocirc;le</th><th>Statut</th></tr>
<tr><td>firewall_active</td><td><span class="fail">&Eacute;chec</span></td></tr>
<tr><td>disk_encryption</td><td>Conforme</td></tr></table>
<div class="footer">Rapport g&eacute;n&eacute;r&eacute; par Sentinel GRC Nexus &mdash; 04/10/2026</div>
</body></html>"#;

    #[test]
    fn report_html_is_read_into_blocks() {
        let blocks = html_to_blocks(REPORT);
        assert_eq!(
            blocks,
            vec![
                Block::Heading {
                    level: 1,
                    text: "Synthèse Exécutive".into()
                },
                Block::Paragraph("Généré le 04/10/2026 à 08:00".into()),
                Block::Figure("72 %".into()),
                Block::Paragraph("Score global de conformité".into()),
                Block::Heading {
                    level: 2,
                    text: "Indicateurs Clés".into()
                },
                Block::Paragraph("34 Contrôles".into()),
                Block::Paragraph("3 Défaillants".into()),
                Block::Heading {
                    level: 2,
                    text: "Top 5".into()
                },
                Block::ListItem("Pare-feu (<désactivé>) & critique".into()),
                Block::ListItem("Chiffrement".into()),
                Block::Table {
                    header: true,
                    rows: vec![
                        vec!["Contrôle".into(), "Statut".into()],
                        vec!["firewall_active".into(), "Échec".into()],
                        vec!["disk_encryption".into(), "Conforme".into()],
                    ],
                },
                Block::Note("Rapport généré par Sentinel GRC Nexus — 04/10/2026".into()),
            ]
        );
    }

    #[test]
    fn entities_and_plain_fragments_are_handled() {
        assert_eq!(
            clean_text("a &amp; b &#233; &#xE9; &unknown; R&D"),
            "a & b é é &unknown; R&D"
        );
        assert_eq!(clean_text("  deux \n  lignes "), "deux lignes");
        // The report generated on the platform side is a bare fragment.
        assert_eq!(
            html_to_blocks("<h1>Titre</h1><p>Résumé.</p><footer>Généré par Sentinel</footer>"),
            vec![
                Block::Heading {
                    level: 1,
                    text: "Titre".into()
                },
                Block::Paragraph("Résumé.".into()),
                Block::Note("Généré par Sentinel".into()),
            ]
        );
        assert_eq!(
            html_to_blocks("texte seul"),
            vec![Block::Paragraph("texte seul".into())]
        );
        assert!(html_to_blocks("").is_empty());
        assert!(
            html_to_blocks("<p>ouvert").len() == 1,
            "an unclosed tag keeps its text"
        );
    }

    #[test]
    fn french_text_is_encoded_for_the_standard_fonts() {
        assert_eq!(pdf_text("Aé"), "<41E9>");
        assert_eq!(pdf_text("œ—€’"), "<9C978092>");
        assert_eq!(pdf_text("a\u{202f}%"), "<612025>", "narrow no-break space");
        assert_eq!(pdf_text("a → b"), "<61202D3E2062>");
        assert_eq!(
            pdf_text("x 🙂 y"),
            "<78202079>",
            "undrawable characters are dropped"
        );
        // Parentheses and backslashes need no escaping in a hexadecimal string.
        assert_eq!(pdf_text("(\\)"), "<285C29>");
    }

    #[test]
    fn widths_follow_the_font_metrics() {
        assert!((text_width("iiii", 10.0, false) - 8.88).abs() < 0.01);
        assert!((text_width("WWWW", 10.0, false) - 37.76).abs() < 0.01);
        assert_eq!(text_width("é", 10.0, false), text_width("e", 10.0, false));
        assert!(text_width("abc", 10.0, true) > text_width("abc", 10.0, false));
    }

    #[test]
    fn lines_never_exceed_the_width() {
        let text =
            "Le pare-feu applicatif est désactivé sur ce poste et doit être réactivé sans attendre";
        let lines = wrap(text, 10.0, false, 120.0);
        assert!(lines.len() > 2);
        assert!(
            lines
                .iter()
                .all(|line| text_width(line, 10.0, false) <= 120.0)
        );
        assert_eq!(lines.join(" "), text);

        // A word wider than the line is cut rather than overflowing.
        let hash = "a".repeat(64);
        let lines = wrap(&hash, 10.0, false, 100.0);
        assert!(lines.len() > 1);
        assert!(
            lines
                .iter()
                .all(|line| text_width(line, 10.0, false) <= 100.0)
        );
        assert_eq!(lines.concat(), hash);
        assert!(wrap("", 10.0, false, 100.0).is_empty());
    }

    fn created() -> chrono::DateTime<chrono::Utc> {
        chrono::DateTime::parse_from_rfc3339("2026-10-04T08:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc)
    }

    /// Byte offset of every object, read from the cross-reference table.
    fn xref_offsets(pdf: &[u8]) -> Vec<usize> {
        let text = String::from_utf8_lossy(pdf);
        let start: usize = text
            .rsplit("startxref\n")
            .next()
            .and_then(|tail| tail.lines().next())
            .and_then(|line| line.parse().ok())
            .expect("startxref");
        assert!(pdf[start..].starts_with(b"xref\n"));
        // Byte offsets: read the table from the bytes, not from the lossy text.
        String::from_utf8_lossy(&pdf[start..])
            .lines()
            .skip(3)
            .take_while(|line| line.ends_with(" n "))
            .map(|line| line[..10].parse().unwrap())
            .collect()
    }

    #[test]
    fn pdf_structure_is_consistent() {
        let pdf = report_pdf("Synthèse exécutive — 04/10/2026", REPORT, created());
        assert!(pdf.starts_with(b"%PDF-1.4\n"));
        assert!(pdf.ends_with(b"%%EOF\n"));

        let offsets = xref_offsets(&pdf);
        assert_eq!(
            offsets.len(),
            7,
            "catalog, pages, 2 fonts, info, 1 page, 1 stream"
        );
        for (index, offset) in offsets.iter().enumerate() {
            let expected = format!("{} 0 obj\n", index + 1);
            assert!(
                pdf[*offset..].starts_with(expected.as_bytes()),
                "object {} is not at its recorded offset",
                index + 1
            );
        }

        let text = String::from_utf8_lossy(&pdf);
        assert!(text.contains("/Count 1"));
        assert!(text.contains("/BaseFont /Helvetica-Bold"));
        assert!(text.contains("/CreationDate (D:20261004080000Z)"));
        // The declared stream length is the real one.
        let length: usize = text
            .split("/Length ")
            .nth(1)
            .and_then(|rest| rest.split(' ').next())
            .and_then(|value| value.parse().ok())
            .unwrap();
        let stream_start = text.find("stream\n").unwrap() + "stream\n".len();
        let stream_end = text.find("\nendstream").unwrap();
        assert_eq!(stream_end - stream_start, length);
        // The fingerprint of the content is printed on the page.
        let fingerprint = content_fingerprint(REPORT);
        assert_eq!(fingerprint.len(), 64);
        assert!(text.contains(&pdf_text(&format!(
            "Empreinte SHA-256 du contenu : {fingerprint}"
        ))));
        assert!(text.contains(&pdf_text("Page 1 / 1")));
    }

    #[test]
    fn long_tables_continue_on_new_pages_with_their_header() {
        let mut html =
            String::from("<h1>Audit</h1><table><tr><th>Contrôle</th><th>Statut</th></tr>");
        for index in 0..120 {
            html.push_str(&format!(
                "<tr><td>controle_{index}</td><td>Conforme</td></tr>"
            ));
        }
        html.push_str("</table>");
        let pdf = report_pdf("Audit", &html, created());
        let text = String::from_utf8_lossy(&pdf);

        let pages = text.matches("/Type /Page ").count();
        assert!(pages >= 3, "120 rows need several pages, got {pages}");
        assert!(text.contains(&format!("/Count {pages}")));
        assert_eq!(xref_offsets(&pdf).len(), 5 + 2 * pages);
        // The header is drawn once per page, every row exactly once.
        assert_eq!(text.matches(&pdf_text("Statut")).count(), pages);
        for index in [0, 57, 119] {
            assert_eq!(
                text.matches(&pdf_text(&format!("controle_{index}")))
                    .count(),
                1
            );
        }
        assert!(text.contains(&pdf_text(&format!("Page {pages} / {pages}"))));
    }

    #[test]
    fn the_same_report_gives_the_same_file() {
        let first = report_pdf("Titre", REPORT, created());
        let second = report_pdf("Titre", REPORT, created());
        assert_eq!(first, second);
        assert_ne!(
            content_fingerprint(REPORT),
            content_fingerprint("autre contenu")
        );
        // Known SHA-256 of "abc": the sidecar file matches `sha256sum`.
        assert_eq!(
            file_fingerprint(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
