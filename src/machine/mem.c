/* mem.c V1.1.0
 *
 * Tar seg av minne-h�ndtering for TIKI-100_emul
 * Copyright (C) Asbj�rn Djupdal 2000-2001
 */

#include "TIKI-100_emul.h"
#include "protos.h"
#include <stdio.h>
#include <string.h>

#define ROM_FILENAME    "tikirom-2.03w"

/* variabler */

byte ram[64 * 1024];    /* hoved minne */
extern byte gfxRam[];   /* grafikk minne */
byte rom[16 * 1024];    /* monitor eprom, vanligvis bare 8k men st�tter 16k */

static boolean gfxIn;   /* TRUE hvis grafikkram er synlig for prosessor */
static boolean romIn;   /* TRUE hvis rom er synlig for prosessor */

/* Set by frontend to allow searching for ROM relative to executable */
char romSearchPath[512] = "";

/*****************************************************************************/

/* Try to open ROM from a list of search paths */
static FILE *findRom(void) {
  FILE *fp;
  char path[1024];

  /* 1. Current directory */
  fp = fopen(ROM_FILENAME, "rb");
  if (fp) return fp;

  /* 2. Absolute path (for Emscripten MEMFS) */
  fp = fopen("/" ROM_FILENAME, "rb");
  if (fp) return fp;

  /* 3. rom/ subdirectory */
  fp = fopen("rom/" ROM_FILENAME, "rb");
  if (fp) return fp;

  /* 4. Path set by frontend (next to executable) */
  if (romSearchPath[0]) {
    snprintf(path, sizeof(path), "%s/%s", romSearchPath, ROM_FILENAME);
    fp = fopen(path, "rb");
    if (fp) return fp;

    snprintf(path, sizeof(path), "%s/rom/%s", romSearchPath, ROM_FILENAME);
    fp = fopen(path, "rb");
    if (fp) return fp;
  }

  return NULL;
}

/* Find and open a ROM by name, searching multiple paths */
static FILE *findRomByName(const char *name) {
  FILE *fp;
  char path[1024];

  fp = fopen(name, "rb");
  if (fp) return fp;

  snprintf(path, sizeof(path), "rom/%s", name);
  fp = fopen(path, "rb");
  if (fp) return fp;

  if (romSearchPath[0]) {
    snprintf(path, sizeof(path), "%s/%s", romSearchPath, name);
    fp = fopen(path, "rb");
    if (fp) return fp;

    snprintf(path, sizeof(path), "%s/rom/%s", romSearchPath, name);
    fp = fopen(path, "rb");
    if (fp) return fp;
  }

  return NULL;
}

int initMem() {
  FILE *fp;

  fp = findRom();
  if (fp) {
    size_t n = fread(rom, 1, 16 * 1024, fp);
    fclose(fp);
    if (n == 0) {
      fprintf(stderr, "Failed to read ROM data\n");
      return FALSE;
    }
    OutZ80(0x1c, 0x00);
    return TRUE;
  }
  fprintf(stderr, "ROM not found. Searched: ./%s, ./rom/%s", ROM_FILENAME, ROM_FILENAME);
  if (romSearchPath[0])
    fprintf(stderr, ", %s/%s", romSearchPath, ROM_FILENAME);
  fprintf(stderr, "\n");
  return FALSE;
}

