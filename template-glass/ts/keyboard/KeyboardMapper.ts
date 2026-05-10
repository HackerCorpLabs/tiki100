/**
 * Keyboard mapping system for terminal emulation.
 *
 * Key codes are aligned to Windows Virtual-Key (VK) values for cross-platform compatibility.
 * Text/character input is handled via DOM KeyboardEvent, independent of this mapper.
 */

/** Modifier flags for keyboard mapping */
export const enum KeyModifiers {
  None = 0,
  Shift = 1,
  Ctrl = 2,
  Alt = 4,
  Meta = 8,
}

/** Terminal mode flags that affect keyboard mapping */
export const enum TerminalModes {
  None = 0,
  ApplicationCursorKeys = 1,
  ApplicationKeypad = 2,
  VT220Mode = 4,
  TDV2115Mode = 8,
  TDV2215Mode = 16,
  TDV2200Mode = 32,
}

/** Interface for terminal-specific keyboard mapping */
export interface IKeyboardMapper {
  mapKey(keyCode: number, modifiers: KeyModifiers, terminalModes: TerminalModes): string | null;
}

/**
 * Convert KeyModifiers to xterm modifier parameter (1-based).
 * Returns 0 if no relevant modifiers.
 */
export function getXtermModifierParameter(modifiers: KeyModifiers): number {
  let param = 1;
  if (modifiers & KeyModifiers.Shift) param += 1;
  if (modifiers & KeyModifiers.Alt) param += 2;
  if (modifiers & KeyModifiers.Ctrl) param += 4;
  return param > 1 ? param : 0;
}

/**
 * Apply terminal mode modifications to a base escape sequence.
 * Converts cursor key sequences to application mode when DECCKM is set.
 */
function applyTerminalModeModifications(sequence: string, terminalModes: TerminalModes): string {
  if (terminalModes & TerminalModes.ApplicationCursorKeys) {
    if (sequence === '\x1b[A') return '\x1bOA';
    if (sequence === '\x1b[B') return '\x1bOB';
    if (sequence === '\x1b[C') return '\x1bOC';
    if (sequence === '\x1b[D') return '\x1bOD';
  }
  return sequence;
}

/** VT100/VT220 keyboard mapper */
export class VT100KeyboardMapper implements IKeyboardMapper {
  private readonly _keyMappings: Map<number, string> = new Map();

  constructor() {
    const m = this._keyMappings;
    // Basic control keys (VK-aligned key codes)
    m.set(13, '\r');       // VK_RETURN
    m.set(8, '\x08');      // VK_BACK
    m.set(9, '\t');        // VK_TAB
    m.set(27, '\x1b');     // VK_ESCAPE

    // Navigation keys
    m.set(38, '\x1b[A');   // VK_UP
    m.set(40, '\x1b[B');   // VK_DOWN
    m.set(39, '\x1b[C');   // VK_RIGHT
    m.set(37, '\x1b[D');   // VK_LEFT
    m.set(36, '\x1b[H');   // VK_HOME
    m.set(35, '\x1b[F');   // VK_END
    m.set(33, '\x1b[5~');  // VK_PRIOR (PageUp)
    m.set(34, '\x1b[6~');  // VK_NEXT (PageDown)
    m.set(45, '\x1b[2~');  // VK_INSERT
    m.set(46, '\x1b[3~');  // VK_DELETE

    // Function keys
    m.set(112, '\x1bOP');    // F1
    m.set(113, '\x1bOQ');    // F2
    m.set(114, '\x1bOR');    // F3
    m.set(115, '\x1bOS');    // F4
    m.set(116, '\x1b[15~'); // F5
    m.set(117, '\x1b[17~'); // F6
    m.set(118, '\x1b[18~'); // F7
    m.set(119, '\x1b[19~'); // F8
    m.set(120, '\x1b[20~'); // F9
    m.set(121, '\x1b[21~'); // F10
    m.set(122, '\x1b[23~'); // F11
    m.set(123, '\x1b[24~'); // F12
  }

  mapKey(keyCode: number, modifiers: KeyModifiers, terminalModes: TerminalModes): string | null {
    // Handle modifier combinations for navigation/edit keys
    if (modifiers !== KeyModifiers.None) {
      // Arrow keys and Home/End with modifiers: ESC[1;<mod><char>
      if (keyCode >= 35 && keyCode <= 40) {
        const modParam = getXtermModifierParameter(modifiers);
        if (modParam > 0) {
          const finalChar = keyCode === 37 ? 'D' : keyCode === 38 ? 'A' :
            keyCode === 39 ? 'C' : keyCode === 40 ? 'B' :
            keyCode === 36 ? 'H' : keyCode === 35 ? 'F' : null;
          if (finalChar) return `\x1b[1;${modParam}${finalChar}`;
        }
      }
      // Insert, Delete, PageUp, PageDown with modifiers: ESC[<num>;<mod>~
      if (keyCode === 45 || keyCode === 46 || keyCode === 33 || keyCode === 34) {
        const modParam = getXtermModifierParameter(modifiers);
        if (modParam > 0) {
          const keyNum = keyCode === 45 ? 2 : keyCode === 46 ? 3 :
            keyCode === 33 ? 5 : keyCode === 34 ? 6 : 0;
          if (keyNum > 0) return `\x1b[${keyNum};${modParam}~`;
        }
      }
    }

    // Handle base key
    const baseSequence = this._keyMappings.get(keyCode);
    if (baseSequence !== undefined) {
      return applyTerminalModeModifications(baseSequence, terminalModes);
    }

    return null;
  }
}

/**
 * Map a DOM KeyboardEvent.key to a VK-aligned key code.
 * Only maps non-text keys (arrows, F-keys, navigation).
 * Returns 0 for text-producing keys (those are handled via character events).
 */
export function domKeyToVK(key: string): number {
  switch (key) {
    case 'Backspace': return 8;
    case 'Tab': return 9;
    case 'Enter': return 13;
    case 'Escape': return 27;
    case 'PageUp': return 33;
    case 'PageDown': return 34;
    case 'End': return 35;
    case 'Home': return 36;
    case 'ArrowLeft': return 37;
    case 'ArrowUp': return 38;
    case 'ArrowRight': return 39;
    case 'ArrowDown': return 40;
    case 'Insert': return 45;
    case 'Delete': return 46;
    case 'F1': return 112;
    case 'F2': return 113;
    case 'F3': return 114;
    case 'F4': return 115;
    case 'F5': return 116;
    case 'F6': return 117;
    case 'F7': return 118;
    case 'F8': return 119;
    case 'F9': return 120;
    case 'F10': return 121;
    case 'F11': return 122;
    case 'F12': return 123;
    case 'CapsLock': return 20;
    case 'NumLock': return 144;
    default: return 0;
  }
}

/**
 * Convert DOM KeyboardEvent modifier state to KeyModifiers flags.
 */
export function domModifiersToFlags(ev: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }): KeyModifiers {
  let flags: number = KeyModifiers.None;
  if (ev.shiftKey) flags |= KeyModifiers.Shift;
  if (ev.ctrlKey) flags |= KeyModifiers.Ctrl;
  if (ev.altKey) flags |= KeyModifiers.Alt;
  if (ev.metaKey) flags |= KeyModifiers.Meta;
  return flags as KeyModifiers;
}
