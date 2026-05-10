/* protos.h V1.1.0
 *
 * Prototyper for funksjoner som kun skal brukes av den systemuavhengige koden. 
 * Resten av prototypene er i TIKI-100_emul.h
 * Copyright (C) Asbj�rn Djupdal 2000-2001
 */

#ifndef PROTOS_H
#define PROTOS_H

/*****************************************************************************/
/* ctc.c                                                                     */
/*****************************************************************************/

/* skriv til ctc-kontrollregister */
void writeCtc0 (byte value);
void writeCtc1 (byte value);
void writeCtc2 (byte value);
void writeCtc3 (byte value);
/* les ctc-register */
byte readCtc0 (void);
byte readCtc1 (void);
byte readCtc2 (void);
byte readCtc3 (void);
/* m� kalles regelmessig for � oppdatere tellere og sjekke om interrupt skal genereres */
void updateCTC (int cycles);
/* returnerer antall sykler mellom hver ut puls p� gitt ctc-kanal */
int getCtc (int c);

/*****************************************************************************/
/* disk.c                                                                    */
/*****************************************************************************/

/* skriv til disk-register */
void diskControl (byte value);
void newTrack (byte value);
void newSector (byte value);
void newDiskData (byte value);
/* les disk-register */
byte diskStatus (void);
byte getTrack (void);
byte getSector (void);
byte getDiskData (void);
/* sett stasjon aktiv / inaktiv */
void disk0 (boolean status);
void disk1 (boolean status);
/* skru motor p� / av */
void diskMotor (boolean status);

/*****************************************************************************/
/* keyboard.c                                                                */
/*****************************************************************************/

/* skriv til tastatur-register */
void resetKeyboard (void);
/* les tastatur-register */
byte readKeyboard (void);

/*****************************************************************************/
/* mem.c                                                                     */
/*****************************************************************************/

/* m� kalles f�r emulering starter */
int initMem();
/* load a new ROM file and reset the machine */
int loadROM(const char *filename);

/*****************************************************************************/
/* sound.c / ay3_8912.c                                                      */
/*****************************************************************************/

/* initialize sound chip (call before runEmul) */
void soundInit(int cpu_freq, int sample_rate);
/* write to register select (port 0x16) */
void soundReg (byte value);
/* write to data register (port 0x17) */
void soundData (byte value);
/* read data register (port 0x17) */
byte getSoundData (void);

/*****************************************************************************/
/* hdd.c - WD1010 hard disk controller                                       */
/*****************************************************************************/

void hddInit(void);
void hddReset(void);
int hddMountImage(int diskNo, const char *filename);
void hddUnmountImage(int diskNo);
/* port 0x20-0x23: data register block */
void hddWriteData(byte value);
void hddWritePrecomp(byte value);
void hddWriteSectorCount(byte value);
void hddWriteSector(byte value);
byte hddReadData(void);
byte hddReadError(void);
byte hddReadSectorCount(void);
byte hddReadSector(void);
/* port 0x24-0x27: control register block */
void hddWriteTrackLo(byte value);
void hddWriteTrackHi(byte value);
void hddWriteSDH(byte value);
void hddWriteCommand(byte value);
byte hddReadTrackLo(void);
byte hddReadStatus(void);

/*****************************************************************************/
/* video.c                                                                   */
/*****************************************************************************/

/* tegn gitt byte i grafikkminne til skjerm */
void drawByte (word addr);
/* skriv til grafikk-sregister */
void newMode (byte mode);
void newColor (byte color);
/* ny offset (dvs scroll) */
void newOffset (byte newOffset);

/*****************************************************************************/
/* serial.c                                                                  */
/*****************************************************************************/

/* skriv til data-register */
void newSerAData (byte value);
void newSerBData (byte value);
/* skriv til kontroll-register */
void serAControl (byte value);
void serBControl (byte value);
/* les data-register */
byte serAData (void);
byte serBData (void);
/* les status-register */
byte serAStatus (void);
byte serBStatus (void);
/* rekalkuler buad-rate (nye ctc-verdier) */
void recalcBaud (void);

/*****************************************************************************/
/* parallel.c                                                                */
/*****************************************************************************/

/* skriv til data-register */
void newParAData (byte value);
void newParBData (byte value);
/* skriv til kontroll-register */
void parAControl (byte value);
void parBControl (byte value);
/* les data-register */
byte parAData (void);
byte parBData (void);
/* les status-register */
byte parAStatus (void);
byte parBStatus (void);

#endif
