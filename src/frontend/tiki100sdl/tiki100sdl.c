/* tiki100sdl.c V0.1.0
 *
 * SDL2 frontend for TIKI-100 emulator
 * Based on the original unix.c X11 frontend
 * Original emulator Copyright (C) Asbjorn Djupdal 2000-2001
 *
 * This SDL2 frontend replaces the X11, Win32, and Amiga
 * platform-specific code with a single cross-platform
 * implementation using SDL2. Supports Linux, Raspberry Pi,
 * and Windows.
 */

#include "TIKI-100_emul.h"
#include "protos.h"
#include "ay3_8912.h"
#include "menu.h"
#include "icon_data.h"
#include "serial_net.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <SDL2/SDL.h>

#define STATUSBAR_HEIGHT 24
#define AUDIO_SAMPLE_RATE 44100
#define AUDIO_BUFFER_SIZE 1024
#define TIKI_CPU_FREQ     4000000
#define DEFAULT_SCALE    1

/* Fixed window dimensions - same size regardless of emulated resolution.
 * HIGHRES is 1024x256, MEDRES 512x256, LOWRES 256x256.
 * We use 1024x512 as the logical output (2:1 aspect correction on the
 * 256-line display). The internal framebuffer matches the emulated
 * resolution, and SDL scales it to fill the fixed output area.
 */
#define WINDOW_W 1024
#define WINDOW_H  512

/* SDL state */
static SDL_Window   *window   = NULL;
static SDL_Renderer *renderer = NULL;
static SDL_Texture  *screen_tex = NULL;
static Uint32       *framebuffer = NULL;
static int fb_width  = 512;
static int fb_height = 256;
static int scale = DEFAULT_SCALE;

/* Palette: 16 colors max */
static Uint32 palette[16];

/* Keyboard state */
static byte pressedKeys[256];

/* Disk images */
static byte *dsk[2] = {NULL, NULL};
static int dsksize[2] = {0, 0};

/* Status indicators */
static boolean lockOn = FALSE;
static boolean grafikkOn = FALSE;
static boolean diskOn[2] = {FALSE, FALSE};
static boolean hddOn[2]  = {FALSE, FALSE};
static int     hddLightTimer[2] = {0, 0};  /* loopEmul ticks remaining */
#define HDD_LIGHT_TICKS 4                  /* ~80ms minimum visible flash */

/* Timing - speed limiting ON by default for correct sound/emulation.
 * The Z80 runs at 4 MHz. LoopZ80 fires every 4000 cycles (1ms).
 * loopEmul(20) is called every 20ms. We pace real time to match.
 * Speed indices: 0=0.5x, 1=1x(normal), 2=2x, 3=4x, 4=full(unthrottled) */
static int speedIndex = 1;
static const float speedMultipliers[5] = {0.5f, 1.0f, 2.0f, 4.0f, 0.0f};

/* High-resolution accumulator pacer.
 *
 * We compute a target "deadline" in SDL performance-counter units that
 * advances by exactly (emulated_ms / multiplier) every loopEmul call.
 * Each iteration sleeps until that deadline. Drift cannot accumulate
 * because the deadline never depends on when we actually wake — only
 * on how much emulated time has elapsed.
 *
 * If we fall more than RESYNC_THRESHOLD behind (debugger pause, menu
 * open, OS hiccup, suspend/resume), we snap the deadline to "now" so
 * we don't try to run at lightspeed to catch up. */
static Uint64 perfFreq = 0;          /* SDL_GetPerformanceFrequency() */
static Uint64 nextDeadline = 0;      /* target wake time in perf-counter units */
#define RESYNC_THRESHOLD_MS 100

/* Running flag */
static boolean running = TRUE;

/* Hybrid sleep-then-spin until the given perf-counter deadline.
 * Coarse sleep gets us within ~1ms, then a tight spin nails the last bit. */
static void preciseSleepUntil(Uint64 deadline) {
  Uint64 now = SDL_GetPerformanceCounter();
  if (deadline <= now) return;
  Uint64 remain = deadline - now;
  /* Convert to ms, subtract 1ms safety margin for the spin */
  Sint64 sleepMs = (Sint64)((remain * 1000) / perfFreq) - 1;
  if (sleepMs > 0) SDL_Delay((Uint32)sleepMs);
  /* Tight spin for sub-millisecond precision */
  while (SDL_GetPerformanceCounter() < deadline) {
    /* spin */
  }
}

/* Audio */
static SDL_AudioDeviceID audioDevice = 0;

/* SDL audio callback - pulls samples from AY ring buffer (filled by CPU thread) */
static void audioCallback(void *userdata, Uint8 *stream, int len) {
  int frames = len / (2 * sizeof(float)); /* stereo float */
  (void)userdata;
  ayFillAudioBuffer((float *)stream, frames);
}

/* Forward declarations */
static void readDiskImage(int drive, const char *filename);
static byte sdlKeyToTikiKey(SDL_Keycode key);
static byte sdlScancodeToTikiKey(SDL_Scancode sc);
static void renderStatusBar(void);
static void updateScreen(void);
static void processEvents(void);
static void handleWindowEvent(const SDL_Event *ev);

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

  /* Recreate texture for new resolution */
  if (screen_tex) {
    SDL_DestroyTexture(screen_tex);
  }
  screen_tex = SDL_CreateTexture(renderer,
    SDL_PIXELFORMAT_ARGB8888, SDL_TEXTUREACCESS_STREAMING,
    fb_width, fb_height);

  /* Reallocate framebuffer */
  free(framebuffer);
  framebuffer = (Uint32 *)calloc(fb_width * fb_height, sizeof(Uint32));

  /* Fill with color 0 */
  if (framebuffer) {
    int i;
    for (i = 0; i < fb_width * fb_height; i++) {
      framebuffer[i] = palette[0];
    }
  }
}

void plotPixel(int x, int y, int color) {
  if (framebuffer && x >= 0 && x < fb_width && y >= 0 && y < fb_height) {
    framebuffer[y * fb_width + x] = palette[color & 0x0f];
  }
}

