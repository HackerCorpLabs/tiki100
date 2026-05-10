/* TIKI-100 Emulator - AudioWorklet processor for AY-3-8912 playback.
 *
 * Runs on the audio rendering thread. Receives interleaved-stereo Float32
 * sample batches from the main thread (which pulls them from the WASM AY
 * ring buffer) and drains them at 128-frame quanta. When the queued buffer
 * drops below a low watermark, asks the main thread for more.
 */

class AYProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        /* Queue of Float32Array chunks, each interleaved stereo (L,R,L,R,...). */
        this.queue = [];
        this.queuedFrames = 0;
        this.readPos = 0;        /* frame index inside queue[0] */

        /* Buffering targets (frames at 44.1 kHz):
         *   targetFrames ≈ 46 ms — refill aim, matches old ScriptProcessor latency.
         *   minFrames    ≈ 23 ms — request more when below this. */
        this.targetFrames = 2048;
        this.minFrames = 1024;
        this.requestPending = false;
        this.lastSampleL = 0;
        this.lastSampleR = 0;

        this.port.onmessage = (e) => {
            const samples = e.data && e.data.samples;
            if (samples instanceof Float32Array) {
                this.queue.push(samples);
                this.queuedFrames += samples.length / 2;
                this.requestPending = false;
            }
        };
    }

    process(_inputs, outputs) {
        const out = outputs[0];
        const left = out[0];
        const right = out[1];
        const need = left.length;

        for (let i = 0; i < need; i++) {
            if (this.queue.length === 0) {
                /* Underrun — repeat last sample to avoid clicks. */
                left[i] = this.lastSampleL;
                right[i] = this.lastSampleR;
                continue;
            }
            const buf = this.queue[0];
            const o = this.readPos * 2;
            const l = buf[o];
            const r = buf[o + 1];
            left[i] = l;
            right[i] = r;
            this.lastSampleL = l;
            this.lastSampleR = r;
            this.readPos++;
            this.queuedFrames--;
            if (this.readPos * 2 >= buf.length) {
                this.queue.shift();
                this.readPos = 0;
            }
        }

        if (!this.requestPending && this.queuedFrames < this.minFrames) {
            const want = this.targetFrames - this.queuedFrames;
            if (want > 0) {
                this.port.postMessage({ request: want });
                this.requestPending = true;
            }
        }
        return true;
    }
}

registerProcessor('ay-processor', AYProcessor);
