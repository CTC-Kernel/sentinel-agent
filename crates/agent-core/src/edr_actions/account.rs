// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Locking a local account whose credentials are in the wrong hands.
//!
//! When an account has been taken — a password found by brute force, a
//! session opened from where it should not be — blocking the address it
//! came from is not enough: the password still works from anywhere else.
//! Locking the account takes it away until someone has changed the
//! password.
//!
//! | System  | Lock                                                   | Unlock                                  |
//! |---------|--------------------------------------------------------|-----------------------------------------|
//! | Linux   | `usermod --lock --expiredate 1` (keys are refused too) | `usermod --unlock --expiredate ''`      |
//! | macOS   | `;DisabledUser;` added to the authentication authority | removed from it                         |
//! | Windows | `net user … /active:no`                                | `net user … /active:yes`                |
//!
//! On Linux and macOS the sessions of the account are then ended: a lock
//! that leaves the intruder's shell running has contained nothing.
//!
//! # What is refused
//!
//! Locking the wrong account locks the owner out of the machine. Refused:
//!
//! - `root`, the built-in Windows administrator, any account with the
//!   identifier of root;
//! - a system account (the accounts services run as);
//! - the account the agent itself runs as, and on macOS the account using
//!   the machine at that moment;
//! - the last account that can administer the machine;
//! - an account that does not exist here, or a name that is not one.
//!
//! An account that was already locked is left as it is, and is not unlocked
//! later: the agent only undoes what it did.
//!
//! # Duration
//!
//! With a duration the account is unlocked when it ends, across a restart
//! of the agent. With 0 it stays locked until an administrator unlocks it.

use agent_common::config::AgentConfig;
use agent_common::error::CommonError;
use agent_scanner::inventory::SystemInventory;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;
use tracing::{info, warn};

/// Time a system tool is given to lock or unlock an account.
const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);

/// Groups whose members can administer the machine.
const ADMIN_GROUPS: &[&str] = &[
    "sudo",
    "wheel",
    "admin",
    "administrators",
    "administrateurs",
];

/// Whether a name can be the name of a local account, and safely an
/// argument of a system tool.
fn is_account_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && !name.starts_with('-')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// Why `user` may not be locked, when it may not.
///
/// `own` is the account the agent runs as, `console` the account using the
/// machine now, `system` the operating system (`linux`, `macos`, `windows`).
pub fn refusal(
    user: &str,
    inventory: &SystemInventory,
    own: Option<&str>,
    console: Option<&str>,
    system: &str,
) -> Option<String> {
    if !is_account_name(user) {
        return Some(format!("'{user}' is not an account name"));
    }
    let same = |a: &str, b: &str| {
        if system == "linux" {
            a == b
        } else {
            a.eq_ignore_ascii_case(b)
        }
    };
    let Some(account) = inventory.users.iter().find(|u| same(&u.name, user)) else {
        return Some(format!("no local account is named '{user}'"));
    };
    // The built-in administrator of Windows is known by its identifier,
    // whatever it was renamed to.
    let builtin = ["root", "administrator", "administrateur"]
        .iter()
        .any(|name| user.eq_ignore_ascii_case(name))
        || account.is_root_equivalent()
        || (system == "windows" && account.id.ends_with("-500"));
    if builtin {
        return Some(format!(
            "'{user}' is the administrator account of the system"
        ));
    }
    let first_ordinary: u64 = if system == "macos" { 500 } else { 1000 };
    let is_system = user.starts_with('_')
        || (system != "windows"
            && account
                .id
                .parse::<u64>()
                .is_ok_and(|id| id < first_ordinary));
    if is_system {
        return Some(format!("'{user}' is a system account"));
    }
    if own.is_some_and(|own| same(own, user)) {
        return Some(format!("'{user}' is the account the agent runs as"));
    }
    if console.is_some_and(|console| same(console, user)) {
        return Some(format!("'{user}' is the account using this machine now"));
    }

    let administrators: Vec<&str> = inventory
        .groups
        .iter()
        .filter(|group| ADMIN_GROUPS.contains(&group.name.to_ascii_lowercase().as_str()))
        .flat_map(|group| group.members.iter())
        // A member is written `PC\name` on Windows.
        .map(|member| member.rsplit('\\').next().unwrap_or(member))
        .filter(|member| {
            inventory
                .users
                .iter()
                .any(|u| same(&u.name, member) && u.can_log_in && !u.is_root_equivalent())
        })
        .collect();
    let is_administrator = administrators.iter().any(|member| same(member, user));
    let others = administrators
        .iter()
        .filter(|member| !same(member, user))
        .count();
    if is_administrator && others == 0 {
        return Some(format!(
            "'{user}' is the last account that can administer this machine"
        ));
    }
    None
}

