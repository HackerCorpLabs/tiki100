/**
 * Virtual TIKI-100 keyboard — shared DOM component.
 *
 * Renders the ND-246 keyboard layout with clickable keys.
 * A single instance can target any connected Terminal via dropdown.
 * Supports full layout (all ~90 keys) and compact layout (special keys only).
 */

import type { Terminal } from './terminal-stub';
import { Tiki100KeyRegistry, TikiKeyColor, TikiKeyFlags } from './Tiki100KeyRegistry';
import type { TikiKeyDefinition, TikiKeyLabel, LanguageCode } from './Tiki100KeyRegistry';

/* Re-export so JS wrapper can access the registry via TikiKeyboard.Tiki100KeyRegistry */
export { Tiki100KeyRegistry };

export type VirtualKeyboardLayout = 'full' | 'compact';

interface AttachedTerminal {
  terminal: Terminal;
  label: string;
}

/** Key rendering metadata for layout positioning */
interface KeyLayout {
  gridPos: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Layout constants
const STD_SIZE = 60;
const SPACING = 5;
const MAIN_X = 20;
const NAV_X = 1074;
const FUNC_X = 1314;

// Font sizes
const FONT_SINGLE_KEY = 21;    // Single letter/digit keys (no shift label)
const FONT_LABEL = 11;         // Multi-char labels and shifted keys
const FONT_LONG_LABEL = 9;    // Labels longer than 4 chars

// Row Y positions (A=bottom to E=top) — G and F rows removed for TIKI-100
const ROW_Y: Record<string, number> = {
  'A': 260, 'B': 195, 'C': 130, 'D': 65, 'E': 0,
};

// Special key dimensions
const CAPS_WIDTH = 105;
const SHIFT_WIDTH = 128;
const SPACE_WIDTH = 300;
const RETURN_HEIGHT = 125;  // Double height
const KP0_WIDTH = 125;     // Double width
const RIGHT_COL_X = 975;   // Column for DEL, LF, RETURN (right of main area)
const RSHIFT_WIDTH = 102;  // Narrower than LSHIFT to not overlap RETURN

function navX(col: number): number { return NAV_X + col * (STD_SIZE + SPACING); }
function funcX(col: number): number { return FUNC_X + col * (STD_SIZE + SPACING); }
function mainX(col: number): number { return MAIN_X + col * (STD_SIZE + SPACING); }

/** Build the layout positions for all keys */
function buildKeyLayouts(): KeyLayout[] {
  const layouts: KeyLayout[] = [];
  const add = (gridPos: string, x: number, y: number, w: number = STD_SIZE, h: number = STD_SIZE) => {
    layouts.push({ gridPos, x, y, width: w, height: h });
  };

  // G-row and F-row removed for TIKI-100

  // E-row (number row)
  add('E0', mainX(0), ROW_Y['E'], CAPS_WIDTH);
  for (let i = 1; i <= 12; i++) add(`E${i}`, MAIN_X + CAPS_WIDTH + SPACING + (i - 1) * (STD_SIZE + SPACING), ROW_Y['E']);
  add('E13', MAIN_X + CAPS_WIDTH + SPACING + 12 * (STD_SIZE + SPACING), ROW_Y['E']);
  add('E14', RIGHT_COL_X, ROW_Y['E']);
  // E47-E49: F1-F3 in nav area
  add('E47', navX(0), ROW_Y['E']);
  add('E48', navX(1), ROW_Y['E']);
  add('E49', navX(2), ROW_Y['E']);
  // E-row function keys: F1-F3 + numpad /
  add('E51', funcX(0), ROW_Y['E']);
  add('E52', funcX(1), ROW_Y['E']);
  add('E53', funcX(2), ROW_Y['E']);
  add('E54', funcX(3), ROW_Y['E']);

  // D-row (QWERTY)
  add('D99', mainX(0), ROW_Y['D']);
  add('D0', mainX(1), ROW_Y['D']);
  for (let i = 1; i <= 12; i++) add(`D${i}`, mainX(i + 1), ROW_Y['D']);
  add('D13', RIGHT_COL_X + STD_SIZE - CAPS_WIDTH, ROW_Y['D'], CAPS_WIDTH);
  add('D47', navX(0), ROW_Y['D']);
  add('D48', navX(1), ROW_Y['D']);
  add('D49', navX(2), ROW_Y['D']);
  add('D51', funcX(0), ROW_Y['D']);
  add('D52', funcX(1), ROW_Y['D']);
  add('D53', funcX(2), ROW_Y['D']);
  add('D54', funcX(3), ROW_Y['D']);

  // C-row (ASDF)
  add('C99', mainX(0), ROW_Y['C']);
  add('C0', mainX(1), ROW_Y['C'], CAPS_WIDTH);
  for (let i = 1; i <= 12; i++) add(`C${i}`, mainX(1) + CAPS_WIDTH + SPACING + (i - 1) * (STD_SIZE + SPACING), ROW_Y['C']);
  add('C13', RIGHT_COL_X, ROW_Y['C'], STD_SIZE, RETURN_HEIGHT);
  add('C47', navX(0), ROW_Y['C']);
  add('C48', navX(1), ROW_Y['C']);
  add('C49', navX(2), ROW_Y['C']);
  add('C51', funcX(0), ROW_Y['C']);
  add('C52', funcX(1), ROW_Y['C']);
  add('C53', funcX(2), ROW_Y['C']);
  add('C54', funcX(3), ROW_Y['C']);

  // B-row (ZXCV)
  add('B99', mainX(0), ROW_Y['B'], SHIFT_WIDTH);
  for (let i = 0; i <= 10; i++) add(`B${i}`, MAIN_X + SHIFT_WIDTH + SPACING + i * (STD_SIZE + SPACING), ROW_Y['B']);
  add('B11', MAIN_X + SHIFT_WIDTH + SPACING + 11 * (STD_SIZE + SPACING), ROW_Y['B'], RSHIFT_WIDTH);
  add('B47', navX(0), ROW_Y['B']);
  add('B48', navX(1), ROW_Y['B']);
  add('B49', navX(2), ROW_Y['B']);
  add('B51', funcX(0), ROW_Y['B']);
  add('B52', funcX(1), ROW_Y['B']);
  add('B53', funcX(2), ROW_Y['B']);
  add('B54', funcX(3), ROW_Y['B'], STD_SIZE, RETURN_HEIGHT);

  // A-row (bottom) - spacebar from under X to under : (wider than TDV)
  const TIKI_SPACE_X = MAIN_X + SHIFT_WIDTH + SPACING + 1 * (STD_SIZE + SPACING); // under Z
  const TIKI_SPACE_END = MAIN_X + SHIFT_WIDTH + SPACING + 9 * (STD_SIZE + SPACING) + STD_SIZE; // end of .
  add('A5', TIKI_SPACE_X, ROW_Y['A'], TIKI_SPACE_END - TIKI_SPACE_X);
  add('A47', navX(0), ROW_Y['A']);
  add('A48', navX(1), ROW_Y['A']);
  add('A49', navX(2), ROW_Y['A']);
  add('A51', funcX(0), ROW_Y['A'], KP0_WIDTH);
  add('A53', funcX(2), ROW_Y['A']);

  return layouts;
}

const ALL_LAYOUTS = buildKeyLayouts();

// Compact mode: only show special/function keys (orange/brown), not alphanumeric
const COMPACT_GRID_POSITIONS = new Set([
  // TIKI-100 special keys only (no G/F rows)
  'E0', 'E13', 'E14', 'E51', 'E52', 'E53', 'E54',
  'D99', 'D13', 'D47', 'D48', 'D49', 'D51', 'D52', 'D53', 'D54',
  'C99', 'C13', 'C47', 'C48', 'C49',
  'B47', 'B48', 'B49',
  'A47', 'A48', 'A49',
]);

/** Arrow glyph definition for navigation keys */
interface NavArrowGlyph {
  dir: 'up' | 'down' | 'left' | 'right';
  style: 'single' | 'double' | 'tab' | 'home';
}

/** Navigation keys that should render SVG arrow glyphs instead of Unicode text */
const NAV_ARROW_GLYPHS: Record<string, NavArrowGlyph> = {
  'C47': { dir: 'up', style: 'double' },      // PgUp
  'C48': { dir: 'up', style: 'single' },      // UP
  'C49': { dir: 'down', style: 'double' },    // PgDn
  'B47': { dir: 'left', style: 'single' },    // LEFT
  'B48': { dir: 'left', style: 'home' },      // HOME
  'B49': { dir: 'right', style: 'single' },   // RIGHT
  'A47': { dir: 'left', style: 'tab' },       // TABLEFT
  'A48': { dir: 'down', style: 'single' },    // DOWN
  'A49': { dir: 'right', style: 'tab' },      // TABRIGHT
};

export class VirtualKeyboard {
  private static _nextId = 0;
  private _instanceId: number;
  private _container: HTMLElement;
  private _svgRoot: SVGSVGElement | null = null;
  private _terminals: AttachedTerminal[] = [];
  private _activeTerminal: Terminal | null = null;
  private _layout: VirtualKeyboardLayout = 'full';
  private _language: LanguageCode = 'no';
  private _visible: boolean = false;
  private _keyElements: Map<string, SVGGElement> = new Map();
  private _toggleLeds: Map<string, SVGCircleElement> = new Map();

