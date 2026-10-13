// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Signs of a rootkit: what the system hides, and what is hidden in it.
//!
//! A rootkit makes the system lie: a process that runs but is not listed, a
//! port that answers but is not shown, a kernel module missing from the
//! list of modules. The checks here ask the same question two ways and
//! report where the answers differ, and look at the places such tools are
//! known to settle in.
//!
//! | Check                    | How                                                          | Linux | macOS |
//! |--------------------------|--------------------------------------------------------------|:-----:|:-----:|
//! | Hidden process           | every process number is probed; one that answers but is not listed is hidden | ✓ | ✓ |
//! | Hidden listening port    | every port is bound; one that is taken, not listed, and accepts a connection is hidden | ✓ | ✓ |
//! | Hidden kernel module     | `/sys/module` against `/proc/modules`                        |   ✓   |       |
//! | Library forced on every program | `/etc/ld.so.preload`, `LD_PRELOAD` in `/etc/environment`, `DYLD_INSERT_LIBRARIES` in a launch item | ✓ | ✓ |
//! | Interface capturing traffic | promiscuous flag of the interfaces                         |   ✓   |   ✓   |
//! | Files where none belong  | regular files in `/dev`, hidden programs in temporary directories | ✓ | ✓ |
//! | Process whose program was deleted | a program run from a temporary directory or from memory, then removed | ✓ |  |
//! | Known rootkit files      | paths left by rootkits that have been published              |   ✓   |       |
//!
//! Windows is not covered.
//!
//! # Limits, stated plainly
//!
//! - These checks run in user space, with the answers the kernel gives. A
//!   rootkit in the kernel that falsifies both ways of asking is not seen.
//! - A hidden port is reported only when it accepts a connection on the
//!   loopback address: a port merely reserved by a program is not a
//!   listener, and reporting it would be a false alarm. A hidden listener
//!   bound to one external address only is therefore missed.
//! - Ports below 1024 are probed only when the agent runs as root.
//! - On macOS the hidden port check needs the whole list of ports in use:
//!   `netstat` gives it only to a program with the Local Network permission
//!   (macOS 15 and later), `lsof` only to root. Without either, the check
//!   is skipped rather than made on a partial list.
//! - A process whose program was deleted is read from `/proc/<pid>/exe`,
//!   which an unprivileged agent may read for its own account only.
//! - The list of known rootkit files is short and ages: the other checks,
//!   which do not depend on a name, are the ones that matter.
//!
//! A finding is reported once a day, not at every scan.

use super::{IncidentSeverity, IncidentType, SecurityIncident};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tracing::{debug, info};

/// Time between two probes of every process number and every port.
const SWEEP_EVERY: Duration = Duration::from_secs(60 * 60);
/// Time during which a finding already reported is not reported again.
const REPORT_AGAIN_AFTER: Duration = Duration::from_secs(24 * 60 * 60);
/// Pause between the two readings that confirm a hidden process or port:
/// what appeared in between is not hidden, only new.
#[cfg_attr(not(any(target_os = "linux", target_os = "macos")), allow(dead_code))]
const CONFIRMATION_PAUSE: Duration = Duration::from_millis(300);
/// Largest process number probed.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const MAX_PID: u32 = 4_194_304;
/// Findings of one kind reported at most by one scan.
const MAX_FINDINGS_PER_CHECK: usize = 20;

/// Interfaces that are promiscuous by design: the virtual ends of
/// containers, virtual machines and bridges.
const VIRTUAL_INTERFACES: &[&str] = &[
    "veth", "docker", "br-", "virbr", "vnet", "tap", "tun", "cali", "flannel", "cni", "lxc",
    "vmnet", "bridge", "vmenet", "utun", "awdl", "llw", "ap", "anpi",
];

/// Libraries that some systems legitimately preload for every program.
const KNOWN_PRELOADS: &[&str] = &["libarmmem"];

/// Files left by published rootkits: the rootkit, and where it settles.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const ROOTKIT_FILES: &[(&str, &str)] = &[
    ("Reptile", "/reptile"),
    ("Reptile", "/lib/udev/rules.d/55-reptile.rules"),
    ("Jynx2", "/XxJynx"),
    ("Azazel", "/lib/libselinux.so"),
    ("Father", "/lib/selinux.so.3"),
    ("Umbreon", "/usr/share/libc.so.0"),
    ("Umbreon", "/usr/lib/libc.so.0"),
    ("Bdvl", "/lib/bdvl.so"),
    ("Symbiote", "/lib64/libsymbiote.so"),
    ("OrBit", "/lib/libntpVnQE6mk"),
    ("Adore", "/dev/.adore"),
    ("Adore", "/usr/lib/red.tar"),
    ("Knark", "/dev/.pizda"),
    ("Knark", "/proc/knark"),
    ("t0rn", "/usr/src/.puta"),
    ("t0rn", "/usr/info/.t0rn"),
    ("t0rn", "/lib/ldlib.tk"),
    ("SHV4", "/lib/lidps1.so"),
    ("SHV5", "/usr/lib/libsh"),
    ("SHV5", "/lib/libsh.so"),
    ("Suckit", "/usr/share/locale/sk/.sk12"),
    ("Suckit", "/dev/sdhu0"),
    ("Ebury", "/lib/libns2.so"),
    ("Ebury", "/lib64/libns2.so"),
    ("LRK", "/dev/ptyxx"),
    ("LRK", "/usr/lib/libproc.a"),
    ("Phalanx2", "/etc/khubd.p2"),
    ("Kaiten", "/dev/.kork"),
];

/// Something the checks found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Finding {
    HiddenProcess {
        pid: u32,
    },
    HiddenPort {
        port: u16,
    },
    HiddenKernelModule {
        name: String,
    },
    /// A library loaded into every program (`source` says by what).
    PreloadedLibrary {
        source: String,
        library: String,
    },
    PromiscuousInterface {
        interface: String,
    },
    /// A regular file in `/dev`.
    FileInDev {
        path: String,
    },
    /// A program hidden by its name in a temporary directory.
    HiddenExecutable {
        path: String,
    },
    RootkitFile {
        rootkit: String,
        path: String,
    },
    /// A running process whose program was deleted from a temporary
    /// directory, or never was a file.
    DeletedExecutable {
        pid: u32,
        exe: String,
    },
}

