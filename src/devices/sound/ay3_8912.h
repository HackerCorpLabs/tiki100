/* ay3_8912.h
 *
 * AY-3-8912 Programmable Sound Generator emulation
 *
 * Ported from RetroCore C# (Ronny Hansen) which was in turn ported from:
 *
 *   MAME ay8910.cpp - AY-3-8910 / YM2149 sound chip emulation
 *   license: BSD-3-Clause
 *   copyright-holders: Couriersud
 *   Based on code by Ville Hallik, Michael Cuddy, Tatsuyuki Satoh,
 *   Fabrice Frances, Nicola Salmoria.
 *   Mostly rewritten by Couriersud in 2008.
 *
 *   Andre Weissflog's chips library (zlib/libpng license)
 *   https://github.com/floooh/chips/blob/master/chips/ay38910.h
 *
 * Volume table from real AY-3-8910 measurements by Matthew Westcott
 *
 * SPDX-License-Identifier: BSD-3-Clause
 * Copyright (c) Couriersud (MAME ay8910.cpp)
 * Copyright (c) 2018 Andre Weissflog (chips ay38910.h)
 * Copyright (c) 1985-2026 Ronny Hansen (RetroCore C# port and this C port)
 *
 * The AY-3-8912 provides:
 *   - 3 square-wave tone channels
 *   - 1 noise generator (17-bit LFSR)
 *   - Envelope generator with 16 shapes
 *   - 1 I/O port (Port A - used for scroll register on TIKI-100)
 *
 * Register map (accent on I/O via ports 0x16/0x17):
 *   Port 0x16 write: select register (address latch)
 *   Port 0x17 write: write data to selected register
 *   Port 0x17 read:  read data from selected register
 */

#ifndef AY3_8912_H
#define AY3_8912_H

#include "Z80.h"

/* Number of PSG registers */
#define AY_NUM_REGS        16
#define AY_NUM_CHANNELS    3

/* Register addresses */
#define AY_REG_PERIOD_A_FINE      0
#define AY_REG_PERIOD_A_COARSE    1
#define AY_REG_PERIOD_B_FINE      2
#define AY_REG_PERIOD_B_COARSE    3
#define AY_REG_PERIOD_C_FINE      4
#define AY_REG_PERIOD_C_COARSE    5
#define AY_REG_PERIOD_NOISE       6
#define AY_REG_ENABLE             7
#define AY_REG_AMP_A              8
#define AY_REG_AMP_B              9
#define AY_REG_AMP_C             10
#define AY_REG_ENV_PERIOD_FINE   11
#define AY_REG_ENV_PERIOD_COARSE 12
#define AY_REG_ENV_SHAPE         13
#define AY_REG_IO_PORT_A         14
#define AY_REG_IO_PORT_B         15

/* Callback for Port A writes (scroll register on TIKI-100) */
typedef void (*ay_port_write_fn)(byte port, byte value);
typedef byte (*ay_port_read_fn)(byte port);

/* Initialize the sound chip
 * cpu_freq:   CPU clock in Hz (4000000 for TIKI-100)
 * sample_rate: audio output sample rate in Hz (44100 typical)
 */
void ayInit(int cpu_freq, int sample_rate);

/* Reset the sound chip to power-on state */
void ayReset(void);

/* Write to register select port (port 0x16) */
void ayRegSelect(byte value);

/* Write data to selected register (port 0x17) */
void ayDataWrite(byte value);

/* Read data from selected register (port 0x17) */
byte ayDataRead(void);

/* Tick the sound generator - call at cpu_freq/2 rate.
 * Returns 1 when a new audio sample is ready.
 * The sample value can be retrieved with ayGetSample().
 */
int ayTick(void);

/* Flush AY ticks up to a given Z80-cycle offset within the current
 * LoopZ80 block. Call BEFORE applying any AY register write so the
 * write takes effect at the correct sample boundary. */
void ayFlush(int cyclesIntoBlock);

/* Clear the per-block cycle-debt tracker. Call once per LoopZ80
 * after flushing the full IPeriod. */
void ayResetDebt(void);

/* Get the most recent audio sample (-1.0 to 1.0) */
float ayGetSample(void);

/* Set output volume (0.0 = silent, 1.0 = max) */
void aySetVolume(float vol);

/* Set I/O port callbacks */
void aySetPortWriteHandler(ay_port_write_fn fn);
void aySetPortReadHandler(ay_port_read_fn fn);

/* Fill SDL audio buffer from the sample ring buffer.
 * Samples are pushed into the ring buffer by ayTick() (called from CPU loop).
 * If the ring buffer runs dry, silence is output.
 * buffer: output buffer (interleaved stereo float samples)
 * frames: number of stereo frames to fill
 */
void ayFillAudioBuffer(float *buffer, int frames);

/* Legacy pull-based rendering (generates samples on demand, not CPU-synced).
 * Use ayFillAudioBuffer instead for CPU-synchronized audio.
 */
void ayRenderAudio(float *buffer, int frames);

#endif
