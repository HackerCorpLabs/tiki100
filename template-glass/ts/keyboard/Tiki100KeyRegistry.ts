/**
 * TIKI-100 keyboard registry.
 * Replaces Tiki100KeyRegistry with TIKI-100 key definitions.
 * Uses the same grid positions (E-A rows) and same API so
 * VirtualKeyboard.ts works without changes.
 *
 * Key codes match TIKI-100_emul.h for Module._SendKey().
 */

/* Types defined locally to avoid importing Tiki100KeyRegistry (which has
 * side effects that register TDV keys and overwrite the Tiki layout). */

export const enum TikiKeyColor {
  White = 0,
  Orange = 1,
  Brown = 2,
}

export const enum TikiKeyFlags {
  None = 0,
  IsModifier = 1,
  IsToggle = 2,
  IsProgrammable = 4,
  AlwaysSameCode = 8,
  IsNumericPad = 16,
}

export interface TikiKeyDefinition {
  readonly id: string;
  readonly name: string;
  readonly color: TikiKeyColor;
  readonly flags: TikiKeyFlags;
  readonly virtualKeyCode: number;
  readonly extNormal: string | null;
  readonly extShift: string | null;
  readonly extCtrl: string | null;
  readonly simpleAscii: string | null;
  readonly numPadFunc: string | null;
  readonly isProgrammable: boolean;
  readonly alwaysSameCode: boolean;
  readonly isNumericPad: boolean;
}

export interface TikiKeyLabel {
  readonly primary: string | null;
  readonly shifted: string | null;
  readonly alternative: string | null;
}

export type LanguageCode = 'no' | 'en';

const _keys = new Map<string, TikiKeyDefinition>();
const _labels = new Map<string, TikiKeyLabel>();
const _vkToGrid = new Map<number, string>();
const _nameToGrid = new Map<string, string>();

function mkKey(
  id: string, name: string, color: TikiKeyColor, flags: TikiKeyFlags, vk: number,
): TikiKeyDefinition {
  return {
    id, name, color, flags, virtualKeyCode: vk,
    extNormal: null, extShift: null, extCtrl: null,
    simpleAscii: null, numPadFunc: null,
    isProgrammable: false,
    alwaysSameCode: !!(flags & TikiKeyFlags.AlwaysSameCode),
    isNumericPad: !!(flags & TikiKeyFlags.IsNumericPad),
  };
}

function reg(id: string, name: string, color: TikiKeyColor, flags: TikiKeyFlags, vk: number): void {
  _keys.set(id, mkKey(id, name, color, flags, vk));
  _nameToGrid.set(name.toLowerCase(), id);
  if (vk > 0 && !_vkToGrid.has(vk)) _vkToGrid.set(vk, id);
}

function lbl(id: string, primary: string | null, shifted: string | null): void {
  _labels.set(id + '_no', { primary, shifted, alternative: null });
  _labels.set(id + '_en', { primary, shifted, alternative: null });
}

// =====================================================
// E-row (top - number row)
// =====================================================
reg('E0',  'GRAFIKK', TikiKeyColor.Orange, TikiKeyFlags.None, 0x84);
reg('E1',  '1',       TikiKeyColor.White,  TikiKeyFlags.None, 0x31);
reg('E2',  '2',       TikiKeyColor.White,  TikiKeyFlags.None, 0x32);
reg('E3',  '3',       TikiKeyColor.White,  TikiKeyFlags.None, 0x33);
reg('E4',  '4',       TikiKeyColor.White,  TikiKeyFlags.None, 0x34);
reg('E5',  '5',       TikiKeyColor.White,  TikiKeyFlags.None, 0x35);
reg('E6',  '6',       TikiKeyColor.White,  TikiKeyFlags.None, 0x36);
reg('E7',  '7',       TikiKeyColor.White,  TikiKeyFlags.None, 0x37);
reg('E8',  '8',       TikiKeyColor.White,  TikiKeyFlags.None, 0x38);
reg('E9',  '9',       TikiKeyColor.White,  TikiKeyFlags.None, 0x39);
reg('E10', '0',       TikiKeyColor.White,  TikiKeyFlags.None, 0x30);
reg('E11', 'PLUS',    TikiKeyColor.White,  TikiKeyFlags.None, 0x2B);
reg('E12', 'AT',      TikiKeyColor.White,  TikiKeyFlags.None, 0x40);
reg('E13', 'UTVID',   TikiKeyColor.Orange, TikiKeyFlags.None, 0x05);
reg('E14', 'SLETT',   TikiKeyColor.Orange, TikiKeyFlags.None, 0x7F);

