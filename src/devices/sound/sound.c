/* sound.c V2.0.0
 *
 * AY-3-8912 interface for TIKI-100_emul
 * Original stub Copyright (C) Asbjorn Djupdal 2000-2001
 * Full AY-3-8912 implementation ported from MAME (BSD-3-Clause, Couriersud)
 * via RetroCore C# by Ronny Hansen
 *
 * This file wraps the ay3_8912 module to match the existing
 * soundReg/soundData/getSoundData interface used by mem.c
 *
 * Port A (register 14) output drives the video scroll register
 * via newOffset() - same as the original stub.
 */

#include "TIKI-100_emul.h"
#include "protos.h"
#include "ay3_8912.h"

/* Port A write callback - drives scroll register */
static void ayPortWriteCallback(byte port, byte value) {
  if (port == 0) {
    newOffset(value);
  }
}

/* Initialize the sound chip - call from frontend before runEmul() */
void soundInit(int cpu_freq, int sample_rate) {
  ayInit(cpu_freq, sample_rate);
  aySetPortWriteHandler(ayPortWriteCallback);
}

/* Write to register select (port 0x16) */
void soundReg(byte value) {
  ayRegSelect(value);
}

/* Write data to selected register (port 0x17) */
void soundData(byte value) {
  ayDataWrite(value);
}

/* Read data from selected register (port 0x17) */
byte getSoundData(void) {
  return ayDataRead();
}
