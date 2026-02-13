//! macOS-specific GUI utilities.

use std::ffi::c_void;

#[link(name = "AppKit", kind = "framework")]
unsafe extern "C" {}

unsafe extern "C" {
    fn objc_getClass(name: *const u8) -> *mut c_void;
    fn sel_registerName(name: *const u8) -> *mut c_void;
    fn objc_msgSend();
}

type MsgSend0 = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void;
type MsgSend1 = unsafe extern "C" fn(*mut c_void, *mut c_void, isize) -> *mut c_void;

fn send0() -> MsgSend0 {
    unsafe { std::mem::transmute(objc_msgSend as *const ()) }
}
fn send1() -> MsgSend1 {
    unsafe { std::mem::transmute(objc_msgSend as *const ()) }
}

unsafe fn set_activation_policy(policy: isize) {
    unsafe {
        let cls = objc_getClass(c"NSApplication".as_ptr() as *const _);
        let sel = sel_registerName(c"sharedApplication".as_ptr() as *const _);
        let app = send0()(cls, sel);
        let sel = sel_registerName(c"setActivationPolicy:".as_ptr() as *const _);
        send1()(app, sel, policy);
    }
}

/// Hide the app from the macOS Dock (Accessory policy).
pub fn hide_dock_icon() {
    unsafe {
        set_activation_policy(1);
    }
}

/// Show the app in the macOS Dock (Regular policy) and activate it.
pub fn show_dock_icon() {
    unsafe {
        set_activation_policy(0);
        let cls = objc_getClass(c"NSApplication".as_ptr() as *const _);
        let sel = sel_registerName(c"sharedApplication".as_ptr() as *const _);
        let app = send0()(cls, sel);
        let sel = sel_registerName(c"activateIgnoringOtherApps:".as_ptr() as *const _);
        send1()(app, sel, 1);
    }
}

/// Scan /Applications for .app bundles and extract metadata from Info.plist.
pub fn scan_macos_apps() -> Vec<crate::dto::GuiMacOsApp> {
    let mut apps = Vec::new();

    use std::path::Path;

    let apps_dir = Path::new("/Applications");
    if let Ok(entries) = std::fs::read_dir(apps_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("app") {
                continue;
            }
            let plist_path = path.join("Contents/Info.plist");
            if !plist_path.exists() {
                continue;
            }

            // Parse Info.plist
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string();

            let (version, bundle_id, publisher) =
                parse_info_plist(&plist_path).unwrap_or_default();

            apps.push(crate::dto::GuiMacOsApp {
                name,
                version: if version.is_empty() {
                    "--".to_string()
                } else {
                    version
                },
                bundle_id: if bundle_id.is_empty() {
                    "--".to_string()
                } else {
                    bundle_id
                },
                publisher: if publisher.is_empty() {
                    "--".to_string()
                } else {
                    publisher
                },
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    apps.sort_by(|a, b| {
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    apps
}

/// Parse an Info.plist file to extract version, bundle ID, and publisher.
fn parse_info_plist(path: &std::path::Path) -> Option<(String, String, String)> {
    // Use /usr/bin/plutil to convert binary plist to XML, then parse.
    let output = std::process::Command::new("/usr/bin/plutil")
        .args(["-convert", "xml1", "-o", "-"])
        .arg(path)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let xml = String::from_utf8_lossy(&output.stdout);

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

    let version = extract_key(&xml, "CFBundleShortVersionString");
    let bundle_id = extract_key(&xml, "CFBundleIdentifier");
    let publisher = {
        let name = extract_key(&xml, "CFBundleGetInfoString");
        if name.is_empty() {
            extract_key(&xml, "NSHumanReadableCopyright")
        } else {
            name
        }
    };

    Some((version, bundle_id, publisher))
}
