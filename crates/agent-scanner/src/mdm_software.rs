// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Enhanced Software Inventory Scanner for MDM
//!
//! This module provides comprehensive software inventory capabilities
//! specifically designed for Mobile Device Management (MDM) functionality.
//! It extends the basic package scanning with deployment tracking,
//! policy compliance, and management features.

use crate::error::ScannerResult;
use crate::vulnerability::package_scanner::{InstalledPackage, PackageScanner};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Enhanced software inventory entry for MDM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MDMSoftwareInventory {
    /// Software name (normalized)
    pub name: String,

    /// Installed version
    pub version: String,

    /// Publisher/vendor
    pub vendor: Option<String>,

    /// Installation path
    pub install_path: Option<String>,

    /// Installation date (if available)
    pub install_date: Option<DateTime<Utc>>,

    /// Last used date (if available)
    pub last_used: Option<DateTime<Utc>>,

    /// Size in bytes
    pub size_bytes: Option<u64>,

    /// Is system software
    pub is_system: bool,

    /// Architecture (x64, arm64, etc.)
    pub architecture: Option<String>,

    /// Software category
    pub category: SoftwareCategory,

    /// Is managed by MDM
    pub is_managed: bool,

    /// Management source
    pub management_source: ManagementSource,

    /// Deployment status
    pub deployment_status: DeploymentStatus,

    /// Policy compliance status
    pub policy_compliance: Vec<PolicyCompliance>,

    /// Available updates
    pub available_updates: Vec<SoftwareUpdate>,

    /// Dependencies
    pub dependencies: Vec<SoftwareDependency>,

    /// Installation metadata
    pub metadata: SoftwareMetadata,

    /// Last inventory timestamp
    pub last_inventory: DateTime<Utc>,
}

/// Software categories for MDM classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SoftwareCategory {
    /// Productivity software (Office, etc.)
    Productivity,
    /// Development tools
    Development,
    /// Security software
    Security,
    /// Communication tools
    Communication,
    /// Web browsers
    Browser,
    /// System utilities
    Utility,
    /// Media software
    Media,
    /// System software/drivers
    System,
    /// Games
    Game,
    /// Other/uncategorized
    Other,
}

/// Management source tracking
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ManagementSource {
    /// Manually installed
    Manual,
    /// Installed via MDM policy
    Policy,
    /// Automatically detected
    Automated,
    /// Pre-installed by OEM
    OEM,
}

/// Deployment status for MDM
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DeploymentStatus {
    /// Not deployed
    NotDeployed,
    /// Deployment pending
    Pending,
    /// Currently deploying
    Deploying,
    /// Successfully deployed
    Deployed,
    /// Deployment failed
    Failed,
    /// Uninstalling
    Uninstalling,
    /// Uninstalled
    Uninstalled,
    /// Rollback required
    RollbackRequired,
    /// Rollback completed
    RollbackCompleted,
}

/// Policy compliance information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyCompliance {
    /// Policy ID
    pub policy_id: String,

    /// Policy name
    pub policy_name: String,

    /// Compliance status
    pub status: ComplianceStatus,

    /// Last check timestamp
    pub last_checked: DateTime<Utc>,

    /// Compliance score (0-100)
    pub score: Option<u8>,

    /// Violations found
    pub violations: Vec<PolicyViolation>,

    /// Remediation required
    pub remediation_required: bool,
}

/// Compliance status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ComplianceStatus {
    /// Fully compliant
    Compliant,
    /// Non-compliant
    NonCompliant,
    /// Partially compliant
    Partial,
    /// Unknown status
    Unknown,
}

/// Policy violation details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyViolation {
    /// Violation ID
    pub id: String,

    /// Rule that was violated
    pub rule_id: String,

    /// Violation description
    pub description: String,

    /// Severity level
    pub severity: ViolationSeverity,

    /// Detected timestamp
    pub detected_at: DateTime<Utc>,

    /// Current value
    pub current_value: String,

    /// Expected value
    pub expected_value: String,

    /// Evidence
    pub evidence: HashMap<String, serde_json::Value>,
}

/// Violation severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ViolationSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Software update information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftwareUpdate {
    /// New version
    pub version: String,

    /// Update type
    pub update_type: UpdateType,

    /// Is security update
    pub is_security: bool,

    /// Associated CVE IDs
    pub cve_ids: Vec<String>,

    /// Release date
    pub release_date: Option<DateTime<Utc>>,

    /// Download size (bytes)
    pub download_size: Option<u64>,

    /// Release notes
    pub release_notes: Option<String>,
}

/// Update types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UpdateType {
    /// Major version update
    Major,
    /// Minor version update
    Minor,
    /// Patch/bug fix
    Patch,
    /// Security update
    Security,
    /// Feature update
    Feature,
}

