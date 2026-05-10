# Building TIKI-100 Emulator from source

The same codebase builds on all supported platforms from the same top-level `make debug` / `make release` entry points. The Makefile auto-detects the host OS and picks the right SDL2 source:

| Target | Variant | Toolchain | SDL2 source | CMake generator |
|--------|---------|-----------|-------------|-----------------|
| Linux | **x86_64** (desktop) | system gcc | `libsdl2-dev` (apt/dnf/pacman) | Unix Makefiles |
| Raspberry Pi OS | **arm64** (aarch64) | system gcc | `libsdl2-dev` | Unix Makefiles |
| Raspberry Pi OS | **armhf** (armv7) | system gcc | `libsdl2-dev` | Unix Makefiles |
| macOS | **arm64** (Apple Silicon) | Xcode CLT + Clang | `sdl2` (Homebrew) | Unix Makefiles |
| Windows | **x64** (x86_64) | w64devkit-x64 *or* MSYS2 MINGW64 | vendored `external/SDL2/` *or* pacman | Ninja (forced) |
| Windows | **x86** (i686) | w64devkit-x86 *or* MSYS2 MINGW32 | vendored `external/SDL2/` *or* pacman | Ninja (forced) |

## Common requirements

All variants need:

| Tool | Minimum version | Notes |
|------|----------------|-------|
| **CMake** | 3.14 | Out-of-source build, Ninja on Windows, Unix Makefiles elsewhere |
| **C compiler** | GCC 10+ or Clang 12+ | C99 |
| **SDL2 dev headers + libs** | 2.0.18+ | Window, input, audio, timer |
| **pkg-config** | any | Used to locate SDL2 on Unix-likes and under MSYS2 |
| **GNU make** | 4.x | Drives the CMake wrapper targets |

**Optional (recommended):**

| Tool | Notes |
|------|-------|
| **zenity** | Native file dialog for the F12 menu Browse button (Linux). Alternatives: `kdialog`, `yad`. Without one of these, the Browse button is disabled and you must type paths manually. |

WebAssembly (`make wasm`) additionally requires the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) — Linux or macOS host only.

---

## Linux — x86_64 (desktop)

**Target:** 64-bit Debian, Ubuntu, Fedora, Arch, or similar, running an X11 or Wayland session.

### Install dependencies

**Debian / Ubuntu / Linux Mint / Pop!\_OS:**

```bash
sudo apt update
sudo apt install build-essential cmake pkg-config libsdl2-dev zenity
```

**Fedora / RHEL / CentOS Stream:**

```bash
sudo dnf install gcc make cmake pkgconf-pkg-config SDL2-devel zenity
```

**Arch / Manjaro:**

```bash
sudo pacman -S --needed base-devel cmake sdl2 zenity
```

**openSUSE:**

```bash
sudo zypper install gcc make cmake pkgconf libSDL2-devel zenity
```

> Ninja is not needed on Linux/macOS — the Makefile uses CMake's default Unix Makefiles generator on these hosts. Ninja is only forced on Windows (see [Common requirements](#common-requirements)).

### Build and run

```bash
git clone https://github.com/HackerCorpLabs/tiki100.git
cd tiki100
make release                                         # → build_release/bin/tiki100
./build_release/bin/tiki100 -fd0 disks/boot/tiko_kjerne_v4.01.dsk
```

`make debug` produces an unoptimized build with the Z80 debugger under `build/bin/tiki100` instead — useful for stepping through emulation.

---

## Raspberry Pi OS — 64-bit (arm64)

**Target:** Raspberry Pi 3, 4, 5, or 500 running Raspberry Pi OS 64-bit (Bookworm or Bullseye). `uname -m` should print `aarch64`.

### Install dependencies

Raspberry Pi OS is Debian-based, so this is the same apt install as desktop Linux:

```bash
sudo apt update
sudo apt install build-essential cmake pkg-config libsdl2-dev zenity
```

Optional — if building on a Pi 3 (slower), prefer Pi 4/5 or use a cross-compile setup; the above commands still work everywhere.

### Build and run

```bash
git clone https://github.com/HackerCorpLabs/tiki100.git
cd tiki100
make release
./build_release/bin/tiki100 -fd0 disks/boot/tiko_kjerne_v4.01.dsk
```

