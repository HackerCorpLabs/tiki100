/* tiki100wasm.c V0.2.0
 *
 * WebAssembly (Emscripten) frontend for TIKI-100 emulator
 * Based on the original emulator by Asbjorn Djupdal 2000-2001
 *
 * This module provides the WASM entry point and exports
 * functions callable from JavaScript for controlling the
 * emulator in a web browser.
 */

#include "TIKI-100_emul.h"
#include "protos.h"
#include "ay3_8912.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#endif

/* Access to cpu struct from TIKI-100_emul.c */
extern Z80 cpu;

#define TIKI_CPU_FREQ 4000000

/* Display state */
static int fb_width = 512;
static int fb_height = 256;

/* Palette: RGBA values for each color index */
static unsigned int palette[16];

/* Framebuffer: pixel data accessible from JS */
static unsigned char *framebuffer = NULL;
static int fb_dirty = 0;

/* Keyboard state */
static byte pressedKeys[256];

/* Status indicators */
static int lockStatus = 0;
static int grafikkStatus = 0;
static int diskStatus_flag[2] = {0, 0};
static int hddStatus_flag[2]  = {0, 0};
static int hddLightTimer[2]   = {0, 0};
#define HDD_LIGHT_TICKS 4

/* Disk images */
static byte *dsk[2] = {NULL, NULL};

/* Printer output buffer */
#define PRINTER_BUF_SIZE 4096
static char printerBuf[PRINTER_BUF_SIZE];
static int printerBufLen = 0;

/* Emulator state */
static int initialized = 0;
static int emulRunning = 0;

/* Debug counters */
static int dbgStepCount = 0;
static int dbgPlotCount = 0;
static int dbgLoopEmulCount = 0;

/*****************************************************************************/
/* Platform callbacks required by TIKI-100_emul.h                           */
/*****************************************************************************/

void changeRes(int newRes) {
  switch (newRes) {
    case HIGHRES: fb_width = 1024; break;
    case MEDRES:  fb_width = 512;  break;
    case LOWRES:  fb_width = 256;  break;
    default: return;
  }
  fb_height = 256;

  free(framebuffer);
  framebuffer = (unsigned char *)calloc(fb_width * fb_height * 4, 1);
  fb_dirty = 1;
}

void plotPixel(int x, int y, int color) {
  dbgPlotCount++;
  if (!framebuffer || x < 0 || x >= fb_width || y < 0 || y >= fb_height) return;

  int offset = (y * fb_width + x) * 4;
  unsigned int c = palette[color & 0x0f];
  framebuffer[offset + 0] = (c >> 16) & 0xff; /* R */
  framebuffer[offset + 1] = (c >>  8) & 0xff; /* G */
  framebuffer[offset + 2] = (c      ) & 0xff; /* B */
  framebuffer[offset + 3] = 255;               /* A */
  fb_dirty = 1;
}

void scrollScreen(int distance) {
  if (!framebuffer) return;
  int rowBytes = fb_width * 4;

  if (distance > 0 && distance < fb_height) {
    memmove(framebuffer,
            framebuffer + distance * rowBytes,
            (fb_height - distance) * rowBytes);
    memset(framebuffer + (fb_height - distance) * rowBytes, 0,
           distance * rowBytes);
  } else if (distance < 0 && -distance < fb_height) {
    int d = -distance;
    memmove(framebuffer + d * rowBytes,
            framebuffer,
            (fb_height - d) * rowBytes);
    memset(framebuffer, 0, d * rowBytes);
  }
  fb_dirty = 1;
}

void changePalette(int colornumber, byte red, byte green, byte blue) {
  if (colornumber >= 0 && colornumber < 16) {
    palette[colornumber] = (red << 16) | (green << 8) | blue;
  }
}

void loopEmul(int ms) {
  int d;
  (void)ms;
  fb_dirty = 1;
  for (d = 0; d < 2; d++) {
    if (hddLightTimer[d] > 0) {
      if (--hddLightTimer[d] == 0) hddStatus_flag[d] = 0;
    }
  }
  dbgLoopEmulCount++;
}

