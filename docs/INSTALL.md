# Installing TIKI-100 Emulator (pre-built binaries)

> **Just want a quick test?** Run the emulator in your browser at **<https://tiki.hackercorp.no/>** — no install required.

Pre-built binaries for **macOS** (Apple Silicon), **Windows** (x64 / x86), **Linux amd64**, **Raspberry Pi OS 64-bit** (arm64), and **Raspberry Pi OS 32-bit** (armhf) are published on the [Releases page](../../../releases).

If you'd rather compile from source, see [BUILDING.md](BUILDING.md).

## Contents

- [Quick map — which file do I download?](#quick-map--which-file-do-i-download)
- [macOS (Apple Silicon)](#macos-apple-silicon)
- [Windows (x64 / x86)](#windows-x64--x86)
- [Linux / Raspberry Pi — one-liner installer (recommended)](#linux--raspberry-pi--one-liner-installer-recommended)
- [Linux / Raspberry Pi — direct `.deb` download](#linux--raspberry-pi--direct-deb-download)
- [Optional — full disk library](#optional--full-disk-library)
- [What next?](#what-next)
- [Troubleshooting](#troubleshooting)

---

## Quick map — which file do I download?

Each release page has several files. You only need **one binary** for your machine, plus optionally the disks zip.

| Your machine | Download |
|---|---|
| Mac with Apple Silicon (M1/M2/M3/M4) | `tiki100-macos-arm64.tar.gz` |
| Mac with Intel CPU | *No pre-built binary — build from source ([BUILDING.md](BUILDING.md))* |
| Windows 10/11 64-bit | `tiki100-windows-x64.zip` |
| Windows 32-bit | `tiki100-windows-x86.zip` |
| Linux desktop / server (most modern PCs) | `tiki100_<ver>_amd64.deb` |
| Raspberry Pi 3 / 4 / 5 / 500 (64-bit OS) | `tiki100_<ver>_arm64.deb` |
| Raspberry Pi 2 / Zero 2 W / 32-bit Pi OS | `tiki100_<ver>_armhf.deb` |
| **Optional add-on (any platform)** | `tiki100-disks-<ver>.zip` — full software library |

Not sure which CPU your Linux/Pi has? Run `uname -m`:
- `x86_64` → amd64
- `aarch64` → arm64
- `armv7l` → armhf

---

## macOS (Apple Silicon)

> **Intel Macs:** there is no pre-built Intel binary. Either run on Apple Silicon, or compile from source — see [BUILDING.md](BUILDING.md).

1. Download `tiki100-macos-arm64.tar.gz` from the [Releases page](../../../releases).
2. Open Terminal in your Downloads folder and extract:

   ```bash
   tar xzf tiki100-macos-arm64.tar.gz
   cd tiki100-macos-arm64
   ./tiki100 -fd0 disks/boot/tiko_kjerne_v4.01.dsk
   ```

### SDL2 runtime required

The binary links dynamically against SDL2. Install it once with [Homebrew](https://brew.sh):

```bash
brew install sdl2
```

If SDL2 is missing, the emulator fails at launch with a `dyld: Library not loaded` error.

### Gatekeeper warning — *"tiki100 cannot be opened because the developer cannot be verified"*

macOS quarantines anything you download from the internet. The release builds are unsigned (no Apple Developer certificate), so Gatekeeper blocks them on first run. Two workarounds:

- **Option A — remove the quarantine flag (quickest):**

  ```bash
  xattr -d com.apple.quarantine tiki100
  ./tiki100 ...
  ```

- **Option B — right-click → Open:** Right-click (or Ctrl-click) `tiki100` in Finder, choose **Open**, then click **Open** in the warning dialog. Only needed once per binary.

> See [apple-dev.md](apple-dev.md) for notes on signing/notarizing future releases.

---

## Windows (x64 / x86)

1. Download `tiki100-windows-x64.zip` (most modern PCs) or `tiki100-windows-x86.zip` (32-bit) from the [Releases page](../../../releases).
2. Right-click the ZIP → **Extract All…** → pick a folder. Anywhere is fine: `C:\Program Files\tiki100\`, your desktop, a USB stick, all work.
3. Open the extracted folder and either:
   - **Double-click `tiki100.exe`** to launch with the bundled boot disk, or
   - Open Command Prompt or PowerShell in that folder and run:

     ```cmd
     tiki100.exe -fd0 disks\boot\tiko_kjerne_v4.01.dsk
     ```

> **Important — keep `SDL2.dll` next to `tiki100.exe`.**
>
> The Windows binary depends on `SDL2.dll` at runtime, and Windows only searches a short list of locations for it — the first being the folder where the `.exe` lives. The release zip already has the correct layout:
>
> ```
> tiki100-windows-x64\
>   tiki100.exe        <-- the emulator
>   SDL2.dll           <-- must stay in the same folder
>   rom\
>   disks\boot\
> ```
>
> If you copy `tiki100.exe` somewhere else without `SDL2.dll`, Windows shows **"The code execution cannot proceed because SDL2.dll was not found"** on launch. Either keep the whole folder together, or also copy `SDL2.dll` to the same destination folder.

---

## Linux / Raspberry Pi — one-liner installer (recommended)

On any Debian-based distro (Debian, Ubuntu, Linux Mint, Pop!\_OS, **Raspberry Pi OS**), paste this into a terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/HackerCorpLabs/tiki100/main/scripts/install.sh | sh
```

The script auto-detects your CPU architecture (amd64 / arm64 / armhf), downloads the matching `.deb` from the **latest** GitHub Release, and runs `apt-get install` so the `libsdl2-2.0-0` runtime dependency is resolved automatically. You'll be prompted once for your sudo password.

After installation:

```bash
tiki100 -fd0 /usr/share/tiki100/disks/boot/tiko_kjerne_v4.01.dsk
```

**Pin a specific version** (use any released tag from the [Releases page](../../../releases)):

```bash
curl -fsSL https://raw.githubusercontent.com/HackerCorpLabs/tiki100/main/scripts/install.sh | TIKI100_VERSION=v1.0.2 sh
```

**Uninstall:**

```bash
sudo apt remove tiki100
```

**Prefer to inspect the script before running it?** Sensible habit with any `curl | sh` installer:

```bash
curl -fsSL -o install.sh https://raw.githubusercontent.com/HackerCorpLabs/tiki100/main/scripts/install.sh
less install.sh        # read it
sh install.sh          # then run
```

---

## Linux / Raspberry Pi — direct `.deb` download

If you don't want to pipe anything to a shell, grab the `.deb` for your architecture from the [Releases page](../../../releases) and install it directly:

| File | Target |
|------|--------|
| `tiki100_<ver>_amd64.deb` | 64-bit desktop/server Linux (Debian, Ubuntu, Mint, …) |
| `tiki100_<ver>_arm64.deb` | Raspberry Pi OS 64-bit (Pi 3, 4, 5, 500) |
| `tiki100_<ver>_armhf.deb` | Raspberry Pi OS 32-bit (Pi 2, 3, 4, Zero 2 W) |

Install with:

```bash
sudo apt install ./tiki100_<ver>_<arch>.deb
```

`apt install` on a local `.deb` file pulls in `libsdl2-2.0-0` automatically. Files land in:

```
/usr/bin/tiki100                              <-- the executable, on your PATH
/usr/share/tiki100/rom/                       <-- bundled ROMs
/usr/share/tiki100/disks/boot/                <-- bundled boot floppies
```

---

## Optional — full disk library

The platform binaries above ship only the bundled boot floppies in `disks/boot/`. If you want the **full software library** — educational programs, games, Wordstar, BASIC, Turbo Pascal, hard-disk images, and more — also download:

- **`tiki100-disks-<ver>.zip`** from the same [Releases page](../../../releases).

It's a single platform-agnostic ZIP (~50 MB) containing the entire `disks/` tree:

```
disks/
  boot/        <-- bundled boot floppies (same as in the binary zip)
  library/     <-- full software catalogue (.dsk + floppies.json)
  hdd/         <-- 8 MB hard-disk images (HD0.dsk, HD1.dsk, …)
```

### Where to extract it

The rule is simple: **the `disks/` folder must sit next to the `tiki100` binary** (or for the Linux `.deb` install, alongside the existing `disks/` under `/usr/share/tiki100/`).

#### Windows

1. Right-click `tiki100-disks-<ver>.zip` → **Extract All…**
2. Open the extracted `tiki100-disks-<ver>` folder. It contains a `disks/` folder.
3. Copy that `disks/` folder into your `tiki100-windows-x64\` (or x86) folder, **merging** with the existing `disks/`. When Windows asks "Replace the files in the destination?", click **Replace** — the new files include everything the old `disks/boot/` had.

After merging, the layout is:

```
tiki100-windows-x64\
  tiki100.exe
  SDL2.dll
  rom\
  disks\
    boot\
    library\        <-- now also present
    hdd\            <-- now also present
```

#### macOS

```bash
# In Terminal, in the same Downloads folder where you put the tarball:
unzip tiki100-disks-<ver>.zip
cp -R tiki100-disks-<ver>/disks/. tiki100-macos-arm64/disks/
```

The trailing `.` after `disks/` makes `cp` merge the new contents into the existing `disks/` folder (boot stays, library/hdd appear alongside).

#### Linux (manual / portable extract)

If you extracted a `tiki100-windows-...` style portable tree (rare on Linux — most users go via `.deb`), use the same approach as macOS:

```bash
unzip tiki100-disks-<ver>.zip
cp -R tiki100-disks-<ver>/disks/. /path/to/your/tiki100/disks/
```

#### Linux `.deb` installation

The `.deb` puts files under `/usr/share/tiki100/`, which is owned by root. To add the extras you have two reasonable choices:

- **Recommended (no root):** extract anywhere in your home directory, then pass paths to the binary explicitly:

  ```bash
  cd ~
  unzip ~/Downloads/tiki100-disks-<ver>.zip
  tiki100 -fd0 ~/tiki100-disks-<ver>/disks/boot/t400.dsk \
          -hd0 ~/tiki100-disks-<ver>/disks/hdd/HD0.dsk \
          -hd1 ~/tiki100-disks-<ver>/disks/hdd/HD1.dsk
  ```

- **System-wide (with sudo):** merge the extras into `/usr/share/tiki100/disks/` so the F12 menu's bundled catalog finds them automatically:

  ```bash
  cd /tmp
  unzip ~/Downloads/tiki100-disks-<ver>.zip
  sudo cp -R tiki100-disks-<ver>/disks/. /usr/share/tiki100/disks/
  ```

  Note that `sudo apt remove tiki100` won't delete the manually-added files — they were never tracked by `dpkg`. Remove them by hand if you uninstall.

### What you get after extraction

- The **F12 menu → Floppy tab → Catalog** lists every disk image in `disks/library/` (read from `disks/library/floppies.json`).
- The included hard-disk images can be mounted at startup with `-hd0`/`-hd1`, or via the **F12 menu → Hard Disk** tab.
- Bundled boot floppies in `disks/boot/`:

  | File | Size | Notes |
  |---|---|---|
  | `tiko_kjerne_v4.01.dsk` | 200 KB | TIKO/KP/M v4.01 — the standard boot disk |
  | `t90.dsk` | 90 KB | 90 KB single-sided 40-track |
  | `t200.dsk` | 200 KB | 200 KB single-sided 80-track |
  | `t400.dsk` | 400 KB | 400 KB double-sided 80-track |
  | `t800.dsk` | 800 KB | 800 KB high-density |

---

## What next?

Once the emulator is running, you'll probably want:

- **[User Manual (MANUAL.md)](MANUAL.md)** — beginner-friendly walkthrough: F12 menu, keyboard mapping, mounting disks, troubleshooting, FAQ, glossary.
- **[Runtime usage (USAGE.md)](USAGE.md)** — full command-line flag reference, key mapping, status LEDs.
- **[F12 configuration menu (MENU.md)](MENU.md)** — every control on every tab, in detail.
- **[Serial / TCP / Hayes modem (SERIAL.md)](SERIAL.md)** — dialing BBSes, hosting your own service.

---

## Troubleshooting

**Black window or "no available video device" on Raspberry Pi OS Lite** — you're running headlessly. Install a desktop (`sudo apt install raspberrypi-ui-mods`) or boot into a GUI session. Over SSH, use `ssh -X` for X11 forwarding, but expect poor performance.

**"tiki100: command not found" after `.deb` install** — make sure `/usr/bin` is on your `PATH` (it normally is). Try a fresh shell or run it explicitly: `/usr/bin/tiki100`.

**Sound stutters on Pi Zero 2 / Pi 2** — these have limited CPU. Try the `-fast` flag to disable throttling, or accept occasional buffer drops. The AY-3-8912 emulation is floating-point heavy.

**The F12 menu's Floppy catalog is empty** — the catalog reads `disks/library/floppies.json`. Either you're running the binary-only install (no library zip yet — see [Optional — full disk library](#optional--full-disk-library)), or `disks/library/` is somewhere the binary can't find it. Make sure `disks/` sits in the same folder as `tiki100`/`tiki100.exe`, or for Linux `.deb` installs, in `/usr/share/tiki100/disks/`.

**SDL2 errors on launch** — see the platform-specific *SDL2 runtime required* notes for macOS, the **keep `SDL2.dll` next to `tiki100.exe`** warning for Windows. On Linux/Pi the `.deb` resolves SDL2 automatically; if you bypassed `apt`, install it manually: `sudo apt install libsdl2-2.0-0`.
