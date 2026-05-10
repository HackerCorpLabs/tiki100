/* ay3_8912.c
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
 *   https://github.com/mamedev/mame/blob/master/src/devices/sound/ay8910.cpp
 *
 *   Andre Weissflog's chips library (zlib/libpng license)
 *   https://github.com/floooh/chips/blob/master/chips/ay38910.h
 *
 * Volume table from real AY-3-8910 measurements by Matthew Westcott (Dec 2001)
 * DC adjustment filter from StSound / ayumi
 *
 * SPDX-License-Identifier: BSD-3-Clause
 * Copyright (c) Couriersud (MAME ay8910.cpp)
 * Copyright (c) 2018 Andre Weissflog (chips ay38910.h)
 * Copyright (c) 1985-2026 Ronny Hansen (RetroCore C# port and this C port)
 */

#include "ay3_8912.h"
#include <string.h>

/* Fixed-point precision for sample rate conversion */
#define FIXEDPOINT_SCALE 16
#define DCADJ_BUFLEN     512

/* Register valid-bit masks */
static const byte reg_mask[AY_NUM_REGS] = {
  0xFF,  /* PERIOD_A_FINE */
  0x0F,  /* PERIOD_A_COARSE */
  0xFF,  /* PERIOD_B_FINE */
  0x0F,  /* PERIOD_B_COARSE */
  0xFF,  /* PERIOD_C_FINE */
  0x0F,  /* PERIOD_C_COARSE */
  0x1F,  /* PERIOD_NOISE */
  0xFF,  /* ENABLE */
  0x1F,  /* AMP_A (0..3: volume, 4: use envelope) */
  0x1F,  /* AMP_B */
  0x1F,  /* AMP_C */
  0xFF,  /* ENV_PERIOD_FINE */
  0xFF,  /* ENV_PERIOD_COARSE */
  0x0F,  /* ENV_SHAPE */
  0xFF,  /* IO_PORT_A */
  0xFF   /* IO_PORT_B */
};

/* Volume levels normalized 0.0 - 1.0
 * Based on Matthew Westcott's measurements from a real AY-3-8910 chip */
static const float volumes[16] = {
  0.0f,
  0.00999465934234f,
  0.0144502937362f,
  0.0210574502174f,
  0.0307011520562f,
  0.0455481803616f,
  0.0644998855573f,
  0.107362478065f,
  0.126588845655f,
  0.20498970016f,
  0.292210269322f,
  0.372838941024f,
  0.492530708782f,
  0.635324635691f,
  0.805584802014f,
  1.0f
};

/* Chip state */
static byte regs[AY_NUM_REGS];
static byte addrLatch;

/* Tone channels */
static int tonePeriod[AY_NUM_CHANNELS];
static int toneCount[AY_NUM_CHANNELS];
static int toneDutyCycle[AY_NUM_CHANNELS];
static int toneOutput[AY_NUM_CHANNELS];
static int toneDisable[AY_NUM_CHANNELS];
static int noiseDisable[AY_NUM_CHANNELS];

/* Noise generator */
static int noisePeriod;
static int noiseCount;
static int noisePrescale;
static unsigned int noiseRng;

/* Envelope generator */
static int envPeriod;
static int envCount;
static int envStep;
static int envVolume;
static int envAttack;
static int envHold;
static int envAlternate;
static int envHolding;

/* Sample generation */
static unsigned int tick;
static int samplePeriod;
static int sampleCounter;
static float magnitude;
static float currentSample;

/* DC adjustment filter */
static float dcadjSum;
static unsigned int dcadjPos;
static float dcadjBuf[DCADJ_BUFLEN];

/* I/O port callbacks */
static ay_port_write_fn portWriteFn;
static ay_port_read_fn portReadFn;

/* Ring buffer for CPU-to-audio-thread sample delivery.
 * Power-of-2 size for fast masking. ~93ms at 44100 Hz. */
#define RING_SIZE 4096
#define RING_MASK (RING_SIZE - 1)
static float ringBuf[RING_SIZE];
static volatile unsigned int ringHead;  /* written by CPU thread (ayTick) */
static volatile unsigned int ringTail;  /* read by audio thread (ayFillAudioBuffer) */

/*****************************************************************************/
/* Internal helpers                                                          */
/*****************************************************************************/

