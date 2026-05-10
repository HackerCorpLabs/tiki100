/* menu.h
 *
 * F12 configuration menu for TIKI-100 emulator
 * Uses Nuklear immediate-mode UI with SDL_Renderer backend
 */

#ifndef MENU_H
#define MENU_H

#include <SDL2/SDL.h>

/* Initialize menu system - call after SDL window/renderer creation */
void menuInit(SDL_Window *win, SDL_Renderer *rend);

/* Shutdown menu system - call before SDL cleanup */
void menuShutdown(void);

/* Menu state */
int  menuIsOpen(void);
void menuOpen(void);
void menuClose(void);

/* Nuklear input bracketing - call begin before event loop, end after */
void menuBeginInput(void);
void menuEndInput(void);

/* Feed SDL events to the menu (call between beginInput/endInput) */
void menuHandleEvent(SDL_Event *event);

/* Build and render the menu UI overlay.
 * Call after endInput, between SDL_RenderClear and SDL_RenderPresent. */
void menuRender(void);

/* --- Action queries: return 1 if action pending, 0 otherwise --- */
/* After returning 1, the action is cleared. */

/* Floppy mount: sets drive (0=A, 1=B) and path.
 * If the drive is occupied, the caller should auto-eject first. */
int menuWantsMountFloppy(int *drive, char *path, int pathmax);

/* Floppy eject: sets drive (0=A, 1=B) */
int menuWantsEjectFloppy(int *drive);

/* HDD mount: sets drive (0 or 1) and path */
int menuWantsMountHDD(int *drive, char *path, int pathmax);

/* HDD eject: sets drive (0 or 1) */
int menuWantsEjectHDD(int *drive);

/* CPU speed change: sets speedIndex (0=0.5x, 1=1x, 2=2x, 3=4x, 4=full) */
int menuWantsSpeedChange(int *speedIndex);

/* Volume change: sets volume 0-100 */
int menuWantsVolumeChange(int *volume);

/* ROM change: sets path to new ROM file (triggers reset) */
int menuWantsROMChange(char *path, int pathmax);

/* Reboot: closes menu and resets the machine */
int menuWantsReboot(void);

/* Tell menu about current emulator state so it can show status */
void menuSetFloppyMounted(int drive, const char *filename);
void menuSetFloppyEjected(int drive);
void menuSetHDDMounted(int drive, const char *filename);
void menuSetHDDEjected(int drive);
void menuSetCPUSpeed(int speedIndex);
void menuSetVolume(int volume);

/* Serial port configuration.
 * channel: 0 = Serial B (DART port 0), 1 = Serial A (DART port 1).
 * mode:    0=Listen, 1=Connect, 2=Modem */
int  menuWantsSerialConfigure(int *channel, int *mode,
                              char *host, int hostmax, int *port);
void menuSetSerialConfig(int channel, int mode, const char *host, int port);

#endif
