// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Inventory of the browser extensions installed for every user.
//!
//! Extensions run inside the browser with access to pages, cookies and
//! sessions, yet no software inventory lists them. This module reads them
//! from the browser profiles on disk (no browser is started):
//!
//! - Chromium family (Chrome, Edge, Brave, Chromium):
//!   `<profile>/Extensions/<id>/<version>/manifest.json`;
//! - Firefox: `<profile>/extensions.json`.
//!
//! Each extension gets a risk level derived from what it asked permission
//! for, with the reasons, so the riskiest ones can be reviewed first. The
//! level says what the extension *could* do, not that it is malicious.

use crate::user_dirs::{child_dirs, user_homes};
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};

/// Largest manifest read (a manifest is a few KB; Firefox's `extensions.json`
/// lists every add-on with its metadata).
const MAX_MANIFEST_BYTES: u64 = 8 * 1024 * 1024;

/// Browser an extension is installed in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Browser {
    Chrome,
    Edge,
    Brave,
    Chromium,
    Firefox,
}

impl std::fmt::Display for Browser {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Chrome => "Chrome",
            Self::Edge => "Edge",
            Self::Brave => "Brave",
            Self::Chromium => "Chromium",
            Self::Firefox => "Firefox",
        })
    }
}

/// What an extension could do with the permissions it holds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtensionRisk {
    Low,
    Medium,
    High,
}

/// Why an extension has its risk level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskReason {
    /// Can read and change the content of every site.
    AllSitesAccess,
    /// Can observe or alter network requests.
    InterceptsRequests,
    /// Can read cookies (session tokens).
    ReadsCookies,
    /// Can inject scripts into pages.
    InjectsScripts,
    /// Can read the clipboard.
    ReadsClipboard,
    /// Can read the browsing history.
    ReadsHistory,
    /// Can install, disable or remove other extensions.
    ManagesExtensions,
    /// Can talk to a program installed on the computer.
    NativeMessaging,
    /// Can attach the browser debugger to pages.
    Debugger,
    /// Can route the browser's traffic through a proxy.
    ControlsProxy,
    /// Not installed from the browser's store.
    Sideloaded,
}

/// One installed extension.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BrowserExtension {
    pub browser: Browser,
    /// Account the browser profile belongs to (home directory name).
    pub user: String,
    /// Browser profile (`Default`, `Profile 1`, a Firefox profile name…).
    pub profile: String,
    /// Extension identifier in the browser's store.
    pub id: String,
    pub name: String,
    pub version: String,
    /// API permissions requested (`cookies`, `webRequest`…).
    pub permissions: Vec<String>,
    /// Site patterns the extension can access.
    pub host_access: Vec<String>,
    /// `Some(false)` when the browser reports it disabled; `None`: unknown.
    pub enabled: Option<bool>,
    /// Installed from the browser's store.
    pub from_store: bool,
    pub risk: ExtensionRisk,
    pub reasons: Vec<RiskReason>,
}

fn read_json(path: &Path) -> Option<serde_json::Value> {
    let metadata = std::fs::symlink_metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_MANIFEST_BYTES {
        return None;
    }
    let mut content = String::new();
    std::fs::File::open(path)
        .ok()?
        .take(MAX_MANIFEST_BYTES)
        .read_to_string(&mut content)
        .ok()?;
    // Chromium writes some manifests with a byte-order mark.
    serde_json::from_str(content.trim_start_matches('\u{feff}')).ok()
}

