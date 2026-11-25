// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! CSV export utility for data tables.

use std::path::{Path, PathBuf};

/// Export data to a CSV file with UTF-8 BOM and semicolon separators (French Excel).
pub fn export_csv(headers: &[&str], rows: &[Vec<String>], path: &Path) -> Result<(), String> {
    use std::io::Write;

    let mut content = String::new();
    // UTF-8 BOM for Excel compatibility
    content.push('\u{FEFF}');

    // Header row
    content.push_str(&headers.join(";"));
    content.push('\n');

    // Data rows
    for row in rows {
        let escaped: Vec<String> = row
            .iter()
            .map(|cell| {
                // Guard against CSV injection — prefix formula-triggering characters
                // so spreadsheet apps (Excel, LibreOffice) don't interpret them.
                let safe = if cell.starts_with('=')
                    || cell.starts_with('+')
                    || cell.starts_with('-')
                    || cell.starts_with('@')
                    || cell.starts_with('\t')
                    || cell.starts_with('\r')
                {
                    format!("'{cell}")
                } else {
                    cell.clone()
                };
                if safe.contains(';') || safe.contains('"') || safe.contains('\n') {
                    format!("\"{}\"", safe.replace('"', "\"\""))
                } else {
                    safe
                }
            })
            .collect();
        content.push_str(&escaped.join(";"));
        content.push('\n');
    }

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Impossible de créer le dossier : {}", e))?;
    }

    let mut file = std::fs::File::create(path)
        .map_err(|e| format!("Impossible de créer le fichier : {}", e))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Erreur d'écriture : {}", e))?;

    tracing::info!("CSV exported to {}", path.display());
    Ok(())
}

/// `stem_AAAAMMJJ_HHMMSS.ext`, in local time: successive exports sit side by
/// side instead of replacing one another.
pub fn timestamped_name(stem: &str, extension: &str) -> String {
    format!(
        "{stem}_{}.{extension}",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    )
}

/// Export `rows` to a timestamped CSV file in the default export folder.
/// Returns the path written, for the confirmation shown to the operator.
pub fn export_csv_timestamped(
    stem: &str,
    headers: &[&str],
    rows: &[Vec<String>],
) -> Result<PathBuf, String> {
    let path = default_export_path(&timestamped_name(stem, "csv"));
    export_csv(headers, rows, &path)?;
    Ok(path)
}

/// Default export path on the user's Desktop.
pub fn default_export_path(filename: &str) -> PathBuf {
    if let Some(dirs) = directories::UserDirs::new()
        && let Some(desktop) = dirs.desktop_dir()
    {
        return desktop.join(filename);
    }
    // Fallback: home directory
    if let Some(dirs) = directories::BaseDirs::new() {
        return dirs.home_dir().join(filename);
    }
    PathBuf::from(filename)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamped_names_keep_stem_and_extension() {
        let name = timestamped_name("risques", "csv");
        assert!(name.starts_with("risques_") && name.ends_with(".csv"));
        // risques_ + AAAAMMJJ_HHMMSS + .csv
        assert_eq!(name.len(), "risques_".len() + 15 + ".csv".len());
    }

    #[test]
    fn csv_quotes_separators_and_guards_formulas() {
        let dir = std::env::temp_dir().join(format!("sentinel_csv_{}", std::process::id()));
        let path = dir.join("t.csv");
        export_csv(
            &["a", "b", "c"],
            &[vec!["x;y".into(), "=1+1".into(), String::new()]],
            &path,
        )
        .unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(content, "\u{feff}a;b;c\n\"x;y\";'=1+1;\n");
    }
}