static float dcadjust(float s) {
  dcadjSum -= dcadjBuf[dcadjPos];
  dcadjSum += s;
  dcadjBuf[dcadjPos] = s;
  dcadjPos = (dcadjPos + 1) & (DCADJ_BUFLEN - 1);
  return s - (dcadjSum / DCADJ_BUFLEN);
}

static void updateValues(void) {
  int i;
  for (i = 0; i < AY_NUM_CHANNELS; i++) {
    int period = regs[2 * i] | (regs[2 * i + 1] << 8);
    if (period == 0) period = 1;
    tonePeriod[i] = period;

    /* Enable bits: set bit = DISABLED (active low) */
    toneDisable[i] = (regs[AY_REG_ENABLE] >> i) & 1;
    noiseDisable[i] = (regs[AY_REG_ENABLE] >> (3 + i)) & 1;
  }

  noisePeriod = regs[AY_REG_PERIOD_NOISE] & 0x1F;
  if (noisePeriod == 0) noisePeriod = 1;

  envPeriod = regs[AY_REG_ENV_PERIOD_FINE] | (regs[AY_REG_ENV_PERIOD_COARSE] << 8);
  if (envPeriod == 0) envPeriod = 1;
}

static void restartEnvShape(void) {
  byte shape = regs[AY_REG_ENV_SHAPE];

  envAttack = (shape & 0x04) ? 0x0F : 0x00;

  if ((shape & 0x08) == 0) {
    /* Continue = 0: map to equivalent shape */
    envHold = 1;
    envAlternate = envAttack;
  } else {
    envHold = shape & 0x01;
    envAlternate = shape & 0x02;
  }

  envStep = 0x0F;
  envHolding = 0;
  envVolume = envStep ^ envAttack;
}

/*****************************************************************************/
/* Public API                                                                */
/*****************************************************************************/

void ayInit(int cpu_freq, int sample_rate) {
  int tick_hz = cpu_freq / 2;

  noiseRng = 1;
  samplePeriod = (tick_hz * FIXEDPOINT_SCALE) / sample_rate;
  sampleCounter = samplePeriod;
  magnitude = 0.5f;

  ayReset();
}

void ayReset(void) {
  int i;

  memset(regs, 0, sizeof(regs));
  addrLatch = 0;
  tick = 0;

  for (i = 0; i < AY_NUM_CHANNELS; i++) {
    tonePeriod[i] = 1;
    toneCount[i] = 0;
    toneDutyCycle[i] = 0;
    toneOutput[i] = 0;
    toneDisable[i] = 0;
    noiseDisable[i] = 0;
  }

  noisePeriod = 1;
  noiseCount = 0;
  noisePrescale = 0;
  noiseRng = 1;

  envPeriod = 1;
  envCount = 0;
  envStep = 0;
  envVolume = 0;
  envAttack = 0;
  envHold = 0;
  envAlternate = 0;
  envHolding = 0;

  memset(dcadjBuf, 0, sizeof(dcadjBuf));
  dcadjSum = 0.0f;
  dcadjPos = 0;
  currentSample = 0.0f;

  ringHead = 0;
  ringTail = 0;

  updateValues();
  restartEnvShape();
}

void ayRegSelect(byte value) {
  if (value < AY_NUM_REGS) {
    addrLatch = value;
  }
}

void ayDataWrite(byte value) {
  byte masked = value & reg_mask[addrLatch];
  regs[addrLatch] = masked;
  updateValues();

  switch (addrLatch) {
    case AY_REG_ENV_SHAPE:
      restartEnvShape();
      break;

    case AY_REG_IO_PORT_A:
      /* Port A output if bit 6 of enable register is set */
      if ((regs[AY_REG_ENABLE] & (1 << 6)) && portWriteFn) {
        portWriteFn(0, value);
      }
      break;

    case AY_REG_IO_PORT_B:
      /* Port B output if bit 7 of enable register is set */
      if ((regs[AY_REG_ENABLE] & (1 << 7)) && portWriteFn) {
        portWriteFn(1, value);
      }
      break;
  }
}

