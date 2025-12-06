export class MetronomeService {
    private audioContext: AudioContext | null = null;
    private isPlaying: boolean = false;
    private bpm: number = 60;
    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // s
    private nextNoteTime: number = 0.0;
    private timerID: number | null = null;

    constructor(initialBpm: number) {
        this.bpm = initialBpm;
    }

    public setBpm(bpm: number) {
        this.bpm = bpm;
    }

    public start() {
        if (this.isPlaying) return;

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        // Ensure context is running (browsers suspend it until user interaction)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.nextNoteTime = this.audioContext.currentTime + 0.05;
        this.scheduler();
    }

    public stop() {
        this.isPlaying = false;
        if (this.timerID) {
            window.clearTimeout(this.timerID);
            this.timerID = null;
        }
    }

    private scheduler = () => {
        if (!this.audioContext) return;

        // while there are notes that will need to play before the next interval, 
        // schedule them and advance the pointer.
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.nextNoteTime);
            this.nextNote();
        }
        
        if (this.isPlaying) {
            this.timerID = window.setTimeout(this.scheduler, this.lookahead);
        }
    }

    private nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
    }

    private scheduleNote(time: number) {
        if (!this.audioContext) return;
        
        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Create a short, sharp "woodblock" type click
        osc.frequency.setValueAtTime(1000, time);
        osc.frequency.exponentialRampToValueAtTime(1200, time + 0.01);
        
        gainNode.gain.setValueAtTime(1, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        osc.start(time);
        osc.stop(time + 0.03);
    }
}