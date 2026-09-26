// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Human-readable transcription and pedagogical explanation engine for security events and metrics.
//!
//! Translates raw security telemetry, cryptic process commands, network IOCs, and check metrics
//! into clear, actionable, and human-friendly French explanations with concrete impacts and steps.

use crate::dto::AllowlistRuleType;

/// Pedagogical, human-readable breakdown of a detected security event or anomaly.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HumanEventExplanation {
    /// Friendly human title (e.g., "Exécution de script d'administration").
    pub title: String,
    /// What actually happened on the computer in plain French.
    pub what_happened: String,
    /// Why this matters and its tangible impact on user/company assets.
    pub business_impact: String,
    /// Concrete recommendation for the human operator.
    pub recommended_action: String,
    /// Suggested allowlist parameter if the operator decides this is legitimate business activity.
    pub allowlist_suggestion: Option<(AllowlistRuleType, String, &'static str)>,
    /// Whether this is commonly a benign administrative task or false positive.
    pub is_likely_benign: bool,
}

/// Translate a suspicious process event into human language.
pub fn explain_suspicious_process(
    process_name: &str,
    command_line: &str,
    reason: &str,
    confidence: u8,
) -> HumanEventExplanation {
    let lower_proc = process_name.to_lowercase();
    let lower_cmd = command_line.to_lowercase();

    let (title, what, impact, action, allow_val, allow_type, is_benign) = if lower_proc
        .contains("powershell")
        || lower_proc.contains("cmd.exe")
    {
        (
            "Interpréteur de commandes Windows sollicité".to_string(),
            format!(
                "Un script ou une application a lancé l'interpréteur `{process_name}` en lui passant des instructions système ({reason})."
            ),
            "L'interpréteur de commandes permet d'accéder aux fonctionnalités avancées de l'ordinateur. Les attaquants l'utilisent souvent pour contourner les protections, mais les outils de déploiement et d'administration l'utilisent aussi régulièrement.",
            "Vérifiez si cette exécution coïncide avec une mise à jour ou une intervention de votre service informatique. Si c'est un outil approuvé, cliquez sur 'Autoriser ce processus'.",
            process_name.to_string(),
            AllowlistRuleType::ProcessPattern,
            confidence < 65,
        )
    } else if lower_proc.contains("curl")
        || lower_proc.contains("wget")
        || lower_cmd.contains("http://")
        || lower_cmd.contains("https://")
    {
        (
            "Téléchargement automatisé de fichier via la ligne de commande".to_string(),
            format!(
                "Le programme `{process_name}` a tenté de télécharger ou transmettre des données sur un serveur distant."
            ),
            "Ce type d'outil est très utilisé par les développeurs, mais peut aussi être exploité pour récupérer un composant malveillant depuis Internet sans ouvrir de navigateur.",
            "Vérifiez l'adresse web ciblée dans la ligne de commande. Si elle appartient à votre entreprise ou à un service connu (ex: GitHub, CDN), autorisez ce motif.",
            process_name.to_string(),
            AllowlistRuleType::ProcessPattern,
            confidence < 60,
        )
    } else if lower_proc.contains("sudo")
        || lower_proc.contains("su")
        || lower_cmd.contains("root")
        || lower_cmd.contains("whoami")
    {
        (
            "Vérification ou élévation de privilèges administrateur".to_string(),
            format!(
                "La commande `{process_name}` a été appelée pour vérifier ou obtenir les droits administrateur (root)."
            ),
            "L'obtention des privilèges administrateur permet de modifier n'importe quelle configuration ou d'accéder à tous les fichiers de la machine.",
            "Si vous n'avez pas vous-même ouvert de terminal d'administration à cette heure, vérifiez l'origine du processus parent.",
            process_name.to_string(),
            AllowlistRuleType::ProcessPattern,
            confidence < 50,
        )
    } else if lower_proc.contains("python")
        || lower_proc.contains("ruby")
        || lower_proc.contains("perl")
        || lower_proc.contains("node")
    {
        (
            "Script de programmation en cours d'exécution".to_string(),
            format!(
                "L'interpréteur `{process_name}` exécute un script personnalisé : `{command_line}`."
            ),
            "Les scripts sont indispensables au travail des développeurs et administrateurs, mais ils peuvent aussi exécuter des actions non vérifiées par le système d'exploitation.",
            "Si ce script fait partie de vos projets métiers habituels, vous pouvez l'autoriser par motif ou nom de fichier.",
            process_name.to_string(),
            AllowlistRuleType::ProcessPattern,
            true,
        )
    } else {
        (
            format!("Comportement inhabituel : {process_name}"),
            format!("Le processus `{process_name}` a déclenché une alerte de sécurité : {reason}."),
            "Ce programme a effectué une action non standard sur le système (accès mémoire, communication inhabituelle ou chemin suspect).",
            "Consultez la ligne de commande complète ci-dessous. Si vous reconnaissez ce logiciel, autorisez-le pour ne plus être alerté.",
            process_name.to_string(),
            AllowlistRuleType::ProcessPattern,
            confidence < 55,
        )
    };

    HumanEventExplanation {
        title,
        what_happened: what,
        business_impact: impact.to_string(),
        recommended_action: action.to_string(),
        allowlist_suggestion: Some((allow_type, allow_val, "Processus")),
        is_likely_benign: is_benign,
    }
}

