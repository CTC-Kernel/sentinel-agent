// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What a container engine (Docker, Podman) says of a container: the
//! settings that weaken the isolation between the container and the host.
//!
//! The log analysis reads them at every container start, the inventory for
//! every container of the host; both read them here, from what `docker
//! inspect` or `podman inspect` prints (the same document), so that they
//! agree. The shipped Sigma rules
//! (`crates/agent-scanner/rules/containers.yml`) raise the same risks as
//! [`ContainerSettings::risks`].

use serde::{Deserialize, Serialize};
use std::path::Path;

/// Where the Docker command may be installed.
const DOCKER_PROGRAMS: &[&str] = &[
    "/usr/bin/docker",
    "/usr/local/bin/docker",
    "/snap/bin/docker",
];
/// Where the daemon of a Docker run by the system listens.
const DOCKER_SOCKETS: &[&str] = &["/var/run/docker.sock", "/run/docker.sock"];
/// Where the Podman command may be installed.
const PODMAN_PROGRAMS: &[&str] = &["/usr/bin/podman", "/usr/local/bin/podman"];

/// Sockets whose mount gives a container the control of the host's
/// containers, hence of the host.
const ENGINE_SOCKETS: &[&str] = &["docker.sock", "containerd.sock", "crio.sock", "podman.sock"];
/// Capabilities that are enough to leave a container.
const ESCAPE_CAPABILITIES: &[&str] = &["SYS_ADMIN", "SYS_MODULE", "DAC_READ_SEARCH", "ALL"];
/// Devices that give the whole disk, or the memory, of the host.
const HOST_DEVICES: &[&str] = &[
    "/dev/sd",
    "/dev/nvme",
    "/dev/vd",
    "/dev/xvd",
    "/dev/mapper",
    "/dev/mem",
    "/dev/kmem",
];

/// A container engine of the host.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Engine {
    Docker,
    Podman,
}

impl Engine {
    pub const ALL: [Self; 2] = [Self::Docker, Self::Podman];

    /// Its name, as its command and the rules call it.
    pub fn name(self) -> &'static str {
        match self {
            Self::Docker => "docker",
            Self::Podman => "podman",
        }
    }

    /// Its command, when the engine is installed and can be asked: Docker
    /// needs its daemon's socket, Podman has no daemon. A `docker` that is
    /// a script (Podman's `podman-docker`) is Podman, followed once.
    pub fn program(self) -> Option<&'static str> {
        match self {
            Self::Docker => {
                if !DOCKER_SOCKETS
                    .iter()
                    .any(|socket| Path::new(socket).exists())
                {
                    return None;
                }
                DOCKER_PROGRAMS
                    .iter()
                    .copied()
                    .find(|program| Path::new(program).is_file() && !is_script(program))
            }
            Self::Podman => PODMAN_PROGRAMS
                .iter()
                .copied()
                .find(|program| Path::new(program).is_file()),
        }
    }
}

/// Whether the file starts with `#!`.
fn is_script(path: &str) -> bool {
    use std::io::Read;
    let mut start = [0u8; 2];
    std::fs::File::open(path)
        .and_then(|mut file| file.read_exact(&mut start))
        .is_ok_and(|()| &start == b"#!")
}

/// A setting of a container that weakens its isolation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContainerRisk {
    /// `--privileged`: every device, every capability.
    Privileged,
    /// The root of the host's file system is mounted.
    HostRoot,
    /// The socket of a container engine is mounted.
    EngineSocket,
    /// A capability that is enough to leave the container.
    EscapeCapability,
    /// A disk, or the memory, of the host in direct access.
    HostDevice,
    /// In the host's process namespace (`--pid=host`).
    HostProcesses,
    /// Without seccomp or without AppArmor.
    NoSecurityProfile,
}