  // LED state
  private _ledClear: boolean = false;
  private _ledSet: boolean = false;
  private _ledBlink: boolean = false;

  // Modifier state for virtual clicks
  private _shiftActive: boolean = false;
  private _ctrlActive: boolean = false;

  // Toggle key state (CAPS, LOCK)
  private _toggleStates: Map<string, boolean> = new Map();

  constructor(container: HTMLElement) {
    this._instanceId = VirtualKeyboard._nextId++;
    this._container = container;
    this.render();
  }

  // --- Terminal management ---

  attachTerminal(terminal: Terminal, label: string): void {
    this._terminals.push({ terminal, label });
    if (this._terminals.length === 1) {
      this._activeTerminal = terminal;
    }
    this.updateSelector();
  }

  detachTerminal(terminal: Terminal): void {
    const idx = this._terminals.findIndex(t => t.terminal === terminal);
    if (idx >= 0) {
      this._terminals.splice(idx, 1);
      if (this._activeTerminal === terminal) {
        this._activeTerminal = this._terminals.length > 0 ? this._terminals[0].terminal : null;
      }
      this.updateSelector();
    }
  }

  selectTerminal(terminal: Terminal): void {
    this._activeTerminal = terminal;
    this.updateSelector();
  }

  // --- Layout and visibility ---

