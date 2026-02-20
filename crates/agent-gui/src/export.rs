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
            .map_err(|e| format!("Impossible de creer le dossier: {}", e))?;
    }

    let mut file = std::fs::File::create(path)
        .map_err(|e| format!("Impossible de creer le fichier: {}", e))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Erreur d'ecriture: {}", e))?;

    tracing::info!("CSV exported to {}", path.display());
    Ok(())
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