fn strings(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

/// A pattern giving access to every site.
fn is_all_sites(pattern: &str) -> bool {
    matches!(
        pattern,
        "<all_urls>" | "*://*/*" | "http://*/*" | "https://*/*" | "*://*/" | "file:///*"
    )
}

/// A permission entry that is a site pattern rather than an API name.
fn is_host_pattern(permission: &str) -> bool {
    permission == "<all_urls>" || permission.contains("://")
}

/// Rate an extension from its API permissions, the sites it can access and
/// where it was installed from.
pub fn assess_risk(
    permissions: &[String],
    host_access: &[String],
    from_store: bool,
) -> (ExtensionRisk, Vec<RiskReason>) {
    let has = |name: &str| permissions.iter().any(|p| p == name);
    let all_sites = host_access.iter().any(|pattern| is_all_sites(pattern));

    let mut reasons = Vec::new();
    if all_sites {
        reasons.push(RiskReason::AllSitesAccess);
    }
    if has("webRequest") || has("webRequestBlocking") || has("declarativeNetRequest") {
        reasons.push(RiskReason::InterceptsRequests);
    }
    if has("cookies") {
        reasons.push(RiskReason::ReadsCookies);
    }
    if has("scripting") {
        reasons.push(RiskReason::InjectsScripts);
    }
    if has("clipboardRead") {
        reasons.push(RiskReason::ReadsClipboard);
    }
    if has("history") {
        reasons.push(RiskReason::ReadsHistory);
    }
    if has("management") {
        reasons.push(RiskReason::ManagesExtensions);
    }
    if has("nativeMessaging") {
        reasons.push(RiskReason::NativeMessaging);
    }
    if has("debugger") {
        reasons.push(RiskReason::Debugger);
    }
    if has("proxy") {
        reasons.push(RiskReason::ControlsProxy);
    }

    // Capabilities that reach beyond the page on their own.
    let far_reaching = reasons.iter().any(|reason| {
        matches!(
            reason,
            RiskReason::NativeMessaging | RiskReason::Debugger | RiskReason::ControlsProxy
        )
    });
    // Capabilities that turn access to every site into session theft.
    let amplifies_site_access = reasons.iter().any(|reason| {
        matches!(
            reason,
            RiskReason::InterceptsRequests
                | RiskReason::ReadsCookies
                | RiskReason::InjectsScripts
                | RiskReason::ReadsClipboard
        )
    });
    let mut risk = if far_reaching || (all_sites && amplifies_site_access) {
        ExtensionRisk::High
    } else if reasons.is_empty() {
        ExtensionRisk::Low
    } else {
        ExtensionRisk::Medium
    };

    if !from_store {
        reasons.push(RiskReason::Sideloaded);
        risk = match risk {
            ExtensionRisk::Low => ExtensionRisk::Medium,
            _ => ExtensionRisk::High,
        };
    }
    (risk, reasons)
}

// ── Chromium family ─────────────────────────────────────────────────────────

/// Resolve a localized manifest string (`__MSG_appName__`) from the
/// extension's default locale.
fn resolve_message(
    version_dir: &Path,
    manifest: &serde_json::Value,
    value: &str,
) -> Option<String> {
    let key = value.strip_prefix("__MSG_")?.strip_suffix("__")?;
    let locale = manifest.get("default_locale")?.as_str()?;
    // The locale becomes a path component: letters, digits, `_` and `-` only.
    if locale.is_empty()
        || !locale
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return None;
    }
    let messages = read_json(
        &version_dir
            .join("_locales")
            .join(locale)
            .join("messages.json"),
    )?;
    // Message keys are case-insensitive.
    messages
        .as_object()?
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(key))
        .and_then(|(_, entry)| entry.get("message")?.as_str())
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map(str::to_string)
}

/// Whether a Chromium `update_url` is one of the browser stores'.
fn is_store_update_url(update_url: Option<&str>) -> bool {
    update_url.is_some_and(|url| {
        url.starts_with("https://clients2.google.com/")
            || url.starts_with("https://edge.microsoft.com/")
    })
}

/// Read one Chromium extension from its version directory.
pub(crate) fn chromium_extension(
    browser: Browser,
    user: &str,
    profile: &str,
    id: &str,
    version_dir: &Path,
) -> Option<BrowserExtension> {
    let manifest = read_json(&version_dir.join("manifest.json"))?;
    let raw_name = manifest.get("name")?.as_str()?.trim();
    let name =
        resolve_message(version_dir, &manifest, raw_name).unwrap_or_else(|| raw_name.to_string());
    let version = manifest.get("version")?.as_str()?.trim().to_string();

    let declared = strings(manifest.get("permissions"));
    let (hosts_in_permissions, mut permissions): (Vec<String>, Vec<String>) = declared
        .into_iter()
        .partition(|permission| is_host_pattern(permission));
    let mut host_access = hosts_in_permissions;
    host_access.extend(strings(manifest.get("host_permissions")));
    if let Some(scripts) = manifest.get("content_scripts").and_then(|v| v.as_array()) {
        for script in scripts {
            host_access.extend(strings(script.get("matches")));
        }
    }
    permissions.sort();
    permissions.dedup();
    host_access.sort();
    host_access.dedup();

    let from_store = is_store_update_url(manifest.get("update_url").and_then(|v| v.as_str()));
    let (risk, reasons) = assess_risk(&permissions, &host_access, from_store);
    Some(BrowserExtension {
        browser,
        user: user.to_string(),
        profile: profile.to_string(),
        id: id.to_string(),
        name,
        version,
        permissions,
        host_access,
        enabled: None,
        from_store,
        risk,
        reasons,
    })
}

