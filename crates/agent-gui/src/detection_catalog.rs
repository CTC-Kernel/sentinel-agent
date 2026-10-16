// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Detection rules shipped with the agent, ready to use.
//!
//! The agent installs them as ordinary rules the first time it starts, active:
//! they can then be turned off, edited or deleted like any other, in the
//! interface or on the platform. A later agent version that improves one
//! updates it, unless the operator changed it; a rule the operator deleted is
//! not installed again until they ask for the defaults back.
//!
//! Each condition is a case-insensitive substring, and one condition is
//! enough for a rule to match: a rule lists the indicators of one technique.
//! They apply to every process started or running, every connection and
//! every file change the agent sees.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::dto::{
    DetectionCondition, DetectionConditionType as Kind, DetectionRule, PlaybookActionType, Severity,
};

/// Identifiers of the shipped rules start with this.
pub const DEFAULT_RULE_ID_PREFIX: &str = "default-";

/// Whether a rule is one of the shipped rules (or was installed from one).
pub fn is_default_rule_id(id: &str) -> bool {
    id.starts_with(DEFAULT_RULE_ID_PREFIX)
}

/// A shipped rule, as written below.
struct Entry {
    slug: &'static str,
    name: &'static str,
    description: &'static str,
    severity: Severity,
    conditions: &'static [(Kind, &'static str)],
}

use Kind::{
    CommandLineContains as Cmd, FimPathMatch as File, NetworkPort as Port,
    ProcessNameContains as Name,
};

