import React from 'react';
import { getStaffStep, NOTES, KEYS, getVisualAccidental } from '../utils/music';
import { InstrumentType } from '../types';

interface StaffProps {
  targetMidi: number | null;
  detectedMidi: number | null;
  instrument: InstrumentType;
  currentKey: string;
}

const LINE_HEIGHT = 14; 
const STAFF_COLOR = "#374151"; 
const NOTE_COLOR_TARGET = "#000000";
const NOTE_COLOR_CORRECT = "#16a34a";
const NOTE_COLOR_WRONG = "#dc2626";

const Staff: React.FC<StaffProps> = ({ targetMidi, detectedMidi, instrument, currentKey }) => {
  
  const CENTER_Y = 110;
  // Steps: 0 is bottom line (E4 for Treble, G2 for Bass). 8 is top line.
  const getY = (step: number) => CENTER_Y + (4 * LINE_HEIGHT) - (step * (LINE_HEIGHT / 2));

  const clefType = instrument === 'bass' ? 'bass' : 'treble';

  // Render Key Signatures (Sharps/Flats)
  const renderKeySignature = () => {
      const key = KEYS[currentKey];
      if (!key || key.accidentals === 0) return null;

      const elements = [];
      const isSharp = key.accidentals > 0;
      const count = Math.abs(key.accidentals);

      let positions: number[] = [];

      if (clefType === 'treble') {
          // Treble Clef
          // Sharps: F, C, G, D, A, E, B
          if (isSharp) positions = [8, 5, 9, 6, 3, 7, 4];
          // Flats: B, E, A, D, G, C, F
          else positions = [4, 7, 3, 6, 2, 5, 1];
      } else {
          // Bass Clef
          // Sharps: F, C, G, D, A, E, B
          if (isSharp) positions = [6, 3, 7, 4, 1, 5, 2];
          // Flats: B, E, A, D, G, C, F
          else positions = [2, 5, 1, 4, 0, 3, -1];
      }

      for (let i = 0; i < count; i++) {
          const step = positions[i];
          const x = 75 + (i * 15); 
          const y = getY(step);
          elements.push(
              <text key={i} x={x} y={y + 1} fontSize="24" fill={STAFF_COLOR} textAnchor="middle" dominantBaseline="central" fontFamily="Times New Roman, serif" style={{ userSelect: 'none' }}>
                  {isSharp ? '♯' : '♭'}
              </text>
          );
      }
      return <g>{elements}</g>;
  };

  const keySigWidth = Math.abs(KEYS[currentKey]?.accidentals || 0) * 15;
  const startX = 75; 
  const noteOffsetX = Math.max(160, startX + keySigWidth + 40);

  const NoteHead = ({ midi, color, isGhost = false }: { midi: number, color: string, isGhost?: boolean }) => {
    const visualMidi = midi + 12;
    const step = getStaffStep(visualMidi, clefType);
    const y = getY(step);
    const accidental = getVisualAccidental(midi, currentKey);

    const renderLedgers = () => {
        const lines = [];
        let current = -2;
        // Fix: Changed from 'step - 1' to 'step' to prevent drawing the line below space notes
        while (current >= step) { 
             lines.push(current);
             current -= 2;
        }
        current = 10;
        // Fix: Changed from 'step + 1' to 'step' to prevent drawing the line above space notes
        while (current <= step) {
            lines.push(current);
            current += 2;
        }
        return lines;
    };

    return (
      <g opacity={isGhost ? 0.6 : 1} className="transition-all duration-300 ease-out">
        {renderLedgers().map((s) => (
             <line key={s} x1={noteOffsetX - 16} y1={getY(s)} x2={noteOffsetX + 16} y2={getY(s)} stroke={color} strokeWidth="1.5" />
        ))}

        {accidental === '#' && <text x={noteOffsetX - 20} y={y + 1} fontSize="22" fill={color} textAnchor="middle" dominantBaseline="central" fontFamily="Times New Roman, serif">♯</text>}
        {accidental === 'b' && <text x={noteOffsetX - 20} y={y + 1} fontSize="22" fill={color} textAnchor="middle" dominantBaseline="central" fontFamily="Times New Roman, serif">♭</text>}
        
        {!accidental && NOTES[visualMidi % 12].includes('#') && !KEYS[currentKey].notes.includes(midi % 12) && (
             <text x={noteOffsetX - 20} y={y + 1} fontSize="22" fill={color} textAnchor="middle" dominantBaseline="central" fontFamily="Times New Roman, serif">♯</text>
        )}

        <ellipse cx={noteOffsetX} cy={y} rx="8.5" ry="6.5" transform={`rotate(-20 ${noteOffsetX} ${y})`} fill={isGhost ? "none" : color} stroke={color} strokeWidth="2" />
        <line x1={step < 4 ? noteOffsetX + 7.5 : noteOffsetX - 7.5} y1={y} x2={step < 4 ? noteOffsetX + 7.5 : noteOffsetX - 7.5} y2={step < 4 ? y - 42 : y + 42} stroke={color} strokeWidth="1.5" />
      </g>
    );
  };

  const lineYPositions = [0, 2, 4, 6, 8].map(getY);

  return (
    <div className="w-full flex justify-center py-4 md:py-8 bg-white rounded-xl shadow-sm border border-slate-200 min-h-[200px] md:min-h-[260px] overflow-hidden">
      <svg viewBox="0 0 400 240" className="w-full h-auto max-w-[400px] overflow-visible">
        {lineYPositions.map((y, i) => (
          <line key={i} x1="0" y1={y} x2="400" y2={y} stroke={STAFF_COLOR} strokeWidth="1.5" />
        ))}
        
        {clefType === 'treble' ? (
            <g transform="translate(10, 0)">
                <text x="-8" y={getY(2) + 26} fontSize="130" fontFamily="Times New Roman, serif" fill={STAFF_COLOR} style={{ userSelect: 'none' }}>𝄞</text>
                <text x="12" y={getY(0) + 55} fontSize="16" fontFamily="Times New Roman, serif" fontWeight="bold" fill={STAFF_COLOR} style={{ userSelect: 'none' }}>8</text>
            </g>
        ) : (
            <g transform="translate(10, 0)">
                <text x="-5" y={getY(4) + 21} fontSize="72" fontFamily="Times New Roman, serif" fill={STAFF_COLOR} style={{ userSelect: 'none' }}>𝄢</text>
                <text x="12" y={getY(0) + 55} fontSize="16" fontFamily="Times New Roman, serif" fontWeight="bold" fill={STAFF_COLOR} style={{ userSelect: 'none' }}>8</text>
            </g>
        )}

        {renderKeySignature()}

        {targetMidi && <NoteHead midi={targetMidi} color={NOTE_COLOR_TARGET} />}
        {detectedMidi && detectedMidi !== targetMidi && <g><NoteHead midi={detectedMidi} color={NOTE_COLOR_WRONG} isGhost={true} /></g>}
        {detectedMidi && detectedMidi === targetMidi && <g><NoteHead midi={detectedMidi} color={NOTE_COLOR_CORRECT} /></g>}

      </svg>
    </div>
  );
};

export default Staff;