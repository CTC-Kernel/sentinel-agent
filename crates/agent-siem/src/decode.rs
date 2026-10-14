// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! From a log line to the fields detection rules are written against.
//!
//! A line of `auth.log` is text; a rule wants to count failed logins per
//! address. The decoders here recognise the lines of the programs that
//! matter for security and give them fields with fixed names, whatever the
//! system the line comes from.
//!
//! # Fields
//!
//! Every event has `message` (the text after the program name) and, when
//! known, `program`, `pid` and `hostname`. A recognised line also has:
//!
//! | Field         | Meaning                                                    |
//! |---------------|------------------------------------------------------------|
//! | `action`      | what happened (table below)                                |
//! | `user`        | the account that acted, or that tried to log in            |
//! | `target_user` | the account acted upon (`sudo -u`, `su`, a created account)|
//! | `src_ip`      | the remote address                                         |
//! | `src_port`    | the remote port                                            |
//! | `auth_method` | `password`, `publickey`…                                   |
//! | `command`     | the command run through sudo                               |
//! | `group`       | the group an account was added to                          |
//!
//! | `action`                                   | Lines                                  |
//! |--------------------------------------------|----------------------------------------|
//! | `login_failed`, `login_success`            | sshd, screensharingd                   |
//! | `invalid_user`, `max_auth_exceeded`        | sshd                                   |
//! | `disconnect_preauth`, `login_denied`       | sshd                                   |
//! | `auth_failure`, `session_opened`, `session_closed` | PAM, for any program           |
//! | `command`, `incorrect_password`            | sudo                                   |
//! | `not_in_sudoers`, `command_not_allowed`    | sudo                                   |
//! | `password_required`, `denied`              | sudo (with the `reason` it gave)       |
//! | `su_success`, `su_failed`                  | su                                     |
//! | `user_created`, `user_deleted`             | useradd, userdel                       |
//! | `group_created`, `group_member_added`      | groupadd, usermod, gpasswd             |
//! | `password_changed`                         | passwd, chpasswd                       |
//! | `firewall_block`, `firewall_log`           | kernel (iptables, nftables, ufw)       |
//! | `promiscuous_mode`                         | kernel                                 |
//!
//! Docker events (service `docker`) keep Docker's own action (`create`,
//! `start`, `exec_start`, `die`…) with `container`, `container_id`,
//! `image`, the `command` of an `exec`, and, for a start, the settings that
//! weaken the isolation of the container: `privileged`, `pid_mode`,
//! `network_mode`, `ipc_mode`, `userns_mode`, `cap_add`, `security_opt`,
//! `devices`, `host_paths` (the host paths mounted), `mounts_host_root`,
//! `mounts_docker_socket` and `container_user`.
//!
//! Web access logs take the field names Sigma gives the `webserver`
//! category (`c-ip`, `cs-method`, `c-uri`, `cs-uri-query`, `sc-status`,
//! `c-useragent`, `cs-referer`), audit records the names of auditd, Windows
//! events `EventID`, `Channel`, `Provider_Name` and the names of their data.
//!
//! A line no decoder recognises keeps its `message`: keyword rules still
//! apply to it.

use chrono::{DateTime, Datelike, Local, NaiveDateTime, TimeZone, Utc};
use regex::Regex;
use std::collections::HashMap;
use std::sync::LazyLock;

/// Longest value kept for one field.
const MAX_FIELD_CHARS: usize = 8 * 1024;
/// Fields kept at most from one JSON line.
const MAX_JSON_FIELDS: usize = 200;
/// Depth to which a JSON line is flattened.
const MAX_JSON_DEPTH: usize = 4;

/// A log event with its fields.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct DecodedLog {
    /// When the event happened, when the line says so.
    pub timestamp: Option<DateTime<Utc>>,
    /// The Sigma `service` names the event answers to (lower case).
    pub services: Vec<String>,
    /// The Sigma `category` names the event answers to.
    pub categories: Vec<String>,
    /// Field name (lower case) to value.
    pub fields: HashMap<String, String>,
}

impl DecodedLog {
    fn set(&mut self, name: &str, value: impl AsRef<str>) {
        let value = value.as_ref().trim();
        if value.is_empty() {
            return;
        }
        let value = match value.char_indices().nth(MAX_FIELD_CHARS) {
            Some((cut, _)) => &value[..cut],
            None => value,
        };
        self.fields
            .insert(name.to_ascii_lowercase(), value.to_string());
    }

    fn add_service(&mut self, service: &str) {
        let service = service.to_ascii_lowercase();
        if !service.is_empty() && !self.services.contains(&service) {
            self.services.push(service);
        }
    }

    /// The value of a field.
    pub fn get(&self, name: &str) -> Option<&str> {
        self.fields.get(name).map(String::as_str)
    }

    /// The program or channel the event comes from, for a report.
    pub fn source(&self) -> &str {
        self.get("program")
            .or_else(|| self.get("channel"))
            .or_else(|| self.services.first().map(String::as_str))
            .unwrap_or("log")
    }
}

fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("static pattern is valid")
}

/// Programs whose lines are authentication events (Sigma `service: auth`).
const AUTH_PROGRAMS: &[&str] = &[
    "sshd",
    "sudo",
    "su",
    "login",
    "systemd-logind",
    "passwd",
    "chpasswd",
    "useradd",
    "usermod",
    "userdel",
    "groupadd",
    "groupdel",
    "gpasswd",
    "polkitd",
    "gdm-password",
    "lightdm",
    "sddm-helper",
    "screensharingd",
    "loginwindow",
];

/// The name rules know a program by: no path, no version suffix, the
/// per-connection process of OpenSSH under the name of its daemon.
fn program_name(program: &str) -> String {
    let name = program
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(program)
        .trim()
        .to_ascii_lowercase();
    match name.as_str() {
        "sshd-session" | "sshd-auth" => "sshd".to_string(),
        "crond" | "cron" | "anacron" => "cron".to_string(),
        _ => name,
    }
}