/// Software dependency information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftwareDependency {
    /// Dependency name
    pub name: String,

    /// Version requirement
    pub version_requirement: String,

    /// Is optional
    pub is_optional: bool,

    /// Is currently satisfied
    pub is_satisfied: bool,
}

/// Software metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftwareMetadata {
    /// Digital signature information
    pub signature: Option<DigitalSignature>,

    /// Hash values for integrity
    pub hashes: HashMap<String, String>,

    /// Installation method
    pub installation_method: InstallationMethod,

    /// License information
    pub license: Option<String>,

    /// Support end date
    pub support_end_date: Option<DateTime<Utc>>,

    /// Additional properties
    pub properties: HashMap<String, serde_json::Value>,
}

/// Digital signature information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigitalSignature {
    /// Signer name
    pub signer: String,

    /// Signature algorithm
    pub algorithm: String,

    /// Signature timestamp
    pub timestamp: DateTime<Utc>,

    /// Is signature valid
    pub is_valid: bool,

    /// Certificate thumbprint
    pub thumbprint: Option<String>,
}

/// Installation methods
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InstallationMethod {
    /// MSI installer (Windows)
    MSI,
    /// EXE installer
    EXE,
    /// Package manager (apt, yum, brew, etc.)
    PackageManager,
    /// App Store (Mac App Store, Microsoft Store)
    AppStore,
    /// Manual installation
    Manual,
    /// Script installation
    Script,
    /// Other method
    Other(String),
}

/// MDM software inventory scanner
pub struct MDMSoftwareScanner {
    /// Platform-specific package scanners
    package_scanners: Vec<Arc<dyn PackageScanner + Send + Sync>>,

    /// Cached inventory
    inventory: Arc<RwLock<HashMap<String, MDMSoftwareInventory>>>,

