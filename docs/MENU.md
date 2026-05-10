# Configuration overlay (F12 menu)

Press **F12** in the running emulator to open the configuration overlay.
Press **F12** or **Esc** again to close it. The Z80 is paused while the
menu is open, so it's safe to swap disks, change ROMs, or reconfigure
serial ports without disturbing the running OS.

The overlay has five tabs along the top: **Machine**, **Floppy**, **Hard
Disk**, **Serial**, **About**. Click a tab name to switch to it. The
active tab is shown with a highlighted background and accent text colour.

---

## Machine tab

CPU speed, volume, and ROM selection.

### CPU Speed

Five discrete speed modes:

| Label    | Frequency | Multiplier |
|----------|-----------|------------|
| `slow`   | 2 MHz     | 0.5×       |
| `normal` | 4 MHz     | 1× *(default — period-accurate)* |
| `2x`     | 8 MHz     | 2×         |
| `4x`     | 16 MHz    | 4×         |
| `full`   | unthrottled | runs as fast as the host |

Two ways to change:

- **Drag the slider knob** along the track. The knob snaps to one of the
  five stops. Clicking on the track also jumps the knob to that stop.
- **Click a label** (`slow`, `normal`, `2x`, `4x`, `full`) under the
  slider to jump directly to that speed. The active speed is highlighted
  in the accent colour.

The current numeric readout (`4 MHz  1x (normal)` etc.) is shown next to
the *CPU Speed:* heading.

### Volume

AY-3-8912 PSG output volume, 0–100%, in 5% increments. Same enlarged
slider style as CPU speed.

### ROM

Lists every ROM declared in `rom/roms.json`. Click a radio button to
select. The change is **pending** until you click **Reboot TIKI-100**
at the bottom of the tab — the live ROM mapping isn't swapped until the
machine restarts. The default ROM (`TIKI-ROM V2.03 W`) is marked
`(default)` in the list.

### Reboot TIKI-100

Soft-resets the Z80 and re-maps the selected ROM. Used to apply a
pending ROM change.

---

## Floppy tab

Two FD1771-controlled drives, **FD0** and **FD1**. The active *target*
drive (the one a Mount/Swap action will apply to) is marked with `>>`
and an accent border.

### Drive cards

Each card shows the drive label, the currently mounted image filename
(green) or `-- empty slot --` (grey), and an **Eject** button when a
disk is mounted. Click anywhere inside a card (header or filename) to
make that drive the target.

### Source toggle

Two ways to find a disk image:

- **Catalog** *(default)* — the bundled disk catalogue from
  `disks/disks.json`. Type into the **Filter:** box to narrow the list
  by case-insensitive substring match. Click a row to select it. Each
  row shows size and label.
- **File path** — type or paste an absolute path, or click **Browse** to
  pick one with the native file dialog (uses zenity on Linux, the
  built-in dialog on Windows/macOS).

### Action bar

The bottom bar shows what will happen on click. The button is labelled
**Mount to FDx** when the target drive is empty, **Swap into FDx** when
a disk is already mounted (the existing one is ejected). In Catalog
mode the button is disabled until you select a row.

---

## Hard Disk tab

Two WD1010 drives, **HD0** and **HD1**, each holding an 8 MB image.

Each drive card shows the mounted filename (green) or `Not mounted`
(grey). When unmounted, type a path or click **Browse**, then **Mount
HDx**. When mounted, click **Eject** to detach the image. Errors
(missing file, etc.) appear in red below the input.

The footer reminds you of the head mapping inside the WD1010
controller: **heads 0–1 = HD0, heads 2–3 = HD1**.

---

## Serial tab

Two Z80 DART channels, **Channel A (SerA)** and **Channel B (SerB)**,
each independently configurable. See [SERIAL.md](SERIAL.md) for the
full protocol details — this section just covers the menu controls.

Each channel card has:

- **Status line** (top right, green) — current state, e.g.
  `listening :3001`, `-> 192.168.1.5:23`, or
  `modem -- connected to bbs.example.com:23`.
- **Mode buttons** — **Listen**, **Connect**, **Modem**. The active
  mode is shown in the accent colour.
- **Apply A / Apply B** button — commits any field edits to the live
  serial port.
- **Mode-conditional fields**:
  - *Listen* — TCP port to listen on.
  - *Connect* — Host and Port to connect to.
  - *Modem* — no fields here; dial from inside the emulated machine
    using `ATDT host:port`.

Changes are not applied until you click **Apply**.

---

## About tab

Version + build timestamp, hardware summary, and credits for the
upstream code (Marat Fayzullin's Z80, MAME's AY-3-8912, etc.). No
interactive controls.

---

## Known issues

- **Window maximize**: when the SDL window is maximized, the menu
  visually stays at its native ~900×500 size in the top-left corner of
  the larger window (the rest is dimmed). Clicks land correctly on the
  small menu's tab/button positions. This is a Nuklear/SDL render-scale
  limitation that is tracked separately; the menu is fully usable in
  the meantime, just not visually scaled up.

---

**Full path of this document:**
`E:\Dev\Emulators\Z80\ronny-tiki100\docs\MENU.md`
