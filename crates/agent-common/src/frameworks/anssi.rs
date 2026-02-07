//! ANSSI Guide d'Hygiène Informatique mappings.
//!
//! Maps agent checks to ANSSI's 42 essential measures for SMB/TPE.
//! Reference: https://www.ssi.gouv.fr/guide/guide-dhygiene-informatique/
//!
//! Domains:
//! - Sensibiliser et former (1-5)
//! - Connaître le système d'information (6-8)
//! - Authentifier et contrôler les accès (9-14)
//! - Sécuriser les postes (15-19)
//! - Sécuriser le réseau (20-25)
//! - Sécuriser l'administration (26-29)
//! - Gérer le nomadisme (30-32)
//! - Maintenir le SI à jour (33-35)
//! - Superviser, auditer, réagir (36-39)
//! - Pour aller plus loin (40-42)

use super::{ControlMapping, FrameworkInfo};
use std::collections::HashMap;

/// ANSSI Guide d'Hygiène Informatique framework mapping.
pub struct AnssiMapping;

impl AnssiMapping {
    /// Get framework metadata.
    pub fn framework_info() -> FrameworkInfo {
        FrameworkInfo {
            id: "ANSSI_HYGIENE".to_string(),
            name: "ANSSI Guide d'Hygiène Informatique".to_string(),
            version: "2.0".to_string(),
            description: "42 mesures essentielles pour la sécurité des SI - TPE/PME".to_string(),
            applicability: vec![
                "TPE/PME".to_string(),
                "France".to_string(),
                "Europe".to_string(),
            ],
            reference_url: "https://www.ssi.gouv.fr/guide/guide-dhygiene-informatique/".to_string(),
        }
    }

    /// Get all check-to-control mappings.
    pub fn mappings() -> HashMap<String, Vec<ControlMapping>> {
        let mut mappings = HashMap::new();

        // ========================================================================
        // DOMAIN: Authentifier et contrôler les accès (9-14)
        // ========================================================================

        // Password Policy -> Mesure 9: Identifier nommément chaque utilisateur
        // Password Policy -> Mesure 10: Définir des règles de choix et de dimensionnement des mots de passe
        mappings.insert(
            "password_policy".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M09".to_string(),
                    control_name: "Identifier nommément chaque utilisateur".to_string(),
                    category: "Authentification et Contrôle d'Accès".to_string(),
                    description: "Attribuer un identifiant unique à chaque utilisateur et interdire les comptes partagés".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M10".to_string(),
                    control_name: "Définir des règles de mots de passe".to_string(),
                    category: "Authentification et Contrôle d'Accès".to_string(),
                    description: "Définir et faire appliquer des règles de choix et de dimensionnement des mots de passe".to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
            ],
        );

