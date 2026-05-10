/**
 * Single source of truth for all TDV2200 ND-246 keyboard data.
 * All key identity, escape sequences, colors, VK codes, labels, and Alt mappings
 * are defined here. Other classes delegate to this registry.
 *
 * Ported from C# TDV2200KeyRegistry.cs
 */

/** Key color on the physical ND-246 keyboard */
export const enum TDVKeyColor {
  White = 0,
  Orange = 1,
  Brown = 2,
}

/** Flags describing key behavior */
export const enum TDVKeyFlags {
  None = 0,
  IsModifier = 1,
  IsToggle = 2,
  IsProgrammable = 4,
  AlwaysSameCode = 8,
  IsNumericPad = 16,
}

/** Immutable definition of a single TDV2200 key */
export interface TDVKeyDefinition {
  readonly id: string;
  readonly name: string;
  readonly color: TDVKeyColor;
  readonly flags: TDVKeyFlags;
  readonly virtualKeyCode: number;
  /** Extended Control Mode normal sequence */
  readonly extNormal: string | null;
  /** Extended Control Mode shifted sequence */
  readonly extShift: string | null;
  /** Extended Control Mode ctrl sequence */
  readonly extCtrl: string | null;
  /** Simple ASCII Mode sequence (C0 control code) */
  readonly simpleAscii: string | null;
  /** Numeric pad function mode sequence */
  readonly numPadFunc: string | null;
  /** Convenience: is this a programmable key? */
  readonly isProgrammable: boolean;
  /** Convenience: always same code in both modes? */
  readonly alwaysSameCode: boolean;
  /** Convenience: is numeric pad key? */
  readonly isNumericPad: boolean;
}

/** Label text for a key in a specific language */
export interface TDVKeyLabel {
  readonly primary: string | null;
  readonly shifted: string | null;
  readonly alternative: string | null;
}

function mkKey(
  id: string, name: string, color: TDVKeyColor, flags: TDVKeyFlags, vk: number,
  extNormal: string | null, extShift: string | null, extCtrl: string | null,
  simpleAscii: string | null, numPadFunc: string | null,
): TDVKeyDefinition {
  return {
    id, name, color, flags, virtualKeyCode: vk,
    extNormal, extShift, extCtrl, simpleAscii, numPadFunc,
    isProgrammable: !!(flags & TDVKeyFlags.IsProgrammable),
    alwaysSameCode: !!(flags & TDVKeyFlags.AlwaysSameCode),
    isNumericPad: !!(flags & TDVKeyFlags.IsNumericPad),
  };
}

// --- Storage ---
const _keys = new Map<string, TDVKeyDefinition>();
const _labels = new Map<string, TDVKeyLabel>();
const _vkToGrid = new Map<number, string>();
const _nameToGrid = new Map<string, string>();
const _defaultAltMap = new Map<number, string>();
const _defaultAltShiftMap = new Map<number, string>();

export const LANGUAGE_CODES = ['no', 'dk', 'sv', 'de', 'us', 'fr', 'sds', 'fao', 'en', 'ch', 'fi', 'is'] as const;
export type LanguageCode = typeof LANGUAGE_CODES[number];

// --- Registration helpers ---
function reg(
  id: string, name: string, color: TDVKeyColor, flags: TDVKeyFlags, vk: number,
  extNormal: string | null, extShift: string | null, extCtrl: string | null,
  simpleAscii: string | null, numPadFunc: string | null,
): void {
  const def = mkKey(id, name, color, flags, vk, extNormal, extShift, extCtrl, simpleAscii, numPadFunc);
  _keys.set(id, def);
  _nameToGrid.set(name.toLowerCase(), id);
  if (vk > 0 && !_vkToGrid.has(vk)) {
    _vkToGrid.set(vk, id);
  }
}

function alias(name: string, grid: string): void {
  _nameToGrid.set(name.toLowerCase(), grid);
}

function regLabel(gridPos: string, langCode: string, primary: string | null, shifted: string | null, alternative: string | null): void {
  _labels.set(gridPos + '_' + langCode, { primary, shifted, alternative });
}

function regLabelAll(gridPos: string, primary: string | null, shifted: string | null, alternative: string | null): void {
  for (let i = 0; i < LANGUAGE_CODES.length; i++) {
    _labels.set(gridPos + '_' + LANGUAGE_CODES[i], { primary, shifted, alternative });
  }
}

