// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Actions the assistant can propose.
//!
//! The assistant never runs anything. When one of the agent's actions answers
//! the operator's request, it ends its answer with a line `ACTION: <code>`.
//! The application reads that line, hides it from the transcript, checks the
//! action makes sense in the current state, and offers it as a button; the
//! action only runs once the operator has confirmed it.
//!
//! The codes form a closed list: anything else on the action line is hidden
//! and ignored, so a model that invents an action proposes nothing.

use crate::dto::{GuiCheckResult, GuiCheckStatus};
use crate::events::GuiCommand;

/// Instructions added to the assistant's system prompt. Constant, so the
/// model's prefix cache is kept from one question to the next.
pub const PROMPT_INSTRUCTIONS: &str = "Tu ne peux rien exécuter toi-même. Quand une action de l'agent répond directement à la demande, ajoute tout à la fin de ta réponse, seule sur la dernière ligne, `ACTION: code` avec l'un de ces codes exacts : `lancer_analyse` (relancer les contrôles et l'analyse des vulnérabilités, par exemple pour vérifier qu'une correction a porté), `decouverte_reseau` (rechercher les appareils du réseau local), `exporter_sbom` (exporter l'inventaire logiciel), `corriger:` suivi de l'identifiant technique d'un contrôle en échec, copié tel qu'il figure entre crochets dans le contexte (forme attendue : `corriger:firewall_active` ; jamais une CVE ni un nom de domaine), `isoler_poste` (couper le poste du réseau, réservé à une compromission en cours), `lever_isolation`. Une seule action, jamais dans le corps de la réponse. Si aucune ne répond à la demande (définition, explication, simple constat), n'écris pas de ligne ACTION. L'action n'est lancée qu'après validation de l'opérateur : ne dis jamais qu'elle a été faite.";

/// Added to a spoken question: an action line must not be read aloud.
pub const SPOKEN_INSTRUCTIONS: &str = " N'ajoute pas de ligne ACTION.";

/// An action of the agent proposed by the assistant.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AssistantAction {
    /// Run the compliance checks and the vulnerability scan again.
    RunAnalysis,
    /// Look for the devices of the local network.
    DiscoverNetwork,
    /// Export the software inventory as a CycloneDX SBOM.
    ExportSbom,
    /// Apply the remediation of a failing check.
    Remediate { check_id: String },
    /// Cut the endpoint off the network.
    IsolateHost,
    /// Lift the network isolation.
    ReleaseHost,
}

