// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Cross-platform OS settings launcher.
//!
//! Maps compliance check IDs to the relevant OS settings panel and opens them.

/// Open the OS settings panel relevant to a compliance check.
///
/// Returns `true` if a known mapping exists and the open command was issued.
pub fn open_for_check(check_id: &str) -> bool {
    if let Some(target) = settings_target(check_id) {
        open_os_settings(target);
        true
    } else {
        false
    }
}

/// OS settings target for a given platform.
struct SettingsTarget {
    /// macOS: `x-apple.systempreferences:` URL or preference pane ID
    #[cfg(target_os = "macos")]
    macos: &'static str,
    /// Windows: `ms-settings:` URI
    #[cfg(target_os = "windows")]
    windows: &'static str,
    /// Linux: GNOME settings panel name or command
    #[cfg(target_os = "linux")]
    linux: &'static str,
}

fn settings_target(check_id: &str) -> Option<SettingsTarget> {
    Some(match check_id {
        // Firewall
        "firewall_active" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.security?Firewall",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:windowsdefender", // or firewall.cpl
            #[cfg(target_os = "linux")]
            linux: "firewall",
        },
        // Disk encryption
        "disk_encryption" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.security?FileVault",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:deviceencryption",
            #[cfg(target_os = "linux")]
            linux: "privacy",
        },
        // Screen lock / session lock
        "screen_lock" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.security?General",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:lockscreen",
            #[cfg(target_os = "linux")]
            linux: "screen",
        },
        // MFA / Touch ID
        "mfa_enabled" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preferences.password",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:signinoptions",
            #[cfg(target_os = "linux")]
            linux: "user-accounts",
        },
        // System updates / patches
        "patches_current" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preferences.softwareupdate",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:windowsupdate",
            #[cfg(target_os = "linux")]
            linux: "info", // GNOME: Software Updates via gnome-software
        },
        // Password policy
        "password_policy" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preferences.password",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:signinoptions",
            #[cfg(target_os = "linux")]
            linux: "user-accounts",
        },
        // Antivirus
        "antivirus_active" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.security?General",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:windowsdefender",
            #[cfg(target_os = "linux")]
            linux: "privacy",
        },
        // Bluetooth
        "bluetooth_disabled" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preferences.Bluetooth",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:bluetooth",
            #[cfg(target_os = "linux")]
            linux: "bluetooth",
        },
        // Backup
        "backup_configured" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preferences.TimeMachine",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:backup",
            #[cfg(target_os = "linux")]
            linux: "privacy",
        },
        // Guest account
        "guest_account_disabled" | "admin_accounts" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preferences.users",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:otherusers",
            #[cfg(target_os = "linux")]
            linux: "user-accounts",
        },
        // Auto-login
        "auto_login_disabled" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preferences.users",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:signinoptions",
            #[cfg(target_os = "linux")]
            linux: "user-accounts",
        },
        // Remote access / SSH
        "remote_access_secure" | "ssh_hardening" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preferences.sharing",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:remotedesktop",
            #[cfg(target_os = "linux")]
            linux: "sharing",
        },
        // USB storage
        "usb_storage_disabled" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.security?General",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:usb",
            #[cfg(target_os = "linux")]
            linux: "privacy",
        },
        // Time synchronization
        "time_sync" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.datetime",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:dateandtime",
            #[cfg(target_os = "linux")]
            linux: "datetime",
        },
        // Audit logging
        "audit_logging" | "log_rotation" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.security?Privacy",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:privacy",
            #[cfg(target_os = "linux")]
            linux: "privacy",
        },
        // DNS security
        "dns_security" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.network",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:network-ethernet", // or network-wifi
            #[cfg(target_os = "linux")]
            linux: "network",
        },
        // Browser security
        "browser_security" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.security?Privacy",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:defaultapps",
            #[cfg(target_os = "linux")]
            linux: "default-apps",
        },
        // IPv6
        "ipv6_hardening" => SettingsTarget {
            #[cfg(target_os = "macos")]
            macos: "x-apple.systempreferences:com.apple.preference.network",
            #[cfg(target_os = "windows")]
            windows: "ms-settings:network",
            #[cfg(target_os = "linux")]
            linux: "network",
        },
        // Fallback: open general security/privacy settings
        _ => return None,
    })
}

fn open_os_settings(target: SettingsTarget) {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(target.macos).spawn();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", target.windows])
            .spawn();
    }

    #[cfg(target_os = "linux")]
    {
        // Try GNOME settings first, fall back to xdg-open
        let gnome = std::process::Command::new("gnome-control-center")
            .arg(target.linux)
            .spawn();
        if gnome.is_err() {
            // Try KDE systemsettings
            let _ = std::process::Command::new("systemsettings5").spawn();
        }
    }
}
