// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What the operator reads when a response action fails.
//!
//! The agent reports these failures in English, in the words its logs and
//! the platform use. The interface is in French: the known refusals and
//! failures are said in French here, and the technical cause, when there
//! is one, is kept after them.

/// A known failure: what to look for in the agent's message, what to say,
/// and whether the technical cause that follows is worth showing.
struct Known {
    needle: &'static str,
    french: &'static str,
    keep_cause: bool,
}

const fn refusal(needle: &'static str, french: &'static str) -> Known {
    Known {
        needle,
        french,
        keep_cause: false,
    }
}

const fn failure(needle: &'static str, french: &'static str) -> Known {
    Known {
        needle,
        french,
        keep_cause: true,
    }
}

/// Most specific first: the first needle found wins.
const KNOWN: &[Known] = &[
    // Processes
    refusal(
        "Cannot confirm what PID",
        "Impossible de v\u{e9}rifier l'identit\u{e9} du processus\u{a0}: aucun nom n'a \u{e9}t\u{e9} fourni.",
    ),
    refusal(
        "is no longer running",
        "Le processus n'est plus en cours d'ex\u{e9}cution.",
    ),
    refusal(
        "its PID was reused",
        "Le processus d\u{e9}tect\u{e9} s'est termin\u{e9} et son PID a \u{e9}t\u{e9} r\u{e9}utilis\u{e9}\u{a0}: rien n'a \u{e9}t\u{e9} arr\u{ea}t\u{e9}.",
    ),
    refusal(
        ": not terminated",
        "Le processus ne correspond plus \u{e0} celui d\u{e9}tect\u{e9}\u{a0}: il n'a pas \u{e9}t\u{e9} arr\u{ea}t\u{e9}.",
    ),
    refusal(
        "is reserved and cannot be terminated",
        "Ce processus est r\u{e9}serv\u{e9} au syst\u{e8}me et ne peut pas \u{ea}tre arr\u{ea}t\u{e9}.",
    ),
    refusal(
        "Cannot terminate the Sentinel Agent",
        "L'agent Sentinel ne peut pas s'arr\u{ea}ter lui-m\u{ea}me.",
    ),
    failure(
        "kill failed",
        "L'arr\u{ea}t du processus a \u{e9}chou\u{e9}",
    ),
    failure(
        "Failed to execute",
        "La commande syst\u{e8}me n'a pas pu \u{ea}tre lanc\u{e9}e",
    ),
    // Quarantine
    refusal("File not found", "Fichier introuvable."),
    refusal(
        "refusing to quarantine protected path",
        "Ce chemin appartient \u{e0} l'agent ou au syst\u{e8}me\u{a0}: la mise en quarantaine est refus\u{e9}e.",
    ),
    refusal(
        "not a regular file",
        "Seuls les fichiers ordinaires peuvent \u{ea}tre mis en quarantaine.",
    ),
    failure(
        "Failed to quarantine file",
        "La mise en quarantaine a \u{e9}chou\u{e9}",
    ),
    failure(
        "Failed to resolve path",
        "Le fichier n'a pas pu \u{ea}tre lu",
    ),
    failure("Failed to inspect", "Le fichier n'a pas pu \u{ea}tre lu"),
    failure(
        "Failed to create quarantine dir",
        "Le dossier de quarantaine n'a pas pu \u{ea}tre cr\u{e9}\u{e9}",
    ),
    failure(
        "Failed to write quarantine metadata",
        "Le dossier de quarantaine n'est pas accessible en \u{e9}criture",
    ),
    refusal(
        "Invalid quarantine ID",
        "Identifiant de quarantaine invalide.",
    ),
    refusal(
        "Quarantined file not found",
        "Ce fichier n'est plus en quarantaine.",
    ),
    refusal(
        "quarantine metadata",
        "Les informations de quarantaine de ce fichier sont illisibles\u{a0}: son emplacement d'origine est inconnu.",
    ),
    refusal(
        "Missing original_path",
        "Les informations de quarantaine de ce fichier sont incompl\u{e8}tes\u{a0}: son emplacement d'origine est inconnu.",
    ),
    refusal(
        "destination cannot be resolved",
        "L'emplacement d'origine n'existe plus\u{a0}: restauration refus\u{e9}e.",
    ),
    refusal(
        "Refusing to restore file to system-critical",
        "L'emplacement d'origine appartient \u{e0} l'agent ou au syst\u{e8}me\u{a0}: restauration refus\u{e9}e.",
    ),
    failure(
        "Failed to restore file",
        "La restauration a \u{e9}chou\u{e9}",
    ),
    // Addresses
    refusal(
        "Cannot block localhost",
        "L'adresse locale du poste ne peut pas \u{ea}tre bloqu\u{e9}e.",
    ),
    refusal(
        "Cannot block the backend API server",
        "L'adresse de la plateforme Sentinel ne peut pas \u{ea}tre bloqu\u{e9}e\u{a0}: l'agent perdrait sa connexion.",
    ),
    refusal(
        "of this host",
        "Cette adresse est indispensable au r\u{e9}seau du poste (passerelle ou r\u{e9}solveur DNS)\u{a0}: blocage refus\u{e9}.",
    ),
    refusal("Invalid IP address", "Adresse IP invalide."),
    // Isolation
    refusal(
        "the platform address is not configured",
        "Isolement refus\u{e9}\u{a0}: l'adresse de la plateforme n'est pas configur\u{e9}e.",
    ),
    failure("Isolation refused", "Isolement refus\u{e9}"),
    failure(
        "Host isolation failed",
        "L'isolement du poste a \u{e9}chou\u{e9}",
    ),
    failure(
        "Isolation not lifted",
        "L'isolement n'a pas pu \u{ea}tre lev\u{e9}",
    ),
    // Privileges and firewall, whatever the action
    failure(
        "ermission denied",
        "Droits insuffisants\u{a0}: l'agent doit s'ex\u{e9}cuter avec les privil\u{e8}ges d'administration",
    ),
    failure(
        "not permitted",
        "Droits insuffisants\u{a0}: l'agent doit s'ex\u{e9}cuter avec les privil\u{e8}ges d'administration",
    ),
    failure(
        "Failed to apply",
        "La r\u{e8}gle de pare-feu n'a pas pu \u{ea}tre appliqu\u{e9}e",
    ),
    failure(
        "Failed to remove",
        "La r\u{e8}gle de pare-feu n'a pas pu \u{ea}tre retir\u{e9}e",
    ),
    failure(
        "unblock failed",
        "La r\u{e8}gle de pare-feu n'a pas pu \u{ea}tre retir\u{e9}e",
    ),
];