impl AssistantAction {
    /// Read an action code (`lancer_analyse`, `corriger:firewall_active`…).
    fn from_code(code: &str) -> Option<Self> {
        let code = code.trim().trim_matches(['`', '*', '"', '\'', '.', ' ']);
        let (name, argument) = match code.split_once(':') {
            Some((name, argument)) => (name.trim(), Some(argument.trim())),
            None => (code, None),
        };
        match (name.to_ascii_lowercase().as_str(), argument) {
            ("lancer_analyse", None) => Some(Self::RunAnalysis),
            ("decouverte_reseau", None) => Some(Self::DiscoverNetwork),
            ("exporter_sbom", None) => Some(Self::ExportSbom),
            ("isoler_poste", None) => Some(Self::IsolateHost),
            ("lever_isolation", None) => Some(Self::ReleaseHost),
            ("corriger", Some(check_id)) => {
                let check_id = check_id.trim_matches(['[', ']', '`', ' ']);
                // An identifier, or a domain label to resolve ("pare-feu",
                // "mises à jour"): letters, digits, `_`, `-` and spaces.
                let valid = !check_id.is_empty()
                    && check_id.chars().count() <= 80
                    && check_id
                        .chars()
                        .all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | ' '));
                valid.then(|| Self::Remediate {
                    check_id: check_id.to_string(),
                })
            }
            _ => None,
        }
    }

    /// Turn a remediation that names a security domain (`corriger:pare-feu`)
    /// into one naming a check, when exactly one check of that domain is
    /// failing. Models often cite the domain label instead of the identifier
    /// in brackets; anything else is returned unchanged and will simply not
    /// apply.
    ///
    /// `domains` pairs each domain label with its check identifiers.
    pub fn resolved(self, checks: &[GuiCheckResult], domains: &[(&str, &[&str])]) -> Self {
        let Self::Remediate { check_id } = &self else {
            return self;
        };
        if checks.iter().any(|check| check.check_id == *check_id) {
            return self;
        }
        let cited = fold(check_id);
        let failing: Vec<&str> = domains
            .iter()
            .filter(|(label, _)| fold(label) == cited)
            .flat_map(|(_, ids)| ids.iter().copied())
            .filter(|id| {
                checks.iter().any(|check| {
                    check.check_id == *id
                        && matches!(check.status, GuiCheckStatus::Fail | GuiCheckStatus::Error)
                })
            })
            .collect();
        match failing.as_slice() {
            [only] => Self::Remediate {
                check_id: (*only).to_string(),
            },
            _ => self,
        }
    }

    /// Whether the action makes sense now: a remediation needs a check that
    /// is failing, an isolation an endpoint that is not isolated yet, and so
    /// on. An action that does not apply is not offered.
    pub fn applies(&self, checks: &[GuiCheckResult], host_isolated: bool) -> bool {
        match self {
            Self::RunAnalysis | Self::DiscoverNetwork | Self::ExportSbom => true,
            Self::IsolateHost => !host_isolated,
            Self::ReleaseHost => host_isolated,
            Self::Remediate { check_id } => checks.iter().any(|check| {
                check.check_id == *check_id
                    && matches!(check.status, GuiCheckStatus::Fail | GuiCheckStatus::Error)
            }),
        }
    }

    /// Label of the button offering the action.
    pub fn label(&self, checks: &[GuiCheckResult]) -> String {
        match self {
            Self::RunAnalysis => "Lancer l'analyse".to_string(),
            Self::DiscoverNetwork => "Lancer la découverte du réseau".to_string(),
            Self::ExportSbom => "Exporter le SBOM".to_string(),
            Self::IsolateHost => "Isoler le poste du réseau".to_string(),
            Self::ReleaseHost => "Lever l'isolation".to_string(),
            Self::Remediate { check_id } => {
                let name = checks
                    .iter()
                    .find(|check| check.check_id == *check_id)
                    .map(|check| check.name.as_str())
                    .unwrap_or(check_id);
                format!("Corriger : {name}")
            }
        }
    }

    /// What the operator is told before confirming.
    pub fn confirmation(&self) -> &'static str {
        match self {
            Self::RunAnalysis => {
                "Les contrôles de conformité et l'analyse des vulnérabilités vont être relancés."
            }
            Self::DiscoverNetwork => {
                "L'agent va rechercher les appareils présents sur le réseau local."
            }
            Self::ExportSbom => {
                "L'inventaire logiciel et ses vulnérabilités seront exportés au format CycloneDX sur le Bureau."
            }
            Self::Remediate { .. } => {
                "La remédiation de ce contrôle va modifier la configuration du poste. L'opération est enregistrée dans le journal d'audit."
            }
            Self::IsolateHost => {
                "Tout le trafic réseau du poste sera coupé, sauf la plateforme, le DNS et le DHCP, jusqu'à la levée de l'isolation."
            }
            Self::ReleaseHost => "Le poste retrouvera un accès complet au réseau.",
        }
    }

    /// Whether the action changes the endpoint in a way worth a warning.
    pub fn is_disruptive(&self) -> bool {
        matches!(self, Self::IsolateHost | Self::Remediate { .. })
    }

    /// The command that performs the action.
    pub fn command(&self) -> GuiCommand {
        match self {
            Self::RunAnalysis => GuiCommand::RunCheck,
            Self::DiscoverNetwork => GuiCommand::StartDiscovery,
            Self::ExportSbom => GuiCommand::ExportSbom,
            Self::Remediate { check_id } => GuiCommand::Remediate {
                check_id: check_id.clone(),
            },
            Self::IsolateHost => GuiCommand::IsolateHost { duration_secs: 0 },
            Self::ReleaseHost => GuiCommand::ReleaseHost,
        }
    }
}

/// Lower-case letters and digits only, accents removed: `Pare-feu`,
/// `pare_feu` and `pare feu` compare equal.
fn fold(text: &str) -> String {
    text.chars()
        .flat_map(char::to_lowercase)
        .filter_map(|c| match c {
            'à' | 'â' | 'ä' => Some('a'),
            'é' | 'è' | 'ê' | 'ë' => Some('e'),
            'î' | 'ï' => Some('i'),
            'ô' | 'ö' => Some('o'),
            'ù' | 'û' | 'ü' => Some('u'),
            'ç' => Some('c'),
            c if c.is_ascii_alphanumeric() => Some(c),
            _ => None,
        })
        .collect()
}

