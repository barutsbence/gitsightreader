
import React from 'react';
import { findFretPositions, getNoteDetails, INSTRUMENTS, KEYS } from '../utils/music';
import { InstrumentType, InputMode } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FretboardProps {
    targetMidi: number | null;
    instrument: InstrumentType;
    inputMode: InputMode;
    startFret: number;
    currentKey: string;
    showTarget: boolean;
    onPositionChange: (newStart: number) => void;
    onNoteInput?: (midi: number) => void;
}

const Fretboard: React.FC<FretboardProps> = ({ 
    targetMidi, 
    instrument, 
    inputMode, 
    startFret, 
    currentKey,
    showTarget,
    onPositionChange,
    onNoteInput 
}) => {
    const activePositions = (targetMidi && showTarget) ? findFretPositions(targetMidi, instrument, startFret) : [];
    const config = INSTRUMENTS[instrument];
    const stringIndices = Array.from({ length: config.strings.length }, (_, i) => i);

    const isInteractive = inputMode === 'manual';
    const keyData = KEYS[currentKey];

    const handleFretClick = (stringIndex: number, fretOffset: number) => {
        if (!isInteractive || !onNoteInput) return;
        
        // Calculate absolute fret
        // fretOffset 0 is "before Nut", i.e. Open String
        let midi = 0;
        if (fretOffset === 0) {
            midi = config.strings[stringIndex];
        } else {
            // block 1 = startFret, block 2 = startFret + 1...
            // Visual grid slot 1 maps to startFret
            // If startFret is 0, slot 1 is fret 1.
            // If startFret is 5, slot 1 is fret 5.
            const f = startFret === 0 ? fretOffset : startFret + (fretOffset - 1);
            midi = config.strings[stringIndex] + f;
        }
        
        onNoteInput(midi);
    };

    // Helper to change position
    const shiftPosition = (delta: number) => {
        const newStart = Math.max(0, Math.min(12, startFret + delta));
        onPositionChange(newStart);
    };

    // Calculate which frets to display numbers for
    // If startFret is 0, visual blocks are 1, 2, 3, 4. Open is 0.
    // If startFret is 5, visual blocks are 5, 6, 7, 8.
    const fretNumbers = [0, 1, 2, 3].map(i => startFret === 0 ? i + 1 : startFret + i);

    return (
        <div className="w-full max-w-md mx-auto bg-[#4a3b32] p-4 rounded-lg shadow-inner select-none">
            
            {/* Controls header */}
            <div className="flex justify-between items-center mb-2 text-[#d4d4d8] text-xs font-mono">
                <button 
                    onClick={() => shiftPosition(-1)}
                    disabled={startFret === 0}
                    className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="uppercase tracking-widest font-bold">
                    {startFret === 0 ? "Open Position" : `${startFret}. Fekvés`}
                </span>
                <button 
                    onClick={() => shiftPosition(1)}
                    disabled={startFret >= 12}
                    className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="relative flex flex-col gap-5 py-2">
                
                {/* Frets (Vertical Lines) */}
                <div className="absolute inset-0 flex pointer-events-none px-4">
                    {/* Nut or Position Marker */}
                    <div className={`border-l-[6px] ${startFret === 0 ? 'border-[#d4d4d8]' : 'border-[#a1a1aa]'} h-full mr-auto shadow-md z-10`}></div>
                    
                    {/* Fret Blocks */}
                    {fretNumbers.map(fretNum => (
                        <div key={fretNum} className="flex-1 border-r-[3px] border-[#9ca3af] h-full relative">
                            <span className="absolute -bottom-6 right-[-8px] text-xs text-slate-400 font-mono">{fretNum}</span>
                        </div>
                    ))}
                    <div className="w-4"></div>
                </div>

                {/* Strings */}
                {stringIndices.map((stringIdx) => {
                    const isBass = instrument === 'bass';
                    const baseThickness = isBass ? 2 : 1;
                    const increment = isBass ? 0.8 : 0.5;
                    const thickness = baseThickness + (stringIdx * increment);
                    
                    // Open String Note
                    const openMidi = config.strings[stringIdx];
                    const isOpenInKey = keyData?.notes.includes(openMidi % 12);

                    return (
                        <div key={stringIdx} className="relative h-6 w-full flex items-center z-0 group">
                            {/* Hit Areas for Open String (Left of Nut) */}
                            <div 
                                className={`absolute left-0 w-[4%] h-full z-30 cursor-pointer ${isInteractive ? 'hover:bg-white/10' : ''}`}
                                onClick={() => handleFretClick(stringIdx, 0)}
                                title={isInteractive ? `Open String` : ''}
                            ></div>
                            
                            {/* Scale Marker for Open String */}
                            {inputMode === 'manual' && isOpenInKey && (
                                <div className="absolute left-[2%] transform -translate-x-1/2 w-2 h-2 bg-indigo-300 rounded-full opacity-60 z-20 pointer-events-none"></div>
                            )}

                            {/* String Line */}
                            <div 
                                className="w-full bg-[#d1d5db] shadow-sm relative pointer-events-none"
                                style={{ height: `${thickness}px`, opacity: 0.9 }}
                            ></div>

                            {/* Hit Areas for Frets & Scale Markers */}
                            {[1, 2, 3, 4].map((slot) => {
                                const fretNum = startFret === 0 ? slot : startFret + (slot - 1);
                                const midi = config.strings[stringIdx] + fretNum;
                                const isInKey = keyData?.notes.includes(midi % 12);
                                const leftPercent = 2 + (slot - 1) * 22; // Aligning with hit areas

                                return (
                                    <React.Fragment key={slot}>
                                        <div
                                            className={`absolute h-full z-30 cursor-pointer ${isInteractive ? 'hover:bg-white/10' : ''}`}
                                            style={{ 
                                                left: `${leftPercent}%`, 
                                                width: '20%' 
                                            }}
                                            onClick={() => handleFretClick(stringIdx, slot)}
                                        ></div>
                                        
                                        {/* Scale Marker */}
                                        {inputMode === 'manual' && isInKey && (
                                            <div 
                                                className="absolute w-2 h-2 bg-indigo-300 rounded-full opacity-60 z-20 pointer-events-none"
                                                style={{ left: `${leftPercent + 10}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                                            ></div>
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {/* Note Markers (Target / Detected) */}
                            {activePositions
                                .filter(pos => pos.stringIndex === stringIdx)
                                .map((pos, idx) => {
                                    // Visual positioning
                                    let leftPos = null;
                                    
                                    if (pos.fret === 0 && startFret === 0) leftPos = "2%";
                                    else if (pos.fret >= startFret && pos.fret < startFret + 4) {
                                        const relIndex = pos.fret - startFret;
                                        const slotIndex = startFret === 0 ? relIndex - 1 : relIndex; 
                                        
                                        if (slotIndex >= 0 && slotIndex < 4) {
                                            const leftP = 2 + (slotIndex * 22) + 10;
                                            leftPos = `${leftP}%`;
                                        }
                                    }

                                    if (!leftPos) return null;

                                    return (
                                        <div 
                                            key={idx}
                                            className="absolute transform -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(34,197,94,0.6)] z-20 flex items-center justify-center animate-pulse pointer-events-none"
                                            style={{ left: leftPos, top: '50%' }}
                                        >
                                            <span className="text-[10px] font-bold text-white">
                                                {targetMidi && getNoteDetails(targetMidi).note}
                                            </span>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    );
                })}
            </div>
            
             {/* Inlay Dots Logic */}
             {[3, 5, 7, 9, 12].map(dotFret => {
                 if (dotFret >= startFret && dotFret < startFret + 4) {
                     // Determine visual center similar to note logic
                     const relIndex = dotFret - startFret;
                     const slotIndex = startFret === 0 ? relIndex - 1 : relIndex;
                     
                     if (slotIndex >= 0 && slotIndex < 4) {
                         const leftP = 2 + (slotIndex * 22) + 10;
                         const isDouble = dotFret === 12;
                         
                         return (
                             <div key={dotFret} className="absolute top-[50%] transform -translate-y-1/2 pointer-events-none" style={{ left: `${leftP}%` }}>
                                 <div className={`w-3 h-3 bg-slate-400 rounded-full opacity-40 shadow-inner ${isDouble ? '-translate-y-3' : ''}`}></div>
                                 {isDouble && <div className="w-3 h-3 bg-slate-400 rounded-full opacity-40 shadow-inner translate-y-3 mt-1"></div>}
                             </div>
                         )
                     }
                 }
                 return null;
             })}

        </div>
    );
};

export default Fretboard;
