import init, { WasmPitchDetector } from "./wasm-audio/wasm_audio.js";

class PitchProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.samples = [];
        this.totalSamples = 0;

        this.port.onmessage = (event) => this.onmessage(event.data);

        this.detector = null;
    }

    onmessage(event) {
        if (event.type == "send-wasm-module") {

            // init loads the webassembly module (sent in bytes) into the object + into context.
            init(WebAssembly.compile(event.wasmBytes)).then(() => {
                // Message to main thread 
                this.port.postMessage({ type: "wasm-module-loaded" });
            })
        } else if (event.type == "init-detector") {
            const { sampleRate, numAudioSamplesPerAnalysis } = event;

            this.numAudioSamplesPerAnalysis = numAudioSamplesPerAnalysis;

            this.detector = WasmPitchDetector.new(sampleRate, numAudioSamplesPerAnalysis);

            this.samples = new Array(numAudioSamplesPerAnalysis).fill(0);
            this.totalSamples = 0;
        }
    }

    process(inputs, outputs) {
        // Grab mono channel or left channel from stereo
        const inputChannels = inputs[0];

        const inputSamples = inputChannels[0];

        // Check if sample buffer is full
        if (this.totalSamples < this.numAudioSamplesPerAnalysis) {
            // If not full
            // Append samples to buffer
            for (const sampleValue of inputSamples) {
                this.samples[this.totalSamples++] = sampleValue;
            }
        } else {
            // If full
            const numNewSamples = inputSamples.length;
            const numExistingSamples = this.samples.length - numNewSamples;

            // Cycle buffer by number of new samples coming in
            for (let i = 0; i < numNewSamples; i++) {
                this.samples[i] = inputSamples[i + numExistingSamples];
            }

            // Append new samples to buffer
            for (let i = 0; i < numNewSamples; i++) {
                this.samples[numExistingSamples + i] = inputSamples[i];
            }

            this.totalSamples += inputSamples.length;
        }

        if (this.totalSamples > this.numAudioSamplesPerAnalysis && this.detector) {
            const result = this.detector.detect_pitch(this.samples);

            if (result !== 0) {
                this.port.postMessage({ type: "pitch", pitch: result });
            }
        }

        // Return true to keep the audio process going.
        return true;
    }
}