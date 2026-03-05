// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Enhanced Software Inventory Scanner for MDM
//!
//! This module provides comprehensive software inventory capabilities
//! specifically designed for Mobile Device Management (MDM) functionality.
//! It extends the basic package scanning with deployment tracking,
//! policy compliance, and management features.

use crate::error::ScannerResult;
use crate::scanner::vulnerability::{
    package_scanner::{InstalledPackage, PackageScanner},
    VulnerabilityFinding,
};
use async_trait::async_trait;
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
                crate::scanner::vulnerability::windows_scanner::WindowsScanner::new()
            ));
        }
        
        #[cfg(target_os = "macos")]
        {
            scanners.push(Arc::new(
                crate::scanner::vulnerability::brew_scanner::BrewScanner::new()
            ));
            scanners.push(Arc::new(
                crate::scanner::vulnerability::macos_app_scanner::MacOSAppScanner::new()
            ));
        }
        
        #[cfg(target_os = "linux")]
        {
            scanners.push(Arc::new(
                crate::scanner::vulnerability::apt_scanner::AptScanner::new()
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
        
        info!("MDM inventory scan completed: {} packages found", total_packages);
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
        cache.get(software_name)
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
        let management_source = self.detect_management_source(&package.name);
        
        MDMSoftwareInventory {
            name: package.name.clone(),
            version: package.version.clone(),
            vendor: package.publisher,
            install_path: None, // Would need additional scanning
            install_date: None, // Would need additional scanning
            last_used: None,   // Would need additional scanning
            size_bytes: None,  // Would need additional scanning
            is_system,
            architecture: package.arch,
            category,
            is_managed: matches!(management_source, ManagementSource::Policy),
            management_source,
            deployment_status: DeploymentStatus::Deployed, // Already installed
            policy_compliance: Vec::new(), // Would need policy engine
            available_updates: Vec::new(), // Would need update checker
            dependencies: Vec::new(),      // Would need dependency resolver
            metadata: SoftwareMetadata {
                signature: None, // Would need signature verification
                hashes: HashMap::new(), // Would need file hashing
                installation_method: InstallationMethod::PackageManager,
                license: None,
                support_end_date: None,
                properties: HashMap::new(),
            },
            last_inventory: Utc::now(),
        }
    }
    
    /// Enhance inventory with additional information
    async fn enhance_inventory(&self, mut inventory: Vec<MDMSoftwareInventory>) -> Vec<MDMSoftwareInventory> {
        // Sort by name for consistency
        inventory.sort_by(|a, b| a.name.cmp(&b.name));
        
        // Add additional metadata and checks
        for software in &mut inventory {
            // Check for available updates (placeholder)
            software.available_updates = self.check_for_updates(software).await;
            
            // Detect dependencies (placeholder)
            software.dependencies = self.detect_dependencies(software).await;
            
            // Calculate hashes (placeholder)
            software.metadata.hashes = self.calculate_hashes(software).await;
        }
        
        inventory
    }
    
    /// Detect software category
    fn detect_category(&self, name: &str) -> SoftwareCategory {
        let name_lower = name.to_lowercase();
        
        // Development tools
        if name_lower.contains("visual studio") || name_lower.contains("vs code") ||
           name_lower.contains("intellij") || name_lower.contains("pycharm") ||
           name_lower.contains("eclipse") || name_lower.contains("xcode") ||
           name_lower.contains("android studio") || name_lower.contains("git") ||
           name_lower.contains("node") || name_lower.contains("npm") ||
           name_lower.contains("docker") || name_lower.contains("kubernetes") {
            return SoftwareCategory::Development;
        }
        
        // Security tools
        if name_lower.contains("antivirus") || name_lower.contains("firewall") ||
           name_lower.contains("vpn") || name_lower.contains("kaspersky") ||
           name_lower.contains("norton") || name_lower.contains("mcafee") ||
           name_lower.contains("avast") || name_lower.contains("bitdefender") ||
           name_lower.contains("malwarebytes") || name_lower.contains("crowdstrike") ||
           name_lower.contains("defender") {
            return SoftwareCategory::Security;
        }
        
        // Communication
        if name_lower.contains("slack") || name_lower.contains("teams") ||
           name_lower.contains("zoom") || name_lower.contains("discord") ||
           name_lower.contains("skype") || name_lower.contains("webex") ||
           name_lower.contains("meet") || name_lower.contains("telegram") ||
           name_lower.contains("whatsapp") || name_lower.contains("signal") {
            return SoftwareCategory::Communication;
        }
        
        // Browsers
        if name_lower.contains("chrome") || name_lower.contains("firefox") ||
           name_lower.contains("safari") || name_lower.contains("edge") ||
           name_lower.contains("opera") || name_lower.contains("brave") ||
           name_lower.contains("vivaldi") {
            return SoftwareCategory::Browser;
        }
        
        // Productivity
        if name_lower.contains("office") || name_lower.contains("word") ||
           name_lower.contains("excel") || name_lower.contains("powerpoint") ||
           name_lower.contains("outlook") || name_lower.contains("notion") ||
           name_lower.contains("evernote") || name_lower.contains("todoist") ||
           name_lower.contains("asana") || name_lower.contains("trello") ||
           name_lower.contains("jira") || name_lower.contains("confluence") {
            return SoftwareCategory::Productivity;
        }
        
        // Media
        if name_lower.contains("vlc") || name_lower.contains("spotify") ||
           name_lower.contains("itunes") || name_lower.contains("photoshop") ||
           name_lower.contains("premiere") || name_lower.contains("final cut") ||
           name_lower.contains("audacity") || name_lower.contains("obs") ||
           name_lower.contains("handbrake") {
            return SoftwareCategory::Media;
        }
        
        // System
        if name_lower.contains("driver") || name_lower.contains("runtime") ||
           name_lower.contains("framework") || name_lower.contains(".net") ||
           name_lower.contains("java") || name_lower.contains("python") ||
           name_lower.contains("ruby") || name_lower.contains("reducible") ||
           name_lower.contains("update") || name_lower.contains("service pack") {
            return SoftwareCategory::System;
        }
        
        // Utility
        if name_lower.contains("7-zip") || name_lower.contains("winrar") ||
           name_lower.contains("ccleaner") || name_lower.contains("notepad") ||
           name_lower.contains("sublime") || name_lower.contains("atom") ||
           name_lower.contains("terminal") || name_lower.contains("iterm") ||
           name_lower.contains("putty") || name_lower.contains("filezilla") ||
           name_lower.contains("winscp") {
            return SoftwareCategory::Utility;
        }
        
        // Games
        if name_lower.contains("steam") || name_lower.contains("epic games") ||
           name_lower.contains("origin") || name_lower.contains("uplay") {
            return SoftwareCategory::Game;
        }
        
        SoftwareCategory::Other
    }
    
    /// Check if software is system software
    fn is_system_software(&self, name: &str, _version: &str) -> bool {
        let name_lower = name.to_lowercase();
        
        // Common system software patterns
        name_lower.contains("microsoft") && 
        (name_lower.contains("windows") || name_lower.contains("system") ||
         name_lower.contains("framework") || name_lower.contains("runtime")) ||
        name_lower.contains("apple") && name_lower.contains("system") ||
        name_lower.contains("driver") ||
        name_lower.contains("kernel") ||
        name_lower.contains("system") ||
        name_lower.starts_with("lib") ||
        name_lower.starts_with("gnu")
    }
    
    /// Detect management source
    fn detect_management_source(&self, name: &str) -> ManagementSource {
        // This would integrate with MDM policies to determine management source
        // For now, assume manual installation
        ManagementSource::Manual
    }
    
    /// Check for available updates (placeholder implementation)
    async fn check_for_updates(&self, _software: &MDMSoftwareInventory) -> Vec<SoftwareUpdate> {
        // This would integrate with update services
        Vec::new()
    }
    
    /// Detect dependencies (placeholder implementation)
    async fn detect_dependencies(&self, _software: &MDMSoftwareInventory) -> Vec<SoftwareDependency> {
        // This would implement dependency resolution
        Vec::new()
    }
    
    /// Calculate file hashes (placeholder implementation)
    async fn calculate_hashes(&self, _software: &MDMSoftwareInventory) -> HashMap<String, String> {
        // This would calculate SHA-256, MD5, etc. hashes
        HashMap::new()
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
    use crate::scanner::vulnerability::package_scanner::InstalledPackage;
    
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
            .with_arch("x64");
        
        let mdm_software = scanner.convert_to_mdm_inventory(package).await;
        
        assert_eq!(mdm_software.name, "Chrome");
        assert_eq!(mdm_software.version, "120.0.0.0");
        assert_eq!(mdm_software.vendor, Some("Google".to_string()));
        assert_eq!(mdm_software.category, SoftwareCategory::Browser);
        assert_eq!(mdm_software.deployment_status, DeploymentStatus::Deployed);
    }
}
