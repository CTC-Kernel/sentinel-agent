// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Enforcement of the USB mass-storage policy, with what each system offers.
//!
//! - **Linux**: a udev rule de-authorizes mass-storage interfaces (class
//!   08) as they appear, and the interfaces of a device found connected are
//!   de-authorized through sysfs. The allowlist is written into the rule.
//! - **Windows**: the storage drivers (`USBSTOR`, `UASPStor`) are disabled
//!   in the registry, and given back their previous start type when the
//!   policy is lifted. A driver cannot spare one device: with an allowlist
//!   the agent only detects.
//! - **macOS**: the volumes of the device are forcibly unmounted when it
//!   is seen. This is an ejection, not a kernel block: the device stays
//!   attached and readable until the scan that ejects it.
//!
//! What is actually in force is reported by [`UsbEnforcement`]: a platform
//! that cannot block says "detection only" instead of claiming a block.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use agent_common::types::{UsbDevice, UsbDeviceClass, UsbPolicy};

/// What the agent does about USB mass storage on this host.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsbEnforcementMode {
    /// USB monitoring is turned off in the configuration.
    Disabled,
    /// Devices are reported; the policy does not ask to block storage.
    #[default]
    MonitoringOnly,
    /// Mass storage is blocked by the system (driver or authorization).
    Blocking,
    /// Volumes are ejected when seen: not a block.
    EjectOnly,
    /// The policy asks for a block that could not be put in place here.
    DetectionOnly,
}

impl UsbEnforcementMode {
    /// Stable code, for the interface and the platform.
    pub fn code(self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::MonitoringOnly => "monitoring_only",
            Self::Blocking => "blocking",
            Self::EjectOnly => "eject_only",
            Self::DetectionOnly => "detection_only",
        }
    }
}

/// The mode in force and, in French for the operator, what it means here.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct UsbEnforcement {
    pub mode: UsbEnforcementMode,
    pub detail: String,
}

impl UsbEnforcement {
    pub(crate) fn new(mode: UsbEnforcementMode, detail: impl Into<String>) -> Self {
        Self {
            mode,
            detail: detail.into(),
        }
    }

    pub(crate) fn disabled() -> Self {
        Self::new(
            UsbEnforcementMode::Disabled,
            "Surveillance USB d\u{e9}sactiv\u{e9}e dans la configuration de l'agent.",
        )
    }

    pub(crate) fn monitoring_only() -> Self {
        Self::new(
            UsbEnforcementMode::MonitoringOnly,
            "Les p\u{e9}riph\u{e9}riques USB sont signal\u{e9}s\u{a0}; la politique ne demande pas de bloquer le stockage de masse.",
        )
    }
}

/// A connected device and how the system names it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SeenDevice {
    pub device: UsbDevice,
    /// Linux: its sysfs directory. macOS: its whole disks (`disk4`), space
    /// separated. Windows: its PnP instance id.
    pub handle: Option<String>,
}

/// What the enforcement remembers from one scan to the next.
#[derive(Debug, Default)]
pub(crate) struct EnforcementState {
    /// Keys of the connected devices the agent blocked.
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    pub blocked: HashSet<String>,
}

/// Whether the policy forbids this device.
pub(crate) fn is_forbidden(policy: &UsbPolicy, device: &UsbDevice) -> bool {
    policy.block_mass_storage
        && device.class == UsbDeviceClass::MassStorage
        && !policy
            .allowlist
            .contains(&(device.vendor_id, device.product_id))
}

// ── Linux ───────────────────────────────────────────────────────────────

/// Where the rule that de-authorizes mass storage is installed.
#[cfg(target_os = "linux")]
const UDEV_RULE_PATH: &str = "/etc/udev/rules.d/99-sentinel-usb-storage.rules";