impl Finding {
    /// What makes two findings the same one, for reporting it once a day.
    fn key(&self) -> String {
        match self {
            // A process number is reused: the number alone would silence a
            // new hidden process. It is all that is known, so it is used,
            // for a day at most.
            Self::HiddenProcess { pid } => format!("hidden_process:{pid}"),
            Self::HiddenPort { port } => format!("hidden_port:{port}"),
            Self::HiddenKernelModule { name } => format!("hidden_module:{name}"),
            Self::PreloadedLibrary { source, library } => format!("preload:{source}:{library}"),
            Self::PromiscuousInterface { interface } => format!("promiscuous:{interface}"),
            Self::FileInDev { path } => format!("dev_file:{path}"),
            Self::HiddenExecutable { path } => format!("hidden_executable:{path}"),
            Self::RootkitFile { path, .. } => format!("rootkit_file:{path}"),
            Self::DeletedExecutable { pid, exe } => format!("deleted_exe:{pid}:{exe}"),
        }
    }

    /// The incident a finding is reported as.
    pub fn incident(&self) -> SecurityIncident {
        let (kind, severity, confidence, check, title, description, detail) = match self {
            Self::HiddenProcess { pid } => (
                IncidentType::Malware,
                IncidentSeverity::Critical,
                85,
                "hidden_process",
                format!("Hidden process (PID {pid})"),
                format!(
                    "Process {pid} is running but the system does not list it. Hiding its \
                     processes is what a rootkit does."
                ),
                serde_json::json!({ "pid": pid }),
            ),
            Self::HiddenPort { port } => (
                IncidentType::Malware,
                IncidentSeverity::Critical,
                85,
                "hidden_port",
                format!("Hidden listening port ({port}/tcp)"),
                format!(
                    "TCP port {port} accepts connections but the system does not list it as \
                     open. Hiding a listening port is what a rootkit does for its backdoor."
                ),
                serde_json::json!({ "port": port, "protocol": "tcp" }),
            ),
            Self::HiddenKernelModule { name } => (
                IncidentType::Malware,
                IncidentSeverity::Critical,
                85,
                "hidden_kernel_module",
                format!("Hidden kernel module ({name})"),
                format!(
                    "Kernel module '{name}' is loaded but absent from the list of modules. \
                     A module that removes itself from the list is a kernel rootkit."
                ),
                serde_json::json!({ "module": name }),
            ),
            Self::PreloadedLibrary { source, library } => (
                IncidentType::UnauthorizedChange,
                IncidentSeverity::High,
                75,
                "preloaded_library",
                format!("Library forced on every program ({library})"),
                format!(
                    "{source} makes every program load {library}. This is how user-space \
                     rootkits hide files and processes and capture credentials; a few \
                     monitoring tools use it legitimately."
                ),
                serde_json::json!({ "source": source, "library": library }),
            ),
            Self::PromiscuousInterface { interface } => (
                IncidentType::SuspiciousProcess,
                IncidentSeverity::Medium,
                55,
                "promiscuous_interface",
                format!("Network interface capturing all traffic ({interface})"),
                format!(
                    "Interface {interface} is in promiscuous mode: it receives the traffic of \
                     the whole segment, as a capture tool makes it do. A virtual machine in \
                     bridged mode has the same effect."
                ),
                serde_json::json!({ "interface": interface }),
            ),
            Self::FileInDev { path } => (
                IncidentType::SuspiciousProcess,
                IncidentSeverity::Medium,
                55,
                "file_in_dev",
                format!("Regular file in /dev ({path})"),
                format!(
                    "{path} is a regular file in the directory of devices, where only device \
                     nodes belong. Rootkits keep their files there."
                ),
                serde_json::json!({ "path": path }),
            ),
            Self::HiddenExecutable { path } => (
                IncidentType::SuspiciousProcess,
                IncidentSeverity::Medium,
                60,
                "hidden_executable",
                format!("Hidden program in a temporary directory ({path})"),
                format!(
                    "{path} is a program whose name hides it, in a directory anyone may \
                     write to."
                ),
                serde_json::json!({ "path": path }),
            ),
            Self::RootkitFile { rootkit, path } => (
                IncidentType::Malware,
                IncidentSeverity::Critical,
                80,
                "rootkit_file",
                format!("File of the {rootkit} rootkit ({path})"),
                format!("{path} exists: it is a file the {rootkit} rootkit is known to leave."),
                serde_json::json!({ "rootkit": rootkit, "path": path }),
            ),
            Self::DeletedExecutable { pid, exe } => (
                IncidentType::SuspiciousProcess,
                IncidentSeverity::High,
                70,
                "deleted_executable",
                format!("Process running a deleted program (PID {pid})"),
                format!(
                    "Process {pid} runs {exe}, which no longer exists on disk: it was run from \
                     a temporary location or from memory, then removed, as malware does to \
                     leave no file behind."
                ),
                serde_json::json!({ "pid": pid, "exe": exe }),
            ),
        };
        let mut evidence = serde_json::json!({ "detection": "rootcheck", "check": check });
        if let (Some(evidence), Some(detail)) = (evidence.as_object_mut(), detail.as_object()) {
            evidence.extend(detail.clone());
        }
        SecurityIncident::new(kind, severity, title, description)
            .with_confidence(confidence)
            .with_evidence(evidence)
    }
}

/// Process numbers that answer without being listed.
///
/// `alive` says whether a number answers, `listed` gives the numbers the
/// system lists, `is_thread` says whether a number is a thread of a listed
/// process (Linux lists processes, not their threads, and both answer).
/// A number is hidden when it answers and is absent from two listings taken
/// some time apart: a process that started between the two is only new.
pub fn hidden_processes(
    max: u32,
    listed: &dyn Fn() -> HashSet<u32>,
    alive: &dyn Fn(u32) -> bool,
    is_thread: &dyn Fn(u32) -> bool,
    pause: Duration,
) -> Vec<u32> {
    let first = listed();
    let candidates: Vec<u32> = (1..=max)
        .filter(|pid| !first.contains(pid) && alive(*pid) && !is_thread(*pid))
        .collect();
    if candidates.is_empty() {
        return candidates;
    }
    std::thread::sleep(pause);
    let second = listed();
    candidates
        .into_iter()
        .filter(|pid| !second.contains(pid) && alive(*pid) && !is_thread(*pid))
        .collect()
}