  setLayout(mode: VirtualKeyboardLayout): void {
    if (this._layout === mode) return;
    this._layout = mode;
    this.render();
  }

  setLanguage(lang: LanguageCode): void {
    if (this._language === lang) return;
    this._language = lang;
    this.updateLabels();
  }

  show(): void { this._visible = true; this._container.style.display = 'block'; }
  hide(): void { this._visible = false; this._container.style.display = 'none'; }
  toggle(): void { this._visible ? this.hide() : this.show(); }

  get visible(): boolean { return this._visible; }
  get layout(): VirtualKeyboardLayout { return this._layout; }
  get language(): LanguageCode { return this._language; }

  // --- LED state ---
  updateLEDs(clear: boolean, set: boolean, blink: boolean): void {
    this._ledClear = clear;
    this._ledSet = set;
    this._ledBlink = blink;
    this.renderLEDIndicators();
  }

  /** Render LED indicator circles on the keyboard SVG */
  private renderLEDIndicators(): void {
    if (!this._svgRoot) return;

    // Remove existing LED indicators
    const existing = this._svgRoot.querySelectorAll('.retroterm-led');
    for (let i = 0; i < existing.length; i++) existing[i].remove();

    const ledDefs = [
      { label: 'CLR', on: this._ledClear, blink: false, x: 20, y: -15 },
      { label: 'SET', on: this._ledSet, blink: false, x: 80, y: -15 },
      { label: 'BLK', on: this._ledBlink, blink: true, x: 140, y: -15 },
    ];

    for (const led of ledDefs) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('retroterm-led');

      // LED circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(led.x));
      circle.setAttribute('cy', String(led.y));
      circle.setAttribute('r', '6');
      circle.setAttribute('fill', led.on ? '#00ff00' : '#333333');
      circle.setAttribute('stroke', '#666');
      circle.setAttribute('stroke-width', '1');

      // Blink animation
      if (led.on && led.blink) {
        const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animate.setAttribute('attributeName', 'fill');
        animate.setAttribute('values', '#00ff00;#333333;#00ff00');
        animate.setAttribute('dur', '1s');
        animate.setAttribute('repeatCount', 'indefinite');
        circle.appendChild(animate);
      }

      g.appendChild(circle);

      // LED label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(led.x));
      text.setAttribute('y', String(led.y + 18));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#999');
      text.setAttribute('font-size', '8');
      text.setAttribute('font-family', 'sans-serif');
      text.textContent = led.label;
      g.appendChild(text);

      this._svgRoot.appendChild(g);
    }
  }

  // --- Rendering ---

