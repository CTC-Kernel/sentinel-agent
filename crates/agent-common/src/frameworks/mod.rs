// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Compliance framework mappings.
//!
//! Maps agent checks to regulatory frameworks:
//! - NIST CSF 2.0 (Cybersecurity Framework, subcategory ids of 2.0)
//! - CIS Controls v8
//! - PCI DSS v4.0
//! - ISO 27001:2022
//! - ANSSI Guide d'Hygiène Informatique v2.0 (measures M01–M42)
//! - SOC 2, NIS 2, DORA, HDS v2
//!
//! Framework data is loaded from embedded TOML files at compile time. Control
//! codes and titles follow the platform's control catalogues so that a check
//! result can be attached to the matching control there.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Canonical framework identifiers referenced across the agent.
///
/// Every framework a check may tag, and every framework the server may activate,
/// must resolve to one of these ids via [`normalize_framework_id`]. Keeping a
/// single canonical vocabulary is what makes the technical-to-regulatory link
/// coherent: check tags, the scoring registry, and server-supplied active-
/// framework lists all speak the same identifiers.
pub const CANONICAL_FRAMEWORKS: &[&str] = &[
    "CIS_V8",
    "NIST_CSF",
    "ISO_27001",
    "PCI_DSS",
    "ANSSI_HYGIENE",
    "NIS2",
    "DORA",
    "SOC2",
    "RGPD",
];

/// Normalize a user- or server-supplied framework name to its canonical id.
///
/// Accepts the many spellings that appear in configs, consoles and standards
/// text (e.g. `CIS`, `cis controls v8`, `ISO 27001`, `ISO/IEC 27001:2022`,
/// `GDPR`, `PCI-DSS`, `NIS 2`, `SOC 2`) and maps them to the single canonical
/// identifier used internally. Returns `None` for an unrecognized framework so
/// callers can surface the drift rather than silently ignore it.
pub fn normalize_framework_id(raw: &str) -> Option<&'static str> {
    // Uppercase, then collapse any run of separators to a single '_'.
    let upper = raw.trim().to_ascii_uppercase();
    let mut key = String::with_capacity(upper.len());
    let mut prev_sep = false;
    for ch in upper.chars() {
        if ch.is_ascii_alphanumeric() {
            key.push(ch);
            prev_sep = false;
        } else if !prev_sep {
            key.push('_');
            prev_sep = true;
        }
    }
    let key = key.trim_matches('_');

    match key {
        "CIS" | "CIS_V8" | "CIS_CONTROLS" | "CIS_CONTROLS_V8" | "CISV8" | "CIS_8" => Some("CIS_V8"),
        "NIST" | "NIST_CSF" | "CSF" | "NISTCSF" | "NIST_CSF_2_0" | "NIST_CSF_2" | "NIST_800_53" => {
            Some("NIST_CSF")
        }
        "ISO" | "ISO27001" | "ISO_27001" | "ISO_27001_2022" | "ISO_IEC_27001"
        | "ISO_IEC_27001_2022" | "ISO27001_2022" => Some("ISO_27001"),
        "PCI" | "PCIDSS" | "PCI_DSS" | "PCI_DSS_V4" | "PCI_DSS_V4_0" => Some("PCI_DSS"),
        "ANSSI" | "ANSSI_HYGIENE" | "ANSSI_HYGIENE_INFORMATIQUE" | "ANSSI_GUIDE_HYGIENE" => {
            Some("ANSSI_HYGIENE")
        }
        "NIS2" | "NIS_2" | "NISII" | "NIS_DIRECTIVE_2" => Some("NIS2"),
        "DORA" | "DIGITAL_OPERATIONAL_RESILIENCE_ACT" => Some("DORA"),
        "SOC2" | "SOC_2" | "SOC_2_TYPE_II" | "SOC_2_TYPE_2" => Some("SOC2"),
        "RGPD" | "GDPR" => Some("RGPD"),
        "HDS" | "HDS_V2" | "HEBERGEUR_DE_DONNEES_DE_SANTE" | "HEBERGEMENT_DE_DONNEES_DE_SANTE" => {
            Some("HDS")
        }
        _ => None,
    }
}

