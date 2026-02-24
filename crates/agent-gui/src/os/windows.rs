//! Windows-specific GUI utilities.
//!
//! Provides software inventory by scanning the Windows Registry
//! for installed programs.

#[cfg(target_os = "windows")]
pub mod software {
    use crate::dto::GuiNativeApp;

    use windows::core::HSTRING;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY,
        HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, REG_SZ,
    };

    /// Registry paths containing installed software entries.
    const UNINSTALL_PATHS: &[(&str, HKEY)] = &[
        (r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", HKEY_LOCAL_MACHINE),
        (r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall", HKEY_LOCAL_MACHINE),
        (r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", HKEY_CURRENT_USER),
    ];

    /// Scan the Windows Registry for installed applications.
    pub fn scan_installed_apps() -> Result<Vec<GuiNativeApp>, String> {
        let mut apps = Vec::new();

        for &(subkey_path, root_key) in UNINSTALL_PATHS {
            if let Ok(entries) = enumerate_uninstall_key(root_key, subkey_path) {
                apps.extend(entries);
            }
        }

        // Deduplicate by name+version (same app may appear in multiple registry hives)
        apps.sort_by(|a, b| {
            a.name
                .to_lowercase()
                .cmp(&b.name.to_lowercase())
                .then_with(|| a.version.cmp(&b.version))
        });
        apps.dedup_by(|a, b| {
            a.name.eq_ignore_ascii_case(&b.name) && a.version == b.version
        });

        Ok(apps)
    }

    /// Enumerate all subkeys under an Uninstall registry path and extract app metadata.
    fn enumerate_uninstall_key(
        root: HKEY,
        subkey_path: &str,
    ) -> Result<Vec<GuiNativeApp>, String> {
        let mut apps = Vec::new();
        let subkey_hstring = HSTRING::from(subkey_path);
        let mut hkey = HKEY::default();

        let status = unsafe {
            RegOpenKeyExW(root, &subkey_hstring, 0, KEY_READ, &mut hkey)
        };
        if status.is_err() {
            return Ok(apps); // Key may not exist (e.g. no 32-bit apps), not an error
        }

        let mut index: u32 = 0;
        loop {
            let mut name_buf = [0u16; 256];
            let mut name_len = name_buf.len() as u32;

            let status = unsafe {
                RegEnumKeyExW(
                    hkey,
                    index,
                    windows::core::PWSTR(name_buf.as_mut_ptr()),
                    &mut name_len,
                    None,
                    windows::core::PWSTR::null(),
                    None,
                    None,
                )
            };

            if status.is_err() {
                break; // No more subkeys
            }

            let subkey_name = String::from_utf16_lossy(&name_buf[..name_len as usize]);

            if let Some(app) = read_app_entry(hkey, &subkey_name) {
                apps.push(app);
            }

            index += 1;
        }

        unsafe { let _ = RegCloseKey(hkey); }
        Ok(apps)
    }

    /// Read a single application entry from a registry subkey.
    fn read_app_entry(parent_key: HKEY, subkey_name: &str) -> Option<GuiNativeApp> {
        let subkey_hstring = HSTRING::from(subkey_name);
        let mut hkey = HKEY::default();

        let status = unsafe {
            RegOpenKeyExW(parent_key, &subkey_hstring, 0, KEY_READ, &mut hkey)
        };
        if status.is_err() {
            return None;
        }

        let name = read_reg_string(hkey, "DisplayName").unwrap_or_default();
        if name.is_empty() {
            unsafe { let _ = RegCloseKey(hkey); }
            return None;
        }

        // Skip Windows updates (KB patches)
        if name.starts_with("KB") && name.chars().skip(2).all(|c| c.is_ascii_digit()) {
            unsafe { let _ = RegCloseKey(hkey); }
            return None;
        }

        // Check SystemComponent flag — skip if set to 1
        let system_component = read_reg_string(hkey, "SystemComponent")
            .map(|v| v.trim() == "1")
            .unwrap_or(false);

        if system_component {
            unsafe { let _ = RegCloseKey(hkey); }
            return None;
        }

        let version = read_reg_string(hkey, "DisplayVersion").unwrap_or_default();
        let publisher = read_reg_string(hkey, "Publisher").unwrap_or_default();
        let install_location = read_reg_string(hkey, "InstallLocation").unwrap_or_default();
        let bundle_id = read_reg_string(hkey, "UninstallString").unwrap_or_default();

        let path = if install_location.is_empty() {
            // Fall back to extracting path from UninstallString
            extract_path_from_uninstall(&bundle_id)
        } else {
            install_location
        };

        unsafe { let _ = RegCloseKey(hkey); }

        Some(GuiNativeApp {
            name,
            version: normalize(version),
            bundle_id: normalize(subkey_name.to_string()),
            publisher: normalize(publisher),
            path: normalize(path),
        })
    }

    /// Read a REG_SZ string value from a registry key.
    fn read_reg_string(hkey: HKEY, value_name: &str) -> Option<String> {
        let value_hstring = HSTRING::from(value_name);
        let mut data_type = REG_SZ;
        let mut data_size: u32 = 0;

        // First call: get required buffer size
        let status = unsafe {
            RegQueryValueExW(
                hkey,
                &value_hstring,
                None,
                Some(&mut data_type),
                None,
                Some(&mut data_size),
            )
        };
        if status.is_err() || data_size == 0 {
            return None;
        }

        // Allocate buffer and read the value
        let mut buffer = vec![0u8; data_size as usize];
        let status = unsafe {
            RegQueryValueExW(
                hkey,
                &value_hstring,
                None,
                Some(&mut data_type),
                Some(buffer.as_mut_ptr()),
                Some(&mut data_size),
            )
        };
        if status.is_err() {
            return None;
        }

        // Convert UTF-16LE bytes to String, stripping trailing null
        let u16_slice: &[u16] = unsafe {
            std::slice::from_raw_parts(
                buffer.as_ptr().cast::<u16>(),
                data_size as usize / 2,
            )
        };
        let s = String::from_utf16_lossy(u16_slice);
        Some(s.trim_end_matches('\0').to_string())
    }

    /// Extract a directory path from an UninstallString (best effort).
    fn extract_path_from_uninstall(uninstall: &str) -> String {
        let trimmed = uninstall.trim().trim_start_matches('"');
        if let Some(end) = trimmed.find('"') {
            let exe_path = &trimmed[..end];
            if let Some(parent) = std::path::Path::new(exe_path).parent() {
                return parent.to_string_lossy().to_string();
            }
        }
        // Try the raw string as a path
        if let Some(parent) = std::path::Path::new(trimmed.split_whitespace().next().unwrap_or("")).parent() {
            return parent.to_string_lossy().to_string();
        }
        String::new()
    }

    /// Normalize empty fields to display placeholder.
    fn normalize(field: String) -> String {
        if field.is_empty() { "--".to_string() } else { field }
    }
}