void scrollScreen(int distance) {
  if (!framebuffer) return;

  if (distance > 0 && distance < fb_height) {
    /* Scroll up */
    memmove(framebuffer,
            framebuffer + distance * fb_width,
            (fb_height - distance) * fb_width * sizeof(Uint32));
    memset(framebuffer + (fb_height - distance) * fb_width, 0,
           distance * fb_width * sizeof(Uint32));
  } else if (distance < 0 && -distance < fb_height) {
    /* Scroll down */
    int d = -distance;
    memmove(framebuffer + d * fb_width,
            framebuffer,
            (fb_height - d) * fb_width * sizeof(Uint32));
    memset(framebuffer, 0, d * fb_width * sizeof(Uint32));
  }
}

void changePalette(int colornumber, byte red, byte green, byte blue) {
  if (colornumber >= 0 && colornumber < 16) {
    palette[colornumber] = 0xFF000000 | (red << 16) | (green << 8) | blue;
  }

  /* Refresh all pixels with this color - handled by emulator core
   * calling drawByte for affected memory */
}

/* Process pending menu actions (mount/eject/speed) - one action per call */
static void handleMenuActions(void) {
  int drive, speed, vol;
  char path[512];

  if (menuWantsMountFloppy(&drive, path, sizeof(path))) {
    if (drive >= 0 && drive <= 1 && path[0] != '\0') {
      /* Auto-eject if drive is occupied (swap-on-mount) */
      if (dsk[drive]) {
        printf("Menu: Auto-ejecting FD%d for swap\n", drive);
        removeDisk(drive);
        free(dsk[drive]);
        dsk[drive] = NULL;
      }
      printf("Menu: Mounting FD%d: %s\n", drive, path);
      readDiskImage(drive, path);
      menuSetFloppyMounted(drive, path);
    }
    return; /* one action per frame */
  }
  if (menuWantsEjectFloppy(&drive)) {
    if (drive >= 0 && drive <= 1) {
      printf("Menu: Ejecting FD%d\n", drive);
      removeDisk(drive);
      if (dsk[drive]) { free(dsk[drive]); dsk[drive] = NULL; }
      menuSetFloppyEjected(drive);
    }
    return;
  }
  if (menuWantsMountHDD(&drive, path, sizeof(path))) {
    if (drive >= 0 && drive <= 1 && path[0] != '\0') {
      hddMountImage(drive, path);
      menuSetHDDMounted(drive, path);
    }
    return;
  }
  if (menuWantsEjectHDD(&drive)) {
    if (drive >= 0 && drive <= 1) {
      hddUnmountImage(drive);
      menuSetHDDEjected(drive);
    }
    return;
  }
  if (menuWantsSpeedChange(&speed)) {
    static const char *speedNames[5] = {"0.5x (2 MHz)", "1x (4 MHz)", "2x (8 MHz)", "4x (16 MHz)", "FULL SPEED"};
    if (speed < 0) speed = 0;
    if (speed > 4) speed = 4;
    speedIndex = speed;
    printf("CPU speed changed: %s\n", speedNames[speed]);
    return;
  }
  if (menuWantsVolumeChange(&vol)) {
    if (vol >= 0 && vol <= 100) {
      aySetVolume((float)vol / 100.0f);
    }
    return;
  }
  if (menuWantsROMChange(path, sizeof(path))) {
    if (path[0] != '\0') {
      loadROM(path);
    }
    return;
  }
  if (menuWantsReboot()) {
    menuClose();
    resetEmul();
    return;
  }
  {
    int ch, mode, port;
    char host[256];
    if (menuWantsSerialConfigure(&ch, &mode, host, sizeof(host), &port)) {
      serialnet_configure(ch, (SerNetMode)mode, host, port);
      menuSetSerialConfig(ch, mode, host, port);
      return;
    }
  }
}

void loopEmul(int ms) {
  /* Tick HDD LED timers — keeps the LED visible across multiple frames */
  {
    int d;
    for (d = 0; d < 2; d++) {
      if (hddLightTimer[d] > 0) {
        if (--hddLightTimer[d] == 0) hddOn[d] = FALSE;
      }
    }
  }

  /* Deliver pending RX bytes from serial worker threads to the DART.
   * charAvailable() must run on the emulation thread (touches DART state
   * and may call IntZ80), so the worker thread only sets charReadyCnt. */
  {
    int ch;
    for (ch = 0; ch < 2; ch++) {
      if (serialnet_has_data(ch)) charAvailable(ch);
    }
  }

  processEvents();

  /* F12 menu pause loop */
  if (menuIsOpen()) {
    while (menuIsOpen()) {
      SDL_Event ev;
      menuBeginInput();
      while (SDL_PollEvent(&ev)) {
        handleWindowEvent(&ev);
        if (ev.type == SDL_QUIT) { quitEmul(); return; }
        if (ev.type == SDL_KEYDOWN && ev.key.keysym.sym == SDLK_F12) {
          menuClose();
          break;
        }
        if (ev.type == SDL_KEYDOWN && ev.key.keysym.sym == SDLK_ESCAPE) {
          menuClose();
          break;
        }
        menuHandleEvent(&ev);
      }
      menuEndInput();

      handleMenuActions();

      /* Render frozen emulator screen + menu overlay */
      SDL_RenderClear(renderer);
      if (screen_tex && framebuffer) {
        SDL_UpdateTexture(screen_tex, NULL, framebuffer, fb_width * sizeof(Uint32));
        SDL_Rect dst = {0, 0, WINDOW_W, WINDOW_H};
        SDL_RenderCopy(renderer, screen_tex, NULL, &dst);
      }
      renderStatusBar();
      menuRender();
      SDL_RenderPresent(renderer);
      SDL_Delay(16);
    }
    /* Menu paused emulation for an unknown duration — resync the
     * deadline so we don't try to catch up the lost wall-clock time. */
    nextDeadline = SDL_GetPerformanceCounter();
    return;
  }

  if (speedIndex < 4) {
    /* Paced mode: high-resolution accumulator.
     * Advance the deadline by exactly (ms / multiplier) of wall-clock,
     * then sleep until that deadline. Drift cannot accumulate because
     * the deadline is independent of actual wake times. */
    float mult = speedMultipliers[speedIndex];
    if (mult > 0.0f) {
      double targetSec = (double)ms / (1000.0 * (double)mult);
      Uint64 advance = (Uint64)(targetSec * (double)perfFreq + 0.5);
      nextDeadline += advance;

      Uint64 now = SDL_GetPerformanceCounter();
      /* If we've fallen more than RESYNC_THRESHOLD_MS behind (paused,
       * suspended, debugger), snap forward to avoid lightspeed catch-up. */
      Uint64 threshold = (perfFreq * RESYNC_THRESHOLD_MS) / 1000;
      if (now > nextDeadline + threshold) {
        nextDeadline = now;
      } else {
        preciseSleepUntil(nextDeadline);
      }
    }
    updateScreen();
  } else {
    /* Full speed (index 4): only update screen every 10th call (~5fps)
     * to avoid vsync blocking the CPU */
    static int skipCount = 0;
    if (++skipCount >= 10) {
      skipCount = 0;
      updateScreen();
    }
  }
}

