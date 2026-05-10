/**
 * ND-246 keyboard mapper — thin wrapper around TDV2200KeyRegistry.
 * Holds mode state (Extended Control Mode, Numeric Pad Function Mode)
 * and delegates all key data to the registry.
 */

import { TDV2200KeyRegistry } from './TDV2200KeyRegistry';

export class ND246KeyboardMapper {
  /** Extended Control Mode: CSI nn _ sequences (true) vs simple ASCII C0 codes (false) */
  extendedControlMode: boolean = true;

  /** Numeric Pad Function Mode: numpad keys send CSI sequences */
  numericPadFuncMode: boolean = false;

  /**
   * Map a grid position to its escape sequence.
   * @param gridPosition Grid position string (e.g., "G53", "F51")
   * @param shift Whether Shift is held
   * @param ctrl Whether Ctrl is held
   * @returns Escape sequence string or null
   */
  mapGridKey(gridPosition: string, shift: boolean = false, ctrl: boolean = false): string | null {
    return TDV2200KeyRegistry.getSequence(
      gridPosition,
      this.extendedControlMode,
      this.numericPadFuncMode,
      shift,
      ctrl,
    );
  }

  /**
   * Get the grid position for a PC key name.
   * @param keyName Key name (e.g., "HELP", "F1", "PUSH1", "ARROWUP")
   * @returns Grid position string or null
   */
  getGridPositionForKey(keyName: string): string | null {
    return TDV2200KeyRegistry.getGridForName(keyName);
  }

  /**
   * Map a key name to its escape sequence.
   * Convenience method: looks up grid position by name, then resolves sequence.
   */
  mapKey(keyName: string, shift: boolean = false, ctrl: boolean = false): string | null {
    const grid = TDV2200KeyRegistry.getGridForName(keyName);
    if (grid === null) return null;
    return this.mapGridKey(grid, shift, ctrl);
  }
}
