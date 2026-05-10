# Installing TIKI-100 Emulator (pre-built binaries)

Pre-built binaries for macOS (arm64), Windows (x64/x86), Linux amd64, Raspberry Pi OS 64-bit (arm64), and Raspberry Pi OS 32-bit (armhf) are published on the [Releases page](../../../releases).

If you'd rather compile from source, see [BUILDING.md](BUILDING.md).

## Optional — full disk library

The platform binaries above ship only the boot floppy in `disks/boot/`. If you want the **full software library** (educational programs, games, BASIC, Wordstar, hard-disk images, …), also download:

- **`tiki100-disks-<version>.zip`** from the same [Releases page](../../../releases).

Extract it next to your `tiki100` binary. The zip contains the entire `disks/` tree (boot + library + hdd) — overwriting the bundled `disks/boot/` is harmless. After extraction the F12 menu's Floppy catalog will list every available image.

## macOS (arm64)

1. Download `tiki100-macos-arm64.tar.gz` from the [Releases page](../../../releases).
2. Extract and run:

   ```bash
   tar xzf tiki100-macos-arm64.tar.gz
   cd tiki100-macos-arm64
   ./tiki100 -fd0 disks/boot/tiko_kjerne_v4.01.dsk
   ```

### SDL2 runtime required

The binary links dynamically against SDL2. Install it with Homebrew if you haven't already:

```bash
brew install sdl2
```

If SDL2 is missing, the emulator will fail at launch with a `dyld: Library not loaded` error.

### Gatekeeper warning — "tiki100 cannot be opened because the developer cannot be verified"

macOS quarantines binaries downloaded from the internet. The release builds are currently unsigned (no Apple Developer certificate), so Gatekeeper blocks them on first run. Two workarounds:

- **Option A — remove the quarantine flag (quickest):**

  ```bash
  xattr -d com.apple.quarantine tiki100
  ./tiki100 ...
  ```

- **Option B — right-click → Open:** Right-click (or Ctrl-click) `tiki100` in Finder, choose **Open**, then click **Open** in the warning dialog. Only needed once per binary.

> To get properly signed and notarized releases in the future, see [apple-dev.md](apple-dev.md).

## Linux / Raspberry Pi — one-liner installer (recommended)

On any Debian-based distro (Debian, Ubuntu, Linux Mint, Pop!\_OS, **Raspberry Pi OS**), paste this into a terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/HackerCorpLabs/tiki100/main/scripts/install.sh | sh
```

The script auto-detects your CPU architecture (amd64 / arm64 / armhf), downloads the matching `.deb` from the **latest** GitHub Release, and runs `apt-get install` so that the `libsdl2-2.0-0` runtime dependency is resolved automatically. You'll be prompted once for your sudo password during the `apt` step.

After installation:

```bash
tiki100 -fd0 /usr/share/tiki100/disks/boot/tiko_kjerne_v4.01.dsk
```

**Pin a specific version:**

```bash
curl -fsSL https://raw.githubusercontent.com/HackerCorpLabs/tiki100/main/scripts/install.sh | TIKI100_VERSION=v0.2.0 sh
```

**Uninstall:**

```bash
sudo apt remove tiki100
```

**Prefer to inspect the script before running it?** That's a sensible habit with any `curl | sh` installer. Download it first, read it, then run:

```bash
curl -fsSL -o install.sh https://raw.githubusercontent.com/HackerCorpLabs/tiki100/main/scripts/install.sh
less install.sh        # read it
sh install.sh          # then run
```

## Linux / Raspberry Pi — direct `.deb` download

If you don't want to pipe anything to a shell, grab the `.deb` for your architecture from the [Releases page](../../../releases) and install it directly:

| File | Target |
|------|--------|
| `tiki100_<ver>_amd64.deb` | 64-bit desktop/server Linux (Debian, Ubuntu, Mint, …) |
| `tiki100_<ver>_arm64.deb` | Raspberry Pi OS 64-bit (Pi 3, 4, 5, 500) |
| `tiki100_<ver>_armhf.deb` | Raspberry Pi OS 32-bit (Pi 2, 3, 4, Zero 2 W) |

Not sure which architecture you have? Run `uname -m`:

- `x86_64` → amd64
- `aarch64` → arm64
- `armv7l` → armhf

Install with:

```bash
sudo apt install ./tiki100_<ver>_<arch>.deb
```

`apt install` on a local `.deb` file pulls in `libsdl2-2.0-0` automatically, so there are no separate dependency steps. Files land in:

```
/usr/bin/tiki100                              <-- the executable, on your PATH
/usr/share/tiki100/rom/                       <-- bundled ROMs
/usr/share/tiki100/disks/boot/                <-- bundled boot floppies
```

## Windows (x64 / x86)

1. Download `tiki100-windows-x64.zip` (64-bit) or `tiki100-windows-x86.zip` (32-bit) from the [Releases page](../../../releases).
2. Extract the zip anywhere — e.g. `C:\Program Files\tiki100\`, your desktop, or a USB stick.
3. Open the extracted folder and double-click `tiki100.exe`, or run it from a command prompt:

   ```cmd
   cd path\to\extracted\folder
   tiki100.exe -fd0 disks\boot\tiko_kjerne_v4.01.dsk
   ```

> **Important — keep `SDL2.dll` next to `tiki100.exe`.**
>
> The Windows binary depends on `SDL2.dll` at runtime, and Windows only searches a short list of locations for it — the first of which is the folder where the `.exe` lives. The release zip already has the correct layout:
>
> ```
> tiki100-windows-x64\
>   tiki100.exe        <-- the emulator
>   SDL2.dll           <-- must stay in the same folder
>   rom\
>   disks\boot\
> ```
>
> If you copy `tiki100.exe` somewhere else without `SDL2.dll`, Windows will show **"The code execution cannot proceed because SDL2.dll was not found"** on launch. Either keep the whole folder together, or also copy `SDL2.dll` to the same destination folder.

## Troubleshooting

**Black window or "no available video device" on Raspberry Pi OS Lite** — you're running headlessly. Install a desktop (`sudo apt install raspberrypi-ui-mods`) or boot into a GUI session. Over SSH, use `ssh -X` for X11 forwarding, but expect poor performance.

**"tiki100: command not found" after `.deb` install** — make sure `/usr/bin` is on your `PATH` (it normally is). Try a fresh shell or explicitly: `/usr/bin/tiki100`.

**Sound stutters on Pi Zero 2 / Pi 2** — these have limited CPU. Try `-fast` to disable throttling, or accept occasional buffer drops. The AY-3-8912 emulation is floating-point heavy.
