/**
 * ALT+key → TDV special key mapping.
 * Provides mappings from PC Alt+key combinations to TDV keyboard grid positions.
 * Used to give quick access to TDV-specific keys (HELP, DO, FUNC, etc.)
 * from a standard PC keyboard.
 *
 * Default mappings:
 *   Alt+H → HELP (HJELP)    Alt+A → MARK (MERK)    Alt+1-8 → PUSH1-8
 *   Alt+D → DO (REPLACE)    Alt+L → FIELD (FELT)    Alt+F1-F8 → PUSH1-8
 *   Alt+U → FUNC (FUNK)     Alt+R → PARA (AVSH)     Alt+Delete → DELETE (STRYK)
 *   Alt+P → PRINT (SKRIV)   Alt+E → SENT (SETN)     Alt+PageUp → ROLLDN
 *   Alt+S → EXIT (SLUTT)    Alt+W → WORD (ORD)      Alt+PageDown → ROLLUP
 *   Alt+Bksp → CANCEL       Alt+K → COPY (KOPI)
 *   Alt+M → MODE            Alt+V → MOVE (FLYTT)
 *   Alt+F → FIND (SEARCH)   Alt+J → JUST
 *   Alt+X → GUILLEMETS      Alt+I → INSERT HERE
 */

import { TDV2200KeyRegistry } from './TDV2200KeyRegistry';

/**
 * Map a DOM KeyboardEvent key string + Alt modifier to a TDV grid position.
 * Returns the grid position string, or null if no mapping exists.
 */
export function mapAltKeyToGrid(key: string, shift: boolean = false): string | null {
  // Convert key to VK code for lookup
  const vkCode = altKeyToVK(key);
  if (vkCode === 0) return null;

  if (shift) {
    return TDV2200KeyRegistry.getDefaultAltShiftTarget(vkCode);
  }
  return TDV2200KeyRegistry.getDefaultAltTarget(vkCode);
}

/**
 * Map a DOM KeyboardEvent key string + Alt modifier to a TDV escape sequence.
 * Returns the escape sequence string, or null if no mapping exists.
 */
export function mapAltKeyToSequence(key: string, shift: boolean = false): string | null {
  const grid = mapAltKeyToGrid(key, shift);
  if (grid === null) return null;
  return TDV2200KeyRegistry.getSequence(grid, true, false, shift, false);
}

/** Convert a DOM KeyboardEvent.key to a VK code for Alt mapping lookup */
function altKeyToVK(key: string): number {
  // Single letter keys
  if (key.length === 1) {
    const upper = key.toUpperCase();
    const code = upper.charCodeAt(0);
    if (code >= 0x41 && code <= 0x5A) return code; // A-Z → 65-90
    if (code >= 0x30 && code <= 0x39) return code; // 0-9 → 48-57
  }

  // Special keys
  switch (key) {
    case 'Backspace': return 8;
    case 'Delete': return 46;
    case 'PageUp': return 33;
    case 'PageDown': return 34;
    case 'F1': return 112;
    case 'F2': return 113;
    case 'F3': return 114;
    case 'F4': return 115;
    case 'F5': return 116;
    case 'F6': return 117;
    case 'F7': return 118;
    case 'F8': return 119;
    default: return 0;
  }
}