/// Translate a network security alert into human language.
pub fn explain_network_alert(
    alert_type: &str,
    description: &str,
    src_ip: Option<&str>,
    dst_ip: Option<&str>,
    port: Option<u16>,
) -> HumanEventExplanation {
    let target = dst_ip.unwrap_or(src_ip.unwrap_or("Hôte distant"));
    let port_str = port.map(|p| format!(" (port {p})")).unwrap_or_default();

    let (title, what, impact, action) = match alert_type {
        "beaconing" => (
            "Communication régulière vers un serveur distant (Signal d'écoute)".to_string(),
            format!(
                "Votre machine contacte l'adresse `{target}`{port_str} à intervalles de temps très réguliers et répétés ({description})."
            ),
            "Ce type de signal périodique peut être une synchronisation logicielle légitime (messagerie, cloud, télémétrie) ou un canal de maintien de liaison (C2) établi par un logiciel espion.",
            "Vérifiez si l'adresse IP correspond à un service cloud de votre entreprise. Si oui, autorisez cette IP.",
        ),
        "dga" => (
            "Tentative de connexion à un domaine généré aléatoirement".to_string(),
            format!(
                "Une requête de résolution de nom a été envoyée vers un domaine aux caractères suspects ({description})."
            ),
            "Les réseaux de machines zombies (botnets) génèrent automatiquement de nouveaux noms de domaine chaque jour pour éviter le blocage de leurs serveurs.",
            "Vérifiez si une extension de navigateur ou un logiciel récemment installé tente d'accéder à ce domaine.",
        ),
        "port_scan" => (
            "Balayage de ports réseau détecté".to_string(),
            format!(
                "L'adresse `{target}` teste successivement plusieurs points d'entrée sur votre machine ({description})."
            ),
            "Le balayage cherche à identifier quels services ou logiciels sont ouverts sur votre ordinateur pour trouver une porte d'entrée vulnérable.",
            "Le pare-feu bloque généralement ces tentatives. Si cette adresse IP appartient à un scanner de vulnérabilité de votre service sécurité, vous pouvez l'autoriser.",
        ),
        "dns_tunneling" => (
            "Transmission de données suspecte via le protocole DNS".to_string(),
            format!(
                "Des paquets DNS anormalement longs ou chiffrés transitent vers `{target}` ({description})."
            ),
            "Le détournement du protocole DNS permet parfois de faire sortir des documents confidentiels sans être bloqué par les pare-feux web standards.",
            "Investiguez immédiatement la machine émettrice pour identifier le processus à l'origine de ce trafic.",
        ),
        _ => (
            format!("Flux réseau suspect vers {target}"),
            format!("Une activité réseau atypique a été enregistrée : {description}."),
            "Ce flux sort des schémas de navigation et d'utilisation habituels de votre environnement de travail.",
            "Si vous reconnaissez ce serveur partenaire ou cette adresse IP interne, vous pouvez l'ajouter à la liste d'autorisation.",
        ),
    };

    HumanEventExplanation {
        title,
        what_happened: what,
        business_impact: impact.to_string(),
        recommended_action: action.to_string(),
        allowlist_suggestion: dst_ip
            .or(src_ip)
            .map(|ip| (AllowlistRuleType::IpAddress, ip.to_string(), "Adresse IP")),
        is_likely_benign: false,
    }
}

