// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! French descriptions of the risks raised by failing checks.
//!
//! The scanner's messages are English ("System updates issues: 9 security
//! update(s) pending installation") and used to interpolate placeholders
//! ("None issues: AV not enabled"). The description of a risk is written
//! here in French from the check's structured data (its proof), counts and
//! lists included. The scanner's own message stays in the check result.

use agent_scanner::check::product_name;
use serde_json::Value;

/// French description of the risk raised by a failing check. A built-in
/// check is described from its data only; a check the organisation wrote
/// (custom, SCA policy) keeps its author's message after the French
/// sentence. A placeholder ("None", "none", "Unknown", empty) is never
/// interpolated.
pub(crate) fn french_risk_description(
    check_id: &str,
    display_name: &str,
    details: &Value,
    message: Option<&str>,
) -> String {
    let mut text = format!("Le contrôle « {display_name} » est non conforme sur ce poste.");
    let finding = builtin_finding(check_id, details);
    match finding {
        Some(Some(finding)) => {
            text.push(' ');
            text.push_str(&finding);
        }
        Some(None) => text.push_str(" Le détail figure dans la preuve technique du contrôle."),
        None => {
            if let Some(message) = message.map(str::trim).filter(|m| !m.is_empty()) {
                text.push_str(" Constat : ");
                text.push_str(message);
            }
        }
    }
    text
}

/// `None` for a check that is not built in; `Some(None)` for a built-in
/// check whose data says nothing more precise.
fn builtin_finding(check_id: &str, d: &Value) -> Option<Option<String>> {
    let finding = match check_id {
        "antivirus_active" => antivirus(d),
        "firewall_active" => firewall(d),
        "disk_encryption" => disk_encryption(d),
        "audit_logging" => audit_logging(d),
        "certificate_validation" => certificates(d),
        "container_security" => containers(d),
        "kernel_hardening" => kernel_hardening(d),
        "linux_hardening" => linux_hardening(d),
        "windows_hardening" => windows_hardening(d),
        "secure_boot" => secure_boot(d),
        "mfa_enabled" => mfa(d),
        "obsolete_protocols" => obsolete_protocols(d),
        "password_policy" => password_policy(d),
        "remote_access_secure" => remote_access(d),
        "ssh_hardening" => ssh_hardening(d),
        "patches_current" => system_updates(d),
        "update_status" => update_status(d),
        "gpo_password_policy" => gpo_password_policy(d),
        "gpo_account_lockout" => gpo_lockout(d),
        "gpo_audit_policy" => gpo_audit(d),
        "privileged_groups" => privileged_groups(d),
        "ldap_security" => ldap(d),
        _ if crate::risk_generation::french_check_name(check_id).is_some() => None,
        _ => return None,
    };
    Some(finding)
}

// ── Reading the proof ─────────────────────────────────────────────────

fn flag(d: &Value, field: &str) -> Option<bool> {
    d.get(field)?.as_bool()
}

fn count(d: &Value, field: &str) -> u64 {
    d.get(field).and_then(Value::as_u64).unwrap_or(0)
}

fn number(d: &Value, field: &str) -> Option<u64> {
    d.get(field)?.as_u64()
}

fn name<'a>(d: &'a Value, field: &str) -> Option<&'a str> {
    d.get(field)?.as_str().and_then(product_name)
}

fn list_len(d: &Value, field: &str) -> usize {
    d.get(field).and_then(Value::as_array).map_or(0, Vec::len)
}

/// "Title : a, b, c." or `None` when nothing is wrong.
fn sentence(title: &str, parts: Vec<String>) -> Option<String> {
    (!parts.is_empty()).then(|| format!("{title} : {}.", parts.join(", ")))
}

fn plural(n: u64, singular: &str, plural: &str) -> String {
    format!("{n} {}", if n > 1 { plural } else { singular })
}

// ── One description per built-in check ────────────────────────────────

