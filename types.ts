
export interface Note {
    note: string;
    octave: number;
    full: string;
    midi: number;
    frequency?: number;
    deviation?: number;
}

export interface FretPosition {
    stringIndex: number; 
    fret: number;
}

export enum GameStatus {
    IDLE = 'IDLE',
    LISTENING = 'LISTENING',
    CORRECT = 'CORRECT',
    ERROR = 'ERROR'
}

export type InstrumentType = 'guitar' | 'bass';
export type InputMode = 'microphone' | 'manual';

export interface KeySignature {
    name: string; // e.g., 'G', 'F'
    label: string; // e.g., 'G Major'
    accidentals: number; // count. Positive for sharps, negative for flats.
    notes: number[]; // Array of MIDI pitch classes (0-11) in this scale
}

export interface InstrumentConfig {
    name: string;
    type: InstrumentType;
    strings: number[]; // MIDI notes of open strings (High to Low)
    minMidi: number;
    maxMidi: number;
    clef: 'treble' | 'bass';
}