impl ContainerRisk {
    /// The risk in a few words, in French, for the interface.
    pub fn label_fr(self) -> &'static str {
        match self {
            Self::Privileged => "Privilégié",
            Self::HostRoot => "Racine de l'hôte montée",
            Self::EngineSocket => "Socket du moteur monté",
            Self::EscapeCapability => "Capacités d'évasion",
            Self::HostDevice => "Disque de l'hôte",
            Self::HostProcesses => "Processus de l'hôte",
            Self::NoSecurityProfile => "Sans profil de sécurité",
        }
    }

    /// Whether the risk alone lets the container take the host. The socket
    /// of the engine does (it starts a privileged container), even if
    /// administration tools mount it for good reasons.
    pub fn is_escape(self) -> bool {
        !matches!(self, Self::HostProcesses | Self::NoSecurityProfile)
    }
}

/// The settings of a container that matter for its isolation.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContainerSettings {
    #[serde(default)]
    pub privileged: bool,
    /// `host` when the container shares the host's namespace.
    #[serde(default)]
    pub pid_mode: String,
    #[serde(default)]
    pub network_mode: String,
    #[serde(default)]
    pub ipc_mode: String,
    #[serde(default)]
    pub userns_mode: String,
    #[serde(default)]
    pub cap_add: Vec<String>,
    /// `seccomp=unconfined`, `apparmor=unconfined`…
    #[serde(default)]
    pub security_opt: Vec<String>,
    /// The devices of the host given to the container.
    #[serde(default)]
    pub devices: Vec<String>,
    /// The paths of the host mounted in the container (bind mounts and
    /// volumes alike).
    #[serde(default)]
    pub host_paths: Vec<String>,
    /// The account the container runs as; `root` when the image says none.
    #[serde(default)]
    pub user: String,
}

impl ContainerSettings {
    /// Read one container of what `docker inspect` prints.
    pub fn from_inspect(container: &serde_json::Value) -> Self {
        let host = &container["HostConfig"];
        let text = |value: &serde_json::Value| value.as_str().unwrap_or("").to_string();
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
                        .filter(|value| !value.is_empty())
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default()
        };
        let user = text(&container["Config"]["User"]);
        Self {
            privileged: host["Privileged"].as_bool().unwrap_or(false),
            pid_mode: text(&host["PidMode"]),
            network_mode: text(&host["NetworkMode"]),
            ipc_mode: text(&host["IpcMode"]),
            userns_mode: text(&host["UsernsMode"]),
            cap_add: list(&host["CapAdd"], None),
            security_opt: list(&host["SecurityOpt"], None),
            devices: list(&host["Devices"], Some("PathOnHost")),
            host_paths: list(&container["Mounts"], Some("Source")),
            user: if user.is_empty() {
                "root".to_string()
            } else {
                user
            },
        }
    }

    /// Whether the root of the host's file system is mounted.
    pub fn mounts_host_root(&self) -> bool {
        self.host_paths
            .iter()
            .any(|path| path.trim_end_matches('/').is_empty())
    }

    /// Whether the socket of a container engine is mounted.
    pub fn mounts_engine_socket(&self) -> bool {
        self.host_paths.iter().any(|path| {
            let name = path.rsplit('/').next().unwrap_or(path);
            ENGINE_SOCKETS.contains(&name)
        })
    }

    /// What weakens the isolation of the container, the worst first.
    pub fn risks(&self) -> Vec<ContainerRisk> {
        let mut risks = Vec::new();
        if self.privileged {
            risks.push(ContainerRisk::Privileged);
        }
        if self.mounts_host_root() {
            risks.push(ContainerRisk::HostRoot);
        }
        if self.cap_add.iter().any(|capability| {
            ESCAPE_CAPABILITIES
                .iter()
                .any(|escape| capability.contains(escape))
        }) {
            risks.push(ContainerRisk::EscapeCapability);
        }
        if self
            .devices
            .iter()
            .any(|device| HOST_DEVICES.iter().any(|host| device.contains(host)))
        {
            risks.push(ContainerRisk::HostDevice);
        }
        if self.mounts_engine_socket() {
            risks.push(ContainerRisk::EngineSocket);
        }
        if self.pid_mode == "host" {
            risks.push(ContainerRisk::HostProcesses);
        }
        if self.security_opt.iter().any(|option| {
            [
                "seccomp=unconfined",
                "seccomp:unconfined",
                "apparmor=unconfined",
                "apparmor:unconfined",
            ]
            .contains(&option.as_str())
        }) {
            risks.push(ContainerRisk::NoSecurityProfile);
        }
        risks
    }
}