/// The udev rule de-authorizing mass-storage interfaces as they appear,
/// except on the allowlisted devices.
#[cfg(any(target_os = "linux", test))]
pub(crate) fn udev_rules(allowlist: &[(u16, u16)]) -> String {
    const END: &str = "sentinel_usb_storage_end";
    let mut rules = String::from(
        "# Managed by the Sentinel GRC agent (USB mass-storage policy). Do not edit:\n\
         # the agent rewrites this file, and removes it when the policy is lifted.\n",
    );
    for skip in [
        "ACTION!=\"add\"",
        "SUBSYSTEM!=\"usb\"",
        "ENV{DEVTYPE}!=\"usb_interface\"",
        "ATTR{bInterfaceClass}!=\"08\"",
    ] {
        rules.push_str(&format!("{skip}, GOTO=\"{END}\"\n"));
    }
    let mut allowed = allowlist.to_vec();
    allowed.sort_unstable();
    allowed.dedup();
    for (vendor, product) in allowed {
        rules.push_str(&format!(
            "ATTRS{{idVendor}}==\"{vendor:04x}\", ATTRS{{idProduct}}==\"{product:04x}\", GOTO=\"{END}\"\n"
        ));
    }
    rules.push_str("ATTR{authorized}=\"0\"\n");
    rules.push_str(&format!("LABEL=\"{END}\"\n"));
    rules
}

/// The mass-storage interfaces of a device: the sysfs directories named
/// `<device>:<config>.<interface>` whose class is 08.
#[cfg(any(target_os = "linux", test))]
pub(crate) fn storage_interfaces(device_dir: &std::path::Path) -> Vec<std::path::PathBuf> {
    let Some(name) = device_dir.file_name().and_then(|n| n.to_str()) else {
        return Vec::new();
    };
    let prefix = format!("{name}:");
    let Ok(entries) = std::fs::read_dir(device_dir) else {
        return Vec::new();
    };
    let mut interfaces: Vec<_> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(&prefix))
                && std::fs::read_to_string(path.join("bInterfaceClass"))
                    .is_ok_and(|class| class.trim().eq_ignore_ascii_case("08"))
        })
        .collect();
    interfaces.sort();
    interfaces
}

/// Authorize or de-authorize every mass-storage interface of a device.
/// `Ok(true)` when the device has such interfaces and all are now in the
/// state asked for.
#[cfg(any(target_os = "linux", test))]
pub(crate) fn set_storage_authorized(
    device_dir: &std::path::Path,
    authorized: bool,
) -> std::io::Result<bool> {
    let wanted = if authorized { "1" } else { "0" };
    let interfaces = storage_interfaces(device_dir);
    for interface in &interfaces {
        let attribute = interface.join("authorized");
        if std::fs::read_to_string(&attribute).is_ok_and(|now| now.trim() == wanted) {
            continue;
        }
        std::fs::write(&attribute, wanted)?;
    }
    Ok(!interfaces.is_empty())
}

/// Install the rule (or remove it with `None`). `Ok(true)` when the file
/// changed, in which case udev is asked to read its rules again.
#[cfg(target_os = "linux")]
fn sync_udev_rule(wanted: Option<&str>) -> std::io::Result<bool> {
    let path = std::path::Path::new(UDEV_RULE_PATH);
    let current = std::fs::read_to_string(path).ok();
    if current.as_deref() == wanted {
        return Ok(false);
    }
    match wanted {
        Some(rules) => std::fs::write(path, rules)?,
        None => std::fs::remove_file(path)?,
    }
    let reload = std::process::Command::new("udevadm")
        .args(["control", "--reload-rules"])
        .status();
    if !reload.is_ok_and(|status| status.success()) {
        tracing::warn!("USB policy: udev did not reload its rules; they apply at its next start");
    }
    Ok(true)
}