    /// Last scan timestamp
    last_scan: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl MDMSoftwareScanner {
    /// Create a new MDM software scanner
    pub fn new() -> Self {
        let mut scanners: Vec<Arc<dyn PackageScanner + Send + Sync>> = Vec::new();

        // Add platform-specific scanners
        #[cfg(target_os = "windows")]
        {
            scanners.push(Arc::new(
                crate::vulnerability::windows_scanner::WindowsScanner::new(),
            ));
        }

        #[cfg(target_os = "macos")]
        {
            scanners.push(Arc::new(
                crate::vulnerability::brew_scanner::BrewScanner::new(),
            ));
            scanners.push(Arc::new(
                crate::vulnerability::macos_app_scanner::MacOsAppScanner::new(),
            ));
        }

        #[cfg(target_os = "linux")]
        {
            scanners.push(Arc::new(
                crate::vulnerability::apt_scanner::AptScanner::new(),
            ));
        }

        Self {
            package_scanners: scanners,
            inventory: Arc::new(RwLock::new(HashMap::new())),
            last_scan: Arc::new(RwLock::new(None)),
        }
    }

    /// Perform comprehensive software inventory
    pub async fn scan_inventory(&self) -> ScannerResult<Vec<MDMSoftwareInventory>> {
        info!("Starting MDM software inventory scan...");

        let mut inventory = Vec::new();
        let mut total_packages = 0u32;

        // Scan with all available package scanners
        for scanner in &self.package_scanners {
            debug!("Scanning with {} scanner", scanner.name());

            match scanner.installed_packages().await {
                Ok(packages) => {
                    total_packages += packages.len() as u32;

                    for package in packages {
                        let mdm_software = self.convert_to_mdm_inventory(package).await;
                        inventory.push(mdm_software);
                    }
                }
                Err(e) => {
                    warn!("Failed to scan with {}: {}", scanner.name(), e);
                }
            }
        }

        // Enhance inventory with additional information
        inventory = self.enhance_inventory(inventory).await;

        // Update cache
        {
            let mut cache = self.inventory.write().await;
            cache.clear();
            for software in &inventory {
                cache.insert(software.name.clone(), software.clone());
            }
        }

        // Update last scan timestamp
        {
            let mut last_scan = self.last_scan.write().await;
            *last_scan = Some(Utc::now());
        }

        info!(
            "MDM inventory scan completed: {} packages found",
            total_packages
        );
        Ok(inventory)
    }

    /// Get cached inventory
    pub async fn get_cached_inventory(&self) -> Vec<MDMSoftwareInventory> {
        let cache = self.inventory.read().await;
        cache.values().cloned().collect()
    }

    /// Get last scan timestamp
    pub async fn get_last_scan(&self) -> Option<DateTime<Utc>> {
        *self.last_scan.read().await
    }

    /// Check if software is managed
    pub async fn is_software_managed(&self, software_name: &str) -> bool {
        let cache = self.inventory.read().await;
        cache
            .get(software_name)
            .map(|s| s.is_managed)
            .unwrap_or(false)
    }

    /// Get software by name
    pub async fn get_software(&self, software_name: &str) -> Option<MDMSoftwareInventory> {
        let cache = self.inventory.read().await;
        cache.get(software_name).cloned()
    }

    /// Convert package scanner result to MDM inventory
    async fn convert_to_mdm_inventory(&self, package: InstalledPackage) -> MDMSoftwareInventory {
        let category = self.detect_category(&package.name);
        let is_system = self.is_system_software(&package.name, &package.version);
        let source = package.description.clone().unwrap_or_default();
        let management_source = self.detect_management_source(&package.name, &source);
        let installation_method = Self::detect_installation_method(&source);
        let install_path = Self::detect_install_path(&package.name, &source);

        let mut properties = HashMap::new();
        if !source.is_empty() {
            properties.insert(
                "source".to_string(),
                serde_json::Value::String(source),
            );
        }

        MDMSoftwareInventory {
            name: package.name.clone(),
            version: package.version.clone(),
            vendor: package.publisher,
            install_path,
            install_date: None,
            last_used: None,
            size_bytes: None,
            is_system,
            architecture: package.arch,
            category,
            is_managed: matches!(management_source, ManagementSource::Policy),
            management_source,
            deployment_status: DeploymentStatus::Deployed,
            policy_compliance: Vec::new(),
            available_updates: Vec::new(),
            dependencies: Vec::new(),
            metadata: SoftwareMetadata {
                signature: None,
                hashes: HashMap::new(),
                installation_method,
                license: None,
                support_end_date: None,
                properties,
            },
            last_inventory: Utc::now(),
        }
    }

    /// Detect the installation method from the package source.
    fn detect_installation_method(source: &str) -> InstallationMethod {
        match source {
            "brew" | "brew-cask" | "apt" | "dpkg" | "winget" => {
                InstallationMethod::PackageManager
            }
            "macos-app-bundle" => InstallationMethod::Other("app-bundle".to_string()),
            "windows-registry" => InstallationMethod::EXE,
            "msstore" => InstallationMethod::AppStore,
            _ if source.is_empty() => InstallationMethod::Manual,
            _ => InstallationMethod::Other(source.to_string()),
        }
    }

    /// Detect install path from package name and source.
    fn detect_install_path(name: &str, source: &str) -> Option<String> {
        match source {
            // ── macOS ──
            "macos-app-bundle" | "brew-cask" => {
                let path = format!("/Applications/{}.app", name);
                if std::path::Path::new(&path).exists() {
                    return Some(path);
                }
                None
            }
            "brew" => {
                for prefix in &["/opt/homebrew/Cellar", "/usr/local/Cellar"] {
                    let dir = format!("{}/{}", prefix, name);
                    if std::path::Path::new(&dir).exists() {
                        return Some(dir);
                    }
                }
                None
            }

            // ── Linux ──
            "apt" | "dpkg" => {
                // Check common binary locations
                for dir in &["/usr/bin", "/usr/sbin", "/usr/local/bin"] {
                    let path = format!("{}/{}", dir, name);
                    if std::path::Path::new(&path).exists() {
                        return Some(path);
                    }
                }
                None
            }

            // ── Windows ──
            "windows-registry" | "winget" => {
                #[cfg(target_os = "windows")]
                {
                    // Try standard Program Files locations
                    if let Ok(pf) = std::env::var("ProgramFiles") {
                        let path = format!("{}\\{}", pf, name);
                        if std::path::Path::new(&path).exists() {
                            return Some(path);
                        }
                    }
                    if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
                        let path = format!("{}\\{}", pf86, name);
                        if std::path::Path::new(&path).exists() {
                            return Some(path);
                        }
                    }
                    if let Ok(local) = std::env::var("LOCALAPPDATA") {
                        let path = format!("{}\\{}", local, name);
                        if std::path::Path::new(&path).exists() {
                            return Some(path);
                        }
                    }
                }
                None
            }

            _ => None,
        }
    }