// E-row nav area: F1-F3
reg('E47', 'F1', TikiKeyColor.White, TikiKeyFlags.None, 0x01);
reg('E48', 'F2', TikiKeyColor.White, TikiKeyFlags.None, 0x02);
reg('E49', 'F3', TikiKeyColor.White, TikiKeyFlags.None, 0x06);

// E-row numpad operators: * - / %
reg('E51', 'KPMULT',    TikiKeyColor.White, TikiKeyFlags.IsNumericPad, 0xAA);
reg('E52', 'KPMINUS2',  TikiKeyColor.White, TikiKeyFlags.IsNumericPad, 0xAD);
reg('E53', 'KPDIV',     TikiKeyColor.White, TikiKeyFlags.IsNumericPad, 0xAF);
reg('E54', 'KPPERCENT', TikiKeyColor.White, TikiKeyFlags.IsNumericPad, 0xA5);

// =====================================================
// D-row (QWERTY)
// =====================================================
reg('D99', 'BRYT',  TikiKeyColor.Orange, TikiKeyFlags.None, 0x03);
reg('D0',  'CTRL',  TikiKeyColor.White,  TikiKeyFlags.IsModifier, 0x81);
reg('D1',  'Q',     TikiKeyColor.White,  TikiKeyFlags.None, 0x71);
reg('D2',  'W',     TikiKeyColor.White,  TikiKeyFlags.None, 0x77);
reg('D3',  'E',     TikiKeyColor.White,  TikiKeyFlags.None, 0x65);
reg('D4',  'R',     TikiKeyColor.White,  TikiKeyFlags.None, 0x72);
reg('D5',  'T',     TikiKeyColor.White,  TikiKeyFlags.None, 0x74);
reg('D6',  'Y',     TikiKeyColor.White,  TikiKeyFlags.None, 0x79);
reg('D7',  'U',     TikiKeyColor.White,  TikiKeyFlags.None, 0x75);
reg('D8',  'I',     TikiKeyColor.White,  TikiKeyFlags.None, 0x69);
reg('D9',  'O',     TikiKeyColor.White,  TikiKeyFlags.None, 0x6F);
reg('D10', 'P',     TikiKeyColor.White,  TikiKeyFlags.None, 0x70);
reg('D11', 'AA',    TikiKeyColor.White,  TikiKeyFlags.None, 0xE5);  // Aa
reg('D12', 'CARET', TikiKeyColor.White,  TikiKeyFlags.None, 0x5E);  // ^
reg('D13', 'HJELP', TikiKeyColor.Orange, TikiKeyFlags.None, 0x0A);

// D-row nav area: F4-F6
reg('D47', 'F4', TikiKeyColor.White, TikiKeyFlags.None, 0x07);
reg('D48', 'F5', TikiKeyColor.White, TikiKeyFlags.None, 0x0E);
reg('D49', 'F6', TikiKeyColor.White, TikiKeyFlags.None, 0x0F);

// D-row numpad: 7 8 9 +
reg('D51', 'KP7',     TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB7);
reg('D52', 'KP8',     TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB8);
reg('D53', 'KP9',     TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB9);
reg('D54', 'KPPLUS',  TikiKeyColor.White, TikiKeyFlags.IsNumericPad, 0xAB);

// =====================================================
// C-row (ASDF)
// =====================================================
reg('C99', 'ANGRE',  TikiKeyColor.Orange, TikiKeyFlags.None, 0x1A);
reg('C0',  'LOCK',   TikiKeyColor.White,  TikiKeyFlags.IsToggle, 0x83);
reg('C1',  'A',      TikiKeyColor.White,  TikiKeyFlags.None, 0x61);
reg('C2',  'S',      TikiKeyColor.White,  TikiKeyFlags.None, 0x73);
reg('C3',  'D',      TikiKeyColor.White,  TikiKeyFlags.None, 0x64);
reg('C4',  'F',      TikiKeyColor.White,  TikiKeyFlags.None, 0x66);
reg('C5',  'G',      TikiKeyColor.White,  TikiKeyFlags.None, 0x67);
reg('C6',  'H',      TikiKeyColor.White,  TikiKeyFlags.None, 0x68);
reg('C7',  'J',      TikiKeyColor.White,  TikiKeyFlags.None, 0x6A);
reg('C8',  'K',      TikiKeyColor.White,  TikiKeyFlags.None, 0x6B);
reg('C9',  'L',      TikiKeyColor.White,  TikiKeyFlags.None, 0x6C);
reg('C10', 'OE',     TikiKeyColor.White,  TikiKeyFlags.None, 0xF8);  // Oe
reg('C11', 'AE',     TikiKeyColor.White,  TikiKeyFlags.None, 0xE6);  // Ae
reg('C12', 'QUOTE',  TikiKeyColor.White,  TikiKeyFlags.None, 0x27);  // '
reg('C13', 'RETURN', TikiKeyColor.Orange, TikiKeyFlags.AlwaysSameCode, 0x0D);

