
// main thread Audio Worklet Node functions handles the audio worklet processor
export default class PitchNode extends AudioWorkletNode {
    init(wasmBytes, onPitchDetectedCallback, numAudioSamplesPerAnalysis) {
        this.onPitchDetectedCallback = onPitchDetectedCallback;
        this.numAudioSamplesPerAnalysis = numAudioSamplesPerAnalysis;

        // Listen to messages sent from the audio processor
        this.port.onmessage = (event) => this.onmessage(event.data);

        // Pass the pitch detecor wasm module bytes to the processor via async message
        this.port.postMessage({
            type: "send-wasm-module",
            wasmBytes
        });
    }

    onprocessorerror(err) {
        console.log(`An error occurred in Audio Worklet Processor: ${err}`);
    }

    onmessage(event) {
        if (event.type === 'wasm-module-loaded') {
            this.port.postMessage({
                type: 'init-detector',
                sampleRate: this.context.sampleRate,
                numAudioSamplesPerAnalysis: this.numAudioSamplesPerAnalysis
            });
        } else if (event.type === 'pitch') {
            this.onPitchDetectedCallback(event.pitch);
        }
    }
}