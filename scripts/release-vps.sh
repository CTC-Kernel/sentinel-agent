#!/usr/bin/env bash
# Build the agent's packages and publish them on a self-hosted Sentinel
# platform, without GitHub Actions.
#
#   scripts/release-vps.sh build linux          deb + rpm, amd64 and arm64 (Docker)
#   scripts/release-vps.sh build macos          universal .pkg, signed and notarized
#   scripts/release-vps.sh build windows        .msi, cross-built (MinGW, WiX under Wine)
#   scripts/release-vps.sh add-windows <msi>    or take an MSI built on Windows (release-windows.ps1)
#   scripts/release-vps.sh publish              send what is in dist-release/ and check it
#   scripts/release-vps.sh finalize             announce the version (all platforms present)
#   scripts/release-vps.sh status               what is built, what the server serves
#
# Run from a clean checkout of the release tag. Settings come from
# scripts/.env.release (see scripts/release.env.example); it is not committed.
#
# What "publish" writes on the server, for a version V:
#   <public dir>/agent/                 static channel the agents update from
#       release-info.json               written by "finalize" only
#       linux_deb/sentinel-agent-latest-<arch>.deb(.sha256)
#       linux_rpm/sentinel-agent-latest.<arch>.rpm(.sha256)
#       macos/SentinelAgent-latest.pkg(.sha256)
#       windows/SentinelAgentSetup-latest.msi(.sha256)
#   object store releases/agent/<platform>/   what /releases/agent/<platform>/latest serves
#
# "finalize" is separate on purpose: the platform resolves every download
# link from one version number. Announcing a version that one platform does
# not have turns that platform's link into a 404.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${RELEASE_ENV:-$ROOT/scripts/.env.release}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

VERSION="$(grep -E '^version[[:space:]]*=' Cargo.toml | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
OUT="${RELEASE_OUT:-$ROOT/dist-release}"
AGENT="$OUT/agent"