    /// Enhance inventory with additional information.
    ///
    /// Performs batch operations per platform (brew outdated/deps, apt upgradable,
    /// winget upgrade) once, then applies per-item enrichment.
    async fn enhance_inventory(
        &self,
        mut inventory: Vec<MDMSoftwareInventory>,
    ) -> Vec<MDMSoftwareInventory> {
        inventory.sort_by(|a, b| a.name.cmp(&b.name));

        // ── macOS: brew outdated + deps ──
        #[cfg(target_os = "macos")]
        let (brew_updates, brew_deps) = {
            let updates = Self::fetch_brew_outdated().await;
            let deps = Self::fetch_brew_deps().await;
            (updates, deps)
        };

        // ── Linux: apt upgradable + dpkg deps ──
        #[cfg(target_os = "linux")]
        let (apt_updates, dpkg_deps) = {
            let updates = Self::fetch_apt_upgradable().await;
            let deps = Self::fetch_dpkg_deps().await;
            (updates, deps)
        };

        // ── Windows: winget upgradable ──
        #[cfg(target_os = "windows")]
        let winget_updates = Self::fetch_winget_upgradable().await;

        for software in &mut inventory {
            let source = software
                .metadata
                .properties
                .get("source")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            // ── macOS enrichment ──
            #[cfg(target_os = "macos")]
            if matches!(source.as_str(), "brew" | "brew-cask") {
                if let Some(update) = brew_updates.get(&software.name) {
                    software.available_updates = vec![update.clone()];
                }
                if let Some(deps) = brew_deps.get(&software.name) {
                    software.dependencies = deps.clone();
                }
            }

            // ── Linux enrichment ──
            #[cfg(target_os = "linux")]
            if matches!(source.as_str(), "apt" | "dpkg") {
                if let Some(update) = apt_updates.get(&software.name) {
                    software.available_updates = vec![update.clone()];
                }
                if let Some(deps) = dpkg_deps.get(&software.name) {
                    software.dependencies = deps.clone();
                }
            }

            // ── Windows enrichment ──
            #[cfg(target_os = "windows")]
            if matches!(source.as_str(), "windows-registry" | "winget") {
                if let Some(update) = winget_updates.get(&software.name) {
                    software.available_updates = vec![update.clone()];
                }
            }

            // Calculate hashes per-item (I/O-bound, offloaded to blocking thread)
            software.metadata.hashes = self.calculate_hashes(software).await;
        }

        inventory
    }

    /// Detect software category
    fn detect_category(&self, name: &str) -> SoftwareCategory {
        let name_lower = name.to_lowercase();

        // Development tools
        if name_lower.contains("visual studio")
            || name_lower.contains("vs code")
            || name_lower.contains("intellij")
            || name_lower.contains("pycharm")
            || name_lower.contains("eclipse")
            || name_lower.contains("xcode")
            || name_lower.contains("android studio")
            || name_lower.contains("git")
            || name_lower.contains("node")
            || name_lower.contains("npm")
            || name_lower.contains("docker")
            || name_lower.contains("kubernetes")
        {
            return SoftwareCategory::Development;
        }

        // Security tools
        if name_lower.contains("antivirus")
            || name_lower.contains("firewall")
            || name_lower.contains("vpn")
            || name_lower.contains("kaspersky")
            || name_lower.contains("norton")
            || name_lower.contains("mcafee")
            || name_lower.contains("avast")
            || name_lower.contains("bitdefender")
            || name_lower.contains("malwarebytes")
            || name_lower.contains("crowdstrike")
            || name_lower.contains("defender")
        {
            return SoftwareCategory::Security;
        }

        // Communication
        if name_lower.contains("slack")
            || name_lower.contains("teams")
            || name_lower.contains("zoom")
            || name_lower.contains("discord")
            || name_lower.contains("skype")
            || name_lower.contains("webex")
            || name_lower.contains("meet")
            || name_lower.contains("telegram")
            || name_lower.contains("whatsapp")
            || name_lower.contains("signal")
        {
            return SoftwareCategory::Communication;
        }

        // Browsers
        if name_lower.contains("chrome")
            || name_lower.contains("firefox")
            || name_lower.contains("safari")
            || name_lower.contains("edge")
            || name_lower.contains("opera")
            || name_lower.contains("brave")
            || name_lower.contains("vivaldi")
        {
            return SoftwareCategory::Browser;
        }

        // Productivity
        if name_lower.contains("office")
            || name_lower.contains("word")
            || name_lower.contains("excel")
            || name_lower.contains("powerpoint")
            || name_lower.contains("outlook")
            || name_lower.contains("notion")
            || name_lower.contains("evernote")
            || name_lower.contains("todoist")
            || name_lower.contains("asana")
            || name_lower.contains("trello")
            || name_lower.contains("jira")
            || name_lower.contains("confluence")
        {
            return SoftwareCategory::Productivity;
        }

        // Media
        if name_lower.contains("vlc")
            || name_lower.contains("spotify")
            || name_lower.contains("itunes")
            || name_lower.contains("photoshop")
            || name_lower.contains("premiere")
            || name_lower.contains("final cut")
            || name_lower.contains("audacity")
            || name_lower.contains("obs")
            || name_lower.contains("handbrake")
        {
            return SoftwareCategory::Media;
        }

        // System
        if name_lower.contains("driver")
            || name_lower.contains("runtime")
            || name_lower.contains("framework")
            || name_lower.contains(".net")
            || name_lower.contains("java")
            || name_lower.contains("python")
            || name_lower.contains("ruby")
            || name_lower.contains("reducible")
            || name_lower.contains("update")
            || name_lower.contains("service pack")
        {
            return SoftwareCategory::System;
        }

        // Utility
        if name_lower.contains("7-zip")
            || name_lower.contains("winrar")
            || name_lower.contains("ccleaner")
            || name_lower.contains("notepad")
            || name_lower.contains("sublime")
            || name_lower.contains("atom")
            || name_lower.contains("terminal")
            || name_lower.contains("iterm")
            || name_lower.contains("putty")
            || name_lower.contains("filezilla")
            || name_lower.contains("winscp")
        {
            return SoftwareCategory::Utility;
        }

        // Games
        if name_lower.contains("steam")
            || name_lower.contains("epic games")
            || name_lower.contains("origin")
            || name_lower.contains("uplay")
        {
            return SoftwareCategory::Game;
        }

        SoftwareCategory::Other
    }

