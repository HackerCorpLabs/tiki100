/* TIKI-100 Virtual Keyboard wrapper
 * Keyboard is inside the screen window.
 * Keys send events to the WASM emulator via Module._SendKey().
 */

var TikiVirtualKeyboard = (function() {
    'use strict';

    var vk = null;
    var container = null;
    var visible = false;
    var shiftActive = false;
    var ctrlActive = false;
    var activeKeys = {};

    /* Grid position to TIKI key code mapping.
     * Built from Tiki100KeyRegistry at init time. */
    var gridToCode = {};

    function init(containerEl) {
        container = containerEl;

        if (typeof TikiKeyboard === 'undefined' || !TikiKeyboard.VirtualKeyboard) {
            console.warn('VirtualKeyboard: keyboard.js not loaded');
            return;
        }

        try {
            vk = new TikiKeyboard.VirtualKeyboard(container);

            /* Build grid-to-code map from registry */
            if (TikiKeyboard.Tiki100KeyRegistry) {
                var allKeys = TikiKeyboard.Tiki100KeyRegistry.getAllKeys();
                allKeys.forEach(function(keyDef, gridPos) {
                    gridToCode[gridPos] = keyDef.virtualKeyCode;
                });
            }

            /* Key press/release handling */
            container.addEventListener('mousedown', function(e) {
                var g = e.target.closest('g[data-grid]');
                if (!g) return;
                e.preventDefault();
                var grid = g.getAttribute('data-grid');
                var code = gridToCode[grid];
                if (code === undefined) return;
                handleKeyDown(code);
            });

            container.addEventListener('mouseup', function(e) {
                var g = e.target.closest('g[data-grid]');
                if (!g) return;
                e.preventDefault();
                var grid = g.getAttribute('data-grid');
                var code = gridToCode[grid];
                if (code === undefined) return;
                handleKeyUp(code);
            });

            container.addEventListener('mouseleave', function() {
                releaseAll();
            });

            console.log('VirtualKeyboard: initialized, ' + Object.keys(gridToCode).length + ' keys mapped');
        } catch (e) {
            console.error('VirtualKeyboard init failed:', e);
        }
    }

    function handleKeyDown(code) {
        if (!Module || !moduleReady || !Module._SendKey) return;

        /* Shift - sticky toggle */
        if (code === 0x82) {
            shiftActive = !shiftActive;
            Module._SendKey(code, shiftActive ? 1 : 0);
            return;
        }
        /* Ctrl - sticky toggle */
        if (code === 0x81) {
            ctrlActive = !ctrlActive;
            Module._SendKey(code, ctrlActive ? 1 : 0);
            return;
        }

        Module._SendKey(code, 1);
        activeKeys[code] = true;
    }

    function handleKeyUp(code) {
        if (!Module || !moduleReady || !Module._SendKey) return;

        /* Modifiers are sticky - don't release on mouseup */
        if (code === 0x82 || code === 0x81) return;

        Module._SendKey(code, 0);
        delete activeKeys[code];

        /* Release sticky shift after a key press */
        if (shiftActive) {
            shiftActive = false;
            Module._SendKey(0x82, 0);
        }
        if (ctrlActive) {
            ctrlActive = false;
            Module._SendKey(0x81, 0);
        }
    }

    function releaseAll() {
        if (!Module || !moduleReady || !Module._SendKey) return;
        for (var code in activeKeys) {
            Module._SendKey(parseInt(code), 0);
        }
        activeKeys = {};
        if (shiftActive) { shiftActive = false; Module._SendKey(0x82, 0); }
        if (ctrlActive) { ctrlActive = false; Module._SendKey(0x81, 0); }
    }

    /* Poll emulator state and update keyboard LEDs */
    function updateLEDs() {
        if (!Module || !moduleReady || !container || !visible) return;

        var svg = container.querySelector('svg');
        if (!svg) return;

        /* Find LED circles by their parent key's grid position */
        var leds = {
            'E0':  Module._GetGrafikkStatus ? !!Module._GetGrafikkStatus() : false,
            'C0':  Module._GetLockStatus ? !!Module._GetLockStatus() : false,
            'D13': false,  /* HJELP LED - no emulator state for this yet */
        };

        for (var grid in leds) {
            var keyGroup = svg.querySelector('g[data-grid="' + grid + '"]');
            if (!keyGroup) continue;
            var led = keyGroup.querySelector('circle');
            if (!led) continue;
            led.setAttribute('fill', leds[grid] ? '#00cc00' : '#333');
        }
    }

    /* Start LED polling when keyboard is shown */
    setInterval(updateLEDs, 200);

    function toggle() {
        var win = document.getElementById('window-keyboard');
        if (win) {
            visible = win.style.display === 'none';
            win.style.display = visible ? '' : 'none';
        }
    }

    function isVisible() { return visible; }

    return {
        init: init,
        toggle: toggle,
        isVisible: isVisible,
    };
})();
