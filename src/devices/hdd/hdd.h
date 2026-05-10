/* hdd.h
 *
 * WD1010 Hard Disk Controller emulation for TIKI-100
 *
 * Ported from RetroCore C# implementation by Ronny Hansen
 * Original: Emulated.HW.WesternDigital.HardDrive.WD1010.WD1010HDC
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 1985-2026 Ronny Hansen
 *
 * The TIKI-100 WD1010 interface uses I/O ports 0x20-0x27:
 *   0x20-0x23: Data port block (data, error/precomp, sector count, sector number)
 *   0x24-0x27: Control block (track lo, track hi, SDH, command/status)
 */

#ifndef HDD_H
#define HDD_H

#include "Z80.h"

#define HDD_SECTOR_SIZE     512
#define HDD_MAX_TRACKS      256
#define HDD_MAX_SECTORS     16
#define HDD_MAX_HEADS       4
#define HDD_MAX_DISKS       4

/* Initialize hard disk controller */
void hddInit(void);

/* Reset hard disk controller */
void hddReset(void);

/* Mount a disk image file as hard disk unit
 * diskNo: drive number 0-3
 * filename: path to disk image file
 * Returns: 0 on success, -1 on error
 */
int hddMountImage(int diskNo, const char *filename);

/* Unmount hard disk image */
void hddUnmountImage(int diskNo);

/* --- Port 0x20-0x23: Data register block --- */

/* Write to data port block */
void hddWriteData(byte value);       /* port 0x20 */
void hddWritePrecomp(byte value);    /* port 0x21 */
void hddWriteSectorCount(byte value);/* port 0x22 */
void hddWriteSector(byte value);     /* port 0x23 */

/* Read from data port block */
byte hddReadData(void);              /* port 0x20 */
byte hddReadError(void);             /* port 0x21 */
byte hddReadSectorCount(void);       /* port 0x22 */
byte hddReadSector(void);            /* port 0x23 */

/* --- Port 0x24-0x27: Control register block --- */

/* Write to control block */
void hddWriteTrackLo(byte value);    /* port 0x24 */
void hddWriteTrackHi(byte value);    /* port 0x25 */
void hddWriteSDH(byte value);        /* port 0x26 */
void hddWriteCommand(byte value);    /* port 0x27 - triggers command execution */

/* Read from control block */
byte hddReadTrackLo(void);           /* port 0x24 */
byte hddReadStatus(void);            /* port 0x27 */

#endif