/// Translate a system security incident into human language.
pub fn explain_system_incident(
    incident_type: &str,
    title: &str,
    description: &str,
) -> HumanEventExplanation {
    let (h_title, what, impact, action) = match incident_type {
        "firewall_disabled" => (
            "Pare-feu système désactivé ou affaibli".to_string(),
            "Le pare-feu de protection du système d'exploitation a été coupé ou ses règles de filtrage ont été contournées.".to_string(),
            "Sans pare-feu actif, tous les ports de votre machine sont directement exposés aux tentatives de connexion des autres machines du réseau.".to_string(),
            "Réactivez immédiatement le pare-feu dans vos paramètres système ou autorisez Sentinel Agent à appliquer la remédiation automatique.".to_string(),
        ),
        "antivirus_disabled" => (
            "Protection antivirus / EDR en temps réel arrêtée".to_string(),
            "Le service de détection des malwares n'analyse plus les fichiers téléchargés ou exécutés.".to_string(),
            "Votre ordinateur ne dispose plus de bouclier contre les virus, rançongiciels ou logiciels espions.".to_string(),
            "Relancez le service de sécurité immédiatement pour rétablir la surveillance en mémoire.".to_string(),
        ),
        "privilege_escalation" => (
            "Tentative d'accès administrateur sans autorisation".to_string(),
            format!("Un utilisateur ou un script a tenté d'obtenir les pleins droits système : {description}."),
            "L'accès administrateur permet de contourner toutes les politiques de sécurité et d'installer des logiciels à votre insu.".to_string(),
            "Vérifiez l'utilisateur à l'origine de la demande et révoquez la session en cas de doute.".to_string(),
        ),
        _ => (
            title.to_string(),
            format!("Événement système capturé : {description}."),
            "Cet événement modifie l'état de sécurité ou de conformité de votre poste de travail.".to_string(),
            "Si cette modification a été réalisée dans le cadre d'une intervention planifiée, vous pouvez acquitter l'alerte.".to_string(),
        ),
    };

    HumanEventExplanation {
        title: h_title,
        what_happened: what,
        business_impact: impact,
        recommended_action: action,
        allowlist_suggestion: None,
        is_likely_benign: false,
    }
}

/// Translate a USB connection event into human language.
pub fn explain_usb_event(
    device_name: &str,
    vendor_id: u16,
    product_id: u16,
    is_blocked: bool,
) -> HumanEventExplanation {
    let id_str = format!("0x{:04X}:0x{:04X}", vendor_id, product_id);
    if is_blocked {
        HumanEventExplanation {
            title: format!("Périphérique USB bloqué : {device_name}"),
            what_happened: format!("Le périphérique USB `{device_name}` ({id_str}) a été branché mais la politique de sécurité a bloqué son montage."),
            business_impact: "Cette politique protège l'entreprise contre l'infection par clé USB piégée (BadUSB) et empêche la copie de données confidentielles vers l'extérieur.".to_string(),
            recommended_action: "S'il s'agit d'un périphérique professionnel approuvé par votre direction, vous pouvez l'autoriser pour l'ajouter à la liste blanche.".to_string(),
            allowlist_suggestion: Some((AllowlistRuleType::UsbDevice, id_str, "Périphérique USB")),
            is_likely_benign: false,
        }
    } else {
        HumanEventExplanation {
            title: format!("Périphérique USB connecté : {device_name}"),
            what_happened: format!("Le périphérique `{device_name}` ({id_str}) a été détecté et connecté avec succès sur l'ordinateur."),
            business_impact: "L'utilisation de supports amovibles constitue un point d'attention pour la traçabilité des données sensibles.".to_string(),
            recommended_action: "Si vous avez terminé votre transfert, débranchez la clé pour garantir la propreté des ports physiques.".to_string(),
            allowlist_suggestion: Some((AllowlistRuleType::UsbDevice, id_str, "Périphérique USB")),
            is_likely_benign: true,
        }
    }
}