const CATALOG: &[Entry] = &[
    Entry {
        slug: "credential-dumping",
        name: "Vol d'identifiants (Mimikatz, mémoire de LSASS, base SAM)",
        description: "Outils et commandes qui extraient les mots de passe et les empreintes \
            du système : Mimikatz et ses modules, copie de la mémoire de LSASS, sauvegarde de \
            la base SAM ou de l'annuaire (ntds.dit). MITRE ATT&CK T1003.",
        severity: Severity::Critical,
        conditions: &[
            (Name, "mimikatz"),
            (Name, "lazagne"),
            (Cmd, "sekurlsa::"),
            (Cmd, "lsadump::"),
            (Cmd, "privilege::debug"),
            (Cmd, "pypykatz"),
            (Cmd, "comsvcs.dll"),
            (Cmd, "lsass.dmp"),
            (Cmd, "-ma lsass"),
            (Cmd, "hklm\\sam"),
            (Cmd, "ntds.dit"),
        ],
    },
    Entry {
        slug: "macos-password-theft",
        name: "Vol de mots de passe sur macOS (fausse fenêtre, trousseau)",
        description: "Fenêtre AppleScript qui demande le mot de passe de la session \
            (« with hidden answer »), vérification de ce mot de passe par dscl, extraction du \
            trousseau : les méthodes des voleurs d'identifiants macOS (Atomic Stealer et \
            apparentés). MITRE ATT&CK T1056.002, T1555.001.",
        severity: Severity::High,
        conditions: &[
            (Cmd, "with hidden answer"),
            (Cmd, "dscl . -authonly"),
            (Cmd, "dump-keychain"),
            (Cmd, "chainbreaker"),
        ],
    },
    Entry {
        slug: "reverse-shell",
        name: "Shell inversé",
        description: "Interpréteur de commandes relié à une connexion sortante : redirection \
            vers /dev/tcp, netcat ou socat lancés avec un shell, pty.spawn de Python, client \
            TCP de PowerShell. Quelqu'un pilote le poste à distance. MITRE ATT&CK T1059.",
        severity: Severity::Critical,
        conditions: &[
            (Cmd, "/dev/tcp/"),
            (Cmd, "/dev/udp/"),
            (Cmd, "-e /bin/sh"),
            (Cmd, "-e /bin/bash"),
            (Cmd, "-e cmd.exe"),
            (Cmd, "exec:/bin/"),
            (Cmd, "pty.spawn("),
            (Cmd, "net.sockets.tcpclient"),
        ],
    },
    Entry {
        slug: "crypto-mining",
        name: "Minage de cryptomonnaie",
        description: "Mineurs connus (XMRig et autres) et connexions à un pool de minage \
            (stratum) : la puissance du poste sert à un tiers. MITRE ATT&CK T1496.",
        severity: Severity::High,
        conditions: &[
            (Name, "xmrig"),
            (Name, "minerd"),
            (Name, "cpuminer"),
            (Name, "cgminer"),
            (Name, "bfgminer"),
            (Name, "ethminer"),
            (Name, "nbminer"),
            (Name, "lolminer"),
            (Cmd, "stratum+tcp://"),
            (Cmd, "stratum+ssl://"),
            (Cmd, "stratum2+tcp://"),
            (Cmd, "--donate-level"),
        ],
    },
    Entry {
        slug: "powershell-obfuscation",
        name: "PowerShell encodé ou chargé depuis Internet",
        description: "Commande PowerShell passée en Base64 (-EncodedCommand) ou script \
            téléchargé puis exécuté en mémoire (DownloadString, IEX) : la façon la plus \
            courante de lancer un code malveillant sans fichier. Quelques outils \
            d'administration encodent aussi leurs commandes. MITRE ATT&CK T1059.001, T1027.",
        severity: Severity::Medium,
        conditions: &[
            (Cmd, "-encodedcommand"),
            (Cmd, " -enc "),
            (Cmd, "frombase64string("),
            (Cmd, ".downloadstring("),
            (Cmd, "iex (new-object"),
            (Cmd, "iex(new-object"),
            (Cmd, "invoke-expression (new-object"),
        ],
    },
    Entry {
        slug: "lolbin",
        name: "Programme de Windows détourné pour télécharger ou exécuter",
        description: "Programmes du système utilisés pour télécharger ou lancer un code \
            (LOLBins) : certutil -urlcache ou -decode, regsvr32 /i:http (scrobj.dll), mshta \
            vbscript:, rundll32 RunHTMLApplication, bitsadmin /transfer. MITRE ATT&CK T1218, \
            T1105.",
        severity: Severity::High,
        conditions: &[
            (Cmd, "-urlcache"),
            (Cmd, "certutil -decode"),
            (Cmd, "certutil.exe -decode"),
            (Cmd, "/i:http"),
            (Cmd, "scrobj.dll"),
            (Cmd, "vbscript:"),
            (Cmd, ",runhtmlapplication"),
            (Cmd, "bitsadmin /transfer"),
            (Cmd, "bitsadmin.exe /transfer"),
        ],
    },
    Entry {
        slug: "inhibit-recovery",
        name: "Suppression des sauvegardes et des points de restauration",
        description: "Clichés instantanés supprimés, catalogue de sauvegarde effacé, \
            réparation au démarrage désactivée, Time Machine coupée : ce que fait un \
            rançongiciel juste avant de chiffrer. MITRE ATT&CK T1490.",
        severity: Severity::Critical,
        conditions: &[
            (Cmd, "delete shadows"),
            (Cmd, "shadowcopy delete"),
            (Cmd, "win32_shadowcopy"),
            (Cmd, "delete catalog"),
            (Cmd, "resize shadowstorage"),
            (Cmd, "recoveryenabled no"),
            (Cmd, "bootstatuspolicy ignoreallfailures"),
            (Cmd, "tmutil disable"),
        ],
    },
    Entry {
        slug: "log-clearing",
        name: "Effacement des journaux",
        description: "Journaux d'événements de Windows vidés (wevtutil, Clear-EventLog), \
            politique d'audit réinitialisée, journal USN supprimé, journaux de Linux ou de \
            macOS effacés : un intrus efface ses traces. MITRE ATT&CK T1070.001, T1070.002.",
        severity: Severity::High,
        conditions: &[
            (Cmd, "wevtutil cl "),
            (Cmd, "wevtutil.exe cl "),
            (Cmd, "wevtutil clear-log"),
            (Cmd, "wevtutil.exe clear-log"),
            (Cmd, "clear-eventlog"),
            (Cmd, "auditpol /clear"),
            (Cmd, "fsutil usn deletejournal"),
            (Cmd, "rm -rf /var/log"),
            (Cmd, "log erase --"),
        ],
    },
    Entry {
        slug: "defense-evasion",
        name: "Désactivation des protections du poste",
        description: "Microsoft Defender coupé ou contourné par une exclusion, pare-feu \
            désactivé, Gatekeeper, SELinux ou l'audit de Linux arrêtés en ligne de commande. \
            MITRE ATT&CK T1562.001, T1562.004.",
        severity: Severity::High,
        conditions: &[
            (Cmd, "-disablerealtimemonitoring"),
            (Cmd, "-disablebehaviormonitoring"),
            (Cmd, "-disableioavprotection"),
            (Cmd, "-exclusionpath"),
            (Cmd, "-exclusionprocess"),
            (Cmd, "advfirewall set allprofiles state off"),
            (Cmd, "netsh firewall set opmode disable"),
            (Cmd, "spctl --master-disable"),
            (Cmd, "spctl --global-disable"),
            (Cmd, "setenforce 0"),
            (Cmd, "ufw disable"),
            (Cmd, "auditctl -e 0"),
            (Cmd, "systemctl stop auditd"),
        ],
    },
    Entry {
        slug: "attack-tools",
        name: "Outil d'attaque ou de reconnaissance connu",
        description: "Outils offensifs courants : Rubeus, SharpHound (BloodHound), PowerView, \
            PowerUp, Impacket, CrackMapExec, Kerbrute, winPEAS et linPEAS, pspy, les tunnels \
            chisel et ligolo. Légitimes pendant un test d'intrusion annoncé : autorisez-les \
            alors. MITRE ATT&CK T1588.002.",
        severity: Severity::High,
        conditions: &[
            (Name, "rubeus"),
            (Name, "sharphound"),
            (Name, "winpeas"),
            (Name, "linpeas"),
            (Name, "kerbrute"),
            (Name, "crackmapexec"),
            (Name, "chisel"),
            (Name, "ligolo"),
            (Name, "pspy"),
            (Cmd, "invoke-kerberoast"),
            (Cmd, "invoke-bloodhound"),
            (Cmd, "invoke-mimikatz"),
            (Cmd, "powerview.ps1"),
            (Cmd, "powerup.ps1"),
            (Cmd, "secretsdump"),
            (Cmd, "impacket"),
            (Cmd, "linpeas"),
            (Cmd, "winpeas"),
            (Cmd, "sharphound"),
        ],
    },
    Entry {
        slug: "domain-recon",
        name: "Reconnaissance de l'annuaire Active Directory",
        description: "Recherche des administrateurs du domaine, des relations d'approbation et \
            des contrôleurs : la reconnaissance qui précède une prise de contrôle du domaine. \
            MITRE ATT&CK T1087.002, T1482.",
        severity: Severity::Medium,
        conditions: &[
            (Name, "adfind"),
            (Cmd, "domain admins"),
            (Cmd, "enterprise admins"),
            (Cmd, "admins du domaine"),
            (Cmd, "/domain_trusts"),
            (Cmd, "/dclist:"),
            (Cmd, "get-netdomain"),
            (Cmd, "get-domaintrust"),
        ],
    },
    Entry {
        slug: "admin-group-change",
        name: "Groupe des administrateurs modifié en ligne de commande",
        description: "Compte ajouté aux administrateurs locaux (net localgroup sous Windows, \
            dseditgroup sous macOS, usermod -aG sudo ou wheel sous Linux) : un intrus s'assure \
            de garder ses droits. MITRE ATT&CK T1098.",
        severity: Severity::Medium,
        conditions: &[
            (Cmd, "localgroup administrators"),
            (Cmd, "localgroup administrateurs"),
            (Cmd, "dseditgroup -o edit -a"),
            (Cmd, "usermod -ag sudo"),
            (Cmd, "usermod -ag wheel"),
            (Cmd, "usermod -ag admin"),
        ],
    },
    Entry {
        slug: "scheduled-task-or-service",
        name: "Tâche planifiée ou service créé en ligne de commande",
        description: "Tâche planifiée ou service de Windows créé par schtasks, sc ou PowerShell : \
            un moyen de relancer un programme à chaque démarrage. Des installateurs le font \
            aussi. MITRE ATT&CK T1053.005, T1543.003.",
        severity: Severity::Medium,
        conditions: &[
            (Cmd, "schtasks /create"),
            (Cmd, "schtasks.exe /create"),
            (Cmd, "register-scheduledtask"),
            (Cmd, "sc create "),
            (Cmd, "sc.exe create "),
            (Cmd, "new-service "),
        ],
    },
    Entry {
        slug: "authentication-files",
        name: "Fichiers d'authentification modifiés",
        description: "Comptes, mots de passe, droits sudo, modules d'authentification (PAM), \
            configuration du serveur SSH ou clés SSH autorisées modifiés : de quoi créer un \
            accès ou le garder. Une mise à jour du système peut aussi y toucher. MITRE ATT&CK \
            T1098.004, T1556.003.",
        severity: Severity::High,
        conditions: &[
            (File, "/etc/passwd"),
            (File, "/etc/shadow"),
            (File, "/etc/sudoers"),
            (File, "/etc/group"),
            (File, "/etc/pam.d/"),
            (File, "/etc/ssh/sshd_config"),
            (File, "authorized_keys"),
        ],
    },
    Entry {
        slug: "library-preload",
        name: "Bibliothèque imposée à tous les programmes",
        description: "Fichier /etc/ld.so.preload modifié, ou programme lancé avec LD_PRELOAD ou \
            DYLD_INSERT_LIBRARIES pointant vers un dossier temporaire : la technique des \
            rootkits en espace utilisateur. MITRE ATT&CK T1574.006.",
        severity: Severity::Critical,
        conditions: &[
            (File, "/etc/ld.so.preload"),
            (Cmd, "ld_preload=/tmp"),
            (Cmd, "ld_preload=/var/tmp"),
            (Cmd, "ld_preload=/dev/shm"),
            (Cmd, "dyld_insert_libraries=/tmp"),
            (Cmd, "dyld_insert_libraries=/private/tmp"),
        ],
    },
    Entry {
        slug: "autostart-change",
        name: "Programme ajouté au démarrage",
        description: "Tâche cron, service systemd, script d'init, agent ou démon launchd, \
            raccourci du dossier Démarrage de Windows créé ou modifié : le programme se \
            relancera à chaque démarrage. MITRE ATT&CK T1053.003, T1543, T1547.",
        severity: Severity::Medium,
        conditions: &[
            (File, "/etc/cron"),
            (File, "/var/spool/cron"),
            (File, "/etc/systemd/system/"),
            (File, "/etc/init.d/"),
            (File, "/etc/rc.local"),
            (File, "/library/launchdaemons/"),
            (File, "/library/launchagents/"),
            (File, "\\start menu\\programs\\startup\\"),
        ],
    },
    Entry {
        slug: "hosts-file",
        name: "Fichier hosts modifié",
        description: "Le fichier hosts envoie un nom vers l'adresse de son choix sans passer par \
            le DNS : redirection d'un site vers un faux, blocage des mises à jour de sécurité. \
            MITRE ATT&CK T1565.001.",
        severity: Severity::Medium,
        conditions: &[(File, "/etc/hosts"), (File, "\\drivers\\etc\\hosts")],
    },
    Entry {
        slug: "attack-ports",
        name: "Connexion vers un port d'outil d'attaque",
        description: "Connexion vers le port par défaut de Metasploit (4444) ou des portes \
            dérobées historiques (1337, 31337). Selenium Grid utilise aussi le port 4444. \
            MITRE ATT&CK T1571.",
        severity: Severity::Medium,
        conditions: &[(Port, "4444"), (Port, "1337"), (Port, "31337")],
    },
    Entry {
        slug: "tor",
        name: "Trafic acheminé par Tor",
        description: "Connexion au relais Tor local (ports 9050 et 9150) : le trafic du \
            programme sort anonymisé, hors de la surveillance du réseau. MITRE ATT&CK \
            T1090.003.",
        severity: Severity::Medium,
        conditions: &[(Port, "9050"), (Port, "9150")],
    },
];