/// The command that locks (`lock`) or unlocks an account on `system`.
pub fn lock_command(system: &str, user: &str, lock: bool) -> Option<Vec<String>> {
    let words: Vec<&str> = match (system, lock) {
        ("linux", true) => vec!["usermod", "--lock", "--expiredate", "1", user],
        ("linux", false) => vec!["usermod", "--unlock", "--expiredate", "", user],
        ("macos", true) => vec![
            "/usr/bin/dscl",
            ".",
            "-append",
            "",
            "AuthenticationAuthority",
            ";DisabledUser;",
        ],
        ("macos", false) => vec![
            "/usr/bin/dscl",
            ".",
            "-delete",
            "",
            "AuthenticationAuthority",
            ";DisabledUser;",
        ],
        ("windows", true) => vec!["net", "user", user, "/active:no"],
        ("windows", false) => vec!["net", "user", user, "/active:yes"],
        _ => return None,
    };
    let record = format!("/Users/{user}");
    Some(
        words
            .into_iter()
            .map(|word| {
                if system == "macos" && word.is_empty() {
                    record.clone()
                } else {
                    word.to_string()
                }
            })
            .collect(),
    )
}

/// Whether what a system tool says of an account means it is locked:
/// `passwd -S` on Linux (`alice L 2026-…`), the authentication authority on
/// macOS.
pub fn says_locked(system: &str, output: &str) -> bool {
    match system {
        "linux" => output
            .split_whitespace()
            .nth(1)
            .is_some_and(|state| state.starts_with('L')),
        "macos" => output.contains(";DisabledUser;"),
        _ => false,
    }
}

async fn run(command: &[String]) -> Result<String, String> {
    let (program, arguments) = command.split_first().ok_or("empty command")?;
    let mut process = agent_common::process::silent_async_command(program);
    process.args(arguments).kill_on_drop(true);
    let output = tokio::time::timeout(COMMAND_TIMEOUT, process.output())
        .await
        .map_err(|_| format!("{program} did not answer"))?
        .map_err(|e| format!("{program} could not be run: {e}"))?;
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    if output.status.success() {
        Ok(text)
    } else {
        Err(format!(
            "{program} failed: {}",
            text.lines().next().unwrap_or("no message").trim()
        ))
    }
}

fn words(words: &[&str]) -> Vec<String> {
    words.iter().map(|word| (*word).to_string()).collect()
}

/// Whether the account is locked already.
async fn is_locked(user: &str, inventory: &SystemInventory) -> bool {
    let system = std::env::consts::OS;
    let state = match system {
        "linux" => run(&words(&["passwd", "-S", user])).await,
        "macos" => {
            let record = format!("/Users/{user}");
            run(&words(&[
                "/usr/bin/dscl",
                ".",
                "-read",
                &record,
                "AuthenticationAuthority",
            ]))
            .await
        }
        // Windows says it in the language of the system; the inventory has
        // read it already.
        _ => {
            return inventory
                .users
                .iter()
                .any(|u| u.name.eq_ignore_ascii_case(user) && !u.can_log_in);
        }
    };
    state.is_ok_and(|output| says_locked(system, &output))
}