/// Translate a File Integrity Monitoring (FIM) event into human language.
pub fn explain_fim_event(path: &str, change_type: &str) -> HumanEventExplanation {
    let (action_label, impact, advice) = match change_type {
        "deleted" => (
            "a été supprimé",
            "La disparition d'un fichier système ou de configuration peut impacter le bon fonctionnement des services ou cacher des traces d'audit.",
            "Vérifiez si cette suppression correspond à la désinstallation d'un logiciel ou à une purge de fichiers temporaires.",
        ),
        "permission_changed" => (
            "a vu ses droits d'accès modifiés",
            "Rendre un fichier accessible en écriture à tout le monde permet à un pirate ou un malware d'en altérer le contenu sans mot de passe.",
            "Rétablissez les permissions restreintes d'origine ou confirmez la règle si c'est intentionnel.",
        ),
        _ => (
            "a été créé ou modifié",
            "La modification de fichiers dans les répertoires système sensibles (ex: /etc, C:\\Windows) est un vecteur classique de persistance pour les malwares.",
            "Si ce chemin correspond à un répertoire de travail normal ou à des journaux applicatifs, vous pouvez exclure ce motif.",
        ),
    };

    HumanEventExplanation {
        title: format!("Fichier sensible altéré : {path}"),
        what_happened: format!("Le fichier `{path}` {action_label} sur votre disque."),
        business_impact: impact.to_string(),
        recommended_action: advice.to_string(),
        allowlist_suggestion: Some((AllowlistRuleType::FilePath, path.to_string(), "Chemin FIM")),
        is_likely_benign: path.contains("/tmp/")
            || path.contains("\\Temp\\")
            || path.contains(".cache"),
    }
}

/// Pedagogical explanation for technical security checks (Compliance & Baselines).
pub fn explain_security_check(check_id: &str) -> (&'static str, &'static str, &'static str) {
    match check_id {
        "disk_encryption" => (
            "Chiffrement intégral du disque dur (BitLocker / FileVault / LUKS)",
            "Si votre ordinateur est perdu, oublié ou volé, personne ne peut lire vos documents, emails ou mots de passe sans la clé de sécurité.",
            "Activez FileVault (macOS) ou BitLocker (Windows) dans vos paramètres système pour être 100% protégé.",
        ),
        "firewall_active" => (
            "Pare-feu personnel actif avec filtrage des connexions entrantes",
            "Empêche les ordinateurs connectés au même réseau (ex: Wi-Fi public ou réseau d'entreprise) d'accéder directement à vos services.",
            "Activez le pare-feu dans les paramètres de sécurité réseau de votre système d'exploitation.",
        ),
        "mfa_enabled" => (
            "Authentification multi-facteurs (MFA / 2FA)",
            "Même si un pirate découvre votre mot de passe, il ne peut pas se connecter sans votre deuxième facteur (smartphone, clé FIDO2).",
            "Configurez une application d'authentification ou une clé physique pour verrouiller l'accès à vos comptes.",
        ),
        "session_lock" => (
            "Verrouillage automatique de session après inactivité",
            "Si vous vous éloignez de votre poste pour prendre un café ou en réunion, personne ne peut consulter vos écrans ou envoyer des messages à votre place.",
            "Réglez le délai d'extinction de l'écran et de verrouillage sur 5 minutes maximum.",
        ),
        "antivirus_active" => (
            "Protection temps réel contre les malwares et rançongiciels",
            "Bloque les pièces jointes frauduleuses, les liens dangereux et les scripts malveillants avant qu'ils ne chiffrent vos données.",
            "Vérifiez que Windows Defender, CrowdStrike ou votre solution EDR est active et à jour.",
        ),
        "backup_status" => (
            "Sauvegardes régulières vérifiées et testées",
            "Permet de récupérer tous vos documents intacts en quelques minutes en cas de panne de disque dur, de perte ou d'attaque ransomware.",
            "Branchez votre support Time Machine ou activez la sauvegarde cloud d'entreprise automatisée.",
        ),
        "system_updates" => (
            "Mises à jour du système d'exploitation et correctifs critiques",
            "Corrige les failles de sécurité connues que les attaquants scannent sur Internet pour pénétrer les machines non patchées.",
            "Installez les mises à jour en attente et redémarrez votre ordinateur si demandé.",
        ),
        "audit_logging" => (
            "Journalisation continue des événements de sécurité",
            "Permet de comprendre précisément ce qui s'est passé lors d'un incident et apporte les preuves requises pour les normes SOC 2 et ISO 27001.",
            "Activez les journaux d'audit de sécurité standard du système d'exploitation.",
        ),
        _ => (
            "Contrôle de conformité de la sécurité du poste",
            "Vérifie qu'un paramètre technique de votre ordinateur respecte les exigences de sécurité de l'entreprise.",
            "Consultez les détails techniques de l'agent pour appliquer la remédiation conseillée.",
        ),
    }
}

