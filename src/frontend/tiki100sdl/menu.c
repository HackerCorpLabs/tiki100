/* menu.c
 *
 * F12 configuration menu for TIKI-100 emulator
 * Uses Nuklear immediate-mode UI with SDL_Renderer backend
 *
 * Design: 5-tab configuration panel with warm orange accent (#d8542b).
 * Tabs: Machine, Floppy, Hard Disk, Serial, About.
 */

/* Nuklear configuration - must be before includes */
#define NK_INCLUDE_FIXED_TYPES
#define NK_INCLUDE_STANDARD_IO
#define NK_INCLUDE_DEFAULT_ALLOCATOR
#define NK_INCLUDE_VERTEX_BUFFER_OUTPUT
#define NK_INCLUDE_FONT_BAKING
#define NK_INCLUDE_DEFAULT_FONT
#define NK_INCLUDE_STANDARD_VARARGS

#define NK_IMPLEMENTATION
#define NK_SDL_RENDERER_SDL_H <SDL2/SDL.h>
#define NK_SDL_RENDERER_IMPLEMENTATION

#include "nuklear.h"
#include "nuklear_sdl_renderer.h"

#include "menu.h"
#include "serial_net.h"
#include "tinyfiledialogs.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <direct.h>
#define getcwd _getcwd
#else
#include <unistd.h>
#endif

/*****************************************************************************/
/* Constants                                                                 */
/*****************************************************************************/

/* Accent color: warm orange #d8542b */
#define ACCENT_R 216
#define ACCENT_G  84
#define ACCENT_B  43

/* Viewport: 1024 x 536 (512 + 24 status bar) */
#define MENU_X      62
#define MENU_Y      10
#define MENU_W     900
#define MENU_HT    516

/* Speed system: 5 levels */
#define SPEED_COUNT 5
static const char *speedLabels[SPEED_COUNT] = {"slow", "normal", "2x", "4x", "full"};
static const char *speedReadout[SPEED_COUNT] = {
  "2 MHz  0.5x (slow)", "4 MHz  1x (normal)", "8 MHz  2x",
  "16 MHz  4x", "full speed (unthrottled)"
};

/*****************************************************************************/
/* Menu state                                                                */
/*****************************************************************************/

static struct nk_context *ctx = NULL;
static SDL_Window *menuWin = NULL;
static SDL_Renderer *menuRend = NULL;
static int isOpen = 0;
static int activeTab = 0;

/* Pending actions */
static int pendMountFloppy = 0;
static int pendMountFloppyDrive;
static char pendMountFloppyPath[512];

static int pendEjectFloppy = 0;
static int pendEjectFloppyDrive;

static int pendMountHDD = 0;
static int pendMountHDDDrive;
static char pendMountHDDPath[512];

static int pendEjectHDD = 0;
static int pendEjectHDDDrive;

static int pendSpeedChange = 0;
static int pendSpeedValue;

static int pendVolumeChange = 0;
static int pendVolumeValue;

static int pendROMChange = 0;
static char pendROMPath[512];
static int selectedROM = -1;
static int pendReboot = 0;

/* Emulator state (set by frontend) */
static int curFloppyMounted[2] = {0, 0};
static char curFloppyFile[2][256];
static int curHDDMounted[2] = {0, 0};
static char curHDDFile[2][256];
static int curSpeedIndex = 1;  /* default: normal (1x) */
static int curVolume = 50;

/* Floppy catalog */
#define MAX_CATALOG 128
static int catalogCount = 0;
static char catalogFile[MAX_CATALOG][256];
static char catalogLabel[MAX_CATALOG][256];
static int  catalogSize[MAX_CATALOG];
static char catalogTag[MAX_CATALOG][16];

/* ROM catalog */
static int romCount = 0;
static char romFile[MAX_CATALOG][256];
static char romLabel[MAX_CATALOG][256];

/* File type filter: 0=.dsk, 1=.img, 2=.imd, 3=* */
/* Floppy tab UI state */
static int floppyDrive = 0;
static int floppySource = 0;  /* 0=catalog, 1=file */
static int selectedFloppy = -1;
static char floppyPathBuf[512];
static int floppyPathLen = 0;
static char floppyFilter[128];
static int floppyFilterLen = 0;
static char floppyError[256] = "";

/* HDD tab UI state */
static char hddPathBuf[2][512];
static int hddPathLen[2] = {0, 0};
static char hddError[2][256] = {"", ""};  /* validation error message */

/* Serial tab state */
static int   serialMode[2]          = {2, 2};
static char  serialHost[2][256]     = {"", ""};
static int   serialHostLen[2]       = {0, 0};
static char  serialPortBuf[2][16]   = {"", ""};
static int   serialPortBufLen[2]    = {0, 0};
static int   curSerialMode[2]       = {2, 2};
static int   curSerialPort[2]       = {0, 0};
static char  curSerialHost[2][256]  = {"", ""};
static int   pendSerial             = 0;
static int   pendSerialChannel;
static int   pendSerialMode;
static int   pendSerialPort;
static char  pendSerialHost[256];

/*****************************************************************************/
/* JSON catalog parser                                                       */
/*****************************************************************************/

static void parseCatalog(const char *filename, const char *pathPrefix,
                         const char *defaultTag,
                         char files[][256], char labels[][256],
                         int sizes[], char tags[][16],
                         int *count, int max) {
  FILE *fp;
  char line[1024];

  fp = fopen(filename, "r");
  if (!fp) return;

  while (fgets(line, sizeof(line), fp) && *count < max) {
    char *fptr, *lptr, *end;
    char rawFile[256];

    fptr = strstr(line, "\"file\"");
    if (!fptr) continue;
    fptr = strchr(fptr + 6, '"');
    if (!fptr) continue;
    fptr++;
    end = strchr(fptr, '"');
    if (!end) continue;
    *end = '\0';
    strncpy(rawFile, fptr, 255);
    rawFile[255] = '\0';
    *end = '"';

    snprintf(files[*count], 256, "%s%s", pathPrefix, rawFile);

    /* Parse size */
    {
      char *sptr = strstr(end + 1, "\"size\"");
      sizes[*count] = 0;
      if (sptr) {
        sptr = strchr(sptr + 6, ':');
        if (sptr) sizes[*count] = atoi(sptr + 1);
      }
    }

    /* Set tag */
    strncpy(tags[*count], defaultTag, 15);
    tags[*count][15] = '\0';

    /* Parse label */
    lptr = strstr(line, "\"label\"");
    if (!lptr) {
      labels[*count][0] = '\0';
      (*count)++;
      continue;
    }
    lptr = strchr(lptr + 7, '"');
    if (!lptr) {
      labels[*count][0] = '\0';
      (*count)++;
      continue;
    }
    lptr++;
    end = strchr(lptr, '"');
    if (!end) {
      labels[*count][0] = '\0';
      (*count)++;
      continue;
    }
    *end = '\0';
    strncpy(labels[*count], lptr, 255);
    labels[*count][255] = '\0';

    (*count)++;
  }

  fclose(fp);
}

/*****************************************************************************/
/* Dark theme with warm orange accent                                        */
/*****************************************************************************/

