
import { Note, FretPosition, InstrumentType, InstrumentConfig, KeySignature } from '../types';

// Magyar jelölés: H a B helyett, Bb marad Bb.
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'H'];
export const FREQUENCY_A4 = 440;

export const INSTRUMENTS: Record<InstrumentType, InstrumentConfig> = {
    guitar: {
        name: 'Gitár (6 húros)',
        type: 'guitar',
        // E4, H3, G3, D3, A2, E2 (High to Low)
        strings: [64, 59, 55, 50, 45, 40],
        minMidi: 40, // E2
        maxMidi: 88, // E6 (Extended range for positions)
        clef: 'treble'
    },
    bass: {
        name: 'Basszusgitár (4 húros)',
        type: 'bass',
        // G2, D2, A1, E1
        strings: [43, 38, 33, 28],
        minMidi: 28, // E1
        maxMidi: 67, // G4
        clef: 'bass'
    }
};

// Pitch classes for Major scales
// 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=Bb, 11=H
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

const getScaleNotes = (rootIndex: number): number[] => {
    return MAJOR_INTERVALS.map(interval => (rootIndex + interval) % 12);
};

export const KEYS: Record<string, KeySignature> = {
    'C': { name: 'C', label: 'C Dúr (Natúr)', accidentals: 0, notes: getScaleNotes(0) },
    'G': { name: 'G', label: 'G Dúr (1 ♯)', accidentals: 1, notes: getScaleNotes(7) },
    'D': { name: 'D', label: 'D Dúr (2 ♯)', accidentals: 2, notes: getScaleNotes(2) },
    'A': { name: 'A', label: 'A Dúr (3 ♯)', accidentals: 3, notes: getScaleNotes(9) },
    'E': { name: 'E', label: 'E Dúr (4 ♯)', accidentals: 4, notes: getScaleNotes(4) },
    'F': { name: 'F', label: 'F Dúr (1 ♭)', accidentals: -1, notes: getScaleNotes(5) },
    'Bb': { name: 'Bb', label: 'Bb Dúr (2 ♭)', accidentals: -2, notes: getScaleNotes(10) },
    'Eb': { name: 'Eb', label: 'Eb Dúr (3 ♭)', accidentals: -3, notes: getScaleNotes(3) },
    'Ab': { name: 'Ab', label: 'Ab Dúr (4 ♭)', accidentals: -4, notes: getScaleNotes(8) },
};

export const getNoteFromFrequency = (frequency: number): Note => {
  const noteNum = 12 * (Math.log(frequency / FREQUENCY_A4) / Math.log(2)) + 69;
  const midi = Math.round(noteNum);
  const deviation = noteNum - midi;
  
  return {
    ...getNoteDetails(midi),
    frequency,
    deviation
  };
};

export const getNoteDetails = (midi: number): Note => {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const noteName = NOTES[noteIndex];
  
  return {
    note: noteName,
    octave,
    full: `${noteName}${octave}`,
    midi
  };
};

export const findFretPositions = (midi: number, instrumentType: InstrumentType, startFret: number = 0): FretPosition[] => {
  const positions: FretPosition[] = [];
  const instrument = INSTRUMENTS[instrumentType];
  const fretCount = 4; // Viewport size (e.g. 0-4 or 5-9)

  instrument.strings.forEach((stringBaseMidi, stringIndex) => {
    const fret = midi - stringBaseMidi;
    // Check if fret is within the visible range or is an open string (only if startFret is 0)
    
    // If we are in position 0, we allow frets 0-4.
    // If we are in position 5, we allow frets 5-9.
    const minFret = startFret === 0 ? 0 : startFret;
    const maxFret = startFret + fretCount;

    if (fret >= minFret && fret <= maxFret) {
      positions.push({ stringIndex, fret });
    }
  });
  return positions;
};

export const getStaffStep = (midi: number, clef: 'treble' | 'bass'): number => {
    const diatonicMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 6, 6];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    const absDiatonicStep = (octave * 7) + diatonicMap[noteIndex];

    if (clef === 'treble') {
        return absDiatonicStep - 30;
    } else {
        return absDiatonicStep - 18;
    }
};

export const generateRandomNote = (
    instrumentType: InstrumentType, 
    keyKey: string, 
    startFret: number = 0,
    rangeOverride?: { min: number; max: number }
): number => {
    const inst = INSTRUMENTS[instrumentType];
    const key = KEYS[keyKey];
    
    let minMidi: number;
    let maxMidi: number;

    if (rangeOverride && rangeOverride.min <= rangeOverride.max) {
        minMidi = rangeOverride.min;
        maxMidi = rangeOverride.max;
    } else {
        // Fallback to position-based generation
        const lowestStringMidi = inst.strings[inst.strings.length - 1];
        const highestStringMidi = inst.strings[0];
        minMidi = lowestStringMidi + startFret;
        maxMidi = highestStringMidi + (startFret + 4); 
    }

    const possibleNotes = [];
    for(let i = minMidi; i <= maxMidi; i++) {
        const pitchClass = i % 12;
        if (key.notes.includes(pitchClass)) {
             possibleNotes.push(i);
        }
    }

    if (possibleNotes.length === 0) {
        // If no notes of the key are in the range, return the base of the range
        return minMidi;
    } 

    const randomIndex = Math.floor(Math.random() * possibleNotes.length);
    return possibleNotes[randomIndex];
};

export const getVisualAccidental = (midi: number, keyKey: string): string | null => {
    return null; // Simplified for diatonic modes
};