fn antivirus(d: &Value) -> Option<String> {
    let enabled = flag(d, "enabled")?;
    let Some(product) = name(d, "av_name") else {
        return Some("Aucun antivirus n'a été détecté.".to_string());
    };
    let mut parts = Vec::new();
    if !enabled {
        parts.push("désactivé".to_string());
    }
    if flag(d, "real_time_protection") == Some(false) {
        parts.push("protection en temps réel désactivée".to_string());
    }
    if flag(d, "definitions_current") == Some(false) {
        parts.push("signatures de plus de 7 jours".to_string());
    }
    sentence(&format!("Antivirus {product}"), parts)
}

fn firewall(d: &Value) -> Option<String> {
    flag(d, "enabled")?;
    Some(match name(d, "firewall_type") {
        Some(kind) => format!("Le pare-feu {kind} n'est pas activé."),
        None => "Aucun pare-feu actif n'a été détecté.".to_string(),
    })
}

fn disk_encryption(d: &Value) -> Option<String> {
    flag(d, "enabled")?;
    Some(match name(d, "encryption_type") {
        Some(kind) => format!("Le chiffrement {kind} n'est pas activé."),
        None => "Le chiffrement du disque n'est pas activé.".to_string(),
    })
}

fn audit_logging(d: &Value) -> Option<String> {
    let enabled = flag(d, "enabled")?;
    let Some(system) = name(d, "audit_system") else {
        return Some("Aucun système de journalisation d'audit n'a été détecté.".to_string());
    };
    let mut parts = Vec::new();
    if !enabled {
        parts.push("journalisation désactivée".to_string());
    }
    if flag(d, "service_running") == Some(false) {
        parts.push("service arrêté".to_string());
    }
    if flag(d, "config_exists") == Some(false) {
        parts.push("configuration absente".to_string());
    }
    sentence(&format!("Journalisation d'audit ({system})"), parts)
}

fn certificates(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    for (field, singular, several) in [
        ("expired_count", "certificat expiré", "certificats expirés"),
        (
            "expiring_soon_count",
            "certificat expirant bientôt",
            "certificats expirant bientôt",
        ),
        (
            "weak_algorithm_count",
            "certificat à signature faible",
            "certificats à signature faible",
        ),
        (
            "self_signed_count",
            "certificat auto-signé",
            "certificats auto-signés",
        ),
        (
            "untrusted_root_count",
            "racine non approuvée",
            "racines non approuvées",
        ),
    ] {
        let n = count(d, field);
        if n > 0 {
            parts.push(plural(n, singular, several));
        }
    }
    let total = count(d, "total_certificates");
    sentence(&format!("Certificats ({total} examinés)"), parts)
}

fn containers(d: &Value) -> Option<String> {
    let runtime = name(d, "runtime").unwrap_or("moteur de conteneurs");
    let mut parts = Vec::new();
    if flag(d, "seccomp_enabled") == Some(false) {
        parts.push("seccomp désactivé".to_string());
    }
    if flag(d, "apparmor_enabled") == Some(false) && flag(d, "selinux_enabled") == Some(false) {
        parts.push("ni AppArmor ni SELinux".to_string());
    }
    if flag(d, "content_trust_enabled") == Some(false) {
        parts.push("signature des images désactivée".to_string());
    }
    if flag(d, "icc_disabled") == Some(false) {
        parts.push("communication libre entre conteneurs".to_string());
    }
    for (field, singular, several) in [
        (
            "privileged_containers",
            "conteneur privilégié",
            "conteneurs privilégiés",
        ),
        (
            "root_containers",
            "conteneur exécuté en root",
            "conteneurs exécutés en root",
        ),
        (
            "unlimited_containers",
            "conteneur sans limite de ressources",
            "conteneurs sans limite de ressources",
        ),
    ] {
        let n = list_len(d, field) as u64;
        if n > 0 {
            parts.push(plural(n, singular, several));
        }
    }
    sentence(&format!("Conteneurs ({runtime})"), parts)
}