static void setDarkTheme(struct nk_context *c) {
  struct nk_color table[NK_COLOR_COUNT];
  table[NK_COLOR_TEXT]                    = nk_rgba(210, 210, 210, 255);
  table[NK_COLOR_WINDOW]                 = nk_rgba(42, 48, 54, 240);
  table[NK_COLOR_HEADER]                 = nk_rgba(51, 51, 56, 240);
  table[NK_COLOR_BORDER]                 = nk_rgba(56, 56, 56, 255);
  table[NK_COLOR_BUTTON]                 = nk_rgba(58, 62, 68, 255);
  table[NK_COLOR_BUTTON_HOVER]           = nk_rgba(68, 72, 78, 255);
  table[NK_COLOR_BUTTON_ACTIVE]          = nk_rgba(48, 52, 58, 255);
  table[NK_COLOR_TOGGLE]                 = nk_rgba(51, 51, 56, 255);
  table[NK_COLOR_TOGGLE_HOVER]           = nk_rgba(66, 66, 66, 255);
  table[NK_COLOR_TOGGLE_CURSOR]          = nk_rgba(ACCENT_R, ACCENT_G, ACCENT_B, 255);
  table[NK_COLOR_SELECT]                 = nk_rgba(51, 51, 56, 255);
  table[NK_COLOR_SELECT_ACTIVE]          = nk_rgba(ACCENT_R, ACCENT_G, ACCENT_B, 255);
  table[NK_COLOR_SLIDER]                 = nk_rgba(51, 51, 56, 255);
  table[NK_COLOR_SLIDER_CURSOR]          = nk_rgba(ACCENT_R, ACCENT_G, ACCENT_B, 255);
  table[NK_COLOR_SLIDER_CURSOR_HOVER]    = nk_rgba(230, 110, 70, 255);
  table[NK_COLOR_SLIDER_CURSOR_ACTIVE]   = nk_rgba(200, 70, 30, 255);
  table[NK_COLOR_PROPERTY]               = nk_rgba(51, 51, 56, 255);
  table[NK_COLOR_EDIT]                   = nk_rgba(38, 38, 42, 255);
  table[NK_COLOR_EDIT_CURSOR]            = nk_rgba(210, 210, 210, 255);
  table[NK_COLOR_COMBO]                  = nk_rgba(51, 51, 56, 255);
  table[NK_COLOR_CHART]                  = nk_rgba(51, 51, 56, 255);
  table[NK_COLOR_CHART_COLOR]            = nk_rgba(ACCENT_R, ACCENT_G, ACCENT_B, 255);
  table[NK_COLOR_CHART_COLOR_HIGHLIGHT]  = nk_rgba(255, 0, 0, 255);
  table[NK_COLOR_SCROLLBAR]              = nk_rgba(50, 58, 61, 255);
  table[NK_COLOR_SCROLLBAR_CURSOR]       = nk_rgba(80, 80, 86, 255);
  table[NK_COLOR_SCROLLBAR_CURSOR_HOVER] = nk_rgba(90, 90, 96, 255);
  table[NK_COLOR_SCROLLBAR_CURSOR_ACTIVE]= nk_rgba(100, 100, 106, 255);
  table[NK_COLOR_TAB_HEADER]             = nk_rgba(58, 62, 68, 255);
  nk_style_from_table(c, table);
}

/*****************************************************************************/
/* Styled widget helpers                                                     */
/*****************************************************************************/

/* Draw accent-filled button (primary action) */
static int accentButton(struct nk_context *c, const char *label) {
  struct nk_style_button style = c->style.button;
  int ret;
  style.normal  = nk_style_item_color(nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B));
  style.hover   = nk_style_item_color(nk_rgb(230, 110, 70));
  style.active  = nk_style_item_color(nk_rgb(200, 70, 30));
  style.text_normal = nk_rgb(255, 255, 255);
  style.text_hover  = nk_rgb(255, 255, 255);
  style.text_active = nk_rgb(255, 255, 255);
  ret = nk_button_label_styled(c, &style, label);
  return ret;
}

/* Draw tab button - active tab gets accent style + underline */
static int tabButton(struct nk_context *c, const char *label, int isActive) {
  struct nk_style_button style = c->style.button;
  int ret;
  if (isActive) {
    style.normal  = nk_style_item_color(nk_rgba(62, 68, 76, 255));
    style.hover   = nk_style_item_color(nk_rgba(68, 74, 82, 255));
    style.active  = nk_style_item_color(nk_rgba(62, 68, 76, 255));
    style.text_normal = nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B);
    style.text_hover  = nk_rgb(230, 110, 70);
    style.text_active = nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B);
    style.border_color = nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B);
    style.border = 1;
  } else {
    style.normal  = nk_style_item_color(nk_rgba(42, 46, 52, 255));
    style.hover   = nk_style_item_color(nk_rgba(52, 56, 62, 255));
    style.active  = nk_style_item_color(nk_rgba(42, 46, 52, 255));
    style.text_normal = nk_rgb(160, 160, 160);
    style.text_hover  = nk_rgb(200, 200, 200);
    style.text_active = nk_rgb(160, 160, 160);
  }
  ret = nk_button_label_styled(c, &style, label);
  return ret;
}

/* Small chip-style label (size or tag) */
static void chipLabel(struct nk_context *c, const char *text,
                      struct nk_color bg, struct nk_color fg) {
  struct nk_style_button style = c->style.button;
  style.normal  = nk_style_item_color(bg);
  style.hover   = nk_style_item_color(bg);
  style.active  = nk_style_item_color(bg);
  style.text_normal = fg;
  style.text_hover  = fg;
  style.text_active = fg;
  style.rounding = 4;
  style.padding = nk_vec2(4, 1);
  nk_button_label_styled(c, &style, text);
}

/* Draw horizontal accent line separator */
static void accentSeparator(struct nk_context *c) {
  struct nk_command_buffer *canvas = nk_window_get_canvas(c);
  struct nk_rect bounds;
  nk_layout_row_dynamic(c, 4, 1);
  nk_widget(&bounds, c);
  bounds.y += 1;
  bounds.h = 2;
  nk_fill_rect(canvas, bounds, 0, nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B));
}

/*****************************************************************************/
/* File browser helper                                                       */
/*****************************************************************************/

/* Extract directory from a path for the file dialog starting directory */
static void getDirectory(const char *path, char *dir, int dirSize) {
  const char *lastSlash;
  if (!path || !path[0]) {
    if (getcwd(dir, dirSize) == NULL)
      dir[0] = '\0';
    return;
  }
  lastSlash = strrchr(path, '/');
#ifdef _WIN32
  {
    const char *lastBack = strrchr(path, '\\');
    if (lastBack && (!lastSlash || lastBack > lastSlash))
      lastSlash = lastBack;
  }
#endif
  if (lastSlash) {
    int len = (int)(lastSlash - path + 1);
    if (len >= dirSize) len = dirSize - 1;
    memcpy(dir, path, len);
    dir[len] = '\0';
  } else {
    if (getcwd(dir, dirSize) == NULL)
      dir[0] = '\0';
  }
}

/* Check if a graphical file dialog tool is available.
 * We check directly for known tools rather than calling tinyfiledialogs
 * query mode, which itself pops up a "missing software" dialog. */
static int hasGraphicDialog(void) {
  static int checked = 0;
  static int available = 0;
  if (!checked) {
    checked = 1;
#ifdef _WIN32
    available = 1;  /* Windows always has IFileOpenDialog */
#elif defined(__APPLE__)
    available = 1;  /* macOS always has NSOpenPanel */
#else
    /* Check for common Linux dialog tools */
    available = (system("which zenity >/dev/null 2>&1") == 0)
             || (system("which kdialog >/dev/null 2>&1") == 0)
             || (system("which yad >/dev/null 2>&1") == 0);
#endif
  }
  return available;
}

