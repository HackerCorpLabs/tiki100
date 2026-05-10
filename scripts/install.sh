#!/bin/sh
# install.sh — one-shot installer for the TIKI-100 emulator on Debian-based Linux
#              (Debian / Ubuntu / Raspberry Pi OS / Mint / Pop!_OS / ...).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/HackerCorpLabs/tiki100/main/scripts/install.sh | sh
#
# Or to pin a specific version:
#   curl -fsSL https://raw.githubusercontent.com/HackerCorpLabs/tiki100/main/scripts/install.sh | TIKI100_VERSION=v0.2.0 sh
#
# What it does:
#   1. Detects the CPU architecture (amd64 / arm64 / armhf).
#   2. Resolves the download URL of the matching .deb from a GitHub Release
#      (latest by default, or TIKI100_VERSION=vX.Y.Z to pin).
#   3. Downloads the .deb to a temporary directory.
#   4. Runs 'apt-get install' on the .deb, which pulls in libsdl2-2.0-0 as a
#      dependency automatically.
#
# Uninstall:
#   sudo apt remove tiki100
#
# Notes:
# - This is POSIX /bin/sh (no bashisms). Works on dash / ash / bash.
# - No root privileges until the final apt install step; sudo will prompt if
#   the caller is not already root.

set -eu

REPO="${TIKI100_REPO:-HackerCorpLabs/tiki100}"
VERSION="${TIKI100_VERSION:-latest}"

say() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# --- arch detection ---------------------------------------------------------
MACHINE="$(uname -m)"
case "$MACHINE" in
    x86_64|amd64)         ARCH=amd64 ;;
    aarch64|arm64)        ARCH=arm64 ;;
    armv7l|armv7|armhf)   ARCH=armhf ;;
    *)
        die "unsupported architecture '$MACHINE' — this installer only supports amd64, arm64, and armhf"
        ;;
esac
say "detected architecture: $ARCH"

# --- sanity: Debian-based? --------------------------------------------------
if ! command -v dpkg >/dev/null 2>&1 || ! command -v apt-get >/dev/null 2>&1; then
    die "this installer requires a Debian-based distro with dpkg and apt-get (apt)"
fi

# --- tool checks ------------------------------------------------------------
if ! command -v curl >/dev/null 2>&1; then
    die "curl is required — install it with: sudo apt install curl"
fi

# --- resolve version and URL -----------------------------------------------
if [ "$VERSION" = "latest" ]; then
    say "resolving latest release of $REPO ..."
    API="https://api.github.com/repos/$REPO/releases/latest"
    # Portable tag_name extraction: awk is in every Debian base install.
    TAG="$(curl -fsSL "$API" | awk -F'"' '/"tag_name":/ { print $4; exit }')"
    if [ -z "${TAG:-}" ]; then
        die "could not determine latest release tag from $API"
    fi
else
    TAG="$VERSION"
fi
CLEAN_VER="${TAG#v}"
DEB="tiki100_${CLEAN_VER}_${ARCH}.deb"
URL="https://github.com/$REPO/releases/download/$TAG/$DEB"

say "target release: $TAG"
say "target package: $DEB"

# --- download ---------------------------------------------------------------
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT INT TERM
say "downloading from $URL"
if ! curl -fL --progress-bar -o "$TMPDIR/$DEB" "$URL"; then
    die "download failed — check that release '$TAG' has an asset called '$DEB'"
fi

# --- install ----------------------------------------------------------------
if [ "$(id -u)" = "0" ]; then
    SUDO=""
else
    if ! command -v sudo >/dev/null 2>&1; then
        die "sudo not found and you are not root — re-run as root or install sudo"
    fi
    SUDO="sudo"
fi

say "installing $DEB (requires sudo)"
$SUDO apt-get update -q
$SUDO apt-get install -y "$TMPDIR/$DEB"

say "done. Run:   tiki100 -diska /usr/share/tiki100/disks/boot/tiko_kjerne_v4.01.dsk"