fn kernel_hardening(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    if flag(d, "aslr_enabled") == Some(false) {
        parts.push("ASLR désactivé".to_string());
    }
    if flag(d, "ip_forward_disabled") == Some(false) {
        parts.push("routage IP activé".to_string());
    }
    for (field, text) in [
        ("dmesg_restricted", "journal du noyau lisible par tous"),
        ("kptr_restricted", "adresses du noyau exposées"),
        ("dep_available", "DEP indisponible"),
        ("sip_enabled", "SIP désactivé"),
        ("gatekeeper_enabled", "Gatekeeper désactivé"),
    ] {
        if flag(d, field) == Some(false) {
            parts.push(text.to_string());
        }
    }
    sentence("Durcissement du noyau", parts)
}

fn hardening_score(d: &Value) -> Option<String> {
    let total = number(d, "total_checks")?;
    let passed = count(d, "passed_checks");
    let mut text = format!("{passed} réglage(s) conformes sur {total}");
    let critical = list_len(d, "critical_issues") as u64;
    if critical > 0 {
        text.push_str(&format!(
            ", dont {} en écart",
            plural(critical, "point critique", "points critiques")
        ));
    }
    Some(text)
}

fn linux_hardening(d: &Value) -> Option<String> {
    let mut parts: Vec<String> = hardening_score(d).into_iter().collect();
    let off: Vec<&str> = d
        .get("sysctl_settings")
        .and_then(Value::as_array)
        .map(|settings| {
            settings
                .iter()
                .filter(|s| flag(s, "compliant") == Some(false))
                .filter_map(|s| s.get("path").or(s.get("name"))?.as_str())
                .take(5)
                .collect()
        })
        .unwrap_or_default();
    if !off.is_empty() {
        parts.push(format!("paramètres en écart : {}", off.join(", ")));
    }
    if let Some(module) = d.get("security_module")
        && flag(module, "apparmor_enabled") == Some(false)
        && flag(module, "selinux_enabled") == Some(false)
    {
        parts.push("ni AppArmor ni SELinux actif".to_string());
    }
    if flag(d, "core_dumps_disabled") == Some(false) {
        parts.push("vidages mémoire autorisés".to_string());
    }
    if flag(d, "ptrace_restricted") == Some(false) {
        parts.push("ptrace sans restriction".to_string());
    }
    if parts.len() > 1 {
        let first = parts.remove(0);
        return Some(format!(
            "Durcissement Linux : {first} ; {}.",
            parts.join(", ")
        ));
    }
    sentence("Durcissement Linux", parts)
}

fn windows_hardening(d: &Value) -> Option<String> {
    sentence(
        "Durcissement Windows",
        hardening_score(d).into_iter().collect(),
    )
}

fn secure_boot(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    if flag(d, "uefi_mode") == Some(false) {
        parts.push("démarrage en mode BIOS hérité".to_string());
    }
    if flag(d, "enabled") == Some(false) {
        parts.push("Secure Boot désactivé".to_string());
    }
    if flag(d, "setup_mode") == Some(true) {
        parts.push("micrologiciel en mode configuration".to_string());
    }
    if flag(d, "platform_key_installed") == Some(false) {
        parts.push("clé de plateforme absente".to_string());
    }
    sentence("Démarrage sécurisé", parts)
}

fn mfa(d: &Value) -> Option<String> {
    if flag(d, "mfa_configured") == Some(false) {
        return Some("Aucune méthode d'authentification multifacteur n'est en place.".to_string());
    }
    if flag(d, "mfa_enforced") == Some(false) {
        return Some(match name(d, "mfa_provider") {
            Some(provider) => {
                format!("L'authentification multifacteur ({provider}) n'est pas imposée.")
            }
            None => "L'authentification multifacteur n'est pas imposée.".to_string(),
        });
    }
    None
}

fn obsolete_protocols(d: &Value) -> Option<String> {
    let mut parts: Vec<String> = d
        .get("obsolete_enabled")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(Value::as_str)
                .filter_map(product_name)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    if flag(d, "weak_ciphers_enabled") == Some(true) {
        parts.push("suites de chiffrement faibles".to_string());
    }
    sentence("Protocoles obsolètes actifs", parts)
}