/* Open native file dialog and write result into pathBuf/pathLen.
 * Returns 1 if a file was chosen, 0 if cancelled,
 * -1 if no graphical dialog is available. */
static int openBrowseDialog(const char *title,
                            char *pathBuf, int *pathLen, int pathBufSize) {
  static const char *patterns[] = {"*.dsk", "*.img", "*.imd"};
  char startDir[512];
  const char *result;

  /* Never fall back to console — it would block the SDL window */
  if (!hasGraphicDialog()) return -1;

  pathBuf[*pathLen] = '\0';
  getDirectory(pathBuf, startDir, sizeof(startDir));

  result = tinyfd_openFileDialog(title, startDir, 3, patterns,
                                 "Disk images (*.dsk, *.img, *.imd)", 0);

  if (result) {
    int len = (int)strlen(result);
    if (len >= pathBufSize) len = pathBufSize - 1;
    memcpy(pathBuf, result, len);
    pathBuf[len] = '\0';
    *pathLen = len;
    return 1;
  }
  return 0;
}

/*****************************************************************************/
/* Tab 1: Machine                                                            */
/*****************************************************************************/

static void renderMachineTab(void) {
  int newSpeed;

  /* CPU Speed header with live readout */
  {
    float ratios[] = {0.25f, 0.75f};
    nk_layout_row(ctx, NK_DYNAMIC, 22, 2, ratios);
    nk_label(ctx, "CPU Speed:", NK_TEXT_LEFT);
    nk_label(ctx, speedReadout[curSpeedIndex], NK_TEXT_LEFT);
  }

  /* Speed slider: 5 snap stops (0-4). Knob and track are enlarged so the
   * drag handle is easy to grab; click-on-track also jumps to that stop. */
  {
    struct nk_vec2 savedCursorSize = ctx->style.slider.cursor_size;
    float savedBarHeight = ctx->style.slider.bar_height;
    ctx->style.slider.cursor_size = nk_vec2(28, 28);
    ctx->style.slider.bar_height = 8;
    nk_layout_row_dynamic(ctx, 36, 1);
    newSpeed = (int)nk_slide_int(ctx, 0, curSpeedIndex, SPEED_COUNT - 1, 1);
    ctx->style.slider.cursor_size = savedCursorSize;
    ctx->style.slider.bar_height = savedBarHeight;
  }
  if (newSpeed != curSpeedIndex) {
    curSpeedIndex = newSpeed;
    pendSpeedChange = 1;
    pendSpeedValue = newSpeed;
  }

  /* Clickable speed labels (also act as direct-pick buttons) */
  {
    int i;
    nk_layout_row_dynamic(ctx, 22, SPEED_COUNT);
    for (i = 0; i < SPEED_COUNT; i++) {
      struct nk_style_button style = ctx->style.button;
      style.rounding = 3;
      style.padding = nk_vec2(2, 2);
      style.border = 0;
      if (i == curSpeedIndex) {
        style.normal  = nk_style_item_color(nk_rgba(62, 68, 76, 255));
        style.hover   = nk_style_item_color(nk_rgba(68, 74, 82, 255));
        style.active  = nk_style_item_color(nk_rgba(62, 68, 76, 255));
        style.text_normal = nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B);
        style.text_hover  = nk_rgb(230, 110, 70);
        style.text_active = nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B);
      } else {
        style.normal  = nk_style_item_color(nk_rgba(42, 46, 52, 255));
        style.hover   = nk_style_item_color(nk_rgba(52, 56, 62, 255));
        style.active  = nk_style_item_color(nk_rgba(42, 46, 52, 255));
        style.text_normal = nk_rgb(160, 160, 160);
        style.text_hover  = nk_rgb(220, 220, 220);
        style.text_active = nk_rgb(160, 160, 160);
      }
      if (nk_button_label_styled(ctx, &style, speedLabels[i])) {
        if (i != curSpeedIndex) {
          curSpeedIndex = i;
          pendSpeedChange = 1;
          pendSpeedValue = i;
        }
      }
    }
  }

  /* Default marker below "normal" (index 1) */
  {
    int i;
    nk_layout_row_dynamic(ctx, 12, SPEED_COUNT);
    for (i = 0; i < SPEED_COUNT; i++) {
      if (i == 1) {
        struct nk_color saved = ctx->style.text.color;
        ctx->style.text.color = nk_rgb(130, 130, 130);
        nk_label(ctx, "^ default", NK_TEXT_CENTERED);
        ctx->style.text.color = saved;
      } else {
        nk_spacing(ctx, 1);
      }
    }
  }

  /* Volume */
  {
    char volLabel[48];
    int newVol;
    float ratios[] = {0.25f, 0.75f};
    snprintf(volLabel, sizeof(volLabel), "Volume: %d%%", curVolume);
    nk_layout_row(ctx, NK_DYNAMIC, 22, 2, ratios);
    nk_label(ctx, "Volume:", NK_TEXT_LEFT);
    nk_label(ctx, volLabel, NK_TEXT_LEFT);
    {
      struct nk_vec2 savedCursorSize = ctx->style.slider.cursor_size;
      float savedBarHeight = ctx->style.slider.bar_height;
      ctx->style.slider.cursor_size = nk_vec2(28, 28);
      ctx->style.slider.bar_height = 8;
      nk_layout_row_dynamic(ctx, 36, 1);
      newVol = (int)nk_slide_int(ctx, 0, curVolume, 100, 5);
      ctx->style.slider.cursor_size = savedCursorSize;
      ctx->style.slider.bar_height = savedBarHeight;
    }
    if (newVol != curVolume) {
      curVolume = newVol;
      pendVolumeChange = 1;
      pendVolumeValue = newVol;
    }
  }

  /* ROM selection */
  nk_layout_row_dynamic(ctx, 22, 1);
  nk_label(ctx, "ROM (change requires reboot):", NK_TEXT_LEFT);

  if (romCount > 0) {
    int i;

    /* Auto-select default ROM on first display */
    if (selectedROM < 0) {
      for (i = 0; i < romCount; i++) {
        if (strstr(romFile[i], "2.03w")) { selectedROM = i; break; }
      }
      if (selectedROM < 0) selectedROM = 0;
    }

    nk_layout_row_dynamic(ctx, (float)(romCount * 26 + 16), 1);
    if (nk_group_begin(ctx, "rom_panel",
                       NK_WINDOW_BORDER | NK_WINDOW_NO_SCROLLBAR)) {
      for (i = 0; i < romCount; i++) {
        char label[280];
        nk_layout_row_dynamic(ctx, 22, 1);
        if (strstr(romFile[i], "2.03w"))
          snprintf(label, sizeof(label), "%s (default)", romLabel[i]);
        else
          strncpy(label, romLabel[i], sizeof(label) - 1);
        if (nk_option_label(ctx, label, selectedROM == i)) {
          if (selectedROM != i) {
            selectedROM = i;
            pendROMChange = 1;
            strncpy(pendROMPath, romFile[i], sizeof(pendROMPath) - 1);
            pendROMPath[sizeof(pendROMPath) - 1] = '\0';
          }
        }
      }
      nk_group_end(ctx);
    }
  } else {
    nk_layout_row_dynamic(ctx, 20, 1);
    nk_label(ctx, "(no ROMs found in rom/roms.json)", NK_TEXT_LEFT);
  }

  nk_layout_row_dynamic(ctx, 15, 1);
  nk_spacing(ctx, 1);

  /* Reboot button */
  {
    float ratios[] = {0.35f, 0.65f};
    nk_layout_row(ctx, NK_DYNAMIC, 32, 2, ratios);
    if (accentButton(ctx, "Reboot TIKI-100")) {
      pendReboot = 1;
    }
    nk_label(ctx, "  applies pending ROM change", NK_TEXT_LEFT);
  }
}