/// Ports taken that the system does not list.
///
/// `taken` says whether a port cannot be bound because it is in use,
/// `listed` gives the ports the system lists, `accepts` says whether a
/// connection to the port is accepted.
pub fn hidden_ports(
    ports: std::ops::RangeInclusive<u16>,
    listed: &dyn Fn() -> HashSet<u16>,
    taken: &dyn Fn(u16) -> bool,
    accepts: &dyn Fn(u16) -> bool,
    pause: Duration,
) -> Vec<u16> {
    let first = listed();
    let candidates: Vec<u16> = ports
        .filter(|port| !first.contains(port) && taken(*port))
        .collect();
    if candidates.is_empty() {
        return candidates;
    }
    std::thread::sleep(pause);
    let second = listed();
    candidates
        .into_iter()
        .filter(|port| !second.contains(port) && taken(*port) && accepts(*port))
        .collect()
}

/// The local ports of `/proc/net/tcp` (or `tcp6`): the second column is
/// `address:port` in hexadecimal.
pub fn parse_proc_net_ports(content: &str) -> HashSet<u16> {
    content
        .lines()
        .skip(1)
        .filter_map(|line| line.split_whitespace().nth(1))
        .filter_map(|local| local.rsplit(':').next())
        .filter_map(|port| u16::from_str_radix(port, 16).ok())
        .collect()
}

/// The local ports of `netstat -an`: the local address ends with `.port`.
pub fn parse_netstat_ports(output: &str) -> HashSet<u16> {
    output
        .lines()
        .filter(|line| line.starts_with("tcp") || line.starts_with("udp"))
        .filter_map(|line| line.split_whitespace().nth(3))
        .filter_map(|local| local.rsplit('.').next())
        .filter_map(|port| port.parse().ok())
        .collect()
}

/// The local ports of `lsof -nP -iTCP -F n`: `n*:22`,
/// `n192.168.1.20:52000->203.0.113.9:443`.
pub fn parse_lsof_ports(output: &str) -> HashSet<u16> {
    output
        .lines()
        .filter_map(|line| line.strip_prefix('n'))
        .filter_map(|name| name.split("->").next())
        .filter_map(|local| local.rsplit(':').next())
        .filter_map(|port| port.parse().ok())
        .collect()
}

/// Loaded modules of `/sys/module` missing from `/proc/modules`.
pub fn hidden_modules(proc_modules: &str, sys_loaded: &[String]) -> Vec<String> {
    let listed: HashSet<&str> = proc_modules
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .collect();
    let mut hidden: Vec<String> = sys_loaded
        .iter()
        .filter(|name| !listed.contains(name.as_str()))
        .cloned()
        .collect();
    hidden.sort();
    hidden
}

/// The libraries named by `/etc/ld.so.preload`: one or several per line,
/// separated by spaces or colons, `#` comments.
pub fn parse_preload(content: &str) -> Vec<String> {
    content
        .lines()
        .map(|line| line.split('#').next().unwrap_or(""))
        .flat_map(|line| line.split([' ', '\t', ':']))
        .map(str::trim)
        .filter(|library| !library.is_empty())
        .filter(|library| !KNOWN_PRELOADS.iter().any(|known| library.contains(known)))
        .map(str::to_string)
        .collect()
}

/// The value of `LD_PRELOAD` in a file of `NAME=value` lines.
pub fn parse_environment_preload(content: &str) -> Vec<String> {
    content
        .lines()
        .map(str::trim)
        .filter(|line| !line.starts_with('#'))
        .filter_map(|line| {
            line.strip_prefix("export ")
                .unwrap_or(line)
                .strip_prefix("LD_PRELOAD=")
        })
        .flat_map(|value| parse_preload(value.trim_matches(['"', '\''])))
        .collect()
}

fn is_virtual_interface(name: &str) -> bool {
    VIRTUAL_INTERFACES
        .iter()
        .any(|prefix| name.starts_with(prefix))
}

/// The promiscuous interfaces of `ifconfig -a` (macOS and the BSDs).
///
/// The members of a bridge are left out: a bridge puts its ports in
/// promiscuous mode by design (the Thunderbolt ports of a Mac are members
/// of `bridge0` from the factory).
pub fn parse_ifconfig_promiscuous(output: &str) -> Vec<String> {
    let bridged: HashSet<&str> = output
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("member: "))
        .filter_map(|member| member.split_whitespace().next())
        .collect();
    output
        .lines()
        .filter(|line| !line.starts_with([' ', '\t']))
        .filter_map(|line| {
            let (name, rest) = line.split_once(':')?;
            let flags = rest.split_once('<')?.1.split_once('>')?.0;
            flags
                .split(',')
                .any(|flag| flag == "PROMISC")
                .then_some(name)
        })
        .filter(|name| !is_virtual_interface(name) && !bridged.contains(name))
        .map(str::to_string)
        .collect()
}

/// Whether a file starts like a program (ELF, Mach-O, or a universal binary).
pub fn is_program(path: &Path) -> bool {
    use std::io::Read;
    let mut magic = [0u8; 4];
    let read = std::fs::File::open(path).and_then(|mut file| file.read_exact(&mut magic));
    read.is_ok()
        && matches!(
            magic,
            [0x7f, b'E', b'L', b'F']
                | [0xfe, 0xed, 0xfa, 0xce]
                | [0xfe, 0xed, 0xfa, 0xcf]
                | [0xce, 0xfa, 0xed, 0xfe]
                | [0xcf, 0xfa, 0xed, 0xfe]
                | [0xca, 0xfe, 0xba, 0xbe]
        )
}

