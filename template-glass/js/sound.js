/* TIKI-100 Emulator - Web Audio Sound
 *
 * Tries AudioWorkletNode first (modern, off-main-thread). Falls back to the
 * deprecated ScriptProcessorNode when AudioWorklet isn't available — which
 * happens in insecure contexts (e.g. http://hostname:port over the LAN).
 * The fallback prints a deprecation warning but keeps sound working.
 */

var Sound = (function() {
    'use strict';

    var audioCtx = null;
    var workletNode = null;     /* used in worklet path */
    var scriptNode = null;      /* used in fallback path */
    var enabled = false;
    var pendingResume = false;
    var BUFFER_SIZE = 2048;

    /* --------------- shared sample fetch from WASM AY ring buffer --------------- */

    function fillFloat32Array(samples, frames) {
        if (typeof Module === 'undefined' || !moduleReady ||
            !Module._ayFillAudioBufferWasm || !Module._malloc || !Module._free) {
            samples.fill(0);
            return;
        }
        var byteLen = frames * 2 * 4;
        var ptr = Module._malloc(byteLen);
        if (!ptr) {
            samples.fill(0);
            return;
        }
        Module._ayFillAudioBufferWasm(ptr, frames);
        samples.set(new Float32Array(Module.HEAPU8.buffer, ptr, frames * 2));
        Module._free(ptr);
    }

    /* --------------- AudioWorklet path (preferred) --------------- */

    function fillAndPostToWorklet(frames) {
        if (frames <= 0 || !workletNode) return;
        var samples = new Float32Array(frames * 2);
        fillFloat32Array(samples, frames);
        workletNode.port.postMessage({ samples: samples }, [samples.buffer]);
    }

    function workletUrlWithCacheBust() {
        var url = 'js/sound-worklet.js';
        var tag = document.querySelector('script[src*="js/sound.js"]');
        if (tag) {
            var m = tag.getAttribute('src').match(/\?v=(\d+)/);
            if (m) url += '?v=' + m[1];
        }
        return url;
    }

    function initWorklet() {
        audioCtx.audioWorklet.addModule(workletUrlWithCacheBust()).then(function() {
            workletNode = new AudioWorkletNode(audioCtx, 'ay-processor', {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [2]
            });
            workletNode.port.onmessage = function(e) {
                if (e.data && typeof e.data.request === 'number') {
                    fillAndPostToWorklet(e.data.request);
                }
            };
            workletNode.connect(audioCtx.destination);
            enabled = true;

            if (pendingResume) {
                audioCtx.resume();
                pendingResume = false;
            }
            console.log('Sound: AudioWorklet initialized (' + audioCtx.sampleRate + ' Hz)');
        }).catch(function(err) {
            console.error('Sound: Failed to load AudioWorklet module, falling back to ScriptProcessor:', err);
            initScriptProcessor();
        });
    }

    /* --------------- ScriptProcessorNode fallback (insecure-context / old browser) --------------- */

    function initScriptProcessor() {
        try {
            scriptNode = audioCtx.createScriptProcessor(BUFFER_SIZE, 0, 2);
            scriptNode.onaudioprocess = function(e) {
                var left = e.outputBuffer.getChannelData(0);
                var right = e.outputBuffer.getChannelData(1);
                var frames = left.length;
                var samples = new Float32Array(frames * 2);
                fillFloat32Array(samples, frames);
                for (var i = 0; i < frames; i++) {
                    left[i]  = samples[i * 2];
                    right[i] = samples[i * 2 + 1];
                }
            };
            scriptNode.connect(audioCtx.destination);
            enabled = true;

            if (pendingResume) {
                audioCtx.resume();
                pendingResume = false;
            }
            console.warn('Sound: using deprecated ScriptProcessorNode (no secure context — origin ' +
                         location.origin + '). Audio works but consider serving over HTTPS for AudioWorklet.');
        } catch (err) {
            console.error('Sound: ScriptProcessorNode setup failed:', err);
        }
    }

    /* --------------- public API --------------- */

    function init() {
        if (audioCtx) return;

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
        } catch (err) {
            console.error('Sound: Failed to create AudioContext:', err);
            return;
        }

        if (audioCtx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
            initWorklet();
        } else {
            initScriptProcessor();
        }
    }

    function resume() {
        if (!audioCtx) return;
        if (enabled) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
        } else {
            pendingResume = true;
        }
    }

    function isEnabled() {
        return enabled;
    }

    return {
        init: init,
        resume: resume,
        isEnabled: isEnabled
    };
})();