/*****************************************************************************/
/* Tab 2: Floppy                                                             */
/*****************************************************************************/

static void renderFloppyDriveCard(int d) {
  char statusBuf[300];
  struct nk_color borderSaved;
  int isTarget = (floppyDrive == d);

  /* Push accent border for selected drive */
  if (isTarget) {
    borderSaved = ctx->style.window.group_border_color;
    ctx->style.window.group_border_color = nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B);
  }

  if (nk_group_begin(ctx, d == 0 ? "fd0_card" : "fd1_card", NK_WINDOW_BORDER)) {
    nk_bool sel;

    /* Drive header - selectable to set target drive */
    snprintf(statusBuf, sizeof(statusBuf), "%s FD%d",
             isTarget ? ">>" : "  ", d);
    sel = isTarget ? nk_true : nk_false;
    nk_layout_row_dynamic(ctx, 22, 1);
    if (nk_selectable_label(ctx, statusBuf, NK_TEXT_LEFT, &sel)) {
      floppyDrive = d;
    }

    /* Status line - also selectable so clicking the filename selects the drive */
    sel = isTarget ? nk_true : nk_false;
    nk_layout_row_dynamic(ctx, 22, 1);
    {
      struct nk_color saved = ctx->style.text.color;
      const char *txt;
      if (curFloppyMounted[d]) {
        ctx->style.text.color = nk_rgb(180, 220, 180);
        txt = curFloppyFile[d];
      } else {
        ctx->style.text.color = nk_rgb(120, 120, 120);
        txt = "-- empty slot --";
      }
      if (nk_selectable_label(ctx, txt, NK_TEXT_LEFT, &sel)) {
        floppyDrive = d;
      }
      ctx->style.text.color = saved;
    }

    /* Eject button if mounted */
    if (curFloppyMounted[d]) {
      nk_layout_row_dynamic(ctx, 22, 1);
      if (nk_button_label(ctx, "Eject")) {
        pendEjectFloppy = 1;
        pendEjectFloppyDrive = d;
      }
    }

    nk_group_end(ctx);
  }

  if (isTarget) {
    ctx->style.window.group_border_color = borderSaved;
  }
}

static void doMountFloppy(int drive, int catalogIdx) {
  if (drive < 0 || drive > 1) return;
  if (catalogIdx < 0 || catalogIdx >= catalogCount) return;
  if (pendMountFloppy) return;
  pendMountFloppy = 1;
  pendMountFloppyDrive = drive;
  strncpy(pendMountFloppyPath, catalogFile[catalogIdx],
          sizeof(pendMountFloppyPath) - 1);
  pendMountFloppyPath[sizeof(pendMountFloppyPath) - 1] = '\0';
}