    /// Check if software is system software
    fn is_system_software(&self, name: &str, _version: &str) -> bool {
        let name_lower = name.to_lowercase();

        // Common system software patterns
        name_lower.contains("microsoft")
            && (name_lower.contains("windows")
                || name_lower.contains("system")
                || name_lower.contains("framework")
                || name_lower.contains("runtime"))
            || name_lower.contains("apple") && name_lower.contains("system")
            || name_lower.contains("driver")
            || name_lower.contains("kernel")
            || name_lower.contains("system")
            || name_lower.starts_with("lib")
            || name_lower.starts_with("gnu")
    }

    /// Detect management source from the package name and scanner source.
    fn detect_management_source(&self, name: &str, source: &str) -> ManagementSource {
        match source {
            // Package managers = automated deployment
            "brew" | "brew-cask" | "apt" | "dpkg" | "winget" => ManagementSource::Automated,

            // macOS app bundles: check for App Store receipt
            "macos-app-bundle" => {
                let receipt = format!("/Applications/{}.app/Contents/_MASReceipt/receipt", name);
                if std::path::Path::new(&receipt).exists() {
                    ManagementSource::Policy
                } else {
                    ManagementSource::Manual
                }
            }

            // Microsoft Store = managed distribution
            "msstore" => ManagementSource::Policy,

            // Windows registry = manually installed (EXE/MSI)
            "windows-registry" => ManagementSource::Manual,

            _ => ManagementSource::Manual,
        }
    }

    /// Calculate file hashes (SHA-256 + BLAKE3) for the software binary.
    async fn calculate_hashes(&self, software: &MDMSoftwareInventory) -> HashMap<String, String> {
        let binary = match Self::resolve_binary_path(software) {
            Some(p) => p,
            None => return HashMap::new(),
        };

        match tokio::task::spawn_blocking(move || Self::compute_file_hashes(&binary)).await {
            Ok(Ok(hashes)) => hashes,
            _ => HashMap::new(),
        }
    }

