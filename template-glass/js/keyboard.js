var TikiKeyboard = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ts/keyboard/VirtualKeyboard.ts
  var VirtualKeyboard_exports = {};
  __export(VirtualKeyboard_exports, {
    Tiki100KeyRegistry: () => Tiki100KeyRegistry,
    VirtualKeyboard: () => VirtualKeyboard
  });

  // ts/keyboard/Tiki100KeyRegistry.ts
  var _keys = /* @__PURE__ */ new Map();
  var _labels = /* @__PURE__ */ new Map();
  var _vkToGrid = /* @__PURE__ */ new Map();
  var _nameToGrid = /* @__PURE__ */ new Map();
  function mkKey(id, name, color, flags, vk) {
    return {
      id,
      name,
      color,
      flags,
      virtualKeyCode: vk,
      extNormal: null,
      extShift: null,
      extCtrl: null,
      simpleAscii: null,
      numPadFunc: null,
      isProgrammable: false,
      alwaysSameCode: !!(flags & 8 /* AlwaysSameCode */),
      isNumericPad: !!(flags & 16 /* IsNumericPad */)
    };
  }
  function reg(id, name, color, flags, vk) {
    _keys.set(id, mkKey(id, name, color, flags, vk));
    _nameToGrid.set(name.toLowerCase(), id);
    if (vk > 0 && !_vkToGrid.has(vk)) _vkToGrid.set(vk, id);
  }
  function lbl(id, primary, shifted) {
    _labels.set(id + "_no", { primary, shifted, alternative: null });
    _labels.set(id + "_en", { primary, shifted, alternative: null });
  }
  reg("E0", "GRAFIKK", 1 /* Orange */, 0 /* None */, 132);
  reg("E1", "1", 0 /* White */, 0 /* None */, 49);
  reg("E2", "2", 0 /* White */, 0 /* None */, 50);
  reg("E3", "3", 0 /* White */, 0 /* None */, 51);
  reg("E4", "4", 0 /* White */, 0 /* None */, 52);
  reg("E5", "5", 0 /* White */, 0 /* None */, 53);
  reg("E6", "6", 0 /* White */, 0 /* None */, 54);
  reg("E7", "7", 0 /* White */, 0 /* None */, 55);
  reg("E8", "8", 0 /* White */, 0 /* None */, 56);
  reg("E9", "9", 0 /* White */, 0 /* None */, 57);
  reg("E10", "0", 0 /* White */, 0 /* None */, 48);
  reg("E11", "PLUS", 0 /* White */, 0 /* None */, 43);
  reg("E12", "AT", 0 /* White */, 0 /* None */, 64);
  reg("E13", "UTVID", 1 /* Orange */, 0 /* None */, 5);
  reg("E14", "SLETT", 1 /* Orange */, 0 /* None */, 127);
  reg("E47", "F1", 0 /* White */, 0 /* None */, 1);
  reg("E48", "F2", 0 /* White */, 0 /* None */, 2);
  reg("E49", "F3", 0 /* White */, 0 /* None */, 6);
  reg("E51", "KPMULT", 0 /* White */, 16 /* IsNumericPad */, 170);
  reg("E52", "KPMINUS2", 0 /* White */, 16 /* IsNumericPad */, 173);
  reg("E53", "KPDIV", 0 /* White */, 16 /* IsNumericPad */, 175);
  reg("E54", "KPPERCENT", 0 /* White */, 16 /* IsNumericPad */, 165);
  reg("D99", "BRYT", 1 /* Orange */, 0 /* None */, 3);
  reg("D0", "CTRL", 0 /* White */, 1 /* IsModifier */, 129);
  reg("D1", "Q", 0 /* White */, 0 /* None */, 113);
  reg("D2", "W", 0 /* White */, 0 /* None */, 119);
  reg("D3", "E", 0 /* White */, 0 /* None */, 101);
  reg("D4", "R", 0 /* White */, 0 /* None */, 114);
  reg("D5", "T", 0 /* White */, 0 /* None */, 116);
  reg("D6", "Y", 0 /* White */, 0 /* None */, 121);
  reg("D7", "U", 0 /* White */, 0 /* None */, 117);
  reg("D8", "I", 0 /* White */, 0 /* None */, 105);
  reg("D9", "O", 0 /* White */, 0 /* None */, 111);
  reg("D10", "P", 0 /* White */, 0 /* None */, 112);
  reg("D11", "AA", 0 /* White */, 0 /* None */, 229);
  reg("D12", "CARET", 0 /* White */, 0 /* None */, 94);
  reg("D13", "HJELP", 1 /* Orange */, 0 /* None */, 10);
  reg("D47", "F4", 0 /* White */, 0 /* None */, 7);
  reg("D48", "F5", 0 /* White */, 0 /* None */, 14);
  reg("D49", "F6", 0 /* White */, 0 /* None */, 15);
  reg("D51", "KP7", 0 /* White */, 16 /* IsNumericPad */, 183);
  reg("D52", "KP8", 0 /* White */, 16 /* IsNumericPad */, 184);
  reg("D53", "KP9", 0 /* White */, 16 /* IsNumericPad */, 185);
  reg("D54", "KPPLUS", 0 /* White */, 16 /* IsNumericPad */, 171);
  reg("C99", "ANGRE", 1 /* Orange */, 0 /* None */, 26);
  reg("C0", "LOCK", 0 /* White */, 2 /* IsToggle */, 131);
  reg("C1", "A", 0 /* White */, 0 /* None */, 97);
  reg("C2", "S", 0 /* White */, 0 /* None */, 115);
  reg("C3", "D", 0 /* White */, 0 /* None */, 100);
  reg("C4", "F", 0 /* White */, 0 /* None */, 102);
  reg("C5", "G", 0 /* White */, 0 /* None */, 103);
  reg("C6", "H", 0 /* White */, 0 /* None */, 104);
  reg("C7", "J", 0 /* White */, 0 /* None */, 106);
  reg("C8", "K", 0 /* White */, 0 /* None */, 107);
  reg("C9", "L", 0 /* White */, 0 /* None */, 108);
  reg("C10", "OE", 0 /* White */, 0 /* None */, 248);
  reg("C11", "AE", 0 /* White */, 0 /* None */, 230);
  reg("C12", "QUOTE", 0 /* White */, 0 /* None */, 39);
  reg("C13", "RETURN", 1 /* Orange */, 8 /* AlwaysSameCode */, 13);
  reg("C47", "PGUP", 2 /* Brown */, 0 /* None */, 23);
  reg("C48", "UP", 2 /* Brown */, 8 /* AlwaysSameCode */, 11);
  reg("C49", "PGDN", 2 /* Brown */, 0 /* None */, 31);
  reg("C51", "KP4", 0 /* White */, 16 /* IsNumericPad */, 180);
  reg("C52", "KP5", 0 /* White */, 16 /* IsNumericPad */, 181);
  reg("C53", "KP6", 0 /* White */, 16 /* IsNumericPad */, 182);
  reg("C54", "KPEQU", 0 /* White */, 16 /* IsNumericPad */, 189);
  reg("B99", "LSHIFT", 0 /* White */, 1 /* IsModifier */, 130);
  reg("B0", "LTGT", 0 /* White */, 0 /* None */, 60);
  reg("B1", "Z", 0 /* White */, 0 /* None */, 122);
  reg("B2", "X", 0 /* White */, 0 /* None */, 120);
  reg("B3", "C", 0 /* White */, 0 /* None */, 99);
  reg("B4", "V", 0 /* White */, 0 /* None */, 118);
  reg("B5", "B", 0 /* White */, 0 /* None */, 98);
  reg("B6", "N", 0 /* White */, 0 /* None */, 110);
  reg("B7", "M", 0 /* White */, 0 /* None */, 109);
  reg("B8", "COMMA", 0 /* White */, 0 /* None */, 44);
  reg("B9", "PERIOD", 0 /* White */, 0 /* None */, 46);
  reg("B10", "MINUS", 0 /* White */, 0 /* None */, 45);
  reg("B11", "RSHIFT", 0 /* White */, 1 /* IsModifier */, 130);
  reg("B47", "LEFT", 2 /* Brown */, 8 /* AlwaysSameCode */, 8);
  reg("B48", "HOME", 2 /* Brown */, 8 /* AlwaysSameCode */, 9);
  reg("B49", "RIGHT", 2 /* Brown */, 8 /* AlwaysSameCode */, 12);
  reg("B51", "KP1", 0 /* White */, 16 /* IsNumericPad */, 177);
  reg("B52", "KP2", 0 /* White */, 16 /* IsNumericPad */, 178);
  reg("B53", "KP3", 0 /* White */, 16 /* IsNumericPad */, 179);
  reg("B54", "KPENTER", 1 /* Orange */, 16 /* IsNumericPad */, 141);
  reg("A5", "SPACE", 0 /* White */, 0 /* None */, 32);
  reg("A47", "TABLEFT", 2 /* Brown */, 0 /* None */, 29);
  reg("A48", "DOWN", 2 /* Brown */, 8 /* AlwaysSameCode */, 28);
  reg("A49", "TABRIGHT", 2 /* Brown */, 0 /* None */, 24);
  reg("A51", "KP0", 0 /* White */, 16 /* IsNumericPad */, 176);
  reg("A53", "KPDOT", 0 /* White */, 16 /* IsNumericPad */, 174);
  lbl("E0", "GRAF\nIKK", null);
  lbl("E1", "1", "!");
  lbl("E2", "2", '"');
  lbl("E3", "3", "#");
  lbl("E4", "4", "$");
  lbl("E5", "5", "%");
  lbl("E6", "6", "&");
  lbl("E7", "7", "/");
  lbl("E8", "8", "(");
  lbl("E9", "9", ")");
  lbl("E10", "0", "=");
  lbl("E11", "+", "?");
  lbl("E12", "@", "`");
  lbl("E13", "UTVID", null);
  lbl("E14", "SLETT", null);
  lbl("E47", "F1", null);
  lbl("E48", "F2", null);
  lbl("E49", "F3", null);
  lbl("E51", "*", null);
  lbl("E52", "-", null);
  lbl("E53", "/", null);
  lbl("E54", "%", null);
  lbl("D99", "BRYT", null);
  lbl("D0", "CTRL", null);
  lbl("D1", "Q", null);
  lbl("D2", "W", null);
  lbl("D3", "E", null);
  lbl("D4", "R", null);
  lbl("D5", "T", null);
  lbl("D6", "Y", null);
  lbl("D7", "U", null);
  lbl("D8", "I", null);
  lbl("D9", "O", null);
  lbl("D10", "P", null);
  lbl("D11", "\xC5", null);
  lbl("D12", "^", "~");
  lbl("D13", "HJELP", null);
  lbl("D47", "F4", null);
  lbl("D48", "F5", null);
  lbl("D49", "F6", null);
  lbl("D51", "7", null);
  lbl("D52", "8", null);
  lbl("D53", "9", null);
  lbl("D54", "+", null);
  lbl("C99", "ANGRE", null);
  lbl("C0", "LOCK", null);
  lbl("C1", "A", null);
  lbl("C2", "S", null);
  lbl("C3", "D", null);
  lbl("C4", "F", null);
  lbl("C5", "G", null);
  lbl("C6", "H", null);
  lbl("C7", "J", null);
  lbl("C8", "K", null);
  lbl("C9", "L", null);
  lbl("C10", "\xD8", null);
  lbl("C11", "\xC6", null);
  lbl("C12", "'", "*");
  lbl("C13", null, null);
  lbl("C47", "\u21D1", null);
  lbl("C48", null, null);
  lbl("C49", "\u21D3", null);
  lbl("C51", "4", null);
  lbl("C52", "5", null);
  lbl("C53", "6", null);
  lbl("C54", "=", null);
  lbl("B99", "SHIFT", null);
  lbl("B0", "<", ">");
  lbl("B1", "Z", null);
  lbl("B2", "X", null);
  lbl("B3", "C", null);
  lbl("B4", "V", null);
  lbl("B5", "B", null);
  lbl("B6", "N", null);
  lbl("B7", "M", null);
  lbl("B8", ",", ";");
  lbl("B9", ".", ":");
  lbl("B10", "-", "_");
  lbl("B11", "SHIFT", null);
  lbl("B47", null, null);
  lbl("B48", "HOME", null);
  lbl("B49", null, null);
  lbl("B51", "1", null);
  lbl("B52", "2", null);
  lbl("B53", "3", null);
  lbl("B54", null, null);
  lbl("A5", "", null);
  lbl("A47", null, null);
  lbl("A48", null, null);
  lbl("A49", null, null);
  lbl("A51", "0", null);
  lbl("A53", ".", null);
  var Tiki100KeyRegistry = class {
    static getKey(gridPos) {
      return _keys.get(gridPos);
    }
    static getLabel(gridPos, lang = "no") {
      return _labels.get(gridPos + "_" + lang) || _labels.get(gridPos + "_no");
    }
    static getGridByVK(vk) {
      return _vkToGrid.get(vk);
    }
    static getGridByName(name) {
      return _nameToGrid.get(name.toLowerCase());
    }
    static getAllKeys() {
      return _keys;
    }
    static getSequence(gridPos, _extMode, _numPadFunc, shift, ctrl) {
      return null;
    }
    static getGridForVK(vk) {
      return _vkToGrid.get(vk);
    }
  };

  // ts/keyboard/VirtualKeyboard.ts
  var STD_SIZE = 60;
  var SPACING = 5;
  var MAIN_X = 20;
  var NAV_X = 1074;
  var FUNC_X = 1314;
  var FONT_SINGLE_KEY = 21;
  var FONT_LABEL = 11;
  var FONT_LONG_LABEL = 9;
  var ROW_Y = {
    "A": 260,
    "B": 195,
    "C": 130,
    "D": 65,
    "E": 0
  };
  var CAPS_WIDTH = 105;
  var SHIFT_WIDTH = 128;
  var RETURN_HEIGHT = 125;
  var KP0_WIDTH = 125;
  var RIGHT_COL_X = 975;
  var RSHIFT_WIDTH = 102;
  function navX(col) {
    return NAV_X + col * (STD_SIZE + SPACING);
  }
  function funcX(col) {
    return FUNC_X + col * (STD_SIZE + SPACING);
  }
  function mainX(col) {
    return MAIN_X + col * (STD_SIZE + SPACING);
  }
  function buildKeyLayouts() {
    const layouts = [];
    const add = (gridPos, x, y, w = STD_SIZE, h = STD_SIZE) => {
      layouts.push({ gridPos, x, y, width: w, height: h });
    };
    add("E0", mainX(0), ROW_Y["E"], CAPS_WIDTH);
    for (let i = 1; i <= 12; i++) add(`E${i}`, MAIN_X + CAPS_WIDTH + SPACING + (i - 1) * (STD_SIZE + SPACING), ROW_Y["E"]);
    add("E13", MAIN_X + CAPS_WIDTH + SPACING + 12 * (STD_SIZE + SPACING), ROW_Y["E"]);
    add("E14", RIGHT_COL_X, ROW_Y["E"]);
    add("E47", navX(0), ROW_Y["E"]);
    add("E48", navX(1), ROW_Y["E"]);
    add("E49", navX(2), ROW_Y["E"]);
    add("E51", funcX(0), ROW_Y["E"]);
    add("E52", funcX(1), ROW_Y["E"]);
    add("E53", funcX(2), ROW_Y["E"]);
    add("E54", funcX(3), ROW_Y["E"]);
    add("D99", mainX(0), ROW_Y["D"]);
    add("D0", mainX(1), ROW_Y["D"]);
    for (let i = 1; i <= 12; i++) add(`D${i}`, mainX(i + 1), ROW_Y["D"]);
    add("D13", RIGHT_COL_X + STD_SIZE - CAPS_WIDTH, ROW_Y["D"], CAPS_WIDTH);
    add("D47", navX(0), ROW_Y["D"]);
    add("D48", navX(1), ROW_Y["D"]);
    add("D49", navX(2), ROW_Y["D"]);
    add("D51", funcX(0), ROW_Y["D"]);
    add("D52", funcX(1), ROW_Y["D"]);
    add("D53", funcX(2), ROW_Y["D"]);
    add("D54", funcX(3), ROW_Y["D"]);
    add("C99", mainX(0), ROW_Y["C"]);
    add("C0", mainX(1), ROW_Y["C"], CAPS_WIDTH);
    for (let i = 1; i <= 12; i++) add(`C${i}`, mainX(1) + CAPS_WIDTH + SPACING + (i - 1) * (STD_SIZE + SPACING), ROW_Y["C"]);
    add("C13", RIGHT_COL_X, ROW_Y["C"], STD_SIZE, RETURN_HEIGHT);
    add("C47", navX(0), ROW_Y["C"]);
    add("C48", navX(1), ROW_Y["C"]);
    add("C49", navX(2), ROW_Y["C"]);
    add("C51", funcX(0), ROW_Y["C"]);
    add("C52", funcX(1), ROW_Y["C"]);
    add("C53", funcX(2), ROW_Y["C"]);
    add("C54", funcX(3), ROW_Y["C"]);
    add("B99", mainX(0), ROW_Y["B"], SHIFT_WIDTH);
    for (let i = 0; i <= 10; i++) add(`B${i}`, MAIN_X + SHIFT_WIDTH + SPACING + i * (STD_SIZE + SPACING), ROW_Y["B"]);
    add("B11", MAIN_X + SHIFT_WIDTH + SPACING + 11 * (STD_SIZE + SPACING), ROW_Y["B"], RSHIFT_WIDTH);
    add("B47", navX(0), ROW_Y["B"]);
    add("B48", navX(1), ROW_Y["B"]);
    add("B49", navX(2), ROW_Y["B"]);
    add("B51", funcX(0), ROW_Y["B"]);
    add("B52", funcX(1), ROW_Y["B"]);
    add("B53", funcX(2), ROW_Y["B"]);
    add("B54", funcX(3), ROW_Y["B"], STD_SIZE, RETURN_HEIGHT);
    const TIKI_SPACE_X = MAIN_X + SHIFT_WIDTH + SPACING + 1 * (STD_SIZE + SPACING);
    const TIKI_SPACE_END = MAIN_X + SHIFT_WIDTH + SPACING + 9 * (STD_SIZE + SPACING) + STD_SIZE;
    add("A5", TIKI_SPACE_X, ROW_Y["A"], TIKI_SPACE_END - TIKI_SPACE_X);
    add("A47", navX(0), ROW_Y["A"]);
    add("A48", navX(1), ROW_Y["A"]);
    add("A49", navX(2), ROW_Y["A"]);
    add("A51", funcX(0), ROW_Y["A"], KP0_WIDTH);
    add("A53", funcX(2), ROW_Y["A"]);
    return layouts;
  }
  var ALL_LAYOUTS = buildKeyLayouts();
  var COMPACT_GRID_POSITIONS = /* @__PURE__ */ new Set([
    // TIKI-100 special keys only (no G/F rows)
    "E0",
    "E13",
    "E14",
    "E51",
    "E52",
    "E53",
    "E54",
    "D99",
    "D13",
    "D47",
    "D48",
    "D49",
    "D51",
    "D52",
    "D53",
    "D54",
    "C99",
    "C13",
    "C47",
    "C48",
    "C49",
    "B47",
    "B48",
    "B49",
    "A47",
    "A48",
    "A49"
  ]);
  var NAV_ARROW_GLYPHS = {
    "C47": { dir: "up", style: "double" },
    // PgUp
    "C48": { dir: "up", style: "single" },
    // UP
    "C49": { dir: "down", style: "double" },
    // PgDn
    "B47": { dir: "left", style: "single" },
    // LEFT
    "B48": { dir: "left", style: "home" },
    // HOME
    "B49": { dir: "right", style: "single" },
    // RIGHT
    "A47": { dir: "left", style: "tab" },
    // TABLEFT
    "A48": { dir: "down", style: "single" },
    // DOWN
    "A49": { dir: "right", style: "tab" }
    // TABRIGHT
  };
  var _VirtualKeyboard = class _VirtualKeyboard {
    constructor(container) {
      this._svgRoot = null;
      this._terminals = [];
      this._activeTerminal = null;
      this._layout = "full";
      this._language = "no";
      this._visible = false;
      this._keyElements = /* @__PURE__ */ new Map();
      this._toggleLeds = /* @__PURE__ */ new Map();
      // LED state
      this._ledClear = false;
      this._ledSet = false;
      this._ledBlink = false;
      // Modifier state for virtual clicks
      this._shiftActive = false;
      this._ctrlActive = false;
      // Toggle key state (CAPS, LOCK)
      this._toggleStates = /* @__PURE__ */ new Map();
      this._instanceId = _VirtualKeyboard._nextId++;
      this._container = container;
      this.render();
    }
    // --- Terminal management ---
    attachTerminal(terminal, label) {
      this._terminals.push({ terminal, label });
      if (this._terminals.length === 1) {
        this._activeTerminal = terminal;
      }
      this.updateSelector();
    }
    detachTerminal(terminal) {
      const idx = this._terminals.findIndex((t) => t.terminal === terminal);
      if (idx >= 0) {
        this._terminals.splice(idx, 1);
        if (this._activeTerminal === terminal) {
          this._activeTerminal = this._terminals.length > 0 ? this._terminals[0].terminal : null;
        }
        this.updateSelector();
      }
    }
    selectTerminal(terminal) {
      this._activeTerminal = terminal;
      this.updateSelector();
    }
    // --- Layout and visibility ---
    setLayout(mode) {
      if (this._layout === mode) return;
      this._layout = mode;
      this.render();
    }
    setLanguage(lang) {
      if (this._language === lang) return;
      this._language = lang;
      this.updateLabels();
    }
    show() {
      this._visible = true;
      this._container.style.display = "block";
    }
    hide() {
      this._visible = false;
      this._container.style.display = "none";
    }
    toggle() {
      this._visible ? this.hide() : this.show();
    }
    get visible() {
      return this._visible;
    }
    get layout() {
      return this._layout;
    }
    get language() {
      return this._language;
    }
    // --- LED state ---
    updateLEDs(clear, set, blink) {
      this._ledClear = clear;
      this._ledSet = set;
      this._ledBlink = blink;
      this.renderLEDIndicators();
    }
    /** Render LED indicator circles on the keyboard SVG */
    renderLEDIndicators() {
      if (!this._svgRoot) return;
      const existing = this._svgRoot.querySelectorAll(".retroterm-led");
      for (let i = 0; i < existing.length; i++) existing[i].remove();
      const ledDefs = [
        { label: "CLR", on: this._ledClear, blink: false, x: 20, y: -15 },
        { label: "SET", on: this._ledSet, blink: false, x: 80, y: -15 },
        { label: "BLK", on: this._ledBlink, blink: true, x: 140, y: -15 }
      ];
      for (const led of ledDefs) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.classList.add("retroterm-led");
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(led.x));
        circle.setAttribute("cy", String(led.y));
        circle.setAttribute("r", "6");
        circle.setAttribute("fill", led.on ? "#00ff00" : "#333333");
        circle.setAttribute("stroke", "#666");
        circle.setAttribute("stroke-width", "1");
        if (led.on && led.blink) {
          const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
          animate.setAttribute("attributeName", "fill");
          animate.setAttribute("values", "#00ff00;#333333;#00ff00");
          animate.setAttribute("dur", "1s");
          animate.setAttribute("repeatCount", "indefinite");
          circle.appendChild(animate);
        }
        g.appendChild(circle);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(led.x));
        text.setAttribute("y", String(led.y + 18));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#999");
        text.setAttribute("font-size", "8");
        text.setAttribute("font-family", "sans-serif");
        text.textContent = led.label;
        g.appendChild(text);
        this._svgRoot.appendChild(g);
      }
    }
    // --- Rendering ---
    render() {
      this._container.innerHTML = "";
      this._keyElements.clear();
      this._toggleLeds.clear();
      const layouts = this._layout === "compact" ? ALL_LAYOUTS.filter((l) => COMPACT_GRID_POSITIONS.has(l.gridPos)) : ALL_LAYOUTS;
      let maxX = 0, maxY = 0;
      for (let i = 0; i < layouts.length; i++) {
        const l = layouts[i];
        const r = l.x + l.width;
        const b = l.y + l.height;
        if (r > maxX) maxX = r;
        if (b > maxY) maxY = b;
      }
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", `0 0 ${maxX + 10} ${maxY + 10}`);
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.userSelect = "none";
      svg.classList.add("retroterm-vk");
      this._svgRoot = svg;
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const gradients = [
        [`key-grad-white-${this._instanceId}`, "#F2EEE6", "#BEB7AA"],
        // Light grey/white keys
        [`key-grad-orange-${this._instanceId}`, "#D4A43A", "#A97E2B"],
        // Yellow/beige (ENTER, HJELP, UTVID)
        [`key-grad-brown-${this._instanceId}`, "#F08A3A", "#B55416"]
        // Orange (arrows, function cluster)
      ];
      for (const [id, inner, outer] of gradients) {
        const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        grad.setAttribute("id", id);
        grad.setAttribute("cx", "50%");
        grad.setAttribute("cy", "40%");
        grad.setAttribute("r", "60%");
        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", inner);
        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", outer);
        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
      }
      svg.appendChild(defs);
      const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bg.setAttribute("width", String(maxX + 10));
      bg.setAttribute("height", String(maxY + 10));
      bg.setAttribute("fill", "#D8D2C6");
      bg.setAttribute("rx", "8");
      svg.appendChild(bg);
      for (let i = 0; i < layouts.length; i++) {
        const layout = layouts[i];
        const keyDef = Tiki100KeyRegistry.getKey(layout.gridPos);
        if (!keyDef) continue;
        const g = this.createKeyElement(layout, keyDef);
        svg.appendChild(g);
        this._keyElements.set(layout.gridPos, g);
      }
      this._container.appendChild(svg);
      this.updateSelector();
    }
    createKeyElement(layout, keyDef) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("data-grid", layout.gridPos);
      g.style.cursor = "pointer";
      const cx = layout.x + layout.width / 2;
      const cy = layout.y + layout.height / 2;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(layout.x));
      rect.setAttribute("y", String(layout.y));
      rect.setAttribute("width", String(layout.width));
      rect.setAttribute("height", String(layout.height));
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", this.getKeyGradient(keyDef.color));
      rect.setAttribute("stroke", "#555");
      rect.setAttribute("stroke-width", "1");
      g.appendChild(rect);
      const minDim = Math.min(layout.width, layout.height);
      if (minDim >= 50) {
        const inner = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        inner.setAttribute("cx", String(cx));
        inner.setAttribute("cy", String(cy));
        inner.setAttribute("rx", String(Math.min(layout.width * 0.38, 24)));
        inner.setAttribute("ry", String(Math.min(layout.height * 0.38, 24)));
        inner.setAttribute("fill", "rgba(0,0,0,0.08)");
        inner.setAttribute("pointer-events", "none");
        g.appendChild(inner);
      }
      const label = Tiki100KeyRegistry.getLabel(layout.gridPos, this._language);
      const textColor = this.getTextColor(keyDef.color);
      const arrowGlyph = NAV_ARROW_GLYPHS[layout.gridPos];
      if (layout.gridPos === "C13" || layout.gridPos === "B54") {
        this.addReturnGlyph(g, cx, cy, textColor);
      } else if (arrowGlyph) {
        this.addNavArrowGlyph(g, cx, cy, textColor, arrowGlyph);
      } else if (label && label.primary) {
        const isLetterKey = label.shifted !== null && label.primary.length === 1 && label.shifted.length === 1 && label.primary.toUpperCase() === label.primary && label.shifted === label.primary.toLowerCase();
        if (label.shifted && !isLetterKey) {
          const shiftText = document.createElementNS("http://www.w3.org/2000/svg", "text");
          shiftText.setAttribute("x", String(cx));
          shiftText.setAttribute("y", String(cy - 6));
          shiftText.setAttribute("text-anchor", "middle");
          shiftText.setAttribute("fill", textColor);
          shiftText.setAttribute("font-size", "11");
          shiftText.setAttribute("font-family", "sans-serif");
          shiftText.setAttribute("font-weight", "bold");
          shiftText.textContent = label.shifted;
          g.appendChild(shiftText);
          const primText = document.createElementNS("http://www.w3.org/2000/svg", "text");
          primText.setAttribute("x", String(cx));
          primText.setAttribute("y", String(cy + 14));
          primText.setAttribute("text-anchor", "middle");
          primText.setAttribute("fill", textColor);
          primText.setAttribute("font-size", "11");
          primText.setAttribute("font-family", "sans-serif");
          primText.setAttribute("font-weight", "bold");
          primText.textContent = label.primary;
          g.appendChild(primText);
        } else {
          const isToggle = !!(keyDef.flags & 2 /* IsToggle */);
          const hasLed = isToggle || layout.gridPos === "E0" || layout.gridPos === "D13";
          const ledOnRight = layout.gridPos === "D13";
          const labelX = hasLed ? ledOnRight ? cx - 8 : cx + 8 : cx;
          const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
          text.setAttribute("x", String(labelX));
          text.setAttribute("y", String(cy + 4));
          text.setAttribute("text-anchor", "middle");
          text.setAttribute("fill", textColor);
          const fs = label.primary.length === 1 && !label.shifted ? FONT_SINGLE_KEY : label.primary.length > 4 ? FONT_LONG_LABEL : FONT_LABEL;
          text.setAttribute("font-size", String(fs));
          text.setAttribute("font-family", "sans-serif");
          text.setAttribute("font-weight", "bold");
          text.textContent = label.primary;
          g.appendChild(text);
          const hasHwLed = layout.gridPos === "E0" || layout.gridPos === "D13";
          if (isToggle || hasHwLed) {
            const led = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            const ledX = ledOnRight ? layout.x + layout.width - 14 : layout.x + 14;
            led.setAttribute("cx", String(ledX));
            led.setAttribute("cy", String(cy));
            led.setAttribute("r", "4");
            led.setAttribute("fill", "#333");
            led.setAttribute("stroke", "#666");
            led.setAttribute("stroke-width", "0.5");
            g.appendChild(led);
            this._toggleLeds.set(layout.gridPos, led);
          }
        }
      }
      g.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        this.handleKeyClick(layout.gridPos, keyDef, ev);
        rect.setAttribute("fill", this.getPressedColor(keyDef.color));
      });
      g.addEventListener("mouseup", () => {
        if (keyDef.flags & 1 /* IsModifier */ && this.isModifierActive(keyDef.name)) {
          return;
        }
        rect.setAttribute("fill", this.getKeyGradient(keyDef.color));
      });
      g.addEventListener("mouseleave", () => {
        if (keyDef.flags & 1 /* IsModifier */ && this.isModifierActive(keyDef.name)) {
          return;
        }
        rect.setAttribute("fill", this.getKeyGradient(keyDef.color));
      });
      return g;
    }
    /** Draw a curved return-arrow glyph (like a real keyboard) */
    addReturnGlyph(g, cx, cy, color) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = `M ${cx + 10} ${cy - 12} L ${cx + 10} ${cy + 2} Q ${cx + 10} ${cy + 6} ${cx + 6} ${cy + 6} L ${cx - 8} ${cy + 6} M ${cx - 8} ${cy + 6} L ${cx - 3} ${cy + 1} M ${cx - 8} ${cy + 6} L ${cx - 3} ${cy + 11}`;
      path.setAttribute("d", d);
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("pointer-events", "none");
      g.appendChild(path);
    }
    /** Draw a backspace/newpara arrow glyph (leftward arrow with bar) */
    addBackspaceGlyph(g, cx, cy, color) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = `M ${cx + 12} ${cy} L ${cx - 6} ${cy} M ${cx - 6} ${cy} L ${cx - 1} ${cy - 6} M ${cx - 6} ${cy} L ${cx - 1} ${cy + 6} M ${cx - 10} ${cy - 8} L ${cx - 10} ${cy + 8}`;
      path.setAttribute("d", d);
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("pointer-events", "none");
      g.appendChild(path);
    }
    /** Draw navigation arrow glyphs (single, double, or tab arrows) */
    addNavArrowGlyph(g, cx, cy, color, glyph) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const s = 10;
      const hs = 6;
      let d = "";
      if (glyph.style === "single") {
        switch (glyph.dir) {
          case "up":
            d = `M ${cx} ${cy - s} L ${cx} ${cy + s} M ${cx} ${cy - s} L ${cx - hs} ${cy - s + hs} M ${cx} ${cy - s} L ${cx + hs} ${cy - s + hs}`;
            break;
          case "down":
            d = `M ${cx} ${cy + s} L ${cx} ${cy - s} M ${cx} ${cy + s} L ${cx - hs} ${cy + s - hs} M ${cx} ${cy + s} L ${cx + hs} ${cy + s - hs}`;
            break;
          case "left":
            d = `M ${cx - s} ${cy} L ${cx + s} ${cy} M ${cx - s} ${cy} L ${cx - s + hs} ${cy - hs} M ${cx - s} ${cy} L ${cx - s + hs} ${cy + hs}`;
            break;
          case "right":
            d = `M ${cx + s} ${cy} L ${cx - s} ${cy} M ${cx + s} ${cy} L ${cx + s - hs} ${cy - hs} M ${cx + s} ${cy} L ${cx + s - hs} ${cy + hs}`;
            break;
        }
      } else if (glyph.style === "double") {
        switch (glyph.dir) {
          case "up":
            d = `M ${cx - 3} ${cy + s} L ${cx - 3} ${cy - s + hs} M ${cx + 3} ${cy + s} L ${cx + 3} ${cy - s + hs} M ${cx} ${cy - s} L ${cx - hs} ${cy - s + hs} M ${cx} ${cy - s} L ${cx + hs} ${cy - s + hs}`;
            break;
          case "down":
            d = `M ${cx - 3} ${cy - s} L ${cx - 3} ${cy + s - hs} M ${cx + 3} ${cy - s} L ${cx + 3} ${cy + s - hs} M ${cx} ${cy + s} L ${cx - hs} ${cy + s - hs} M ${cx} ${cy + s} L ${cx + hs} ${cy + s - hs}`;
            break;
          case "left":
            d = `M ${cx + s} ${cy} L ${cx - s + 4} ${cy} M ${cx - s + 4} ${cy} L ${cx - s + 4 + hs} ${cy - hs} M ${cx - s + 4} ${cy} L ${cx - s + 4 + hs} ${cy + hs} M ${cx - s} ${cy - 8} L ${cx - s} ${cy + 8}`;
            break;
          case "right":
            d = `M ${cx - s} ${cy} L ${cx + s - 4} ${cy} M ${cx + s - 4} ${cy} L ${cx + s - 4 - hs} ${cy - hs} M ${cx + s - 4} ${cy} L ${cx + s - 4 - hs} ${cy + hs} M ${cx + s} ${cy - 8} L ${cx + s} ${cy + 8}`;
            break;
        }
      } else if (glyph.style === "home") {
        const d2 = 0.707;
        const sx2 = s * d2;
        const hx = hs * d2;
        d = `M ${cx - sx2} ${cy - sx2} L ${cx + sx2} ${cy + sx2} M ${cx - sx2} ${cy - sx2} L ${cx - sx2 + hx + hx} ${cy - sx2} M ${cx - sx2} ${cy - sx2} L ${cx - sx2} ${cy - sx2 + hx + hx}`;
      } else if (glyph.style === "tab") {
        switch (glyph.dir) {
          case "left":
            d = `M ${cx + s} ${cy} L ${cx - s + 4} ${cy} M ${cx - s + 4} ${cy} L ${cx - s + 4 + hs} ${cy - hs} M ${cx - s + 4} ${cy} L ${cx - s + 4 + hs} ${cy + hs} M ${cx - s} ${cy - 8} L ${cx - s} ${cy + 8}`;
            break;
          case "right":
            d = `M ${cx - s} ${cy} L ${cx + s - 4} ${cy} M ${cx + s - 4} ${cy} L ${cx + s - 4 - hs} ${cy - hs} M ${cx + s - 4} ${cy} L ${cx + s - 4 - hs} ${cy + hs} M ${cx + s} ${cy - 8} L ${cx + s} ${cy + 8}`;
            break;
        }
      }
      path.setAttribute("d", d);
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("pointer-events", "none");
      g.appendChild(path);
    }
    /** Check if a modifier key is currently active */
    isModifierActive(name) {
      if (name === "LSHIFT" || name === "RSHIFT") return this._shiftActive;
      if (name === "CTRL") return this._ctrlActive;
      return false;
    }
    /** Update visual state of all modifier keys to match internal state */
    updateModifierVisuals() {
      this.updateModifierKeyVisual("B99", this._shiftActive);
      this.updateModifierKeyVisual("B11", this._shiftActive);
      this.updateModifierKeyVisual("D0", this._ctrlActive);
    }
    updateModifierKeyVisual(gridPos, active) {
      const g = this._keyElements.get(gridPos);
      if (!g) return;
      const rect = g.querySelector("rect");
      const keyDef = Tiki100KeyRegistry.getKey(gridPos);
      if (rect && keyDef) {
        rect.setAttribute("fill", active ? this.getPressedColor(keyDef.color) : this.getKeyGradient(keyDef.color));
      }
    }
    handleKeyClick(gridPos, keyDef, ev) {
      var _a, _b;
      if (!this._activeTerminal) return;
      if (keyDef.flags & 1 /* IsModifier */) {
        if (keyDef.name === "LSHIFT" || keyDef.name === "RSHIFT") {
          this._shiftActive = !this._shiftActive;
        } else if (keyDef.name === "CTRL") {
          this._ctrlActive = !this._ctrlActive;
        }
        this.updateModifierVisuals();
        return;
      }
      if (keyDef.flags & 2 /* IsToggle */) {
        const current = (_a = this._toggleStates.get(gridPos)) != null ? _a : false;
        this._toggleStates.set(gridPos, !current);
        this.updateToggleLED(gridPos, !current);
        return;
      }
      if (ev) {
        if (ev.shiftKey) this._shiftActive = true;
        if (ev.ctrlKey) this._ctrlActive = true;
      }
      const capsActive = (_b = this._toggleStates.get("E0")) != null ? _b : false;
      const label = Tiki100KeyRegistry.getLabel(gridPos, this._language);
      const isLetterKey = label !== null && label.primary !== null && label.shifted !== null && label.primary.length === 1 && label.shifted.length === 1 && label.primary.toUpperCase() === label.primary && label.shifted === label.primary.toLowerCase();
      let effectiveShift;
      if (isLetterKey) {
        effectiveShift = capsActive ? !this._shiftActive : this._shiftActive;
      } else {
        effectiveShift = this._shiftActive;
      }
      const seq = Tiki100KeyRegistry.getSequence(
        gridPos,
        true,
        false,
        effectiveShift,
        this._ctrlActive
      );
      if (seq !== null) {
        this.sendSequence(seq);
      } else if (label) {
        let ch = null;
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
            if (code >= 64 && code <= 95) {
              this.sendSequence(String.fromCharCode(code - 64));
            }
          } else {
            this.sendSequence(ch);
          }
        }
      }
      this._shiftActive = false;
      this._ctrlActive = false;
      this.updateModifierVisuals();
    }
    /** Send a key sequence to the active terminal */
    sendSequence(seq) {
      var _a;
      if (!this._activeTerminal) return;
      const syntheticEvent = new KeyboardEvent("keydown", {
        key: seq,
        bubbles: false,
        cancelable: true
      });
      (_a = this._activeTerminal._onKey) == null ? void 0 : _a.fire({ key: seq, domEvent: syntheticEvent });
    }
    /** Set the toggle LED state for CAPS or LOCK keys */
    updateToggleLED(gridPos, active) {
      const led = this._toggleLeds.get(gridPos);
      if (led) {
        led.setAttribute("fill", active ? "#00ff00" : "#333");
      }
    }
    getKeyGradient(color) {
      switch (color) {
        case 1 /* Orange */:
          return `url(#key-grad-orange-${this._instanceId})`;
        case 2 /* Brown */:
          return `url(#key-grad-brown-${this._instanceId})`;
        case 0 /* White */:
        default:
          return `url(#key-grad-white-${this._instanceId})`;
      }
    }
    getKeyColor(color) {
      switch (color) {
        case 1 /* Orange */:
          return "#c87828";
        case 2 /* Brown */:
          return "#8b6914";
        case 0 /* White */:
        default:
          return "#d4d4d4";
      }
    }
    getPressedColor(color) {
      switch (color) {
        case 1 /* Orange */:
          return "#a06020";
        case 2 /* Brown */:
          return "#705510";
        case 0 /* White */:
        default:
          return "#aaaaaa";
      }
    }
    getTextColor(color) {
      switch (color) {
        case 1 /* Orange */:
        case 2 /* Brown */:
          return "#2B2B2B";
        // Dark legends on colored keys
        case 0 /* White */:
        default:
          return "#2B2B2B";
      }
    }
    updateLabels() {
      for (const [gridPos, g] of this._keyElements) {
        const label = Tiki100KeyRegistry.getLabel(gridPos, this._language);
        const texts = g.querySelectorAll("text");
        if (texts.length > 0 && label && label.primary) {
          texts[0].textContent = label.primary;
        }
        if (texts.length > 1 && label && label.shifted) {
          texts[1].textContent = label.shifted;
        }
      }
    }
    updateSelector() {
      const existing = this._container.querySelector(".retroterm-vk-selector");
      if (existing) existing.remove();
      if (this._terminals.length <= 1) return;
      const select = document.createElement("select");
      select.className = "retroterm-vk-selector";
      select.style.cssText = "position:absolute;top:4px;right:4px;font-size:12px;";
      for (let i = 0; i < this._terminals.length; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = this._terminals[i].label;
        if (this._terminals[i].terminal === this._activeTerminal) {
          opt.selected = true;
        }
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        const idx = parseInt(select.value, 10);
        if (idx >= 0 && idx < this._terminals.length) {
          this._activeTerminal = this._terminals[idx].terminal;
        }
      });
      this._container.style.position = "relative";
      this._container.appendChild(select);
    }
    /** Visually press a key by VK code (for physical keyboard sync) */
    highlightKey(vkCode) {
      const gridPos = Tiki100KeyRegistry.getGridForVK(vkCode);
      if (!gridPos) return;
      this.highlightGridKey(gridPos);
    }
    /** Visually release a key by VK code */
    unhighlightKey(vkCode) {
      const gridPos = Tiki100KeyRegistry.getGridForVK(vkCode);
      if (!gridPos) return;
      this.unhighlightGridKey(gridPos);
    }
    /** Visually press a key by grid position directly */
    highlightGridKey(gridPos) {
      const g = this._keyElements.get(gridPos);
      if (!g) return;
      const rect = g.querySelector("rect");
      const keyDef = Tiki100KeyRegistry.getKey(gridPos);
      if (rect && keyDef) rect.setAttribute("fill", this.getPressedColor(keyDef.color));
    }
    /** Visually release a key by grid position directly */
    unhighlightGridKey(gridPos) {
      const g = this._keyElements.get(gridPos);
      if (!g) return;
      const rect = g.querySelector("rect");
      const keyDef = Tiki100KeyRegistry.getKey(gridPos);
      if (rect && keyDef) rect.setAttribute("fill", this.getKeyGradient(keyDef.color));
    }
    /** Clean up DOM elements */
    dispose() {
      this._container.innerHTML = "";
      this._keyElements.clear();
      this._terminals.length = 0;
      this._activeTerminal = null;
      this._svgRoot = null;
    }
  };
  _VirtualKeyboard._nextId = 0;
  var VirtualKeyboard = _VirtualKeyboard;
  return __toCommonJS(VirtualKeyboard_exports);
})();