/// The action code of a line, when the line is an action line
/// (`ACTION: code`, with or without Markdown emphasis around it).
fn action_line(line: &str) -> Option<&str> {
    let line = line.trim().trim_start_matches(['*', '`', '>', '-', ' ']);
    let rest = line
        .get(..6)
        .filter(|prefix| prefix.eq_ignore_ascii_case("action"))
        .map(|_| &line[6..])?;
    rest.trim_start_matches(['*', ' ']).strip_prefix(':')
}

/// Split an assistant answer into the text to show and the action it
/// proposes.
///
/// Only the last non-empty line can be an action line. It is always hidden,
/// even when its code is unknown.
pub fn split_action(content: &str) -> (&str, Option<AssistantAction>) {
    let trimmed = content.trim_end();
    let last_line_start = trimmed.rfind('\n').map_or(0, |index| index + 1);
    match action_line(&trimmed[last_line_start..]) {
        Some(code) => (
            trimmed[..last_line_start].trim_end(),
            AssistantAction::from_code(code),
        ),
        None => (content, None),
    }
}

/// The text of an answer without its action line.
pub fn visible_text(content: &str) -> &str {
    split_action(content).0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn check(id: &str, status: &str) -> GuiCheckResult {
        serde_json::from_value(serde_json::json!({
            "check_id": id, "name": format!("Nom de {id}"), "category": "general",
            "status": status, "severity": "high", "frameworks": [],
        }))
        .expect("minimal check result")
    }

    #[test]
    fn the_last_line_is_read_as_the_action_and_hidden() {
        let (text, action) = split_action(
            "Le pare-feu est désactivé.\n\nRisque élevé.\nACTION: corriger:firewall_active\n",
        );
        assert_eq!(text, "Le pare-feu est désactivé.\n\nRisque élevé.");
        assert_eq!(
            action,
            Some(AssistantAction::Remediate {
                check_id: "firewall_active".to_string()
            })
        );

        for (line, expected) in [
            ("ACTION: lancer_analyse", AssistantAction::RunAnalysis),
            (
                "action : decouverte_reseau",
                AssistantAction::DiscoverNetwork,
            ),
            ("**ACTION:** `exporter_sbom`", AssistantAction::ExportSbom),
            ("- Action: isoler_poste.", AssistantAction::IsolateHost),
            ("ACTION: Lever_Isolation", AssistantAction::ReleaseHost),
            (
                "ACTION: corriger: [disk_encryption]",
                AssistantAction::Remediate {
                    check_id: "disk_encryption".to_string(),
                },
            ),
        ] {
            let answer = format!("Constat.\n{line}");
            assert_eq!(
                split_action(&answer),
                ("Constat.", Some(expected)),
                "{line}"
            );
        }
    }

    #[test]
    fn unknown_or_malformed_actions_are_hidden_and_ignored() {
        for line in [
            "ACTION: formater_le_disque",
            "ACTION: aucune",
            "ACTION:",
            "ACTION: corriger:",
            "ACTION: corriger:rm -rf /",
            "ACTION: corriger:$(reboot)",
            "ACTION: lancer_analyse:maintenant",
            "ACTION: isoler_poste et lancer_analyse",
        ] {
            assert_eq!(
                split_action(&format!("Constat.\n{line}")),
                ("Constat.", None),
                "{line}"
            );
        }
    }

    #[test]
    fn text_without_an_action_line_is_left_alone() {
        let answer = "1) Constat\n2) Actions prioritaires : relancer l'analyse.\n";
        assert_eq!(split_action(answer), (answer, None));
        // A line that merely mentions the word is not an action line.
        let answer = "Actions prioritaires : isoler_poste";
        assert_eq!(split_action(answer), (answer, None));
        // Only the last line counts.
        let answer = "ACTION: lancer_analyse\nPuis vérifiez les sauvegardes.";
        assert_eq!(split_action(answer), (answer, None));
        assert_eq!(split_action(""), ("", None));
        assert_eq!(visible_text("Bonjour.\nACTION: exporter_sbom"), "Bonjour.");
        // Accented text before the action line keeps its boundaries.
        assert_eq!(
            visible_text("Chiffré à 100 %.\nACTION: exporter_sbom"),
            "Chiffré à 100 %."
        );
    }

    #[test]
    fn an_action_is_offered_only_when_it_applies() {
        let checks = vec![
            check("firewall_active", "fail"),
            check("disk_encryption", "pass"),
        ];
        let remediate = |id: &str| AssistantAction::Remediate {
            check_id: id.to_string(),
        };

        assert!(remediate("firewall_active").applies(&checks, false));
        assert!(
            !remediate("disk_encryption").applies(&checks, false),
            "passing check"
        );
        assert!(!remediate("invented_check").applies(&checks, false));
        assert!(AssistantAction::IsolateHost.applies(&checks, false));
        assert!(!AssistantAction::IsolateHost.applies(&checks, true));
        assert!(AssistantAction::ReleaseHost.applies(&checks, true));
        assert!(!AssistantAction::ReleaseHost.applies(&checks, false));
        assert!(AssistantAction::RunAnalysis.applies(&[], false));
    }

    #[test]
    fn a_domain_label_resolves_to_its_only_failing_check() {
        const DOMAINS: &[(&str, &[&str])] = &[
            ("Pare-feu", &["firewall_active"]),
            ("Mises à jour", &["update_status", "patches_current"]),
            (
                "Chiffrement et démarrage",
                &["disk_encryption", "secure_boot"],
            ),
        ];
        let checks = vec![
            check("firewall_active", "fail"),
            check("update_status", "pass"),
            check("patches_current", "fail"),
            check("disk_encryption", "fail"),
            check("secure_boot", "error"),
        ];
        let remediate = |id: &str| AssistantAction::Remediate {
            check_id: id.to_string(),
        };

        // What the local model actually wrote: the domain, not the identifier.
        let (_, action) = split_action("Constat.\nACTION: corriger:[pare-feu]");
        assert_eq!(
            action.unwrap().resolved(&checks, DOMAINS),
            remediate("firewall_active")
        );
        assert_eq!(
            remediate("Mises à jour").resolved(&checks, DOMAINS),
            remediate("patches_current"),
            "the one failing check of the domain"
        );
        // Two failing checks: no guess.
        assert_eq!(
            remediate("chiffrement et demarrage").resolved(&checks, DOMAINS),
            remediate("chiffrement et demarrage")
        );
        // A real identifier and an unknown name are left alone.
        assert_eq!(
            remediate("disk_encryption").resolved(&checks, DOMAINS),
            remediate("disk_encryption")
        );
        let invented = remediate("CVE-2024-3094").resolved(&checks, DOMAINS);
        assert_eq!(invented, remediate("CVE-2024-3094"));
        assert!(!invented.applies(&checks, false));
        assert_eq!(
            AssistantAction::RunAnalysis.resolved(&checks, DOMAINS),
            AssistantAction::RunAnalysis
        );
    }

    #[test]
    fn each_action_maps_to_its_command_and_wording() {
        let checks = vec![check("firewall_active", "fail")];
        let remediate = AssistantAction::Remediate {
            check_id: "firewall_active".to_string(),
        };
        assert_eq!(
            remediate.label(&checks),
            "Corriger : Nom de firewall_active"
        );
        assert!(matches!(
            remediate.command(),
            GuiCommand::Remediate { check_id } if check_id == "firewall_active"
        ));
        assert!(remediate.is_disruptive());

        assert!(matches!(
            AssistantAction::RunAnalysis.command(),
            GuiCommand::RunCheck
        ));
        assert!(matches!(
            AssistantAction::IsolateHost.command(),
            GuiCommand::IsolateHost { duration_secs: 0 }
        ));
        assert!(AssistantAction::IsolateHost.is_disruptive());
        assert!(!AssistantAction::ExportSbom.is_disruptive());
        assert!(matches!(
            AssistantAction::ReleaseHost.command(),
            GuiCommand::ReleaseHost
        ));
    }

    #[test]
    fn every_action_is_documented_in_the_prompt() {
        for code in [
            "lancer_analyse",
            "decouverte_reseau",
            "exporter_sbom",
            "corriger:",
            "isoler_poste",
            "lever_isolation",
        ] {
            assert!(PROMPT_INSTRUCTIONS.contains(code), "{code}");
        }
    }
}