    /// Resolve the main binary path for a software entry.
    fn resolve_binary_path(software: &MDMSoftwareInventory) -> Option<String> {
        let install_path = software.install_path.as_deref()?;
        let path = std::path::Path::new(install_path);

        // Direct file (Linux /usr/bin/name, etc.)
        if path.is_file() {
            return Some(install_path.to_string());
        }

        // macOS .app bundle → Contents/MacOS/<binary>
        if install_path.ends_with(".app") {
            return Self::resolve_macos_app_binary(install_path, &software.name);
        }

        // Windows directory → look for .exe
        #[cfg(target_os = "windows")]
        {
            if let Some(exe) = Self::resolve_windows_exe(install_path, &software.name) {
                return Some(exe);
            }
        }

        // Generic directory → try to find a binary with the package name
        #[cfg(not(target_os = "windows"))]
        {
            let bin_name = software.name.to_lowercase().replace(' ', "-");
            let candidate = path.join(&bin_name);
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().to_string());
            }
        }

        None
    }

    /// Resolve the main binary inside a macOS .app bundle.
    fn resolve_macos_app_binary(app_path: &str, name: &str) -> Option<String> {
        let macos_dir = format!("{}/Contents/MacOS", app_path);
        // Try exact name (spaces removed)
        let binary_name = name.replace(' ', "");
        let main_binary = format!("{}/{}", macos_dir, binary_name);
        if std::path::Path::new(&main_binary).exists() {
            return Some(main_binary);
        }
        // Fallback: first file in Contents/MacOS
        if let Ok(mut entries) = std::fs::read_dir(&macos_dir)
            && let Some(Ok(entry)) = entries.next()
            && entry.path().is_file()
        {
            return Some(entry.path().to_string_lossy().to_string());
        }
        None
    }

    /// Resolve the main .exe inside a Windows install directory.
    #[cfg(target_os = "windows")]
    fn resolve_windows_exe(install_dir: &str, name: &str) -> Option<String> {
        let dir = std::path::Path::new(install_dir);
        if !dir.is_dir() {
            return None;
        }

        // Try <name>.exe directly
        let exe_name = format!("{}.exe", name.replace(' ', ""));
        let candidate = dir.join(&exe_name);
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }

        // Fallback: first .exe in the directory
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.extension().and_then(|e| e.to_str()) == Some("exe") && p.is_file() {
                    return Some(p.to_string_lossy().to_string());
                }
            }
        }

        None
    }

    /// Compute SHA-256 and BLAKE3 hashes of a file using streaming I/O.
    fn compute_file_hashes(path: &str) -> std::io::Result<HashMap<String, String>> {
        use sha2::{Digest, Sha256};
        use std::io::Read;

        let mut file = std::fs::File::open(path)?;
        let mut sha256 = Sha256::new();
        let mut b3 = blake3::Hasher::new();
        let mut buf = [0u8; 8192];

        loop {
            let n = file.read(&mut buf)?;
            if n == 0 {
                break;
            }
            sha256.update(&buf[..n]);
            b3.update(&buf[..n]);
        }

        let mut hashes = HashMap::new();
        hashes.insert("sha256".to_string(), hex::encode(sha256.finalize()));
        hashes.insert("blake3".to_string(), b3.finalize().to_hex().to_string());
        Ok(hashes)
    }

    // ── Batch helpers for platform-specific enrichment ──────────────────

    /// Find the Homebrew executable path.
    #[cfg(target_os = "macos")]
    fn find_brew_path() -> Option<String> {
        if agent_common::process::silent_command("brew")
            .arg("--version")
            .output()
            .is_ok()
        {
            return Some("brew".to_string());
        }
        for path in &["/opt/homebrew/bin/brew", "/usr/local/bin/brew"] {
            if std::path::Path::new(path).exists() {
                return Some((*path).to_string());
            }
        }
        None
    }

    /// Batch-fetch outdated Homebrew packages (formulae + casks).
    #[cfg(target_os = "macos")]
    async fn fetch_brew_outdated() -> HashMap<String, SoftwareUpdate> {
        let mut updates = HashMap::new();

        let brew = match Self::find_brew_path() {
            Some(p) => p,
            None => return updates,
        };

        let output = match agent_common::process::silent_command(&brew)
            .args(["outdated", "--json"])
            .output()
        {
            Ok(o) if o.status.success() => o,
            _ => return updates,
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        let parsed: serde_json::Value = match serde_json::from_str(&stdout) {
            Ok(v) => v,
            Err(_) => return updates,
        };

        // Formulae
        if let Some(formulae) = parsed.get("formulae").and_then(|f| f.as_array()) {
            for f in formulae {
                if let (Some(name), Some(ver)) = (
                    f.get("name").and_then(|n| n.as_str()),
                    f.get("current_version").and_then(|v| v.as_str()),
                ) {
                    updates.insert(
                        name.to_string(),
                        SoftwareUpdate {
                            version: ver.to_string(),
                            update_type: UpdateType::Minor,
                            is_security: false,
                            cve_ids: Vec::new(),
                            release_date: None,
                            download_size: None,
                            release_notes: None,
                        },
                    );
                }
            }
        }

        // Casks
        if let Some(casks) = parsed.get("casks").and_then(|c| c.as_array()) {
            for c in casks {
                if let (Some(name), Some(ver)) = (
                    c.get("name").and_then(|n| n.as_str()),
                    c.get("current_version").and_then(|v| v.as_str()),
                ) {
                    updates.insert(
                        name.to_string(),
                        SoftwareUpdate {
                            version: ver.to_string(),
                            update_type: UpdateType::Minor,
                            is_security: false,
                            cve_ids: Vec::new(),
                            release_date: None,
                            download_size: None,
                            release_notes: None,
                        },
                    );
                }
            }
        }

        updates
    }

    /// Batch-fetch Homebrew dependency graph for all installed formulae.
    #[cfg(target_os = "macos")]
    async fn fetch_brew_deps() -> HashMap<String, Vec<SoftwareDependency>> {
        let mut deps_map = HashMap::new();

        let brew = match Self::find_brew_path() {
            Some(p) => p,
            None => return deps_map,
        };

        let output = match agent_common::process::silent_command(&brew)
            .args(["deps", "--installed", "--for-each"])
            .output()
        {
            Ok(o) if o.status.success() => o,
            _ => return deps_map,
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            // Format: "package: dep1 dep2 dep3"
            if let Some((name, deps_str)) = line.split_once(':') {
                let deps: Vec<SoftwareDependency> = deps_str
                    .split_whitespace()
                    .map(|dep| SoftwareDependency {
                        name: dep.to_string(),
                        version_requirement: "*".to_string(),
                        is_optional: false,
                        is_satisfied: true,
                    })
                    .collect();
                if !deps.is_empty() {
                    deps_map.insert(name.trim().to_string(), deps);
                }
            }
        }

        deps_map
    }

    /// Batch-fetch upgradable APT packages.
    #[cfg(target_os = "linux")]
    async fn fetch_apt_upgradable() -> HashMap<String, SoftwareUpdate> {
        let mut updates = HashMap::new();

        let output = match agent_common::process::silent_command("apt")
            .args(["list", "--upgradable"])
            .output()
        {
            Ok(o) if o.status.success() => o,
            _ => return updates,
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            // Format: "package/source version arch [upgradable from: old_ver]"
            if let Some(slash_pos) = line.find('/') {
                let name = &line[..slash_pos];
                let rest = &line[slash_pos + 1..];
                let version = rest
                    .split_whitespace()
                    .nth(1)
                    .unwrap_or("unknown")
                    .to_string();

                updates.insert(
                    name.to_string(),
                    SoftwareUpdate {
                        version,
                        update_type: UpdateType::Patch,
                        is_security: line.contains("-security"),
                        cve_ids: Vec::new(),
                        release_date: None,
                        download_size: None,
                        release_notes: None,
                    },
                );
            }
        }

        updates
    }

    /// Batch-fetch dpkg dependency graph for all installed packages.
    #[cfg(target_os = "linux")]
    async fn fetch_dpkg_deps() -> HashMap<String, Vec<SoftwareDependency>> {
        let mut deps_map = HashMap::new();

        // dpkg-query with Pre-Depends + Depends fields
        let output = match agent_common::process::silent_command("dpkg-query")
            .args(["-W", "-f=${Package}\t${Depends}\n"])
            .output()
        {
            Ok(o) if o.status.success() => o,
            _ => return deps_map,
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if let Some((name, deps_str)) = line.split_once('\t') {
                if deps_str.is_empty() {
                    continue;
                }
                // Format: "dep1 (>= 1.0), dep2, dep3 | dep3-alt"
                let deps: Vec<SoftwareDependency> = deps_str
                    .split(',')
                    .filter_map(|dep_entry| {
                        // Take the first alternative before '|'
                        let dep = dep_entry.split('|').next()?.trim();
                        if dep.is_empty() {
                            return None;
                        }
                        let mut parts = dep.splitn(2, ' ');
                        let dep_name = parts.next()?.to_string();
                        let version_req = parts
                            .next()
                            .unwrap_or("*")
                            .trim_matches(|c| c == '(' || c == ')')
                            .to_string();
                        Some(SoftwareDependency {
                            name: dep_name,
                            version_requirement: version_req,
                            is_optional: false,
                            is_satisfied: true,
                        })
                    })
                    .collect();
                if !deps.is_empty() {
                    deps_map.insert(name.to_string(), deps);
                }
            }
        }

        deps_map
    }

    /// Batch-fetch upgradable winget packages (Windows).
    #[cfg(target_os = "windows")]
    async fn fetch_winget_upgradable() -> HashMap<String, SoftwareUpdate> {
        let mut updates = HashMap::new();

        let output = match agent_common::process::silent_command("winget")
            .args(["upgrade", "--accept-source-agreements", "--disable-interactivity"])
            .output()
        {
            Ok(o) if o.status.success() => o,
            _ => return updates,
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().collect();

        // Find the separator line (---...) that precedes package rows
        let separator_idx = lines.iter().position(|l| l.starts_with("---"));
        if let Some(idx) = separator_idx {
            for line in &lines[idx + 1..] {
                if line.trim().is_empty() {
                    continue;
                }
                // Format: Name  Id  Version  Available  Source
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let available = parts[parts.len() - 2].to_string();
                    let current = parts[parts.len() - 3].to_string();

                    // Reconstruct name from leading parts
                    let name_parts = &parts[..parts.len().saturating_sub(4)];
                    let name = if name_parts.is_empty() {
                        parts[parts.len() - 4].to_string()
                    } else {
                        name_parts.join(" ")
                    };

                    if !current.is_empty() && !available.is_empty() && current != available {
                        updates.insert(
                            name,
                            SoftwareUpdate {
                                version: available,
                                update_type: UpdateType::Minor,
                                is_security: false,
                                cve_ids: Vec::new(),
                                release_date: None,
                                download_size: None,
                                release_notes: None,
                            },
                        );
                    }
                }
            }
        }

        updates
    }
}