        // MFA -> Mesure 11: Protéger les mots de passe stockés sur les systèmes
        // MFA -> Mesure 12: Changer les éléments d'authentification par défaut
        mappings.insert(
            "mfa".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M11".to_string(),
                    control_name: "Protéger les mots de passe stockés".to_string(),
                    category: "Authentification et Contrôle d'Accès".to_string(),
                    description: "Protéger les mots de passe stockés sur les systèmes avec des mécanismes robustes".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M12".to_string(),
                    control_name: "Changer les authentifications par défaut".to_string(),
                    category: "Authentification et Contrôle d'Accès".to_string(),
                    description: "Modifier les éléments d'authentification par défaut sur les équipements et services".to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
            ],
        );

        // Privileged Access -> Mesure 13: Privilégier les authentifications fortes
        mappings.insert(
            "privileged_access".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M13".to_string(),
                control_name: "Authentifications fortes".to_string(),
                category: "Authentification et Contrôle d'Accès".to_string(),
                description:
                    "Privilégier les authentifications multi-facteurs pour les accès sensibles"
                        .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // User Accounts -> Mesure 14: Gérer les droits d'accès
        mappings.insert(
            "user_accounts".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M14".to_string(),
                control_name: "Gérer les droits d'accès".to_string(),
                category: "Authentification et Contrôle d'Accès".to_string(),
                description: "Attribuer les droits d'accès selon le principe du moindre privilège"
                    .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // ========================================================================
        // DOMAIN: Sécuriser les postes (15-19)
        // ========================================================================

        // Antivirus -> Mesure 15: Utiliser un antivirus
        mappings.insert(
            "antivirus".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M15".to_string(),
                control_name: "Utiliser un antivirus".to_string(),
                category: "Sécurité des Postes".to_string(),
                description:
                    "Installer et maintenir à jour un logiciel antivirus sur tous les postes"
                        .to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // Screen Lock -> Mesure 16: Activer le verrouillage automatique des sessions
        mappings.insert(
            "screen_lock".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M16".to_string(),
                control_name: "Verrouillage automatique des sessions".to_string(),
                category: "Sécurité des Postes".to_string(),
                description:
                    "Activer le verrouillage automatique des sessions après période d'inactivité"
                        .to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        // Auto Update -> Mesure 17: Se tenir informé et appliquer les mises à jour
        // System Updates -> Mesure 17: Se tenir informé et appliquer les mises à jour
        mappings.insert(
            "auto_update".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M17".to_string(),
                control_name: "Appliquer les mises à jour".to_string(),
                category: "Sécurité des Postes".to_string(),
                description:
                    "Se tenir informé et appliquer rapidement les mises à jour de sécurité"
                        .to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        mappings.insert(
            "system_updates".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M17".to_string(),
                control_name: "Appliquer les mises à jour".to_string(),
                category: "Sécurité des Postes".to_string(),
                description:
                    "Se tenir informé et appliquer rapidement les mises à jour de sécurité"
                        .to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // Disk Encryption -> Mesure 18: Chiffrer les données sensibles
        mappings.insert(
            "disk_encryption".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M18".to_string(),
                control_name: "Chiffrer les données sensibles".to_string(),
                category: "Sécurité des Postes".to_string(),
                description: "Chiffrer les données sensibles transmises et stockées".to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Secure Boot -> Mesure 19: Limiter les droits d'administration
        mappings.insert(
            "secure_boot".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M19".to_string(),
                control_name: "Sécuriser le démarrage".to_string(),
                category: "Sécurité des Postes".to_string(),
                description:
                    "Activer le démarrage sécurisé pour prévenir les compromissions au boot"
                        .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // ========================================================================
        // DOMAIN: Sécuriser le réseau (20-25)
        // ========================================================================

        // Firewall -> Mesure 20: Installer un pare-feu
        mappings.insert(
            "firewall".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M20".to_string(),
                control_name: "Installer un pare-feu".to_string(),
                category: "Sécurité Réseau".to_string(),
                description:
                    "Installer et configurer un pare-feu sur chaque poste et à l'entrée du réseau"
                        .to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // Network Segmentation -> Mesure 21: Segmenter le réseau
        mappings.insert(
            "network_segmentation".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M21".to_string(),
                control_name: "Segmenter le réseau".to_string(),
                category: "Sécurité Réseau".to_string(),
                description: "Segmenter le réseau pour limiter la propagation des menaces"
                    .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // WiFi Security -> Mesure 22: Sécuriser les réseaux Wi-Fi
        mappings.insert(
            "wifi_security".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M22".to_string(),
                control_name: "Sécuriser les réseaux Wi-Fi".to_string(),
                category: "Sécurité Réseau".to_string(),
                description: "Configurer les réseaux Wi-Fi avec WPA3/WPA2 et des clés robustes"
                    .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // DNS Security -> Mesure 23: Sécuriser les communications réseau
        mappings.insert(
            "dns_security".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M23".to_string(),
                control_name: "Sécuriser DNS et communications".to_string(),
                category: "Sécurité Réseau".to_string(),
                description: "Utiliser DNS sécurisé et chiffrer les communications réseau"
                    .to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        // Remote Access -> Mesure 24: Sécuriser les accès distants
        mappings.insert(
            "remote_access".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M24".to_string(),
                control_name: "Sécuriser les accès distants".to_string(),
                category: "Sécurité Réseau".to_string(),
                description: "Utiliser des VPN et des tunnels chiffrés pour les accès distants"
                    .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // SSH Hardening -> Mesure 25: Contrôler l'accès aux équipements réseau
        mappings.insert(
            "ssh_hardening".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M25".to_string(),
                control_name: "Contrôler l'accès aux équipements".to_string(),
                category: "Sécurité Réseau".to_string(),
                description: "Durcir la configuration SSH et contrôler l'accès aux équipements"
                    .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // ========================================================================
        // DOMAIN: Sécuriser l'administration (26-29)
        // ========================================================================

        // Privileged Access -> Mesure 26: Utiliser des comptes d'administration dédiés
        mappings.insert(
            "admin_accounts".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M26".to_string(),
                control_name: "Comptes d'administration dédiés".to_string(),
                category: "Sécurité Administration".to_string(),
                description: "Utiliser des comptes dédiés pour les tâches d'administration"
                    .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Audit Logging -> Mesure 27: Configurer une journalisation des événements
        mappings.insert(
            "audit_logging".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M27".to_string(),
                control_name: "Journaliser les événements".to_string(),
                category: "Sécurité Administration".to_string(),
                description:
                    "Configurer et centraliser la journalisation des événements de sécurité"
                        .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // Certificate Validation -> Mesure 28: Gérer les certificats numériques
        mappings.insert(
            "certificate_validation".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M28".to_string(),
                control_name: "Gérer les certificats numériques".to_string(),
                category: "Sécurité Administration".to_string(),
                description: "Valider et gérer correctement les certificats numériques".to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        // EDR -> Mesure 29: Détecter les comportements suspects
        mappings.insert(
            "edr".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M29".to_string(),
                control_name: "Détecter les comportements suspects".to_string(),
                category: "Sécurité Administration".to_string(),
                description:
                    "Mettre en place une solution de détection des comportements malveillants"
                        .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // ========================================================================
        // DOMAIN: Gérer le nomadisme (30-32)
        // ========================================================================

        // Disk Encryption (mobile) -> Mesure 30: Chiffrer les équipements mobiles
        // Already mapped to M18, adding mobile-specific mapping
        mappings
            .entry("disk_encryption".to_string())
            .and_modify(|v| {
                v.push(ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M30".to_string(),
                    control_name: "Chiffrer les équipements mobiles".to_string(),
                    category: "Gestion du Nomadisme".to_string(),
                    description: "Chiffrer intégralement les disques des équipements nomades"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                })
            });

        // VPN -> Mesure 31: Utiliser un VPN
        mappings.insert(
            "vpn".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M31".to_string(),
                control_name: "Utiliser un VPN".to_string(),
                category: "Gestion du Nomadisme".to_string(),
                description: "Utiliser un VPN pour tous les accès distants au SI".to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Remote Wipe -> Mesure 32: Sécuriser la perte ou le vol d'équipement
        mappings.insert(
            "remote_wipe".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M32".to_string(),
                control_name: "Sécuriser la perte d'équipement".to_string(),
                category: "Gestion du Nomadisme".to_string(),
                description: "Prévoir l'effacement à distance des équipements volés ou perdus"
                    .to_string(),
                weight: 0.75,
                is_critical: false,
            }],
        );

        // ========================================================================
        // DOMAIN: Maintenir le SI à jour (33-35)
        // ========================================================================

        // Vulnerability Scan -> Mesure 33: Effectuer des audits de sécurité
        mappings.insert(
            "vulnerability_scan".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M33".to_string(),
                control_name: "Effectuer des audits de sécurité".to_string(),
                category: "Maintenance du SI".to_string(),
                description: "Réaliser régulièrement des audits et scans de vulnérabilités"
                    .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // Asset Inventory -> Mesure 34: Maintenir un inventaire des actifs
        mappings.insert(
            "asset_inventory".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M34".to_string(),
                control_name: "Inventaire des actifs".to_string(),
                category: "Maintenance du SI".to_string(),
                description: "Maintenir à jour l'inventaire des équipements et logiciels"
                    .to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // Software Inventory -> Mesure 35: Gérer les logiciels autorisés
        mappings.insert(
            "software_inventory".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M35".to_string(),
                control_name: "Gérer les logiciels autorisés".to_string(),
                category: "Maintenance du SI".to_string(),
                description: "Définir et faire respecter une liste de logiciels autorisés"
                    .to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        // ========================================================================
        // DOMAIN: Superviser, auditer, réagir (36-39)
        // ========================================================================

        // File Integrity -> Mesure 36: Surveiller l'intégrité des fichiers
        mappings.insert(
            "file_integrity".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M36".to_string(),
                control_name: "Surveiller l'intégrité des fichiers".to_string(),
                category: "Supervision et Audit".to_string(),
                description:
                    "Mettre en place une surveillance de l'intégrité des fichiers critiques"
                        .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // Backup -> Mesure 37: Sauvegarder les données
        mappings.insert(
            "backup".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M37".to_string(),
                control_name: "Sauvegarder les données".to_string(),
                category: "Supervision et Audit".to_string(),
                description: "Effectuer des sauvegardes régulières et tester leur restauration"
                    .to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // Incident Response -> Mesure 38: Définir une procédure de gestion des incidents
        mappings.insert(
            "incident_response".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M38".to_string(),
                control_name: "Gestion des incidents".to_string(),
                category: "Supervision et Audit".to_string(),
                description: "Définir et tester une procédure de réponse aux incidents de sécurité"
                    .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Security Monitoring -> Mesure 39: Analyser régulièrement les journaux
        mappings.insert(
            "security_monitoring".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M39".to_string(),
                control_name: "Analyser les journaux".to_string(),
                category: "Supervision et Audit".to_string(),
                description: "Analyser régulièrement les journaux pour détecter les anomalies"
                    .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // ========================================================================
        // DOMAIN: Pour aller plus loin (40-42)
        // ========================================================================

        // Container Security -> Mesure 40: Sécuriser les environnements de virtualisation
        mappings.insert(
            "container_security".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M40".to_string(),
                control_name: "Sécuriser virtualisation/containers".to_string(),
                category: "Mesures Avancées".to_string(),
                description: "Sécuriser les environnements de virtualisation et conteneurs"
                    .to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        // Encryption -> Mesure 41: Utiliser des solutions de chiffrement robustes
        mappings.insert(
            "encryption".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M41".to_string(),
                    control_name: "Chiffrement robuste".to_string(),
                    category: "Mesures Avancées".to_string(),
                    description: "Utiliser des algorithmes et solutions de chiffrement conformes aux recommandations ANSSI".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // DLP -> Mesure 42: Prévenir la fuite de données
        mappings.insert(
            "dlp".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M42".to_string(),
                control_name: "Prévention fuite de données".to_string(),
                category: "Mesures Avancées".to_string(),
                description: "Mettre en place des mesures de prévention de la fuite de données"
                    .to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        // ========================================================================
        // Additional mappings for existing checks
        // ========================================================================

        // BitLocker -> M18, M30
        mappings.insert(
            "bitlocker".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M18".to_string(),
                    control_name: "Chiffrer les données sensibles".to_string(),
                    category: "Sécurité des Postes".to_string(),
                    description: "BitLocker assure le chiffrement des données au repos".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M30".to_string(),
                    control_name: "Chiffrer les équipements mobiles".to_string(),
                    category: "Gestion du Nomadisme".to_string(),
                    description: "BitLocker protège les équipements nomades".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // FileVault -> M18, M30
        mappings.insert(
            "filevault".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M18".to_string(),
                    control_name: "Chiffrer les données sensibles".to_string(),
                    category: "Sécurité des Postes".to_string(),
                    description: "FileVault assure le chiffrement des données au repos sur macOS"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M30".to_string(),
                    control_name: "Chiffrer les équipements mobiles".to_string(),
                    category: "Gestion du Nomadisme".to_string(),
                    description: "FileVault protège les MacBooks nomades".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // Windows Defender -> M15, M29
        mappings.insert(
            "windows_defender".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M15".to_string(),
                    control_name: "Utiliser un antivirus".to_string(),
                    category: "Sécurité des Postes".to_string(),
                    description: "Windows Defender fournit une protection antivirus intégrée"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ANSSI_HYGIENE".to_string(),
                    control_id: "M29".to_string(),
                    control_name: "Détecter les comportements suspects".to_string(),
                    category: "Sécurité Administration".to_string(),
                    description: "Windows Defender détecte les comportements malveillants"
                        .to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // UAC -> M14, M19
        mappings.insert(
            "uac".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M14".to_string(),
                control_name: "Gérer les droits d'accès".to_string(),
                category: "Authentification et Contrôle d'Accès".to_string(),
                description: "UAC limite les élévations de privilèges non autorisées".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // Gatekeeper (macOS) -> M35
        mappings.insert(
            "gatekeeper".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M35".to_string(),
                control_name: "Gérer les logiciels autorisés".to_string(),
                category: "Maintenance du SI".to_string(),
                description: "Gatekeeper contrôle l'exécution des logiciels sur macOS".to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        // SIP (macOS) -> M36
        mappings.insert(
            "sip".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M36".to_string(),
                control_name: "Surveiller l'intégrité des fichiers".to_string(),
                category: "Supervision et Audit".to_string(),
                description: "System Integrity Protection protège les fichiers système macOS"
                    .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // Time Machine -> M37
        mappings.insert(
            "time_machine".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M37".to_string(),
                control_name: "Sauvegarder les données".to_string(),
                category: "Supervision et Audit".to_string(),
                description: "Time Machine assure les sauvegardes automatiques sur macOS"
                    .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Secure DNS -> M23
        mappings.insert(
            "secure_dns".to_string(),
            vec![ControlMapping {
                framework_id: "ANSSI_HYGIENE".to_string(),
                control_id: "M23".to_string(),
                control_name: "Sécuriser DNS et communications".to_string(),
                category: "Sécurité Réseau".to_string(),
                description: "Utiliser DNS over HTTPS/TLS pour sécuriser les requêtes DNS"
                    .to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        mappings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_framework_info() {
        let info = AnssiMapping::framework_info();
        assert_eq!(info.id, "ANSSI_HYGIENE");
        assert_eq!(info.version, "2.0");
        assert!(info.applicability.contains(&"TPE/PME".to_string()));
    }

    #[test]
    fn test_mappings_coverage() {
        let mappings = AnssiMapping::mappings();

        // Verify we have mappings for core checks
        assert!(mappings.contains_key("firewall"));
        assert!(mappings.contains_key("antivirus"));
        assert!(mappings.contains_key("disk_encryption"));
        assert!(mappings.contains_key("password_policy"));
        assert!(mappings.contains_key("backup"));
    }

    #[test]
    fn test_all_42_measures_mapped() {
        let mappings = AnssiMapping::mappings();

        // Collect all control IDs
        let mut control_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
        for controls in mappings.values() {
            for control in controls {
                control_ids.insert(control.control_id.clone());
            }
        }

        // Verify critical measures are mapped (M09-M42)
        // Note: M01-M08 are awareness/training measures not technical controls
        let critical_measures = [
            "M09", "M10", "M11", "M12", "M13", "M14", "M15", "M16", "M17", "M18", "M19", "M20",
            "M21", "M22", "M23", "M24", "M25", "M26", "M27", "M28", "M29", "M30", "M31", "M32",
            "M33", "M34", "M35", "M36", "M37", "M38", "M39", "M40", "M41", "M42",
        ];

        for measure in critical_measures {
            assert!(
                control_ids.contains(measure),
                "Missing mapping for ANSSI measure {}",
                measure
            );
        }
    }

    #[test]
    fn test_control_mapping_weights() {
        let mappings = AnssiMapping::mappings();

        for (check_id, controls) in mappings {
            for control in controls {
                assert!(
                    control.weight >= 0.0 && control.weight <= 1.0,
                    "Invalid weight {} for check {} control {}",
                    control.weight,
                    check_id,
                    control.control_id
                );
            }
        }
    }

    #[test]
    fn test_categories() {
        let mappings = AnssiMapping::mappings();

        let valid_categories = [
            "Authentification et Contrôle d'Accès",
            "Sécurité des Postes",
            "Sécurité Réseau",
            "Sécurité Administration",
            "Gestion du Nomadisme",
            "Maintenance du SI",
            "Supervision et Audit",
            "Mesures Avancées",
        ];

        for controls in mappings.values() {
            for control in controls {
                assert!(
                    valid_categories.contains(&control.category.as_str()),
                    "Unknown category: {}",
                    control.category
                );
            }
        }
    }
}