/// Programs hidden by their name (a leading dot) in `directory` and one
/// level below it.
pub fn hidden_executables(directory: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    for entry in walkdir::WalkDir::new(directory)
        .max_depth(2)
        .follow_links(false)
        .into_iter()
        .flatten()
    {
        let hidden = entry.file_name().to_string_lossy().starts_with('.');
        if hidden && entry.file_type().is_file() && is_program(entry.path()) {
            found.push(entry.into_path());
            if found.len() >= MAX_FINDINGS_PER_CHECK {
                break;
            }
        }
    }
    found
}

/// Whether the program a process runs (`/proc/<pid>/exe`) was deleted from
/// a place malware runs from: a temporary directory, or memory.
pub fn is_suspicious_deleted_exe(exe: &str) -> bool {
    let Some(path) = exe.strip_suffix(" (deleted)") else {
        return false;
    };
    if let Some(name) = path.strip_prefix("/memfd:") {
        // The container runtime runs a copy of itself held in memory.
        return !name.starts_with("runc_cloned");
    }
    ["/tmp/", "/var/tmp/", "/dev/shm/", "/run/shm/"]
        .iter()
        .any(|directory| path.starts_with(directory))
}

/// Launch items forcing a library on the program they start.
pub fn launch_items_injecting(directories: &[&Path]) -> Vec<PathBuf> {
    let needle = b"DYLD_INSERT_LIBRARIES";
    let mut found = Vec::new();
    for directory in directories {
        let Ok(entries) = std::fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .extension()
                .is_none_or(|extension| extension != "plist")
            {
                continue;
            }
            // The name of the variable is plain text in both plist formats.
            let injects = std::fs::read(&path)
                .is_ok_and(|bytes| bytes.windows(needle.len()).any(|window| window == needle));
            if injects {
                found.push(path);
            }
        }
    }
    found.sort();
    found
}

