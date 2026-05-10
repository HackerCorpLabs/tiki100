# Runtime usage

Once you have a `tiki100` binary (see [INSTALL.md](INSTALL.md) or [BUILDING.md](BUILDING.md)), this document covers everything about driving it: command-line flags, keyboard mapping, status LEDs, and example invocations.

For TCP serial / Hayes-modem features, see [SERIAL.md](SERIAL.md).

## Command-line options

```
tiki100 [options]

  -fd0 <file>      Floppy drive 0 image (physical FD0)
  -fd1 <file>      Floppy drive 1 image (physical FD1)
  -hd0 <file>      Hard disk 0 image (WD1010 heads 0-1)
  -hd1 <file>      Hard disk 1 image (WD1010 heads 2-3)
  -scale <1-4>     Window scale factor (default: 1)
  -fast            Run at full speed (no throttle, sound will drift)
  -sera <mode>     Serial channel A: modem | listen:PORT | connect:HOST:PORT
  -serb <mode>     Serial channel B: modem | listen:PORT | connect:HOST:PORT
  -h, --help       Show this help
```

**Drive mapping:** The TIKI-100 OS assigns logical drive letters (A:, B:, etc.) internally based on what is mounted. The emulator exposes drives by their physical slot — **FD0/FD1** for floppy, **HD0/HD1** for hard disk — and TIKI-OS decides the logical mapping.

**Serial ports:** Both `-sera` and `-serb` default to **Modem mode** when no flag is given. Modem mode emulates a Hayes-compatible modem — dial with `ATDT host:port` from any TIKI-100 terminal program. See [SERIAL.md](SERIAL.md) for full mode descriptions and the complete AT command reference.

## Keyboard notes

The TIKI-100 keyboard has several keys with no direct equivalent on modern hardware:

| Host key | TIKI-100 key | Notes |
|----------|-------------|-------|
| Esc | ESC (CTRL+Æ) | The TIKI-100 had no physical ESC key. The manual documents CTRL+Æ as the ESC sequence. Pressing Esc on the host simulates this combination. |
| F10 / Pause | BRYT | Break key |
| Backspace / Delete | SLETT | Delete key |
| F8 | GRAFIKK | Toggle graphics mode |
| F12 | — | Opens the emulator configuration overlay (not sent to the TIKI-100). See [MENU.md](MENU.md) for the full reference. |

## Status bar LEDs

The bottom of the emulator window shows a status bar with LEDs for system state and serial port activity. Hover over any LED to see a tooltip in the window title bar.

**System LEDs** (leftmost group):

| LED | Color | Meaning |
|-----|-------|---------|
| LOCK | Green | Caps Lock is active (active low: bit 7 of system register = 0) |
| GFX | Cyan | Graphics mode is enabled, video RAM is mapped into the Z80 address space (active low: bit 5 of system register = 0) |
| FD0 | Yellow | Floppy drive 0 (physical) is selected and active |
| FD1 | Yellow | Floppy drive 1 (physical) is selected and active |
| HD0 | Green | Hard disk 0 (WD1010 heads 0-1) is active; stays lit ~80 ms after last access |
| HD1 | Green | Hard disk 1 (WD1010 heads 2-3) is active; stays lit ~80 ms after last access |

The LOCK and GFX LEDs use active-low logic matching the real TIKI-100 mainboard. FD0/FD1 reflect the hardware drive-select lines from the FD1771 controller. HD0/HD1 use a sticky timer because the WD1010 has no persistent drive-select signal — the LED latches on when a sector command completes and clears after ~80 ms of inactivity.

**Serial port LEDs** (right of the separator `|`):

The serial ports are labelled **P1** (Serial A, DART channel A) and **P2** (Serial B, DART channel B), matching the names used in the TIKI-100 manual. Each port has two LEDs that blink when bytes actually pass through the DART chip:

| LED | Color | Meaning |
|-----|-------|---------|
| P1 TX | Orange | Serial A transmitted a byte to the network |
| P1 RX | Cyan | Serial A delivered a byte to the Z80 |
| P2 TX | Orange | Serial B transmitted a byte to the network |
| P2 RX | Cyan | Serial B delivered a byte to the Z80 |

LEDs stay lit for 150 ms after the last byte, giving a visible flash for short bursts. The LEDs are only active when a serial channel has an active worker thread (Modem/Listen/Connect mode configured).

## Examples

```bash
# Boot from floppy (physical FD0)
./build/bin/tiki100 -fd0 disks/tiko_kjerne_v4.01.dsk

# Boot with hard disks
./build/bin/tiki100 -hd0 disks/HD0.dsk -hd1 disks/HD1.dsk

# Floppy + hard disk
./build/bin/tiki100 -fd0 disks/t400.dsk -hd0 disks/HD0.dsk -hd1 disks/HD1.dsk

# Boot with modem on Channel A (modem is already the default, flag shown for clarity)
./build/bin/tiki100 -sera modem -fd0 disks/boot/tiko_kjerne_v4.01.dsk

# Channel A listens on port 5000 for incoming connections
./build/bin/tiki100 -sera listen:5000 -fd0 disks/boot/tiko_kjerne_v4.01.dsk

# Channel B connects outbound to a fixed serial bridge
./build/bin/tiki100 -serb connect:bridge.local:4000 -fd0 disks/boot/tiko_kjerne_v4.01.dsk
```