void lockLight(boolean status) {
  lockOn = status;
}

void grafikkLight(boolean status) {
  grafikkOn = status;
}

void diskLight(int drive, boolean status) {
  if (drive >= 0 && drive < 2) {
    diskOn[drive] = status;
  }
}

void hddLight(int drive, boolean status) {
  if (drive >= 0 && drive < 2 && status) {
    hddOn[drive] = TRUE;
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
  /* TCP transport ignores baud/format — no-op */
  (void)p1;
  (void)p2;
}

void sendChar(int port, byte value) {
  serialnet_send(port, (uint8_t)value);
}

byte getChar(int port) {
  int v = serialnet_recv(port);
  if (v < 0) return 0;
  /* If more bytes are queued, re-arm rxa immediately so the CPU polling
   * loop reads the next byte in the same burst instead of waiting 20ms */
  if (serialnet_has_data(port))
    charAvailable(port);
  return (byte)v;
}

void printChar(byte value) {
  /* TODO: implement printer output */
  (void)value;
}

/* charAvailable() and setST28b() are implemented in serial.c */

/*****************************************************************************/
/* Internal functions                                                        */
/*****************************************************************************/

/* Re-apply renderer logical-size mapping after window state changes.
 * SDL on Windows can leave the renderer's internal viewport stale after a
 * maximize/restore, which breaks SDL_RenderWindowToLogical (mouse coords
 * stop matching what's drawn). Re-applying the logical size kicks SDL to
 * recompute the scale and letterbox offset. */
static void handleWindowEvent(const SDL_Event *ev) {
  if (ev->type != SDL_WINDOWEVENT) return;
  switch (ev->window.event) {
    case SDL_WINDOWEVENT_SIZE_CHANGED:
    case SDL_WINDOWEVENT_RESIZED:
    case SDL_WINDOWEVENT_MAXIMIZED:
    case SDL_WINDOWEVENT_RESTORED:
    case SDL_WINDOWEVENT_EXPOSED:
      SDL_RenderSetLogicalSize(renderer, WINDOW_W, WINDOW_H + STATUSBAR_HEIGHT);
      break;
  }
}

static void processEvents(void) {
  SDL_Event event;

  while (SDL_PollEvent(&event)) {
    handleWindowEvent(&event);

    switch (event.type) {
      case SDL_QUIT:
        quitEmul();
        running = FALSE;
        break;

      case SDL_KEYDOWN: {
        if (event.key.keysym.sym == SDLK_F12) {
          menuOpen();
          return;
        }
        /* ALT+Enter toggles fullscreen */
        if (event.key.keysym.sym == SDLK_RETURN &&
            (event.key.keysym.mod & KMOD_ALT)) {
          Uint32 flags = SDL_GetWindowFlags(window);
          if (flags & SDL_WINDOW_FULLSCREEN_DESKTOP) {
            SDL_SetWindowFullscreen(window, 0);
          } else {
            SDL_SetWindowFullscreen(window, SDL_WINDOW_FULLSCREEN_DESKTOP);
          }
          break;
        }
        /* ESC → simulate CTRL+Æ, which the TIKI-100 ROM maps to ESC (0x1B).
         * The real keyboard had no ESC key; the manual documents CTRL+Æ = ESC. */
        if (event.key.keysym.sym == SDLK_ESCAPE) {
          pressedKeys[KEY_CTRL] = 1;
          pressedKeys[0xe6]     = 1;  /* Æ */
          break;
        }
        byte tkey = sdlKeyToTikiKey(event.key.keysym.sym);
        if (tkey == KEY_NONE) {
          /* Keycode failed (e.g. Ctrl+ø) - try scancode */
          tkey = sdlScancodeToTikiKey(event.key.keysym.scancode);
        }
        if (tkey != KEY_NONE) {
          pressedKeys[tkey] = 1;
        }
        break;
      }

      case SDL_KEYUP: {
        if (event.key.keysym.sym == SDLK_ESCAPE) {
          pressedKeys[0xe6] = 0;
          /* Release synthetic CTRL only if no real Ctrl key is still held */
          if (!(event.key.keysym.mod & KMOD_CTRL))
            pressedKeys[KEY_CTRL] = 0;
          break;
        }
        byte tkey = sdlKeyToTikiKey(event.key.keysym.sym);
        if (tkey == KEY_NONE) {
          tkey = sdlScancodeToTikiKey(event.key.keysym.scancode);
        }
        if (tkey != KEY_NONE) {
          pressedKeys[tkey] = 0;
        }
        break;
      }
    }
  }
}

static void updateScreen(void) {
  if (!screen_tex || !framebuffer) return;

  SDL_UpdateTexture(screen_tex, NULL, framebuffer, fb_width * sizeof(Uint32));

  SDL_RenderClear(renderer);

  /* Always render to fixed output area - SDL stretches the texture
   * from the emulated resolution to fill WINDOW_W x WINDOW_H */
  SDL_Rect dst;
  dst.x = 0;
  dst.y = 0;
  dst.w = WINDOW_W;
  dst.h = WINDOW_H;
  SDL_RenderCopy(renderer, screen_tex, NULL, &dst);

  renderStatusBar();

  SDL_RenderPresent(renderer);
}

/* Minimal 4×7 pixel bitmap font for status bar labels */
/* Each glyph is 7 rows of 4 bits, MSB = leftmost pixel */
static const uint8_t font4x7_P[7] = { 0xE0, 0x90, 0x90, 0xE0, 0x80, 0x80, 0x80 };
static const uint8_t font4x7_1[7] = { 0x60, 0x20, 0x20, 0x20, 0x20, 0x20, 0x70 };
static const uint8_t font4x7_2[7] = { 0xE0, 0x10, 0x10, 0x60, 0x80, 0x80, 0xF0 };
static const uint8_t font4x7_F[7] = { 0xF0, 0x80, 0xE0, 0x80, 0x80, 0x80, 0x80 };
static const uint8_t font4x7_D[7] = { 0xE0, 0x90, 0x90, 0x90, 0x90, 0x90, 0xE0 };
static const uint8_t font4x7_H[7] = { 0x90, 0x90, 0x90, 0xF0, 0x90, 0x90, 0x90 };
static const uint8_t font4x7_0[7] = { 0x60, 0x90, 0x90, 0x90, 0x90, 0x90, 0x60 };
static const uint8_t font4x7_L[7] = { 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0xF0 };
static const uint8_t font4x7_O[7] = { 0x60, 0x90, 0x90, 0x90, 0x90, 0x90, 0x60 };
static const uint8_t font4x7_C[7] = { 0x70, 0x80, 0x80, 0x80, 0x80, 0x80, 0x70 };
static const uint8_t font4x7_K[7] = { 0x90, 0xA0, 0xC0, 0xA0, 0xA0, 0x90, 0x90 };
static const uint8_t font4x7_G[7] = { 0x60, 0x90, 0x80, 0xB0, 0x90, 0x90, 0x60 };
static const uint8_t font4x7_X[7] = { 0x90, 0x90, 0x60, 0x60, 0x60, 0x90, 0x90 };

static void drawGlyph(int x, int y, const uint8_t *glyph, Uint8 r, Uint8 g, Uint8 b) {
  SDL_SetRenderDrawColor(renderer, r, g, b, 255);
  for (int row = 0; row < 7; row++) {
    for (int col = 0; col < 4; col++) {
      if (glyph[row] & (0x80 >> col)) {
        SDL_RenderDrawPoint(renderer, x + col, y + row);
      }
    }
  }
}

/* LED definitions for hit-testing and tooltips */
typedef struct {
  SDL_Rect rect;
  const char *tooltip;
} LedInfo;

/* LED indices: 0=LOCK, 1=GFX, 2=FD0, 3=FD1, 4=HD0, 5=HD1, 6=P1 TX, 7=P1 RX, 8=P2 TX, 9=P2 RX */
#define NUM_LEDS 10
static LedInfo leds[NUM_LEDS];
#ifndef TIKI100_VERSION
#define TIKI100_VERSION "unknown"
#endif
static char defaultTitle[64];
static void buildDefaultTitle(void) {
  snprintf(defaultTitle, sizeof(defaultTitle),
           "TIKI-100 Emulator v" TIKI100_VERSION "  (F12=Config, Alt+Enter=Fullscreen)");
}
static int hoveredLed = -1;

static void initLeds(void) {
  int barY = WINDOW_H;
  /* LOCK: "LOCK" text at x=5, dot at x=28 */
  leds[0] = (LedInfo){{28,  barY + 7, 10, 10}, "LOCK - Caps Lock active (system register bit 7, active low)"};
  /* GFX: "GFX" text at x=42, dot at x=57 */
  leds[1] = (LedInfo){{57,  barY + 7, 10, 10}, "GFX - Graphics mode, video RAM mapped to Z80 (system register bit 5, active low)"};
  /* separator at x=72 | */
  /* FD0: "FD0" text at x=76, dot at x=91 */
  leds[2] = (LedInfo){{91,  barY + 7, 10, 10}, "FD0 - Floppy drive 0 (physical), TIKI-OS maps to logical drive"};
  /* FD1: "FD1" text at x=105, dot at x=120 */
  leds[3] = (LedInfo){{120, barY + 7, 10, 10}, "FD1 - Floppy drive 1 (physical), TIKI-OS maps to logical drive"};
  /* separator at x=135 | */
  /* HD0: "HD0" text at x=139, dot at x=154 */
  leds[4] = (LedInfo){{154, barY + 7, 10, 10}, "HD0 - Hard disk 0 (WD1010 heads 0-1) activity"};
  /* HD1: "HD1" text at x=168, dot at x=183 */
  leds[5] = (LedInfo){{183, barY + 7, 10, 10}, "HD1 - Hard disk 1 (WD1010 heads 2-3) activity"};
  /* separator at x=198 | */
  /* P1 (Serial A = DART channel 1): "P1" text at x=202, TX at x=215, RX at x=228 */
  leds[6] = (LedInfo){{215, barY + 7, 10, 10}, "P1 TX - Serial A (DART channel A) transmit activity"};
  leds[7] = (LedInfo){{228, barY + 7, 10, 10}, "P1 RX - Serial A (DART channel A) receive activity"};
  /* separator at x=242 | */
  /* P2 (Serial B = DART channel 0): "P2" text at x=246, TX at x=259, RX at x=272 */
  leds[8] = (LedInfo){{259, barY + 7, 10, 10}, "P2 TX - Serial B (DART channel B) transmit activity"};
  leds[9] = (LedInfo){{272, barY + 7, 10, 10}, "P2 RX - Serial B (DART channel B) receive activity"};
}

static void checkLedHover(void) {
  int mx, my;
  int newHover = -1;
  int i;
  float sx, sy;

  SDL_GetMouseState(&mx, &my);

  /* Convert window coords to logical coords */
  SDL_RenderWindowToLogical(renderer, mx, my, &sx, &sy);
  mx = (int)sx;
  my = (int)sy;

  for (i = 0; i < NUM_LEDS; i++) {
    SDL_Rect *r = &leds[i].rect;
    if (mx >= r->x && mx < r->x + r->w && my >= r->y && my < r->y + r->h) {
      newHover = i;
      break;
    }
  }

  if (newHover != hoveredLed) {
    hoveredLed = newHover;
    if (hoveredLed >= 0) {
      SDL_SetWindowTitle(window, leds[hoveredLed].tooltip);
    } else {
      SDL_SetWindowTitle(window, defaultTitle);
    }
  }
}

static void renderStatusBar(void) {
  int winW = WINDOW_W;
  int barY = WINDOW_H;

  /* Status bar background */
  SDL_Rect bar = {0, barY, winW, STATUSBAR_HEIGHT};
  SDL_SetRenderDrawColor(renderer, 40, 40, 40, 255);
  SDL_RenderFillRect(renderer, &bar);

  /* LOCK: label then dot (glyphs at barY+9 to vertically center with the 10px dot) */
  drawGlyph( 5, barY + 9, font4x7_L, 180, 180, 180);
  drawGlyph(10, barY + 9, font4x7_O, 180, 180, 180);
  drawGlyph(15, barY + 9, font4x7_C, 180, 180, 180);
  drawGlyph(20, barY + 9, font4x7_K, 180, 180, 180);
  if (lockOn) {
    SDL_SetRenderDrawColor(renderer, 0, 255, 0, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[0].rect);

  /* GFX: label then dot */
  drawGlyph(42, barY + 9, font4x7_G, 180, 180, 180);
  drawGlyph(47, barY + 9, font4x7_F, 180, 180, 180);
  drawGlyph(52, barY + 9, font4x7_X, 180, 180, 180);
  if (grafikkOn) {
    SDL_SetRenderDrawColor(renderer, 0, 200, 255, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[1].rect);

  /* Separator between GFX and floppy section */
  SDL_SetRenderDrawColor(renderer, 100, 100, 100, 255);
  SDL_RenderDrawLine(renderer, 72, barY + 3, 72, barY + STATUSBAR_HEIGHT - 4);

  /* FD0: label then dot */
  drawGlyph(76, barY + 9, font4x7_F, 180, 180, 180);
  drawGlyph(81, barY + 9, font4x7_D, 180, 180, 180);
  drawGlyph(86, barY + 9, font4x7_0, 180, 180, 180);
  if (diskOn[0]) {
    SDL_SetRenderDrawColor(renderer, 255, 200, 0, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[2].rect);

  /* FD1: label then dot */
  drawGlyph(105, barY + 9, font4x7_F, 180, 180, 180);
  drawGlyph(110, barY + 9, font4x7_D, 180, 180, 180);
  drawGlyph(115, barY + 9, font4x7_1, 180, 180, 180);
  if (diskOn[1]) {
    SDL_SetRenderDrawColor(renderer, 255, 200, 0, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[3].rect);

  /* Separator between floppy and HDD section */
  SDL_SetRenderDrawColor(renderer, 100, 100, 100, 255);
  SDL_RenderDrawLine(renderer, 135, barY + 3, 135, barY + STATUSBAR_HEIGHT - 4);

  /* HD0: label then dot */
  drawGlyph(139, barY + 9, font4x7_H, 180, 180, 180);
  drawGlyph(144, barY + 9, font4x7_D, 180, 180, 180);
  drawGlyph(149, barY + 9, font4x7_0, 180, 180, 180);
  if (hddOn[0]) {
    SDL_SetRenderDrawColor(renderer, 0, 255, 120, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[4].rect);

  /* HD1: label then dot */
  drawGlyph(168, barY + 9, font4x7_H, 180, 180, 180);
  drawGlyph(173, barY + 9, font4x7_D, 180, 180, 180);
  drawGlyph(178, barY + 9, font4x7_1, 180, 180, 180);
  if (hddOn[1]) {
    SDL_SetRenderDrawColor(renderer, 0, 255, 120, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[5].rect);

  /* Separator between HDD and serial section */
  SDL_SetRenderDrawColor(renderer, 100, 100, 100, 255);
  SDL_RenderDrawLine(renderer, 198, barY + 3, 198, barY + STATUSBAR_HEIGHT - 4);

  /* P1 label (Serial A) */
  drawGlyph(202, barY + 9, font4x7_P, 180, 180, 180);
  drawGlyph(207, barY + 9, font4x7_1, 180, 180, 180);

  /* P1 TX LED (orange when active) — DART channel 1 = SerA */
  if (serialnet_tx_led(1)) {
    SDL_SetRenderDrawColor(renderer, 255, 140, 0, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[6].rect);

  /* P1 RX LED (cyan when active) */
  if (serialnet_rx_led(1)) {
    SDL_SetRenderDrawColor(renderer, 0, 220, 255, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[7].rect);

  /* Separator between P1 and P2 */
  SDL_SetRenderDrawColor(renderer, 100, 100, 100, 255);
  SDL_RenderDrawLine(renderer, 242, barY + 3, 242, barY + STATUSBAR_HEIGHT - 4);

  /* P2 label (Serial B) */
  drawGlyph(246, barY + 9, font4x7_P, 180, 180, 180);
  drawGlyph(251, barY + 9, font4x7_2, 180, 180, 180);

  /* P2 TX LED (orange when active) — DART channel 0 = SerB */
  if (serialnet_tx_led(0)) {
    SDL_SetRenderDrawColor(renderer, 255, 140, 0, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[8].rect);

  /* P2 RX LED (cyan when active) */
  if (serialnet_rx_led(0)) {
    SDL_SetRenderDrawColor(renderer, 0, 220, 255, 255);
  } else {
    SDL_SetRenderDrawColor(renderer, 60, 60, 60, 255);
  }
  SDL_RenderFillRect(renderer, &leds[9].rect);

  /* Check for LED hover tooltip */
  checkLedHover();
}

static byte sdlKeyToTikiKey(SDL_Keycode key) {
  switch (key) {
    /* Control keys */
    case SDLK_LCTRL:
    case SDLK_RCTRL:     return KEY_CTRL;
    case SDLK_LSHIFT:
    case SDLK_RSHIFT:    return KEY_SHIFT;
    case SDLK_PAUSE:     return KEY_BRYT;
    case SDLK_F10:       return KEY_BRYT;
    case SDLK_RETURN:    return KEY_CR;
    case SDLK_SPACE:     return KEY_SPACE;
    case SDLK_BACKSPACE: return KEY_SLETT;
    case SDLK_DELETE:    return KEY_SLETT;
    case SDLK_F8:        return KEY_GRAFIKK;
    case SDLK_F9:        return KEY_ANGRE;
    case SDLK_CAPSLOCK:  return KEY_LOCK;
    case SDLK_F7:        return KEY_LOCK;
    case SDLK_F11:       return KEY_HJELP;
    case SDLK_INSERT:    return KEY_UTVID;
    case SDLK_F12:       return KEY_UTVID;

    /* Arrow keys */
    case SDLK_LEFT:      return KEY_LEFT;
    case SDLK_RIGHT:     return KEY_RIGHT;
    case SDLK_UP:        return KEY_UP;
    case SDLK_DOWN:      return KEY_DOWN;
    case SDLK_PAGEUP:    return KEY_PGUP;
    case SDLK_PAGEDOWN:  return KEY_PGDOWN;
    case SDLK_HOME:      return KEY_HOME;
    case SDLK_TAB:       return KEY_TABRIGHT;

    /* Function keys */
    case SDLK_F1:        return KEY_F1;
    case SDLK_F2:        return KEY_F2;
    case SDLK_F3:        return KEY_F3;
    case SDLK_F4:        return KEY_F4;
    case SDLK_F5:        return KEY_F5;
    case SDLK_F6:        return KEY_F6;

    /* Numpad */
    case SDLK_KP_DIVIDE:   return KEY_NUMDIV & 0xff;
    case SDLK_KP_PLUS:     return KEY_NUMPLUS & 0xff;
    case SDLK_KP_MINUS:    return KEY_NUMMINUS & 0xff;
    case SDLK_KP_MULTIPLY: return KEY_NUMMULT & 0xff;
    case SDLK_KP_ENTER:    return KEY_ENTER & 0xff;
    case SDLK_KP_0:        return KEY_NUM0 & 0xff;
    case SDLK_KP_1:        return KEY_NUM1 & 0xff;
    case SDLK_KP_2:        return KEY_NUM2 & 0xff;
    case SDLK_KP_3:        return KEY_NUM3 & 0xff;
    case SDLK_KP_4:        return KEY_NUM4 & 0xff;
    case SDLK_KP_5:        return KEY_NUM5 & 0xff;
    case SDLK_KP_6:        return KEY_NUM6 & 0xff;
    case SDLK_KP_7:        return KEY_NUM7 & 0xff;
    case SDLK_KP_8:        return KEY_NUM8 & 0xff;
    case SDLK_KP_9:        return KEY_NUM9 & 0xff;
    case SDLK_KP_PERIOD:   return KEY_NUMDOT & 0xff;

    /* Alphanumeric keys */
    case SDLK_a: return (byte)'a';  case SDLK_b: return (byte)'b';
    case SDLK_c: return (byte)'c';  case SDLK_d: return (byte)'d';
    case SDLK_e: return (byte)'e';  case SDLK_f: return (byte)'f';
    case SDLK_g: return (byte)'g';  case SDLK_h: return (byte)'h';
    case SDLK_i: return (byte)'i';  case SDLK_j: return (byte)'j';
    case SDLK_k: return (byte)'k';  case SDLK_l: return (byte)'l';
    case SDLK_m: return (byte)'m';  case SDLK_n: return (byte)'n';
    case SDLK_o: return (byte)'o';  case SDLK_p: return (byte)'p';
    case SDLK_q: return (byte)'q';  case SDLK_r: return (byte)'r';
    case SDLK_s: return (byte)'s';  case SDLK_t: return (byte)'t';
    case SDLK_u: return (byte)'u';  case SDLK_v: return (byte)'v';
    case SDLK_w: return (byte)'w';  case SDLK_x: return (byte)'x';
    case SDLK_y: return (byte)'y';  case SDLK_z: return (byte)'z';
    case SDLK_0: return (byte)'0';  case SDLK_1: return (byte)'1';
    case SDLK_2: return (byte)'2';  case SDLK_3: return (byte)'3';
    case SDLK_4: return (byte)'4';  case SDLK_5: return (byte)'5';
    case SDLK_6: return (byte)'6';  case SDLK_7: return (byte)'7';
    case SDLK_8: return (byte)'8';  case SDLK_9: return (byte)'9';

    /* Punctuation */
    case SDLK_LESS:         return (byte)'<';
    case SDLK_COMMA:        return (byte)',';
    case SDLK_PERIOD:       return (byte)'.';
    case SDLK_MINUS:        return (byte)'-';
    case SDLK_QUOTE:        return (byte)'\'';
    case SDLK_PLUS:         return (byte)'+';
    case SDLK_CARET:        return (byte)'^';
    case SDLK_AT:           return (byte)'@';

    default: return KEY_NONE;
  }
}

/* Scancode-based lookup for keys that SDL modifies when Ctrl is held.
 * Scancodes represent the physical key position, unaffected by modifiers. */
static byte sdlScancodeToTikiKey(SDL_Scancode sc) {
  switch (sc) {
    /* Norwegian keys - physical position on Nordic keyboard */
    case SDL_SCANCODE_LEFTBRACKET:  return 0xe5;  /* aa */
    case SDL_SCANCODE_SEMICOLON:    return 0xf8;  /* oe */
    case SDL_SCANCODE_APOSTROPHE:   return 0xe6;  /* ae */
    case SDL_SCANCODE_RIGHTBRACKET: return (byte)'^';
    case SDL_SCANCODE_BACKSLASH:    return (byte)'\'';
    case SDL_SCANCODE_MINUS:        return (byte)'+';
    case SDL_SCANCODE_EQUALS:       return (byte)'\\';
    case SDL_SCANCODE_GRAVE:        return (byte)'|';
    case SDL_SCANCODE_NONUSBACKSLASH: return (byte)'<';
    case SDL_SCANCODE_SLASH:        return (byte)'-';
    case SDL_SCANCODE_COMMA:        return (byte)',';
    case SDL_SCANCODE_PERIOD:       return (byte)'.';
    default: return KEY_NONE;
  }
}

static void readDiskImage(int drive, const char *filename) {
  FILE *fp;
  long size;
  int tracks, sides, sectors, sectSize;

  if (dsk[drive]) {
    removeDisk(drive);
    free(dsk[drive]);
    dsk[drive] = NULL;
  }

  fp = fopen(filename, "rb");
  if (!fp) {
    fprintf(stderr, "Cannot open disk image: %s\n", filename);
    return;
  }

  fseek(fp, 0, SEEK_END);
  size = ftell(fp);
  fseek(fp, 0, SEEK_SET);

  dsk[drive] = (byte *)malloc(size);
  if (!dsk[drive]) {
    fclose(fp);
    fprintf(stderr, "Out of memory for disk image\n");
    return;
  }

  if (fread(dsk[drive], 1, size, fp) != (size_t)size) {
    fclose(fp);
    fprintf(stderr, "Failed to read disk image\n");
    free(dsk[drive]);
    dsk[drive] = NULL;
    return;
  }
  fclose(fp);
  dsksize[drive] = (int)size;

  /* Auto-detect disk geometry from image size */
  sectSize = 256;
  switch (size) {
    case 92160:   tracks = 40; sides = 1; sectors = 9;  break;  /* 90K SS */
    case 184320:  tracks = 40; sides = 2; sectors = 9;  break;  /* 180K DS */
    case 204800:  tracks = 40; sides = 1; sectors = 10; sectSize = 512; break; /* 200K */
    case 409600:  tracks = 40; sides = 2; sectors = 10; sectSize = 512; break; /* 400K */
    case 819200:  tracks = 80; sides = 2; sectors = 10; sectSize = 512; break; /* 800K */
    default:      tracks = 40; sides = 2; sectors = 9;  break;  /* guess */
  }

  insertDisk(drive, dsk[drive], tracks, sides, sectors, sectSize);
  printf("Loaded FD%d: %s (%ld bytes, %dx%dx%d)\n",
         drive, filename, size, tracks, sides, sectors);
}

/*****************************************************************************/
/* Serial port argument parsing                                              */
/*****************************************************************************/

/* Parse -sera/-serb arg strings and configure the serial networking layer.
 * Formats:  listen:PORT   connect:HOST:PORT   modem
 * channel: 0=SerB, 1=SerA  (matches DART port numbering) */
static void parseSerialArg(int channel, const char *arg) {
  if (strncmp(arg, "listen:", 7) == 0) {
    int port = atoi(arg + 7);
    if (port > 0 && port < 65536) {
      serialnet_configure(channel, SERMODE_LISTEN, "", port);
      menuSetSerialConfig(channel, SERMODE_LISTEN, "", port);
      printf("Serial ch%d: listen on TCP port %d\n", channel, port);
    } else {
      fprintf(stderr, "serial: invalid port in '%s'\n", arg);
    }
  } else if (strncmp(arg, "connect:", 8) == 0) {
    const char *rest = arg + 8;
    const char *portStr = strrchr(rest, ':');
    if (portStr && portStr != rest) {
      int hlen = (int)(portStr - rest);
      char host[256] = "";
      if (hlen > 0 && hlen < 256) {
        strncpy(host, rest, (size_t)hlen);
        host[hlen] = '\0';
      }
      int port = atoi(portStr + 1);
      if (host[0] && port > 0 && port < 65536) {
        serialnet_configure(channel, SERMODE_CONNECT, host, port);
        menuSetSerialConfig(channel, SERMODE_CONNECT, host, port);
        printf("Serial ch%d: connect to %s:%d\n", channel, host, port);
      } else {
        fprintf(stderr, "serial: invalid connect arg '%s'\n", arg);
      }
    } else {
      fprintf(stderr, "serial: missing port in '%s'\n", arg);
    }
  } else if (strcmp(arg, "modem") == 0) {
    serialnet_configure(channel, SERMODE_MODEM, "", 0);
    menuSetSerialConfig(channel, SERMODE_MODEM, "", 0);
    printf("Serial ch%d: modem mode\n", channel);
  } else {
    fprintf(stderr, "serial: unknown mode '%s'\n", arg);
  }
}

/*****************************************************************************/
/* Main                                                                      */
/*****************************************************************************/

int main(int argc, char *argv[]) {
  char *fd0Image = NULL;
  char *fd1Image = NULL;
  char *hd0Image = NULL;
  char *hd1Image = NULL;
  char *serAArg = NULL;
  char *serBArg = NULL;
  int i;

  /* Parse command-line arguments */
  for (i = 1; i < argc; i++) {
    if (strcmp(argv[i], "-fd0") == 0 && i + 1 < argc) {
      fd0Image = argv[++i];
    } else if (strcmp(argv[i], "-fd1") == 0 && i + 1 < argc) {
      fd1Image = argv[++i];
    } else if (strcmp(argv[i], "-hd0") == 0 && i + 1 < argc) {
      hd0Image = argv[++i];
    } else if (strcmp(argv[i], "-hd1") == 0 && i + 1 < argc) {
      hd1Image = argv[++i];
    } else if (strcmp(argv[i], "-scale") == 0 && i + 1 < argc) {
      scale = atoi(argv[++i]);
      if (scale < 1) scale = 1;
      if (scale > 4) scale = 4;
    } else if (strcmp(argv[i], "-fast") == 0) {
      speedIndex = 4;  /* full speed */
    } else if (strcmp(argv[i], "-sera") == 0 && i + 1 < argc) {
      serAArg = argv[++i];
    } else if (strcmp(argv[i], "-serb") == 0 && i + 1 < argc) {
      serBArg = argv[++i];
    } else if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
      printf("TIKI-100 Emulator (SDL2)\n"
             "Usage: tiki100 [options]\n"
             "\n"
             "Options:\n"
             "  -fd0 <file>      Floppy drive 0 image\n"
             "  -fd1 <file>      Floppy drive 1 image\n"
             "  -hd0 <file>      Hard disk 0 image (WD1010 heads 0-1)\n"
             "  -hd1 <file>      Hard disk 1 image (WD1010 heads 2-3)\n"
             "  -scale <1-4>     Window scale factor (default: 1)\n"
             "  -fast            Run at full speed (no throttle, sound will be off)\n"
             "  -sera <mode>     Serial channel A: listen:PORT | connect:HOST:PORT | modem\n"
             "  -serb <mode>     Serial channel B: listen:PORT | connect:HOST:PORT | modem\n"
             "  -h, --help       Show this help\n"
             "\n");
      return 0;
    } else {
      fprintf(stderr, "Unknown option: %s\n", argv[i]);
      return 1;
    }
  }

  /* Initialize SDL */
  if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO | SDL_INIT_TIMER) < 0) {
    fprintf(stderr, "SDL initialization failed: %s\n", SDL_GetError());
    return 1;
  }

  /* Create window - fixed size regardless of emulated resolution */
  buildDefaultTitle();
  window = SDL_CreateWindow(defaultTitle,
    SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
    WINDOW_W * scale, (WINDOW_H + STATUSBAR_HEIGHT) * scale,
    SDL_WINDOW_SHOWN | SDL_WINDOW_RESIZABLE);

  if (!window) {
    fprintf(stderr, "Window creation failed: %s\n", SDL_GetError());
    SDL_Quit();
    return 1;
  }

  /* Set window icon from embedded data */
  {
    SDL_Surface *icon = SDL_CreateRGBSurfaceFrom(
      (void *)icon_data, ICON_WIDTH, ICON_HEIGHT, 32, ICON_WIDTH * 4,
      0x000000ff, 0x0000ff00, 0x00ff0000, 0xff000000);
    if (icon) {
      SDL_SetWindowIcon(window, icon);
      SDL_FreeSurface(icon);
    }
  }

  /* Create renderer */
  renderer = SDL_CreateRenderer(window, -1,
    SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
  if (!renderer) {
    /* Fallback to software renderer */
    renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_SOFTWARE);
  }
  if (!renderer) {
    fprintf(stderr, "Renderer creation failed: %s\n", SDL_GetError());
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 1;
  }

  /* Logical size is fixed - SDL handles scaling when window is resized */
  SDL_RenderSetLogicalSize(renderer, WINDOW_W, WINDOW_H + STATUSBAR_HEIGHT);

  /* Initialize LED positions for status bar and hover tooltips */
  initLeds();

  /* Initialize Nuklear menu system */
  menuInit(window, renderer);
  menuSetCPUSpeed(speedIndex);
  menuSetVolume(50);

  /* Create initial screen texture and framebuffer */
  screen_tex = SDL_CreateTexture(renderer,
    SDL_PIXELFORMAT_ARGB8888, SDL_TEXTUREACCESS_STREAMING,
    fb_width, fb_height);
  framebuffer = (Uint32 *)calloc(fb_width * fb_height, sizeof(Uint32));

  /* Initialize default palette (black) */
  memset(palette, 0, sizeof(palette));
  palette[0] = 0xFF000000;

  /* Initialize keyboard state */
  memset(pressedKeys, 0, sizeof(pressedKeys));

  /* Initialize sound chip */
  soundInit(TIKI_CPU_FREQ, AUDIO_SAMPLE_RATE);

  /* Initialize SDL audio */
  {
    SDL_AudioSpec want, have;
    memset(&want, 0, sizeof(want));
    want.freq = AUDIO_SAMPLE_RATE;
    want.format = AUDIO_F32SYS;
    want.channels = 2;
    want.samples = AUDIO_BUFFER_SIZE;
    want.callback = audioCallback;

    audioDevice = SDL_OpenAudioDevice(NULL, 0, &want, &have, 0);
    if (audioDevice > 0) {
      SDL_PauseAudioDevice(audioDevice, 0); /* start playback */
      printf("Audio: %d Hz, %d ch, buffer %d\n", have.freq, have.channels, have.samples);
    } else {
      fprintf(stderr, "Audio init failed: %s (continuing without sound)\n", SDL_GetError());
    }
  }

  /* Initialize hard disk controller */
  hddInit();

  /* Initialize serial networking — default both channels to modem mode */
  serialnet_init();
  serialnet_configure(1, SERMODE_MODEM, "", 0);
  serialnet_configure(0, SERMODE_MODEM, "", 0);
  menuSetSerialConfig(1, SERMODE_MODEM, "", 0);
  menuSetSerialConfig(0, SERMODE_MODEM, "", 0);
  /* CLI args override the defaults */
  if (serAArg) parseSerialArg(1, serAArg);   /* ch1 = DART channel A */
  if (serBArg) parseSerialArg(0, serBArg);   /* ch0 = DART channel B */

  /* Initialize high-resolution timing */
  perfFreq = SDL_GetPerformanceFrequency();
  nextDeadline = SDL_GetPerformanceCounter();

  /* Load disk images if specified */
  if (fd0Image) { readDiskImage(0, fd0Image); menuSetFloppyMounted(0, fd0Image); }
  if (fd1Image) { readDiskImage(1, fd1Image); menuSetFloppyMounted(1, fd1Image); }

  /* Load hard disk images if specified
   * TIKI-100 HDC maps: heads 0-1 = physicalDrive 0, heads 2-3 = physicalDrive 1 */
  if (hd0Image) { hddMountImage(0, hd0Image); menuSetHDDMounted(0, hd0Image); }
  if (hd1Image) { hddMountImage(1, hd1Image); menuSetHDDMounted(1, hd1Image); }

  /* Set ROM search path to the directory containing the executable */
  {
    extern char romSearchPath[512];
    char *basepath = SDL_GetBasePath();
    if (basepath) {
      /* Remove trailing slash */
      size_t len = strlen(basepath);
      if (len > 0 && (basepath[len-1] == '/' || basepath[len-1] == '\\'))
        basepath[len-1] = '\0';
      strncpy(romSearchPath, basepath, sizeof(romSearchPath) - 1);
      romSearchPath[sizeof(romSearchPath) - 1] = '\0';
      SDL_free(basepath);
    }
  }

  printf("TIKI-100 Emulator starting...\n");

  /* Run emulator (blocks until quitEmul() is called) */
  if (!runEmul()) {
    fprintf(stderr, "Failed to start emulator - check that tiki.rom is present\n");
  }

  /* Cleanup */
  serialnet_shutdown();
  menuShutdown();
  if (audioDevice > 0) SDL_CloseAudioDevice(audioDevice);
  hddUnmountImage(0);
  hddUnmountImage(1);
  if (dsk[0]) free(dsk[0]);
  if (dsk[1]) free(dsk[1]);
  free(framebuffer);
  if (screen_tex) SDL_DestroyTexture(screen_tex);
  if (renderer) SDL_DestroyRenderer(renderer);
  if (window) SDL_DestroyWindow(window);
  SDL_Quit();

  return 0;
}