void lockLight(boolean status) {
  lockStatus = status ? 1 : 0;
}

void grafikkLight(boolean status) {
  grafikkStatus = status ? 1 : 0;
}

void diskLight(int drive, boolean status) {
  if (drive >= 0 && drive < 2) {
    diskStatus_flag[drive] = status ? 1 : 0;
  }
}

void hddLight(int drive, boolean status) {
  if (drive >= 0 && drive < 2 && status) {
    hddStatus_flag[drive] = 1;
    hddLightTimer[drive] = HDD_LIGHT_TICKS;
  }
}

byte testKey(byte keys[8]) {
  byte result = 0;
  int i;
  for (i = 0; i < 8; i++) {
    if (keys[i] == KEY_NONE || !pressedKeys[keys[i]]) {
      result |= (1 << i);
    }
  }
  return result;
}

void setParams(struct serParams *p1, struct serParams *p2) {
  (void)p1; (void)p2;
}

void sendChar(int port, byte value) {
  (void)port; (void)value;
}

byte getChar(int port) {
  (void)port; return 0;
}

void printChar(byte value) {
  if (printerBufLen < PRINTER_BUF_SIZE - 1) {
    printerBuf[printerBufLen++] = (char)value;
    printerBuf[printerBufLen] = '\0';
  }
}

/* charAvailable() and setST28b() are implemented in serial.c */