/// The account using the machine now (macOS: the owner of the console).
async fn console_user() -> Option<String> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    run(&words(&["/usr/bin/stat", "-f", "%Su", "/dev/console"]))
        .await
        .ok()
        .map(|user| user.trim().to_string())
        .filter(|user| !user.is_empty() && user != "root")
}

/// The account this process runs as.
fn own_user() -> Option<String> {
    ["SUDO_USER", "USER", "USERNAME", "LOGNAME"]
        .iter()
        .filter_map(|name| std::env::var(name).ok())
        .find(|user| !user.is_empty() && user != "root")
}

fn pending_path() -> PathBuf {
    AgentConfig::platform_data_dir().join("pending_account_locks.json")
}

async fn load_pending() -> HashMap<String, i64> {
    match tokio::fs::read(pending_path()).await {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

async fn store_pending(entries: &HashMap<String, i64>) {
    let path = pending_path();
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    match serde_json::to_vec(entries) {
        Ok(json) => {
            if let Err(e) = tokio::fs::write(&path, json).await {
                warn!("Failed to record the accounts to unlock: {}", e);
            }
        }
        Err(e) => warn!("Failed to record the accounts to unlock: {}", e),
    }
}

/// Which recorded locks are over at `now`, and which are still running
/// (with the seconds left).
pub fn due(entries: &HashMap<String, i64>, now: i64) -> (Vec<String>, Vec<(String, u64)>) {
    let mut over = Vec::new();
    let mut running = Vec::new();
    for (user, until) in entries {
        // Locked until an administrator decides otherwise.
        if *until == i64::MAX {
            continue;
        }
        if *until <= now {
            over.push(user.clone());
        } else {
            running.push((user.clone(), u64::try_from(until - now).unwrap_or(0)));
        }
    }
    over.sort();
    running.sort();
    (over, running)
}

fn unlock_later(user: String, seconds: u64) {
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(seconds)).await;
        if let Err(e) = enable_account(&user).await {
            warn!(
                "Failed to unlock account '{}' at the end of its lock: {}",
                user, e
            );
        }
    });
}

/// Lock a local account. With `duration_secs` above 0 it is unlocked when
/// that time has passed.
pub async fn disable_account(user: &str, duration_secs: u64) -> Result<(), CommonError> {
    info!("Locking account '{}' for {} seconds", user, duration_secs);

    // Changing an account needs root: the desktop app hands it to the
    // service, as it does for the firewall.
    if !crate::service::is_admin() {
        return crate::privileged::delegate(crate::privileged::Request::DisableAccount {
            user: user.to_string(),
            duration_secs,
        })
        .await
        .map(|_| ());
    }

    let system = std::env::consts::OS;
    let inventory = tokio::task::spawn_blocking(agent_scanner::inventory::collect)
        .await
        .map_err(|e| CommonError::internal(format!("accounts could not be listed: {e}")))?;
    if inventory.users.is_empty() {
        return Err(CommonError::internal(
            "accounts could not be listed: nothing is locked without knowing them",
        ));
    }
    let console = console_user().await;
    if let Some(reason) = refusal(
        user,
        &inventory,
        own_user().as_deref(),
        console.as_deref(),
        system,
    ) {
        return Err(CommonError::internal(format!("Refusing to lock: {reason}")));
    }
    if is_locked(user, &inventory).await {
        info!("Account '{}' is already locked: left as it is", user);
        return Ok(());
    }

    let command = lock_command(system, user, true)
        .ok_or_else(|| CommonError::internal("locking an account is not supported here"))?;
    run(&command).await.map_err(CommonError::internal)?;

    // A lock that leaves the sessions open has contained nothing.
    if system != "windows"
        && run(&words(&["loginctl", "terminate-user", user]))
            .await
            .is_err()
    {
        let _ = run(&words(&["pkill", "-KILL", "-u", user])).await;
    }

    // Recorded even without an end: the agent only unlocks what it locked.
    let until = if duration_secs > 0 {
        chrono::Utc::now()
            .timestamp()
            .saturating_add_unsigned(duration_secs)
    } else {
        i64::MAX
    };
    let mut pending = load_pending().await;
    pending.insert(user.to_string(), until);
    store_pending(&pending).await;
    if duration_secs > 0 {
        unlock_later(user.to_string(), duration_secs);
    }
    Ok(())
}