Typical `make release` time on a Pi 4: ~2–3 minutes. On a Pi 5: under 1 minute.

---

## Raspberry Pi OS — 32-bit (armhf / armv7)

**Target:** Raspberry Pi 2, 3, 4, or Zero 2 W running Raspberry Pi OS 32-bit (Bookworm or Bullseye). `uname -m` should print `armv7l`.

> **Not supported:** Raspberry Pi 1 / Zero / Zero W (armv6). Debian armhf requires armv7 or newer. You could rebuild with explicit `-march=armv6` flags, but it's untested.

### Install dependencies

Identical to the arm64 variant — apt does not care about 32-bit vs 64-bit here:

```bash
sudo apt update
sudo apt install build-essential cmake pkg-config libsdl2-dev zenity
```

### Build and run

```bash
git clone https://github.com/HackerCorpLabs/tiki100.git
cd tiki100
make release
./build_release/bin/tiki100 -fd0 disks/boot/tiko_kjerne_v4.01.dsk
```

Typical `make release` time on a Pi 4 running Pi OS 32-bit: ~3 minutes.

---

## macOS — arm64 (Apple Silicon)

**Target:** macOS 12 Monterey or later, Apple Silicon (arm64).

### Install dependencies

Xcode Command Line Tools supply `make`, `clang`, and `cmake`-compatible build infrastructure. If not already installed:

```bash
xcode-select --install
```

Install CMake and SDL2 via Homebrew:

```bash
brew install cmake sdl2
```

### Build and run

```bash
git clone https://github.com/HackerCorpLabs/tiki100.git
cd tiki100
make release
./build_release/bin/tiki100 -fd0 disks/boot/tiko_kjerne_v4.01.dsk
```

CMake auto-detects Homebrew's SDL2 prefix (`/opt/homebrew` on Apple Silicon, `/usr/local` on Intel) — no extra flags required.

> **Note on `make wasm-glass`:** the cache-busting step uses `sed -i` with GNU sed syntax. macOS ships BSD sed, which requires an extension argument. Install GNU sed and put it on your PATH before running this target:
> ```bash
> brew install gnu-sed
> export PATH="$(brew --prefix gnu-sed)/libexec/gnubin:$PATH"
> make wasm-glass
> ```

---

## Windows — x64 (64-bit)

**Target:** 64-bit Windows 10 or 11. Produces a 64-bit `tiki100.exe` (PE32+ x86-64).

Two equally valid toolchain options. Pick **A** if you want zero-install/portable; pick **B** if you want the exact same environment CI uses.

### Option A: w64devkit + `build.bat` (recommended for local builds)

