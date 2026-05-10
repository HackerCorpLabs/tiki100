/**
 * Minimal Terminal interface stub for VirtualKeyboard.
 * The TIKI-100 emulator doesn't use RetroTermWeb terminals -
 * key events are sent directly to the WASM emulator via Module._SendKey().
 * This stub satisfies the TypeScript compiler.
 */

export interface Terminal {
  _onKey?: {
    fire(event: { key: string; domEvent: KeyboardEvent }): void;
  };
}
