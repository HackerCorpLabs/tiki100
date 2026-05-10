/* hdd.c
 *
 * WD1010 Hard Disk Controller emulation for TIKI-100
 *
 * Ported from RetroCore C# implementation by Ronny Hansen
 * Original: Emulated.HW.WesternDigital.HardDrive.WD1010.WD1010HDC
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 1985-2026 Ronny Hansen
 *
 * Commands:
 *   0x10 - RESTORE (seek to track 0)
 *   0x20 - READ SECTOR
 *   0x30 - WRITE SECTOR
 *
 * SDH register format:
 *   Bits 0-2: Head number (0-7)
 *   Bits 3-4: Drive number (0-3)
 *   Bits 5-6: Sector size (0=256, 1=512, 2=1024, 3=128)
 *   Bit 7:    Extended data field
 *
 * TIKI-100 specific: heads 0-1 map to physical drive 0,
 *                    heads 2-3 map to physical drive 1 (head-2)
 */

#include "hdd.h"
#include "TIKI-100_emul.h"
#include <stdio.h>
#include <string.h>

/* Command types */
enum hddCommand {
  HDC_CMD_NONE,
  HDC_CMD_RESTORE,
  HDC_CMD_READ_SECTOR,
  HDC_CMD_WRITE_SECTOR
};

/* Controller state */
static FILE *hddDisc[HDD_MAX_DISKS];

static byte hddDataBuf[HDD_SECTOR_SIZE];
static unsigned short hddDataPtr;
static enum hddCommand hddActiveCmd;

/* Registers */
static byte hddTrackLo;
static byte hddTrackHi;
static byte hddSectorReg;
static byte hddSectorCount;
static byte hddSDH;
static byte hddCommandReg;
static byte hddPrecomp;

/* Status bits */
static int hddBusy;
static int hddReady;
static int hddDRQ;
static int hddSeekComplete;

/* Physical drive selected by offset calculation */
static int hddPhysDrive;

/*****************************************************************************/

void hddInit(void) {
  int i;
  for (i = 0; i < HDD_MAX_DISKS; i++) {
    hddDisc[i] = NULL;
  }
  hddDataPtr = 0;
  hddActiveCmd = HDC_CMD_NONE;
  hddTrackLo = 0;
  hddTrackHi = 0;
  hddSectorReg = 0;
  hddSectorCount = 0;
  hddSDH = 0;
  hddCommandReg = 0;
  hddPrecomp = 0;
  hddBusy = 0;
  hddReady = 1;
  hddDRQ = 0;
  hddSeekComplete = 0;
  hddPhysDrive = 0;

  /* Initialize data buffer with pattern */
  for (i = 0; i < HDD_SECTOR_SIZE; i++) {
    hddDataBuf[i] = (byte)i;
  }
}

void hddReset(void) {
  hddDataPtr = 0;
  hddActiveCmd = HDC_CMD_NONE;
  hddTrackLo = 0;
  hddTrackHi = 0;
  hddSectorReg = 0;
  hddSectorCount = 0;
  hddSDH = 0;
  hddCommandReg = 0;
  hddBusy = 0;
  hddReady = 1;
  hddDRQ = 0;
  hddSeekComplete = 0;
}

int hddMountImage(int diskNo, const char *filename) {
  if (diskNo < 0 || diskNo >= HDD_MAX_DISKS) return -1;
  if (!filename) return -1;

  /* Close existing image */
  if (hddDisc[diskNo]) {
    fclose(hddDisc[diskNo]);
    hddDisc[diskNo] = NULL;
  }

  hddDisc[diskNo] = fopen(filename, "r+b");
  if (!hddDisc[diskNo]) {
    /* Try read-only */
    hddDisc[diskNo] = fopen(filename, "rb");
  }
  if (!hddDisc[diskNo]) {
    fprintf(stderr, "HDD: Cannot open image: %s\n", filename);
    return -1;
  }

  printf("HDD: Mounted drive %d: %s\n", diskNo, filename);
  return 0;
}