fn password_policy(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    match number(d, "min_length") {
        None => parts.push("longueur minimale non définie".to_string()),
        Some(n) if n < 12 => parts.push(format!("longueur minimale de {n} caractères (12 exigés)")),
        Some(_) => {}
    }
    match flag(d, "complexity_required") {
        None => parts.push("complexité non définie".to_string()),
        Some(false) => parts.push("complexité non exigée".to_string()),
        Some(true) => {}
    }
    sentence("Politique de mot de passe", parts)
}

fn remote_access(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    if let Some(ssh) = d.get("ssh_config").filter(|v| !v.is_null()) {
        if flag(ssh, "permit_root_login") == Some(true) {
            parts.push("connexion SSH de root autorisée".to_string());
        }
        if flag(ssh, "password_auth") == Some(true) {
            parts.push("authentification SSH par mot de passe".to_string());
        }
    }
    if let Some(rdp) = d
        .get("rdp_config")
        .filter(|v| flag(v, "enabled") == Some(true))
    {
        if flag(rdp, "nla_required") == Some(false) {
            parts.push("bureau à distance sans authentification réseau (NLA)".to_string());
        }
        if flag(rdp, "high_encryption") == Some(false) {
            parts.push("bureau à distance sans chiffrement élevé".to_string());
        }
    }
    if flag(d, "screen_sharing_enabled") == Some(true) {
        parts.push("partage d'écran actif".to_string());
    }
    if flag(d, "remote_management_enabled") == Some(true) {
        parts.push("gestion à distance active".to_string());
    }
    sentence("Accès distant", parts)
}

fn ssh_hardening(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    for (field, text) in [
        ("root_login_disabled", "connexion de root autorisée"),
        (
            "password_auth_disabled",
            "authentification par mot de passe autorisée",
        ),
        ("protocol_v2_only", "protocole SSH 1 accepté"),
        ("x11_forwarding_disabled", "redirection X11 autorisée"),
        ("weak_ciphers_disabled", "chiffrements faibles acceptés"),
        (
            "weak_macs_disabled",
            "codes d'intégrité (MAC) faibles acceptés",
        ),
    ] {
        if flag(d, field) == Some(false) {
            parts.push(text.to_string());
        }
    }
    if let Some(tries) = number(d, "max_auth_tries").filter(|n| *n > 4) {
        parts.push(format!("{tries} tentatives d'authentification permises"));
    }
    sentence("Serveur SSH", parts)
}

fn system_updates(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    let security = count(d, "pending_security_updates");
    if security > 0 {
        parts.push(plural(
            security,
            "mise à jour de sécurité en attente d'installation",
            "mises à jour de sécurité en attente d'installation",
        ));
    }
    let all = count(d, "pending_updates_count").max(count(d, "upgradable_packages"));
    if all > security {
        parts.push(format!("{all} paquet(s) à mettre à jour au total"));
    }
    if flag(d, "auto_updates_enabled") == Some(false) {
        parts.push("mises à jour automatiques désactivées".to_string());
    }
    if let Some(days) = d.get("days_since_check").and_then(Value::as_i64)
        && days > 7
    {
        parts.push(format!("dernière recherche il y a {days} jours"));
    }
    sentence("Mises à jour du système", parts)
}

fn update_status(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    let total = count(d, "total_pending_count");
    if total > 0 {
        let mut text = plural(total, "mise à jour en attente", "mises à jour en attente");
        let critical = count(d, "critical_pending_count");
        let important = count(d, "important_pending_count");
        if critical + important > 0 {
            text.push_str(&format!(
                " (dont {critical} critique(s) et {important} importante(s))"
            ));
        }
        parts.push(text);
    }
    if flag(d, "reboot_required") == Some(true) {
        parts.push("redémarrage requis".to_string());
    }
    if let Some(days) = d.get("days_since_last_update").and_then(Value::as_i64)
        && days > 30
    {
        parts.push(format!("dernière installation il y a {days} jours"));
    }
    if d.get("service_status")
        .is_some_and(|s| flag(s, "service_running") == Some(false))
    {
        parts.push("service de mise à jour arrêté".to_string());
    }
    sentence("État des mises à jour", parts)
}

fn score(d: &Value) -> Option<String> {
    let score = d.get("compliance_score")?.as_f64()?;
    Some(format!("conformité de {score:.0} %"))
}

