
export class AudioService {
    public audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private mediaStream: MediaStream | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private splitter: ChannelSplitterNode | null = null;
    private animationId: number | null = null;
    private callback: (frequency: number) => void;

    constructor(onPitchDetected: (freq: number) => void) {
        this.callback = onPitchDetected;
    }

    public static async getInputDevices(): Promise<MediaDeviceInfo[]> {
        if (!navigator.mediaDevices?.enumerateDevices) return [];
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(d => d.kind === 'audioinput');
        } catch (e) {
            console.warn("Could not enumerate devices", e);
            return [];
        }
    }

    public async start(deviceId?: string, channelIndex: number = -1) {
        // 1. Ensure AudioContext is ready
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // 2. Cleanup previous stream if active
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
        }

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 8192; // Increased for better low-frequency precision

        let stream: MediaStream | null = null;

        // 3. Robust Constraint Strategy
        const musicConstraints = {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
        };

        try {
            // ATTEMPT 1: Specific Device + Music Settings
            if (deviceId) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: { deviceId: { exact: deviceId }, ...musicConstraints }
                    });
                } catch (e) {
                    console.warn(`Failed to get specific device ${deviceId} with music settings. Retrying without ID.`, e);
                }
            }

            // ATTEMPT 2: Default Device + Music Settings (Fallback if ID failed or wasn't provided)
            if (!stream) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: musicConstraints
                    });
                } catch (e) {
                    console.warn("Failed to get music settings. Retrying with default browser settings.", e);
                }
            }

            // ATTEMPT 3: Absolute Fallback (Just give me audio, I don't care about settings)
            if (!stream) {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true
                });
            }

        } catch (finalError) {
            console.error("CRITICAL: All attempts to get audio failed.", finalError);
            throw new Error("Nem sikerült elérni a mikrofont vagy a hangkártyát. Kérlek ellenőrizd a csatlakozást és a böngésző engedélyeket.");
        }

        if (!stream) throw new Error("Audio stream could not be initialized.");

        this.mediaStream = stream;
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Channel routing
        if (channelIndex >= 0) {
            const channelCount = this.source.channelCount || 2; 
            this.splitter = this.audioContext.createChannelSplitter(Math.max(2, channelIndex + 1));
            this.source.connect(this.splitter);
            try {
                this.splitter.connect(this.analyser, channelIndex, 0);
            } catch (e) {
                console.warn(`Could not route channel ${channelIndex}, falling back to default mix.`, e);
                this.source.disconnect(this.splitter);
                this.source.connect(this.analyser);
            }
        } else {
            this.source.connect(this.analyser);
        }

        if (!this.animationId) {
            this.detectPitch();
        }
    }

    public stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.splitter) {
            this.splitter.disconnect();
            this.splitter = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
             this.audioContext.suspend();
        }
    }

    private detectPitch = () => {
        if (!this.analyser || !this.audioContext) return;

        const buffer = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(buffer);

        const frequency = this.autoCorrelate(buffer, this.audioContext.sampleRate);
        
        if (frequency !== -1) {
            this.callback(frequency);
        }

        this.animationId = requestAnimationFrame(this.detectPitch);
    }

    private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
        let SIZE = buffer.length;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);

        // Increased threshold to reject more background noise
        if (rms < 0.01) return -1; 

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        }

        buffer = buffer.slice(r1, r2);
        SIZE = buffer.length;

        const c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
                c[i] = c[i] + buffer[j] * buffer[j + i];
            }
        }

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        
        let T0 = maxpos;

        const x1 = c[T0 - 1];
        const x2 = c[T0];
        const x3 = c[T0 + 1];
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return sampleRate / T0;
    }
}