/// Numeric components of a version directory name (`1.10.0_0`), so that
/// `1.10.0` sorts after `1.9.0`.
fn version_key(version_dir: &Path) -> Vec<u64> {
    version_dir
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default()
        .split(['.', '_'])
        .map(|part| part.parse::<u64>().unwrap_or(0))
        .collect()
}

/// Extensions of every profile under one Chromium "User Data" directory.
pub(crate) fn chromium_extensions_in(
    browser: Browser,
    user: &str,
    user_data: &Path,
) -> Vec<BrowserExtension> {
    let mut extensions = Vec::new();
    for profile_dir in child_dirs(user_data, "") {
        let profile = profile_dir
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        if profile != "Default" && !profile.starts_with("Profile ") {
            continue;
        }
        for extension_dir in child_dirs(&profile_dir.join("Extensions"), "") {
            let id = extension_dir
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default();
            // Several versions may be left on disk: the highest is current.
            let Some(version_dir) = child_dirs(&extension_dir, "")
                .into_iter()
                .max_by_key(|dir| version_key(dir))
            else {
                continue;
            };
            if let Some(extension) = chromium_extension(browser, user, &profile, &id, &version_dir)
            {
                extensions.push(extension);
            }
        }
    }
    extensions
}

fn chromium_user_data_dirs(home: &Path) -> Vec<(Browser, PathBuf)> {
    if cfg!(target_os = "macos") {
        let support = home.join("Library").join("Application Support");
        vec![
            (Browser::Chrome, support.join("Google").join("Chrome")),
            (Browser::Edge, support.join("Microsoft Edge")),
            (
                Browser::Brave,
                support.join("BraveSoftware").join("Brave-Browser"),
            ),
            (Browser::Chromium, support.join("Chromium")),
        ]
    } else if cfg!(windows) {
        let local = home.join("AppData").join("Local");
        vec![
            (
                Browser::Chrome,
                local.join("Google").join("Chrome").join("User Data"),
            ),
            (
                Browser::Edge,
                local.join("Microsoft").join("Edge").join("User Data"),
            ),
            (
                Browser::Brave,
                local
                    .join("BraveSoftware")
                    .join("Brave-Browser")
                    .join("User Data"),
            ),
            (Browser::Chromium, local.join("Chromium").join("User Data")),
        ]
    } else {
        let config = home.join(".config");
        vec![
            (Browser::Chrome, config.join("google-chrome")),
            (Browser::Edge, config.join("microsoft-edge")),
            (
                Browser::Brave,
                config.join("BraveSoftware").join("Brave-Browser"),
            ),
            (Browser::Chromium, config.join("chromium")),
        ]
    }
}

// ── Firefox ─────────────────────────────────────────────────────────────────

