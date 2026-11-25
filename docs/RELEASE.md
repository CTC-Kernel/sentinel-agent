# Releasing without GitHub Actions

`scripts/release-vps.sh` builds the agent's packages and publishes them on a
self-hosted Sentinel platform. Nothing in it depends on GitHub: the packages
go to the server over SSH, and the server serves them.

`.github/workflows/release.yml` is the older pipeline. It publishes to a
Firebase bucket; use one or the other, not both for the same version.

## Once

1. Copy `scripts/release.env.example` to `scripts/.env.release` and fill it
   in. The file is ignored by git. It holds:
   - what is compiled into the agent: the API it talks to
     (`SENTINEL_SERVER_URL`) and where it looks for updates
     (`SENTINEL_RELEASES_BASE_URL`);
   - where to publish: public URL, SSH host and key.
2. The SSH user needs `sudo` without a password for `install` and `docker`
   on the server. Load the key in your agent if it has a passphrase.
3. Docker on the machine that builds (the Linux packages are built in
   AlmaLinux 8 containers, for amd64 and arm64).
4. macOS package: a Mac with both certificates in the keychain,
   « Developer ID Application » and « Developer ID Installer », and a
   notarytool profile (`xcrun notarytool store-credentials`), named in
   `NOTARIZATION_KEYCHAIN_PROFILE`.
5. Windows installer: MinGW on the machine that builds
   (`brew install mingw-w64`, with the `x86_64-pc-windows-gnu` Rust target).
   The MSI itself is made by WiX 4 running under Wine in a container; no
   Windows machine is needed to build it. One is needed to try it.

## Each release

```bash
# 1. Version and tag (what the "version" job of release.yml did)
#    edit `version` in Cargo.toml, then:
cargo update --workspace
git commit -am "release: vX.Y.Z" && git tag vX.Y.Z && git push origin HEAD vX.Y.Z

# 2. Build, from a clean checkout of the tag
scripts/release-vps.sh build linux      # ~25 min, installs each package to check it
scripts/release-vps.sh build macos      # signed and notarized, or it stops
```

```bash
scripts/release-vps.sh build windows    # cross-compiled, MSI made under Wine
```

Then install that MSI on a Windows machine and check it before `finalize`
(see « Windows » below).

```bash
# 3. Publish what was built, and check every public link against it
scripts/release-vps.sh publish

# 4. Announce the version, once every platform is there
scripts/release-vps.sh finalize
```

`scripts/release-vps.sh status` shows what is built and what the server
serves at any time.

## Publish and finalize are two steps

`publish` puts the files on the server. Download links of the platforms
published start serving them at once; nothing else changes.

`finalize` writes `release-info.json`. From then on the agents on this
channel update to the version, and the platform resolves **every**
platform's download link from that version number. Announcing a version
that one platform does not have turns that platform's link into a 404, so
`finalize` refuses to run until Linux, macOS and Windows are all built.

A release can therefore be published one platform at a time and announced
at the end.

## What goes where

| On the server | Served as | Read by |
|---|---|---|
| `<public dir>/agent/<folder>/…-latest…` and `.sha256` | `SENTINEL_RELEASES_BASE_URL/<folder>/…` | agents, to update themselves |
| `<public dir>/agent/release-info.json` | `SENTINEL_RELEASES_BASE_URL/release-info.json` | agents, to learn the latest version |
| object store `releases/agent/<platform>/…` | `/releases/agent/<platform>/latest` | people, from the platform's download page |
| object store `releases/agent/release-info.json` | — | the platform, for the version it shows |

The object store has one folder per platform of the download API
(`linux_deb`, `linux_deb_arm64`, `linux_rpm`, `linux_rpm_arm64`, `macos`,
`windows`); the static channel keeps the ARM packages beside the x86 ones,
where the agents look for them.

## Windows

`build windows` cross-compiles the agent for `x86_64-pc-windows-gnu`, checks
that the executable needs no MinGW runtime library, builds the MSI from
`wix/main.wxs` with WiX 4 under Wine, then rebuilds the archive inside the
MSI compressed (Wine stores it uncompressed) and compares every file with
the original. It reads the version, the server URL and the service back from
the MSI before keeping it.

What was checked without Windows, on 4.0.57:

- the executable starts under Wine 10 (`--version`, `--help`), and in
  service mode opens its database and applies every migration;
- the service-channel tests, compiled for Windows, pass under Wine
  (`cargo test --target x86_64-pc-windows-gnu -p agent-core --features gui
  --lib --no-run`, then the test executable with `gui_ipc --include-ignored`
  and `SENTINEL_TEST_WINE=1`): named pipe in both directions, the process
  behind the pipe, the registry store, the access lists;
- the MSI has the same tables, service, custom actions and upgrade code as
  the last one built on Windows, and installs under Wine exactly as far as
  that one does (files, service installed and started), both stopping at
  the Windows Firewall rule that Wine cannot create.

What only a Windows machine can tell:

- that the service runs to the end of its start-up (Wine lacks a
  performance-counter function the agent calls, so it stops there);
- that the access lists of the pipe and of the registry key are enforced,
  and that a second process cannot claim the pipe's name (Wine enforces
  neither);
- the interface itself, and the firewall rule.

On a Windows machine with the agent installed, the same test executable
checks the real thing, from an elevated prompt:

```text
agent_core-<hash>.exe gui_ipc --include-ignored
```

`the_installed_service_greets_an_interface_and_keeps_its_gate` connects to
the running service through the pipe, checks that the service is the
process behind it, and that a protected command is refused without the
administrator password.

The builds made on Windows used the MSVC toolchain; this one uses MinGW.
`scripts/release-windows.ps1` still builds the MSVC variant on a Windows
machine, to be brought back with `add-windows`.

## Limits

- Update packages are checked by SHA-256 only unless `SENTINEL_UPDATE_PUBKEY`
  is set and the packages are signed (`docs/UPDATE_SIGNING.md`); the script
  does not sign them yet.
- The MSI is not code-signed, whichever way it is built.
- `release-windows.ps1` follows the steps of `release.yml` but has not been
  run yet.
- The Windows installer has not been run on Windows (see « Windows »).
- Builds are not reproducible bit for bit: rebuilding a published version
  gives different files. Publish a version once.