#[cfg(target_os = "linux")]
pub(crate) fn enforce(
    policy: &UsbPolicy,
    blocking: bool,
    seen: &[SeenDevice],
    key_of: impl Fn(&UsbDevice) -> String,
    state: &mut EnforcementState,
) -> (UsbEnforcement, Vec<UsbDevice>) {
    use std::path::Path;
    let mut newly_blocked = Vec::new();
    let present: HashSet<String> = seen.iter().map(|s| key_of(&s.device)).collect();
    state.blocked.retain(|key| present.contains(key));

    let rule = sync_udev_rule(blocking.then(|| udev_rules(&policy.allowlist)).as_deref());
    match &rule {
        Ok(true) if blocking => tracing::info!(
            "USB policy: mass-storage rule installed in {} ({} allowlisted device(s))",
            UDEV_RULE_PATH,
            policy.allowlist.len()
        ),
        Ok(true) => tracing::info!("USB policy: mass-storage rule removed from {UDEV_RULE_PATH}"),
        Ok(false) => {}
        // Every scan while it lasts: the mode reported, logged when it
        // changes, carries the cause.
        Err(e) => tracing::debug!("USB policy: {UDEV_RULE_PATH} not updated: {e}"),
    }

    let mut refused = None;
    for SeenDevice { device, handle } in seen {
        let (Some(dir), key) = (handle.as_deref().map(Path::new), key_of(device)) else {
            continue;
        };
        if blocking && is_forbidden(policy, device) {
            match set_storage_authorized(dir, false) {
                Ok(true) if state.blocked.insert(key.clone()) => newly_blocked.push(device.clone()),
                Ok(_) => {}
                Err(e) => refused = Some(e),
            }
        } else if state.blocked.remove(&key) {
            // Allowlisted since, or the policy was lifted: give it back.
            match set_storage_authorized(dir, true) {
                Ok(_) => tracing::info!(
                    "USB policy: {} ({:04X}:{:04X}) authorized again",
                    device.description,
                    device.vendor_id,
                    device.product_id
                ),
                Err(e) => tracing::warn!("USB policy: {} not re-authorized: {e}", dir.display()),
            }
        }
    }

    let enforcement = if !blocking {
        UsbEnforcement::monitoring_only()
    } else if rule.is_ok() && refused.is_none() {
        UsbEnforcement::new(
            UsbEnforcementMode::Blocking,
            "Stockage de masse USB bloqu\u{e9}\u{a0}: r\u{e8}gle udev (interfaces de classe 08 d\u{e9}sautoris\u{e9}es au branchement) et d\u{e9}sautorisation des p\u{e9}riph\u{e9}riques d\u{e9}j\u{e0} branch\u{e9}s. Les p\u{e9}riph\u{e9}riques de la liste blanche sont \u{e9}pargn\u{e9}s.",
        )
    } else if rule.is_err() && refused.is_none() && !state.blocked.is_empty() {
        UsbEnforcement::new(
            UsbEnforcementMode::Blocking,
            "Stockage de masse USB d\u{e9}sautoris\u{e9} \u{e0} chaque analyse seulement\u{a0}: la r\u{e8}gle udev n'a pas pu \u{ea}tre install\u{e9}e, un p\u{e9}riph\u{e9}rique reste lisible jusqu'\u{e0} l'analyse suivante.",
        )
    } else {
        let cause = refused
            .map(|e| e.to_string())
            .or_else(|| rule.err().map(|e| e.to_string()))
            .unwrap_or_default();
        UsbEnforcement::new(
            UsbEnforcementMode::DetectionOnly,
            format!(
                "D\u{e9}tection seule\u{a0}: le blocage du stockage de masse USB n'a pas pu \u{ea}tre mis en place ({cause}). L'agent doit s'ex\u{e9}cuter en root."
            ),
        )
    };
    (enforcement, newly_blocked)
}

// ── macOS ───────────────────────────────────────────────────────────────

/// The disks to look for in `mount`: the whole disk itself and the APFS
/// containers `diskutil list` shows on it (their volumes are mounted under
/// the container's name, not the physical disk's).
#[cfg(any(target_os = "macos", test))]
pub(crate) fn disks_of(whole_disk: &str, diskutil_list: &str) -> Vec<String> {
    let mut disks = vec![whole_disk.to_string()];
    for line in diskutil_list.lines() {
        let mut words = line.split_whitespace();
        while let Some(word) = words.next() {
            if word == "Container"
                && let Some(container) = words.next().filter(|w| is_disk_name(w))
                && !disks.iter().any(|d| d == container)
            {
                disks.push(container.to_string());
            }
        }
    }
    disks
}

