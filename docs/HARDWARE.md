# Hardware reference

## Hardware emulated

| Component | Chip | Notes |
|-----------|------|-------|
| CPU | Zilog Z80A | 4 MHz |
| RAM | | 64 KB main + 32 KB video |
| ROM | | 8 KB monitor |
| Video | Discrete TTL | 1024x256 (2 col), 512x256 (4 col), 256x256 (16 col) |
| Sound | AY-3-8912 | 3 tone + noise + envelope, SDL2 audio output |
| Floppy | FD1771 | 2 drives, 90K-800K images |
| Hard Disk | WD1010 | 2 x 8 MB drives, 512-byte sectors |
| Serial | Z80 DART | Dual async ports |
| Parallel | Z80 PIO | Printer port |
| Timer | Z80 CTC | 4-channel counter/timer |

## I/O port map

| Port Range | Device | Read | Write |
|------------|--------|------|-------|
| 0x00-0x03 | Keyboard | Key matrix | Reset scanner |
| 0x04-0x07 | Serial (DART) | Data/status | Data/control |
| 0x08-0x0B | Parallel (PIO) | Data/status | Data/control |
| 0x0C-0x0F | Video | - | Mode register |
| 0x10-0x13 | Floppy (FD1771) | Status/track/sector/data | Command/track/sector/data |
| 0x14-0x15 | Palette | - | Color register |
| 0x16-0x17 | Sound (AY-3-8912) | Data read | Register select / data write |
| 0x18-0x1B | CTC | Counter read | Control/time constant |
| 0x1C-0x1F | System register | - | ROM/GFX/drive/motor/LEDs |
| 0x20-0x23 | HDD data (WD1010) | Data/error/count/sector | Data/precomp/count/sector |
| 0x24-0x27 | HDD control (WD1010) | Track/status | Track lo/hi/SDH/command |

## Project structure

```
src/
  cpu/              Z80 CPU emulation (Marat Fayzullin)
  machine/          Core emulator, memory management, I/O dispatch
  devices/
    video/          3-mode bitmap graphics
    keyboard/       8-column key matrix
    floppy/         FD1771 floppy disk controller
    hdd/            WD1010 hard disk controller
    serial/         Z80 DART dual serial
    parallel/       Z80 PIO printer port
    ctc/            Z80 CTC 4-channel timer
    sound/          AY-3-8912 PSG (3 tone + noise + envelope)
  debugger/         Z80 disassembler and debugger
  frontend/
    tiki100sdl/     SDL2 native frontend (Linux, RPi, Windows)
    tiki100wasm/    Emscripten WASM frontend
template-glass/     Glassmorphism web UI for WASM build
rom/                Monitor ROM (tiki.rom)
disks/              Floppy and hard disk images
org/                Original source code (reference, untouched)
```