static KEY_VALUE: LazyLock<Regex> =
    LazyLock::new(|| regex(r#"([A-Za-z_][A-Za-z0-9_\-]*)=("([^"]*)"|'([^']*)'|\S*)"#));

/// `key=value` pairs of a text, quotes removed.
fn key_values(text: &str) -> Vec<(String, String)> {
    KEY_VALUE
        .captures_iter(text)
        .map(|found| {
            let value = found
                .get(3)
                .or_else(|| found.get(4))
                .or_else(|| found.get(2))
                .map_or("", |m| m.as_str());
            (found[1].to_string(), value.to_string())
        })
        .collect()
}

fn is_address(value: &str) -> bool {
    value.parse::<std::net::IpAddr>().is_ok()
}

static PAM: LazyLock<Regex> = LazyLock::new(|| regex(r"^pam_\w+\(([^:)]+):(\w+)\): (.*)$"));
static PAM_SESSION: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^session (opened|closed) for user ([^\s(]+)"));
static PAM_PASSWORD: LazyLock<Regex> = LazyLock::new(|| regex(r"^password changed for (\S+)"));

/// PAM lines look the same under every program.
fn decode_pam(log: &mut DecodedLog, message: &str) -> bool {
    let Some(found) = PAM.captures(message) else {
        return false;
    };
    log.set("pam_service", &found[1]);
    let rest = &found[3];
    if rest.starts_with("authentication failure") {
        log.set("action", "auth_failure");
        for (key, value) in key_values(rest) {
            match key.as_str() {
                "user" => log.set("user", value),
                "ruser" => log.set("ruser", value),
                "tty" => log.set("tty", value),
                "rhost" if is_address(&value) => log.set("src_ip", value),
                "rhost" => log.set("rhost", value),
                _ => {}
            }
        }
        // `su` and `sudo`: the account asking is `ruser`, the one asked for `user`.
        if let (Some(asking), Some(asked)) = (
            log.get("ruser").map(str::to_string),
            log.get("user").map(str::to_string),
        ) && asking != asked
        {
            log.set("target_user", asked);
            log.set("user", asking);
        }
    } else if let Some(session) = PAM_SESSION.captures(rest) {
        log.set("action", format!("session_{}", &session[1]));
        log.set("user", &session[2]);
    } else if let Some(changed) = PAM_PASSWORD.captures(rest) {
        log.set("action", "password_changed");
        log.set("target_user", &changed[1]);
    }
    true
}

static SSHD_FAILED: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^Failed (\S+) for (invalid user )?(\S*) from (\S+) port (\d+)"));
static SSHD_ACCEPTED: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^Accepted (\S+) for (\S+) from (\S+) port (\d+)"));
static SSHD_INVALID: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^Invalid user (\S*) from (\S+)(?: port (\d+))?"));
static SSHD_PREAUTH: LazyLock<Regex> = LazyLock::new(|| {
    regex(
        r"^(?:Connection closed by|Disconnected from) (?:authenticating|invalid) user (\S*) (\S+) port (\d+) \[preauth\]",
    )
});
static SSHD_MAX_AUTH: LazyLock<Regex> = LazyLock::new(|| {
    regex(
        r"^(?:error: )?maximum authentication attempts exceeded for (?:invalid user )?(\S*) from (\S+) port (\d+)",
    )
});
static SSHD_DENIED: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^User (\S+) from (\S+) not allowed because"));

fn decode_sshd(log: &mut DecodedLog, message: &str) {
    if let Some(found) = SSHD_FAILED.captures(message) {
        log.set("action", "login_failed");
        log.set("auth_method", &found[1]);
        if found.get(2).is_some() {
            log.set("invalid_user", "true");
        }
        log.set("user", &found[3]);
        log.set("src_ip", &found[4]);
        log.set("src_port", &found[5]);
    } else if let Some(found) = SSHD_ACCEPTED.captures(message) {
        log.set("action", "login_success");
        log.set("auth_method", &found[1]);
        log.set("user", &found[2]);
        log.set("src_ip", &found[3]);
        log.set("src_port", &found[4]);
    } else if let Some(found) = SSHD_INVALID.captures(message) {
        log.set("action", "invalid_user");
        log.set("user", &found[1]);
        log.set("src_ip", &found[2]);
        if let Some(port) = found.get(3) {
            log.set("src_port", port.as_str());
        }
    } else if let Some(found) = SSHD_MAX_AUTH.captures(message) {
        log.set("action", "max_auth_exceeded");
        log.set("user", &found[1]);
        log.set("src_ip", &found[2]);
        log.set("src_port", &found[3]);
    } else if let Some(found) = SSHD_PREAUTH.captures(message) {
        log.set("action", "disconnect_preauth");
        log.set("user", &found[1]);
        log.set("src_ip", &found[2]);
        log.set("src_port", &found[3]);
    } else if let Some(found) = SSHD_DENIED.captures(message) {
        log.set("action", "login_denied");
        log.set("user", &found[1]);
        log.set("src_ip", &found[2]);
    }
}

static SUDO: LazyLock<Regex> = LazyLock::new(|| regex(r"^\s*(\S+) : (.+)$"));
static SUDO_ATTEMPTS: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^(\d+) incorrect password attempts?$"));

fn decode_sudo(log: &mut DecodedLog, message: &str) {
    let Some(found) = SUDO.captures(message) else {
        return;
    };
    let mut action = "command";
    let mut recognised = false;
    // `COMMAND=` is last and may itself hold " ; ".
    let (settings, command) = match found[2].split_once("COMMAND=") {
        Some((settings, command)) => (settings.to_string(), Some(command.to_string())),
        None => (found[2].to_string(), None),
    };
    for part in settings.split(" ; ").map(str::trim) {
        if let Some((key, value)) = part.split_once('=') {
            match key {
                "TTY" => log.set("tty", value),
                "PWD" => log.set("pwd", value),
                "USER" => log.set("target_user", value),
                "GROUP" => log.set("target_group", value),
                _ => continue,
            }
            recognised = true;
        } else if let Some(attempts) = SUDO_ATTEMPTS.captures(part) {
            action = "incorrect_password";
            log.set("attempts", &attempts[1]);
            recognised = true;
        } else if !part.is_empty() {
            // Anything else before the settings is why sudo refused.
            action = match part {
                "user NOT in sudoers" | "user NOT authorized on host" => "not_in_sudoers",
                "command not allowed" => "command_not_allowed",
                // `sudo -n` without a cached password: a script asking, not
                // someone guessing.
                "a password is required" => "password_required",
                _ => "denied",
            };
            log.set("reason", part);
            recognised = true;
        }
    }
    if let Some(command) = command {
        log.set("command", command);
        recognised = true;
    }
    if recognised {
        log.set("user", &found[1]);
        log.set("action", action);
    }
}

static SU_LINUX: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^(FAILED SU )?\(to (\S+)\) (\S+) on (\S+)"));
static SU_BSD: LazyLock<Regex> = LazyLock::new(|| regex(r"^(BAD SU )?(\S+) to (\S+) on (\S+)"));

fn decode_su(log: &mut DecodedLog, message: &str) {
    let (failed, user, target) = if let Some(found) = SU_LINUX.captures(message) {
        (
            found.get(1).is_some(),
            found[3].to_string(),
            found[2].to_string(),
        )
    } else if let Some(found) = SU_BSD.captures(message) {
        (
            found.get(1).is_some(),
            found[2].to_string(),
            found[3].to_string(),
        )
    } else {
        return;
    };
    log.set("action", if failed { "su_failed" } else { "su_success" });
    log.set("user", user);
    log.set("target_user", target);
}

static NEW_USER: LazyLock<Regex> = LazyLock::new(|| regex(r"^new user: (.+)$"));
static NEW_GROUP: LazyLock<Regex> = LazyLock::new(|| regex(r"^new group: (.+)$"));
static DELETE_USER: LazyLock<Regex> = LazyLock::new(|| regex(r"^delete user '([^']+)'"));
static ADD_TO_GROUP: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^add '([^']+)' to (?:shadow )?group '([^']+)'"));
static GPASSWD_ADD: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^user (\S+) added by (\S+) to group (\S+)"));

/// `name=bob, UID=1001, GID=1001, home=/home/bob`.
fn comma_values(text: &str) -> Vec<(String, String)> {
    text.split(", ")
        .filter_map(|part| part.split_once('='))
        .map(|(key, value)| (key.trim().to_ascii_lowercase(), value.trim().to_string()))
        .collect()
}

fn decode_account(log: &mut DecodedLog, message: &str) {
    if let Some(found) = NEW_USER.captures(message) {
        log.set("action", "user_created");
        for (key, value) in comma_values(&found[1]) {
            match key.as_str() {
                "name" => log.set("target_user", value),
                "uid" | "gid" | "home" | "shell" => log.set(&key, value),
                _ => {}
            }
        }
    } else if let Some(found) = NEW_GROUP.captures(message) {
        log.set("action", "group_created");
        for (key, value) in comma_values(&found[1]) {
            match key.as_str() {
                "name" => log.set("group", value),
                "gid" => log.set("gid", value),
                _ => {}
            }
        }
    } else if let Some(found) = DELETE_USER.captures(message) {
        log.set("action", "user_deleted");
        log.set("target_user", &found[1]);
    } else if let Some(found) = ADD_TO_GROUP.captures(message) {
        log.set("action", "group_member_added");
        log.set("target_user", &found[1]);
        log.set("group", &found[2]);
    } else if let Some(found) = GPASSWD_ADD.captures(message) {
        log.set("action", "group_member_added");
        log.set("target_user", &found[1]);
        log.set("user", &found[2]);
        log.set("group", &found[3]);
    }
}

static PROMISCUOUS: LazyLock<Regex> =
    LazyLock::new(|| regex(r"device (\S+) entered promiscuous mode"));
static FIREWALL_VERDICT: LazyLock<Regex> =
    LazyLock::new(|| regex(r"(?i)\b(block|drop|dropped|reject|rejected|deny|denied)\b"));

fn decode_kernel(log: &mut DecodedLog, message: &str) {
    if let Some(found) = PROMISCUOUS.captures(message) {
        log.set("action", "promiscuous_mode");
        log.set("interface", &found[1]);
        return;
    }
    // Netfilter log lines: `IN=eth0 OUT= SRC=… DST=… PROTO=TCP SPT=… DPT=…`.
    if !(message.contains("SRC=") && message.contains("DST=") && message.contains("IN=")) {
        return;
    }
    for (key, value) in key_values(message) {
        match key.as_str() {
            "IN" => log.set("in", value),
            "OUT" => log.set("out", value),
            "SRC" => log.set("src_ip", value),
            "DST" => log.set("dst_ip", value),
            "PROTO" => log.set("proto", value),
            "SPT" => log.set("src_port", value),
            "DPT" => log.set("dst_port", value),
            _ => {}
        }
    }
    let prefix = message.split("IN=").next().unwrap_or("");
    log.set(
        "action",
        if FIREWALL_VERDICT.is_match(prefix) {
            "firewall_block"
        } else {
            "firewall_log"
        },
    );
}

static SCREEN_SHARING: LazyLock<Regex> = LazyLock::new(|| {
    regex(
        r"^Authentication: (FAILED|SUCCEEDED) :: User Name: (.*?) :: Viewer Address: (\S+) :: Type: (.+)$",
    )
});

fn decode_screen_sharing(log: &mut DecodedLog, message: &str) {
    if let Some(found) = SCREEN_SHARING.captures(message) {
        log.set(
            "action",
            if &found[1] == "FAILED" {
                "login_failed"
            } else {
                "login_success"
            },
        );
        log.set("user", &found[2]);
        log.set("src_ip", &found[3]);
        log.set("auth_method", &found[4]);
    }
}

/// Decode a line whose program and text are known (syslog, journald, the
/// macOS unified log).
pub fn decode_program(program: &str, pid: Option<u32>, message: &str) -> DecodedLog {
    let mut log = DecodedLog::default();
    let name = program_name(program);
    let message = message.trim();
    log.set("program", &name);
    if let Some(pid) = pid {
        log.set("pid", pid.to_string());
    }
    log.set("message", message);

    log.add_service(&name);
    if AUTH_PROGRAMS.contains(&name.as_str()) {
        log.add_service("auth");
    }
    log.add_service("syslog");

    if !decode_pam(&mut log, message) {
        match name.as_str() {
            "sshd" => decode_sshd(&mut log, message),
            "sudo" => decode_sudo(&mut log, message),
            "su" => decode_su(&mut log, message),
            "useradd" | "usermod" | "userdel" | "groupadd" | "gpasswd" => {
                decode_account(&mut log, message);
            }
            "kernel" => decode_kernel(&mut log, message),
            "screensharingd" => decode_screen_sharing(&mut log, message),
            _ => {}
        }
    }
    log
}

static SYSLOG_BSD: LazyLock<Regex> = LazyLock::new(|| {
    regex(
        r"^([A-Z][a-z]{2})\s+(\d{1,2}) (\d{2}:\d{2}:\d{2}) (\S+) ([^\s:\[]+)(?:\[(\d+)\])?:\s?(.*)$",
    )
});
static SYSLOG_ISO: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^(\d{4}-\d{2}-\d{2}T\S+) (\S+) ([^\s:\[]+)(?:\[(\d+)\])?:\s?(.*)$"));

/// The time of a traditional syslog line, which has no year: this year, or
/// last year when that would be in the future (a December line read in
/// January).
fn bsd_time(month: &str, day: &str, time: &str, now: DateTime<Local>) -> Option<DateTime<Utc>> {
    let parse = |year: i32| {
        NaiveDateTime::parse_from_str(&format!("{year} {month} {day} {time}"), "%Y %b %d %H:%M:%S")
            .ok()
            .and_then(|naive| Local.from_local_datetime(&naive).earliest())
    };
    let this_year = parse(now.year())?;
    let time = if this_year > now + chrono::Duration::days(1) {
        parse(now.year() - 1)?
    } else {
        this_year
    };
    Some(time.with_timezone(&Utc))
}

/// `2026-10-11T22:14:15+0200`: journalctl writes the offset without a colon.
fn iso_time(text: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(text)
        .or_else(|_| DateTime::parse_from_str(text, "%Y-%m-%dT%H:%M:%S%z"))
        .or_else(|_| DateTime::parse_from_str(text, "%Y-%m-%dT%H:%M:%S%.f%z"))
        .ok()
        .map(|time| time.with_timezone(&Utc))
}

/// Decode a syslog line: `Oct 11 22:14:15 host sshd[812]: …`, or the same
/// with an ISO 8601 time. `None` when the line has no such header.
pub fn decode_syslog_line(line: &str) -> Option<DecodedLog> {
    let line = line.trim_end();
    let (timestamp, host, program, pid, message) = if let Some(found) = SYSLOG_ISO.captures(line) {
        (
            iso_time(&found[1]),
            found[2].to_string(),
            found[3].to_string(),
            found.get(4).and_then(|pid| pid.as_str().parse().ok()),
            found[5].to_string(),
        )
    } else {
        let found = SYSLOG_BSD.captures(line)?;
        (
            bsd_time(&found[1], &found[2], &found[3], Local::now()),
            found[4].to_string(),
            found[5].to_string(),
            found.get(6).and_then(|pid| pid.as_str().parse().ok()),
            found[7].to_string(),
        )
    };
    let mut log = decode_program(&program, pid, &message);
    log.timestamp = timestamp;
    log.set("hostname", host);
    Some(log)
}

static AUDIT_HEADER: LazyLock<Regex> =
    LazyLock::new(|| regex(r"^type=(\S+) msg=audit\((\d+)\.(\d+):(\d+)\): ?(.*)$"));

/// Decode a record of the Linux audit log: `type=EXECVE msg=audit(…): a0="chmod" …`.
/// Fields take the names auditd gives them.
pub fn decode_audit_line(line: &str) -> Option<DecodedLog> {
    let found = AUDIT_HEADER.captures(line.trim())?;
    let mut log = DecodedLog::default();
    log.add_service("auditd");
    log.set("program", "auditd");
    log.set("type", &found[1]);
    log.set("audit_id", &found[4]);
    log.set("message", line.trim());
    log.timestamp = found[2]
        .parse::<i64>()
        .ok()
        .and_then(|seconds| DateTime::from_timestamp(seconds, 0));
    for (key, value) in key_values(&found[5]) {
        // The inner `msg='op=… acct="root" …'` of user records is read too.
        if key == "msg" {
            for (inner, value) in key_values(&value) {
                log.set(&inner, value);
            }
        } else {
            log.set(&key, value);
        }
    }
    Some(log)
}

static ACCESS_LOG: LazyLock<Regex> = LazyLock::new(|| {
    regex(
        r#"^(\S+) \S+ (\S+) \[([^\]]+)\] "([A-Z]+) (\S+)(?: (HTTP/[\d.]+))?" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?"#,
    )
});

/// Decode a line of a web server access log (common or combined format),
/// with the field names of the Sigma `webserver` category.
pub fn decode_access_line(line: &str) -> Option<DecodedLog> {
    let found = ACCESS_LOG.captures(line.trim())?;
    let mut log = DecodedLog {
        categories: vec!["webserver".to_string()],
        ..Default::default()
    };
    log.set("message", line.trim());
    log.set("c-ip", &found[1]);
    log.set("src_ip", &found[1]);
    if &found[2] != "-" {
        log.set("cs-username", &found[2]);
        log.set("user", &found[2]);
    }
    log.timestamp = DateTime::parse_from_str(&found[3], "%d/%b/%Y:%H:%M:%S %z")
        .ok()
        .map(|time| time.with_timezone(&Utc));
    log.set("cs-method", &found[4]);
    let uri = &found[5];
    log.set("c-uri", uri);
    let (stem, query) = uri.split_once('?').unwrap_or((uri, ""));
    log.set("cs-uri-stem", stem);
    log.set("cs-uri-query", query);
    log.set("sc-status", &found[7]);
    if &found[8] != "-" {
        log.set("sc-bytes", &found[8]);
    }
    if let Some(referer) = found.get(9).filter(|m| m.as_str() != "-") {
        log.set("cs-referer", referer.as_str());
    }
    if let Some(agent) = found.get(10).filter(|m| m.as_str() != "-") {
        log.set("c-useragent", agent.as_str());
    }
    Some(log)
}

fn flatten(prefix: &str, value: &serde_json::Value, depth: usize, log: &mut DecodedLog) {
    if log.fields.len() >= MAX_JSON_FIELDS {
        return;
    }
    match value {
        serde_json::Value::Null => {}
        serde_json::Value::String(text) => log.set(prefix, text),
        serde_json::Value::Bool(_) | serde_json::Value::Number(_) => {
            log.set(prefix, value.to_string());
        }
        serde_json::Value::Object(map) if depth < MAX_JSON_DEPTH => {
            for (key, inner) in map {
                let name = if prefix.is_empty() {
                    key.clone()
                } else {
                    format!("{prefix}.{key}")
                };
                flatten(&name, inner, depth + 1, log);
            }
        }
        // A list, or an object too deep: kept as its JSON text.
        other => log.set(prefix, other.to_string()),
    }
}

/// Decode a line that is one JSON object: nested names are joined with a
/// dot (`http.request.method`). `None` when the line is not a JSON object.
pub fn decode_json_line(line: &str) -> Option<DecodedLog> {
    let value: serde_json::Value = serde_json::from_str(line.trim()).ok()?;
    value.as_object()?;
    let mut log = DecodedLog::default();
    flatten("", &value, 0, &mut log);
    log.timestamp = ["timestamp", "time", "@timestamp", "ts", "date"]
        .iter()
        .find_map(|name| log.get(name).and_then(iso_time));
    if !log.fields.contains_key("message") {
        let text = log
            .get("msg")
            .or_else(|| log.get("log"))
            .map(str::to_string)
            .unwrap_or_else(|| line.trim().to_string());
        log.set("message", text);
    }
    Some(log)
}

/// A line taken as it is: only keyword rules apply to it.
pub fn decode_text_line(line: &str) -> DecodedLog {
    let mut log = DecodedLog::default();
    log.set("message", line);
    log
}

/// Decode a line of the output of a watched command (`command_monitors`):
/// the line is the message, and the command's name is its program and its
/// service, as Sigma rules name it.
pub fn decode_command_line(command: &str, line: &str) -> DecodedLog {
    let mut log = decode_text_line(line);
    log.set("program", command);
    log.set("command", command);
    log.add_service(command);
    log
}

fn json_text(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) => Some(text.clone()),
        serde_json::Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

/// Decode an entry of the systemd journal as `journalctl --output=json`
/// prints it.
pub fn decode_journal_entry(line: &str) -> Option<DecodedLog> {
    let entry: serde_json::Value = serde_json::from_str(line.trim()).ok()?;
    // A message with bytes that are not text is printed as a list of numbers.
    let message = match &entry["MESSAGE"] {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Array(bytes) => {
            let bytes: Vec<u8> = bytes
                .iter()
                .filter_map(|byte| byte.as_u64().and_then(|byte| u8::try_from(byte).ok()))
                .collect();
            String::from_utf8_lossy(&bytes).into_owned()
        }
        _ => return None,
    };
    let transport = entry["_TRANSPORT"].as_str().unwrap_or("");
    let mut log = if transport == "audit" {
        // The kernel's audit records, relayed by the journal.
        decode_audit_line(&message).unwrap_or_else(|| decode_text_line(&message))
    } else {
        let program = json_text(&entry["SYSLOG_IDENTIFIER"])
            .or_else(|| json_text(&entry["_COMM"]))
            .unwrap_or_else(|| {
                if transport == "kernel" {
                    "kernel".to_string()
                } else {
                    "unknown".to_string()
                }
            });
        let pid = json_text(&entry["_PID"])
            .or_else(|| json_text(&entry["SYSLOG_PID"]))
            .and_then(|pid| pid.parse().ok());
        decode_program(&program, pid, &message)
    };
    if let Some(time) = json_text(&entry["__REALTIME_TIMESTAMP"])
        .and_then(|micros| micros.parse::<i64>().ok())
        .and_then(DateTime::from_timestamp_micros)
    {
        log.timestamp = Some(time);
    }
    if let Some(host) = json_text(&entry["_HOSTNAME"]) {
        log.set("hostname", host);
    }
    if let Some(unit) = json_text(&entry["_SYSTEMD_UNIT"]) {
        log.set("unit", unit);
    }
    Some(log)
}

/// Decode an event of the Docker daemon as `docker events --format
/// '{{json .}}'` prints it. Container events only.
pub fn decode_docker_event(line: &str) -> Option<DecodedLog> {
    let event: serde_json::Value = serde_json::from_str(line.trim()).ok()?;
    if event["Type"].as_str()? != "container" {
        return None;
    }
    let raw = event["Action"].as_str()?.trim();
    // `exec_start: bash -i`: the action, then what it is about.
    let (action, detail) = match raw.split_once(':') {
        Some((action, detail)) => (action.trim(), detail.trim()),
        None => (raw, ""),
    };
    let mut log = DecodedLog::default();
    log.add_service("docker");
    log.set("program", "dockerd");
    log.set("action", action);
    if action.starts_with("exec_") {
        log.set("command", detail);
    } else if action == "health_status" {
        log.set("health", detail);
    }
    let actor = &event["Actor"];
    if let Some(id) = actor["ID"].as_str() {
        log.set("container_id", id);
    }
    let attributes = &actor["Attributes"];
    let name = attributes["name"].as_str().unwrap_or("");
    let image = attributes["image"].as_str().unwrap_or("");
    log.set("container", name);
    log.set("image", image);
    if let Some(code) = json_text(&attributes["exitCode"]) {
        log.set("exit_code", code);
    }
    if let Some(signal) = json_text(&attributes["signal"]) {
        log.set("signal", signal);
    }
    log.timestamp = event["timeNano"]
        .as_i64()
        .map(DateTime::from_timestamp_nanos)
        .or_else(|| {
            event["time"]
                .as_i64()
                .and_then(|seconds| DateTime::from_timestamp(seconds, 0))
        });
    log.set(
        "message",
        format!(
            "container {action} {name} ({image}){}",
            if detail.is_empty() {
                String::new()
            } else {
                format!(": {detail}")
            }
        ),
    );
    Some(log)
}

/// Sockets whose mount gives a container the control of the host's
/// containers, hence of the host.
const RUNTIME_SOCKETS: &[&str] = &["docker.sock", "containerd.sock", "crio.sock", "podman.sock"];

/// Add to the event of a container's start the settings that weaken its
/// isolation, from `docker inspect --type container <id>`.
pub fn add_docker_settings(log: &mut DecodedLog, inspect: &str) {
    let Ok(document) = serde_json::from_str::<serde_json::Value>(inspect) else {
        return;
    };
    let container = match &document {
        serde_json::Value::Array(items) => match items.first() {
            Some(container) => container,
            None => return,
        },
        container => container,
    };
    let host = &container["HostConfig"];
    if let Some(privileged) = host["Privileged"].as_bool() {
        log.set("privileged", privileged.to_string());
    }
    for (field, key) in [
        ("pid_mode", "PidMode"),
        ("network_mode", "NetworkMode"),
        ("ipc_mode", "IpcMode"),
        ("userns_mode", "UsernsMode"),
    ] {
        if let Some(mode) = host[key].as_str() {
            log.set(field, mode);
        }
    }
    let list = |value: &serde_json::Value, key: Option<&str>| -> Vec<String> {
        value
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| match key {
                        Some(key) => item[key].as_str(),
                        None => item.as_str(),
                    })
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default()
    };
    log.set("cap_add", list(&host["CapAdd"], None).join(","));
    log.set("security_opt", list(&host["SecurityOpt"], None).join(","));
    log.set(
        "devices",
        list(&host["Devices"], Some("PathOnHost")).join(","),
    );
    // Bind mounts and volumes alike: `Mounts` lists both, with their source
    // on the host.
    let sources: Vec<String> = list(&container["Mounts"], Some("Source"))
        .into_iter()
        .filter(|source| !source.is_empty())
        .collect();
    log.set("host_paths", sources.join(","));
    let root = sources
        .iter()
        .any(|source| source.trim_end_matches('/').is_empty());
    log.set("mounts_host_root", root.to_string());
    let socket = sources.iter().any(|source| {
        let name = source.rsplit('/').next().unwrap_or(source);
        RUNTIME_SOCKETS.contains(&name)
    });
    log.set("mounts_docker_socket", socket.to_string());
    // Empty: the user of the image, root unless the image says otherwise.
    let user = container["Config"]["User"].as_str().unwrap_or("");
    // Not `user`: that is an account of this host, which a response may
    // act on.
    log.set(
        "container_user",
        if user.is_empty() { "root" } else { user },
    );
}

/// Decode an entry of the macOS unified log as `log stream --style ndjson`
/// prints it.
pub fn decode_macos_entry(line: &str) -> Option<DecodedLog> {
    let entry: serde_json::Value = serde_json::from_str(line.trim()).ok()?;
    let message = entry["eventMessage"].as_str()?;
    let program = entry["processImagePath"].as_str().unwrap_or("unknown");
    let pid = entry["processID"]
        .as_u64()
        .and_then(|pid| u32::try_from(pid).ok());
    let mut log = decode_program(program, pid, message);
    log.timestamp = entry["timestamp"].as_str().and_then(|text| {
        DateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S%.f%z")
            .ok()
            .map(|time| time.with_timezone(&Utc))
    });
    for (name, field) in [("subsystem", "subsystem"), ("category", "log_category")] {
        if let Some(value) = entry[name].as_str() {
            log.set(field, value);
        }
    }
    Some(log)
}

/// The Sigma `service` of a Windows event channel.
fn windows_service(channel: &str) -> Option<&'static str> {
    Some(match channel.to_ascii_lowercase().as_str() {
        "security" => "security",
        "system" => "system",
        "application" => "application",
        "windows powershell" => "powershell-classic",
        "microsoft-windows-powershell/operational" => "powershell",
        "microsoft-windows-sysmon/operational" => "sysmon",
        "microsoft-windows-windows defender/operational" => "windefend",
        "microsoft-windows-windows firewall with advanced security/firewall" => "firewall-as",
        "microsoft-windows-taskscheduler/operational" => "taskscheduler",
        "microsoft-windows-terminalservices-localsessionmanager/operational" => {
            "terminalservices-localsessionmanager"
        }
        "microsoft-windows-bits-client/operational" => "bits-client",
        "microsoft-windows-wmi-activity/operational" => "wmi",
        "microsoft-windows-applocker/exe and dll" => "applocker",
        _ => return None,
    })
}

/// Decode a Windows event as the collector's script prints it:
/// `{"Id":4625,"Channel":"Security","Provider":"…","Time":"…","Computer":"…",
///   "Data":{"TargetUserName":"…"}}`.
pub fn decode_windows_event(event: &serde_json::Value) -> Option<DecodedLog> {
    let id = event["Id"].as_u64()?;
    let channel = event["Channel"].as_str().unwrap_or("");
    let mut log = DecodedLog::default();
    log.set("eventid", id.to_string());
    log.set("channel", channel);
    if let Some(service) = windows_service(channel) {
        log.add_service(service);
    }
    for (name, field) in [
        ("Provider", "provider_name"),
        ("Computer", "computer"),
        ("Message", "message"),
        ("User", "user"),
    ] {
        if let Some(value) = event[name].as_str() {
            log.set(field, value);
        }
    }
    log.timestamp = event["Time"].as_str().and_then(iso_time);
    if let Some(data) = event["Data"].as_object() {
        for (name, value) in data.iter().take(MAX_JSON_FIELDS) {
            match value {
                serde_json::Value::String(text) => log.set(name, text),
                serde_json::Value::Null => {}
                other => log.set(name, other.to_string()),
            }
        }
    }
    // The address of a logon, under the name the other sources use.
    if let Some(address) = log
        .get("ipaddress")
        .filter(|a| is_address(a))
        .map(str::to_string)
    {
        log.set("src_ip", address);
    }
    Some(log)
}

/// The Sigma services of the Windows channels the collector reads.
pub fn windows_services() -> Vec<&'static str> {
    vec![
        "security",
        "system",
        "application",
        "powershell",
        "powershell-classic",
        "sysmon",
        "windefend",
        "firewall-as",
        "taskscheduler",
        "terminalservices-localsessionmanager",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn docker_events_and_container_settings_are_read() {
        let start = decode_docker_event(
            r#"{"status":"start","id":"4f2a","from":"alpine:3.20","Type":"container","Action":"start",
                "Actor":{"ID":"4f2a9c","Attributes":{"image":"alpine:3.20","name":"escape"}},
                "scope":"local","time":1792020000,"timeNano":1792020000123456789}"#,
        )
        .unwrap();
        assert_eq!(start.services, ["docker"]);
        assert_eq!(
            fields(&start, &["action", "container", "image", "container_id"]),
            [
                Some("start"),
                Some("escape"),
                Some("alpine:3.20"),
                Some("4f2a9c")
            ]
        );
        assert_eq!(
            start.timestamp,
            Some(DateTime::from_timestamp_nanos(1_792_020_000_123_456_789))
        );

        let exec = decode_docker_event(
            r#"{"Type":"container","Action":"exec_start: bash -i ","Actor":{"ID":"4f2a9c",
                "Attributes":{"execID":"77","image":"alpine:3.20","name":"escape"}},"time":1792020005}"#,
        )
        .unwrap();
        assert_eq!(
            fields(&exec, &["action", "command"]),
            [Some("exec_start"), Some("bash -i")]
        );
        assert_eq!(
            exec.get("message"),
            Some("container exec_start escape (alpine:3.20): bash -i")
        );
        let health = decode_docker_event(
            r#"{"Type":"container","Action":"health_status: healthy","Actor":{"ID":"1","Attributes":{}}}"#,
        )
        .unwrap();
        assert_eq!(
            fields(&health, &["action", "health", "command"]),
            [Some("health_status"), Some("healthy"), None]
        );
        // Images and networks are not containers.
        assert!(
            decode_docker_event(r#"{"Type":"image","Action":"pull","Actor":{"ID":"alpine"}}"#)
                .is_none()
        );
        assert!(decode_docker_event("not json").is_none());

        let mut start = start;
        add_docker_settings(
            &mut start,
            r#"[{"Config":{"User":""},
                 "HostConfig":{"Privileged":true,"PidMode":"host","NetworkMode":"bridge","IpcMode":"private",
                   "CapAdd":["SYS_ADMIN","NET_ADMIN"],"SecurityOpt":["apparmor=unconfined"],
                   "Devices":[{"PathOnHost":"/dev/sda","PathInContainer":"/dev/sda"}]},
                 "Mounts":[{"Type":"bind","Source":"/","Destination":"/host"},
                           {"Type":"bind","Source":"/run/docker.sock","Destination":"/var/run/docker.sock"},
                           {"Type":"volume","Source":"/var/lib/docker/volumes/data/_data","Destination":"/data"}]}]"#,
        );
        assert_eq!(
            fields(
                &start,
                &[
                    "privileged",
                    "pid_mode",
                    "cap_add",
                    "security_opt",
                    "devices",
                    "mounts_host_root",
                    "mounts_docker_socket",
                    "container_user"
                ]
            ),
            [
                Some("true"),
                Some("host"),
                Some("SYS_ADMIN,NET_ADMIN"),
                Some("apparmor=unconfined"),
                Some("/dev/sda"),
                Some("true"),
                Some("true"),
                Some("root")
            ]
        );
        assert_eq!(
            start.get("host_paths"),
            Some("/,/run/docker.sock,/var/lib/docker/volumes/data/_data")
        );

        // An ordinary container: nothing weakens it.
        let mut plain = decode_docker_event(
            r#"{"Type":"container","Action":"start","Actor":{"ID":"9","Attributes":{"name":"web","image":"nginx"}}}"#,
        )
        .unwrap();
        add_docker_settings(
            &mut plain,
            r#"[{"Config":{"User":"nginx"},"HostConfig":{"Privileged":false,"PidMode":"","CapAdd":null},
                 "Mounts":[{"Type":"bind","Source":"/srv/www","Destination":"/usr/share/nginx/html"}]}]"#,
        );
        assert_eq!(
            fields(
                &plain,
                &[
                    "privileged",
                    "pid_mode",
                    "cap_add",
                    "mounts_host_root",
                    "mounts_docker_socket",
                    "container_user"
                ]
            ),
            [
                Some("false"),
                None,
                None,
                Some("false"),
                Some("false"),
                Some("nginx")
            ]
        );
    }

    fn decoded(program: &str, message: &str) -> DecodedLog {
        decode_program(program, Some(812), message)
    }

    fn fields<'a>(log: &'a DecodedLog, names: &[&str]) -> Vec<Option<&'a str>> {
        names.iter().map(|name| log.get(name)).collect()
    }

    #[test]
    fn sshd_lines_give_who_from_where_and_how() {
        let failed = decoded(
            "sshd",
            "Failed password for invalid user oracle from 203.0.113.9 port 51234 ssh2",
        );
        assert_eq!(
            fields(
                &failed,
                &[
                    "action",
                    "user",
                    "src_ip",
                    "src_port",
                    "auth_method",
                    "invalid_user"
                ]
            ),
            [
                Some("login_failed"),
                Some("oracle"),
                Some("203.0.113.9"),
                Some("51234"),
                Some("password"),
                Some("true")
            ]
        );
        assert_eq!(failed.services, ["sshd", "auth", "syslog"]);

        let accepted = decoded(
            "/usr/sbin/sshd-session",
            "Accepted publickey for alice from 2001:db8::7 port 40022 ssh2: ED25519 SHA256:abc",
        );
        assert_eq!(
            fields(
                &accepted,
                &["program", "action", "user", "src_ip", "auth_method"]
            ),
            [
                Some("sshd"),
                Some("login_success"),
                Some("alice"),
                Some("2001:db8::7"),
                Some("publickey")
            ]
        );

        for (message, action) in [
            (
                "Invalid user admin from 203.0.113.9 port 4444",
                "invalid_user",
            ),
            (
                "error: maximum authentication attempts exceeded for root from 203.0.113.9 port 4444 ssh2 [preauth]",
                "max_auth_exceeded",
            ),
            (
                "Connection closed by authenticating user root 203.0.113.9 port 4444 [preauth]",
                "disconnect_preauth",
            ),
            (
                "Disconnected from invalid user test 203.0.113.9 port 4444 [preauth]",
                "disconnect_preauth",
            ),
            (
                "User root from 203.0.113.9 not allowed because not listed in AllowUsers",
                "login_denied",
            ),
        ] {
            let log = decoded("sshd", message);
            assert_eq!(log.get("action"), Some(action), "{message}");
            assert_eq!(log.get("src_ip"), Some("203.0.113.9"), "{message}");
        }

        // A line of no interest keeps its text, for keyword rules.
        let other = decoded("sshd", "Server listening on 0.0.0.0 port 22.");
        assert_eq!(other.get("action"), None);
        assert_eq!(
            other.get("message"),
            Some("Server listening on 0.0.0.0 port 22.")
        );
    }

    #[test]
    fn pam_lines_are_read_under_any_program() {
        let ssh = decoded(
            "sshd",
            "pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=203.0.113.9  user=root",
        );
        assert_eq!(
            fields(
                &ssh,
                &["action", "user", "src_ip", "pam_service", "target_user"]
            ),
            [
                Some("auth_failure"),
                Some("root"),
                Some("203.0.113.9"),
                Some("sshd"),
                None
            ]
        );

        // `su`: alice asks to become root.
        let su = decoded(
            "su",
            "pam_unix(su:auth): authentication failure; logname=alice uid=1000 euid=0 tty=pts/0 ruser=alice rhost=  user=root",
        );
        assert_eq!(
            fields(&su, &["action", "user", "target_user", "src_ip"]),
            [Some("auth_failure"), Some("alice"), Some("root"), None]
        );

        let named_host = decoded(
            "sshd",
            "pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=bastion.example  user=bob",
        );
        assert_eq!(named_host.get("rhost"), Some("bastion.example"));
        assert_eq!(named_host.get("src_ip"), None);

        let session = decoded(
            "sudo",
            "pam_unix(sudo:session): session opened for user root(uid=0) by alice(uid=1000)",
        );
        assert_eq!(
            fields(&session, &["action", "user"]),
            [Some("session_opened"), Some("root")]
        );

        let password = decoded(
            "passwd",
            "pam_unix(passwd:chauthtok): password changed for bob",
        );
        assert_eq!(
            fields(&password, &["action", "target_user"]),
            [Some("password_changed"), Some("bob")]
        );
        assert!(password.services.contains(&"auth".to_string()));
    }

    #[test]
    fn sudo_lines_say_who_ran_what_as_whom_or_why_not() {
        let command = decoded(
            "sudo",
            "   alice : TTY=pts/0 ; PWD=/home/alice ; USER=root ; COMMAND=/usr/bin/sh -c 'id ; whoami'",
        );
        assert_eq!(
            fields(
                &command,
                &["action", "user", "target_user", "tty", "pwd", "command"]
            ),
            [
                Some("command"),
                Some("alice"),
                Some("root"),
                Some("pts/0"),
                Some("/home/alice"),
                Some("/usr/bin/sh -c 'id ; whoami'")
            ]
        );

        let wrong = decoded(
            "sudo",
            "   alice : 3 incorrect password attempts ; TTY=pts/0 ; PWD=/home/alice ; USER=root ; COMMAND=/usr/bin/id",
        );
        assert_eq!(
            fields(&wrong, &["action", "user", "attempts"]),
            [Some("incorrect_password"), Some("alice"), Some("3")]
        );

        let refused = decoded(
            "sudo",
            "     bob : user NOT in sudoers ; TTY=pts/1 ; PWD=/tmp ; USER=root ; COMMAND=/bin/bash",
        );
        assert_eq!(
            fields(&refused, &["action", "user", "command"]),
            [Some("not_in_sudoers"), Some("bob"), Some("/bin/bash")]
        );

        // As macOS logs a `sudo -n` without a cached password (read from the
        // unified log of a real machine): refused, not a command that ran.
        let required = decoded(
            "sudo",
            "thibault : a password is required ; PWD=/Users/thibault ; USER=root ; COMMAND=/usr/bin/true",
        );
        assert_eq!(
            fields(&required, &["action", "user", "reason", "command", "tty"]),
            [
                Some("password_required"),
                Some("thibault"),
                Some("a password is required"),
                Some("/usr/bin/true"),
                None
            ]
        );
        let unknown = decoded(
            "sudo",
            "bob : sorry, you must have a tty ; USER=root ; COMMAND=/bin/id",
        );
        assert_eq!(
            fields(&unknown, &["action", "reason"]),
            [Some("denied"), Some("sorry, you must have a tty")]
        );

        // Not a sudo record: nothing is invented.
        let other = decoded("sudo", "Reading config");
        assert_eq!(other.get("action"), None);
        assert_eq!(other.get("user"), None);
    }

    #[test]
    fn su_and_account_changes_are_recognised() {
        let failed = decoded("su", "FAILED SU (to root) alice on pts/0");
        assert_eq!(
            fields(&failed, &["action", "user", "target_user"]),
            [Some("su_failed"), Some("alice"), Some("root")]
        );
        let bsd = decoded("su", "BAD SU alice to root on /dev/ttys001");
        assert_eq!(
            fields(&bsd, &["action", "user", "target_user"]),
            [Some("su_failed"), Some("alice"), Some("root")]
        );
        assert_eq!(
            decoded("su", "(to root) alice on pts/0").get("action"),
            Some("su_success")
        );

        let created = decoded(
            "useradd",
            "new user: name=backdoor, UID=0, GID=0, home=/root, shell=/bin/bash, from=/dev/pts/0",
        );
        assert_eq!(
            fields(&created, &["action", "target_user", "uid", "shell"]),
            [
                Some("user_created"),
                Some("backdoor"),
                Some("0"),
                Some("/bin/bash")
            ]
        );

        let added = decoded("usermod", "add 'bob' to group 'sudo'");
        assert_eq!(
            fields(&added, &["action", "target_user", "group"]),
            [Some("group_member_added"), Some("bob"), Some("sudo")]
        );
        let gpasswd = decoded("gpasswd", "user bob added by root to group docker");
        assert_eq!(
            fields(&gpasswd, &["action", "target_user", "user", "group"]),
            [
                Some("group_member_added"),
                Some("bob"),
                Some("root"),
                Some("docker")
            ]
        );
        assert_eq!(
            decoded("userdel", "delete user 'bob'").get("action"),
            Some("user_deleted")
        );
        assert_eq!(
            decoded("groupadd", "new group: name=ops, GID=1005").get("group"),
            Some("ops")
        );
    }

    #[test]
    fn kernel_firewall_lines_give_the_packet() {
        let blocked = decoded(
            "kernel",
            "[UFW BLOCK] IN=eth0 OUT= MAC=00:11 SRC=203.0.113.9 DST=192.0.2.10 LEN=40 PROTO=TCP SPT=44321 DPT=22 WINDOW=1024 SYN",
        );
        assert_eq!(
            fields(
                &blocked,
                &["action", "src_ip", "dst_ip", "proto", "dst_port", "in"]
            ),
            [
                Some("firewall_block"),
                Some("203.0.113.9"),
                Some("192.0.2.10"),
                Some("TCP"),
                Some("22"),
                Some("eth0")
            ]
        );
        let logged = decoded(
            "kernel",
            "nft-log: IN=eth0 OUT= SRC=198.51.100.7 DST=192.0.2.10 PROTO=UDP SPT=53 DPT=40000",
        );
        assert_eq!(logged.get("action"), Some("firewall_log"));

        let promiscuous = decoded("kernel", "device eth0 entered promiscuous mode");
        assert_eq!(
            fields(&promiscuous, &["action", "interface"]),
            [Some("promiscuous_mode"), Some("eth0")]
        );
        assert_eq!(decoded("kernel", "usb 1-1: new device").get("action"), None);
    }

    #[test]
    fn screen_sharing_authentication_is_read() {
        let failed = decoded(
            "screensharingd",
            "Authentication: FAILED :: User Name: alice :: Viewer Address: 203.0.113.9 :: Type: VNC DES",
        );
        assert_eq!(
            fields(&failed, &["action", "user", "src_ip", "auth_method"]),
            [
                Some("login_failed"),
                Some("alice"),
                Some("203.0.113.9"),
                Some("VNC DES")
            ]
        );
        assert!(failed.services.contains(&"auth".to_string()));
    }

    #[test]
    fn syslog_headers_of_both_kinds_are_read() {
        let iso = decode_syslog_line(
            "2026-10-11T22:14:15+0200 web01 sshd[812]: Failed password for root from 203.0.113.9 port 4444 ssh2",
        )
        .unwrap();
        assert_eq!(
            fields(&iso, &["hostname", "program", "pid", "action"]),
            [
                Some("web01"),
                Some("sshd"),
                Some("812"),
                Some("login_failed")
            ]
        );
        assert_eq!(
            iso.timestamp.unwrap().to_rfc3339(),
            "2026-10-11T20:14:15+00:00"
        );

        let rfc3339 = decode_syslog_line(
            "2026-10-11T22:14:15.123456+02:00 web01 sudo:    alice : TTY=pts/0 ; PWD=/ ; USER=root ; COMMAND=/bin/ls",
        )
        .unwrap();
        assert_eq!(rfc3339.get("action"), Some("command"));
        assert_eq!(rfc3339.get("pid"), None);

        let bsd = decode_syslog_line(
            "Oct  3 04:05:06 web01 CRON[77]: (root) CMD (run-parts /etc/cron.hourly)",
        )
        .unwrap();
        assert_eq!(
            fields(&bsd, &["program", "pid"]),
            [Some("cron"), Some("77")]
        );
        assert!(bsd.timestamp.is_some());
        assert_eq!(bsd.services, ["cron", "syslog"]);

        assert!(decode_syslog_line("not a syslog line").is_none());
    }

    #[test]
    fn a_syslog_line_without_a_year_is_never_dated_in_the_future() {
        let january = Local.with_ymd_and_hms(2027, 1, 2, 8, 0, 0).unwrap();
        let december = bsd_time("Dec", "31", "23:59:00", january).unwrap();
        assert_eq!(december.with_timezone(&Local).year(), 2026);
        let yesterday = bsd_time("Jan", "1", "10:00:00", january).unwrap();
        assert_eq!(yesterday.with_timezone(&Local).year(), 2027);
    }

    #[test]
    fn a_line_of_a_watched_command_is_an_event_of_its_service() {
        let log = decode_command_line("listening-ports", "LISTEN 0 128 0.0.0.0:4444 0.0.0.0:*");
        assert_eq!(log.services, ["listening-ports"]);
        assert_eq!(log.get("program"), Some("listening-ports"));
        assert_eq!(
            log.get("message"),
            Some("LISTEN 0 128 0.0.0.0:4444 0.0.0.0:*")
        );
    }

    #[test]
    fn audit_records_keep_the_names_auditd_gives() {
        let execve = decode_audit_line(
            r#"type=EXECVE msg=audit(1790000000.123:4567): argc=3 a0="chmod" a1="4755" a2="/tmp/sh""#,
        )
        .unwrap();
        assert_eq!(
            fields(&execve, &["type", "a0", "a1", "a2", "audit_id"]),
            [
                Some("EXECVE"),
                Some("chmod"),
                Some("4755"),
                Some("/tmp/sh"),
                Some("4567")
            ]
        );
        assert_eq!(execve.services, ["auditd"]);
        assert_eq!(execve.timestamp.unwrap().timestamp(), 1_790_000_000);

        let user = decode_audit_line(
            r#"type=USER_AUTH msg=audit(1790000000.500:4570): pid=812 uid=0 auid=4294967295 msg='op=PAM:authentication acct="root" exe="/usr/sbin/sshd" hostname=203.0.113.9 addr=203.0.113.9 terminal=ssh res=failed'"#,
        )
        .unwrap();
        assert_eq!(
            fields(&user, &["type", "acct", "exe", "addr", "res", "pid"]),
            [
                Some("USER_AUTH"),
                Some("root"),
                Some("/usr/sbin/sshd"),
                Some("203.0.113.9"),
                Some("failed"),
                Some("812")
            ]
        );
        assert!(decode_audit_line("Oct 3 04:05:06 host sshd: x").is_none());
    }

    #[test]
    fn access_log_lines_take_the_sigma_web_field_names() {
        let log = decode_access_line(
            r#"203.0.113.9 - admin [10/Oct/2026:13:55:36 +0200] "GET /cgi-bin/view?file=../../../../etc/passwd HTTP/1.1" 200 1834 "https://example.org/" "Mozilla/5.0 sqlmap/1.7""#,
        )
        .unwrap();
        assert_eq!(
            fields(
                &log,
                &[
                    "c-ip",
                    "cs-username",
                    "cs-method",
                    "c-uri",
                    "cs-uri-stem",
                    "cs-uri-query",
                    "sc-status",
                    "sc-bytes",
                    "cs-referer",
                    "c-useragent"
                ]
            ),
            [
                Some("203.0.113.9"),
                Some("admin"),
                Some("GET"),
                Some("/cgi-bin/view?file=../../../../etc/passwd"),
                Some("/cgi-bin/view"),
                Some("file=../../../../etc/passwd"),
                Some("200"),
                Some("1834"),
                Some("https://example.org/"),
                Some("Mozilla/5.0 sqlmap/1.7")
            ]
        );
        assert_eq!(log.categories, ["webserver"]);
        assert_eq!(
            log.timestamp.unwrap().to_rfc3339(),
            "2026-10-10T11:55:36+00:00"
        );

        // Common format: no referer, no agent, no size.
        let common = decode_access_line(
            r#"198.51.100.7 - - [10/Oct/2026:13:55:36 +0000] "POST /login HTTP/1.1" 401 -"#,
        )
        .unwrap();
        assert_eq!(
            fields(
                &common,
                &[
                    "cs-method",
                    "sc-status",
                    "sc-bytes",
                    "c-useragent",
                    "cs-username"
                ]
            ),
            [Some("POST"), Some("401"), None, None, None]
        );
        assert!(decode_access_line("error: upstream timed out").is_none());
    }

    #[test]
    fn json_lines_are_flattened_with_dotted_names() {
        let log = decode_json_line(
            r#"{"time":"2026-10-11T20:14:15Z","level":"warn","msg":"login failed","http":{"request":{"method":"POST"}},"user":{"name":"bob"},"tags":["a","b"],"attempt":3,"ok":false,"none":null}"#,
        )
        .unwrap();
        assert_eq!(
            fields(
                &log,
                &[
                    "message",
                    "level",
                    "http.request.method",
                    "user.name",
                    "tags",
                    "attempt",
                    "ok",
                    "none"
                ]
            ),
            [
                Some("login failed"),
                Some("warn"),
                Some("POST"),
                Some("bob"),
                Some(r#"["a","b"]"#),
                Some("3"),
                Some("false"),
                None
            ]
        );
        assert_eq!(
            log.timestamp.unwrap().to_rfc3339(),
            "2026-10-11T20:14:15+00:00"
        );
        assert!(decode_json_line("[1,2]").is_none());
        assert!(decode_json_line("plain text").is_none());
    }

    #[test]
    fn journal_entries_are_read_with_their_program_and_time() {
        let entry = decode_journal_entry(
            r#"{"__REALTIME_TIMESTAMP":"1790000000123456","_HOSTNAME":"web01","SYSLOG_IDENTIFIER":"sshd","_PID":"812","_TRANSPORT":"syslog","_SYSTEMD_UNIT":"ssh.service","MESSAGE":"Failed password for root from 203.0.113.9 port 4444 ssh2"}"#,
        )
        .unwrap();
        assert_eq!(
            fields(
                &entry,
                &["program", "pid", "action", "src_ip", "hostname", "unit"]
            ),
            [
                Some("sshd"),
                Some("812"),
                Some("login_failed"),
                Some("203.0.113.9"),
                Some("web01"),
                Some("ssh.service")
            ]
        );
        assert_eq!(entry.timestamp.unwrap().timestamp(), 1_790_000_000);

        let kernel = decode_journal_entry(
            r#"{"_TRANSPORT":"kernel","MESSAGE":"device eth0 entered promiscuous mode"}"#,
        )
        .unwrap();
        assert_eq!(kernel.get("action"), Some("promiscuous_mode"));

        let audit = decode_journal_entry(
            r#"{"_TRANSPORT":"audit","MESSAGE":"type=EXECVE msg=audit(1790000000.1:9): argc=1 a0=\"id\""}"#,
        )
        .unwrap();
        assert_eq!(audit.get("a0"), Some("id"));
        assert_eq!(audit.services, ["auditd"]);

        // Bytes that are not text come as a list of numbers.
        let bytes =
            decode_journal_entry(r#"{"SYSLOG_IDENTIFIER":"app","MESSAGE":[104,105]}"#).unwrap();
        assert_eq!(bytes.get("message"), Some("hi"));
        assert!(decode_journal_entry(r#"{"SYSLOG_IDENTIFIER":"app"}"#).is_none());
    }

    #[test]
    fn unified_log_entries_are_read_like_syslog_lines() {
        let entry = decode_macos_entry(
            r#"{"timestamp":"2026-10-09 21:21:03.145000+0200","processImagePath":"/usr/bin/sudo","processID":51612,"subsystem":"","category":"","eventMessage":"   alice : TTY=ttys001 ; PWD=/Users/alice ; USER=root ; COMMAND=/bin/ls","messageType":"Default"}"#,
        )
        .unwrap();
        assert_eq!(
            fields(&entry, &["program", "pid", "action", "user", "command"]),
            [
                Some("sudo"),
                Some("51612"),
                Some("command"),
                Some("alice"),
                Some("/bin/ls")
            ]
        );
        assert_eq!(
            entry.timestamp.unwrap().to_rfc3339(),
            "2026-10-09T19:21:03.145+00:00"
        );
        assert!(decode_macos_entry(r#"{"processImagePath":"/usr/bin/sudo"}"#).is_none());
    }

    #[test]
    fn windows_events_keep_their_data_names_and_channel_service() {
        let event = serde_json::json!({
            "Id": 4625,
            "Channel": "Security",
            "Provider": "Microsoft-Windows-Security-Auditing",
            "Time": "2026-10-11T20:14:15.0000000Z",
            "Computer": "PC-01",
            "Data": {
                "TargetUserName": "Administrator",
                "LogonType": "3",
                "IpAddress": "203.0.113.9",
                "IpPort": 51000,
                "Empty": null
            }
        });
        let log = decode_windows_event(&event).unwrap();
        assert_eq!(
            fields(
                &log,
                &[
                    "eventid",
                    "channel",
                    "targetusername",
                    "logontype",
                    "ipaddress",
                    "src_ip",
                    "ipport",
                    "empty"
                ]
            ),
            [
                Some("4625"),
                Some("Security"),
                Some("Administrator"),
                Some("3"),
                Some("203.0.113.9"),
                Some("203.0.113.9"),
                Some("51000"),
                None
            ]
        );
        assert_eq!(log.services, ["security"]);
        assert!(log.timestamp.is_some());

        let local = decode_windows_event(&serde_json::json!({
            "Id": 4625, "Channel": "Security", "Data": {"IpAddress": "-"}
        }))
        .unwrap();
        assert_eq!(local.get("src_ip"), None);
        let other =
            decode_windows_event(&serde_json::json!({"Id": 1, "Channel": "Custom/App"})).unwrap();
        assert!(other.services.is_empty());
        assert!(decode_windows_event(&serde_json::json!({"Channel": "Security"})).is_none());
    }

    #[test]
    fn a_field_is_bounded_and_named_in_lower_case() {
        let long = "x".repeat(MAX_FIELD_CHARS + 100);
        let log = decoded("app", &long);
        assert_eq!(log.get("message").unwrap().chars().count(), MAX_FIELD_CHARS);
        let mut named = DecodedLog::default();
        named.set("EventID", "1");
        assert_eq!(named.get("eventid"), Some("1"));
        assert_eq!(log.source(), "app");
    }
}