fn gpo_password_policy(d: &Value) -> Option<String> {
    let mut parts: Vec<String> = score(d).into_iter().collect();
    if let Some(n) = number(d, "min_length").filter(|n| *n < 14) {
        parts.push(format!("longueur minimale {n} (14 attendus)"));
    }
    if flag(d, "complexity_required") == Some(false) {
        parts.push("complexité non exigée".to_string());
    }
    if let Some(n) = number(d, "history_count").filter(|n| *n < 24) {
        parts.push(format!("historique de {n} mots de passe (24 attendus)"));
    }
    if let Some(n) = number(d, "max_age_days").filter(|n| *n == 0 || *n > 90) {
        parts.push(format!("durée de validité de {n} jours (90 au plus)"));
    }
    sentence("Stratégie de mot de passe", parts)
}

fn gpo_lockout(d: &Value) -> Option<String> {
    let mut parts: Vec<String> = score(d).into_iter().collect();
    match number(d, "lockout_threshold") {
        Some(0) => parts.push("aucun verrouillage après échecs".to_string()),
        Some(n) => parts.push(format!("verrouillage après {n} échecs")),
        None => {}
    }
    if let Some(n) = number(d, "lockout_duration_minutes") {
        parts.push(format!("durée de verrouillage {n} min"));
    }
    sentence("Stratégie de verrouillage des comptes", parts)
}

fn gpo_audit(d: &Value) -> Option<String> {
    let mut parts: Vec<String> = score(d).into_iter().collect();
    let silent: Vec<&str> = [
        ("logon_events", "ouvertures de session"),
        ("account_logon", "authentifications"),
        ("account_management", "gestion des comptes"),
        ("privilege_use", "utilisation des privilèges"),
        ("policy_change", "modifications de stratégie"),
        ("system_events", "événements système"),
    ]
    .into_iter()
    .filter(|(field, _)| d.get(*field).and_then(Value::as_str) == Some("NoAuditing"))
    .map(|(_, label)| label)
    .collect();
    if !silent.is_empty() {
        parts.push(format!("non auditées : {}", silent.join(", ")));
    }
    sentence("Stratégie d'audit", parts)
}

fn privileged_groups(d: &Value) -> Option<String> {
    let users = number(d, "total_privileged_users")?;
    let mut text = format!(
        "Groupes privilégiés : {}",
        plural(users, "compte membre", "comptes membres")
    );
    let crowded: Vec<String> = d
        .get("groups")
        .and_then(Value::as_array)
        .map(|groups| {
            groups
                .iter()
                .filter(|g| flag(g, "exceeds_threshold") == Some(true))
                .filter_map(|g| {
                    Some(format!(
                        "{} ({})",
                        name(g, "name")?,
                        g.get("member_count")?.as_u64()?
                    ))
                })
                .collect()
        })
        .unwrap_or_default();
    if !crowded.is_empty() {
        text.push_str(&format!(", groupes trop fournis : {}", crowded.join(", ")));
    }
    text.push('.');
    Some(text)
}

fn ldap(d: &Value) -> Option<String> {
    let mut parts = Vec::new();
    if flag(d, "uses_tls") == Some(false) {
        parts.push("connexions sans TLS".to_string());
    }
    if flag(d, "allows_anonymous_bind") == Some(true) {
        parts.push("liaison anonyme autorisée".to_string());
    }
    if flag(d, "has_password_policy") == Some(false) {
        parts.push("pas de politique de mots de passe".to_string());
    }
    if flag(d, "weak_ciphers_enabled") == Some(true) {
        parts.push("chiffrements faibles acceptés".to_string());
    }
    sentence("Annuaire LDAP", parts)
}

#[cfg(test)]
mod tests {
    use super::french_risk_description;
    use agent_common::types::CheckSeverity;
    use serde_json::{Value, json};