/// The shipped rules, active, dated `created_at`. They detect and notify;
/// a response (stop the process, block the address…) is the operator's
/// choice, added by editing the rule.
pub fn default_rules(created_at: DateTime<Utc>) -> Vec<DetectionRule> {
    CATALOG
        .iter()
        .map(|entry| DetectionRule {
            id: format!("{DEFAULT_RULE_ID_PREFIX}{}", entry.slug),
            name: entry.name.to_string(),
            description: entry.description.to_string(),
            severity: entry.severity,
            conditions: entry
                .conditions
                .iter()
                .map(|(condition_type, value)| DetectionCondition {
                    condition_type: *condition_type,
                    value: (*value).to_string(),
                })
                .collect(),
            actions: Vec::new(),
            enabled: true,
            created_at,
            last_match: None,
            match_count: 0,
        })
        .collect()
}

/// What a rule detects and does, as compared to tell whether it was changed:
/// its name, description, severity, conditions and actions. Whether it is
/// on and how often it matched are not part of it.
pub fn definition(rule: &DetectionRule) -> String {
    #[derive(Serialize)]
    struct Definition<'a> {
        name: &'a str,
        description: &'a str,
        severity: &'a str,
        conditions: Vec<(&'a str, &'a str)>,
        actions: Vec<&'a str>,
    }
    serde_json::to_string(&Definition {
        name: &rule.name,
        description: &rule.description,
        severity: rule.severity.as_str(),
        conditions: rule
            .conditions
            .iter()
            .map(|c| (c.condition_type.as_str(), c.value.as_str()))
            .collect(),
        actions: rule
            .actions
            .iter()
            .map(PlaybookActionType::as_str)
            .collect(),
    })
    .unwrap_or_default()
}