  private render(): void {
    this._container.innerHTML = '';
    this._keyElements.clear();
    this._toggleLeds.clear();

    const layouts = this._layout === 'compact'
      ? ALL_LAYOUTS.filter(l => COMPACT_GRID_POSITIONS.has(l.gridPos))
      : ALL_LAYOUTS;

    // Compute bounding box for viewBox
    let maxX = 0, maxY = 0;
    for (let i = 0; i < layouts.length; i++) {
      const l = layouts[i];
      const r = l.x + l.width;
      const b = l.y + l.height;
      if (r > maxX) maxX = r;
      if (b > maxY) maxY = b;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${maxX + 10} ${maxY + 10}`);
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.userSelect = 'none';
    svg.classList.add('retroterm-vk');
    this._svgRoot = svg;

    // Gradient definitions for 3D concave key effect
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradients: [string, string, string][] = [
      [`key-grad-white-${this._instanceId}`, '#F2EEE6', '#BEB7AA'],   // Light grey/white keys
      [`key-grad-orange-${this._instanceId}`, '#D4A43A', '#A97E2B'],  // Yellow/beige (ENTER, HJELP, UTVID)
      [`key-grad-brown-${this._instanceId}`, '#F08A3A', '#B55416'],   // Orange (arrows, function cluster)
    ];
    for (const [id, inner, outer] of gradients) {
      const grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
      grad.setAttribute('id', id);
      grad.setAttribute('cx', '50%');
      grad.setAttribute('cy', '40%');
      grad.setAttribute('r', '60%');
      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', inner);
      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', outer);
      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);
    }
    svg.appendChild(defs);

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(maxX + 10));
    bg.setAttribute('height', String(maxY + 10));
    bg.setAttribute('fill', '#D8D2C6');  // TIKI keyboard body
    bg.setAttribute('rx', '8');
    svg.appendChild(bg);

    // Render keys
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i];
      const keyDef = Tiki100KeyRegistry.getKey(layout.gridPos);
      if (!keyDef) continue;

      const g = this.createKeyElement(layout, keyDef);
      svg.appendChild(g);
      this._keyElements.set(layout.gridPos, g);
    }

    this._container.appendChild(svg);

    // Terminal selector (if multiple terminals)
    this.updateSelector();
  }

  private createKeyElement(layout: KeyLayout, keyDef: TikiKeyDefinition): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-grid', layout.gridPos);
    g.style.cursor = 'pointer';

    const cx = layout.x + layout.width / 2;
    const cy = layout.y + layout.height / 2;

    // Key background with gradient fill for 3D concave look
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(layout.x));
    rect.setAttribute('y', String(layout.y));
    rect.setAttribute('width', String(layout.width));
    rect.setAttribute('height', String(layout.height));
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', this.getKeyGradient(keyDef.color));
    rect.setAttribute('stroke', '#555');
    rect.setAttribute('stroke-width', '1');
    g.appendChild(rect);

    // Inner concave circle for standard-size keys
    const minDim = Math.min(layout.width, layout.height);
    if (minDim >= 50) {
      const inner = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      inner.setAttribute('cx', String(cx));
      inner.setAttribute('cy', String(cy));
      inner.setAttribute('rx', String(Math.min(layout.width * 0.38, 24)));
      inner.setAttribute('ry', String(Math.min(layout.height * 0.38, 24)));
      inner.setAttribute('fill', 'rgba(0,0,0,0.08)');
      inner.setAttribute('pointer-events', 'none');
      g.appendChild(inner);
    }

    // SVG glyph for special keys, or text labels
    const label = Tiki100KeyRegistry.getLabel(layout.gridPos, this._language);
    const textColor = this.getTextColor(keyDef.color);

    // Check if this nav key needs an SVG arrow glyph
    const arrowGlyph = NAV_ARROW_GLYPHS[layout.gridPos];

    if (layout.gridPos === 'C13' || layout.gridPos === 'B54') {
      // RETURN / KPENTER: curved return-arrow glyph
      this.addReturnGlyph(g, cx, cy, textColor);
    } else if (arrowGlyph) {
      // Navigation arrow SVG glyph
      this.addNavArrowGlyph(g, cx, cy, textColor, arrowGlyph);
    } else if (label && label.primary) {
      // Determine if this is a letter key (A/a, B/b etc.) — skip stacked display
      const isLetterKey = label.shifted !== null
        && label.primary.length === 1
        && label.shifted.length === 1
        && label.primary.toUpperCase() === label.primary
        && label.shifted === label.primary.toLowerCase();

      if (label.shifted && !isLetterKey) {
        // Stacked labels: shifted above center, primary below center
        const shiftText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        shiftText.setAttribute('x', String(cx));
        shiftText.setAttribute('y', String(cy - 6));
        shiftText.setAttribute('text-anchor', 'middle');
        shiftText.setAttribute('fill', textColor);
        shiftText.setAttribute('font-size', '11');
        shiftText.setAttribute('font-family', 'sans-serif');
        shiftText.setAttribute('font-weight', 'bold');
        shiftText.textContent = label.shifted;
        g.appendChild(shiftText);

        const primText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        primText.setAttribute('x', String(cx));
        primText.setAttribute('y', String(cy + 14));
        primText.setAttribute('text-anchor', 'middle');
        primText.setAttribute('fill', textColor);
        primText.setAttribute('font-size', '11');
        primText.setAttribute('font-family', 'sans-serif');
        primText.setAttribute('font-weight', 'bold');
        primText.textContent = label.primary;
        g.appendChild(primText);
      } else {
        // Single centered label (includes letter keys showing just uppercase)
        const isToggle = !!(keyDef.flags & TikiKeyFlags.IsToggle);
        const hasLed = isToggle || layout.gridPos === 'E0' || layout.gridPos === 'D13';
        const ledOnRight = layout.gridPos === 'D13';
        const labelX = hasLed ? (ledOnRight ? cx - 8 : cx + 8) : cx;

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(labelX));
        text.setAttribute('y', String(cy + 4));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', textColor);
        const fs = label.primary.length === 1 && !label.shifted ? FONT_SINGLE_KEY
          : label.primary.length > 4 ? FONT_LONG_LABEL : FONT_LABEL;
        text.setAttribute('font-size', String(fs));
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('font-weight', 'bold');
        text.textContent = label.primary;
        g.appendChild(text);

        // LED indicator for toggle keys and hardware-driven LEDs (GRAFIKK, HJELP)
        const hasHwLed = layout.gridPos === 'E0' || layout.gridPos === 'D13';
        if (isToggle || hasHwLed) {
          const led = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          const ledX = ledOnRight
            ? layout.x + layout.width - 14   // right side
            : layout.x + 14;                  // left side
          led.setAttribute('cx', String(ledX));
          led.setAttribute('cy', String(cy));
          led.setAttribute('r', '4');
          led.setAttribute('fill', '#333');
          led.setAttribute('stroke', '#666');
          led.setAttribute('stroke-width', '0.5');
          g.appendChild(led);
          this._toggleLeds.set(layout.gridPos, led);
        }
      }
    }

    // Click handler
    g.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      this.handleKeyClick(layout.gridPos, keyDef, ev as MouseEvent);
      rect.setAttribute('fill', this.getPressedColor(keyDef.color));
    });
    g.addEventListener('mouseup', () => {
      // Keep modifier keys visually pressed when active (sticky toggle)
      if ((keyDef.flags & TikiKeyFlags.IsModifier) && this.isModifierActive(keyDef.name)) {
        return;
      }
      rect.setAttribute('fill', this.getKeyGradient(keyDef.color));
    });
    g.addEventListener('mouseleave', () => {
      if ((keyDef.flags & TikiKeyFlags.IsModifier) && this.isModifierActive(keyDef.name)) {
        return;
      }
      rect.setAttribute('fill', this.getKeyGradient(keyDef.color));
    });

    return g;
  }

  /** Draw a curved return-arrow glyph (like a real keyboard) */
  private addReturnGlyph(g: SVGGElement, cx: number, cy: number, color: string): void {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // Curved arrow: down from top-right, left, with arrowhead
    const d = `M ${cx + 10} ${cy - 12} L ${cx + 10} ${cy + 2} Q ${cx + 10} ${cy + 6} ${cx + 6} ${cy + 6} L ${cx - 8} ${cy + 6} M ${cx - 8} ${cy + 6} L ${cx - 3} ${cy + 1} M ${cx - 8} ${cy + 6} L ${cx - 3} ${cy + 11}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('pointer-events', 'none');
    g.appendChild(path);
  }

  /** Draw a backspace/newpara arrow glyph (leftward arrow with bar) */
  private addBackspaceGlyph(g: SVGGElement, cx: number, cy: number, color: string): void {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // Leftward arrow with vertical bar at start
    const d = `M ${cx + 12} ${cy} L ${cx - 6} ${cy} M ${cx - 6} ${cy} L ${cx - 1} ${cy - 6} M ${cx - 6} ${cy} L ${cx - 1} ${cy + 6} M ${cx - 10} ${cy - 8} L ${cx - 10} ${cy + 8}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('pointer-events', 'none');
    g.appendChild(path);
  }

  /** Draw navigation arrow glyphs (single, double, or tab arrows) */
  private addNavArrowGlyph(g: SVGGElement, cx: number, cy: number, color: string, glyph: NavArrowGlyph): void {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const s = 10; // arrow half-size
    const hs = 6; // arrowhead size
    let d = '';

    if (glyph.style === 'single') {
      // Simple single arrow
      switch (glyph.dir) {
        case 'up':
          d = `M ${cx} ${cy - s} L ${cx} ${cy + s} M ${cx} ${cy - s} L ${cx - hs} ${cy - s + hs} M ${cx} ${cy - s} L ${cx + hs} ${cy - s + hs}`;
          break;
        case 'down':
          d = `M ${cx} ${cy + s} L ${cx} ${cy - s} M ${cx} ${cy + s} L ${cx - hs} ${cy + s - hs} M ${cx} ${cy + s} L ${cx + hs} ${cy + s - hs}`;
          break;
        case 'left':
          d = `M ${cx - s} ${cy} L ${cx + s} ${cy} M ${cx - s} ${cy} L ${cx - s + hs} ${cy - hs} M ${cx - s} ${cy} L ${cx - s + hs} ${cy + hs}`;
          break;
        case 'right':
          d = `M ${cx + s} ${cy} L ${cx - s} ${cy} M ${cx + s} ${cy} L ${cx + s - hs} ${cy - hs} M ${cx + s} ${cy} L ${cx + s - hs} ${cy + hs}`;
          break;
      }
    } else if (glyph.style === 'double') {
      // Arrow with a bar across the shaft (like tab arrows but vertical)
      // Same pattern as 'tab' style but for up/down
      switch (glyph.dir) {
        case 'up':
          d = `M ${cx-3} ${cy+s} L ${cx-3} ${cy-s+hs} M ${cx+3} ${cy+s} L ${cx+3} ${cy-s+hs} M ${cx} ${cy-s} L ${cx-hs} ${cy-s+hs} M ${cx} ${cy-s} L ${cx+hs} ${cy-s+hs}`;
          break;
        case 'down':
          d = `M ${cx-3} ${cy-s} L ${cx-3} ${cy+s-hs} M ${cx+3} ${cy-s} L ${cx+3} ${cy+s-hs} M ${cx} ${cy+s} L ${cx-hs} ${cy+s-hs} M ${cx} ${cy+s} L ${cx+hs} ${cy+s-hs}`;
          break;
        case 'left':
          d = `M ${cx+s} ${cy} L ${cx-s+4} ${cy} M ${cx-s+4} ${cy} L ${cx-s+4+hs} ${cy-hs} M ${cx-s+4} ${cy} L ${cx-s+4+hs} ${cy+hs} M ${cx-s} ${cy-8} L ${cx-s} ${cy+8}`;
          break;
        case 'right':
          d = `M ${cx-s} ${cy} L ${cx+s-4} ${cy} M ${cx+s-4} ${cy} L ${cx+s-4-hs} ${cy-hs} M ${cx+s-4} ${cy} L ${cx+s-4-hs} ${cy+hs} M ${cx+s} ${cy-8} L ${cx+s} ${cy+8}`;
          break;
      }
    } else if (glyph.style === 'home') {
      // Home: left arrow rotated 45deg clockwise = points up-left
      const d2 = 0.707; // cos(45) = sin(45)
      const sx2 = s * d2;
      const hx = hs * d2;
      d = `M ${cx - sx2} ${cy - sx2} L ${cx + sx2} ${cy + sx2} M ${cx - sx2} ${cy - sx2} L ${cx - sx2 + hx + hx} ${cy - sx2} M ${cx - sx2} ${cy - sx2} L ${cx - sx2} ${cy - sx2 + hx + hx}`;
    } else if (glyph.style === 'tab') {
      // Tab arrow (arrow with vertical bar at the end)
      switch (glyph.dir) {
        case 'left':
          d = `M ${cx + s} ${cy} L ${cx - s + 4} ${cy} M ${cx - s + 4} ${cy} L ${cx - s + 4 + hs} ${cy - hs} M ${cx - s + 4} ${cy} L ${cx - s + 4 + hs} ${cy + hs} M ${cx - s} ${cy - 8} L ${cx - s} ${cy + 8}`;
          break;
        case 'right':
          d = `M ${cx - s} ${cy} L ${cx + s - 4} ${cy} M ${cx + s - 4} ${cy} L ${cx + s - 4 - hs} ${cy - hs} M ${cx + s - 4} ${cy} L ${cx + s - 4 - hs} ${cy + hs} M ${cx + s} ${cy - 8} L ${cx + s} ${cy + 8}`;
          break;
      }
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('pointer-events', 'none');
    g.appendChild(path);
  }

  /** Check if a modifier key is currently active */
  private isModifierActive(name: string): boolean {
    if (name === 'LSHIFT' || name === 'RSHIFT') return this._shiftActive;
    if (name === 'CTRL') return this._ctrlActive;
    return false;
  }

  /** Update visual state of all modifier keys to match internal state */
  private updateModifierVisuals(): void {
    this.updateModifierKeyVisual('B99', this._shiftActive);
    this.updateModifierKeyVisual('B11', this._shiftActive);
    this.updateModifierKeyVisual('D0', this._ctrlActive);
  }

  private updateModifierKeyVisual(gridPos: string, active: boolean): void {
    const g = this._keyElements.get(gridPos);
    if (!g) return;
    const rect = g.querySelector('rect');
    const keyDef = Tiki100KeyRegistry.getKey(gridPos);
    if (rect && keyDef) {
      rect.setAttribute('fill', active ? this.getPressedColor(keyDef.color) : this.getKeyGradient(keyDef.color));
    }
  }

  private handleKeyClick(gridPos: string, keyDef: TikiKeyDefinition, ev?: MouseEvent): void {
    if (!this._activeTerminal) return;

    // Handle modifier keys (VK click toggles)
    if (keyDef.flags & TikiKeyFlags.IsModifier) {
      if (keyDef.name === 'LSHIFT' || keyDef.name === 'RSHIFT') {
        this._shiftActive = !this._shiftActive;
      } else if (keyDef.name === 'CTRL') {
        this._ctrlActive = !this._ctrlActive;
      }
      this.updateModifierVisuals();
      return;
    }

    // Handle toggle keys (CAPS, LOCK)
    if (keyDef.flags & TikiKeyFlags.IsToggle) {
      const current = this._toggleStates.get(gridPos) ?? false;
      this._toggleStates.set(gridPos, !current);
      this.updateToggleLED(gridPos, !current);
      return;
    }

    // Physical keyboard modifiers override VK sticky state
    if (ev) {
      if (ev.shiftKey) this._shiftActive = true;
      if (ev.ctrlKey) this._ctrlActive = true;
    }

    // Determine effective shift state.
    // TDV labels store uppercase as primary for letter keys (CAPS-as-default),
    // so we must distinguish letter keys from other keys.
    const capsActive = this._toggleStates.get('E0') ?? false;
    const label = Tiki100KeyRegistry.getLabel(gridPos, this._language);

    // Detect letter key: primary is a single uppercase letter, shifted is its lowercase
    const isLetterKey = label !== null
      && label.primary !== null && label.shifted !== null
      && label.primary.length === 1 && label.shifted.length === 1
      && label.primary.toUpperCase() === label.primary
      && label.shifted === label.primary.toLowerCase();

    let effectiveShift: boolean;
    if (isLetterKey) {
      effectiveShift = capsActive ? !this._shiftActive : this._shiftActive;
    } else {
      effectiveShift = this._shiftActive;
    }

    // Get sequence from registry
    const seq = Tiki100KeyRegistry.getSequence(
      gridPos, true, false,
      effectiveShift, this._ctrlActive,
    );

    if (seq !== null) {
      this.sendSequence(seq);
    } else if (label) {
      // No escape sequence -- fall back to ASCII based on label and shift state
      let ch: string | null = null;
      if (isLetterKey) {
        ch = effectiveShift ? label.primary : label.shifted;
      } else if (effectiveShift && label.shifted) {
        ch = label.shifted;
      } else if (label.primary && label.primary.length === 1) {
        ch = label.primary;
      }
      if (ch !== null && ch.length === 1) {
        if (this._ctrlActive) {
          const code = ch.toUpperCase().charCodeAt(0);
          if (code >= 0x40 && code <= 0x5F) {
            this.sendSequence(String.fromCharCode(code - 0x40));
          }
        } else {
          this.sendSequence(ch);
        }
      }
    }

    // Reset modifiers after key press (sticky behavior)
    this._shiftActive = false;
    this._ctrlActive = false;
    this.updateModifierVisuals();
  }

  /** Send a key sequence to the active terminal */
  private sendSequence(seq: string): void {
    if (!this._activeTerminal) return;
    const syntheticEvent = new KeyboardEvent('keydown', {
      key: seq,
      bubbles: false,
      cancelable: true,
    });
    (this._activeTerminal as any)._onKey?.fire({ key: seq, domEvent: syntheticEvent });
  }

  /** Set the toggle LED state for CAPS or LOCK keys */
  updateToggleLED(gridPos: string, active: boolean): void {
    const led = this._toggleLeds.get(gridPos);
    if (led) {
      led.setAttribute('fill', active ? '#00ff00' : '#333');
    }
  }

  private getKeyGradient(color: TikiKeyColor): string {
    switch (color) {
      case TikiKeyColor.Orange: return `url(#key-grad-orange-${this._instanceId})`;
      case TikiKeyColor.Brown: return `url(#key-grad-brown-${this._instanceId})`;
      case TikiKeyColor.White:
      default: return `url(#key-grad-white-${this._instanceId})`;
    }
  }

  private getKeyColor(color: TikiKeyColor): string {
    switch (color) {
      case TikiKeyColor.Orange: return '#c87828';
      case TikiKeyColor.Brown: return '#8b6914';
      case TikiKeyColor.White:
      default: return '#d4d4d4';
    }
  }

  private getPressedColor(color: TikiKeyColor): string {
    switch (color) {
      case TikiKeyColor.Orange: return '#a06020';
      case TikiKeyColor.Brown: return '#705510';
      case TikiKeyColor.White:
      default: return '#aaaaaa';
    }
  }

  private getTextColor(color: TikiKeyColor): string {
    switch (color) {
      case TikiKeyColor.Orange:
      case TikiKeyColor.Brown: return '#2B2B2B';  // Dark legends on colored keys
      case TikiKeyColor.White:
      default: return '#2B2B2B';  // Dark legends on all keys
    }
  }

  private updateLabels(): void {
    for (const [gridPos, g] of this._keyElements) {
      const label = Tiki100KeyRegistry.getLabel(gridPos, this._language);
      const texts = g.querySelectorAll('text');
      if (texts.length > 0 && label && label.primary) {
        texts[0].textContent = label.primary;
      }
      if (texts.length > 1 && label && label.shifted) {
        texts[1].textContent = label.shifted;
      }
    }
  }

  private updateSelector(): void {
    // Remove existing selector
    const existing = this._container.querySelector('.retroterm-vk-selector');
    if (existing) existing.remove();

    if (this._terminals.length <= 1) return;

    const select = document.createElement('select');
    select.className = 'retroterm-vk-selector';
    select.style.cssText = 'position:absolute;top:4px;right:4px;font-size:12px;';

    for (let i = 0; i < this._terminals.length; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = this._terminals[i].label;
      if (this._terminals[i].terminal === this._activeTerminal) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      const idx = parseInt(select.value, 10);
      if (idx >= 0 && idx < this._terminals.length) {
        this._activeTerminal = this._terminals[idx].terminal;
      }
    });

    this._container.style.position = 'relative';
    this._container.appendChild(select);
  }