/*****************************************************************************/
/* Exported functions for JavaScript                                         */
/*****************************************************************************/

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int Init(void) {
  memset(pressedKeys, 0, sizeof(pressedKeys));
  memset(palette, 0, sizeof(palette));
  framebuffer = (unsigned char *)calloc(fb_width * fb_height * 4, 1);

  /* Initialize sound chip */
  soundInit(TIKI_CPU_FREQ, 44100);

  /* Initialize hard disk controller */
  hddInit();

  initialized = 1;
  return 1;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int Boot(void) {
  if (!initialized) return 0;
  emulRunning = 1;

  if (!initMem()) {
    fprintf(stderr, "Failed to initialize memory - ROM not found\n");
    emulRunning = 0;
    return 0;
  }
  cpu.IPeriod = 4000;
  ResetZ80(&cpu);
  return 1;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int Step(int cycles) {
  if (!emulRunning) return 0;
  (void)cycles;

  /* ExecZ80 runs a SINGLE opcode. We need to run a full IPeriod
   * worth of instructions, then call LoopZ80 for CTC/sound/display. */
  while (cpu.ICount > 0) {
    ExecZ80(&cpu);
  }

  /* Period expired - call LoopZ80 for housekeeping */
  {
    word result = LoopZ80(&cpu);
    cpu.ICount += cpu.IPeriod;

    /* Handle interrupts */
    if (result != INT_NONE && result != INT_QUIT) {
      IntZ80(&cpu, result);
    }
  }

  dbgStepCount++;
  return 1;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetDbgStepCount(void) { return dbgStepCount; }

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetDbgPlotCount(void) { return dbgPlotCount; }

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetDbgLoopEmulCount(void) { return dbgLoopEmulCount; }

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void Stop(void) {
  emulRunning = 0;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int IsInitialized(void) {
  return initialized;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void SendKey(byte key, int pressed) {
  pressedKeys[key & 0xff] = pressed ? 1 : 0;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
unsigned char *GetFrameBuffer(void) {
  return framebuffer;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetFrameBufferWidth(void) {
  return fb_width;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetFrameBufferHeight(void) {
  return fb_height;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetLockStatus(void) {
  return lockStatus;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetGrafikkStatus(void) {
  return grafikkStatus;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetDiskStatus(int drive) {
  if (drive >= 0 && drive < 2) return diskStatus_flag[drive];
  return 0;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetHDDStatus(int drive) {
  if (drive >= 0 && drive < 2) return hddStatus_flag[drive];
  return 0;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int IsDirty(void) {
  int d = fb_dirty;
  fb_dirty = 0;
  return d;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void MountFloppy(int drive, byte *imageData, int imageSize) {
  int tracks, sides, sectors, sectSize;
  char path[32];
  FILE *fp;

  if (drive < 0 || drive > 1 || !imageData || imageSize <= 0) return;

  /* Eject existing disk */
  if (dsk[drive]) {
    removeDisk(drive);
    free(dsk[drive]);
    dsk[drive] = NULL;
  }

  /* Write image to MEMFS */
  snprintf(path, sizeof(path), "/floppy%d.dsk", drive);
  fp = fopen(path, "wb");
  if (!fp) {
    printf("MountFloppy: failed to create %s\n", path);
    return;
  }
  fwrite(imageData, 1, imageSize, fp);
  fclose(fp);

  /* Read back from MEMFS into persistent buffer */
  fp = fopen(path, "rb");
  if (!fp) {
    printf("MountFloppy: failed to read back %s\n", path);
    return;
  }
  dsk[drive] = (byte *)malloc(imageSize);
  if (!dsk[drive]) {
    fclose(fp);
    return;
  }
  fread(dsk[drive], 1, imageSize, fp);
  fclose(fp);

  /* Auto-detect geometry */
  sectSize = 256;
  switch (imageSize) {
    case 92160:   tracks = 40; sides = 1; sectors = 9;  break;
    case 184320:  tracks = 40; sides = 2; sectors = 9;  break;
    case 204800:  tracks = 40; sides = 1; sectors = 10; sectSize = 512; break;
    case 409600:  tracks = 40; sides = 2; sectors = 10; sectSize = 512; break;
    case 819200:  tracks = 80; sides = 2; sectors = 10; sectSize = 512; break;
    default:      tracks = 40; sides = 2; sectors = 9;  break;
  }

  insertDisk(drive, dsk[drive], tracks, sides, sectors, sectSize);
  printf("MountFloppy: drive %d mounted (%d bytes, %dx%dx%d sect=%d) first bytes: %02x %02x %02x %02x\n",
         drive, imageSize, tracks, sides, sectors, sectSize,
         dsk[drive][0], dsk[drive][1], dsk[drive][2], dsk[drive][3]);
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void UnmountFloppy(int drive) {
  if (drive < 0 || drive > 1) return;
  removeDisk(drive);
  if (dsk[drive]) {
    free(dsk[drive]);
    dsk[drive] = NULL;
  }
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void MountHDD(int drive, byte *imageData, int imageSize) {
  char path[32];
  FILE *fp;

  if (drive < 0 || drive > 1 || !imageData || imageSize <= 0) return;

  /* Write image to MEMFS so hddMountImage can fopen it */
  snprintf(path, sizeof(path), "/hd%d.dsk", drive);
  fp = fopen(path, "wb");
  if (!fp) return;
  fwrite(imageData, 1, imageSize, fp);
  fclose(fp);

  hddMountImage(drive, path);
  printf("HDD: Mounted drive %d (%d bytes)\n", drive, imageSize);
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void UnmountHDD(int drive) {
  if (drive < 0 || drive > 1) return;
  hddUnmountImage(drive);
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void Reset(void) {
  resetEmul();
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int LoadROM(const char *filename) {
  return loadROM(filename);
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void ayFillAudioBufferWasm(float *buffer, int frames) {
  ayFillAudioBuffer(buffer, frames);
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
char *GetPrinterBuffer(void) {
  return printerBuf;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
int GetPrinterBufferLen(void) {
  return printerBufLen;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void ClearPrinterBuffer(void) {
  printerBufLen = 0;
  printerBuf[0] = '\0';
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void SetVolume(int percent) {
  float vol = (float)percent / 100.0f;
  if (vol < 0.0f) vol = 0.0f;
  if (vol > 1.0f) vol = 1.0f;
  aySetVolume(vol);
}

/*****************************************************************************/
/* Main (WASM entry point)                                                   */
/*****************************************************************************/

int main(int argc, char *argv[]) {
  (void)argc;
  (void)argv;
  printf("TIKI-100 Emulator (WASM) loaded\n");
  return 0;
}