// C-row nav: PgUp, Up, PgDn (red/orange)
reg('C47', 'PGUP', TikiKeyColor.Brown, TikiKeyFlags.None, 0x17);
reg('C48', 'UP',   TikiKeyColor.Brown, TikiKeyFlags.AlwaysSameCode, 0x0B);
reg('C49', 'PGDN', TikiKeyColor.Brown, TikiKeyFlags.None, 0x1F);

// C-row numpad: 4 5 6 =
reg('C51', 'KP4',    TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB4);
reg('C52', 'KP5',    TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB5);
reg('C53', 'KP6',    TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB6);
reg('C54', 'KPEQU',  TikiKeyColor.White, TikiKeyFlags.IsNumericPad, 0xBD);

// =====================================================
// B-row (ZXCV + SHIFT)
// =====================================================
reg('B99', 'LSHIFT', TikiKeyColor.White, TikiKeyFlags.IsModifier, 0x82);
reg('B0',  'LTGT',   TikiKeyColor.White, TikiKeyFlags.None, 0x3C);  // <
reg('B1',  'Z',      TikiKeyColor.White, TikiKeyFlags.None, 0x7A);
reg('B2',  'X',      TikiKeyColor.White, TikiKeyFlags.None, 0x78);
reg('B3',  'C',      TikiKeyColor.White, TikiKeyFlags.None, 0x63);
reg('B4',  'V',      TikiKeyColor.White, TikiKeyFlags.None, 0x76);
reg('B5',  'B',      TikiKeyColor.White, TikiKeyFlags.None, 0x62);
reg('B6',  'N',      TikiKeyColor.White, TikiKeyFlags.None, 0x6E);
reg('B7',  'M',      TikiKeyColor.White, TikiKeyFlags.None, 0x6D);
reg('B8',  'COMMA',  TikiKeyColor.White, TikiKeyFlags.None, 0x2C);
reg('B9',  'PERIOD', TikiKeyColor.White, TikiKeyFlags.None, 0x2E);
reg('B10', 'MINUS',  TikiKeyColor.White, TikiKeyFlags.None, 0x2D);
reg('B11', 'RSHIFT', TikiKeyColor.White, TikiKeyFlags.IsModifier, 0x82);

// B-row nav: LEFT, HOME, RIGHT
reg('B47', 'LEFT',  TikiKeyColor.Brown, TikiKeyFlags.AlwaysSameCode, 0x08);
reg('B48', 'HOME',  TikiKeyColor.Brown, TikiKeyFlags.AlwaysSameCode, 0x09);
reg('B49', 'RIGHT', TikiKeyColor.Brown, TikiKeyFlags.AlwaysSameCode, 0x0C);

// B-row numpad: 1 2 3 ENTER(tall)
reg('B51', 'KP1',      TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB1);
reg('B52', 'KP2',      TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB2);
reg('B53', 'KP3',      TikiKeyColor.White,  TikiKeyFlags.IsNumericPad, 0xB3);
reg('B54', 'KPENTER',  TikiKeyColor.Orange, TikiKeyFlags.IsNumericPad, 0x8D);

// =====================================================
// A-row (bottom - space)
// =====================================================
reg('A5', 'SPACE', TikiKeyColor.White, TikiKeyFlags.None, 0x20);

// A-row nav: TABLEFT, DOWN, TABRIGHT
reg('A47', 'TABLEFT',  TikiKeyColor.Brown, TikiKeyFlags.None, 0x1D);
reg('A48', 'DOWN',     TikiKeyColor.Brown, TikiKeyFlags.AlwaysSameCode, 0x1C);
reg('A49', 'TABRIGHT', TikiKeyColor.Brown, TikiKeyFlags.None, 0x18);

// A-row numpad: 0(wide), .
reg('A51', 'KP0',   TikiKeyColor.White, TikiKeyFlags.IsNumericPad, 0xB0);
reg('A53', 'KPDOT', TikiKeyColor.White, TikiKeyFlags.IsNumericPad, 0xAE);

