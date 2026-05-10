/**
 * TDV keyboard mapper using TDV2200KeyRegistry as single source of truth.
 * Handles Extended Control Mode (CSI nn _ sequences), Simple ASCII Mode (C0 codes),
 * and Numeric Pad Function Mode.
 *
 * Resolution order:
 * 1. Alt key bindings (Alt+H → HELP, etc.)
 * 2. TDV2115 mode C0 codes for fixed keys
 * 3. Registry lookup (fixed keys=C0, function/editing=CSI nn _)
 * 4. Backspace (PC-only key, sends BS=0x08)
 * 5. No fallback — keys without TDV equivalents return null
 */

import type { IKeyboardMapper } from './KeyboardMapper';
import { KeyModifiers, TerminalModes } from './KeyboardMapper';
import { TDV2200KeyRegistry } from './TDV2200KeyRegistry';
import type { LanguageCode } from './TDV2200KeyRegistry';

/**
 * ISO 8859-1 (8-bit) to ISO 646 (7-bit) character remapping tables.
 * Browsers send 8-bit codepoints for national characters, but TDV terminals
 * use 7-bit ISO 646 national variants where these characters replace
 * ASCII punctuation at specific positions.
 */
const ISO646_REMAPPING: Record<string, Map<number, number>> = {
  // Norwegian/Danish: ae=0x7B, oe=0x7C, aa=0x7D, AE=0x5B, OE=0x5C, AA=0x5D
  no: new Map<number, number>([
    [0xE6, 0x7B], // ae -> {
    [0xF8, 0x7C], // oe -> |
    [0xE5, 0x7D], // aa -> }
    [0xC6, 0x5B], // AE -> [
    [0xD8, 0x5C], // OE -> backslash
    [0xC5, 0x5D], // AA -> ]
  ]),
  dk: new Map<number, number>([
    [0xE6, 0x7B], [0xF8, 0x7C], [0xE5, 0x7D],
    [0xC6, 0x5B], [0xD8, 0x5C], [0xC5, 0x5D],
  ]),
  sv: new Map<number, number>([
    [0xE4, 0x7B], // a-umlaut -> {
    [0xF6, 0x7C], // o-umlaut -> |
    [0xE5, 0x7D], // a-ring -> }
    [0xC4, 0x5B], [0xD6, 0x5C], [0xC5, 0x5D],
  ]),
  fi: new Map<number, number>([
    [0xE4, 0x7B], [0xF6, 0x7C], [0xE5, 0x7D],
    [0xC4, 0x5B], [0xD6, 0x5C], [0xC5, 0x5D],
  ]),
  de: new Map<number, number>([
    [0xE4, 0x7B], [0xF6, 0x7C], [0xFC, 0x7D], // u-umlaut -> }
    [0xC4, 0x5B], [0xD6, 0x5C], [0xDC, 0x5D],
  ]),
  ch: new Map<number, number>([
    [0xE4, 0x7B], [0xF6, 0x7C], [0xFC, 0x7D],
    [0xC4, 0x5B], [0xD6, 0x5C], [0xDC, 0x5D],
  ]),
  fr: new Map<number, number>([
    [0xE9, 0x7B], // e-acute -> {
    [0xF9, 0x7C], // u-grave -> |
    [0xE8, 0x7D], // e-grave -> }
    [0xB0, 0x5B], // degree -> [
    [0xE7, 0x5C], // c-cedilla -> backslash
    [0xA7, 0x5D], // section -> ]
  ]),
};

export class TDVKeyboardMapper implements IKeyboardMapper {
  /** Whether Extended Control Mode is active (CSI sequences vs C0 codes) */
  extendedControlMode: boolean = true;

  /** Whether Numeric Pad Function Mode is active */
  numericPadFuncMode: boolean = false;

  /** Current keyboard language for ISO 646 remapping */
  language: LanguageCode = 'no';

  mapKey(keyCode: number, modifiers: KeyModifiers, terminalModes: TerminalModes): string | null {
    // 1. Alt key bindings (Alt+H → HELP, etc.)
    if (modifiers & KeyModifiers.Alt) {
      const shifted = !!(modifiers & KeyModifiers.Shift);
      const target = shifted
        ? TDV2200KeyRegistry.getDefaultAltShiftTarget(keyCode)
        : TDV2200KeyRegistry.getDefaultAltTarget(keyCode);
      if (target) {
        const key = TDV2200KeyRegistry.getKey(target);
        if (key && key.isProgrammable) {
          // PUSH key — caller should handle programmed string lookup
          return null;
        }
        const seq = TDV2200KeyRegistry.getSequence(target, true, false, shifted, false);
        if (seq !== null) return seq;
      }
    }

    // 2. TDV2115 mode: C0 codes for fixed keys
    if (terminalModes & TerminalModes.TDV2115Mode) {
      if (modifiers === KeyModifiers.None) {
        switch (keyCode) {
          case 38: return '\x1c'; // Up
          case 40: return '\x0b'; // Down
          case 39: return '\x18'; // Right
          case 37: return '\x08'; // Left
          case 36: return '\x1d'; // Home
        }
      }
    }

    // 3. Registry lookup (Extended Control Mode)
    if (!(modifiers & KeyModifiers.Alt)) {
      const grid = TDV2200KeyRegistry.getGridForVK(keyCode);
      if (grid !== null) {
        const shift = !!(modifiers & KeyModifiers.Shift);
        const ctrl = !!(modifiers & KeyModifiers.Ctrl);
        const seq = TDV2200KeyRegistry.getSequence(grid, this.extendedControlMode, this.numericPadFuncMode, shift, ctrl);
        if (seq !== null) return seq;
      }
    }

    // 4. Backspace fallback (PC-only key)
    if (keyCode === 8) return '\x08';

    // 5. No fallback
    return null;
  }

  /**
   * Remap an 8-bit ISO 8859-1 character to 7-bit ISO 646 national variant.
   * Returns the remapped character, or the original if no mapping exists.
   */
  remapCharacter(char: string): string {
    if (char.length !== 1) return char;
    const code = char.charCodeAt(0);
    if (code < 0x80) return char; // Already 7-bit ASCII
    const langMap = ISO646_REMAPPING[this.language];
    if (!langMap) return char;
    const mapped = langMap.get(code);
    if (mapped !== undefined) {
      return String.fromCharCode(mapped);
    }
    return char;
  }
}