/// Translate a vulnerability (CVE) finding into human language.
pub fn explain_vulnerability(
    cve_id: &str,
    affected_software: &str,
    cvss: Option<f32>,
    fix_available: bool,
    _description: &str,
) -> HumanEventExplanation {
    let cvss_val = cvss.unwrap_or(5.0);
    let severity_desc = if cvss_val >= 9.0 {
        "critique"
    } else if cvss_val >= 7.0 {
        "élevée"
    } else {
        "modérée"
    };

    let what = format!(
        "Une faille de sécurité connue ({cve_id}) de sévérité {severity_desc} (score CVSS {cvss_val:.1}) a été identifiée sur le composant `{affected_software}`."
    );
    let impact = if cvss_val >= 7.0 {
        "Cette vulnérabilité peut permettre à un attaquant à distance d'exécuter du code sans autorisation ou de dérober des données sensibles de l'application."
    } else {
        "Cette faille peut être combinée avec d'autres faiblesses pour contourner certaines restrictions d'accès ou provoquer un déni de service."
    };
    let action = if fix_available {
        format!(
            "Un correctif de sécurité officiel est disponible. Mettez à jour `{affected_software}` sans délai."
        )
    } else {
        "Aucun correctif direct n'est encore publié par l'éditeur. Isolez ou limitez l'exposition réseau de ce service jusqu'à la mise à jour.".to_string()
    };

    HumanEventExplanation {
        title: format!("Vulnérabilité {cve_id} : {affected_software}"),
        what_happened: what,
        business_impact: impact.to_string(),
        recommended_action: action,
        allowlist_suggestion: None,
        is_likely_benign: false,
    }
}

/// Render a pedagogical human-readable explanation card inside a UI / detail drawer.
pub fn render_human_explanation_card(ui: &mut egui::Ui, exp: &HumanEventExplanation) {
    ui.add_space(crate::theme::SPACE_SM);
    crate::widgets::detail_section(ui, "COMPRÉHENSION & IMPACT HUMAIN");

    egui::Frame::new()
        .fill(crate::theme::bg_secondary())
        .corner_radius(egui::CornerRadius::same(crate::theme::ROUNDING_MD))
        .inner_margin(egui::Margin::same(crate::theme::SPACE_MD as i8))
        .stroke(egui::Stroke::new(
            crate::theme::BORDER_THIN,
            if exp.is_likely_benign {
                crate::theme::SUCCESS.gamma_multiply(0.5)
            } else {
                crate::theme::WARNING.gamma_multiply(0.5)
            },
        ))
        .show(ui, |ui| {
            // Header: Friendly title + benign badge
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new(&exp.title)
                        .font(crate::theme::font_body())
                        .color(crate::theme::text_primary())
                        .strong(),
                );
                if exp.is_likely_benign {
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        crate::widgets::status_badge(ui, "Fréquent / Bénin", crate::theme::SUCCESS);
                    });
                }
            });
            ui.add_space(crate::theme::SPACE_SM);

            // 1. What happened
            ui.label(
                egui::RichText::new("Ce qui s'est produit en clair :")
                    .font(crate::theme::font_small())
                    .color(crate::theme::text_secondary())
                    .strong(),
            );
            ui.add_space(crate::theme::SPACE_XS);
            ui.label(
                egui::RichText::new(&exp.what_happened)
                    .font(crate::theme::font_body())
                    .color(crate::theme::text_primary()),
            );
            ui.add_space(crate::theme::SPACE_MD);

            // 2. Business Impact
            ui.label(
                egui::RichText::new("Impact potentiel pour vos données :")
                    .font(crate::theme::font_small())
                    .color(crate::theme::WARNING)
                    .strong(),
            );
            ui.add_space(crate::theme::SPACE_XS);
            ui.label(
                egui::RichText::new(&exp.business_impact)
                    .font(crate::theme::font_body())
                    .color(crate::theme::text_secondary()),
            );
            ui.add_space(crate::theme::SPACE_MD);

            // 3. Recommended action
            ui.label(
                egui::RichText::new("Action conseillée :")
                    .font(crate::theme::font_small())
                    .color(crate::theme::ACCENT)
                    .strong(),
            );
            ui.add_space(crate::theme::SPACE_XS);
            ui.label(
                egui::RichText::new(&exp.recommended_action)
                    .font(crate::theme::font_body())
                    .color(crate::theme::text_primary()),
            );
        });
    ui.add_space(crate::theme::SPACE_MD);
}