    /// A failing proof of each built-in check that can raise a risk (High
    /// or Critical), shaped like the check's status.
    fn failing_proof(check_id: &str) -> Option<Value> {
        Some(match check_id {
            "antivirus_active" => json!({"enabled": false, "av_name": "None",
                "real_time_protection": false, "definitions_current": false}),
            "firewall_active" => json!({"enabled": false, "firewall_type": "none"}),
            "disk_encryption" => json!({"enabled": false, "encryption_type": "LUKS",
                "protection_status": "Off"}),
            "audit_logging" => json!({"enabled": false, "audit_system": "auditd",
                "service_running": false, "config_exists": false}),
            "certificate_validation" => json!({"healthy": false, "total_certificates": 140,
                "expired_count": 2, "weak_algorithm_count": 1, "issues":
                ["1 certificate(s) using weak signature algorithm found"]}),
            "container_security" => json!({"runtime": "docker", "seccomp_enabled": false,
                "apparmor_enabled": false, "selinux_enabled": false,
                "content_trust_enabled": false, "icc_disabled": false,
                "privileged_containers": ["web"], "root_containers": ["web", "db"],
                "unlimited_containers": []}),
            "kernel_hardening" => json!({"hardened": false, "aslr_enabled": false,
                "ip_forward_disabled": false, "dmesg_restricted": false,
                "kptr_restricted": false}),
            "linux_hardening" => json!({"compliant": false, "total_checks": 24,
                "passed_checks": 14, "failed_checks": 10,
                "critical_issues": ["kernel.randomize_va_space is not set"],
                "sysctl_settings": [{"name": "ASLR", "path": "kernel.randomize_va_space",
                    "compliant": false}],
                "security_module": {"apparmor_enabled": false, "selinux_enabled": false},
                "core_dumps_disabled": false, "ptrace_restricted": false}),
            "windows_hardening" => json!({"compliant": false, "total_checks": 30,
                "passed_checks": 20, "critical_issues": ["SMB signing not required"]}),
            "secure_boot" => json!({"enabled": false, "uefi_mode": false,
                "setup_mode": true, "platform_key_installed": false}),
            "mfa_enabled" => json!({"mfa_configured": false, "mfa_enforced": false,
                "issues": ["No MFA method configured"]}),
            "obsolete_protocols" => json!({"obsolete_enabled": ["SMBv1", "TLS 1.0"],
                "weak_ciphers_enabled": true}),
            "password_policy" => json!({"min_length": null, "complexity_required": null,
                "issues": ["Minimum password length not configured"]}),
            "remote_access_secure" => json!({"ssh_config": {"enabled": true,
                "permit_root_login": true, "password_auth": true},
                "rdp_config": {"enabled": true, "nla_required": false,
                "high_encryption": false}, "screen_sharing_enabled": true}),
            "ssh_hardening" => json!({"ssh_server_active": true,
                "root_login_disabled": false, "password_auth_disabled": false,
                "protocol_v2_only": false, "x11_forwarding_disabled": false,
                "weak_ciphers_disabled": false, "weak_macs_disabled": false,
                "max_auth_tries": 6}),
            "patches_current" => json!({"up_to_date": false, "pending_updates_count": 21,
                "pending_security_updates": 9, "auto_updates_enabled": false,
                "days_since_check": 12}),
            "update_status" => json!({"total_pending_count": 21,
                "critical_pending_count": 2, "important_pending_count": 5,
                "reboot_required": true, "days_since_last_update": 45,
                "service_status": {"service_running": false}}),
            "gpo_password_policy" => json!({"compliance_score": 25.0, "min_length": 8,
                "complexity_required": false, "history_count": 0, "max_age_days": 0}),
            "gpo_account_lockout" => json!({"compliance_score": 0.0,
                "lockout_threshold": 0, "lockout_duration_minutes": 0}),
            "gpo_audit_policy" => json!({"compliance_score": 0.0,
                "logon_events": "NoAuditing", "privilege_use": "NoAuditing"}),
            "privileged_groups" => json!({"total_privileged_users": 7, "groups":
                [{"name": "Administrators", "member_count": 7, "exceeds_threshold": true}]}),
            "ldap_security" => json!({"uses_tls": false, "allows_anonymous_bind": true,
                "has_password_policy": false, "weak_ciphers_enabled": true}),
            _ => return None,
        })
    }