/// Extensions listed in one Firefox profile's `extensions.json`. Built-in
/// and system add-ons, themes and language packs are left out.
pub(crate) fn firefox_extensions_in(
    user: &str,
    profile: &str,
    extensions_json: &Path,
) -> Vec<BrowserExtension> {
    let Some(document) = read_json(extensions_json) else {
        return Vec::new();
    };
    let Some(addons) = document.get("addons").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    addons
        .iter()
        .filter_map(|addon| {
            if addon.get("type")?.as_str()? != "extension" {
                return None;
            }
            let location = addon.get("location").and_then(|v| v.as_str()).unwrap_or("");
            if location.starts_with("app-builtin") || location.starts_with("app-system") {
                return None;
            }
            let id = addon.get("id")?.as_str()?.to_string();
            let name = addon
                .get("defaultLocale")
                .and_then(|locale| locale.get("name"))
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .unwrap_or(id.as_str())
                .to_string();
            let version = addon
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let granted = addon.get("userPermissions");
            let mut permissions = strings(granted.and_then(|p| p.get("permissions")));
            let mut host_access = strings(granted.and_then(|p| p.get("origins")));
            permissions.sort();
            permissions.dedup();
            host_access.sort();
            host_access.dedup();

            // signedState 2: signed by addons.mozilla.org.
            let from_store = addon.get("signedState").and_then(|v| v.as_i64()) == Some(2);
            let enabled = addon.get("active").and_then(|v| v.as_bool());
            let (risk, reasons) = assess_risk(&permissions, &host_access, from_store);
            Some(BrowserExtension {
                browser: Browser::Firefox,
                user: user.to_string(),
                profile: profile.to_string(),
                id,
                name,
                version,
                permissions,
                host_access,
                enabled,
                from_store,
                risk,
                reasons,
            })
        })
        .collect()
}

fn firefox_profiles_dir(home: &Path) -> PathBuf {
    if cfg!(target_os = "macos") {
        home.join("Library")
            .join("Application Support")
            .join("Firefox")
            .join("Profiles")
    } else if cfg!(windows) {
        home.join("AppData")
            .join("Roaming")
            .join("Mozilla")
            .join("Firefox")
            .join("Profiles")
    } else {
        home.join(".mozilla").join("firefox")
    }
}

// ── Collection ──────────────────────────────────────────────────────────────

/// Extensions found under the given home directories, riskiest first.
pub(crate) fn collect(homes: &[PathBuf]) -> Vec<BrowserExtension> {
    let mut extensions = Vec::new();
    for home in homes {
        let user = home
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        for (browser, user_data) in chromium_user_data_dirs(home) {
            extensions.extend(chromium_extensions_in(browser, &user, &user_data));
        }
        for profile_dir in child_dirs(&firefox_profiles_dir(home), "") {
            let profile = profile_dir
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default();
            extensions.extend(firefox_extensions_in(
                &user,
                &profile,
                &profile_dir.join("extensions.json"),
            ));
        }
    }
    extensions.sort_by(|a, b| {
        b.risk
            .cmp(&a.risk)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| (a.browser, &a.user, &a.profile).cmp(&(b.browser, &b.user, &b.profile)))
    });
    extensions
}