static void renderFloppyTab(void) {
  int i;

  /* Drive status cards - side by side */
  nk_layout_row_dynamic(ctx, 82, 2);
  renderFloppyDriveCard(0);
  renderFloppyDriveCard(1);

  nk_layout_row_dynamic(ctx, 6, 1);
  nk_spacing(ctx, 1);

  /* Source toggle + filter */
  if (floppySource == 0) {
    /* Catalog mode: source buttons + filter input */
    float ratios[] = {0.12f, 0.14f, 0.14f, 0.08f, 0.52f};
    nk_layout_row(ctx, NK_DYNAMIC, 28, 5, ratios);
    nk_label(ctx, "Source:", NK_TEXT_LEFT);
    if (accentButton(ctx, "Catalog")) { /* already active */ }
    if (nk_button_label(ctx, "File path")) { floppySource = 1; }
    nk_label(ctx, "Filter:", NK_TEXT_RIGHT);
    nk_edit_string(ctx, NK_EDIT_FIELD, floppyFilter, &floppyFilterLen,
                   sizeof(floppyFilter) - 1, nk_filter_ascii);
  } else {
    /* File mode: source buttons */
    float ratios[] = {0.12f, 0.14f, 0.14f, 0.60f};
    nk_layout_row(ctx, NK_DYNAMIC, 28, 4, ratios);
    nk_label(ctx, "Source:", NK_TEXT_LEFT);
    if (nk_button_label(ctx, "Catalog")) { floppySource = 0; }
    if (accentButton(ctx, "File path")) { /* already active */ }
    nk_spacing(ctx, 1);
  }

  nk_layout_row_dynamic(ctx, 4, 1);
  nk_spacing(ctx, 1);

  if (floppySource == 0) {
    /* Catalog list (scrollable) */
    nk_layout_row_dynamic(ctx, 180, 1);
    if (nk_group_begin(ctx, "floppy_catalog", NK_WINDOW_BORDER)) {
      floppyFilter[floppyFilterLen] = '\0';

      for (i = 0; i < catalogCount; i++) {
        char rowLabel[320];
        int isSelected = (selectedFloppy == i);
        char sizeStr[16];

        /* Filter: skip if filter text doesn't match label */
        if (floppyFilterLen > 0) {
          /* Case-insensitive substring match */
          int match = 0;
          const char *p = catalogLabel[i];
          const char *f = floppyFilter;
          int fLen = floppyFilterLen;
          while (*p) {
            int j, found = 1;
            for (j = 0; j < fLen && p[j]; j++) {
              char a = p[j], b = f[j];
              if (a >= 'A' && a <= 'Z') a += 32;
              if (b >= 'A' && b <= 'Z') b += 32;
              if (a != b) { found = 0; break; }
            }
            if (found && j == fLen) { match = 1; break; }
            p++;
          }
          if (!match) continue;
        }

        /* Build row label: [size] name [tag] */
        if (catalogSize[i] > 0)
          snprintf(sizeStr, sizeof(sizeStr), "%dK", catalogSize[i]);
        else
          sizeStr[0] = '\0';

        snprintf(rowLabel, sizeof(rowLabel), " %6s   %.280s", sizeStr, catalogLabel[i]);

        /* Selectable row with accent highlight */
        {
          nk_bool sel = isSelected ? nk_true : nk_false;

          if (isSelected) {
            /* Accent-tinted background for selected row */
            struct nk_color saved_sel = ctx->style.selectable.pressed.data.color;
            struct nk_color saved_sel_active = ctx->style.selectable.pressed_active.data.color;
            ctx->style.selectable.pressed.data.color =
              nk_rgba(ACCENT_R/3, ACCENT_G/3, ACCENT_B/3, 255);
            ctx->style.selectable.pressed_active.data.color =
              nk_rgba(ACCENT_R/3, ACCENT_G/3, ACCENT_B/3, 255);

            nk_layout_row_dynamic(ctx, 22, 1);
            if (nk_selectable_label(ctx, rowLabel, NK_TEXT_LEFT, &sel)) {
              /* Already selected - clicking again is fine, mount via action bar */
            }

            ctx->style.selectable.pressed.data.color = saved_sel;
            ctx->style.selectable.pressed_active.data.color = saved_sel_active;
          } else {
            nk_layout_row_dynamic(ctx, 22, 1);
            if (nk_selectable_label(ctx, rowLabel, NK_TEXT_LEFT, &sel)) {
              selectedFloppy = i;
            }
          }
        }
      }
      nk_group_end(ctx);
    }
  } else {
    /* File path input with inline Browse + Mount buttons (file types are
       presented by the native browse dialog itself, so no dropdown). */
    char btnLabel[32];
    if (curFloppyMounted[floppyDrive]) {
      snprintf(btnLabel, sizeof(btnLabel), "Swap into FD%d", floppyDrive);
    } else {
      snprintf(btnLabel, sizeof(btnLabel), "Mount to FD%d", floppyDrive);
    }

    {
      float ratios[] = {0.55f, 0.18f, 0.27f};
      nk_layout_row(ctx, NK_DYNAMIC, 30, 3, ratios);
      nk_edit_string(ctx, NK_EDIT_FIELD, floppyPathBuf, &floppyPathLen,
                     sizeof(floppyPathBuf) - 1, nk_filter_ascii);
      if (nk_button_label(ctx, "Browse")) {
        int r = openBrowseDialog("Select Floppy Image",
                                 floppyPathBuf, &floppyPathLen,
                                 sizeof(floppyPathBuf));
        if (r == 1) floppyError[0] = '\0';
        else if (r == -1) snprintf(floppyError, sizeof(floppyError),
          "No file dialog available. Install zenity: sudo apt install zenity");
      }
      if (accentButton(ctx, btnLabel)) {
        floppyPathBuf[floppyPathLen] = '\0';
        if (floppyPathLen > 0) {
          FILE *fp = fopen(floppyPathBuf, "rb");
          if (fp) {
            fclose(fp);
            floppyError[0] = '\0';
            pendMountFloppy = 1;
            pendMountFloppyDrive = floppyDrive;
            strncpy(pendMountFloppyPath, floppyPathBuf,
                    sizeof(pendMountFloppyPath) - 1);
            pendMountFloppyPath[sizeof(pendMountFloppyPath) - 1] = '\0';
          } else {
            snprintf(floppyError, sizeof(floppyError),
                     "File not found: %.200s", floppyPathBuf);
          }
        } else {
          strncpy(floppyError, "Enter a file path or click Browse",
                  sizeof(floppyError) - 1);
        }
      }
    }

    /* Error / status line */
    nk_layout_row_dynamic(ctx, 22, 1);
    if (floppyError[0]) {
      struct nk_color saved = ctx->style.text.color;
      ctx->style.text.color = nk_rgb(230, 80, 80);
      nk_label(ctx, floppyError, NK_TEXT_LEFT);
      ctx->style.text.color = saved;
    } else {
      nk_spacing(ctx, 1);
    }
    return;
  }

  /* Catalog mode action bar (file path mode returns above) */
  accentSeparator(ctx);

  {
    char contextMsg[1024];
    char btnLabel[64];
    int canMount = 0;

    if (selectedFloppy >= 0 && selectedFloppy < catalogCount) {
      if (curFloppyMounted[floppyDrive]) {
        snprintf(contextMsg, sizeof(contextMsg),
                 "Mounting %s to FD%d (will replace %s)",
                 catalogLabel[selectedFloppy], floppyDrive, curFloppyFile[floppyDrive]);
        snprintf(btnLabel, sizeof(btnLabel), "Swap into FD%d", floppyDrive);
      } else {
        snprintf(contextMsg, sizeof(contextMsg),
                 "Mounting %s to FD%d",
                 catalogLabel[selectedFloppy], floppyDrive);
        snprintf(btnLabel, sizeof(btnLabel), "Mount to FD%d", floppyDrive);
      }
      canMount = 1;
    } else {
      strncpy(contextMsg, "Select a disk from the catalog",
              sizeof(contextMsg) - 1);
      snprintf(btnLabel, sizeof(btnLabel), "Mount to FD%d", floppyDrive);
      canMount = 0;
    }

    {
      float ratios[] = {0.65f, 0.35f};
      nk_layout_row(ctx, NK_DYNAMIC, 32, 2, ratios);

      {
        struct nk_color saved = ctx->style.text.color;
        if (floppyError[0]) {
          ctx->style.text.color = nk_rgb(230, 80, 80);
          nk_label(ctx, floppyError, NK_TEXT_LEFT);
        } else {
          ctx->style.text.color = nk_rgb(170, 170, 170);
          nk_label(ctx, contextMsg, NK_TEXT_LEFT);
        }
        ctx->style.text.color = saved;
      }

      if (canMount) {
        if (accentButton(ctx, btnLabel)) {
          doMountFloppy(floppyDrive, selectedFloppy);
        }
      } else {
        struct nk_style_button style = ctx->style.button;
        style.normal  = nk_style_item_color(nk_rgba(50, 50, 55, 255));
        style.hover   = nk_style_item_color(nk_rgba(50, 50, 55, 255));
        style.active  = nk_style_item_color(nk_rgba(50, 50, 55, 255));
        style.text_normal = nk_rgb(80, 80, 80);
        style.text_hover  = nk_rgb(80, 80, 80);
        style.text_active = nk_rgb(80, 80, 80);
        nk_button_label_styled(ctx, &style, btnLabel);
      }
    }
  }
}

/*****************************************************************************/
/* Tab 3: Hard Disk                                                          */
/*****************************************************************************/

static void renderHDDDriveCard(int d) {
  char cardName[16];
  snprintf(cardName, sizeof(cardName), "hd%d_card", d);

  if (nk_group_begin(ctx, cardName, NK_WINDOW_BORDER)) {
    /* Drive header */
    nk_layout_row_dynamic(ctx, 22, 1);
    {
      char hdr[32];
      snprintf(hdr, sizeof(hdr), "HD%d", d);
      nk_label(ctx, hdr, NK_TEXT_LEFT);
    }

    if (curHDDMounted[d]) {
      /* Mounted: show file + eject */
      nk_layout_row_dynamic(ctx, 18, 1);
      {
        struct nk_color saved = ctx->style.text.color;
        ctx->style.text.color = nk_rgb(180, 220, 180);
        nk_label(ctx, curHDDFile[d], NK_TEXT_LEFT);
        ctx->style.text.color = saved;
      }

      nk_layout_row_dynamic(ctx, 6, 1);
      nk_spacing(ctx, 1);

      nk_layout_row_dynamic(ctx, 26, 1);
      if (nk_button_label(ctx, "Eject")) {
        pendEjectHDD = 1;
        pendEjectHDDDrive = d;
      }
    } else {
      /* Unmounted: file path input + mount button */
      nk_layout_row_dynamic(ctx, 18, 1);
      {
        struct nk_color saved = ctx->style.text.color;
        ctx->style.text.color = nk_rgb(120, 120, 120);
        nk_label(ctx, "Not mounted", NK_TEXT_LEFT);
        ctx->style.text.color = saved;
      }

      {
        float ratios[] = {0.78f, 0.22f};
        nk_layout_row(ctx, NK_DYNAMIC, 26, 2, ratios);
        nk_edit_string(ctx, NK_EDIT_FIELD, hddPathBuf[d], &hddPathLen[d],
                       sizeof(hddPathBuf[d]) - 1, nk_filter_ascii);
        if (nk_button_label(ctx, "Browse")) {
          int r = openBrowseDialog("Select Hard Disk Image",
                                   hddPathBuf[d], &hddPathLen[d],
                                   sizeof(hddPathBuf[d]));
          if (r == 1) hddError[d][0] = '\0';
          else if (r == -1) snprintf(hddError[d], sizeof(hddError[d]),
            "No file dialog available. Install zenity: sudo apt install zenity");
        }
      }

      {
        char mountLabel[16];
        snprintf(mountLabel, sizeof(mountLabel), "Mount HD%d", d);
        nk_layout_row_dynamic(ctx, 26, 1);
        if (accentButton(ctx, mountLabel)) {
          hddPathBuf[d][hddPathLen[d]] = '\0';
          if (hddPathLen[d] > 0) {
            FILE *fp = fopen(hddPathBuf[d], "rb");
            if (fp) {
              fclose(fp);
              hddError[d][0] = '\0';
              pendMountHDD = 1;
              pendMountHDDDrive = d;
              strncpy(pendMountHDDPath, hddPathBuf[d],
                      sizeof(pendMountHDDPath) - 1);
              pendMountHDDPath[sizeof(pendMountHDDPath) - 1] = '\0';
            } else {
              snprintf(hddError[d], sizeof(hddError[d]),
                       "File not found: %.200s", hddPathBuf[d]);
            }
          }
        }

        /* Show error message if any */
        if (hddError[d][0]) {
          struct nk_color saved = ctx->style.text.color;
          ctx->style.text.color = nk_rgb(230, 80, 80);
          nk_layout_row_dynamic(ctx, 18, 1);
          nk_label(ctx, hddError[d], NK_TEXT_LEFT);
          ctx->style.text.color = saved;
        }
      }
    }

    nk_group_end(ctx);
  }
}