#[cfg(unix)]
fn pid_answers(pid: u32) -> bool {
    let Ok(pid) = libc::pid_t::try_from(pid) else {
        return false;
    };
    // Signal 0 delivers nothing: it only says whether the process exists.
    // SAFETY: `kill` with signal 0 has no effect on the target.
    let result = unsafe { libc::kill(pid, 0) };
    result == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

/// Whether a TCP port cannot be bound because it is in use.
///
/// The socket is bound and closed, never put in the listening state: a
/// program that listens on every address makes the macOS firewall ask the
/// user whether to allow it, once per port.
#[cfg(unix)]
fn port_is_taken(port: u16) -> bool {
    // SAFETY: a socket is created, bound to an address built here, and
    // closed; no memory is shared with the calls beyond that address.
    unsafe {
        let socket = libc::socket(libc::AF_INET, libc::SOCK_STREAM, 0);
        if socket < 0 {
            return false;
        }
        let mut address: libc::sockaddr_in = std::mem::zeroed();
        address.sin_family = libc::AF_INET as libc::sa_family_t;
        address.sin_port = port.to_be();
        let length = std::mem::size_of::<libc::sockaddr_in>() as libc::socklen_t;
        let bound = libc::bind(socket, std::ptr::addr_of!(address).cast(), length);
        let in_use =
            bound != 0 && std::io::Error::last_os_error().raw_os_error() == Some(libc::EADDRINUSE);
        libc::close(socket);
        in_use
    }
}

#[cfg(unix)]
fn port_accepts(port: u16) -> bool {
    let address = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    std::net::TcpStream::connect_timeout(&address, Duration::from_millis(500)).is_ok()
}

#[cfg(unix)]
fn first_port() -> u16 {
    // SAFETY: `geteuid` only reads the identity of the process.
    if unsafe { libc::geteuid() } == 0 {
        1
    } else {
        1024
    }
}

#[cfg(target_os = "linux")]
mod system {
    use super::*;

    fn listed_pids() -> HashSet<u32> {
        std::fs::read_dir("/proc")
            .map(|entries| {
                entries
                    .flatten()
                    .filter_map(|entry| entry.file_name().to_string_lossy().parse().ok())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Whether a number is a thread of another process: its thread group is
    /// not itself.
    fn is_thread(pid: u32) -> bool {
        std::fs::read_to_string(format!("/proc/{pid}/status"))
            .ok()
            .and_then(|status| {
                status
                    .lines()
                    .find_map(|line| line.strip_prefix("Tgid:"))
                    .and_then(|group| group.trim().parse::<u32>().ok())
            })
            .is_some_and(|group| group != pid)
    }

    fn pid_max() -> u32 {
        std::fs::read_to_string("/proc/sys/kernel/pid_max")
            .ok()
            .and_then(|max| max.trim().parse().ok())
            .unwrap_or(32_768)
            .min(MAX_PID)
    }

    fn listed_ports() -> HashSet<u16> {
        ["/proc/net/tcp", "/proc/net/tcp6"]
            .iter()
            .filter_map(|path| std::fs::read_to_string(path).ok())
            .flat_map(|content| parse_proc_net_ports(&content))
            .collect()
    }

    pub(super) fn sweep() -> Vec<Finding> {
        let mut findings: Vec<Finding> = hidden_processes(
            pid_max(),
            &listed_pids,
            &pid_answers,
            &is_thread,
            CONFIRMATION_PAUSE,
        )
        .into_iter()
        .map(|pid| Finding::HiddenProcess { pid })
        .collect();
        findings.extend(
            hidden_ports(
                first_port()..=u16::MAX,
                &listed_ports,
                &port_is_taken,
                &port_accepts,
                CONFIRMATION_PAUSE,
            )
            .into_iter()
            .map(|port| Finding::HiddenPort { port }),
        );
        findings
    }

    fn loaded_modules_in_sys() -> Vec<String> {
        std::fs::read_dir("/sys/module")
            .map(|entries| {
                entries
                    .flatten()
                    // Built-in modules have a directory too, without a state.
                    .filter(|entry| entry.path().join("initstate").exists())
                    .map(|entry| entry.file_name().to_string_lossy().to_string())
                    .collect()
            })
            .unwrap_or_default()
    }

    fn promiscuous_interfaces() -> Vec<String> {
        const IFF_PROMISC: u32 = 0x100;
        let Ok(entries) = std::fs::read_dir("/sys/class/net") else {
            return Vec::new();
        };
        entries
            .flatten()
            .filter(|entry| {
                let path = entry.path();
                let flags = std::fs::read_to_string(path.join("flags"))
                    .ok()
                    .and_then(|flags| {
                        u32::from_str_radix(flags.trim().trim_start_matches("0x"), 16).ok()
                    })
                    .unwrap_or(0);
                // A bridge and its ports are promiscuous by design.
                flags & IFF_PROMISC != 0
                    && !path.join("brport").exists()
                    && !path.join("bridge").exists()
                    && !path.join("master").exists()
            })
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .filter(|name| !is_virtual_interface(name))
            .collect()
    }

    /// Regular files in `/dev`, outside the directories that hold some.
    fn files_in_dev() -> Vec<String> {
        const HOLD_FILES: &[&str] = &["shm", "mqueue", "hugepages", ".udev", ".lxc", ".mdadm"];
        // Regular files the system itself keeps in `/dev`.
        const KNOWN_FILES: &[&str] = &[".lxc-boot-id", ".blkid.tab", ".blkid.tab.old"];
        let mut found = Vec::new();
        for entry in walkdir::WalkDir::new("/dev")
            .max_depth(3)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| {
                entry.depth() != 1
                    || !HOLD_FILES.contains(&entry.file_name().to_string_lossy().as_ref())
            })
            .flatten()
        {
            // The type the directory gives is that of its entry: a device
            // mounted over a placeholder file (as container runtimes do for
            // `/dev/kmsg` and others) is listed as a regular file. Only the
            // file itself says what it is.
            let regular = entry.file_type().is_file()
                && !KNOWN_FILES.contains(&entry.file_name().to_string_lossy().as_ref())
                && std::fs::symlink_metadata(entry.path())
                    .is_ok_and(|metadata| metadata.file_type().is_file());
            if regular {
                found.push(entry.path().to_string_lossy().to_string());
                if found.len() >= MAX_FINDINGS_PER_CHECK {
                    break;
                }
            }
        }
        found
    }

    fn deleted_executables() -> Vec<Finding> {
        listed_pids()
            .into_iter()
            .filter_map(|pid| {
                let exe = std::fs::read_link(format!("/proc/{pid}/exe")).ok()?;
                let exe = exe.to_string_lossy().to_string();
                is_suspicious_deleted_exe(&exe).then_some(Finding::DeletedExecutable { pid, exe })
            })
            .take(MAX_FINDINGS_PER_CHECK)
            .collect()
    }

    pub(super) fn inspect() -> (Vec<Finding>, u32) {
        let mut findings = Vec::new();

        if let Ok(proc_modules) = std::fs::read_to_string("/proc/modules") {
            findings.extend(
                hidden_modules(&proc_modules, &loaded_modules_in_sys())
                    .into_iter()
                    .map(|name| Finding::HiddenKernelModule { name }),
            );
        }
        for library in std::fs::read_to_string("/etc/ld.so.preload")
            .map(|content| parse_preload(&content))
            .unwrap_or_default()
        {
            findings.push(Finding::PreloadedLibrary {
                source: "/etc/ld.so.preload".to_string(),
                library,
            });
        }
        for library in std::fs::read_to_string("/etc/environment")
            .map(|content| parse_environment_preload(&content))
            .unwrap_or_default()
        {
            findings.push(Finding::PreloadedLibrary {
                source: "LD_PRELOAD in /etc/environment".to_string(),
                library,
            });
        }
        findings.extend(
            promiscuous_interfaces()
                .into_iter()
                .map(|interface| Finding::PromiscuousInterface { interface }),
        );
        findings.extend(
            files_in_dev()
                .into_iter()
                .map(|path| Finding::FileInDev { path }),
        );
        for directory in ["/tmp", "/var/tmp", "/dev/shm"] {
            findings.extend(
                hidden_executables(Path::new(directory))
                    .into_iter()
                    .map(|path| Finding::HiddenExecutable {
                        path: path.to_string_lossy().to_string(),
                    }),
            );
        }
        findings.extend(deleted_executables());
        findings.extend(
            ROOTKIT_FILES
                .iter()
                .filter(|(_, path)| std::fs::symlink_metadata(path).is_ok())
                .map(|(rootkit, path)| Finding::RootkitFile {
                    rootkit: (*rootkit).to_string(),
                    path: (*path).to_string(),
                }),
        );
        (findings, 8)
    }

    pub(super) const SWEEP_CHECKS: u32 = 2;
}

#[cfg(target_os = "macos")]
mod system {
    use super::*;
    use agent_common::process::silent_command;

    fn listed_pids() -> HashSet<u32> {
        // SAFETY: with a null buffer the call only returns the number of
        // processes; with a buffer of that size it fills it.
        let count = unsafe { libc::proc_listallpids(std::ptr::null_mut(), 0) };
        let Ok(count) = usize::try_from(count) else {
            return HashSet::new();
        };
        // Room for the processes started since the count was taken.
        let mut pids = vec![0 as libc::pid_t; count + 64];
        let bytes = libc::c_int::try_from(pids.len() * std::mem::size_of::<libc::pid_t>())
            .unwrap_or(libc::c_int::MAX);
        // SAFETY: the buffer is `bytes` long and outlives the call.
        let filled = unsafe { libc::proc_listallpids(pids.as_mut_ptr().cast(), bytes) };
        let Ok(filled) = usize::try_from(filled) else {
            return HashSet::new();
        };
        pids.truncate(filled.min(pids.len()));
        pids.into_iter()
            .filter_map(|pid| u32::try_from(pid).ok())
            .filter(|pid| *pid > 0)
            .collect()
    }

    /// Every local TCP port in use, or nothing when the system does not
    /// give the whole list: `netstat` answers nothing to a program without
    /// the Local Network permission (macOS 15 and later), and `lsof` shows
    /// every process only to root.
    fn listed_ports() -> HashSet<u16> {
        let mut ports: HashSet<u16> = silent_command("/usr/sbin/netstat")
            .args(["-an", "-p", "tcp"])
            .output()
            .map(|output| parse_netstat_ports(&String::from_utf8_lossy(&output.stdout)))
            .unwrap_or_default();
        if first_port() == 1 {
            // Root: `lsof` sees the sockets of every process.
            if let Ok(output) = silent_command("/usr/sbin/lsof")
                .args(["-nP", "-iTCP", "-F", "n"])
                .output()
            {
                ports.extend(parse_lsof_ports(&String::from_utf8_lossy(&output.stdout)));
            }
        }
        ports
    }

    pub(super) fn sweep() -> Vec<Finding> {
        // Process numbers stop below 100000 on macOS.
        let listed = listed_pids();
        if listed.is_empty() {
            debug!("Rootcheck: the process list could not be read, sweep skipped");
            return Vec::new();
        }
        let mut findings: Vec<Finding> = hidden_processes(
            99_999,
            &listed_pids,
            &pid_answers,
            &|_| false,
            CONFIRMATION_PAUSE,
        )
        .into_iter()
        .map(|pid| Finding::HiddenProcess { pid })
        .collect();
        // Without the whole list of ports, every port in use would look
        // hidden: the check is skipped rather than made on a partial list.
        if listed_ports().is_empty() {
            debug!("Rootcheck: the list of ports is not available, hidden ports not checked");
        } else {
            findings.extend(
                hidden_ports(
                    first_port()..=u16::MAX,
                    &listed_ports,
                    &port_is_taken,
                    &port_accepts,
                    CONFIRMATION_PAUSE,
                )
                .into_iter()
                .map(|port| Finding::HiddenPort { port }),
            );
        }
        findings
    }

    pub(super) fn inspect() -> (Vec<Finding>, u32) {
        let mut findings = Vec::new();
        if let Ok(output) = silent_command("/sbin/ifconfig").arg("-a").output() {
            findings.extend(
                parse_ifconfig_promiscuous(&String::from_utf8_lossy(&output.stdout))
                    .into_iter()
                    .map(|interface| Finding::PromiscuousInterface { interface }),
            );
        }
        for plist in launch_items_injecting(&[
            Path::new("/Library/LaunchDaemons"),
            Path::new("/Library/LaunchAgents"),
        ]) {
            findings.push(Finding::PreloadedLibrary {
                source: plist.to_string_lossy().to_string(),
                library: "DYLD_INSERT_LIBRARIES".to_string(),
            });
        }
        for directory in ["/private/tmp", "/private/var/tmp", "/Users/Shared"] {
            findings.extend(
                hidden_executables(Path::new(directory))
                    .into_iter()
                    .map(|path| Finding::HiddenExecutable {
                        path: path.to_string_lossy().to_string(),
                    }),
            );
        }
        (findings, 3)
    }

    pub(super) const SWEEP_CHECKS: u32 = 2;
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
mod system {
    use super::*;

    pub(super) fn sweep() -> Vec<Finding> {
        Vec::new()
    }

    pub(super) fn inspect() -> (Vec<Finding>, u32) {
        (Vec::new(), 0)
    }

    pub(super) const SWEEP_CHECKS: u32 = 0;
}

/// What one run of the checks gave.
#[derive(Debug, Default)]
pub struct RootcheckResult {
    /// Findings not reported in the last day.
    pub incidents: Vec<SecurityIncident>,
    /// Checks performed.
    pub checks: u32,
}

/// The checks, and what they reported recently.
#[derive(Default)]
pub struct Rootcheck {
    last_sweep: Mutex<Option<Instant>>,
    reported: Mutex<HashMap<String, Instant>>,
}

impl Rootcheck {
    pub fn new() -> Self {
        Self::default()
    }

    /// Keep the findings not reported in the last day, and remember them.
    fn fresh(&self, findings: Vec<Finding>, now: Instant) -> Vec<Finding> {
        let mut reported = self.reported.lock().unwrap_or_else(|e| e.into_inner());
        reported.retain(|_, at| now.duration_since(*at) < REPORT_AGAIN_AFTER);
        findings
            .into_iter()
            .filter(|finding| reported.insert(finding.key(), now).is_none())
            .collect()
    }

    /// Run the checks. Blocking: probing every process number and every
    /// port takes about a second, and is done once an hour.
    pub fn scan(&self) -> RootcheckResult {
        let (mut findings, mut checks) = system::inspect();

        let sweep_due = {
            let mut last = self.last_sweep.lock().unwrap_or_else(|e| e.into_inner());
            let due = last.is_none_or(|at| at.elapsed() >= SWEEP_EVERY);
            if due {
                *last = Some(Instant::now());
            }
            due
        };
        if sweep_due {
            let started = Instant::now();
            let found = system::sweep();
            checks += system::SWEEP_CHECKS;
            debug!(
                "Rootcheck sweep: {} finding(s) in {:.1}s",
                found.len(),
                started.elapsed().as_secs_f32()
            );
            findings.extend(found);
        }

        let fresh = self.fresh(findings, Instant::now());
        if !fresh.is_empty() {
            info!("Rootcheck: {} new finding(s)", fresh.len());
        }
        RootcheckResult {
            incidents: fresh.iter().map(Finding::incident).collect(),
            checks,
        }
    }

    /// The findings of a full run, whatever was reported before (for a
    /// diagnostic run by hand).
    pub fn findings_now() -> Vec<Finding> {
        let (mut findings, _) = system::inspect();
        findings.extend(system::sweep());
        findings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set<T: std::hash::Hash + Eq + Copy>(items: &[T]) -> HashSet<T> {
        items.iter().copied().collect()
    }

    #[test]
    fn a_process_that_answers_without_being_listed_is_hidden() {
        let listed = || set(&[1, 2, 3, 500]);
        let alive = |pid: u32| [1, 2, 3, 500, 666].contains(&pid);
        let hidden = hidden_processes(1_000, &listed, &alive, &|_| false, Duration::ZERO);
        assert_eq!(hidden, [666]);

        // Nothing hidden: every process that answers is listed.
        let alive = |pid: u32| [1, 2, 3, 500].contains(&pid);
        assert!(hidden_processes(1_000, &listed, &alive, &|_| false, Duration::ZERO).is_empty());
    }

    #[test]
    fn a_thread_or_a_process_that_just_started_is_not_hidden() {
        // 701 is a thread of 700: it answers and is not listed, by design.
        let listed = || set(&[1, 700]);
        let alive = |pid: u32| [1, 700, 701].contains(&pid);
        let is_thread = |pid: u32| pid == 701;
        assert!(hidden_processes(1_000, &listed, &alive, &is_thread, Duration::ZERO).is_empty());

        // 800 started after the first listing: the second one has it.
        let calls = std::cell::Cell::new(0);
        let listed = || {
            calls.set(calls.get() + 1);
            if calls.get() == 1 {
                set(&[1])
            } else {
                set(&[1, 800])
            }
        };
        let alive = |pid: u32| [1, 800].contains(&pid);
        assert!(hidden_processes(1_000, &listed, &alive, &|_| false, Duration::ZERO).is_empty());

        // 900 answered once then exited: not there at the confirmation.
        let probes = std::cell::Cell::new(0);
        let alive = |pid: u32| {
            if pid == 900 {
                probes.set(probes.get() + 1);
                probes.get() == 1
            } else {
                pid == 1
            }
        };
        assert!(
            hidden_processes(1_000, &|| set(&[1]), &alive, &|_| false, Duration::ZERO).is_empty()
        );
    }

    #[test]
    fn a_port_is_hidden_only_if_taken_unlisted_and_accepting() {
        let listed = || set(&[22u16, 443]);
        let taken = |port: u16| [22, 443, 31337, 40000].contains(&port);
        // 31337 accepts connections: a hidden listener. 40000 is only
        // reserved by a program: taken, unlisted, but nobody answers.
        let accepts = |port: u16| port == 31337;
        assert_eq!(
            hidden_ports(1..=u16::MAX, &listed, &taken, &accepts, Duration::ZERO),
            [31337]
        );
        let none = |_: u16| false;
        assert!(hidden_ports(1..=u16::MAX, &listed, &none, &accepts, Duration::ZERO).is_empty());
    }

    #[test]
    fn the_kernel_tables_of_ports_are_read() {
        let proc = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n\
                    \x20  0: 00000000:0016 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 1234 1 0000000000000000 100 0 0 10 0\n\
                    \x20  1: 0100007F:1F90 0100007F:C350 01 00000000:00000000 00:00000000 00000000  1000        0 5678 1 0000000000000000 20 4 30 10 -1\n";
        assert_eq!(parse_proc_net_ports(proc), set(&[22u16, 8080]));
        let v6 = "  sl  local_address                         remote_address                        st\n\
                  \x20  0: 00000000000000000000000000000000:01BB 00000000000000000000000000000000:0000 0A\n";
        assert_eq!(parse_proc_net_ports(v6), set(&[443u16]));

        let netstat = "Active Internet connections (including servers)\n\
                       Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)\n\
                       tcp4       0      0  127.0.0.1.631          *.*                    LISTEN\n\
                       tcp6       0      0  *.22                   *.*                    LISTEN\n\
                       tcp4       0      0  192.168.1.20.52000     203.0.113.9.443        ESTABLISHED\n\
                       tcp46      0      0  *.5000                 *.*                    LISTEN\n\
                       udp4       0      0  *.*                    *.*\n";
        assert_eq!(
            parse_netstat_ports(netstat),
            set(&[631u16, 22, 52000, 5000])
        );

        let lsof = "p651\nn*:49152\nn192.168.1.20:52000->203.0.113.9:443\nn[::1]:7001\nf9\n";
        assert_eq!(parse_lsof_ports(lsof), set(&[49152u16, 52000, 7001]));
    }

    #[test]
    fn a_module_loaded_but_absent_from_the_list_is_hidden() {
        let proc = "ext4 1000000 2 - Live 0x0000000000000000\n\
                    nf_tables 300000 100 nft_ct, Live 0x0000000000000000\n";
        let sys = |names: &[&str]| names.iter().map(|n| (*n).to_string()).collect::<Vec<_>>();
        assert!(hidden_modules(proc, &sys(&["ext4", "nf_tables"])).is_empty());
        assert_eq!(
            hidden_modules(proc, &sys(&["ext4", "nf_tables", "diamorphine"])),
            ["diamorphine"]
        );
    }

    #[test]
    fn preloaded_libraries_are_read_and_the_known_ones_left_out() {
        assert_eq!(
            parse_preload("# injected\n/lib/libselinux.so  /usr/lib/x.so:/tmp/y.so\n\n"),
            ["/lib/libselinux.so", "/usr/lib/x.so", "/tmp/y.so"]
        );
        // What Raspberry Pi OS ships.
        assert!(
            parse_preload("/usr/lib/arm-linux-gnueabihf/libarmmem-${PLATFORM}.so\n").is_empty()
        );
        assert!(parse_preload("").is_empty());

        assert_eq!(
            parse_environment_preload(
                "PATH=/usr/bin\n# LD_PRELOAD=/no.so\nexport LD_PRELOAD=\"/tmp/hook.so\"\n"
            ),
            ["/tmp/hook.so"]
        );
        assert!(parse_environment_preload("LANG=C\n").is_empty());
    }

    #[test]
    fn promiscuous_interfaces_are_read_without_the_virtual_ones() {
        let ifconfig = "lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384\n\
                        \tinet 127.0.0.1 netmask 0xff000000\n\
                        en0: flags=8963<UP,BROADCAST,SMART,RUNNING,PROMISC,SIMPLEX,MULTICAST> mtu 1500\n\
                        \tether aa:bb:cc:dd:ee:ff\n\
                        en1: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500\n\
                        bridge100: flags=8963<UP,BROADCAST,SMART,RUNNING,PROMISC,SIMPLEX,MULTICAST> mtu 1500\n\
                        vmenet0: flags=8963<UP,BROADCAST,SMART,RUNNING,PROMISC,SIMPLEX,MULTICAST> mtu 1500\n";
        assert_eq!(parse_ifconfig_promiscuous(ifconfig), ["en0"]);
        assert!(is_virtual_interface("veth3f2a1b") && !is_virtual_interface("eth0"));

        // As a Mac reports its Thunderbolt ports (read from a real machine):
        // promiscuous because they are the ports of a bridge.
        let thunderbolt = "en1: flags=8963<UP,BROADCAST,SMART,RUNNING,PROMISC,SIMPLEX,MULTICAST> mtu 1500\n\
                           en2: flags=8963<UP,BROADCAST,SMART,RUNNING,PROMISC,SIMPLEX,MULTICAST> mtu 1500\n\
                           en7: flags=8963<UP,BROADCAST,SMART,RUNNING,PROMISC,SIMPLEX,MULTICAST> mtu 1500\n\
                           bridge0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500\n\
                           \tmember: en1 flags=3<LEARNING,DISCOVER>\n\
                           \tmember: en2 flags=3<LEARNING,DISCOVER>\n";
        assert_eq!(parse_ifconfig_promiscuous(thunderbolt), ["en7"]);
    }

    #[test]
    fn a_hidden_program_is_found_and_other_hidden_files_are_not() {
        let dir = tempfile::tempdir().unwrap();
        let elf = [0x7f, b'E', b'L', b'F', 2, 1, 1, 0];
        std::fs::write(dir.path().join(".x"), elf).unwrap();
        std::fs::write(dir.path().join(".config"), "key=value").unwrap();
        std::fs::write(dir.path().join("visible"), elf).unwrap();
        std::fs::create_dir(dir.path().join(".cache")).unwrap();
        std::fs::write(
            dir.path().join(".cache").join(".loader"),
            [0xcf, 0xfa, 0xed, 0xfe, 7],
        )
        .unwrap();
        std::fs::write(dir.path().join(".short"), [0x7f]).unwrap();

        let mut found: Vec<String> = hidden_executables(dir.path())
            .iter()
            .map(|path| path.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        found.sort();
        assert_eq!(found, [".loader", ".x"]);
        assert!(is_program(&dir.path().join("visible")));
        assert!(!is_program(&dir.path().join("absent")));
    }

    #[test]
    fn a_deleted_program_matters_where_malware_runs_from() {
        assert!(is_suspicious_deleted_exe("/tmp/.x (deleted)"));
        assert!(is_suspicious_deleted_exe("/dev/shm/kthreadd (deleted)"));
        assert!(is_suspicious_deleted_exe("/memfd:payload (deleted)"));
        // A daemon not restarted after its package was upgraded.
        assert!(!is_suspicious_deleted_exe("/usr/sbin/sshd (deleted)"));
        // The container runtime's own copy in memory.
        assert!(!is_suspicious_deleted_exe(
            "/memfd:runc_cloned:/proc/self/exe (deleted)"
        ));
        assert!(!is_suspicious_deleted_exe("/tmp/installer"));
    }

    #[test]
    fn a_launch_item_forcing_a_library_is_found_in_both_plist_formats() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("com.example.injected.plist"),
            "<plist><dict><key>EnvironmentVariables</key><dict>\
             <key>DYLD_INSERT_LIBRARIES</key><string>/tmp/hook.dylib</string></dict></dict></plist>",
        )
        .unwrap();
        let mut binary = b"bplist00\xd1\x01\x02".to_vec();
        binary.extend_from_slice(b"\x5fDYLD_INSERT_LIBRARIES\x5f/tmp/h.dylib");
        std::fs::write(dir.path().join("com.example.binary.plist"), binary).unwrap();
        std::fs::write(
            dir.path().join("com.example.clean.plist"),
            "<plist><dict><key>Label</key><string>clean</string></dict></plist>",
        )
        .unwrap();
        std::fs::write(dir.path().join("notes.txt"), "DYLD_INSERT_LIBRARIES").unwrap();

        let found: Vec<String> = launch_items_injecting(&[dir.path(), Path::new("/nonexistent")])
            .iter()
            .map(|path| path.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert_eq!(
            found,
            ["com.example.binary.plist", "com.example.injected.plist"]
        );
    }

    #[test]
    fn a_finding_is_reported_once_a_day() {
        let rootcheck = Rootcheck::new();
        let start = Instant::now();
        let hidden = Finding::HiddenProcess { pid: 666 };
        let port = Finding::HiddenPort { port: 31337 };

        assert_eq!(
            rootcheck.fresh(vec![hidden.clone()], start),
            std::slice::from_ref(&hidden)
        );
        // The same finding an hour later is not new; another one is.
        let later = start + Duration::from_secs(3_600);
        assert_eq!(
            rootcheck.fresh(vec![hidden.clone(), port.clone()], later),
            [port]
        );
        // A day after its last report, it is said again.
        let next_day = later + REPORT_AGAIN_AFTER;
        assert_eq!(rootcheck.fresh(vec![hidden.clone()], next_day), [hidden]);
    }

    #[test]
    fn findings_become_incidents_that_say_what_was_found() {
        let incident = Finding::HiddenKernelModule {
            name: "diamorphine".to_string(),
        }
        .incident();
        assert_eq!(incident.incident_type, IncidentType::Malware);
        assert_eq!(incident.severity, IncidentSeverity::Critical);
        assert_eq!(incident.evidence["detection"], "rootcheck");
        assert_eq!(incident.evidence["check"], "hidden_kernel_module");
        assert_eq!(incident.evidence["module"], "diamorphine");

        let preload = Finding::PreloadedLibrary {
            source: "/etc/ld.so.preload".to_string(),
            library: "/lib/libselinux.so".to_string(),
        }
        .incident();
        assert_eq!(preload.severity, IncidentSeverity::High);
        assert!(preload.description.contains("/lib/libselinux.so"));

        let promiscuous = Finding::PromiscuousInterface {
            interface: "eth0".to_string(),
        }
        .incident();
        assert_eq!(promiscuous.severity, IncidentSeverity::Medium);
    }

    /// The probes themselves, on the machine running the tests: this
    /// process answers, and a port it listens on is taken and accepts.
    #[cfg(unix)]
    #[test]
    fn the_probes_see_this_process_and_a_port_it_opens() {
        assert!(pid_answers(std::process::id()));
        assert!(!pid_answers(MAX_PID - 1));

        let listener = std::net::TcpListener::bind(("0.0.0.0", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(port_is_taken(port));
        assert!(port_accepts(port));
        drop(listener);
        assert!(!port_accepts(port));
        assert!(!port_is_taken(port));
    }
}