void hddUnmountImage(int diskNo) {
  if (diskNo < 0 || diskNo >= HDD_MAX_DISKS) return;
  if (hddDisc[diskNo]) {
    fclose(hddDisc[diskNo]);
    hddDisc[diskNo] = NULL;
  }
}

/*****************************************************************************/
/* Drive-present check                                                       */
/*****************************************************************************/

/* Is the drive currently addressed by the SDH register actually mounted?
 *
 * Used by the port read/write functions below so the controller behaves
 * like "the WD1010 chip isn't installed" when no image is mounted on the
 * selected drive. On real TIKI-100 hardware, reading any WD1010 port with
 * no chip / no drive present returns 0xFF (bus floats high because nothing
 * drives the data bus). The TIKI-100 BIOS probe relies on this: it writes
 * the sector number to port 0x23 and reads it back; if the readback isn't
 * what it wrote, the probe bails out cleanly.
 *
 * Without this check, an unmounted drive still returns READY=1 from the
 * status register and echoes back written task-file register values, so
 * the probe succeeds, the BIOS issues READ SECTOR, and then jumps into
 * garbage data trying to execute a non-existent boot sector.
 */
static int hddSelectedDriveMounted(void) {
  int head  = hddSDH & 0x07;
  int drive = (head >= 2) ? 1 : 0;
  return (drive >= 0 && drive < HDD_MAX_DISKS && hddDisc[drive] != NULL);
}

/*****************************************************************************/
/* Offset calculation - TIKI-100 specific                                    */
/*****************************************************************************/

static long hddCalcOffset(void) {
  int headNo = hddSDH & 0x07;
  int cylinderOffset = (hddTrackHi << 8) | hddTrackLo;
  int sectorZero = hddSectorReg;
  long offset;

  if (sectorZero > 0) sectorZero--; /* sectors are 0-based in the file */

  /* TIKI-100 specific: heads 0-1 = physical drive 0, heads 2-3 = drive 1 */
  hddPhysDrive = 0;
  if (headNo < 2) {
    offset = (long)cylinderOffset * 0x4000L
           + (long)headNo * 0x2000L
           + (long)sectorZero * 0x200L;
  } else {
    hddPhysDrive = 1;
    headNo -= 2;
    offset = (long)cylinderOffset * 0x4000L
           + (long)headNo * 0x2000L
           + (long)sectorZero * 0x200L;
  }

  return offset;
}

static int hddReadFromDisc(void) {
  long offset;
  FILE *fp;

  if (hddActiveCmd != HDC_CMD_READ_SECTOR) return 0;

  hddReady = 0;
  offset = hddCalcOffset();

  if (hddPhysDrive >= HDD_MAX_DISKS) return 0;
  fp = hddDisc[hddPhysDrive];
  if (!fp) return 0;

  if (fseek(fp, offset, SEEK_SET) != 0) return 0;
  if (fread(hddDataBuf, 1, HDD_SECTOR_SIZE, fp) != HDD_SECTOR_SIZE) return 0;

  hddReady = 1;
  return 1;
}

static int hddWriteToDisc(void) {
  long offset;
  FILE *fp;

  if (hddActiveCmd != HDC_CMD_WRITE_SECTOR) return 0;

  offset = hddCalcOffset();

  if (hddPhysDrive >= HDD_MAX_DISKS) return 0;
  fp = hddDisc[hddPhysDrive];
  if (!fp) return 0;

  if (fseek(fp, offset, SEEK_SET) != 0) return 0;
  if (fwrite(hddDataBuf, 1, HDD_SECTOR_SIZE, fp) != HDD_SECTOR_SIZE) return 0;
  fflush(fp);

  return 1;
}

/*****************************************************************************/
/* Command execution                                                         */
/*****************************************************************************/