static void renderHDDTab(void) {
  /* Drive cards side by side */
  nk_layout_row_dynamic(ctx, 160, 2);
  renderHDDDriveCard(0);
  renderHDDDriveCard(1);

  nk_layout_row_dynamic(ctx, 10, 1);
  nk_spacing(ctx, 1);

  /* Footer note */
  {
    struct nk_color saved = ctx->style.text.color;
    ctx->style.text.color = nk_rgb(130, 130, 130);
    nk_layout_row_dynamic(ctx, 20, 1);
    nk_label(ctx, "heads 0-1 = HD0  |  heads 2-3 = HD1", NK_TEXT_LEFT);
    ctx->style.text.color = saved;
  }
}

/*****************************************************************************/
/* Tab 4: Serial                                                             */
/*****************************************************************************/

static void renderSerialChannel(int d) {
  static const char *chanLabel[2] = { "Channel A (SerA)", "Channel B (SerB)" };
  static const char *modeName[3]  = { "Listen", "Connect", "Modem" };
  char cardName[16];

  snprintf(cardName, sizeof(cardName), "ser%d_card", d);

  nk_layout_row_dynamic(ctx, 190, 1);
  if (nk_group_begin(ctx, cardName, NK_WINDOW_BORDER)) {
    /* Header with status on right */
    {
      char statusLine[320];
      float ratios[] = {0.45f, 0.55f};
      int dartCh = (d == 0) ? 1 : 0;

      if (curSerialMode[d] == 2) {
        char target[280] = "(none)";
        serialnet_modem_target(dartCh, target, (int)sizeof(target));
        if (strcmp(target, "(none)") == 0)
          snprintf(statusLine, sizeof(statusLine), "modem -- ATDT to dial");
        else
          snprintf(statusLine, sizeof(statusLine), "modem -- connected to %s", target);
      } else if (curSerialMode[d] == 0) {
        snprintf(statusLine, sizeof(statusLine), "listening :%d", curSerialPort[d]);
      } else {
        snprintf(statusLine, sizeof(statusLine), "-> %s:%d",
                 curSerialHost[d], curSerialPort[d]);
      }

      nk_layout_row(ctx, NK_DYNAMIC, 22, 2, ratios);
      nk_label(ctx, chanLabel[d], NK_TEXT_LEFT);
      {
        struct nk_color saved = ctx->style.text.color;
        ctx->style.text.color = nk_rgb(140, 180, 140);
        nk_label(ctx, statusLine, NK_TEXT_RIGHT);
        ctx->style.text.color = saved;
      }
    }

    /* Mode buttons + Apply */
    {
      float ratios[] = {0.20f, 0.20f, 0.20f, 0.15f, 0.25f};
      int m;
      char applyLabel[16];
      nk_layout_row(ctx, NK_DYNAMIC, 28, 5, ratios);
      for (m = 0; m < 3; m++) {
        if (serialMode[d] == m) {
          accentButton(ctx, modeName[m]);
        } else {
          if (nk_button_label(ctx, modeName[m]))
            serialMode[d] = m;
        }
      }
      nk_spacing(ctx, 1);
      snprintf(applyLabel, sizeof(applyLabel), "Apply %s", d == 0 ? "A" : "B");
      if (nk_button_label(ctx, applyLabel)) {
        serialHost[d][serialHostLen[d]]       = '\0';
        serialPortBuf[d][serialPortBufLen[d]] = '\0';
        pendSerial        = 1;
        pendSerialChannel = d;
        pendSerialMode    = serialMode[d];
        strncpy(pendSerialHost, serialHost[d], sizeof(pendSerialHost) - 1);
        pendSerialHost[sizeof(pendSerialHost) - 1] = '\0';
        pendSerialPort    = atoi(serialPortBuf[d]);
      }
    }

    /* Mode-conditional fields */
    if (serialMode[d] == 0) {
      nk_layout_row_dynamic(ctx, 20, 1);
      nk_label(ctx, "  TCP port to listen on:", NK_TEXT_LEFT);
      nk_layout_row_dynamic(ctx, 26, 1);
      nk_edit_string(ctx, NK_EDIT_FIELD | NK_EDIT_GOTO_END_ON_ACTIVATE,
                     serialPortBuf[d], &serialPortBufLen[d],
                     (int)sizeof(serialPortBuf[d]) - 1, nk_filter_decimal);
    } else if (serialMode[d] == 1) {
      float ratios[] = {0.08f, 0.52f, 0.08f, 0.32f};
      nk_layout_row(ctx, NK_DYNAMIC, 26, 4, ratios);
      nk_label(ctx, "Host:", NK_TEXT_LEFT);
      nk_edit_string(ctx, NK_EDIT_FIELD | NK_EDIT_GOTO_END_ON_ACTIVATE,
                     serialHost[d], &serialHostLen[d],
                     (int)sizeof(serialHost[d]) - 1, nk_filter_ascii);
      nk_label(ctx, "Port:", NK_TEXT_LEFT);
      nk_edit_string(ctx, NK_EDIT_FIELD | NK_EDIT_GOTO_END_ON_ACTIVATE,
                     serialPortBuf[d], &serialPortBufLen[d],
                     (int)sizeof(serialPortBuf[d]) - 1, nk_filter_decimal);
    } else {
      struct nk_color saved = ctx->style.text.color;
      ctx->style.text.color = nk_rgb(140, 140, 140);
      nk_layout_row_dynamic(ctx, 20, 1);
      nk_label(ctx, "  Dial with ATDT host:port from inside the TIKI-100", NK_TEXT_LEFT);
      ctx->style.text.color = saved;
    }

    nk_group_end(ctx);
  }
}

static void renderSerialTab(void) {
  renderSerialChannel(0);
  nk_layout_row_dynamic(ctx, 6, 1);
  nk_spacing(ctx, 1);
  renderSerialChannel(1);
}

/*****************************************************************************/
/* Tab 5: About                                                              */
/*****************************************************************************/