[w64devkit](https://github.com/skeeto/w64devkit) is a portable MinGW-w64 toolchain — gcc, CMake, Ninja, make, pkg-config, sh, curl, unzip — in a single ~80 MB archive. No installer, no registry entries, no PATH changes required.

**1. Install w64devkit.**

1. Download the **64-bit** release from [github.com/skeeto/w64devkit/releases](https://github.com/skeeto/w64devkit/releases). Pick `w64devkit-x64-<version>.exe` (a self-extracting archive — despite the `.exe` name, it just extracts, no install) or `w64devkit-x64-<version>.zip`.
2. Extract to a folder without spaces. The default `build.bat` expects `C:\Utils\w64devkit\`. If you put it elsewhere, you can either:
   - Edit the `W64DEVKIT` default at the top of `build.bat`, or
   - Set the `W64DEVKIT` environment variable before running:
     ```cmd
     set W64DEVKIT=D:\tools\w64devkit
     build.bat
     ```

There is **no need to add anything to your system `PATH`** — `build.bat` handles that for the duration of the build and leaves your environment untouched.

**2. Build.** Open a regular Windows command prompt (`cmd.exe`, PowerShell, Windows Terminal — whatever you like), `cd` into the repo, and run:

```cmd
cd C:\path\to\tiki100
build.bat
```

That's it. `build.bat` will:

1. Verify w64devkit is present at `%W64DEVKIT%` (default `C:\Utils\w64devkit`).
2. Prepend `%W64DEVKIT%\bin` to `PATH` for this shell only.
3. Auto-run `make fetch-sdl2` on first build to download SDL2 into `external\SDL2\` (~13 MB).
4. Run `make release` (or `make debug` if you passed `debug`).
5. Copy `SDL2.dll` next to `tiki100.exe` so it's immediately runnable.

Supported arguments:

```cmd
build.bat                 :: release build (default)
build.bat release         :: release build, explicit
build.bat debug           :: debug build with Z80 debugger
build.bat clean           :: remove build\ and build_release\
```

Output goes to:

- `build_release\bin\tiki100.exe` + `build_release\bin\SDL2.dll` for release builds
- `build\bin\tiki100.exe` + `build\bin\SDL2.dll` for debug builds

**3. Run.**

```cmd
build_release\bin\tiki100.exe -fd0 disks\boot\tiko_kjerne_v4.01.dsk
```

### Option B: MSYS2 MINGW64 (matches CI exactly)

[MSYS2](https://www.msys2.org/) is a larger environment but uses pacman for packages, and this path mirrors exactly what the GitHub Actions release workflow does — so if your local build works, CI should too.

**Install the toolchain:**

1. Download and run the installer from [msys2.org](https://www.msys2.org/). Accept the defaults.
2. From the Start Menu, launch **MSYS2 MINGW64** (*not* MSYS2 MSYS — the environment matters).
3. Update the base system (first time only):

   ```bash
   pacman -Syu
   # If prompted to close and reopen, do so and run `pacman -Su` once more.
   ```

**Install the toolchain + SDL2:**

```bash
pacman -S --needed base-devel git \
    mingw-w64-x86_64-gcc \
    mingw-w64-x86_64-cmake \
    mingw-w64-x86_64-ninja \
    mingw-w64-x86_64-pkgconf \
    mingw-w64-x86_64-SDL2
```

**Build:** no `external/SDL2/` needed — `pkg-config` will find the pacman-installed SDL2:

```bash
cd /c/path/to/tiki100
make release                          # → build_release/bin/tiki100.exe
```

**Run:**

```bash
cp /mingw64/bin/SDL2.dll build_release/bin/
./build_release/bin/tiki100.exe -fd0 disks/boot/tiko_kjerne_v4.01.dsk
```

---

## Windows — x86 (32-bit)

**Target:** 32-bit Windows or 64-bit Windows running a 32-bit binary. Produces a 32-bit `tiki100.exe` (PE32 i386).

> **w64devkit is single-target** — each release ships only one compiler architecture. The default 64-bit w64devkit **cannot produce 32-bit binaries** (it's configured with `--disable-multilib` and only has `x86_64-w64-mingw32` tools). You need either a **separate** 32-bit w64devkit install or MSYS2 MINGW32.

### Option A: w64devkit-x86 (separate 32-bit install)

1. Download the **32-bit** release (`w64devkit-x86-<version>.exe` or `.zip`) from [github.com/skeeto/w64devkit/releases](https://github.com/skeeto/w64devkit/releases) — this is a separate download from the x64 release and produces 32-bit binaries only.
2. Extract to its own folder, e.g. `C:\Utils\w64devkit-x86\` (keep it separate from any 64-bit install).
3. Launch `w64devkit.exe` from **that** folder.
4. Fetch SDL2, build, and run — same commands as the x64 w64devkit flow:

   ```bash
   cd /c/path/to/tiki100
   make fetch-sdl2        # fetches the same devel zip; contains both 32- and 64-bit trees
   make release           # CMake auto-selects external/SDL2/i686-w64-mingw32/ here
   cp external/SDL2/i686-w64-mingw32/bin/SDL2.dll build_release/bin/
   ./build_release/bin/tiki100.exe -fd0 disks/boot/tiko_kjerne_v4.01.dsk
   ```

The SDL2 MinGW devel zip contains both `x86_64-w64-mingw32/` and `i686-w64-mingw32/` subtrees — the CMakeLists picks the right one based on `CMAKE_SIZEOF_VOID_P` (i.e., whichever arch your compiler produces).

### Option B: MSYS2 MINGW32 (matches CI exactly)

From a standard MSYS2 install, use the **MSYS2 MINGW32** shell instead of MINGW64:

```bash
pacman -S --needed base-devel git \
    mingw-w64-i686-gcc \
    mingw-w64-i686-cmake \
    mingw-w64-i686-ninja \
    mingw-w64-i686-pkgconf \
    mingw-w64-i686-SDL2
```

Build and run:

```bash
cd /c/path/to/tiki100
make release
cp /mingw32/bin/SDL2.dll build_release/bin/
./build_release/bin/tiki100.exe -fd0 disks/boot/tiko_kjerne_v4.01.dsk
```

---

## CMake options

The Makefile wraps CMake but you can also invoke CMake directly if you need to tweak options:

| Option | Default | Effect |
|--------|---------|--------|
| `-DCMAKE_BUILD_TYPE=` | `Debug` (via `make debug`) / `Release` (via `make release`) | Standard CMake optimization level |
| `-DDEBUGGER_ENABLED=ON\|OFF` | `ON` | Compiles the Z80 step-debugger; set `OFF` for smaller release binaries |
| `-DBUILD_WASM=ON` | `OFF` | Selects the Emscripten/WASM frontend instead of SDL2 native |

To disable the debugger in a release build via Make:

```bash
DEBUGGER_ENABLED=OFF make release
```

Or to invoke CMake by hand (useful for IDE integration):

```bash
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DDEBUGGER_ENABLED=OFF
cmake --build . -j
```

## Build targets

```
make debug          # Debug build (default)
make release        # Optimized release build
make fetch-sdl2     # Download SDL2 MinGW devel (local Windows / w64devkit)
make run            # Build and run with hard disks (HD0.dsk + HD1.dsk)
make boot           # Build and boot from floppy (tiko_kjerne_v4.01.dsk)
make wasm           # WebAssembly build (Linux/macOS — requires Emscripten SDK)
make wasm-glass     # WASM with glassmorphism web UI
make wasm-glass-run # Build and serve glass UI on localhost:8000
make clean          # Remove all build directories
make help           # Show all targets
```

## Releases (GitHub Actions)

Tagged releases are built automatically by `.github/workflows/release.yml`. Pushing any tag matching `v*` (e.g. `v0.2.0`) triggers five parallel builds and publishes a GitHub Release with all artifacts attached:

| Artifact | Target | How it's built |
|----------|--------|----------------|
| `tiki100-macos-arm64.tar.gz` | macOS Apple Silicon (any M-series) | `macos-latest` runner |
| `tiki100-windows-x64.zip` | Windows 64-bit | `windows-latest`, MSYS2 **MINGW64**, bundled `SDL2.dll` |
| `tiki100-windows-x86.zip` | Windows 32-bit | `windows-latest`, MSYS2 **MINGW32**, bundled `SDL2.dll` |
| `tiki100_<ver>_amd64.deb` | 64-bit desktop Linux | Native build on `ubuntu-latest`, packaged with `fpm` |
| `tiki100_<ver>_arm64.deb` | Raspberry Pi OS 64-bit | `ubuntu-latest` + QEMU (`debian:bookworm` aarch64), `fpm` on host |
| `tiki100_<ver>_armhf.deb` | Raspberry Pi OS 32-bit | `ubuntu-latest` + QEMU (`debian:bookworm` armv7), `fpm` on host |

The macOS binaries are **unsigned** — see the [Gatekeeper note](INSTALL.md#gatekeeper-warning--tiki100-cannot-be-opened-because-the-developer-cannot-be-verified) in INSTALL.md, or [apple-dev.md](apple-dev.md) for how to add signing and notarization.

The Linux `.deb` packages declare `libsdl2-2.0-0` as a `Depends:`, so `apt install` resolves the SDL2 runtime automatically — users never need to install it by hand.

To cut a release:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The workflow can also be triggered manually via **Actions → Release builds → Run workflow** for a dry build (no published release, artifacts only).

> **Note on ARM build times:** the Pi builds run inside a QEMU-emulated Debian bookworm container, so they take noticeably longer than the amd64 and Windows jobs (typically 10–20 minutes each). This is fine for release builds but too slow for per-commit CI.