#[cfg(any(target_os = "macos", test))]
fn is_disk_name(word: &str) -> bool {
    word.strip_prefix("disk")
        .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
}

/// Whether `mount` lists a volume of one of these disks.
#[cfg(any(target_os = "macos", test))]
pub(crate) fn any_mounted(disks: &[String], mount_output: &str) -> bool {
    mount_output.lines().any(|line| {
        let source = line.split_whitespace().next().unwrap_or_default();
        disks.iter().any(|disk| {
            source
                .strip_prefix("/dev/")
                .and_then(|device| device.strip_prefix(disk.as_str()))
                .is_some_and(|rest| rest.is_empty() || rest.starts_with('s'))
        })
    })
}

#[cfg(target_os = "macos")]
pub(crate) fn enforce(
    policy: &UsbPolicy,
    blocking: bool,
    seen: &[SeenDevice],
    _key_of: impl Fn(&UsbDevice) -> String,
    _state: &mut EnforcementState,
) -> (UsbEnforcement, Vec<UsbDevice>) {
    use agent_common::process::silent_command;
    if !blocking {
        return (UsbEnforcement::monitoring_only(), Vec::new());
    }
    let run = |program: &str, args: &[&str]| {
        silent_command(program)
            .args(args)
            .output()
            .map(|o| {
                (
                    o.status.success(),
                    String::from_utf8_lossy(&o.stdout).to_string(),
                )
            })
            .unwrap_or_default()
    };
    let mut ejected = Vec::new();
    let mut failed = false;
    let mut mounts = None;
    for SeenDevice { device, handle } in seen {
        if !is_forbidden(policy, device) {
            continue;
        }
        for whole in handle.as_deref().unwrap_or_default().split_whitespace() {
            if !is_disk_name(whole) {
                continue;
            }
            let node = format!("/dev/{whole}");
            let disks = disks_of(whole, &run("diskutil", &["list", &node]).1);
            let mounts = mounts.get_or_insert_with(|| run("mount", &[]).1);
            if !any_mounted(&disks, mounts) {
                continue;
            }
            if run("diskutil", &["unmountDisk", "force", &node]).0 {
                tracing::warn!(
                    "USB policy: volumes of {} ({:04X}:{:04X}, {}) ejected",
                    device.description,
                    device.vendor_id,
                    device.product_id,
                    whole
                );
                if !ejected.contains(device) {
                    ejected.push(device.clone());
                }
            } else {
                failed = true;
                tracing::warn!("USB policy: {node} could not be ejected");
            }
        }
    }
    let mut detail = String::from(
        "\u{c9}jection seule\u{a0}: macOS ne permet pas \u{e0} l'agent de bloquer le stockage de masse USB dans le noyau. Les volumes d'un p\u{e9}riph\u{e9}rique non autoris\u{e9} sont \u{e9}ject\u{e9}s de force \u{e0} chaque analyse\u{a0}; ils restent lisibles entre le branchement et l'analyse suivante.",
    );
    if failed {
        detail.push_str(" La derni\u{e8}re \u{e9}jection a \u{e9}chou\u{e9}.");
    }
    (
        UsbEnforcement::new(UsbEnforcementMode::EjectOnly, detail),
        ejected,
    )
}

// ── Windows ─────────────────────────────────────────────────────────────

/// The drivers through which Windows mounts USB storage (bulk-only and
/// UASP). Disabled, a device plugged in gets no driver.
#[cfg(any(target_os = "windows", test))]
pub(crate) const STORAGE_SERVICES: &[&str] = &["USBSTOR", "UASPStor"];

/// `Start` value of a disabled driver.
#[cfg(any(target_os = "windows", test))]
pub(crate) const START_DISABLED: u32 = 4;

/// Where the agent keeps the start type each driver had before it
/// disabled it, so lifting the policy puts back what was there and nothing
/// else.
#[cfg(any(target_os = "windows", test))]
pub(crate) const SAVED_KEY: &str = r"HKLM\SOFTWARE\SentinelGRC\UsbStoragePolicy";

#[cfg(any(target_os = "windows", test))]
pub(crate) fn service_key(service: &str) -> String {
    format!(r"HKLM\SYSTEM\CurrentControlSet\Services\{service}")
}