static void renderAboutTab(void) {
  /* Hero block */
  {
    float ratios[] = {0.30f, 0.70f};
    nk_layout_row(ctx, NK_DYNAMIC, 80, 2, ratios);

    /* Logo text card */
    if (nk_group_begin(ctx, "logo_card", NK_WINDOW_BORDER)) {
      struct nk_color saved = ctx->style.text.color;
      ctx->style.text.color = nk_rgb(ACCENT_R, ACCENT_G, ACCENT_B);
      nk_layout_row_dynamic(ctx, 28, 1);
      nk_label(ctx, "  TIKI", NK_TEXT_CENTERED);
      nk_layout_row_dynamic(ctx, 28, 1);
      nk_label(ctx, "  100", NK_TEXT_CENTERED);
      ctx->style.text.color = nk_rgb(120, 120, 120);
      nk_layout_row_dynamic(ctx, 14, 1);
      nk_label(ctx, "  1984", NK_TEXT_CENTERED);
      ctx->style.text.color = saved;
      nk_group_end(ctx);
    }

    /* Description */
    if (nk_group_begin(ctx, "about_desc", 0)) {
      nk_layout_row_dynamic(ctx, 20, 1);
      nk_label(ctx, "The TIKI-100 was a Norwegian CP/M-compatible computer", NK_TEXT_LEFT);
      nk_layout_row_dynamic(ctx, 20, 1);
      nk_label(ctx, "launched in 1984 by Tiki Data.", NK_TEXT_LEFT);
      nk_layout_row_dynamic(ctx, 18, 1);
      {
        char ver[128];
#ifdef TIKI100_VERSION
        snprintf(ver, sizeof(ver), "Emulator version %s  (built %s %s)",
                 TIKI100_VERSION, __DATE__, __TIME__);
#else
        snprintf(ver, sizeof(ver), "Emulator version unknown  (built %s %s)",
                 __DATE__, __TIME__);
#endif
        {
          struct nk_color saved = ctx->style.text.color;
          ctx->style.text.color = nk_rgb(140, 140, 140);
          nk_label(ctx, ver, NK_TEXT_LEFT);
          ctx->style.text.color = saved;
        }
      }
      nk_group_end(ctx);
    }
  }

  nk_layout_row_dynamic(ctx, 8, 1);
  nk_spacing(ctx, 1);

  /* Two-column info panels */
  nk_layout_row_dynamic(ctx, 180, 2);

  /* Hardware panel */
  if (nk_group_begin_titled(ctx, "hw_panel", "Hardware",
                            NK_WINDOW_BORDER | NK_WINDOW_TITLE)) {
    float ratios[] = {0.35f, 0.65f};

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "CPU", NK_TEXT_LEFT);
    nk_label(ctx, "Zilog Z80A @ 4 MHz", NK_TEXT_LEFT);

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "RAM", NK_TEXT_LEFT);
    nk_label(ctx, "64 KB + 32 KB VRAM", NK_TEXT_LEFT);

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "ROM", NK_TEXT_LEFT);
    nk_label(ctx, "TIKI-ROM V2.03 W", NK_TEXT_LEFT);

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "Sound", NK_TEXT_LEFT);
    nk_label(ctx, "AY-3-8912 PSG", NK_TEXT_LEFT);

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "FDC", NK_TEXT_LEFT);
    nk_label(ctx, "FD1771", NK_TEXT_LEFT);

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "HDC", NK_TEXT_LEFT);
    nk_label(ctx, "WD1010", NK_TEXT_LEFT);

    nk_group_end(ctx);
  }

  /* Credits panel */
  if (nk_group_begin_titled(ctx, "credits_panel", "Credits",
                            NK_WINDOW_BORDER | NK_WINDOW_TITLE)) {
    float ratios[] = {0.45f, 0.55f};

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "Original emulator", NK_TEXT_LEFT);
    nk_label(ctx, "A. Djupdal (2000-2001)", NK_TEXT_LEFT);

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "Z80 CPU", NK_TEXT_LEFT);
    nk_label(ctx, "Marat Fayzullin", NK_TEXT_LEFT);

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "AY-3-8912 sound", NK_TEXT_LEFT);
    nk_label(ctx, "MAME (Couriersud)", NK_TEXT_LEFT);

    nk_layout_row(ctx, NK_DYNAMIC, 18, 2, ratios);
    nk_label(ctx, "WD1010 HDC", NK_TEXT_LEFT);
    nk_label(ctx, "RetroCore (R. Hansen)", NK_TEXT_LEFT);

    nk_group_end(ctx);
  }

  nk_layout_row_dynamic(ctx, 8, 1);
  nk_spacing(ctx, 1);

  /* Source link */
  {
    struct nk_color saved = ctx->style.text.color;
    ctx->style.text.color = nk_rgb(130, 130, 130);
    nk_layout_row_dynamic(ctx, 18, 1);
    nk_label(ctx, "Source: github.com/HackerCorpLabs/tiki100", NK_TEXT_LEFT);
    ctx->style.text.color = saved;
  }
}

/*****************************************************************************/
/* Public API                                                                */
/*****************************************************************************/

void menuInit(SDL_Window *win, SDL_Renderer *rend) {
  struct nk_font_atlas *atlas;

  menuWin = win;
  menuRend = rend;

  ctx = nk_sdl_init(win, rend);

  {
    struct nk_font *font;
    nk_sdl_font_stash_begin(&atlas);
    font = nk_font_atlas_add_default(atlas, 14.0f, NULL);
    nk_sdl_font_stash_end();
    if (font) {
      nk_style_set_font(ctx, &font->handle);
    } else {
      fprintf(stderr, "Menu: WARNING - failed to load default font\n");
    }
  }

  setDarkTheme(ctx);

  /* Load floppy catalogs */
  catalogCount = 0;
  parseCatalog("disks/boot/floppies.json", "disks/boot/", "boot",
               catalogFile, catalogLabel, catalogSize, catalogTag,
               &catalogCount, MAX_CATALOG);
  parseCatalog("disks/library/floppies.json", "disks/library/", "app",
               catalogFile, catalogLabel, catalogSize, catalogTag,
               &catalogCount, MAX_CATALOG);

  /* Load ROM catalog */
  romCount = 0;
  parseCatalog("rom/roms.json", "rom/", "",
               romFile, romLabel, (int[MAX_CATALOG]){0}, (char[MAX_CATALOG][16]){{0}},
               &romCount, MAX_CATALOG);

  if (catalogCount > 0)
    printf("Menu: Loaded %d floppy images from catalogs\n", catalogCount);
  if (romCount > 0)
    printf("Menu: Loaded %d ROMs from catalog\n", romCount);
}

void menuShutdown(void) {
  if (ctx) {
    nk_sdl_shutdown();
    ctx = NULL;
  }
}

int menuIsOpen(void) {
  return isOpen;
}

void menuOpen(void) {
  isOpen = 1;
  SDL_StartTextInput();
}

void menuClose(void) {
  isOpen = 0;
  SDL_StopTextInput();
}

/* Pass mouse coords through unchanged.
 *
 * Why: Nuklear's SDL backend (SDL_RenderGeometryRaw) renders at raw pixel
 * coords on the SDL2 build we're using -- it does NOT apply the renderer's
 * logical-size scale, even though SDL_RenderFillRect does. So the menu's
 * tab buttons live at the same raw pixel positions whether the window is
 * its native 1024x536 or maximized to 2560x1369. Dividing mouse coords by
 * the logical-size scale would push every click into the top-left corner
 * of Nuklear's logical space, which is why every click was landing on the
 * Machine tab (or its title bar) when maximized.
 *
 * Note: a follow-up fix should make the Nuklear render path actually scale
 * up so the menu visually fills the window. Until then, the menu stays at
 * its native size in the top-left corner of a maximized window, but every
 * click is correctly routed. */