/// Unlock an account the agent locked.
pub async fn enable_account(user: &str) -> Result<(), CommonError> {
    info!("Unlocking account '{}'", user);
    if !crate::service::is_admin() {
        return crate::privileged::delegate(crate::privileged::Request::EnableAccount {
            user: user.to_string(),
        })
        .await
        .map(|_| ());
    }
    if !is_account_name(user) {
        return Err(CommonError::internal(format!(
            "'{user}' is not an account name"
        )));
    }
    // Only what the agent locked is unlocked: an account an administrator
    // locked on purpose is not the agent's to give back.
    let mut pending = load_pending().await;
    if pending.remove(user).is_none() {
        return Err(CommonError::internal(format!(
            "account '{user}' was not locked by the agent"
        )));
    }
    let command = lock_command(std::env::consts::OS, user, false)
        .ok_or_else(|| CommonError::internal("unlocking an account is not supported here"))?;
    run(&command).await.map_err(CommonError::internal)?;
    store_pending(&pending).await;
    Ok(())
}

/// Unlock the accounts whose lock ended while the agent was stopped, and
/// wait for the end of the others.
pub async fn reconcile_pending_locks() {
    if !crate::service::is_admin() {
        return;
    }
    let pending = load_pending().await;
    if pending.is_empty() {
        return;
    }
    let (over, running) = due(&pending, chrono::Utc::now().timestamp());
    for user in over {
        if let Err(e) = enable_account(&user).await {
            warn!("Failed to unlock account '{}': {}", user, e);
        }
    }
    for (user, seconds) in running {
        unlock_later(user, seconds);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_scanner::inventory::{GroupEntry, UserAccount};

    fn user(name: &str, id: &str, can_log_in: bool) -> UserAccount {
        UserAccount {
            name: name.to_string(),
            id: id.to_string(),
            group_id: None,
            home: None,
            shell: None,
            can_log_in,
        }
    }

    fn linux() -> SystemInventory {
        SystemInventory {
            collected_at: None,
            users: vec![
                user("root", "0", true),
                user("toor", "0", true),
                user("www-data", "33", false),
                user("alice", "1000", true),
                user("bob", "1001", true),
                user("deploy", "1002", true),
            ],
            groups: vec![GroupEntry {
                name: "sudo".to_string(),
                id: None,
                members: vec!["alice".to_string(), "bob".to_string()],
            }],
            ..SystemInventory::default()
        }
    }

    fn refused(user: &str, inventory: &SystemInventory) -> String {
        refusal(user, inventory, Some("sentinel"), None, "linux").unwrap_or_default()
    }

    #[test]
    fn an_ordinary_account_may_be_locked() {
        let inventory = linux();
        assert_eq!(
            refusal("deploy", &inventory, Some("sentinel"), None, "linux"),
            None
        );
        // An administrator too, while another one remains.
        assert_eq!(
            refusal("bob", &inventory, Some("sentinel"), None, "linux"),
            None
        );
    }

    #[test]
    fn the_accounts_that_would_lock_the_owner_out_are_refused() {
        let inventory = linux();
        assert!(refused("root", &inventory).contains("administrator account"));
        // Another name with the identifier of root is root.
        assert!(refused("toor", &inventory).contains("administrator account"));
        assert!(refused("www-data", &inventory).contains("system account"));
        assert!(refused("nobody-here", &inventory).contains("no local account"));
        assert!(refused("alice; rm -rf /", &inventory).contains("not an account name"));
        assert!(refused("-L", &inventory).contains("not an account name"));
        assert!(refused("", &inventory).contains("not an account name"));

        assert!(
            refusal("alice", &inventory, Some("alice"), None, "linux")
                .unwrap()
                .contains("the agent runs as")
        );
        assert!(
            refusal("alice", &inventory, None, Some("alice"), "macos")
                .unwrap()
                .contains("using this machine now")
        );
    }

    #[test]
    fn the_last_administrator_is_never_locked() {
        let mut inventory = linux();
        inventory.groups[0].members = vec!["alice".to_string()];
        assert!(refused("alice", &inventory).contains("last account that can administer"));
        // An administrator who cannot log in does not count as another one.
        inventory.groups[0].members = vec!["alice".to_string(), "bob".to_string()];
        inventory.users[4].can_log_in = false;
        assert!(refused("alice", &inventory).contains("last account that can administer"));
        // Someone who administers nothing is not concerned.
        assert_eq!(refused("deploy", &inventory), "");
    }

    #[test]
    fn windows_accounts_are_known_by_identifier_and_whatever_the_case() {
        let inventory = SystemInventory {
            collected_at: None,
            users: vec![
                user("Admin2", "S-1-5-21-1-2-3-500", true),
                user("Bob", "S-1-5-21-1-2-3-1001", true),
                user("Carol", "S-1-5-21-1-2-3-1002", true),
            ],
            groups: vec![GroupEntry {
                name: "Administrators".to_string(),
                id: None,
                members: vec![r"PC\Admin2".to_string(), r"PC\Bob".to_string()],
            }],
            ..SystemInventory::default()
        };
        // The built-in administrator, renamed.
        assert!(
            refusal("admin2", &inventory, None, None, "windows")
                .unwrap()
                .contains("administrator account")
        );
        assert_eq!(refusal("carol", &inventory, None, None, "windows"), None);
        // The built-in administrator remains: Bob is not the last one.
        assert_eq!(refusal("BOB", &inventory, None, None, "windows"), None);
    }

    #[test]
    fn each_system_has_its_way_to_lock_and_unlock() {
        let command =
            |system: &str, lock: bool| lock_command(system, "alice", lock).unwrap().join(" ");
        assert_eq!(
            command("linux", true),
            "usermod --lock --expiredate 1 alice"
        );
        assert_eq!(
            command("linux", false),
            "usermod --unlock --expiredate  alice"
        );
        assert_eq!(
            command("macos", true),
            "/usr/bin/dscl . -append /Users/alice AuthenticationAuthority ;DisabledUser;"
        );
        assert_eq!(
            command("macos", false),
            "/usr/bin/dscl . -delete /Users/alice AuthenticationAuthority ;DisabledUser;"
        );
        assert_eq!(command("windows", true), "net user alice /active:no");
        assert!(lock_command("plan9", "alice", true).is_none());
        // The empty expiry date of the unlock is an argument of its own.
        assert_eq!(lock_command("linux", "alice", false).unwrap()[3], "");
    }

    #[test]
    fn what_the_system_says_of_a_locked_account_is_read() {
        assert!(says_locked("linux", "alice L 2026-10-11 0 99999 7 -1\n"));
        assert!(!says_locked("linux", "alice P 2026-10-11 0 99999 7 -1\n"));
        assert!(says_locked(
            "macos",
            "AuthenticationAuthority: ;ShadowHash;HASHLIST:<SALTED-SHA512-PBKDF2> ;DisabledUser;\n"
        ));
        assert!(!says_locked(
            "macos",
            "AuthenticationAuthority: ;ShadowHash;\n"
        ));
    }

    #[test]
    fn a_lock_that_ended_while_the_agent_was_stopped_is_over() {
        let entries: HashMap<String, i64> = [
            ("alice".to_string(), 1_000),
            ("bob".to_string(), 1_500),
            ("carol".to_string(), 900),
            // Locked without an end: never unlocked by the agent's clock.
            ("dave".to_string(), i64::MAX),
        ]
        .into_iter()
        .collect();
        let (over, running) = due(&entries, 1_000);
        assert_eq!(over, ["alice", "carol"]);
        assert_eq!(running, [("bob".to_string(), 500)]);
    }
}