    /// English words of the scanner's messages that must not reach a risk.
    const ENGLISH_MARKERS: [&str; 7] = [
        "issues",
        "not ",
        "found",
        "pending",
        "configured",
        "None",
        "enabled",
    ];

    fn assert_french(check_id: &str, text: &str) {
        for marker in ENGLISH_MARKERS {
            assert!(
                !text.contains(marker),
                "{check_id}: « {marker} » in « {text} »"
            );
        }
    }

    /// Every built-in check that can raise a risk is described in French,
    /// from a failing proof, from an empty one, and whatever the scanner's
    /// message says.
    #[test]
    fn every_builtin_risk_is_described_in_french() {
        let mut registry = agent_scanner::CheckRegistry::new();
        crate::register_builtin_checks(&mut registry);
        let scanner_message = "Update issues: 21 updates pending; MFA not configured; \
                               1 certificate(s) found";
        let mut described = 0;
        for check in registry.all() {
            let def = check.definition();
            if !matches!(def.severity, CheckSeverity::Critical | CheckSeverity::High) {
                continue;
            }
            let label = crate::risk_generation::french_check_name(&def.id)
                .unwrap_or_else(|| panic!("{}: no French label", def.id));
            let proof = failing_proof(&def.id)
                .unwrap_or_else(|| panic!("{}: add a failing proof to this test", def.id));

            let text = french_risk_description(&def.id, label, &proof, Some(scanner_message));
            assert_french(&def.id, &text);
            assert!(
                text.len()
                    > format!("Le contrôle « {label} » est non conforme sur ce poste.").len() + 10,
                "{}: nothing said about the finding: {text}",
                def.id
            );

            let empty =
                french_risk_description(&def.id, label, &Value::Null, Some(scanner_message));
            assert_french(&def.id, &empty);
            described += 1;
        }
        assert!(described >= 20, "only {described} checks raise risks");
    }

    #[test]
    fn counts_and_lists_are_written_out() {
        let update = french_risk_description(
            "patches_current",
            "Correctifs à jour",
            &failing_proof("patches_current").unwrap(),
            None,
        );
        assert_eq!(
            update,
            "Le contrôle « Correctifs à jour » est non conforme sur ce poste. \
             Mises à jour du système : 9 mises à jour de sécurité en attente d'installation, \
             21 paquet(s) à mettre à jour au total, mises à jour automatiques désactivées, \
             dernière recherche il y a 12 jours."
        );
        let linux = french_risk_description(
            "linux_hardening",
            "Durcissement Linux",
            &failing_proof("linux_hardening").unwrap(),
            None,
        );
        assert!(linux.contains(
            "Durcissement Linux : 14 réglage(s) conformes sur 24, dont 1 point critique en écart ; \
             paramètres en écart : kernel.randomize_va_space"
        ));
    }

    #[test]
    fn placeholders_are_never_written() {
        let text = french_risk_description(
            "antivirus_active",
            "Antivirus actif",
            &failing_proof("antivirus_active").unwrap(),
            Some("None issues: AV not enabled"),
        );
        assert!(text.ends_with("Aucun antivirus n'a été détecté."));
        let text = french_risk_description(
            "firewall_active",
            "Pare-feu actif",
            &failing_proof("firewall_active").unwrap(),
            Some("none is not enabled"),
        );
        assert!(text.ends_with("Aucun pare-feu actif n'a été détecté."));
        let ufw = json!({ "enabled": false, "firewall_type": "ufw" });
        assert!(
            french_risk_description("firewall_active", "Pare-feu actif", &ufw, None)
                .ends_with("Le pare-feu ufw n'est pas activé.")
        );
    }

    #[test]
    fn an_organisation_check_keeps_its_authors_message() {
        assert_eq!(
            french_risk_description(
                "custom_vpn",
                "custom_vpn",
                &Value::Null,
                Some("Le VPN de l'entreprise n'est pas installé")
            ),
            "Le contrôle « custom_vpn » est non conforme sur ce poste. \
             Constat : Le VPN de l'entreprise n'est pas installé"
        );
    }
}
