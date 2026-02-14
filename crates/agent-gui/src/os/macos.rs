//! macOS-specific GUI utilities.
//!
//! Provides clean abstractions for Dock management and software inventory
//! with proper error handling and safety guarantees.

#[cfg(target_os = "macos")]
use std::ffi::c_void;
#[cfg(target_os = "macos")]
use std::path::Path;

#[cfg(target_os = "macos")]
/// Result type for macOS operations
pub type MacOsResult<T> = Result<T, MacOsError>;

#[cfg(target_os = "macos")]
/// Errors specific to macOS operations
#[derive(Debug)]
pub enum MacOsError {
    PlutilError(String),
    ApplicationsDirError(std::io::Error),
    InvalidAppBundle(String),
    PlistParseError(String),
}

#[cfg(target_os = "macos")]
impl std::fmt::Display for MacOsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MacOsError::PlutilError(msg) => write!(f, "Failed to execute plutil command: {}", msg),
            MacOsError::ApplicationsDirError(err) => write!(f, "Failed to read /Applications directory: {}", err),
            MacOsError::InvalidAppBundle(path) => write!(f, "Invalid app bundle structure: {}", path),
            MacOsError::PlistParseError(msg) => write!(f, "Failed to parse Info.plist: {}", msg),
        }
    }
}

#[cfg(target_os = "macos")]
impl std::error::Error for MacOsError {}

#[cfg(target_os = "macos")]
#[link(name = "AppKit", kind = "framework")]
unsafe extern "C" {}

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn objc_getClass(name: *const u8) -> *mut c_void;
    fn sel_registerName(name: *const u8) -> *mut c_void;
    fn objc_msgSend();
}

#[cfg(target_os = "macos")]
type MsgSend0 = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void;
#[cfg(target_os = "macos")]
type MsgSend1 = unsafe extern "C" fn(*mut c_void, *mut c_void, isize) -> *mut c_void;

#[cfg(target_os = "macos")]
fn send0() -> MsgSend0 {
    unsafe { std::mem::transmute(objc_msgSend as *const ()) }
}

#[cfg(target_os = "macos")]
fn send1() -> MsgSend1 {
    unsafe { std::mem::transmute(objc_msgSend as *const ()) }
}

#[cfg(target_os = "macos")]
unsafe fn set_activation_policy(policy: isize) {
    unsafe {
        let cls = objc_getClass(c"NSApplication".as_ptr() as *const _);
        let sel = sel_registerName(c"sharedApplication".as_ptr() as *const _);
        let app = send0()(cls, sel);
        let sel = sel_registerName(c"setActivationPolicy:".as_ptr() as *const _);
        send1()(app, sel, policy);
    }
}

/// Dock management utilities
#[cfg(target_os = "macos")]
pub mod dock {
    use super::*;

    /// Hide the app from the macOS Dock (Accessory policy).
    /// This makes the app appear as a background utility.
    pub fn hide_icon() {
        unsafe {
            set_activation_policy(1);
        }
    }

    /// Show the app in the macOS Dock (Regular policy) and activate it.
    /// This makes the app appear as a regular application.
    pub fn show_icon() {
        unsafe {
            set_activation_policy(0);
            let cls = objc_getClass(c"NSApplication".as_ptr() as *const _);
            let sel = sel_registerName(c"sharedApplication".as_ptr() as *const _);
            let app = send0()(cls, sel);
            let sel = sel_registerName(c"activateIgnoringOtherApps:".as_ptr() as *const _);
            send1()(app, sel, 1);
        }
    }

    /// Toggle dock icon visibility based on a boolean flag
    pub fn set_visibility(visible: bool) {
        if visible {
            show_icon();
        } else {
            hide_icon();
        }
    }
}

/// Software inventory utilities
#[cfg(target_os = "macos")]
pub mod software {
    use super::*;
    use crate::dto::GuiMacOsApp;