/// What installing the shipped rules changes.
#[derive(Debug, Default)]
pub struct InstallPlan {
    /// Shipped rules not installed yet.
    pub insert: Vec<DetectionRule>,
    /// Installed rules the operator left as installed, whose shipped version
    /// changed: the new version, still on or off as it was, with its
    /// matches.
    pub update: Vec<DetectionRule>,
    /// The definition installed for each shipped rule, to remember for the
    /// next installation.
    pub installed: BTreeMap<String, String>,
}

/// What to install of `catalog`, given the rules on the endpoint and what was
/// installed before (`installed`: definition by rule id).
///
/// A shipped rule absent from the endpoint is installed, unless it was
/// installed before: the operator (or the platform) deleted it. One present
/// is updated when its definition is still the one installed; one changed
/// since is left as it is.
pub fn plan_install(
    catalog: &[DetectionRule],
    existing: &[DetectionRule],
    installed: &BTreeMap<String, String>,
) -> InstallPlan {
    let mut plan = InstallPlan {
        installed: installed.clone(),
        ..InstallPlan::default()
    };
    for shipped in catalog {
        let shipped_definition = definition(shipped);
        match existing.iter().find(|rule| rule.id == shipped.id) {
            None if installed.contains_key(&shipped.id) => {}
            None => {
                plan.insert.push(shipped.clone());
                plan.installed
                    .insert(shipped.id.clone(), shipped_definition);
            }
            Some(current) => {
                let current_definition = definition(current);
                if current_definition == shipped_definition {
                    plan.installed
                        .insert(shipped.id.clone(), shipped_definition);
                } else if installed.get(&shipped.id) == Some(&current_definition) {
                    plan.update.push(DetectionRule {
                        enabled: current.enabled,
                        created_at: current.created_at,
                        last_match: current.last_match,
                        match_count: current.match_count,
                        ..shipped.clone()
                    });
                    plan.installed
                        .insert(shipped.id.clone(), shipped_definition);
                }
            }
        }
    }
    plan
}