static void hddExecute(void) {
  hddReady = 1;

  switch (hddCommandReg) {
    case 0x10: /* RESTORE - seek to track 0 */
      hddActiveCmd = HDC_CMD_RESTORE;
      hddTrackLo = 0;
      hddSectorReg = 0;
      hddDataPtr = 0;
      hddSeekComplete = 0;
      hddDRQ = 0;
      break;

    case 0x20: /* READ SECTOR */
      hddActiveCmd = HDC_CMD_READ_SECTOR;

      if (hddTrackLo > HDD_MAX_TRACKS) {
        hddActiveCmd = HDC_CMD_NONE;
        return;
      }
      if (hddSectorReg > HDD_MAX_SECTORS) {
        hddActiveCmd = HDC_CMD_NONE;
        return;
      }

      if (hddReadFromDisc()) {
        hddDataPtr = 0;
        hddSeekComplete = 1;
        hddDRQ = 1; /* data ready */
        hddLight(hddPhysDrive, TRUE);
      } else {
        hddActiveCmd = HDC_CMD_NONE;
      }
      break;

    case 0x30: /* WRITE SECTOR */
      hddActiveCmd = HDC_CMD_WRITE_SECTOR;
      hddDataPtr = 0;
      hddSeekComplete = 1;
      hddDRQ = 1; /* ready to accept data */
      hddLight((hddSDH & 0x07) >= 2 ? 1 : 0, TRUE);
      break;

    default:
      break;
  }
}

/*****************************************************************************/
/* Port 0x20-0x23: Data register block                                       */
/*****************************************************************************/

void hddWriteData(byte value) {
  if (hddDataPtr < HDD_SECTOR_SIZE) {
    hddDataBuf[hddDataPtr] = value;
    hddDataPtr++;
    if (hddDataPtr >= HDD_SECTOR_SIZE) {
      hddDRQ = 0;
      if (!hddWriteToDisc()) {
        hddReady = 0;
      }
      hddActiveCmd = HDC_CMD_NONE;
    }
  }
}

byte hddReadData(void) {
  byte retval = 0x00;
  if (!hddSelectedDriveMounted()) return 0xff;
  if (hddDataPtr < HDD_SECTOR_SIZE) {
    retval = hddDataBuf[hddDataPtr];
    hddDataPtr++;
    if (hddDataPtr >= HDD_SECTOR_SIZE) {
      hddDRQ = 0;
      hddActiveCmd = HDC_CMD_NONE;
    }
  }
  return retval;
}

void hddWritePrecomp(byte value)     { hddPrecomp = value; }
void hddWriteSectorCount(byte value) { hddSectorCount = value; }
void hddWriteSector(byte value)      { hddSectorReg = value; }

byte hddReadError(void)       { return hddSelectedDriveMounted() ? 0x00 : 0xff; }
byte hddReadSectorCount(void) { return hddSelectedDriveMounted() ? hddSectorCount : 0xff; }
byte hddReadSector(void)      { return hddSelectedDriveMounted() ? hddSectorReg   : 0xff; }

/*****************************************************************************/
/* Port 0x24-0x27: Control register block                                    */
/*****************************************************************************/

void hddWriteTrackLo(byte value)  { hddTrackLo = value; }
void hddWriteTrackHi(byte value)  { hddTrackHi = value; }
void hddWriteSDH(byte value)      { hddSDH = value; }

void hddWriteCommand(byte value) {
  hddCommandReg = value;
  /* If the selected drive has no image mounted, behave like the WD1010
   * chip isn't present: ignore the command entirely, leave internal
   * state machine idle, so subsequent status/register reads keep
   * returning 0xFF and the BIOS probe bails out. */
  if (!hddSelectedDriveMounted()) {
    hddActiveCmd    = HDC_CMD_NONE;
    hddDRQ          = 0;
    hddSeekComplete = 0;
    return;
  }
  hddExecute();
}

byte hddReadTrackLo(void) {
  return hddSelectedDriveMounted() ? hddTrackLo : 0xff;
}

byte hddReadStatus(void) {
  byte retval = 0;
  /* No chip/drive at the selected slot -> bus floats high. This makes
   * the BIOS probe bail out at the sector-register readback check
   * before it issues any actual commands. */
  if (!hddSelectedDriveMounted()) return 0xff;
  if (hddBusy)        retval |= 0x80;
  if (hddReady)       retval |= 0x40;
  if (hddSeekComplete) retval |= 0x10;
  if (hddDRQ)         retval |= 0x08;
  return retval;
}
