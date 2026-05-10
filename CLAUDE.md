# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A cross-platform hardware emulator for the TIKI-100, a Norwegian CP/M-compatible computer from 1984. Written in C with SDL2 (native) and Emscripten (WebAssembly) frontends. The emulator targets 4 MHz Zilog Z80 with period-accurate peripheral chips.

## Build Commands

The Makefile is a wrapper around CMake. Always prefer `make` targets over invoking CMake directly.

```bash
make debug              # Debug build with Z80 debugger enabled (DEBUGGER_ENABLED=ON)
make release            # Optimized release build (debugger disabled)
make clean              # Remove all build directories
make boot               # Build and run with floppy image (tiko_kjerne_v4.01.dsk)
make run                # Build and run with hard disk images (HD0.dsk + HD1.dsk)
make wasm               # WebAssembly build (requires Emscripten)
make wasm-glass         # WASM + glassmorphism UI with TypeScript compilation
make wasm-glass-run     # Build glass UI and serve on localhost:8000
make ts-compile         # Compile TypeScript keyboard bundle via esbuild
make help               # List all targets
```

Dependencies are checked automatically before any build. On Windows with w64devkit, run `make fetch-sdl2` first to download the SDL2 MinGW devel package.

There is no automated test suite — validation is manual via ROM/disk images and the Z80 debugger.

## Architecture

### Layer Model

```
cpu/          Z80 CPU interpreter (Marat Fayzullin)
machine/      Memory management (RdZ80/WrZ80), I/O dispatch, main emulation loop
devices/      Hardware peripheral controllers (video, keyboard, floppy, hdd, serial, ctc, sound)
debugger/     Z80 disassembler (debug builds only)
frontend/     Platform-specific display/input (tiki100sdl or tiki100wasm)
```

### Emulation Loop

`RunZ80()` runs Z80 opcodes. Every 4000 cycles (~1ms at 4 MHz), `LoopZ80()` fires to:
- Tick the CTC and AY-3-8912
- Call `loopEmul(20)` every 20ms for frontend updates (input, display flush)
- In WASM step mode: return `INT_QUIT` each period to yield to the JS event loop

### Memory Model

- 64 KB main RAM + 32 KB graphics RAM
- 8 KB ROM (monitor) at 0xF000–0xFFFF when ROM-enabled
- Graphics RAM can be bank-switched into 0x0000–0x7FFF when GFX mode is active

### I/O Port Map (key ranges)

| Ports     | Device          |
|-----------|-----------------|
| 0x00–0x03 | Keyboard matrix |
| 0x04–0x07 | Serial (Z80 DART) |
| 0x08–0x0B | Parallel (Z80 PIO) |
| 0x0C–0x0F | Video mode/palette |
| 0x10–0x13 | Floppy (FD1771) |
| 0x16–0x17 | Sound (AY-3-8912) |
| 0x18–0x1B | Timer (Z80 CTC) |
| 0x1C–0x1F | System register (ROM/GFX enable, drive select, LEDs) |
| 0x20–0x27 | Hard disk (WD1010) |

### Frontend Callback Interface

The emulation core calls these functions that each frontend must implement:

```c
void changeRes(int mode);                        // switch video resolution
void plotPixel(int x, int y, int color);         // draw pixel
void scrollScreen(int scroll);                   // scroll display
void changePalette(int index, int r, int g, int b);
void loopEmul(int ms);                           // periodic timing/input
void lockLight(int on);                          // status LED
void grafikkLight(int on);
void diskLight(int drive, int on);
int  testKey(int col, int row);                  // keyboard matrix
```

This interface is defined in `src/machine/TIKI-100_emul.h`.

### Video System

Three resolution modes map to a fixed 1024×512 SDL/canvas window:
- `HIGHRES`: 1024×256, 2-color
- `MEDRES`: 512×256, 4-color
- `LOWRES`: 256×256, 16-color

### Sound

AY-3-8912 PSG runs at CPU/2 (2 MHz). The emulator fills a ring buffer from the CPU thread; SDL drains it in the audio callback at 44.1 kHz stereo float.

### WASM Frontend

`src/frontend/tiki100wasm/` integrates with `template-glass/` — a TypeScript/JS UI with a glassmorphism design. TypeScript keyboard mappers in `template-glass/ts/keyboard/` support multiple retro layouts (TIKI-100, TDV2200, ND246, etc.) and are bundled via esbuild.

## CI/CD

Releases are triggered by pushing a `v*` tag. Five parallel GitHub Actions jobs build:
- Windows x64 and x86 (MSYS2/MINGW)
- Linux amd64 `.deb` (ubuntu-latest + fpm)
- Linux arm64 and armhf `.deb` (QEMU via `run-on-arch-action` — takes 10–20 min)

A final `publish-release` job collects all artifacts and creates the GitHub Release.