static void winToLogical(int winX, int winY, int *logX, int *logY) {
  *logX = winX;
  *logY = winY;
}

void menuHandleEvent(SDL_Event *event) {
  if (!ctx) return;

  SDL_Event ev = *event;
  switch (ev.type) {
    case SDL_MOUSEBUTTONDOWN:
    case SDL_MOUSEBUTTONUP: {
      int lx, ly;
      winToLogical(ev.button.x, ev.button.y, &lx, &ly);
      ev.button.x = lx;
      ev.button.y = ly;
      break;
    }
    case SDL_MOUSEMOTION: {
      int lx, ly;
      winToLogical(ev.motion.x, ev.motion.y, &lx, &ly);
      ev.motion.x = lx;
      ev.motion.y = ly;
      break;
    }
  }

  nk_sdl_handle_event(&ev);
}

void menuBeginInput(void) {
  if (ctx) nk_input_begin(ctx);
}

void menuEndInput(void) {
  if (ctx) {
    nk_input_end(ctx);
    if (ctx->input.mouse.grab) {
      ctx->input.mouse.grab = 0;
      ctx->input.mouse.grabbed = 1;
    }
    if (ctx->input.mouse.ungrab) {
      ctx->input.mouse.ungrab = 0;
      ctx->input.mouse.grabbed = 0;
    }
  }
}

void menuRender(void) {
  const char *tabNames[] = {"Machine", "Floppy", "Hard Disk", "Serial", "About"};
  int numTabs = 5;
  int i;

  if (!ctx || !isOpen) return;

  /* Dark overlay */
  SDL_SetRenderDrawBlendMode(menuRend, SDL_BLENDMODE_BLEND);
  SDL_SetRenderDrawColor(menuRend, 0, 0, 0, 160);
  {
    SDL_Rect overlay = {0, 0, 1024, 536};
    SDL_RenderFillRect(menuRend, &overlay);
  }

  if (nk_begin(ctx, "TIKI-100 Configuration  |  F12 / Esc to close",
               nk_rect(MENU_X, MENU_Y, MENU_W, MENU_HT),
               NK_WINDOW_BORDER | NK_WINDOW_TITLE | NK_WINDOW_MOVABLE)) {

    /* Tab bar */
    nk_layout_row_dynamic(ctx, 30, numTabs);
    for (i = 0; i < numTabs; i++) {
      if (tabButton(ctx, tabNames[i], activeTab == i)) {
        activeTab = i;
      }
    }

    nk_layout_row_dynamic(ctx, 8, 1);
    nk_spacing(ctx, 1);

    /* Tab content */
    switch (activeTab) {
      case 0: renderMachineTab(); break;
      case 1: renderFloppyTab(); break;
      case 2: renderHDDTab(); break;
      case 3: renderSerialTab(); break;
      case 4: renderAboutTab(); break;
    }
  }
  nk_end(ctx);

  nk_sdl_render(NK_ANTI_ALIASING_ON);
}

/* --- Action queries --- */

int menuWantsMountFloppy(int *drive, char *path, int pathmax) {
  if (!pendMountFloppy) return 0;
  pendMountFloppy = 0;
  *drive = pendMountFloppyDrive;
  strncpy(path, pendMountFloppyPath, pathmax - 1);
  path[pathmax - 1] = '\0';
  return 1;
}

int menuWantsEjectFloppy(int *drive) {
  if (!pendEjectFloppy) return 0;
  pendEjectFloppy = 0;
  *drive = pendEjectFloppyDrive;
  return 1;
}

int menuWantsMountHDD(int *drive, char *path, int pathmax) {
  if (!pendMountHDD) return 0;
  pendMountHDD = 0;
  *drive = pendMountHDDDrive;
  strncpy(path, pendMountHDDPath, pathmax - 1);
  path[pathmax - 1] = '\0';
  return 1;
}

int menuWantsEjectHDD(int *drive) {
  if (!pendEjectHDD) return 0;
  pendEjectHDD = 0;
  *drive = pendEjectHDDDrive;
  return 1;
}

int menuWantsSpeedChange(int *speedIndex) {
  if (!pendSpeedChange) return 0;
  pendSpeedChange = 0;
  *speedIndex = pendSpeedValue;
  return 1;
}

int menuWantsVolumeChange(int *volume) {
  if (!pendVolumeChange) return 0;
  pendVolumeChange = 0;
  *volume = pendVolumeValue;
  return 1;
}

int menuWantsROMChange(char *path, int pathmax) {
  if (!pendROMChange) return 0;
  pendROMChange = 0;
  strncpy(path, pendROMPath, pathmax - 1);
  path[pathmax - 1] = '\0';
  return 1;
}

int menuWantsReboot(void) {
  if (!pendReboot) return 0;
  pendReboot = 0;
  return 1;
}

/* --- State setters --- */

void menuSetFloppyMounted(int drive, const char *filename) {
  if (drive < 0 || drive > 1) return;
  curFloppyMounted[drive] = 1;
  strncpy(curFloppyFile[drive], filename, 255);
  curFloppyFile[drive][255] = '\0';
}

void menuSetFloppyEjected(int drive) {
  if (drive < 0 || drive > 1) return;
  curFloppyMounted[drive] = 0;
  curFloppyFile[drive][0] = '\0';
}

void menuSetHDDMounted(int drive, const char *filename) {
  if (drive < 0 || drive > 1) return;
  curHDDMounted[drive] = 1;
  strncpy(curHDDFile[drive], filename, 255);
  curHDDFile[drive][255] = '\0';
}

void menuSetHDDEjected(int drive) {
  if (drive < 0 || drive > 1) return;
  curHDDMounted[drive] = 0;
  curHDDFile[drive][0] = '\0';
}

void menuSetCPUSpeed(int speedIndex) {
  if (speedIndex < 0) speedIndex = 0;
  if (speedIndex >= SPEED_COUNT) speedIndex = SPEED_COUNT - 1;
  curSpeedIndex = speedIndex;
}

void menuSetVolume(int volume) {
  curVolume = volume;
}

/* --- Serial port actions --- */

int menuWantsSerialConfigure(int *channel, int *mode,
                             char *host, int hostmax, int *port) {
  if (!pendSerial) return 0;
  pendSerial = 0;
  *channel = (pendSerialChannel == 0) ? 1 : 0;
  *mode    = pendSerialMode;
  strncpy(host, pendSerialHost, hostmax - 1);
  host[hostmax - 1] = '\0';
  *port = pendSerialPort;
  return 1;
}

void menuSetSerialConfig(int channel, int mode, const char *host, int port) {
  int d = (channel == 1) ? 0 : 1;
  if (d < 0 || d > 1) return;
  curSerialMode[d] = mode;
  curSerialPort[d] = port;
  strncpy(curSerialHost[d], host ? host : "", sizeof(curSerialHost[d]) - 1);
  curSerialHost[d][sizeof(curSerialHost[d]) - 1] = '\0';
  serialMode[d] = mode;
  snprintf(serialPortBuf[d], sizeof(serialPortBuf[d]), "%d", port);
  serialPortBufLen[d] = (int)strlen(serialPortBuf[d]);
  strncpy(serialHost[d], host ? host : "", sizeof(serialHost[d]) - 1);
  serialHost[d][sizeof(serialHost[d]) - 1] = '\0';
  serialHostLen[d] = (int)strlen(serialHost[d]);
}