  /** Visually press a key by VK code (for physical keyboard sync) */
  highlightKey(vkCode: number): void {
    const gridPos = Tiki100KeyRegistry.getGridForVK(vkCode);
    if (!gridPos) return;
    this.highlightGridKey(gridPos);
  }

  /** Visually release a key by VK code */
  unhighlightKey(vkCode: number): void {
    const gridPos = Tiki100KeyRegistry.getGridForVK(vkCode);
    if (!gridPos) return;
    this.unhighlightGridKey(gridPos);
  }

  /** Visually press a key by grid position directly */
  highlightGridKey(gridPos: string): void {
    const g = this._keyElements.get(gridPos);
    if (!g) return;
    const rect = g.querySelector('rect');
    const keyDef = Tiki100KeyRegistry.getKey(gridPos);
    if (rect && keyDef) rect.setAttribute('fill', this.getPressedColor(keyDef.color));
  }

  /** Visually release a key by grid position directly */
  unhighlightGridKey(gridPos: string): void {
    const g = this._keyElements.get(gridPos);
    if (!g) return;
    const rect = g.querySelector('rect');
    const keyDef = Tiki100KeyRegistry.getKey(gridPos);
    if (rect && keyDef) rect.setAttribute('fill', this.getKeyGradient(keyDef.color));
  }

  /** Clean up DOM elements */
  dispose(): void {
    this._container.innerHTML = '';
    this._keyElements.clear();
    this._terminals.length = 0;
    this._activeTerminal = null;
    this._svgRoot = null;
  }
}