/// Human-readable display label for a framework id (canonical or raw).
///
/// Used by the UI and reports so operators see "ISO 27001:2022" rather than the
/// internal `ISO_27001` token. Unknown ids fall back to their uppercase form.
pub fn framework_display_name(id: &str) -> &str {
    match normalize_framework_id(id) {
        Some("CIS_V8") => "CIS Controls v8",
        Some("NIST_CSF") => "NIST CSF 2.0",
        Some("ISO_27001") => "ISO/IEC 27001:2022",
        Some("PCI_DSS") => "PCI DSS v4.0",
        Some("ANSSI_HYGIENE") => "ANSSI — Guide d'hygiène",
        Some("NIS2") => "NIS 2",
        Some("DORA") => "DORA",
        Some("SOC2") => "SOC 2",
        Some("RGPD") => "RGPD / GDPR",
        Some("HDS") => "HDS — Hébergeur de données de santé",
        _ => id,
    }
}

// Embedded framework TOML data (compiled into the binary).
const ANSSI_TOML: &str = include_str!("data/anssi.toml");
const CIS_V8_TOML: &str = include_str!("data/cis_v8.toml");
const DORA_TOML: &str = include_str!("data/dora.toml");
const HDS_TOML: &str = include_str!("data/hds.toml");
const ISO27001_TOML: &str = include_str!("data/iso27001.toml");
const NIS2_TOML: &str = include_str!("data/nis2.toml");
const NIST_CSF_TOML: &str = include_str!("data/nist_csf.toml");
const PCI_DSS_TOML: &str = include_str!("data/pci_dss.toml");
const SOC2_TOML: &str = include_str!("data/soc2.toml");

/// TOML file structure for deserialization.
#[derive(Deserialize)]
struct FrameworkFile {
    framework: FrameworkInfoToml,
    controls: Vec<ControlMappingToml>,
}

/// Framework metadata in TOML.
#[derive(Deserialize)]
struct FrameworkInfoToml {
    id: String,
    name: String,
    version: String,
    description: String,
    applicability: Vec<String>,
    reference_url: String,
}

/// A single control mapping entry in TOML.
#[derive(Deserialize)]
struct ControlMappingToml {
    check_id: String,
    control_id: String,
    control_name: String,
    category: String,
    description: String,
    weight: f32,
    is_critical: bool,
}

/// A mapping between an agent check and a framework control.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlMapping {
    /// The framework identifier (e.g., "NIST_CSF", "CIS_V8").
    pub framework_id: String,
    /// The specific control ID within the framework.
    pub control_id: String,
    /// Human-readable control name.
    pub control_name: String,
    /// The control category/function.
    pub category: String,
    /// Description of the control.
    pub description: String,
    /// Weight for compliance scoring (0.0 - 1.0).
    pub weight: f32,
    /// Whether this control is considered critical.
    pub is_critical: bool,
}

/// Framework metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkInfo {
    /// Unique framework identifier.
    pub id: String,
    /// Full framework name.
    pub name: String,
    /// Framework version.
    pub version: String,
    /// Brief description.
    pub description: String,
    /// Applicable industries/regions.
    pub applicability: Vec<String>,
    /// URL for more information.
    pub reference_url: String,
}

/// Registry of all framework mappings.
#[derive(Debug, Default)]
pub struct FrameworkRegistry {
    /// Framework metadata by ID.
    frameworks: HashMap<String, FrameworkInfo>,
    /// Control mappings: check_id -> Vec<ControlMapping>.
    mappings: HashMap<String, Vec<ControlMapping>>,
}

/// Load a single framework from its TOML source and register it.
fn load_framework(registry: &mut FrameworkRegistry, toml_src: &str) {
    let file: FrameworkFile =
        toml::from_str(toml_src).expect("built-in framework TOML must be valid");

    let framework_id = file.framework.id.clone();

    registry.register_framework(FrameworkInfo {
        id: file.framework.id,
        name: file.framework.name,
        version: file.framework.version,
        description: file.framework.description,
        applicability: file.framework.applicability,
        reference_url: file.framework.reference_url,
    });

    for ctrl in file.controls {
        registry.add_mapping(
            &ctrl.check_id,
            ControlMapping {
                framework_id: framework_id.clone(),
                control_id: ctrl.control_id,
                control_name: ctrl.control_name,
                category: ctrl.category,
                description: ctrl.description,
                weight: ctrl.weight,
                is_critical: ctrl.is_critical,
            },
        );
    }
}

impl FrameworkRegistry {
    /// Create a new registry with all built-in frameworks.
    pub fn new() -> Self {
        let mut registry = Self::default();
        registry.register_builtin_frameworks();
        registry
    }