say() { printf '▶ %s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }
need() { [ -n "${!1:-}" ] || die "$1 is not set (see scripts/release.env.example)"; }
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
# A latest alias next to a versioned file, each with its checksum file
# (the hash alone, as the agents and the platform read it).
alias_as() {
  local file="$1"; shift
  sha "$file" > "$file.sha256"
  for name in "$@"; do
    cp "$file" "$(dirname "$file")/$name"
    cp "$file.sha256" "$(dirname "$file")/$name.sha256"
  done
}

# Go to the sources of the release: the tag v$VERSION, whatever is checked
# out. When HEAD is not that tag, the tag is checked out in a temporary
# worktree, removed at exit: the script can be newer than the release it
# builds (a tag made before a fix to the script is still buildable).
#
# RELEASE_REHEARSAL=1 builds the checkout as it is instead. Point
# RELEASE_OUT elsewhere so a rehearsal can never be published.
check_tree() {
  need SENTINEL_SERVER_URL; need SENTINEL_RELEASES_BASE_URL
  [ "${RELEASE_REHEARSAL:-0}" = 1 ] && return
  if [ "$(git describe --exact-match --tags HEAD 2>/dev/null)" = "v$VERSION" ] \
     && [ -z "$(git status --porcelain)" ]; then
    return
  fi
  git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null \
    || die "no tag v$VERSION: tag the release first (docs/RELEASE.md)"
  RELEASE_SRC="$(mktemp -d)/sentinel-agent-v$VERSION"
  git worktree add -q --detach "$RELEASE_SRC" "v$VERSION"
  trap 'cd "$ROOT"; git worktree remove --force "$RELEASE_SRC" 2>/dev/null || true' EXIT
  cd "$RELEASE_SRC"
  say "building the sources of v$VERSION (temporary checkout: $RELEASE_SRC)"
}

# ── Linux ─────────────────────────────────────────────────────────────
# AlmaLinux 8: glibc 2.28, the oldest of the distributions served. Same
# steps as the build-linux job of .github/workflows/release.yml.
linux_container_script() {
  cat <<'EOS'
set -euo pipefail
dnf install -y -q git gcc gcc-c++ make cmake perl perl-IPC-Cmd pkgconf-pkg-config binutils rpm-build gtk3-devel libxkbcommon-devel libxcb-devel systemd-devel >/dev/null
curl --proto '=https' --tlsv1.2 --retry 5 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none >/dev/null
export PATH="$HOME/.cargo/bin:$PATH" CARGO_INCREMENTAL=0
mkdir -p /build/src && tar -xf /src.tar -C /build/src && cd /build/src
rustup toolchain install >/dev/null 2>&1
cargo install cargo-deb cargo-generate-rpm --locked >/dev/null 2>&1
cargo build --release --features gui --package agent-core --no-default-features
need=$(objdump -T target/release/agent-core | grep -o 'GLIBC_[0-9.]*' | sed 's/^GLIBC_//' | sort -uV | tail -n 1)
echo "Highest glibc symbol version: $need"
[ -n "$need" ] && [ "$(printf '%s\n' "$need" 2.28 | sort -V | tail -n 1)" = "2.28" ] || { echo "agent-core needs glibc $need; RHEL 8 has 2.28"; exit 1; }
cargo deb --package agent-core --no-build --deb-revision 1
cargo generate-rpm -p crates/agent-core --auto-req find-requires
cp target/debian/sentinel-agent_*.deb target/generate-rpm/sentinel-agent-*.rpm /out/
EOS
}

build_linux() {
  check_tree
  command -v docker >/dev/null || die "docker is required for the Linux packages"
  local work; work="$(mktemp -d)"
  git archive -o "$work/src.tar" HEAD   # a worktree's .git is not visible in the container
  linux_container_script > "$work/build.sh"
  mkdir -p "$work/amd64" "$work/arm64" "$AGENT/linux_deb" "$AGENT/linux_rpm"
  local pids=()
  for arch in amd64 arm64; do
    say "Linux $arch: building in almalinux:8 (log: $work/$arch.log)"
    docker run --rm --platform "linux/$arch" \
      -v "$work/src.tar:/src.tar:ro" -v "$work/build.sh:/build.sh:ro" -v "$work/$arch:/out" \
      -e SENTINEL_SERVER_URL -e SENTINEL_RELEASES_BASE_URL -e SENTINEL_UPDATE_PUBKEY \
      almalinux:8 bash /build.sh > "$work/$arch.log" 2>&1 &
    pids+=($!)
  done
  local failed=0
  for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
  [ "$failed" = 0 ] || { tail -20 "$work"/*.log; die "a Linux build failed"; }

  # Installed where a customer would install them before anything is kept.
  for arch in amd64 arm64; do
    say "Linux $arch: installing the packages on Debian 12 and AlmaLinux 9"
    docker run --rm --platform "linux/$arch" -v "$work/$arch:/p:ro" debian:12 bash -c \
      'apt-get update -qq >/dev/null 2>&1 && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq /p/*.deb >/dev/null 2>&1 && sentinel-agent --version' \
      | grep -qx "sentinel-agent $VERSION" || die "the $arch deb does not install or is not $VERSION"
    docker run --rm --platform "linux/$arch" -v "$work/$arch:/p:ro" almalinux:9 bash -c \
      'dnf install -y -q /p/*.rpm >/dev/null 2>&1 && sentinel-agent --version' \
      | grep -qx "sentinel-agent $VERSION" || die "the $arch rpm does not install or is not $VERSION"
  done

  cp "$work/amd64/sentinel-agent_$VERSION-1_amd64.deb" "$work/arm64/sentinel-agent_$VERSION-1_arm64.deb" "$AGENT/linux_deb/"
  cp "$work/amd64/sentinel-agent-$VERSION-1.x86_64.rpm" "$work/arm64/sentinel-agent-$VERSION-1.aarch64.rpm" "$AGENT/linux_rpm/"
  # Two spellings of "latest": the agents' (dash) and the platform's (underscore).
  for arch in amd64 arm64; do
    alias_as "$AGENT/linux_deb/sentinel-agent_$VERSION-1_$arch.deb" "sentinel-agent-latest-$arch.deb" "sentinel-agent_latest_$arch.deb"
  done
  alias_as "$AGENT/linux_rpm/sentinel-agent-$VERSION-1.x86_64.rpm" "sentinel-agent-latest.x86_64.rpm"
  alias_as "$AGENT/linux_rpm/sentinel-agent-$VERSION-1.aarch64.rpm" "sentinel-agent-latest.aarch64.rpm"
  rm -rf "$work"
  say "Linux packages for $VERSION are in $AGENT"
}

# ── macOS ─────────────────────────────────────────────────────────────
build_macos() {
  check_tree
  [ "$(uname)" = Darwin ] || die "the macOS package is built on a Mac"
  local installer
  # `|| true`: with pipefail, no match would end the script without a word.
  installer="$(security find-identity -v 2>/dev/null | grep 'Developer ID Installer' | head -1 | sed 's/.*"\(.*\)".*/\1/' || true)"
  if [ -z "$installer" ] && [ "${MACOS_DRY_RUN:-0}" != 1 ]; then
    die "no « Developer ID Installer » certificate in the keychain: the package could be neither signed nor notarized (MACOS_DRY_RUN=1 builds an unsigned one that is never published)"
  fi
  [ "${MACOS_DRY_RUN:-0}" = 1 ] || need NOTARIZATION_KEYCHAIN_PROFILE
  # Without the Metal compiler (Command Line Tools only) the shaders of the
  # local model are compiled when the model is loaded instead of at build time.
  xcrun -f metal >/dev/null 2>&1 || export MISTRALRS_METAL_PRECOMPILE=0
  for target in aarch64-apple-darwin x86_64-apple-darwin; do
    say "macOS: building $target"
    CARGO_INCREMENTAL=0 cargo build --release --features gui --package agent-core --target "$target"
  done
  mkdir -p target/release
  lipo -create target/aarch64-apple-darwin/release/agent-core target/x86_64-apple-darwin/release/agent-core \
    -output target/release/agent-core
  lipo -archs target/release/agent-core
  if [ "${MACOS_DRY_RUN:-0}" = 1 ]; then
    NOTARIZE=false VERSION="$VERSION" ./macos/create-macos-developer-signed-installer.sh
    say "dry run: unsigned package at macos/dist/SentinelAgent-$VERSION.pkg (not kept, not published)"
    return
  fi
  NOTARIZE=true VERSION="$VERSION" INSTALLER_IDENTITY="$installer" ./macos/create-macos-developer-signed-installer.sh
  local pkg="macos/dist/SentinelAgent-$VERSION.pkg"
  xcrun stapler validate "$pkg" || die "the package is not notarized"
  spctl -a -vv -t install "$pkg" || die "Gatekeeper refuses the package"
  mkdir -p "$AGENT/macos" && cp "$pkg" "$AGENT/macos/"
  alias_as "$AGENT/macos/SentinelAgent-$VERSION.pkg" "SentinelAgent-latest.pkg"
  say "macOS package for $VERSION is in $AGENT/macos"
}

# ── Windows ───────────────────────────────────────────────────────────
add_windows() {
  local msi="${1:-}"
  [ -f "$msi" ] || die "usage: release-vps.sh add-windows <SentinelAgentSetup-$VERSION.msi>"
  [ "$(basename "$msi")" = "SentinelAgentSetup-$VERSION.msi" ] || die "expected SentinelAgentSetup-$VERSION.msi"
  mkdir -p "$AGENT/windows" && cp "$msi" "$AGENT/windows/"
  alias_as "$AGENT/windows/SentinelAgentSetup-$VERSION.msi" "SentinelAgentSetup-latest.msi"
  say "Windows installer for $VERSION is in $AGENT/windows"
}

# ── Windows, cross-built ──────────────────────────────────────────────
# No Windows machine: the executable is cross-compiled with MinGW, and
# WiX 4 runs under Wine in a container to make the MSI. Wine's cabinet
# library stores without compressing, so the archive inside the MSI is
# rebuilt compressed and checked file by file against the original.
#
# What this cannot do is run the installer on Windows: do that on a real
# machine before `finalize` (docs/RELEASE.md).
wix_dockerfile() {
  cat <<'EOS'
FROM debian:12
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      wine wine64 curl unzip ca-certificates openssl msitools gcab cabextract \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL --retry 5 --retry-all-errors -o /tmp/dotnet.zip https://builds.dotnet.microsoft.com/dotnet/Sdk/8.0.404/dotnet-sdk-8.0.404-win-x64.zip \
 && mkdir -p /opt/dotnet && unzip -q /tmp/dotnet.zip -d /opt/dotnet && rm /tmp/dotnet.zip
RUN for p in wix WixToolset.UI.wixext WixToolset.Util.wixext WixToolset.Firewall.wixext; do \
      curl -fsSL --retry 5 --retry-all-errors -o /tmp/$p.zip https://www.nuget.org/api/v2/package/$p/4.0.0 \
      && mkdir -p /opt/wix/$p && unzip -q /tmp/$p.zip -d /opt/wix/$p && rm /tmp/$p.zip || exit 1; \
    done
ENV WINEDEBUG=-all WINEPREFIX=/root/.wine DOTNET_ROLL_FORWARD=Major DOTNET_NOLOGO=1 DOTNET_CLI_TELEMETRY_OPTOUT=1
RUN wineboot -i && wineserver -w
EOS
}

wix_container_script() {
  cat <<'EOS'
set -euo pipefail
cd /work
# The installer adds this certificate to the machine's trusted publishers.
# Its private key is destroyed here: nobody can sign with it afterwards.
openssl req -x509 -newkey rsa:3072 -nodes -keyout /dev/shm/key.pem -out /dev/shm/cert.pem -days 1825 \
  -subj "/CN=Sentinel GRC Agent/O=Cyber Threat Consulting" -addext "extendedKeyUsage=codeSigning" >/dev/null 2>&1
openssl x509 -in /dev/shm/cert.pem -outform DER -out sentinel-selfsigned.cer
shred -u /dev/shm/key.pem; rm -f /dev/shm/cert.pem

X='Z:\opt\wix'
msi="SentinelAgentSetup-$VERSION.msi"
wine /opt/dotnet/dotnet.exe "$X\\wix\\tools\\net6.0\\any\\wix.dll" build \
  -d 'TargetDir=.\target\release' -d "Version=$VERSION" -d 'AssetsDir=.\assets' -d "ServerUrl=$SENTINEL_SERVER_URL" \
  -o "$msi" 'wix\main.wxs' \
  -ext "$X\\WixToolset.UI.wixext\\wixext4\\WixToolset.UI.wixext.dll" \
  -ext "$X\\WixToolset.Util.wixext\\wixext4\\WixToolset.Util.wixext.dll" \
  -ext "$X\\WixToolset.Firewall.wixext\\wixext4\\WixToolset.Firewall.wixext.dll"
[ -f "$msi" ] || { echo "WiX produced no MSI"; exit 1; }

# Same files, same order, compressed this time.
mkdir -p /tmp/re/old /tmp/re/new
msiinfo extract "$msi" sentinel.cab > /tmp/re/old.cab
cabextract -q -d /tmp/re/old /tmp/re/old.cab
order=$(cabextract -l /tmp/re/old.cab | awk -F'|' 'NR>2 && NF==3 {gsub(/ /,"",$3); print $3}')
(cd /tmp/re/old && gcab -c -z /tmp/re/new.cab $order)
msibuild "$msi" -a sentinel.cab /tmp/re/new.cab
msiinfo extract "$msi" sentinel.cab > /tmp/re/check.cab
cabextract -q -d /tmp/re/new /tmp/re/check.cab
(cd /tmp/re/old && sha256sum *) > /tmp/re/before
(cd /tmp/re/new && sha256sum *) > /tmp/re/after
cmp /tmp/re/before /tmp/re/after || { echo "the recompressed MSI does not hold the same files"; exit 1; }

# What the installer will register, read back from the MSI itself.
property() { msiinfo export "$msi" Property | tr -d '\r' | awk -F'\t' -v name="$1" '$1 == name { print $2 }'; }
[ "$(property ProductVersion)" = "$VERSION" ] || { echo "ProductVersion is $(property ProductVersion), expected $VERSION"; exit 1; }
[ "$(property SERVERURL)" = "$SENTINEL_SERVER_URL" ] || { echo "SERVERURL is $(property SERVERURL)"; exit 1; }
msiinfo export "$msi" ServiceInstall | grep -q "SentinelGRCAgent" || { echo "no service in the MSI"; exit 1; }
cp "$msi" /out/
EOS
}

build_windows() {
  check_tree
  command -v docker >/dev/null || die "docker is required to make the MSI"
  command -v x86_64-w64-mingw32-gcc >/dev/null || die "MinGW is required (brew install mingw-w64)"
  local target=x86_64-pc-windows-gnu work; work="$(mktemp -d)"
  # The build scripts look for the icon beside each crate; removed again so
  # the checkout stays clean.
  local icons=(crates/agent-gui/assets/icons/sentinel-agent.ico crates/agent-core/assets/icons/sentinel-agent.ico)
  for icon in "${icons[@]}"; do mkdir -p "$(dirname "$icon")" && cp assets/icons/sentinel-agent.ico "$icon"; done
  say "Windows: cross-compiling for $target"
  CARGO_INCREMENTAL=0 cargo build --release --features gui --package agent-core --no-default-features --target "$target" \
    || { rm -f "${icons[@]}"; die "the Windows build failed"; }
  rm -f "${icons[@]}"; rmdir crates/agent-core/assets/icons crates/agent-core/assets 2>/dev/null || true
  local exe="target/$target/release/agent-core.exe"
  # Only system libraries: a MinGW runtime DLL would be missing on the PC.
  if x86_64-w64-mingw32-objdump -p "$exe" | grep -iE 'DLL Name: (libgcc|libstdc|libwinpthread)'; then
    die "the executable needs MinGW runtime libraries"
  fi

  mkdir -p "$work/src/target/release" "$work/src/docs" "$work/out"
  cp "$exe" "$work/src/target/release/"
  cp -R wix assets config "$work/src/"
  cp docs/USER_GUIDE.md "$work/src/docs/"
  wix_dockerfile > "$work/Dockerfile"
  wix_container_script > "$work/src/build-msi.sh"
  say "Windows: preparing the WiX container (first time: a few minutes)"
  docker build -q --platform linux/amd64 -t sentinel-agent-wix:4.0.0 -f "$work/Dockerfile" "$work" >/dev/null
  say "Windows: building the MSI with WiX 4 under Wine"
  docker run --rm --platform linux/amd64 -v "$work/src:/work" -v "$work/out:/out" \
    -e VERSION="$VERSION" -e SENTINEL_SERVER_URL sentinel-agent-wix:4.0.0 bash /work/build-msi.sh \
    > "$work/wix.log" 2>&1 || { tail -30 "$work/wix.log"; die "the MSI could not be built"; }
  add_windows "$work/out/SentinelAgentSetup-$VERSION.msi"
  rm -rf "$work"
  say "not run on Windows: install this MSI on a Windows machine before finalize"
}

# ── Server ────────────────────────────────────────────────────────────
remote() { ssh -o BatchMode=yes ${RELEASE_SSH_KEY:+-i "$RELEASE_SSH_KEY"} "$RELEASE_SSH_HOST" "$@"; }

# Object-store folders, one per platform of the download API. The ARM
# packages have their own platform there; the static channel keeps them
# beside the x86 ones, where the agents look.
store_layout() {
  cat <<'EOS'
linux_deb linux_deb amd64.deb
linux_deb linux_deb_arm64 arm64.deb
linux_rpm linux_rpm x86_64.rpm
linux_rpm linux_rpm_arm64 aarch64.rpm
macos macos .pkg
windows windows .msi
EOS
}

publish() {
  need RELEASE_SSH_HOST; need RELEASE_PUBLIC_URL
  [ -d "$AGENT" ] || die "nothing to publish: build first"
  local public_dir="${RELEASE_PUBLIC_DIR:-/opt/sentinel/public-releases}"
  local api="${RELEASE_API_CONTAINER:-sentinel-api}"
  local stage="/tmp/agent-release-$VERSION"
  say "sending $(du -sh "$AGENT" | cut -f1) to $RELEASE_SSH_HOST"
  remote "rm -rf '$stage' && mkdir -p '$stage'"
  COPYFILE_DISABLE=1 tar -C "$OUT" --no-xattrs --exclude release-info.json -cf - agent | remote "tar -C '$stage' -xf -"
  store_layout > "$OUT/layout"
  remote "cat > '$stage/layout'" < "$OUT/layout"
  remote "STAGE='$stage' PUB='$public_dir' API='$api' bash -s" <<'REMOTE'
set -euo pipefail
cd "$STAGE/agent"
find . -name '*.sha256' | while read -r sum; do
  file="${sum%.sha256}"
  [ "$(sha256sum "$file" | cut -d' ' -f1)" = "$(cat "$sum")" ] || { echo "✗ checksum mismatch after transfer: $file"; exit 1; }
done
for dir in */; do
  dir="${dir%/}"
  sudo -n install -d -m 0755 "$PUB/agent/$dir"
  sudo -n install -m 0644 "$dir"/* "$PUB/agent/$dir/"
done
echo "  static: $PUB/agent"
sudo -n docker exec "$API" sh -c 'rm -rf /tmp/agent-upload && mkdir -p /tmp/agent-upload'
while read -r dir platform suffix; do
  [ -d "$dir" ] || continue
  sudo -n docker exec "$API" mkdir -p "/tmp/agent-upload/$platform"
  for file in "$dir"/*"$suffix" "$dir"/*"$suffix.sha256"; do
    [ -f "$file" ] && sudo -n docker cp "$file" "$API:/tmp/agent-upload/$platform/$(basename "$file")"
  done
done < "$STAGE/layout"
sudo -n docker exec -w /app "$API" node -e '
const Minio = require("minio"); const fs = require("fs"); const e = process.env;
const c = new Minio.Client({ endPoint: e.MINIO_ENDPOINT || "minio", port: Number(e.MINIO_PORT || 9000),
  useSSL: e.MINIO_USE_SSL === "true", accessKey: e.MINIO_ACCESS_KEY, secretKey: e.MINIO_SECRET_KEY });
const bucket = e.MINIO_BUCKET || "sentinel-grc";
const types = { deb: "application/vnd.debian.binary-package", rpm: "application/x-rpm",
  pkg: "application/vnd.apple.installer+xml", msi: "application/x-msi", sha256: "text/plain" };
(async () => {
  for (const platform of fs.readdirSync("/tmp/agent-upload")) for (const name of fs.readdirSync("/tmp/agent-upload/" + platform)) {
    await c.fPutObject(bucket, "releases/agent/" + platform + "/" + name, "/tmp/agent-upload/" + platform + "/" + name,
      { "Content-Type": types[name.split(".").pop()] || "application/octet-stream" });
    console.log("  store: releases/agent/" + platform + "/" + name);
  }
})().catch((err) => { console.error("✗ object store: " + err.message); process.exit(1); });
'
sudo -n docker exec "$API" rm -rf /tmp/agent-upload
rm -rf "$STAGE"
REMOTE
  verify
}

# What the public links serve, against what was built here.
verify() {
  need RELEASE_PUBLIC_URL
  local fail=0 got
  say "checking the public links"
  check() { # <label> <url> <local file>
    [ -f "$3" ] || return 0
    got="$(curl -fsSL -m 300 "$2" | shasum -a 256 | cut -d' ' -f1)"
    if [ "$got" = "$(sha "$3")" ]; then printf '  ok  %s\n' "$1"; else printf '  ✗   %s\n' "$1"; fail=1; fi
  }
  local base="$RELEASE_PUBLIC_URL/releases/agent" chan="$SENTINEL_RELEASES_BASE_URL"
  check "linux_deb"        "$base/linux_deb/latest"        "$AGENT/linux_deb/sentinel-agent_latest_amd64.deb"
  check "linux_deb_arm64"  "$base/linux_deb_arm64/latest"  "$AGENT/linux_deb/sentinel-agent_latest_arm64.deb"
  check "linux_rpm"        "$base/linux_rpm/latest"        "$AGENT/linux_rpm/sentinel-agent-latest.x86_64.rpm"
  check "linux_rpm_arm64"  "$base/linux_rpm_arm64/latest"  "$AGENT/linux_rpm/sentinel-agent-latest.aarch64.rpm"
  check "macos"            "$base/macos/latest"            "$AGENT/macos/SentinelAgent-latest.pkg"
  check "windows"          "$base/windows/latest"          "$AGENT/windows/SentinelAgentSetup-latest.msi"
  check "update deb amd64" "$chan/linux_deb/sentinel-agent-latest-amd64.deb" "$AGENT/linux_deb/sentinel-agent-latest-amd64.deb"
  check "update deb arm64" "$chan/linux_deb/sentinel-agent-latest-arm64.deb" "$AGENT/linux_deb/sentinel-agent-latest-arm64.deb"
  check "update rpm x86"   "$chan/linux_rpm/sentinel-agent-latest.x86_64.rpm" "$AGENT/linux_rpm/sentinel-agent-latest.x86_64.rpm"
  check "update rpm arm"   "$chan/linux_rpm/sentinel-agent-latest.aarch64.rpm" "$AGENT/linux_rpm/sentinel-agent-latest.aarch64.rpm"
  check "update pkg"       "$chan/macos/SentinelAgent-latest.pkg" "$AGENT/macos/SentinelAgent-latest.pkg"
  check "update msi"       "$chan/windows/SentinelAgentSetup-latest.msi" "$AGENT/windows/SentinelAgentSetup-latest.msi"
  [ "$fail" = 0 ] || die "a public link does not serve what was built"
  say "every published file is served as built"
}

# Announce the version: agents start updating, the platform shows it.
finalize() {
  need RELEASE_SSH_HOST
  for file in linux_deb/sentinel-agent_latest_amd64.deb linux_deb/sentinel-agent_latest_arm64.deb \
              linux_rpm/sentinel-agent-latest.x86_64.rpm linux_rpm/sentinel-agent-latest.aarch64.rpm \
              macos/SentinelAgent-latest.pkg windows/SentinelAgentSetup-latest.msi; do
    [ -f "$AGENT/$file" ] || die "$file is missing: announcing $VERSION would break that platform's download link"
  done
  verify
  local public_dir="${RELEASE_PUBLIC_DIR:-/opt/sentinel/public-releases}" api="${RELEASE_API_CONTAINER:-sentinel-api}"
  printf '{"version":"%s","date":"%s","product":"agent"}\n' "$VERSION" "$(date -u +%Y-%m-%d)" > "$AGENT/release-info.json"
  remote "cat > /tmp/agent-release-info.json" < "$AGENT/release-info.json"
  remote "PUB='$public_dir' API='$api' bash -s" <<'REMOTE'
set -euo pipefail
sudo -n install -m 0644 /tmp/agent-release-info.json "$PUB/agent/release-info.json.tmp"
sudo -n mv -f "$PUB/agent/release-info.json.tmp" "$PUB/agent/release-info.json"
sudo -n docker cp /tmp/agent-release-info.json "$API:/tmp/agent-release-info.json"
sudo -n docker exec -w /app "$API" node -e '
const Minio = require("minio"); const e = process.env;
const c = new Minio.Client({ endPoint: e.MINIO_ENDPOINT || "minio", port: Number(e.MINIO_PORT || 9000),
  useSSL: e.MINIO_USE_SSL === "true", accessKey: e.MINIO_ACCESS_KEY, secretKey: e.MINIO_SECRET_KEY });
c.fPutObject(e.MINIO_BUCKET || "sentinel-grc", "releases/agent/release-info.json", "/tmp/agent-release-info.json",
  { "Content-Type": "application/json" }).then(() => console.log("  store: releases/agent/release-info.json"))
  .catch((err) => { console.error("✗ object store: " + err.message); process.exit(1); });
'
sudo -n docker exec "$API" rm -f /tmp/agent-release-info.json
rm -f /tmp/agent-release-info.json
REMOTE
  say "$VERSION is announced: agents on this channel will update to it"
}

status() {
  say "version in Cargo.toml: $VERSION"
  if [ -d "$AGENT" ]; then (cd "$AGENT" && find . -type f ! -name '*.sha256' | sort | sed 's/^/  built: /'); else echo "  nothing built"; fi
  if [ -n "${RELEASE_PUBLIC_URL:-}" ]; then
    for platform in linux_deb linux_deb_arm64 linux_rpm linux_rpm_arm64 macos windows; do
      printf '  served %-16s %s\n' "$platform" \
        "$(curl -s -o /dev/null -m 30 -w '%{http_code} %{redirect_url}' "$RELEASE_PUBLIC_URL/releases/agent/$platform/latest")"
    done
    if [ -n "${SENTINEL_RELEASES_BASE_URL:-}" ]; then
      printf '  announced: %s\n' "$(curl -fsS -m 30 "$SENTINEL_RELEASES_BASE_URL/release-info.json" 2>/dev/null || echo none)"
    fi
  fi
}

case "${1:-}" in
  build)
    case "${2:-}" in
      linux) build_linux ;;
      macos) build_macos ;;
      windows) build_windows ;;
      *) die "usage: release-vps.sh build linux|macos|windows" ;;
    esac ;;
  add-windows) add_windows "${2:-}" ;;
  publish) publish ;;
  verify) verify ;;
  finalize) finalize ;;
  status) status ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