/// `installed` without the rules no longer on the endpoint: installing again
/// then brings back the shipped rules that were deleted.
pub fn forget_deleted(
    installed: &BTreeMap<String, String>,
    existing: &[DetectionRule],
) -> BTreeMap<String, String> {
    installed
        .iter()
        .filter(|(id, _)| existing.iter().any(|rule| &rule.id == *id))
        .map(|(id, definition)| (id.clone(), definition.clone()))
        .collect()
}

/// How many shipped rules are not on the endpoint (deleted, or not installed
/// yet).
pub fn missing_defaults(existing: &[DetectionRule]) -> usize {
    CATALOG
        .iter()
        .filter(|entry| {
            !existing.iter().any(|rule| {
                rule.id
                    .strip_prefix(DEFAULT_RULE_ID_PREFIX)
                    .is_some_and(|slug| slug == entry.slug)
            })
        })
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        Utc::now()
    }

    #[test]
    fn shipped_rules_are_ready_and_well_formed() {
        let rules = default_rules(now());
        assert!(rules.len() >= 15, "{}", rules.len());
        let mut ids = std::collections::HashSet::new();
        for rule in &rules {
            assert!(ids.insert(rule.id.clone()), "duplicate id {}", rule.id);
            assert!(is_default_rule_id(&rule.id));
            assert!(rule.enabled, "{}", rule.id);
            assert!(!rule.conditions.is_empty(), "{}", rule.id);
            // The platform's limits.
            assert!(rule.id.len() <= 128 && !rule.id.contains('/'));
            assert!(rule.name.chars().count() <= 255, "{}", rule.id);
            assert!(rule.description.chars().count() <= 1024, "{}", rule.id);
            assert!(rule.description.contains("MITRE ATT&CK T"), "{}", rule.id);
            assert!(rule.conditions.len() <= 100, "{}", rule.id);
            for condition in &rule.conditions {
                // The engine lowercases what it compares: a value with a
                // capital would never match.
                assert_eq!(
                    condition.value,
                    condition.value.to_lowercase(),
                    "{}",
                    rule.id
                );
                assert!(!condition.value.trim().is_empty(), "{}", rule.id);
                if condition.condition_type == Kind::NetworkPort {
                    assert!(condition.value.parse::<u16>().is_ok(), "{}", rule.id);
                }
            }
        }
    }

    #[test]
    fn shipped_rules_only_detect_and_notify() {
        // Nothing acts on the host until the operator chooses a response.
        assert!(
            default_rules(now())
                .iter()
                .all(|rule| rule.actions.is_empty())
        );
    }

    #[test]
    fn a_first_installation_installs_everything() {
        let catalog = default_rules(now());
        let plan = plan_install(&catalog, &[], &BTreeMap::new());
        assert_eq!(plan.insert.len(), catalog.len());
        assert!(plan.update.is_empty());
        assert_eq!(plan.installed.len(), catalog.len());
    }

    #[test]
    fn an_installation_already_done_changes_nothing() {
        let catalog = default_rules(now());
        let first = plan_install(&catalog, &[], &BTreeMap::new());
        let again = plan_install(&catalog, &catalog, &first.installed);
        assert!(again.insert.is_empty() && again.update.is_empty());
        assert_eq!(again.installed, first.installed);
    }

    #[test]
    fn a_deleted_rule_stays_deleted_until_the_defaults_are_restored() {
        let catalog = default_rules(now());
        let installed = plan_install(&catalog, &[], &BTreeMap::new()).installed;
        let kept: Vec<DetectionRule> = catalog[1..].to_vec();

        let again = plan_install(&catalog, &kept, &installed);
        assert!(again.insert.is_empty(), "a deleted rule came back");

        let restored = plan_install(&catalog, &kept, &forget_deleted(&installed, &kept));
        assert_eq!(restored.insert.len(), 1);
        assert_eq!(restored.insert[0].id, catalog[0].id);
        assert_eq!(missing_defaults(&kept), 1);
        assert_eq!(missing_defaults(&catalog), 0);
    }

    #[test]
    fn an_improved_shipped_rule_replaces_the_one_left_untouched() {
        let old = default_rules(now());
        let installed = plan_install(&old, &[], &BTreeMap::new()).installed;
        // The operator turned it off; it matched twice.
        let mut on_endpoint = old.clone();
        on_endpoint[0].enabled = false;
        on_endpoint[0].match_count = 2;

        let mut new = old.clone();
        new[0].conditions.push(DetectionCondition {
            condition_type: Kind::CommandLineContains,
            value: "nouvel indicateur".to_string(),
        });
        let plan = plan_install(&new, &on_endpoint, &installed);
        assert!(plan.insert.is_empty());
        assert_eq!(plan.update.len(), 1);
        let updated = &plan.update[0];
        assert_eq!(updated.conditions.len(), new[0].conditions.len());
        assert!(!updated.enabled, "turning it off is kept");
        assert_eq!(updated.match_count, 2);
        assert_eq!(plan.installed[&updated.id], definition(&new[0]));
    }

    #[test]
    fn a_shipped_rule_the_operator_edited_is_left_alone() {
        let old = default_rules(now());
        let installed = plan_install(&old, &[], &BTreeMap::new()).installed;
        let mut on_endpoint = old.clone();
        on_endpoint[0].actions = vec![PlaybookActionType::KillProcess];

        let mut new = old.clone();
        new[0].severity = Severity::Low;
        let plan = plan_install(&new, &on_endpoint, &installed);
        assert!(plan.update.is_empty() && plan.insert.is_empty());
        // Still remembered as installed: deleting it later must not bring
        // back the shipped version.
        assert!(plan.installed.contains_key(&old[0].id));
    }

    #[test]
    fn being_on_or_off_is_not_part_of_the_definition() {
        let mut rule = default_rules(now()).remove(0);
        let before = definition(&rule);
        rule.enabled = false;
        rule.match_count = 9;
        assert_eq!(definition(&rule), before);
        rule.conditions.pop();
        assert_ne!(definition(&rule), before);
    }
}