/// The containers of what `docker inspect` prints (a list, or one).
pub fn inspected(json: &str) -> Vec<serde_json::Value> {
    match serde_json::from_str::<serde_json::Value>(json) {
        Ok(serde_json::Value::Array(items)) => items,
        Ok(item @ serde_json::Value::Object(_)) => vec![item],
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_docker_command_that_is_a_script_is_podman() {
        let dir = tempfile::tempdir().unwrap();
        let shim = dir.path().join("docker");
        std::fs::write(&shim, "#!/bin/sh\nexec /usr/bin/podman \"$@\"\n").unwrap();
        assert!(is_script(&shim.to_string_lossy()));
        let binary = dir.path().join("dockerd");
        std::fs::write(&binary, [0x7f, b'E', b'L', b'F']).unwrap();
        assert!(!is_script(&binary.to_string_lossy()));
        assert!(!is_script("/nonexistent/docker"));
        assert_eq!(Engine::Podman.name(), "podman");
    }

    #[test]
    fn the_settings_that_weaken_a_container_are_read_and_named() {
        let containers = inspected(
            r#"[{"Name":"/escape","Config":{"User":""},
                 "HostConfig":{"Privileged":true,"PidMode":"host","CapAdd":["CAP_SYS_ADMIN"],
                   "SecurityOpt":["seccomp=unconfined"],"Devices":[{"PathOnHost":"/dev/nvme0n1"}]},
                 "Mounts":[{"Source":"/"},{"Source":"/run/docker.sock"}]},
                {"Name":"/web","Config":{"User":"nginx"},
                 "HostConfig":{"Privileged":false,"PidMode":"","CapAdd":null,"SecurityOpt":null},
                 "Mounts":[{"Source":"/srv/www"},{"Source":""}]}]"#,
        );
        assert_eq!(containers.len(), 2);
        let escape = ContainerSettings::from_inspect(&containers[0]);
        assert_eq!(escape.user, "root");
        assert_eq!(
            escape.risks(),
            [
                ContainerRisk::Privileged,
                ContainerRisk::HostRoot,
                ContainerRisk::EscapeCapability,
                ContainerRisk::HostDevice,
                ContainerRisk::EngineSocket,
                ContainerRisk::HostProcesses,
                ContainerRisk::NoSecurityProfile,
            ]
        );
        assert!(
            ContainerRisk::EngineSocket.is_escape() && !ContainerRisk::HostProcesses.is_escape()
        );

        let web = ContainerSettings::from_inspect(&containers[1]);
        assert_eq!(web.user, "nginx");
        assert_eq!(web.host_paths, ["/srv/www"]);
        assert!(web.risks().is_empty());

        // Podman's document is Docker's: the same fields.
        let podman = ContainerSettings::from_inspect(
            &inspected(
                r#"[{"Name":"pescape","Config":{"User":""},
                 "HostConfig":{"Privileged":true,"PidMode":"host","CapAdd":[],"SecurityOpt":["unmask=all"],"Devices":[]},
                 "Mounts":[{"Type":"bind","Source":"/"}]}]"#,
            )[0],
        );
        assert_eq!(
            podman.risks(),
            [
                ContainerRisk::Privileged,
                ContainerRisk::HostRoot,
                ContainerRisk::HostProcesses
            ]
        );

        // One container, not in a list; and what is not JSON.
        assert_eq!(inspected(r#"{"Name":"/one"}"#).len(), 1);
        assert!(inspected("Error: No such container").is_empty());
    }
}