    /// Register all built-in framework mappings from embedded TOML data.
    fn register_builtin_frameworks(&mut self) {
        load_framework(self, NIST_CSF_TOML);
        load_framework(self, CIS_V8_TOML);
        load_framework(self, PCI_DSS_TOML);
        load_framework(self, ISO27001_TOML);
        load_framework(self, ANSSI_TOML);
        load_framework(self, SOC2_TOML);
        load_framework(self, NIS2_TOML);
        load_framework(self, DORA_TOML);
        load_framework(self, HDS_TOML);
    }

    /// Register a new framework.
    pub fn register_framework(&mut self, info: FrameworkInfo) {
        self.frameworks.insert(info.id.clone(), info);
    }

    /// Add a control mapping for a check.
    pub fn add_mapping(&mut self, check_id: &str, mapping: ControlMapping) {
        self.mappings
            .entry(check_id.to_string())
            .or_default()
            .push(mapping);
    }

    /// Get all mappings for a specific check.
    pub fn get_mappings(&self, check_id: &str) -> Vec<&ControlMapping> {
        self.mappings
            .get(check_id)
            .map(|m| m.iter().collect())
            .unwrap_or_default()
    }

    /// Get mappings for a check filtered by framework.
    pub fn get_mappings_by_framework(
        &self,
        check_id: &str,
        framework_id: &str,
    ) -> Vec<&ControlMapping> {
        self.mappings
            .get(check_id)
            .map(|m| {
                m.iter()
                    .filter(|mapping| mapping.framework_id == framework_id)
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get all checks mapped to a specific framework control.
    pub fn get_checks_for_control(&self, framework_id: &str, control_id: &str) -> Vec<String> {
        self.mappings
            .iter()
            .filter_map(|(check_id, mappings)| {
                if mappings
                    .iter()
                    .any(|m| m.framework_id == framework_id && m.control_id == control_id)
                {
                    Some(check_id.clone())
                } else {
                    None
                }
            })
            .collect()
    }

    /// Get framework info by ID.
    pub fn get_framework(&self, framework_id: &str) -> Option<&FrameworkInfo> {
        self.frameworks.get(framework_id)
    }

    /// Get all registered frameworks.
    pub fn frameworks(&self) -> Vec<&FrameworkInfo> {
        self.frameworks.values().collect()
    }

    /// Every check id that has at least one control mapping.
    ///
    /// Used by coherence tests to verify that scoring mappings only reference
    /// checks that actually ship with the agent.
    pub fn all_mapped_check_ids(&self) -> Vec<String> {
        self.mappings.keys().cloned().collect()
    }

    /// Calculate compliance score for a framework based on check results.
    pub fn calculate_framework_score(
        &self,
        framework_id: &str,
        passed_checks: &[String],
        failed_checks: &[String],
    ) -> Option<FrameworkScore> {
        let framework = self.frameworks.get(framework_id)?;

        let mut total_weight = 0.0;
        let mut passed_weight = 0.0;
        let mut control_results: HashMap<String, ControlResult> = HashMap::new();

        // Process all checks that have mappings to this framework
        for (check_id, mappings) in &self.mappings {
            let framework_mappings: Vec<_> = mappings
                .iter()
                .filter(|m| m.framework_id == framework_id)
                .collect();

            if framework_mappings.is_empty() {
                continue;
            }

            let is_passed = passed_checks.contains(check_id);
            let is_failed = failed_checks.contains(check_id);

            for mapping in framework_mappings {
                total_weight += mapping.weight;

                if is_passed {
                    passed_weight += mapping.weight;
                }

                control_results
                    .entry(mapping.control_id.clone())
                    .or_insert_with(|| ControlResult {
                        control_id: mapping.control_id.clone(),
                        control_name: mapping.control_name.clone(),
                        category: mapping.category.clone(),
                        passed_checks: Vec::new(),
                        failed_checks: Vec::new(),
                        score: 0.0,
                    })
                    .add_check(check_id.clone(), is_passed, is_failed);
            }
        }

        // Calculate control-level scores
        for result in control_results.values_mut() {
            let total = result.passed_checks.len() + result.failed_checks.len();
            if total > 0 {
                result.score = result.passed_checks.len() as f32 / total as f32 * 100.0;
            }
        }

        let overall_score = if total_weight > 0.0 {
            (passed_weight / total_weight) * 100.0
        } else {
            0.0
        };

        let assessed_controls = control_results.len();
        let control_results_vec: Vec<ControlResult> = control_results.into_values().collect();

        Some(FrameworkScore {
            framework_id: framework_id.to_string(),
            framework_name: framework.name.clone(),
            overall_score,
            control_results: control_results_vec,
            total_controls: self.count_framework_controls(framework_id),
            assessed_controls,
        })
    }

    /// Count total unique controls for a framework.
    fn count_framework_controls(&self, framework_id: &str) -> usize {
        let mut controls: std::collections::HashSet<String> = std::collections::HashSet::new();

        for mappings in self.mappings.values() {
            for mapping in mappings {
                if mapping.framework_id == framework_id {
                    controls.insert(mapping.control_id.clone());
                }
            }
        }

        controls.len()
    }
}

/// Result of a single control assessment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlResult {
    /// Control ID.
    pub control_id: String,
    /// Control name.
    pub control_name: String,
    /// Control category.
    pub category: String,
    /// Checks that passed for this control.
    pub passed_checks: Vec<String>,
    /// Checks that failed for this control.
    pub failed_checks: Vec<String>,
    /// Score for this control (0-100).
    pub score: f32,
}

impl ControlResult {
    fn add_check(&mut self, check_id: String, is_passed: bool, is_failed: bool) {
        if is_passed {
            self.passed_checks.push(check_id);
        } else if is_failed {
            self.failed_checks.push(check_id);
        }
    }
}

/// Framework compliance score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkScore {
    /// Framework ID.
    pub framework_id: String,
    /// Framework name.
    pub framework_name: String,
    /// Overall compliance score (0-100).
    pub overall_score: f32,
    /// Per-control results.
    pub control_results: Vec<ControlResult>,
    /// Total controls in framework.
    pub total_controls: usize,
    /// Controls that were assessed.
    pub assessed_controls: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_framework_registry_creation() {
        let registry = FrameworkRegistry::new();

        // Should have all built-in frameworks
        assert!(registry.get_framework("NIST_CSF").is_some());
        assert!(registry.get_framework("CIS_V8").is_some());
        assert!(registry.get_framework("PCI_DSS").is_some());
        assert!(registry.get_framework("ISO_27001").is_some());
        assert!(registry.get_framework("ANSSI_HYGIENE").is_some());
        assert!(registry.get_framework("SOC2").is_some());
        assert!(registry.get_framework("NIS2").is_some());
        assert!(registry.get_framework("DORA").is_some());
        assert!(registry.get_framework("HDS").is_some());
    }

    #[test]
    fn test_get_mappings() {
        let registry = FrameworkRegistry::new();

        // disk_encryption should have mappings
        let mappings = registry.get_mappings("disk_encryption");
        assert!(!mappings.is_empty());
    }

    #[test]
    fn test_framework_score_calculation() {
        let registry = FrameworkRegistry::new();

        let passed = vec!["disk_encryption".to_string(), "firewall".to_string()];
        let failed = vec!["antivirus".to_string()];

        let score = registry.calculate_framework_score("NIST_CSF", &passed, &failed);
        assert!(score.is_some());

        let score = score.unwrap();
        assert!(score.overall_score >= 0.0 && score.overall_score <= 100.0);
    }

    /// Official measure titles of the ANSSI guide v2.0 (M01..M42), as the
    /// platform catalogue imports them (`ANSSI_HYGIENE_SEED_CONTROLS`).
    const ANSSI_HYGIENE_MEASURES: [&str; 42] = [
        "Former les équipes opérationnelles à la sécurité des systèmes d’information",
        "Sensibiliser les utilisateurs aux bonnes pratiques élémentaires de sécurité informatique",
        "Maîtriser les risques de l’infogérance",
        "Identifier les informations et serveurs les plus sensibles et maintenir un schéma du réseau",
        "Disposer d’un inventaire exhaustif des comptes privilégiés et le maintenir à jour",
        "Organiser les procédures d’arrivée, de départ et de changement de fonction des utilisateurs",
        "Autoriser la connexion au réseau de l’entité aux seuls équipements maîtrisés",
        "Identifier nommément chaque personne accédant au système et distinguer les rôles utilisateur/administrateur",
        "Attribuer les bons droits sur les ressources sensibles du système d’information",
        "Définir et vérifier des règles de choix et de dimensionnement des mots de passe",
        "Protéger les mots de passe stockés sur les systèmes",
        "Changer les éléments d’authentification par défaut sur les équipements et services",
        "Privilégier lorsque c’est possible une authentification forte",
        "Mettre en place un niveau de sécurité minimal sur l’ensemble du parc informatique",
        "Se protéger des menaces relatives à l’utilisation de supports amovibles",
        "Utiliser un outil de gestion centralisée afin d’homogénéiser les politiques de sécurité",
        "Activer et configurer le pare-feu local des postes de travail",
        "Chiffrer les données sensibles transmises par voie Internet",
        "Segmenter le réseau et mettre en place un cloisonnement entre ces zones",
        "S’assurer de la sécurité des réseaux d’accès Wi-Fi et de la séparation des usages",
        "Utiliser des protocoles sécurisés dès qu’ils existent",
        "Mettre en place une passerelle d’accès sécurisé à Internet",
        "Cloisonner les services visibles depuis Internet du reste du système d’information",
        "Protéger sa messagerie professionnelle",
        "Sécuriser les interconnexions réseau dédiées avec les partenaires",
        "Contrôler et protéger l’accès aux salles serveurs et aux locaux techniques",
        "Interdire l’accès à Internet depuis les postes ou serveurs utilisés pour l’administration du système d’information",
        "Utiliser un réseau dédié et cloisonné pour l’administration du système d’information",
        "Limiter au strict besoin opérationnel les droits d’administration sur les postes de travail",
        "Prendre des mesures de sécurisation physique des terminaux nomades",
        "Chiffrer les données sensibles, en particulier sur le matériel potentiellement perdable",
        "Sécuriser la connexion réseau des postes utilisés en situation de nomadisme",
        "Adopter des politiques de sécurité dédiées aux terminaux mobiles",
        "Définir une politique de mise à jour des composants du système d’information",
        "Anticiper la fin de la maintenance des logiciels et systèmes et limiter les adhérences logicielles",
        "Activer et configurer les journaux des composants les plus importants",
        "Définir et appliquer une politique de sauvegarde des composants critiques",
        "Procéder à des contrôles et audits de sécurité réguliers puis appliquer les actions correctives associées",
        "Désigner un référent en sécurité des systèmes d’information et le faire connaître auprès du personnel",
        "Définir une procédure de gestion des incidents de sécurité",
        "Mener une analyse de risques formelle",
        "Privilégier l’usage de produits et de services qualifiés par l’ANSSI",
    ];

    /// HDS v2 requirements of the platform catalogue (`HDS_SEED_CONTROLS`).
    const HDS_REQUIREMENTS: &[(&str, &str)] = &[
        (
            "HDS.1.1",
            "Politique de sécurité de l'information couvrant l'hébergement de données de santé",
        ),
        (
            "HDS.1.2",
            "Responsable de la sécurité de l'information désigné pour le périmètre HDS",
        ),
        (
            "HDS.1.3",
            "Appréciation des risques intégrant les risques propres aux données de santé hébergées",
        ),
        (
            "HDS.1.4",
            "Périmètre de certification : activités d'hébergement exercées parmi les six activités (CSP, art. R. 1111-9)",
        ),
        (
            "HDS.1.5",
            "SMSI certifié ISO/IEC 27001 couvrant le périmètre de certification HDS",
        ),
        (
            "HDS.1.6",
            "Sous-traitants réalisant une activité d'hébergement certifiés HDS pour cette activité",
        ),
        (
            "HDS.2.3",
            "Assistance au client pour le traitement des demandes d'exercice des droits des personnes (RGPD, art. 28, par. 3, e)",
        ),
        (
            "HDS.2.4",
            "Traitement des données de santé uniquement sur instruction documentée du client (RGPD, art. 28, par. 3, a)",
        ),
        (
            "HDS.2.5",
            "Engagement de confidentialité des personnes autorisées à traiter les données de santé (RGPD, art. 28, par. 3, b)",
        ),
        (
            "HDS.3.1",
            "Authentification forte des utilisateurs et des administrateurs",
        ),
        ("HDS.3.2", "Chiffrement des données de santé au repos"),
        ("HDS.3.3", "Chiffrement des flux de données de santé"),
        ("HDS.3.4", "Traçabilité des accès aux données de santé"),
        (
            "HDS.4.1",
            "Sauvegardes externalisées des données de santé et tests de restauration",
        ),
        (
            "HDS.4.2",
            "Plan de continuité et de reprise d'activité de l'hébergement",
        ),
        (
            "HDS.4.3",
            "Engagements de niveau de service : indicateurs de qualité et de performance",
        ),
        (
            "HDS.4.4",
            "Réversibilité : restitution des données de santé au client en fin de prestation",
        ),
        (
            "HDS.5.1",
            "Hébergement des données de santé exclusivement dans l'Espace économique européen (EEE)",
        ),
        (
            "HDS.5.2",
            "Information du client sur tout accès aux données de santé depuis un pays hors de l'EEE",
        ),
        (
            "HDS.5.3",
            "Publication de la cartographie des transferts de données de santé hors de l'EEE",
        ),
        (
            "HDS.5.4",
            "Information du client sur les risques d'accès par des autorités de pays tiers et les mesures d'atténuation",
        ),
        (
            "HDS.6.1",
            "Contrat d'hébergement comportant les clauses obligatoires (CSP, art. R. 1111-11)",
        ),
        (
            "HDS.6.2",
            "Gestion des incidents de sécurité affectant les données de santé",
        ),
        (
            "HDS.6.3",
            "Notification au client des incidents et violations affectant ses données de santé (RGPD, art. 33, par. 2)",
        ),
    ];

    /// The 106 subcategory ids of NIST CSF 2.0.
    const NIST_CSF_2_0_SUBCATEGORIES: [&str; 106] = [
        "GV.OC-01", "GV.OC-02", "GV.OC-03", "GV.OC-04", "GV.OC-05", "GV.RM-01", "GV.RM-02",
        "GV.RM-03", "GV.RM-04", "GV.RM-05", "GV.RM-06", "GV.RM-07", "GV.SC-01", "GV.SC-02",
        "GV.SC-03", "GV.SC-04", "GV.SC-05", "GV.SC-06", "GV.SC-07", "GV.SC-08", "GV.SC-09",
        "GV.SC-10", "GV.RR-01", "GV.RR-02", "GV.RR-03", "GV.RR-04", "GV.PO-01", "GV.PO-02",
        "GV.OV-01", "GV.OV-02", "GV.OV-03", "ID.AM-01", "ID.AM-02", "ID.AM-03", "ID.AM-04",
        "ID.AM-05", "ID.AM-07", "ID.AM-08", "ID.RA-01", "ID.RA-02", "ID.RA-03", "ID.RA-04",
        "ID.RA-05", "ID.RA-06", "ID.RA-07", "ID.RA-08", "ID.RA-09", "ID.RA-10", "ID.IM-01",
        "ID.IM-02", "ID.IM-03", "ID.IM-04", "PR.AA-01", "PR.AA-02", "PR.AA-03", "PR.AA-04",
        "PR.AA-05", "PR.AA-06", "PR.AT-01", "PR.AT-02", "PR.DS-01", "PR.DS-02", "PR.DS-10",
        "PR.DS-11", "PR.PS-01", "PR.PS-02", "PR.PS-03", "PR.PS-04", "PR.PS-05", "PR.PS-06",
        "PR.IR-01", "PR.IR-02", "PR.IR-03", "PR.IR-04", "DE.CM-01", "DE.CM-02", "DE.CM-03",
        "DE.CM-06", "DE.CM-09", "DE.AE-02", "DE.AE-03", "DE.AE-04", "DE.AE-06", "DE.AE-07",
        "DE.AE-08", "RS.MA-01", "RS.MA-02", "RS.MA-03", "RS.MA-04", "RS.MA-05", "RS.AN-03",
        "RS.AN-06", "RS.AN-07", "RS.AN-08", "RS.CO-02", "RS.CO-03", "RS.MI-01", "RS.MI-02",
        "RC.RP-01", "RC.RP-02", "RC.RP-03", "RC.RP-04", "RC.RP-05", "RC.RP-06", "RC.CO-03",
        "RC.CO-04",
    ];

    /// Every (check, control) row of a framework, for table-level assertions.
    fn rows(registry: &FrameworkRegistry, framework_id: &str) -> Vec<(String, ControlMapping)> {
        let mut rows: Vec<(String, ControlMapping)> = registry
            .mappings
            .iter()
            .flat_map(|(check_id, mappings)| {
                mappings
                    .iter()
                    .filter(|m| m.framework_id == framework_id)
                    .map(move |m| (check_id.clone(), m.clone()))
            })
            .collect();
        rows.sort_by(|a, b| (&a.0, &a.1.control_id).cmp(&(&b.0, &b.1.control_id)));
        rows
    }

    /// The ANSSI table only cites the 42 official measures of the guide v2.0,
    /// under their official title, so the platform can import its rows.
    #[test]
    fn anssi_rows_cite_official_guide_measures() {
        let registry = FrameworkRegistry::new();
        let rows = rows(&registry, "ANSSI_HYGIENE");
        assert!(!rows.is_empty());

        let mut offenders = Vec::new();
        for (check_id, m) in &rows {
            let official = m
                .control_id
                .strip_prefix('M')
                .filter(|n| n.len() == 2)
                .and_then(|n| n.parse::<usize>().ok())
                .filter(|n| (1..=42).contains(n))
                .map(|n| ANSSI_HYGIENE_MEASURES[n - 1]);
            match official {
                None => offenders.push(format!("{check_id}: {} is not M01..M42", m.control_id)),
                Some(title) if title != m.control_name => offenders.push(format!(
                    "{check_id}: {} is named '{}', official title is '{title}'",
                    m.control_id, m.control_name
                )),
                Some(_) => {}
            }
        }
        assert!(
            offenders.is_empty(),
            "ANSSI rows:\n{}",
            offenders.join("\n")
        );
    }

    /// The NIST table uses CSF 2.0 subcategory ids (no CSF 1.1 id such as PR.AC-5).
    #[test]
    fn nist_csf_rows_use_csf_2_0_subcategories() {
        let registry = FrameworkRegistry::new();
        let rows = rows(&registry, "NIST_CSF");
        assert!(!rows.is_empty());

        let offenders: Vec<String> = rows
            .iter()
            .filter(|(_, m)| !NIST_CSF_2_0_SUBCATEGORIES.contains(&m.control_id.as_str()))
            .map(|(check_id, m)| format!("{check_id}: {}", m.control_id))
            .collect();
        assert!(
            offenders.is_empty(),
            "not CSF 2.0 subcategories: {offenders:?}"
        );
    }

    /// The HDS table cites HDS v2 requirements under their catalogue title, not
    /// ISO/IEC 27001 annex A controls.
    #[test]
    fn hds_rows_cite_hds_v2_requirements() {
        let registry = FrameworkRegistry::new();
        let rows = rows(&registry, "HDS");
        assert!(!rows.is_empty());

        let mut offenders = Vec::new();
        for (check_id, m) in &rows {
            match HDS_REQUIREMENTS
                .iter()
                .find(|(code, _)| *code == m.control_id)
            {
                None => offenders.push(format!(
                    "{check_id}: {} is not an HDS v2 requirement",
                    m.control_id
                )),
                Some((_, title)) if *title != m.control_name => offenders.push(format!(
                    "{check_id}: {} is named '{}', catalogue title is '{title}'",
                    m.control_id, m.control_name
                )),
                Some(_) => {}
            }
        }
        assert!(offenders.is_empty(), "HDS rows:\n{}", offenders.join("\n"));
    }

    /// CIS v8 splits host firewalls into servers (4.4) and end-user devices (4.5);
    /// the firewall check runs on both.
    #[test]
    fn firewall_maps_to_both_cis_v8_firewall_safeguards() {
        let registry = FrameworkRegistry::new();
        let ids: Vec<&str> = registry
            .get_mappings_by_framework("firewall_active", "CIS_V8")
            .iter()
            .map(|m| m.control_id.as_str())
            .collect();
        assert!(ids.contains(&"4.4"), "{ids:?}");
        assert!(ids.contains(&"4.5"), "{ids:?}");
    }

    /// A check cites a given control of a framework at most once, otherwise its
    /// weight counts twice in the framework score.
    #[test]
    fn no_check_cites_the_same_control_twice() {
        let registry = FrameworkRegistry::new();
        let mut seen = std::collections::HashSet::new();
        let mut duplicates = Vec::new();
        for (check_id, mappings) in &registry.mappings {
            for m in mappings {
                if !seen.insert((
                    check_id.clone(),
                    m.framework_id.clone(),
                    m.control_id.clone(),
                )) {
                    duplicates.push(format!("{check_id} → {} {}", m.framework_id, m.control_id));
                }
            }
        }
        assert!(duplicates.is_empty(), "duplicate rows: {duplicates:?}");
    }
}