/// The DWORD printed by `reg query <key> /v <value>`.
#[cfg(any(target_os = "windows", test))]
pub(crate) fn parse_reg_dword(output: &str, value: &str) -> Option<u32> {
    output.lines().find_map(|line| {
        let mut words = line.split_whitespace();
        (words.next()?.eq_ignore_ascii_case(value) && words.next()? == "REG_DWORD")
            .then(|| words.next())
            .flatten()
            .and_then(|hex| u32::from_str_radix(hex.trim_start_matches("0x"), 16).ok())
    })
}

/// What to write so that the driver ends up disabled (`block`) or as it
/// was: `(start type to set, start type to remember)`. `None` to leave the
/// driver alone; a remembered value of `None` with a start type clears the
/// memory.
#[cfg(any(target_os = "windows", test))]
pub(crate) fn driver_change(
    block: bool,
    current: Option<u32>,
    saved: Option<u32>,
) -> Option<(u32, Option<u32>)> {
    match (block, current, saved) {
        // Not installed: nothing to disable, nothing to restore.
        (_, None, _) => None,
        (true, Some(START_DISABLED), _) => None,
        (true, Some(current), _) => Some((START_DISABLED, Some(current))),
        // Only what the agent disabled is enabled again.
        (false, Some(START_DISABLED), Some(saved)) => Some((saved, None)),
        (false, _, _) => None,
    }
}