/* Load a new ROM and reset the machine. Returns TRUE on success. */
int loadROM(const char *filename) {
  FILE *fp = findRomByName(filename);
  if (!fp) {
    fprintf(stderr, "ROM not found: %s\n", filename);
    return FALSE;
  }
  memset(rom, 0xff, 16 * 1024);
  size_t n = fread(rom, 1, 16 * 1024, fp);
  (void)n;
  fclose(fp);
  printf("Loaded ROM: %s\n", filename);
  resetEmul();
  return TRUE;
}
/* skriv til minnet */
void WrZ80 (register word addr, register byte value) {
  if (gfxIn && !(addr & 0x8000)) {
    if (gfxRam[addr] != value) {
      gfxRam[addr] = value;
      drawByte (addr);
    }
  }
  else if (romIn && !(addr & 0xc000)) {
    return;
  }
  else {
    ram[addr] = value;
  }
}
/* les fra minnet */
byte RdZ80 (register word addr) {
  if (gfxIn && !(addr & 0x8000)) {
    return gfxRam[addr];
  }
  if (romIn && !(addr & 0xc000)) {
    return rom[addr];
  }
  return ram[addr];
}
/* skriv til i/o-port */
void OutZ80 (register word port, register byte value) {
  static int lock = 0;
  static int gfx = 0;

  switch (port) {
    case 0x00:  /* tastatur */
    case 0x01:
    case 0x02:
    case 0x03:
      resetKeyboard();
      break;
    case 0x04:  /* serie A data */
      newSerAData (value);
      break;
    case 0x05:  /* serie B data */
      newSerBData (value);
      break;
    case 0x06:  /* serie A styreord */
      serAControl (value);
      break;
    case 0x07:  /* serie B styreord */
      serBControl (value);
      break;
    case 0x08:  /* parallell A data */
      newParAData (value);
      break;
    case 0x09:  /* parallell B data */
      newParBData (value);
      break;
    case 0x0a:  /* parallell A styreord */
      parAControl (value);
      break;
    case 0x0b:  /* parallell B styreord */
      parBControl (value);
      break;
    case 0x0c:  /* grafikk-modus */
    case 0x0d:
    case 0x0e:
    case 0x0f:
      newMode (value);
      break;
    case 0x10:  /* disk styreord */
      diskControl (value);
      break;
    case 0x11:  /* disk spornummer */
      newTrack (value);
      break;
    case 0x12:  /* disk sektorregister */
      newSector (value);
      break;
    case 0x13:  /* disk dataregister */
      newDiskData (value);
      break;
    case 0x14:  /* farge-register */
    case 0x15:
      newColor (value);
      break;
    case 0x16:  /* lyd-scroll peker */
      soundReg (value);
      break;
    case 0x17:  /* lyd-scroll data */
      soundData (value);
      break;
    case 0x18:  /* ctc kanal 0 */
      writeCtc0 (value);
      break;
    case 0x19:  /* ctc kanal 1 */
      writeCtc1 (value);
      break;
    case 0x1a:  /* ctc kanal 2 */
      writeCtc2 (value);
      break;
    case 0x1b:  /* ctc kanal 3 */
      writeCtc3 (value);
      break;
    case 0x1c:  /* system-register */
    case 0x1d:
    case 0x1e:
    case 0x1f:
      disk0 (value & 1);
      disk1 (value & 2);
      romIn = !(value & 4);
      gfxIn = value & 8;
      if (gfx != !(value & 32)) {
        grafikkLight (!(value & 32));
        gfx = !(value & 32);
      }
      diskMotor (value & 64);
      if (lock != !(value & 128)) {
        lockLight (!(value & 128));
        lock = !(value & 128);
      }
      break;
    case 0x20:  /* HDD data */
      hddWriteData(value);
      break;
    case 0x21:  /* HDD write precomp */
      hddWritePrecomp(value);
      break;
    case 0x22:  /* HDD sector count */
      hddWriteSectorCount(value);
      break;
    case 0x23:  /* HDD sector number */
      hddWriteSector(value);
      break;
    case 0x24:  /* HDD track lo */
      hddWriteTrackLo(value);
      break;
    case 0x25:  /* HDD track hi */
      hddWriteTrackHi(value);
      break;
    case 0x26:  /* HDD SDH */
      hddWriteSDH(value);
      break;
    case 0x27:  /* HDD command */
      hddWriteCommand(value);
      break;
  }
}
/* les fra i/o-port */
byte InZ80 (register word port) {
  switch (port) {
    case 0x00:  /* tastatur */
    case 0x01:
    case 0x02:
    case 0x03:
      return readKeyboard();
    case 0x04:  /* serie A data */
      return serAData();
    case 0x05:  /* serie B data */
      return serBData();
    case 0x06:  /* serie A status */
      return serAStatus();
    case 0x07:  /* serie B status */
      return serBStatus();
    case 0x08:  /* parallell A data */
      return parAData();
    case 0x09:  /* parallell B data */
      return parBData();
    case 0x0a:  /* parallell A status */
      return parAStatus();
    case 0x0b:  /* parallell B status */
      return parBStatus();
    case 0x10:  /* disk status */
      return diskStatus();
    case 0x11:  /* disk spornummer */
      return getTrack();
    case 0x12:  /* disk sektorregister */
      return getSector();
    case 0x13:  /* disk dataregister */
      return getDiskData();
    case 0x17:  /* lyd-scroll data */
      return getSoundData();
    case 0x18:  /* ctc kanal 0 */
      return readCtc0();
    case 0x19:  /* ctc kanal 1 */
      return readCtc1();
    case 0x1a:  /* ctc kanal 2 */
      return readCtc2();
    case 0x1b:  /* ctc kanal 3 */
      return readCtc3();
    case 0x20:  /* HDD data */
      return hddReadData();
    case 0x21:  /* HDD error register */
      return hddReadError();
    case 0x22:  /* HDD sector count */
      return hddReadSectorCount();
    case 0x23:  /* HDD sector number */
      return hddReadSector();
    case 0x24:  /* HDD track lo */
      return hddReadTrackLo();
    case 0x27:  /* HDD status */
      return hddReadStatus();
    default:
      return 0xff;
  }
}