// --- Initialize keys ---
function initializeKeys(): void {
  // G-row (top row)
  reg('G0', 'ESC', TDVKeyColor.Orange, TDVKeyFlags.AlwaysSameCode, 27, '\x1B', null, null, null, null);

  // PUSH keys G1-G8 (programmable, no fixed sequence)
  for (let i = 1; i <= 8; i++) {
    reg(`G${i}`, `P${i}`, TDVKeyColor.Brown, TDVKeyFlags.IsProgrammable, 0, null, null, null, null, null);
  }

  reg('G9', 'MERK', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[00_', '\x1B[01_', null, null, null);
  reg('G10', 'FELT', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[02_', '\x1B[03_', null, '\x02', null);
  reg('G11', 'AVSH', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[04_', '\x1B[05_', null, '\x01', null);
  reg('G12', 'SETN', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[06_', '\x1B[07_', null, '\x03', null);
  reg('G13', 'ORD', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[08_', '\x1B[09_', null, null, null);
  reg('G14', 'LOKAL', TDVKeyColor.Brown, TDVKeyFlags.None, 0, null, null, null, null, null);

  // Navigation area
  reg('G47', 'STRYK', TDVKeyColor.Orange, TDVKeyFlags.None, 46, '\x1B[10_', '\x1B[11_', null, null, null);
  reg('G48', 'KOPI', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[12_', '\x1B[13_', null, null, null);
  reg('G49', 'FLYTT', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[14_', '\x1B[15_', null, null, null);

  // Function area
  reg('G51', 'FUNK', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[42_', '\x1B[43_', null, null, null);
  reg('G52', 'SKRIV', TDVKeyColor.Orange, TDVKeyFlags.None, 44, '\x1B[44_', '\x1B[45_', null, null, null);
  reg('G53', 'HJELP', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[46_', '\x1B[47_', null, null, null);
  reg('G54', 'SLUTT', TDVKeyColor.Orange, TDVKeyFlags.None, 35, '\x1B[48_', '\x1B[49_', null, null, null);

  // F-row
  reg('F47', 'TAB', TDVKeyColor.Orange, TDVKeyFlags.None, 9, '\x1B[16_', '\x1B[17_', null, '\x09', null);
  reg('F48', 'SEARCH', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[18_', '\x1B[19_', null, '\x11', null);
  reg('F49', 'REPLACE', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[20_', '\x1B[21_', null, '\x14', null);
  reg('F51', 'F1', TDVKeyColor.Orange, TDVKeyFlags.None, 112, '\x1B[50_', '\x1B[51_', null, '\x1E', null);
  reg('F52', 'F2', TDVKeyColor.Orange, TDVKeyFlags.None, 113, '\x1B[52_', '\x1B[53_', '\x1B[54_', '\x1F', null);
  reg('F53', 'F3', TDVKeyColor.Orange, TDVKeyFlags.None, 114, '\x1B[55_', '\x1B[56_', '\x1B[57_', '\x18', null);
  reg('F54', 'F4', TDVKeyColor.Orange, TDVKeyFlags.None, 115, '\x1B[58_', '\x1B[59_', null, null, null);

  // E-row (number row)
  reg('E0', 'CAPS', TDVKeyColor.White, TDVKeyFlags.IsToggle, 20, null, null, null, null, null);
  reg('E1', '1', TDVKeyColor.White, TDVKeyFlags.None, 49, null, null, null, null, null);
  reg('E2', '2', TDVKeyColor.White, TDVKeyFlags.None, 50, null, null, null, null, null);
  reg('E3', '3', TDVKeyColor.White, TDVKeyFlags.None, 51, null, null, null, null, null);
  reg('E4', '4', TDVKeyColor.White, TDVKeyFlags.None, 52, null, null, null, null, null);
  reg('E5', '5', TDVKeyColor.White, TDVKeyFlags.None, 53, null, null, null, null, null);
  reg('E6', '6', TDVKeyColor.White, TDVKeyFlags.None, 54, null, null, null, null, null);
  reg('E7', '7', TDVKeyColor.White, TDVKeyFlags.None, 55, null, null, null, null, null);
  reg('E8', '8', TDVKeyColor.White, TDVKeyFlags.None, 56, null, null, null, null, null);
  reg('E9', '9', TDVKeyColor.White, TDVKeyFlags.None, 57, null, null, null, null, null);
  reg('E10', '0', TDVKeyColor.White, TDVKeyFlags.None, 48, null, null, null, null, null);
  reg('E11', 'PLUS', TDVKeyColor.White, TDVKeyFlags.None, 189, null, null, null, null, null);
  reg('E12', 'PIPE', TDVKeyColor.White, TDVKeyFlags.None, 187, null, null, null, null, null);
  reg('E13', 'NEWPARA', TDVKeyColor.Orange, TDVKeyFlags.None, 192, '\x1B[86_', '\x1B[87_', null, '\x08', null);
  reg('E14', 'DEL', TDVKeyColor.Orange, TDVKeyFlags.AlwaysSameCode, 0, '\x7F', null, null, '\x7F', null);

  // Navigation area
  reg('E47', 'GUILLEMETS', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[22_', '\x1B[23_', null, null, null);
  reg('E48', 'JUST', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[24_', '\x1B[25_', null, null, null);
  reg('E49', 'SINGLEGUILLEMETS', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[26_', '\x1B[27_', null, null, null);

  // Function area
  reg('E51', 'F5', TDVKeyColor.Orange, TDVKeyFlags.None, 116, '\x1B[60_', '\x1B[61_', null, '000', null);
  reg('E52', 'F6', TDVKeyColor.Orange, TDVKeyFlags.None, 117, '\x1B[62_', '\x1B[63_', null, '00', null);
  reg('E53', 'F7', TDVKeyColor.Orange, TDVKeyFlags.None, 118, '\x1B[64_', '\x1B[65_', null, '0', null);
  reg('E54', 'F8', TDVKeyColor.Orange, TDVKeyFlags.None, 119, '\x1B[66_', '\x1B[67_', null, '+', null);

  // D-row (QWERTY)
  reg('D99', 'INNS', TDVKeyColor.Orange, TDVKeyFlags.None, 45, '\x1B[82_', '\x1B[83_', null, '\x07', null);
  reg('D0', 'CTRL', TDVKeyColor.White, TDVKeyFlags.IsModifier, 162, null, null, null, null, null);
  reg('D1', 'Q', TDVKeyColor.White, TDVKeyFlags.None, 81, null, null, null, null, null);
  reg('D2', 'W', TDVKeyColor.White, TDVKeyFlags.None, 87, null, null, null, null, null);
  reg('D3', 'E', TDVKeyColor.White, TDVKeyFlags.None, 69, null, null, null, null, null);
  reg('D4', 'R', TDVKeyColor.White, TDVKeyFlags.None, 82, null, null, null, null, null);
  reg('D5', 'T', TDVKeyColor.White, TDVKeyFlags.None, 84, null, null, null, null, null);
  reg('D6', 'Y', TDVKeyColor.White, TDVKeyFlags.None, 89, null, null, null, null, null);
  reg('D7', 'U', TDVKeyColor.White, TDVKeyFlags.None, 85, null, null, null, null, null);
  reg('D8', 'I', TDVKeyColor.White, TDVKeyFlags.None, 73, null, null, null, null, null);
  reg('D9', 'O', TDVKeyColor.White, TDVKeyFlags.None, 79, null, null, null, null, null);
  reg('D10', 'P', TDVKeyColor.White, TDVKeyFlags.None, 80, null, null, null, null, null);
  reg('D11', 'LBRACKET', TDVKeyColor.White, TDVKeyFlags.None, 219, null, null, null, null, null);
  reg('D12', 'RBRACKET', TDVKeyColor.White, TDVKeyFlags.None, 221, null, null, null, null, null);
  reg('D13', 'LF', TDVKeyColor.Orange, TDVKeyFlags.AlwaysSameCode, 10, '\x0A', null, null, '\x0A', null);

  // Navigation area
  reg('D47', 'ROLLUP', TDVKeyColor.Brown, TDVKeyFlags.None, 34, '\x1B[28_', '\x1B[29_', null, '\x06', null);
  reg('D48', 'ANGRE', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[30_', '\x1B[31_', null, '\x15', null);
  reg('D49', 'ROLLDN', TDVKeyColor.Brown, TDVKeyFlags.None, 33, '\x1B[32_', '\x1B[33_', null, '\x05', null);

  // Numeric pad
  reg('D51', 'KP7', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 103, null, null, null, null, '\x1B[75_');
  reg('D52', 'KP8', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 104, null, null, null, null, '\x1B[76_');
  reg('D53', 'KP9', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 105, null, null, null, null, '\x1B[77_');
  reg('D54', 'KPSPACE', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 32, null, null, null, null, '\x1B[80_');

  // C-row (ASDF)
  reg('C99', 'MODE', TDVKeyColor.Orange, TDVKeyFlags.None, 0, '\x1B[84_', '\x1B[85_', null, '\x05', null);
  reg('C0', 'LOCK', TDVKeyColor.White, TDVKeyFlags.IsToggle, 20, null, null, null, null, null);
  reg('C1', 'A', TDVKeyColor.White, TDVKeyFlags.None, 65, null, null, null, null, null);
  reg('C2', 'S', TDVKeyColor.White, TDVKeyFlags.None, 83, null, null, null, null, null);
  reg('C3', 'D', TDVKeyColor.White, TDVKeyFlags.None, 68, null, null, null, null, null);
  reg('C4', 'F', TDVKeyColor.White, TDVKeyFlags.None, 70, null, null, null, null, null);
  reg('C5', 'G', TDVKeyColor.White, TDVKeyFlags.None, 71, null, null, null, null, null);
  reg('C6', 'H', TDVKeyColor.White, TDVKeyFlags.None, 72, null, null, null, null, null);
  reg('C7', 'J', TDVKeyColor.White, TDVKeyFlags.None, 74, null, null, null, null, null);
  reg('C8', 'K', TDVKeyColor.White, TDVKeyFlags.None, 75, null, null, null, null, null);
  reg('C9', 'L', TDVKeyColor.White, TDVKeyFlags.None, 76, null, null, null, null, null);
  reg('C10', 'SEMICOLON', TDVKeyColor.White, TDVKeyFlags.None, 186, null, null, null, null, null);
  reg('C11', 'QUOTE', TDVKeyColor.White, TDVKeyFlags.None, 222, null, null, null, null, null);
  reg('C12', 'BACKSLASH', TDVKeyColor.White, TDVKeyFlags.None, 220, null, null, null, null, null);
  reg('C13', 'RETURN', TDVKeyColor.Orange, TDVKeyFlags.AlwaysSameCode, 13, '\x0D', null, null, '\x0D', null);

  // Navigation area
  reg('C47', 'FIELDLEFT', TDVKeyColor.Brown, TDVKeyFlags.None, 0, '\x1B[34_', '\x1B[35_', null, '\x0C', null);
  reg('C48', 'UP', TDVKeyColor.Brown, TDVKeyFlags.AlwaysSameCode, 38, '\x1C', '\x1C', null, '\x1C', null);
  reg('C49', 'FIELDRIGHT', TDVKeyColor.Brown, TDVKeyFlags.None, 0, '\x1B[36_', '\x1B[37_', null, '\x17', null);

  // Numeric pad
  reg('C51', 'KP4', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 100, null, null, null, null, '\x1B[72_');
  reg('C52', 'KP5', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 101, null, null, null, null, '\x1B[73_');
  reg('C53', 'KP6', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 102, null, null, null, null, '\x1B[74_');
  reg('C54', 'KPMINUS', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 109, null, null, null, null, '\x1B[79_');

  // B-row (ZXCV)
  reg('B99', 'LSHIFT', TDVKeyColor.White, TDVKeyFlags.IsModifier, 160, null, null, null, null, null);
  reg('B0', 'LTGT', TDVKeyColor.White, TDVKeyFlags.None, 90, null, null, null, null, null);
  reg('B1', 'Z', TDVKeyColor.White, TDVKeyFlags.None, 88, null, null, null, null, null);
  reg('B2', 'X', TDVKeyColor.White, TDVKeyFlags.None, 67, null, null, null, null, null);
  reg('B3', 'C', TDVKeyColor.White, TDVKeyFlags.None, 86, null, null, null, null, null);
  reg('B4', 'V', TDVKeyColor.White, TDVKeyFlags.None, 66, null, null, null, null, null);
  reg('B5', 'B', TDVKeyColor.White, TDVKeyFlags.None, 78, null, null, null, null, null);
  reg('B6', 'N', TDVKeyColor.White, TDVKeyFlags.None, 77, null, null, null, null, null);
  reg('B7', 'M', TDVKeyColor.White, TDVKeyFlags.None, 188, null, null, null, null, null);
  reg('B8', 'COMMA', TDVKeyColor.White, TDVKeyFlags.None, 190, null, null, null, null, null);
  reg('B9', 'PERIOD', TDVKeyColor.White, TDVKeyFlags.None, 191, null, null, null, null, null);
  reg('B10', 'MINUS', TDVKeyColor.White, TDVKeyFlags.None, 189, null, null, null, null, null);
  reg('B11', 'RSHIFT', TDVKeyColor.White, TDVKeyFlags.IsModifier, 161, null, null, null, null, null);

  // Navigation area
  reg('B47', 'LEFT', TDVKeyColor.Brown, TDVKeyFlags.AlwaysSameCode, 37, '\x08', '\x08', null, '\x08', null);
  reg('B48', 'HOME', TDVKeyColor.Brown, TDVKeyFlags.AlwaysSameCode, 36, '\x1D', '\x1D', null, '\x10', null);
  reg('B49', 'RIGHT', TDVKeyColor.Brown, TDVKeyFlags.AlwaysSameCode, 39, '\x18', '\x18', null, '\x18', null);

  // Numeric pad
  reg('B51', 'KP1', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 97, null, null, null, null, '\x1B[69_');
  reg('B52', 'KP2', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 98, null, null, null, null, '\x1B[70_');
  reg('B53', 'KP3', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 99, null, null, null, null, '\x1B[71_');
  reg('B54', 'KPENTER', TDVKeyColor.White, TDVKeyFlags.AlwaysSameCode, 13, '\x0D', null, null, '\x0D', null);

  // A-row (bottom)
  reg('A5', 'SPACE', TDVKeyColor.White, TDVKeyFlags.None, 32, null, null, null, null, null);

  // Navigation area
  reg('A47', 'TABLEFT', TDVKeyColor.Brown, TDVKeyFlags.None, 0, '\x1B[38_', '\x1B[39_', null, '\x15', null);
  reg('A48', 'DOWN', TDVKeyColor.Brown, TDVKeyFlags.AlwaysSameCode, 40, '\x0B', '\x0B', null, '\x0B', null);
  reg('A49', 'TABRIGHT', TDVKeyColor.Brown, TDVKeyFlags.None, 0, '\x1B[40_', '\x1B[41_', null, '\x09', null);

  // Numeric pad
  reg('A51', 'KP0', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 96, null, null, null, null, '\x1B[68_');
  reg('A53', 'KPDOT', TDVKeyColor.White, TDVKeyFlags.IsNumericPad, 110, null, null, null, null, '\x1B[78_');

  // Name aliases (Norwegian → English and common names)
  alias('escape', 'G0');
  alias('mark', 'G9');
  alias('field', 'G10');
  alias('para', 'G11');
  alias('sent', 'G12');
  alias('word', 'G13');
  alias('local', 'G14');
  alias('delete_key', 'G47');
  alias('copy', 'G48');
  alias('move', 'G49');
  alias('func', 'G51');
  alias('print', 'G52');
  alias('help', 'G53');
  alias('exit', 'G54');
  alias('tab_func', 'F47');
  alias('backspace', 'E13');
  alias('delete', 'E14');
  alias('del', 'E14');
  alias('insert_mode', 'D99');
  alias('inns', 'D99');
  alias('linefeed', 'D13');
  alias('pagedown', 'D47');
  alias('pgdn', 'D47');
  alias('cancel', 'D48');
  alias('pageup', 'D49');
  alias('pgup', 'D49');
  alias('mode', 'C99');
  alias('enter', 'C13');
  alias('erase_page', 'C47');
  alias('arrowup', 'C48');
  alias('insert', 'C49');
  alias('ins', 'C49');
  alias('arrowleft', 'B47');
  alias('arrowright', 'B49');
  alias('arrowdown', 'A48');
  alias('tab_right', 'A49');
  alias('tab', 'A49');

  // Numpad aliases
  for (const [a, g] of [
    ['kp_7', 'D51'], ['numpad7', 'D51'], ['kp_8', 'D52'], ['numpad8', 'D52'],
    ['kp_9', 'D53'], ['numpad9', 'D53'], ['kp_minus', 'D54'], ['numpadminus', 'D54'],
    ['kp_4', 'C51'], ['numpad4', 'C51'], ['kp_5', 'C52'], ['numpad5', 'C52'],
    ['kp_6', 'C53'], ['numpad6', 'C53'], ['kp_plus', 'C54'], ['numpadplus', 'C54'],
    ['kp_1', 'B51'], ['numpad1', 'B51'], ['kp_2', 'B52'], ['numpad2', 'B52'],
    ['kp_3', 'B53'], ['numpad3', 'B53'], ['kp_enter', 'B54'], ['numpadenter', 'B54'],
    ['kp_0', 'A51'], ['numpad0', 'A51'], ['kp_period', 'A53'], ['numpaddecimal', 'A53'],
  ] as const) {
    alias(a, g);
  }

  // PUSH key aliases
  for (let i = 1; i <= 8; i++) {
    alias(`push${i}`, `G${i}`);
  }
}

// --- Initialize labels ---
function initializeLabels(): void {
  // G-row labels
  regLabelAll('G0', 'ESC', null, null);
  for (let i = 1; i <= 8; i++) regLabelAll(`G${i}`, `P${i}`, null, null);

  // G9 - MERK/MARK
  const g9: [string, string][] = [['no','MERK'],['dk','MRK'],['sv','MERK'],['de','MERK'],['us','MARK'],['fr','MARQ'],['sds','MERK'],['fao','MERK'],['en','MARK'],['ch','MARK'],['fi','MERK'],['is','MERK']];
  for (const [l,p] of g9) regLabel('G9', l, p, null, null);

  // G10 - FELT/FIELD
  const g10: [string, string][] = [['no','FELT'],['dk','FELT'],['sv','F\u00C4LT'],['de','FELT'],['us','FIELD'],['fr','CHAMP'],['sds','FELT'],['fao','FELT'],['en','FIELD'],['ch','FIELD'],['fi','KENTT\u00C4'],['is','FELT']];
  for (const [l,p] of g10) regLabel('G10', l, p, null, null);

  // G11 - AVSH/PARA
  const g11: [string, string][] = [['no','AVSH'],['dk','AVSH'],['sv','AVSH'],['de','AVSH'],['us','PARA'],['fr','PARA'],['sds','AVSH'],['fao','AVSH'],['en','PARA'],['ch','PARA'],['fi','KAPPALE'],['is','AVSH']];
  for (const [l,p] of g11) regLabel('G11', l, p, null, null);

  // G12 - SETN/SENT
  const g12: [string, string][] = [['no','SETN'],['dk','SETN'],['sv','SETN'],['de','SETN'],['us','SENT'],['fr','SENT'],['sds','SETN'],['fao','SETN'],['en','SENT'],['ch','SENT'],['fi','LAUSE'],['is','SETN']];
  for (const [l,p] of g12) regLabel('G12', l, p, null, null);

  // G13 - ORD/WORD
  const g13: [string, string][] = [['no','ORD'],['dk','ORD'],['sv','ORD'],['de','ORD'],['us','WORD'],['fr','MOT'],['sds','ORD'],['fao','ORD'],['en','WORD'],['ch','WORD'],['fi','SANA'],['is','ORD']];
  for (const [l,p] of g13) regLabel('G13', l, p, null, null);

  // G14 - LOKAL/LOCAL
  const g14: [string, string][] = [['no','LOKAL'],['dk','LOKAL'],['sv','LOKAL'],['de','LOKAL'],['us','LOCAL'],['fr','LOCAL'],['sds','LOKAL'],['fao','LOKAL'],['en','LOCAL'],['ch','LOCAL'],['fi','LOKAL'],['is','LOKAL']];
  for (const [l,p] of g14) regLabel('G14', l, p, null, null);

  // G47 - STRYK/DELETE
  const g47: [string, string][] = [['no','STRYK'],['dk','STRYK'],['sv','STRYK'],['de','STRYK'],['us','DELETE'],['fr','SUPPR'],['sds','STRYK'],['fao','STRYK'],['en','DELETE'],['ch','DELETE'],['fi','POISTA'],['is','STRYK']];
  for (const [l,p] of g47) regLabel('G47', l, p, null, null);

  // G48 - KOPI/COPY
  const g48: [string, string][] = [['no','KOPI'],['dk','KOPI'],['sv','KOPI'],['de','KOPI'],['us','COPY'],['fr','COPIE'],['sds','KOPI'],['fao','KOPI'],['en','COPY'],['ch','COPY'],['fi','KOPIOI'],['is','KOPI']];
  for (const [l,p] of g48) regLabel('G48', l, p, null, null);

  // G49 - FLYTT/MOVE
  const g49: [string, string][] = [['no','FLYTT'],['dk','FLYTT'],['sv','FLYTT'],['de','FLYTT'],['us','MOVE'],['fr','DEPL'],['sds','FLYTT'],['fao','FLYTT'],['en','MOVE'],['ch','MOVE'],['fi','SIIRR\u00C4'],['is','FLYTT']];
  for (const [l,p] of g49) regLabel('G49', l, p, null, null);

  // G51 - FUNK/FUNC
  const g51: [string, string][] = [['no','FUNK'],['dk','FUNK'],['sv','FUNK'],['de','FUNK'],['us','FUNC'],['fr','FONC'],['sds','FUNK'],['fao','FUNK'],['en','FUNC'],['ch','FUNC'],['fi','FUNK'],['is','FUNK']];
  for (const [l,p] of g51) regLabel('G51', l, p, null, null);

  // G52 - SKRIV/PRINT
  const g52: [string, string][] = [['no','SKRIV'],['dk','SKRIV'],['sv','SKRIV'],['de','SKRIV'],['us','PRINT'],['fr','IMPRI'],['sds','SKRIV'],['fao','SKRIV'],['en','PRINT'],['ch','PRINT'],['fi','KIRJ'],['is','SKRIV']];
  for (const [l,p] of g52) regLabel('G52', l, p, null, null);

  // G53 - HJELP/HELP
  const g53: [string, string][] = [['no','HJELP'],['dk','HJLP'],['sv','HJ\u00C4LP'],['de','HJELP'],['us','HELP'],['fr','AIDE'],['sds','HJELP'],['fao','HJELP'],['en','HELP'],['ch','HELP'],['fi','AUTA'],['is','HJ\u00C1LP']];
  for (const [l,p] of g53) regLabel('G53', l, p, null, null);

  // G54 - SLUTT/EXIT
  const g54: [string, string][] = [['no','SLUTT'],['dk','SLUT'],['sv','SLUTT'],['de','SLUTT'],['us','EXIT'],['fr','FIN'],['sds','SLUTT'],['fao','SLUTT'],['en','EXIT'],['ch','EXIT'],['fi','LOPPU'],['is','H\u00C6TTA']];
  for (const [l,p] of g54) regLabel('G54', l, p, null, null);

  // F-row labels
  regLabelAll('F47', 'TAB', '-', '+');
  regLabelAll('F48', '\u00B7\u00B7\u00B7', null, null);
  regLabelAll('F49', '/aaa', null, 'aaa');
  regLabelAll('F51', 'F1', null, null);
  regLabelAll('F52', 'F2', null, 'SI');
  regLabelAll('F53', 'F3', null, 'SO');
  regLabelAll('F54', 'F4', null, 'CLEAR');

  // E-row labels
  regLabelAll('E0', 'CAPS', null, null);
  regLabelAll('E1', '1', '!', null);

  // E2 - national variants for shifted char
  const e2: [string, string][] = [['no','"'],['dk','"'],['sv','"'],['de','"'],['us','@'],['fr','"'],['sds','"'],['fao','"'],['en','"'],['ch','"'],['fi','"'],['is','"']];
  for (const [l,s] of e2) regLabel('E2', l, '2', s, null);

  regLabelAll('E3', '3', '#', null);

  // E4 - national variants
  const e4: [string, string][] = [['no','$'],['dk','$'],['sv','\u00A4'],['de','$'],['us','$'],['fr','$'],['sds','$'],['fao','\u00A7'],['en','$'],['ch','$'],['fi','$'],['is','$']];
  for (const [l,s] of e4) regLabel('E4', l, '4', s, null);

  regLabelAll('E5', '5', '%', null);

  // E6 - national variants
  const e6: [string, string][] = [['no','&'],['dk','&'],['sv','&'],['de','&'],['us','^'],['fr','&'],['sds','&'],['fao','&'],['en','&'],['ch','&'],['fi','&'],['is','&']];
  for (const [l,s] of e6) regLabel('E6', l, '6', s, null);

  // E7 - national variants
  const e7: [string, string][] = [['no','/'],['dk','/'],['sv','/'],['de','/'],['us','&'],['fr','/'],['sds','/'],['fao','/'],['en','/'],['ch','/'],['fi','/'],['is','/']];
  for (const [l,s] of e7) regLabel('E7', l, '7', s, null);

  // E8 - national variants
  const e8: [string, string][] = [['no','('],['dk','('],['sv','('],['de','('],['us','*'],['fr','('],['sds','('],['fao','('],['en','('],['ch','('],['fi','('],['is','(']];
  for (const [l,s] of e8) regLabel('E8', l, '8', s, null);

  // E9 - national variants
  const e9: [string, string][] = [['no',')'],['dk',')'],['sv',')'],['de',')'],['us','('],['fr',')'],['sds',')'],['fao',')'],['en',')'],['ch',')'],['fi',')'],['is',')']];
  for (const [l,s] of e9) regLabel('E9', l, '9', s, null);

  // E10 - national variants
  const e10: [string, string][] = [['no','='],['dk','='],['sv','='],['de','='],['us',')'],['fr','='],['sds','='],['fao','='],['en','='],['ch','='],['fi','='],['is','=']];
  for (const [l,s] of e10) regLabel('E10', l, '0', s, null);

  // E11 - national variants
  const e11: [string, string][] = [['no','?'],['dk','?'],['sv','?'],['de','?'],['us','_'],['fr','?'],['sds','?'],['fao','?'],['en','?'],['ch','?'],['fi','?'],['is','?']];
  for (const [l,s] of e11) regLabel('E11', l, (l === 'us' ? '-' : '+'), s, null);

  // E12 - national variants
  const e12: [string, string][] = [['no','`'],['dk','`'],['sv','`'],['de','`'],['us','+'],['fr','`'],['sds','`'],['fao','`'],['en','`'],['ch','`'],['fi','`'],['is','`']];
  for (const [l,s] of e12) regLabel('E12', l, (l === 'us' ? '=' : '@'), s, null);

  // E13 - national variants
  const e13: [string, string][] = [['no','\\'],['dk','\\'],['sv','\\'],['de','\\'],['us','~'],['fr','\\'],['sds','\\'],['fao','\\'],['en','\\'],['ch','\\'],['fi','\\'],['is','\\']];
  for (const [l,s] of e13) regLabel('E13', l, (l === 'us' ? '`' : '\u00B4'), s, null);

  regLabelAll('E14', 'DEL', null, null);
  regLabelAll('E47', '\u00AB', '\u00BB', null);
  regLabelAll('E48', 'JUST', null, null);
  regLabelAll('E49', '\u2039\u203A', '\u203A\u2039', null);
  regLabelAll('E51', 'F5', null, '000');
  regLabelAll('E52', 'F6', null, '00');
  regLabelAll('E53', 'F7', null, '0');
  regLabelAll('E54', 'F8', null, '+');

  // D-row labels
  regLabelAll('D99', 'INNS', 'EXPS', null);
  regLabelAll('D0', 'CTRL', null, null);
  regLabelAll('D1', 'Q', 'q', null);
  regLabelAll('D2', 'W', 'w', null);
  regLabelAll('D3', 'E', 'e', null);
  regLabelAll('D4', 'R', 'r', null);
  regLabelAll('D5', 'T', 't', null);
  regLabelAll('D6', 'Y', 'y', null);
  regLabelAll('D7', 'U', 'u', null);
  regLabelAll('D8', 'I', 'i', null);
  regLabelAll('D9', 'O', 'o', null);
  regLabelAll('D10', 'P', 'p', null);

  // D11 - national variants
  const d11: [string, string, string][] = [['no','\u00C5','\u00E5'],['dk','\u00C5','\u00E5'],['sv','\u00C5','\u00E5'],['de','\u00DC','\u00FC'],['us','[','{'],['fr','^','\u00A8'],['sds','\u00C5','\u00E5'],['fao','[','{'],['en','[','{'],['ch','\u00DC','\u00FC'],['fi','\u00C5','\u00E5'],['is','\u00D0','\u00F0']];
  for (const [l,p,s] of d11) regLabel('D11', l, p, s, null);

  // D12 - national variants
  const d12: [string, string, string][] = [['no','^','~'],['dk','\u00A8','^'],['sv','\u00A8','^'],['de','+','*'],['us',']','}'],['fr','$','\u00A3'],['sds','\u00A8','^'],['fao',']','}'],['en',']','}'],['ch','+','*'],['fi','\u00A8','^'],['is','\u00DE','\u00FE']];
  for (const [l,p,s] of d12) regLabel('D12', l, p, s, null);

  regLabelAll('D13', 'LF', null, null);
  regLabelAll('D47', '\u21D1', '\u21D0', null);
  regLabelAll('D48', 'ANGRE', null, null);
  regLabelAll('D49', '\u21D3', '\u21D2', null);
  regLabelAll('D51', '7', null, null);
  regLabelAll('D52', '8', null, null);
  regLabelAll('D53', '9', null, null);
  regLabelAll('D54', '\u2334', null, null);

  // C-row labels
  regLabelAll('C99', 'MODE', null, null);
  regLabelAll('C0', 'LOCK', null, null);
  regLabelAll('C1', 'A', 'a', null);
  regLabelAll('C2', 'S', 's', null);
  regLabelAll('C3', 'D', 'd', null);
  regLabelAll('C4', 'F', 'f', null);
  regLabelAll('C5', 'G', 'g', null);
  regLabelAll('C6', 'H', 'h', null);
  regLabelAll('C7', 'J', 'j', null);
  regLabelAll('C8', 'K', 'k', null);
  regLabelAll('C9', 'L', 'l', null);

  // C10 - national variants
  const c10: [string, string, string][] = [['no','\u00D8','\u00F8'],['dk','\u00D8','\u00F8'],['sv','\u00D6','\u00F6'],['de','\u00D6','\u00F6'],['us',';',':'],['fr','\u00D6','\u00F6'],['sds','\u00D8','\u00F8'],['fao',';',':'],['en',';',':'],['ch','\u00D6','\u00F6'],['fi','\u00D6','\u00F6'],['is',';',':']];
  for (const [l,p,s] of c10) regLabel('C10', l, p, s, null);

  // C11 - national variants
  const c11: [string, string, string][] = [['no','\u00C6','\u00E6'],['dk','\u00C6','\u00E6'],['sv','\u00C4','\u00E4'],['de','\u00C4','\u00E4'],['us',"'",'"'],['fr','\u00C4','\u00E4'],['sds','\u00C6','\u00E6'],['fao',"'",'"'],['en',"'",'"'],['ch','\u00C4','\u00E4'],['fi','\u00C4','\u00E4'],['is',"'",'"']];
  for (const [l,p,s] of c11) regLabel('C11', l, p, s, null);

  // C12 - national variants
  const c12: [string, string, string][] = [['no',"'",'*'],['dk',"'",'*'],['sv',"'",'*'],['de','#',"'"],['us','\\','|'],['fr',"'",'*'],['sds',"'",'*'],['fao','#','~'],['en','#','~'],['ch','#',"'"],['fi',"'",'*'],['is',"'",'*']];
  for (const [l,p,s] of c12) regLabel('C12', l, p, s, null);

  regLabelAll('C13', 'RETURN', null, null);
  regLabelAll('C47', '\u21D0', null, null);
  regLabelAll('C48', '\u2191', null, null);
  regLabelAll('C49', '\u21D2', null, null);
  regLabelAll('C51', '4', null, null);
  regLabelAll('C52', '5', null, null);
  regLabelAll('C53', '6', null, null);
  regLabelAll('C54', '-', null, null);

  // B-row labels
  regLabelAll('B99', 'SHIFT', null, null);

  // B0 - national variants
  const b0: [string, string, string][] = [['no','>','<'],['dk','>','<'],['sv','>','<'],['de','<','>'],['us','Z','z'],['fr','<','>'],['sds','>','<'],['fao','Z','z'],['en','Z','z'],['ch','<','>'],['fi','>','<'],['is','>','<']];
  for (const [l,p,s] of b0) regLabel('B0', l, p, s, null);

  // B1 - national variants
  const b1: [string, string, string][] = [['no','Z','z'],['dk','Z','z'],['sv','Z','z'],['de','Y','y'],['us','X','x'],['fr','W','w'],['sds','Z','z'],['fao','X','x'],['en','X','x'],['ch','Y','y'],['fi','Z','z'],['is','Z','z']];
  for (const [l,p,s] of b1) regLabel('B1', l, p, s, null);

  // B2-B9 - national variants
  const b2: [string, string, string][] = [['no','X','x'],['dk','X','x'],['sv','X','x'],['de','X','x'],['us','C','c'],['fr','X','x'],['sds','X','x'],['fao','C','c'],['en','C','c'],['ch','X','x'],['fi','X','x'],['is','X','x']];
  for (const [l,p,s] of b2) regLabel('B2', l, p, s, null);

  const b3: [string, string, string][] = [['no','C','c'],['dk','C','c'],['sv','C','c'],['de','C','c'],['us','V','v'],['fr','C','c'],['sds','C','c'],['fao','V','v'],['en','V','v'],['ch','C','c'],['fi','C','c'],['is','C','c']];
  for (const [l,p,s] of b3) regLabel('B3', l, p, s, null);

  const b4: [string, string, string][] = [['no','V','v'],['dk','V','v'],['sv','V','v'],['de','V','v'],['us','B','b'],['fr','V','v'],['sds','V','v'],['fao','B','b'],['en','B','b'],['ch','V','v'],['fi','V','v'],['is','V','v']];
  for (const [l,p,s] of b4) regLabel('B4', l, p, s, null);

  const b5: [string, string, string][] = [['no','B','b'],['dk','B','b'],['sv','B','b'],['de','B','b'],['us','N','n'],['fr','B','b'],['sds','B','b'],['fao','N','n'],['en','N','n'],['ch','B','b'],['fi','B','b'],['is','B','b']];
  for (const [l,p,s] of b5) regLabel('B5', l, p, s, null);

  const b6: [string, string, string][] = [['no','N','n'],['dk','N','n'],['sv','N','n'],['de','N','n'],['us','M','m'],['fr','N','n'],['sds','N','n'],['fao','M','m'],['en','M','m'],['ch','N','n'],['fi','N','n'],['is','N','n']];
  for (const [l,p,s] of b6) regLabel('B6', l, p, s, null);

  const b7: [string, string, string][] = [['no','M','m'],['dk','M','m'],['sv','M','m'],['de','M','m'],['us',',','<'],['fr',',',';'],['sds','M','m'],['fao',',','<'],['en',',','<'],['ch','M','m'],['fi','M','m'],['is','M','m']];
  for (const [l,p,s] of b7) regLabel('B7', l, p, s, null);

  const b8: [string, string, string][] = [['no',',',';'],['dk',',',';'],['sv',',',';'],['de',',',';'],['us','.','>'],['fr','.',':'],['sds',',',';'],['fao','.','>'],['en','.','>'],['ch',',',';'],['fi',',',';'],['is',',',';']];
  for (const [l,p,s] of b8) regLabel('B8', l, p, s, null);

  const b9: [string, string, string][] = [['no','.',':'],['dk','.',':'],['sv','.',':'],['de','.',':'],['us','/','?'],['fr','/','!'],['sds','.',':'],['fao','/','?'],['en','/','?'],['ch','.',':'],['fi','.',':'],['is','.',':']];
  for (const [l,p,s] of b9) regLabel('B9', l, p, s, null);

  regLabelAll('B10', '-', '_', null);
  regLabelAll('B11', 'SHIFT', null, null);
  regLabelAll('B47', '\u2190', null, null);
  regLabelAll('B48', 'HOME', null, null);
  regLabelAll('B49', '\u2192', null, null);
  regLabelAll('B51', '1', null, null);
  regLabelAll('B52', '2', null, null);
  regLabelAll('B53', '3', null, null);
  regLabelAll('B54', 'ENTER', null, null);

  // A-row labels
  regLabelAll('A5', ' ', null, null);
  regLabelAll('A47', '\u2190|', null, null);
  regLabelAll('A48', '\u2193', null, null);
  regLabelAll('A49', '\u2192|', null, null);
  regLabelAll('A51', '0', null, null);
  regLabelAll('A53', '.', null, null);
}

// --- Initialize Alt mappings ---
function initializeAltMappings(): void {
  // Application control keys
  _defaultAltMap.set(72, 'G53');  // Alt+H → HJELP
  _defaultAltMap.set(68, 'F49');  // Alt+D → REPLACE (DO)
  _defaultAltMap.set(85, 'G51');  // Alt+U → FUNK
  _defaultAltMap.set(80, 'G52');  // Alt+P → SKRIV
  _defaultAltMap.set(83, 'G54');  // Alt+S → SLUTT
  _defaultAltMap.set(8, 'D48');   // Alt+Backspace → ANGRE
  _defaultAltMap.set(77, 'C99');  // Alt+M → MODE
  _defaultAltMap.set(70, 'F48');  // Alt+F → SEARCH
  _defaultAltMap.set(88, 'E47');  // Alt+X → GUILLEMETS

  // Editing keys
  _defaultAltMap.set(65, 'G9');   // Alt+A → MERK
  _defaultAltMap.set(76, 'G10');  // Alt+L → FELT
  _defaultAltMap.set(82, 'G11');  // Alt+R → AVSH
  _defaultAltMap.set(69, 'G12');  // Alt+E → SETN
  _defaultAltMap.set(87, 'G13');  // Alt+W → ORD
  _defaultAltMap.set(75, 'G48');  // Alt+K → KOPI
  _defaultAltMap.set(86, 'G49');  // Alt+V → FLYTT
  _defaultAltMap.set(74, 'E48');  // Alt+J → JUST
  _defaultAltMap.set(73, 'E49');  // Alt+I → SINGLEGUILLEMETS

  // PUSH keys (Alt+1-8)
  for (let i = 1; i <= 8; i++) {
    _defaultAltMap.set(48 + i, `G${i}`);
  }

  // PUSH keys (Alt+F1-F8) — same targets
  for (let i = 0; i < 8; i++) {
    _defaultAltMap.set(112 + i, `G${i + 1}`);
  }

  // PUSH keys shifted (Alt+Shift+F1-F8)
  for (let i = 0; i < 8; i++) {
    _defaultAltShiftMap.set(112 + i, `G${i + 1}`);
  }

  // Navigation
  _defaultAltMap.set(46, 'G47');  // Alt+Delete → STRYK
  _defaultAltMap.set(33, 'D49');  // Alt+PageUp → ROLLDN
  _defaultAltMap.set(34, 'D47');  // Alt+PageDown → ROLLUP
}

// --- Run initialization ---
initializeKeys();
initializeLabels();
initializeAltMappings();

// --- Public API ---
export class TDV2200KeyRegistry {
  static getKey(gridPosition: string): TDVKeyDefinition | null {
    return _keys.get(gridPosition) ?? null;
  }

  static tryGetKey(gridPosition: string): TDVKeyDefinition | null {
    return _keys.get(gridPosition) ?? null;
  }

  static getLabel(gridPosition: string, langCode: string): TDVKeyLabel | null {
    return _labels.get(gridPosition + '_' + langCode) ?? null;
  }

  static getGridForVK(vkCode: number): string | null {
    return _vkToGrid.get(vkCode) ?? null;
  }

  static getGridForName(name: string): string | null {
    return _nameToGrid.get(name.toLowerCase()) ?? null;
  }

  static getDefaultAltTarget(vkCode: number): string | null {
    return _defaultAltMap.get(vkCode) ?? null;
  }

  static getDefaultAltShiftTarget(vkCode: number): string | null {
    return _defaultAltShiftMap.get(vkCode) ?? null;
  }

  /** Get English label for a key */
  static getEnglishName(gridPosition: string): string | null {
    const label = _labels.get(gridPosition + '_en');
    if (label && label.primary !== null) return label.primary;
    const key = _keys.get(gridPosition);
    if (key) return key.name;
    return null;
  }

  /**
   * THE single method for resolving a key press to its escape sequence.
   */
  static getSequence(
    gridPosition: string,
    extendedMode: boolean,
    numPadFuncMode: boolean,
    shift: boolean = false,
    ctrl: boolean = false,
  ): string | null {
    const key = _keys.get(gridPosition);
    if (!key) return null;

    // Programmable keys have no fixed sequence
    if (key.isProgrammable) return null;

    if (extendedMode) {
      // AlwaysSameCode keys: same in both modes, ignore shift
      if (key.alwaysSameCode) return key.extNormal;

      // Numeric pad function mode
      if (numPadFuncMode && key.numPadFunc !== null) return key.numPadFunc;

      // Ctrl variant
      if (ctrl && key.extCtrl !== null) return key.extCtrl;

      // Shift variant
      if (shift && key.extShift !== null) return key.extShift;

      // Normal
      return key.extNormal;
    } else {
      // Simple ASCII mode
      if (key.alwaysSameCode) return key.simpleAscii ?? key.extNormal;
      return key.simpleAscii;
    }
  }

  /** Get all key definitions */
  static get allKeys(): ReadonlyMap<string, TDVKeyDefinition> {
    return _keys;
  }

  /** Get all supported language codes */
  static get languageCodes(): readonly string[] {
    return LANGUAGE_CODES;
  }
}