byte ayDataRead(void) {
  switch (addrLatch) {
    case AY_REG_IO_PORT_A:
      if ((regs[AY_REG_ENABLE] & (1 << 6)) && portReadFn) {
        return portReadFn(0);
      }
      return regs[addrLatch];

    case AY_REG_IO_PORT_B:
      if ((regs[AY_REG_ENABLE] & (1 << 7)) && portReadFn) {
        return portReadFn(1);
      }
      return regs[addrLatch];

    default:
      return regs[addrLatch];
  }
}

int ayTick(void) {
  int i;

  tick++;

  /* Tone and noise channels tick at clock/8 */
  if ((tick & 7) == 0) {
    /* Tick tone channels */
    for (i = 0; i < AY_NUM_CHANNELS; i++) {
      toneCount[i]++;
      while (toneCount[i] >= tonePeriod[i]) {
        toneDutyCycle[i] = (toneDutyCycle[i] - 1) & 0x1F;
        toneOutput[i] = toneDutyCycle[i] & 1;
        toneCount[i] -= tonePeriod[i];
      }
    }

    /* Tick noise channel with prescaler */
    if (++noiseCount >= noisePeriod) {
      noiseCount = 0;
      noisePrescale ^= 1;

      if (noisePrescale == 0) {
        /* 17-bit LFSR: input = bit0 XOR bit3, output = bit0 */
        noiseRng = (noiseRng >> 1) | (((noiseRng ^ (noiseRng >> 3)) & 1) << 16);
      }
    }
  }

  /* Envelope ticks at clock/16 */
  if ((tick & 15) == 0) {
    if (!envHolding) {
      if (++envCount >= envPeriod) {
        envCount = 0;
        envStep--;

        if (envStep < 0) {
          if (envHold) {
            if (envAlternate)
              envAttack ^= 0x0F;
            envHolding = 1;
            envStep = 0;
          } else {
            if (envAlternate && (envStep & 0x10))
              envAttack ^= 0x0F;
            envStep &= 0x0F;
          }
        }
      }
    }
    envVolume = envStep ^ envAttack;
  }

  /* Generate sample at configured sample rate */
  sampleCounter -= FIXEDPOINT_SCALE;
  if (sampleCounter <= 0) {
    float sm = 0.0f;
    sampleCounter += samplePeriod;

    for (i = 0; i < AY_NUM_CHANNELS; i++) {
      float vol;
      byte ampReg = regs[AY_REG_AMP_A + i];

      if ((ampReg & (1 << 4)) == 0) {
        vol = volumes[ampReg & 0x0F];
      } else {
        vol = volumes[envVolume & 0x0F];
      }

      int volEnabled = (toneOutput[i] | toneDisable[i])
                     & ((int)(noiseRng & 1) | noiseDisable[i]);
      if (volEnabled) {
        sm += vol;
      }
    }

    currentSample = dcadjust(sm) * magnitude;

    /* Push sample into ring buffer for audio thread */
    unsigned int next = (ringHead + 1) & RING_MASK;
    if (next != ringTail) {  /* drop sample if buffer full */
      ringBuf[ringHead] = currentSample;
      ringHead = next;
    }

    return 1;
  }

  return 0;
}

float ayGetSample(void) {
  return currentSample;
}

void aySetVolume(float vol) {
  if (vol < 0.0f) vol = 0.0f;
  if (vol > 1.0f) vol = 1.0f;
  magnitude = vol;
}

void aySetPortWriteHandler(ay_port_write_fn fn) {
  portWriteFn = fn;
}

void aySetPortReadHandler(ay_port_read_fn fn) {
  portReadFn = fn;
}

void ayFillAudioBuffer(float *buffer, int frames) {
  int i;
  for (i = 0; i < frames; i++) {
    float sample;
    if (ringTail != ringHead) {
      sample = ringBuf[ringTail];
      ringTail = (ringTail + 1) & RING_MASK;
    } else {
      /* Buffer underrun - output last known sample to avoid clicks */
      sample = currentSample;
    }
    buffer[i * 2]     = sample;  /* Left */
    buffer[i * 2 + 1] = sample;  /* Right */
  }
}

void ayRenderAudio(float *buffer, int frames) {
  int i;
  for (i = 0; i < frames; i++) {
    /* Tick until we get a sample */
    while (!ayTick()) { }

    buffer[i * 2]     = currentSample;  /* Left */
    buffer[i * 2 + 1] = currentSample;  /* Right */
  }
}