    /// Scan /Applications for .app bundles and extract metadata from Info.plist.
    /// Returns a sorted list of macOS applications with their metadata.
    pub fn scan_installed_apps() -> MacOsResult<Vec<GuiMacOsApp>> {
        let mut apps = Vec::new();
        let apps_dir = Path::new("/Applications");
        
        let entries = std::fs::read_dir(apps_dir)
            .map_err(MacOsError::ApplicationsDirError)?;

        for entry in entries {
            let entry = entry.map_err(MacOsError::ApplicationsDirError)?;
            let path = entry.path();
            
            if !is_app_bundle(&path) {
                continue;
            }

            let plist_path = path.join("Contents/Info.plist");
            if !plist_path.exists() {
                continue;
            }

            let app_metadata = extract_app_metadata(&path, &plist_path)?;
            apps.push(app_metadata);
        }

        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(apps)
    }

    /// Check if a path represents a valid .app bundle
    fn is_app_bundle(path: &Path) -> bool {
        path.extension().and_then(|e| e.to_str()) == Some("app")
    }

    /// Extract metadata from an app bundle
    fn extract_app_metadata(app_path: &Path, plist_path: &Path) -> MacOsResult<GuiMacOsApp> {
        let name = app_path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| MacOsError::InvalidAppBundle(app_path.to_string_lossy().to_string()))?
            .to_string();

        let (version, bundle_id, publisher) = parse_info_plist(plist_path)
            .map_err(MacOsError::PlistParseError)?;

        Ok(GuiMacOsApp {
            name,
            version: normalize_field(version),
            bundle_id: normalize_field(bundle_id),
            publisher: normalize_field(publisher),
            path: app_path.to_string_lossy().to_string(),
        })
    }

    /// Normalize empty fields to display placeholder
    fn normalize_field(field: String) -> String {
        if field.is_empty() {
            "--".to_string()
        } else {
            field
        }
    }
}

/// Parse an Info.plist file to extract version, bundle ID, and publisher.
/// Returns a tuple of (version, bundle_id, publisher) or an error message.
#[cfg(target_os = "macos")]
fn parse_info_plist(path: &Path) -> Result<(String, String, String), String> {
    let output = std::process::Command::new("/usr/bin/plutil")
        .args(["-convert", "xml1", "-o", "-"])
        .arg(path)
        .output()
        .map_err(|e| format!("Failed to execute plutil: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("plutil failed: {}", stderr));
    }

    let xml = String::from_utf8_lossy(&output.stdout);
    
    let version = extract_key(&xml, "CFBundleShortVersionString");
    let bundle_id = extract_key(&xml, "CFBundleIdentifier");
    let publisher = extract_publisher(&xml);

    Ok((version, bundle_id, publisher))
}

/// Extract a key value from plist XML
#[cfg(target_os = "macos")]
fn extract_key(xml: &str, key: &str) -> String {
    let needle = format!("<key>{}</key>", key);
    if let Some(pos) = xml.find(&needle) {
        let after = &xml[pos + needle.len()..];
        if let Some(start) = after.find("<string>") {
            let val_start = start + "<string>".len();
            if let Some(end) = after[val_start..].find("</string>") {
                return after[val_start..val_start + end].to_string();
            }
        }
    }
    String::new()
}

/// Extract publisher information from plist XML
#[cfg(target_os = "macos")]
fn extract_publisher(xml: &str) -> String {
    let name = extract_key(xml, "CFBundleGetInfoString");
    if name.is_empty() {
        extract_key(xml, "NSHumanReadableCopyright")
    } else {
        name
    }
}

// Legacy compatibility functions (deprecated)
#[cfg(target_os = "macos")]
#[deprecated(note = "Use dock::show_icon() instead")]
pub fn show_dock_icon() {
    dock::show_icon();
}

#[cfg(target_os = "macos")]
#[deprecated(note = "Use dock::hide_icon() instead")]
pub fn hide_dock_icon() {
    dock::hide_icon();
}

#[cfg(target_os = "macos")]
#[deprecated(note = "Use software::scan_installed_apps() instead")]
pub fn scan_macos_apps() -> Vec<crate::dto::GuiMacOsApp> {
    software::scan_installed_apps().unwrap_or_default()
}