/// Inventory the browser extensions of every user of the endpoint.
pub async fn installed_extensions() -> Vec<BrowserExtension> {
    tokio::task::spawn_blocking(|| collect(&user_homes()))
        .await
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn list(items: &[&str]) -> Vec<String> {
        items.iter().map(|item| (*item).to_string()).collect()
    }

    fn write(path: &Path, content: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, content).unwrap();
    }

    #[test]
    fn risk_follows_what_the_extension_could_do() {
        // A store extension limited to one site.
        assert_eq!(
            assess_risk(&list(&["storage"]), &list(&["https://example.com/*"]), true),
            (ExtensionRisk::Low, vec![])
        );
        // Access to every site alone, or a sensitive API alone: medium.
        assert_eq!(
            assess_risk(&list(&["storage"]), &list(&["<all_urls>"]), true),
            (ExtensionRisk::Medium, vec![RiskReason::AllSitesAccess])
        );
        assert_eq!(
            assess_risk(&list(&["cookies"]), &list(&["https://example.com/*"]), true),
            (ExtensionRisk::Medium, vec![RiskReason::ReadsCookies])
        );
        // Every site plus cookies: sessions can be stolen anywhere.
        assert_eq!(
            assess_risk(&list(&["cookies", "tabs"]), &list(&["*://*/*"]), true),
            (
                ExtensionRisk::High,
                vec![RiskReason::AllSitesAccess, RiskReason::ReadsCookies]
            )
        );
        // Reaching outside the browser is high on its own.
        for permission in ["nativeMessaging", "debugger", "proxy"] {
            assert_eq!(
                assess_risk(&list(&[permission]), &[], true).0,
                ExtensionRisk::High
            );
        }
    }

    #[test]
    fn sideloading_raises_the_risk_one_level() {
        let (risk, reasons) = assess_risk(&list(&["storage"]), &[], false);
        assert_eq!(risk, ExtensionRisk::Medium);
        assert_eq!(reasons, [RiskReason::Sideloaded]);

        let (risk, reasons) = assess_risk(&list(&["history"]), &[], false);
        assert_eq!(risk, ExtensionRisk::High);
        assert_eq!(reasons, [RiskReason::ReadsHistory, RiskReason::Sideloaded]);
    }

    fn chrome_profile(user_data: &Path, profile: &str, id: &str, version: &str) -> PathBuf {
        user_data
            .join(profile)
            .join("Extensions")
            .join(id)
            .join(version)
    }

    #[test]
    fn chromium_extensions_are_read_with_localized_names_and_all_host_sources() {
        let dir = tempfile::tempdir().unwrap();
        let user_data = dir.path().join("Chrome");

        // MV3 extension with a localized name, from the store.
        let blocker = chrome_profile(
            &user_data,
            "Default",
            "aaaabbbbccccddddeeeeffffgggghhhh",
            "1.2.0_0",
        );
        write(
            &blocker.join("manifest.json"),
            r#"{
                "manifest_version": 3,
                "name": "__MSG_extName__",
                "version": "1.2.0",
                "default_locale": "en",
                "permissions": ["storage", "declarativeNetRequest", "storage"],
                "host_permissions": ["<all_urls>"],
                "update_url": "https://clients2.google.com/service/update2/crx"
            }"#,
        );
        write(
            &blocker.join("_locales").join("en").join("messages.json"),
            r#"{ "extname": { "message": " Ad Blocker " } }"#,
        );
        // An older version left on disk must not be reported.
        write(
            &chrome_profile(
                &user_data,
                "Default",
                "aaaabbbbccccddddeeeeffffgggghhhh",
                "1.1.0_0",
            )
            .join("manifest.json"),
            r#"{ "name": "Old", "version": "1.1.0" }"#,
        );

        // MV2 extension, sideloaded, hosts mixed into permissions and
        // content scripts.
        write(
            &chrome_profile(
                &user_data,
                "Profile 2",
                "zzzzyyyyxxxxwwwwvvvvuuuuttttssss",
                "0.9_0",
            )
            .join("manifest.json"),
            "\u{feff}{
                \"manifest_version\": 2,
                \"name\": \"Coupon Helper\",
                \"version\": \"0.9\",
                \"permissions\": [\"cookies\", \"https://shop.example/*\"],
                \"content_scripts\": [{ \"matches\": [\"*://*/*\"], \"js\": [\"a.js\"] }]
            }",
        );
        // Not a profile directory.
        write(
            &chrome_profile(&user_data, "Crashpad", "ignored", "1_0").join("manifest.json"),
            r#"{ "name": "Ignored", "version": "1" }"#,
        );

        let mut extensions = chromium_extensions_in(Browser::Chrome, "alice", &user_data);
        extensions.sort_by(|a, b| a.name.cmp(&b.name));
        assert_eq!(extensions.len(), 2);

        let blocker = &extensions[0];
        assert_eq!(blocker.name, "Ad Blocker");
        assert_eq!(blocker.version, "1.2.0");
        assert_eq!(blocker.profile, "Default");
        assert_eq!(blocker.user, "alice");
        assert_eq!(blocker.permissions, ["declarativeNetRequest", "storage"]);
        assert_eq!(blocker.host_access, ["<all_urls>"]);
        assert!(blocker.from_store);
        assert_eq!(blocker.risk, ExtensionRisk::High);

        let coupon = &extensions[1];
        assert_eq!(coupon.name, "Coupon Helper");
        assert_eq!(coupon.profile, "Profile 2");
        assert_eq!(coupon.permissions, ["cookies"]);
        assert_eq!(coupon.host_access, ["*://*/*", "https://shop.example/*"]);
        assert!(!coupon.from_store);
        assert_eq!(coupon.risk, ExtensionRisk::High);
        assert!(coupon.reasons.contains(&RiskReason::Sideloaded));
    }

    #[test]
    fn current_version_is_the_highest_number_not_the_last_name() {
        assert!(version_key(Path::new("1.10.0_0")) > version_key(Path::new("1.9.0_0")));
        assert!(version_key(Path::new("2.0_1")) > version_key(Path::new("2.0_0")));
        assert_eq!(version_key(Path::new("beta")), [0]);
    }

    #[test]
    fn unresolved_localized_name_falls_back_to_the_raw_value() {
        let dir = tempfile::tempdir().unwrap();
        let version_dir = dir.path().join("1.0_0");
        write(
            &version_dir.join("manifest.json"),
            r#"{ "name": "__MSG_name__", "version": "1.0", "default_locale": "../../etc" }"#,
        );
        let extension =
            chromium_extension(Browser::Edge, "bob", "Default", "id", &version_dir).unwrap();
        assert_eq!(extension.name, "__MSG_name__");
    }

    #[test]
    fn firefox_extensions_skip_builtin_addons_and_themes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("extensions.json");
        write(
            &path,
            r#"{ "addons": [
                { "id": "uBlock0@raymondhill.net", "type": "extension", "version": "1.58.0",
                  "defaultLocale": { "name": "uBlock Origin" }, "active": true,
                  "location": "app-profile", "signedState": 2,
                  "userPermissions": { "permissions": ["webRequest", "storage"], "origins": ["<all_urls>"] } },
                { "id": "local@dev", "type": "extension", "version": "0.1",
                  "defaultLocale": { "name": "" }, "active": false,
                  "location": "app-profile", "signedState": 0,
                  "userPermissions": { "permissions": [], "origins": [] } },
                { "id": "screenshots@mozilla.org", "type": "extension", "version": "39",
                  "location": "app-builtin-addons", "signedState": 3 },
                { "id": "default-theme@mozilla.org", "type": "theme", "version": "1.3",
                  "location": "app-profile" }
            ] }"#,
        );

        let extensions = firefox_extensions_in("alice", "abcd.default-release", &path);
        assert_eq!(extensions.len(), 2);

        let ublock = &extensions[0];
        assert_eq!(ublock.name, "uBlock Origin");
        assert_eq!(ublock.browser, Browser::Firefox);
        assert_eq!(ublock.enabled, Some(true));
        assert!(ublock.from_store);
        assert_eq!(ublock.risk, ExtensionRisk::High);

        let local = &extensions[1];
        assert_eq!(
            local.name, "local@dev",
            "an empty name falls back to the id"
        );
        assert_eq!(local.enabled, Some(false));
        assert_eq!(local.risk, ExtensionRisk::Medium);
        assert_eq!(local.reasons, [RiskReason::Sideloaded]);

        assert!(firefox_extensions_in("alice", "p", &dir.path().join("absent.json")).is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn collection_walks_every_home_and_lists_the_riskiest_first() {
        let dir = tempfile::tempdir().unwrap();
        let alice = dir.path().join("alice");
        let bob = dir.path().join("bob");
        write(
            &alice
                .join("Library/Application Support/Google/Chrome/Default/Extensions/aaaa/1.0_0/manifest.json"),
            r#"{ "name": "Quiet", "version": "1.0", "update_url": "https://clients2.google.com/service/update2/crx" }"#,
        );
        write(
            &bob.join("Library/Application Support/Microsoft Edge/Default/Extensions/bbbb/2.0_0/manifest.json"),
            r#"{ "name": "Noisy", "version": "2.0", "permissions": ["debugger"], "update_url": "https://edge.microsoft.com/extensionwebstorebase/v1/crx" }"#,
        );

        let extensions = collect(&[alice, bob]);
        let summary: Vec<(&str, &str, Browser, ExtensionRisk)> = extensions
            .iter()
            .map(|e| (e.name.as_str(), e.user.as_str(), e.browser, e.risk))
            .collect();
        assert_eq!(
            summary,
            [
                ("Noisy", "bob", Browser::Edge, ExtensionRisk::High),
                ("Quiet", "alice", Browser::Chrome, ExtensionRisk::Low),
            ]
        );
    }
}
