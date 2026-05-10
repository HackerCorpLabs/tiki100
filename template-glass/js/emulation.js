/* TIKI-100 Emulator - Emulation Control */

var Emulation = (function() {
    'use strict';

    var running = false;
    var booted = false;
    var canvas = null;
    var ctx = null;
    var animFrameId = null;
    var frameCount = 0;
    var fpsLastTime = 0;
    var fpsFrames = 0;

    function init() {
        canvas = document.getElementById('tiki-screen');
        if (canvas) {
            ctx = canvas.getContext('2d');
            /* Disable smoothing for crisp pixel art rendering */
            if (ctx) {
                ctx.imageSmoothingEnabled = false;
                ctx.mozImageSmoothingEnabled = false;
                ctx.webkitImageSmoothingEnabled = false;
                ctx.msImageSmoothingEnabled = false;
            }
        }
    }

    function start(mode) {
        if (!Module || !moduleReady) {
            console.error('WASM module not ready yet - wait for initialization');
            return;
        }
        if (running) return;
        if (!mode) mode = 'floppy';

        console.log('Emulation: booting in ' + mode + ' mode...');

        /* Step 1: Load ROM into MEMFS */
        var chain = loadFileToMEMFS('rom/tikirom-2.03w', '/tikirom-2.03w');

        /* Step 2: Init (must happen before mounting - sets up HDD controller etc) */
        chain = chain.then(function() {
            console.log('Emulation: calling Init...');
            Module._Init();
        });

        /* Step 3: Mount disks AFTER Init (so hddInit doesn't wipe them) */
        if (mode === 'hdd') {
            chain = chain.then(function() {
                console.log('Emulation: loading HDD images...');
                return Promise.all([
                    loadHDDImage('disks/hdd/HD0.dsk', 0),
                    loadHDDImage('disks/hdd/HD1.dsk', 1)
                ]);
            });
        } else {
            chain = chain.then(function() {
                console.log('Emulation: loading boot floppy on FD0...');
                return loadAndMountFloppy('disks/boot/tiko_kjerne_v4.01.dsk', 0);
            });
        }

        /* Step 4: Boot */
        chain.then(function() {
            var result = Module._Boot();
            console.log('Emulation: Boot returned ' + result);

            if (result) {
                running = true;
                booted = true;
                fpsLastTime = performance.now();

                /* Start sound (requires user gesture - boot button click counts) */
                Sound.init();
                Sound.resume();

                /* Apply saved volume */
                var savedVol = localStorage.getItem('tiki100-volume');
                if (savedVol !== null && Module._SetVolume) {
                    Module._SetVolume(parseInt(savedVol));
                }

                tick();
            } else {
                console.error('Boot failed - ROM not found?');
            }
        }).catch(function(err) {
            console.error('Boot error:', err);
        });
    }

    function stop() {
        running = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        if (Module && moduleReady && Module._Stop) {
            Module._Stop();
        }
    }

    function reset() {
        if (!Module || !moduleReady) return;
        console.log('Emulation: Reset');
        Module._Reset();
        if (!running && booted) {
            running = true;
            fpsLastTime = performance.now();
            tick();
        }
    }

    function tick() {
        if (!running) return;

        /* At 60fps we need ~66667 cycles per frame for 4MHz.
         * IPeriod=4000, so ~17 Step calls per frame. Use 20. */
        /* Normal: 20 steps/frame ≈ 4MHz at 60fps
         * Full speed: 200 steps/frame ≈ 40MHz */
        var stepsPerFrame = fullSpeedMode ? 200 : 20;
        var i;
        for (i = 0; i < stepsPerFrame; i++) {
            Module._Step(0);
        }

        updateScreen();
        updateLEDs();

        frameCount++;
        fpsFrames++;

        /* FPS + debug counters every second */
        var now = performance.now();
        if (now - fpsLastTime >= 1000) {
            var fps = Math.round(fpsFrames * 1000 / (now - fpsLastTime));
            document.title = 'TIKI-100 [' + fps + ' fps]';
            var fpsEl = document.getElementById('fps-display');
            if (fpsEl) fpsEl.textContent = fps + ' fps';
            var fpsMachine = document.getElementById('fps-display-machine');
            if (fpsMachine) fpsMachine.textContent = fps;
            fpsLastTime = now;
            fpsFrames = 0;
        }

        animFrameId = requestAnimationFrame(tick);
    }

    function updateScreen() {
        if (!ctx) return;

        var ptr = Module._GetFrameBuffer();
        var srcW = Module._GetFrameBufferWidth();
        var srcH = Module._GetFrameBufferHeight();

        if (!ptr || srcW <= 0 || srcH <= 0) return;

        /* Integer scaling: canvas is always an exact multiple of the
         * source resolution. The screen window auto-snaps to valid
         * sizes so there's no fractional scaling anywhere. */
        var rect = canvas.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        var cssW = Math.round(rect.width * dpr);
        var cssH = Math.round(rect.height * dpr);

        /* Set canvas to exact CSS pixel size - 1:1 ratio, no browser scaling.
         * Pick the largest integer scale where the image fits entirely. */
        var dw = cssW;
        var dh = cssH;

        /* Integer scale: largest NxN that fits.
         * The window body may be a few pixels short of an exact multiple
         * due to borders. We allow the image to exceed the canvas by up
         * to 4px (gets clipped, barely visible) rather than drop a scale. */
        var scale = Math.max(1, Math.min(
            Math.round(cssW / srcW),
            Math.round(cssH / srcH)
        ));
        var scaledW = srcW * scale;
        var scaledH = srcH * scale;

        if (canvas.width !== dw || canvas.height !== dh) {
            canvas.width = dw;
            canvas.height = dh;
            ctx.imageSmoothingEnabled = false;
        }

        /* Clear canvas (black bars around scaled image) */
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, dw, dh);

        /* Render scaled image centered */
        var offX = ((dw - scaledW) / 2) | 0;
        var offY = ((dh - scaledH) / 2) | 0;
        var src = new Uint8Array(Module.HEAPU8.buffer, ptr, srcW * srcH * 4);
        var dst = ctx.createImageData(scaledW, scaledH);
        var dstData = dst.data;

        for (var sy = 0; sy < srcH; sy++) {
            var dy = sy * scale;
            for (var sx = 0; sx < srcW; sx++) {
                var srcOff = (sy * srcW + sx) * 4;
                var r = src[srcOff], g = src[srcOff + 1], b = src[srcOff + 2], a = src[srcOff + 3];
                var dx = sx * scale;
                for (var py = 0; py < scale; py++) {
                    for (var px = 0; px < scale; px++) {
                        var dstOff = ((dy + py) * scaledW + dx + px) * 4;
                        dstData[dstOff] = r;
                        dstData[dstOff + 1] = g;
                        dstData[dstOff + 2] = b;
                        dstData[dstOff + 3] = a;
                    }
                }
            }
        }

        ctx.putImageData(dst, offX, offY);

        /* Update resolution info in title bar */
        var resInfo = document.getElementById('screen-res-info');
        if (resInfo) {
            resInfo.textContent = '(' + srcW + 'x' + srcH + ' @' + scale + 'x)';
        }
    }

    function updateLEDs() {
        var lockLed = document.getElementById('led-lock');
        var gfxLed = document.getElementById('led-grafikk');
        var disk0Led = document.getElementById('led-disk0');
        var disk1Led = document.getElementById('led-disk1');
        var hd0Led = document.getElementById('led-hd0');
        var hd1Led = document.getElementById('led-hd1');

        if (lockLed) lockLed.classList.toggle('active-lock', !!Module._GetLockStatus());
        if (gfxLed) gfxLed.classList.toggle('active-gfx', !!Module._GetGrafikkStatus());
        if (disk0Led) disk0Led.classList.toggle('active-disk', !!Module._GetDiskStatus(0));
        if (disk1Led) disk1Led.classList.toggle('active-disk', !!Module._GetDiskStatus(1));
        if (hd0Led) hd0Led.classList.toggle('active-hdd', !!Module._GetHDDStatus(0));
        if (hd1Led) hd1Led.classList.toggle('active-hdd', !!Module._GetHDDStatus(1));
    }

    var fullSpeedMode = false;

    function setFullSpeed(fast) {
        fullSpeedMode = fast;
        console.log('CPU speed: ' + (fast ? 'Full Speed' : 'Normal (4 MHz)'));
    }

    return {
        init: init,
        start: start,
        stop: stop,
        reset: reset,
        setFullSpeed: setFullSpeed,
        isRunning: function() { return running; }
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    Emulation.init();
});