/// The failure of a response action, in French.
///
/// A message that is not known is shown as it came, introduced as a
/// technical error: better an English cause than none.
pub fn french(error: &str) -> String {
    let error = error
        .trim()
        .trim_start_matches("internal error: ")
        .trim_start_matches("Anti-Draper protection: ");
    let Some(known) = KNOWN.iter().find(|known| error.contains(known.needle)) else {
        return format!("Erreur technique\u{a0}: {error}");
    };
    if !known.keep_cause {
        return known.french.to_string();
    }
    // The cause is what follows the recognised words, when something does;
    // otherwise the whole message is the cause (e.g. "pfctl: permission
    // denied").
    let after = error
        .split_once(known.needle)
        .map(|(_, after)| after.trim_start_matches([':', ' ']).trim())
        .unwrap_or_default();
    let cause = if after.is_empty() { error } else { after };
    format!("{} ({cause}).", known.french)
}

#[cfg(test)]
mod tests {
    use super::french;

    #[test]
    fn refusals_of_the_agent_are_said_in_french() {
        assert_eq!(
            french("internal error: Anti-Draper protection: Cannot block localhost"),
            "L'adresse locale du poste ne peut pas \u{ea}tre bloqu\u{e9}e."
        );
        assert!(
            french("internal error: Refusing to quarantine '/etc': not a regular file")
                .starts_with("Seuls les fichiers ordinaires")
        );
        assert!(
            french("internal error: Quarantined file not found: 7c1e")
                .starts_with("Ce fichier n'est plus en quarantaine")
        );
        assert!(
            french("internal error: Process 'evil' (PID 42) is no longer running")
                .starts_with("Le processus n'est plus")
        );
        assert!(
            french(
                "internal error: Anti-Draper protection: Cannot block the default gateway of this host"
            )
            .contains("passerelle")
        );
    }

    #[test]
    fn failures_keep_their_technical_cause() {
        assert_eq!(
            french("internal error: Failed to restore file: No space left on device"),
            "La restauration a \u{e9}chou\u{e9} (No space left on device)."
        );
        let denied = french("pfctl: permission denied");
        assert!(denied.starts_with("Droits insuffisants"));
        assert!(denied.contains("pfctl: permission denied"));
    }

    #[test]
    fn an_unknown_failure_is_shown_as_it_came() {
        assert_eq!(
            french("internal error: something new"),
            "Erreur technique\u{a0}: something new"
        );
    }
}
