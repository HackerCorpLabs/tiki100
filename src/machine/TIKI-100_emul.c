/* TIKI-100_emul.c V1.1.0
 *
 * Hovedmodul for TIKI-100_emul
 * Copyright (C) Asbj�rn Djupdal 2000-2001
 */

#include "TIKI-100_emul.h"
#include "protos.h"
#include "ay3_8912.h"

/* variabler */

Z80 cpu;
static boolean done = FALSE;
static int wasmStepMode = 0; /* when 1, LoopZ80 returns INT_QUIT each period */

/*****************************************************************************/

/* starter emulering, returnerer n�r emulering avslutter */
boolean runEmul (void) {
#ifdef DEBUG
  cpu.Trap = 0xffff;
#endif
  cpu.IPeriod = 4000;
  if (initMem()) {
    ResetZ80 (&cpu);
    RunZ80 (&cpu);
    return TRUE;
  }
  return FALSE;
}
/* ikke i bruk */
void PatchZ80 (register Z80 *R) {
}
/* kalles regelmessig av z80-emulator */
word LoopZ80 (register Z80 *R) {
  static int guiCount = 20;
  int i;
  if (done) return INT_QUIT;
  updateCTC (cpu.IPeriod);
  /* Tick sound chip at CPU/2 rate.
   * IPeriod = 4000 Z80 cycles = 2000 AY ticks */
  for (i = 0; i < cpu.IPeriod / 2; i++) {
    ayTick();
  }
  if (--guiCount == 0) {
    loopEmul (20);
    guiCount = 20;
  }
  /* In WASM step mode, return INT_QUIT each period so ExecZ80
   * returns control to the JS event loop. CPU state is preserved
   * and the next ExecZ80 call resumes execution. */
  if (wasmStepMode) return INT_QUIT;
  return INT_NONE;
}
/* reset emulator */
void resetEmul (void) {
  OutZ80 (0x1c, 0x00);
  ResetZ80 (&cpu);
}
/* enable/disable WASM step mode */
void setWasmStepMode(int enable) {
  wasmStepMode = enable ? 1 : 0;
}

/* avslutt emulator */
void quitEmul (void) {
  done = TRUE;
}
#ifdef DEBUG
/* start z80-debugger */
void trace (void) {
  cpu.Trace = 1;
}
#endif
