import PitchNode from "./PitchNode";

async function getWebAudioMediaStream() {
    if (!window.navigator.mediaDevices) {
        throw new Error("This browser does not support web audio or it is not enabled.");
    }

    try {
        // Request media access for audio
        const result = window.navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        return result;
    } catch (e) {
        switch (e.name) {
            case "NotAllowedError":
                throw new Error("Please allow usage of recording device in settings.");
            case "NotFoundError":
                throw new Error("No recording device was found. Please attach a microphone and tap retry.");
            default:
                throw e
        }
    }
}

export async function setupAudio(onPitchDetectedCallback) {
    // Get browser audio, waits for user to press "allow"
    const mediaStream = await getWebAudioMediaStream();

    const context = new window.AudioContext();
    const audioSource = context.createMediaStreamSource(mediaStream);


    let node;

    try {
        // Fetch pitch detection web assembly module
        const response = await window.fetch("wasm-audio/wasm_audio_bg.wasm");
        const wasmBytes = await response.arrayBuffer();

        // Add processor to context
        const processorUrl = "PitchProcessor.js";
        try {
            await context.audioWorklet.addModule(processorUrl);
        } catch (e) {
            throw new Error(`Failed to load audio analyzer worklet at url: ${processorUrl}, message: ${e.message}`);
        }

        node = new PitchNode(context, "PitchProcessor");

        const numAudioSamplesPerAnalysis = 1024;

        node.init(wasmBytes, onPitchDetectedCallback, numAudioSamplesPerAnalysis);

        // Connect audio source to analysis node.
        audioSource.connect(node);

        // Connect node audio output, even if there is none. Required.
        node.connect(context.destination);
    } catch (err) {
        throw new Error(`Failed to load WASM analyzer module. Message: ${err.message}`);
    }

    return { context, node };

}