#[cfg(target_os = "windows")]
fn sync_storage_drivers(block: bool) -> Result<(), String> {
    use agent_common::process::silent_command;
    let reg = |args: &[&str]| -> Result<String, String> {
        let output = silent_command("reg")
            .args(args)
            .output()
            .map_err(|e| format!("reg.exe: {e}"))?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    };
    let dword = |key: &str, value: &str| {
        reg(&["query", key, "/v", value])
            .ok()
            .and_then(|out| parse_reg_dword(&out, value))
    };
    for service in STORAGE_SERVICES {
        let key = service_key(service);
        let Some((start, remember)) =
            driver_change(block, dword(&key, "Start"), dword(SAVED_KEY, service))
        else {
            continue;
        };
        if let Some(previous) = remember {
            reg(&[
                "add",
                SAVED_KEY,
                "/v",
                service,
                "/t",
                "REG_DWORD",
                "/d",
                &previous.to_string(),
                "/f",
            ])?;
        }
        reg(&[
            "add",
            &key,
            "/v",
            "Start",
            "/t",
            "REG_DWORD",
            "/d",
            &start.to_string(),
            "/f",
        ])?;
        if remember.is_none() {
            let _ = reg(&["delete", SAVED_KEY, "/v", service, "/f"]);
        }
        tracing::info!("USB policy: driver {service} start type set to {start}");
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub(crate) fn enforce(
    policy: &UsbPolicy,
    blocking: bool,
    seen: &[SeenDevice],
    key_of: impl Fn(&UsbDevice) -> String,
    state: &mut EnforcementState,
) -> (UsbEnforcement, Vec<UsbDevice>) {
    let present: HashSet<String> = seen.iter().map(|s| key_of(&s.device)).collect();
    state.blocked.retain(|key| present.contains(key));
    // The driver is all or nothing: it cannot spare an allowlisted device.
    let by_driver = blocking && policy.allowlist.is_empty();
    let synced = sync_storage_drivers(by_driver);
    if let Err(e) = &synced {
        // Every scan while it lasts: the mode reported carries the cause.
        tracing::debug!("USB policy: storage drivers not updated: {e}");
    }
    if !blocking {
        state.blocked.clear();
        return (UsbEnforcement::monitoring_only(), Vec::new());
    }
    if !by_driver {
        return (
            UsbEnforcement::new(
                UsbEnforcementMode::DetectionOnly,
                "D\u{e9}tection seule\u{a0}: une liste blanche USB est d\u{e9}finie, et le blocage Windows porte sur le pilote de stockage entier (USBSTOR), qui ne sait pas \u{e9}pargner un p\u{e9}riph\u{e9}rique. Les p\u{e9}riph\u{e9}riques non autoris\u{e9}s sont signal\u{e9}s.",
            ),
            Vec::new(),
        );
    }
    if let Err(e) = synced {
        return (
            UsbEnforcement::new(
                UsbEnforcementMode::DetectionOnly,
                format!(
                    "D\u{e9}tection seule\u{a0}: les pilotes de stockage USB n'ont pas pu \u{ea}tre d\u{e9}sactiv\u{e9}s ({e}). L'agent doit s'ex\u{e9}cuter avec les droits d'administration."
                ),
            ),
            Vec::new(),
        );
    }
    let newly_blocked = seen
        .iter()
        .filter(|s| is_forbidden(policy, &s.device) && state.blocked.insert(key_of(&s.device)))
        .map(|s| s.device.clone())
        .collect();
    (
        UsbEnforcement::new(
            UsbEnforcementMode::Blocking,
            "Stockage de masse USB bloqu\u{e9}\u{a0}: pilotes USBSTOR et UASPStor d\u{e9}sactiv\u{e9}s (un p\u{e9}riph\u{e9}rique branch\u{e9} n'est pas mont\u{e9}). Un p\u{e9}riph\u{e9}rique d\u{e9}j\u{e0} mont\u{e9} avant l'application le reste jusqu'\u{e0} son retrait.",
        ),
        newly_blocked,
    )
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
pub(crate) fn enforce(
    _policy: &UsbPolicy,
    blocking: bool,
    _seen: &[SeenDevice],
    _key_of: impl Fn(&UsbDevice) -> String,
    _state: &mut EnforcementState,
) -> (UsbEnforcement, Vec<UsbDevice>) {
    if blocking {
        (
            UsbEnforcement::new(
                UsbEnforcementMode::DetectionOnly,
                "D\u{e9}tection seule\u{a0}: le blocage USB n'est pas pris en charge sur ce syst\u{e8}me.",
            ),
            Vec::new(),
        )
    } else {
        (UsbEnforcement::monitoring_only(), Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn device(class: UsbDeviceClass) -> UsbDevice {
        UsbDevice {
            vendor_id: 0x0781,
            product_id: 0x5567,
            serial: None,
            description: "Cruzer Blade".into(),
            class,
        }
    }

    #[test]
    fn only_storage_off_the_allowlist_is_forbidden() {
        let mut policy = UsbPolicy::default();
        assert!(is_forbidden(&policy, &device(UsbDeviceClass::MassStorage)));
        assert!(!is_forbidden(&policy, &device(UsbDeviceClass::Hid)));
        policy.allowlist.push((0x0781, 0x5567));
        assert!(!is_forbidden(&policy, &device(UsbDeviceClass::MassStorage)));
        policy.allowlist.clear();
        policy.block_mass_storage = false;
        assert!(!is_forbidden(&policy, &device(UsbDeviceClass::MassStorage)));
    }

    #[test]
    fn the_udev_rule_deauthorizes_storage_and_spares_the_allowlist() {
        let rules = udev_rules(&[(0x0781, 0x5567), (0x0781, 0x5567), (0x05AC, 0x12A8)]);
        let lines: Vec<_> = rules.lines().filter(|l| !l.starts_with('#')).collect();
        assert_eq!(
            lines,
            [
                r#"ACTION!="add", GOTO="sentinel_usb_storage_end""#,
                r#"SUBSYSTEM!="usb", GOTO="sentinel_usb_storage_end""#,
                r#"ENV{DEVTYPE}!="usb_interface", GOTO="sentinel_usb_storage_end""#,
                r#"ATTR{bInterfaceClass}!="08", GOTO="sentinel_usb_storage_end""#,
                r#"ATTRS{idVendor}=="05ac", ATTRS{idProduct}=="12a8", GOTO="sentinel_usb_storage_end""#,
                r#"ATTRS{idVendor}=="0781", ATTRS{idProduct}=="5567", GOTO="sentinel_usb_storage_end""#,
                r#"ATTR{authorized}="0""#,
                r#"LABEL="sentinel_usb_storage_end""#,
            ]
        );
    }

    /// A sysfs device directory with one storage and one HID interface.
    fn sysfs_device(root: &std::path::Path) -> std::path::PathBuf {
        let dir = root.join("1-2");
        for (interface, class) in [("1-2:1.0", "08\n"), ("1-2:1.1", "03\n")] {
            let path = dir.join(interface);
            std::fs::create_dir_all(&path).unwrap();
            std::fs::write(path.join("bInterfaceClass"), class).unwrap();
            std::fs::write(path.join("authorized"), "1\n").unwrap();
        }
        dir
    }

    #[test]
    fn storage_interfaces_are_deauthorized_and_the_others_left() {
        let root = tempfile::tempdir().unwrap();
        let dir = sysfs_device(root.path());
        assert_eq!(storage_interfaces(&dir), [dir.join("1-2:1.0")]);

        assert!(set_storage_authorized(&dir, false).unwrap());
        let read = |i: &str| std::fs::read_to_string(dir.join(i).join("authorized")).unwrap();
        assert_eq!(read("1-2:1.0"), "0");
        assert_eq!(read("1-2:1.1"), "1\n", "the keyboard keeps working");

        assert!(set_storage_authorized(&dir, true).unwrap());
        assert_eq!(read("1-2:1.0"), "1");

        // A device without storage interface: nothing to block.
        std::fs::write(dir.join("1-2:1.0").join("bInterfaceClass"), "ff\n").unwrap();
        assert!(!set_storage_authorized(&dir, false).unwrap());
    }

    #[test]
    fn mounted_volumes_are_found_on_the_disk_and_its_apfs_containers() {
        let listing = "/dev/disk4 (external, physical):\n   \
             #:                       TYPE NAME                    SIZE       IDENTIFIER\n   \
             0:      GUID_partition_scheme                        *62.0 GB    disk4\n   \
             1:                        EFI EFI                     209.7 MB   disk4s1\n   \
             2:                 Apple_APFS Container disk5         61.8 GB    disk4s2\n";
        let disks = disks_of("disk4", listing);
        assert_eq!(disks, ["disk4", "disk5"]);

        let mounts = "/dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)\n\
                      /dev/disk5s1 on /Volumes/KEY (apfs, local, nodev, nosuid, journaled)\n";
        assert!(any_mounted(&disks, mounts));
        assert!(!any_mounted(&["disk4".to_string()], mounts));
        // disk5 is not disk50, and the internal disk is not looked at.
        assert!(!any_mounted(
            &["disk5".to_string()],
            "/dev/disk50s1 on /Volumes/OTHER (apfs)\n"
        ));
        assert!(any_mounted(
            &["disk4".to_string()],
            "/dev/disk4s1 on /Volumes/FAT (msdos, local)\n"
        ));
    }

    #[test]
    fn the_storage_driver_is_disabled_then_put_back_as_it_was() {
        let query = "\r\nHKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR\r\n    \
                     Start    REG_DWORD    0x3\r\n\r\n";
        assert_eq!(parse_reg_dword(query, "Start"), Some(3));
        assert_eq!(parse_reg_dword(query, "Type"), None);
        assert!(SAVED_KEY.starts_with(r"HKLM\SOFTWARE\"));
        assert_eq!(
            service_key("USBSTOR"),
            r"HKLM\SYSTEM\CurrentControlSet\Services\USBSTOR"
        );

        // Blocking: disable, remembering the start type found.
        assert_eq!(driver_change(true, Some(3), None), Some((4, Some(3))));
        assert_eq!(driver_change(true, Some(4), Some(3)), None);
        // Lifting: put back what the agent changed, and only that.
        assert_eq!(driver_change(false, Some(4), Some(3)), Some((3, None)));
        assert_eq!(
            driver_change(false, Some(4), None),
            None,
            "disabled by someone else (a GPO): not the agent's to enable"
        );
        assert_eq!(driver_change(false, Some(3), None), None);
        assert_eq!(
            driver_change(true, None, None),
            None,
            "driver not installed"
        );
    }
}