// =====================================================
// Labels (Norwegian)
// =====================================================
lbl('E0',  'GRAF\nIKK', null);
lbl('E1',  '1', '!');
lbl('E2',  '2', '"');
lbl('E3',  '3', '#');
lbl('E4',  '4', '$');
lbl('E5',  '5', '%');
lbl('E6',  '6', '&');
lbl('E7',  '7', '/');
lbl('E8',  '8', '(');
lbl('E9',  '9', ')');
lbl('E10', '0', '=');
lbl('E11', '+', '?');
lbl('E12', '@', '`');
lbl('E13', 'UTVID', null);
lbl('E14', 'SLETT', null);
lbl('E47', 'F1', null);
lbl('E48', 'F2', null);
lbl('E49', 'F3', null);
lbl('E51', '*', null);
lbl('E52', '-', null);
lbl('E53', '/', null);
lbl('E54', '%', null);

lbl('D99', 'BRYT', null);
lbl('D0',  'CTRL', null);
lbl('D1',  'Q', null); lbl('D2', 'W', null); lbl('D3', 'E', null);
lbl('D4',  'R', null); lbl('D5', 'T', null); lbl('D6', 'Y', null);
lbl('D7',  'U', null); lbl('D8', 'I', null); lbl('D9', 'O', null);
lbl('D10', 'P', null);
lbl('D11', '\u00c5', null);  // Aa
lbl('D12', '^', '~');
lbl('D13', 'HJELP', null);
lbl('D47', 'F4', null);
lbl('D48', 'F5', null);
lbl('D49', 'F6', null);
lbl('D51', '7', null);
lbl('D52', '8', null);
lbl('D53', '9', null);
lbl('D54', '+', null);

lbl('C99', 'ANGRE', null);
lbl('C0',  'LOCK', null);
lbl('C1',  'A', null); lbl('C2', 'S', null); lbl('C3', 'D', null);
lbl('C4',  'F', null); lbl('C5', 'G', null); lbl('C6', 'H', null);
lbl('C7',  'J', null); lbl('C8', 'K', null); lbl('C9', 'L', null);
lbl('C10', '\u00d8', null);  // Oe
lbl('C11', '\u00c6', null);  // Ae
lbl('C12', '\'', '*');
lbl('C13', null, null);  // RETURN - uses glyph
lbl('C47', '\u21d1', null);  // ⇑ PgUp
lbl('C48', null, null);     // UP arrow - uses glyph
lbl('C49', '\u21d3', null);  // ⇓ PgDn
lbl('C51', '4', null); lbl('C52', '5', null); lbl('C53', '6', null);
lbl('C54', '=', null);

lbl('B99', 'SHIFT', null);
lbl('B0',  '<', '>');
lbl('B1',  'Z', null); lbl('B2', 'X', null); lbl('B3', 'C', null);
lbl('B4',  'V', null); lbl('B5', 'B', null); lbl('B6', 'N', null);
lbl('B7',  'M', null);
lbl('B8',  ',', ';');
lbl('B9',  '.', ':');
lbl('B10', '-', '_');
lbl('B11', 'SHIFT', null);
lbl('B47', null, null);  // LEFT arrow - uses glyph
lbl('B48', 'HOME', null);
lbl('B49', null, null);  // RIGHT arrow - uses glyph
lbl('B51', '1', null); lbl('B52', '2', null); lbl('B53', '3', null);
lbl('B54', null, null);  // ENTER - uses glyph

lbl('A5',  '', null);  // SPACE - no label
lbl('A47', null, null);  // TABLEFT - uses glyph
lbl('A48', null, null);  // DOWN - uses glyph
lbl('A49', null, null);  // TABRIGHT - uses glyph
lbl('A51', '0', null);
lbl('A53', '.', null);

// Numpad row E right column
// (already registered above as E54)

// =====================================================
// Public API (same interface as Tiki100KeyRegistry)
// =====================================================
export class Tiki100KeyRegistry {
  static getKey(gridPos: string): TikiKeyDefinition | undefined {
    return _keys.get(gridPos);
  }
  static getLabel(gridPos: string, lang: LanguageCode = 'no'): TikiKeyLabel | undefined {
    return _labels.get(gridPos + '_' + lang) || _labels.get(gridPos + '_no');
  }
  static getGridByVK(vk: number): string | undefined {
    return _vkToGrid.get(vk);
  }
  static getGridByName(name: string): string | undefined {
    return _nameToGrid.get(name.toLowerCase());
  }
  static getAllKeys(): Map<string, TikiKeyDefinition> {
    return _keys;
  }
  static getSequence(gridPos: string, _extMode: boolean, _numPadFunc: boolean, shift: boolean, ctrl: boolean): string | null {
    // TIKI-100 doesn't use escape sequences - keys send raw codes via Module._SendKey
    return null;
  }
  static getGridForVK(vk: number): string | undefined {
    return _vkToGrid.get(vk);
  }
}