impl Default for MDMSoftwareScanner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vulnerability::package_scanner::InstalledPackage;

    #[test]
    fn test_category_detection() {
        let scanner = MDMSoftwareScanner::new();

        assert_eq!(
            scanner.detect_category("Visual Studio Code"),
            SoftwareCategory::Development
        );
        assert_eq!(
            scanner.detect_category("Google Chrome"),
            SoftwareCategory::Browser
        );
        assert_eq!(
            scanner.detect_category("Microsoft Office"),
            SoftwareCategory::Productivity
        );
        assert_eq!(
            scanner.detect_category("Unknown Software"),
            SoftwareCategory::Other
        );
    }

    #[test]
    fn test_system_software_detection() {
        let scanner = MDMSoftwareScanner::new();

        assert!(scanner.is_system_software("Microsoft Windows Driver", "1.0"));
        assert!(scanner.is_system_software("libssl", "1.1.1"));
        assert!(!scanner.is_system_software("Google Chrome", "120.0"));
    }

    #[tokio::test]
    async fn test_mdm_conversion() {
        let scanner = MDMSoftwareScanner::new();
        let package = InstalledPackage::new("Chrome", "120.0.0.0")
            .with_publisher("Google")
            .with_arch("x64")
            .with_description("brew-cask");

        let mdm_software = scanner.convert_to_mdm_inventory(package).await;

        assert_eq!(mdm_software.name, "Chrome");
        assert_eq!(mdm_software.version, "120.0.0.0");
        assert_eq!(mdm_software.vendor, Some("Google".to_string()));
        assert_eq!(mdm_software.category, SoftwareCategory::Browser);
        assert_eq!(mdm_software.deployment_status, DeploymentStatus::Deployed);
        // Source should be stored in metadata properties
        assert_eq!(
            mdm_software.metadata.properties.get("source"),
            Some(&serde_json::Value::String("brew-cask".to_string()))
        );
        assert_eq!(
            mdm_software.management_source,
            ManagementSource::Automated
        );
    }

    #[test]
    fn test_management_source_detection() {
        let scanner = MDMSoftwareScanner::new();

        // Package managers → Automated
        assert_eq!(
            scanner.detect_management_source("node", "brew"),
            ManagementSource::Automated
        );
        assert_eq!(
            scanner.detect_management_source("curl", "apt"),
            ManagementSource::Automated
        );
        assert_eq!(
            scanner.detect_management_source("vscode", "winget"),
            ManagementSource::Automated
        );

        // MS Store → Policy
        assert_eq!(
            scanner.detect_management_source("WhatsApp", "msstore"),
            ManagementSource::Policy
        );

        // Windows registry → Manual
        assert_eq!(
            scanner.detect_management_source("Notepad++", "windows-registry"),
            ManagementSource::Manual
        );

        // Unknown → Manual
        assert_eq!(
            scanner.detect_management_source("unknown", ""),
            ManagementSource::Manual
        );
    }

    #[test]
    fn test_installation_method_detection() {
        // Package managers
        assert!(matches!(
            MDMSoftwareScanner::detect_installation_method("brew"),
            InstallationMethod::PackageManager
        ));
        assert!(matches!(
            MDMSoftwareScanner::detect_installation_method("apt"),
            InstallationMethod::PackageManager
        ));
        assert!(matches!(
            MDMSoftwareScanner::detect_installation_method("winget"),
            InstallationMethod::PackageManager
        ));

        // macOS app bundle
        assert!(matches!(
            MDMSoftwareScanner::detect_installation_method("macos-app-bundle"),
            InstallationMethod::Other(_)
        ));

        // Windows registry → EXE
        assert_eq!(
            MDMSoftwareScanner::detect_installation_method("windows-registry"),
            InstallationMethod::EXE
        );

        // MS Store → AppStore
        assert_eq!(
            MDMSoftwareScanner::detect_installation_method("msstore"),
            InstallationMethod::AppStore
        );

        // Empty → Manual
        assert_eq!(
            MDMSoftwareScanner::detect_installation_method(""),
            InstallationMethod::Manual
        );
    }

    #[test]
    fn test_detect_install_path_linux() {
        // apt packages should try /usr/bin, /usr/sbin, /usr/local/bin
        // (won't find anything on non-Linux but should not panic)
        let result = MDMSoftwareScanner::detect_install_path("nonexistent-pkg-12345", "apt");
        assert!(result.is_none());
    }

    #[test]
    fn test_detect_install_path_windows() {
        // Should not panic on non-Windows
        let result =
            MDMSoftwareScanner::detect_install_path("nonexistent-pkg-12345", "windows-registry");
        assert!(result.is_none());
    }
}
