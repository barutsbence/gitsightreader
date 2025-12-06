
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, Activity } from 'lucide-react';
import { getNoteFromFrequency, INSTRUMENTS, getNoteDetails } from '../utils/music';
import { InstrumentType } from '../types';

interface TunerProps {
  frequency: number | null;
  isListening: boolean;
  onToggleListening: () => void;
  instrument: InstrumentType;
  audioError: string | null;
}

const TUNER_CENTER_THRESHOLD = 3; // Strict tuning for green
const HISTORY_LENGTH = 60; // How many frames to keep for the graph

const Tuner: React.FC<TunerProps> = ({ 
  frequency, 
  isListening, 
  onToggleListening, 
  instrument,
  audioError 
}) => {
  const [pitchHistory, setPitchHistory] = useState<number[]>(new Array(HISTORY_LENGTH).fill(0));
  
  // Calculate Note info from frequency
  const tunerData = useMemo(() => {
    if (!frequency || frequency < 20) return null;
    const info = getNoteFromFrequency(frequency);
    const cents = (info.deviation || 0) * 100;
    return { ...info, cents };
  }, [frequency]);

  // Update history for graph
  useEffect(() => {
    if (isListening && tunerData) {
        setPitchHistory(prev => {
            const next = [...prev.slice(1), tunerData.cents];
            return next;
        });
    } else if (!isListening) {
        // Reset/flatline when stopped
        setPitchHistory(new Array(HISTORY_LENGTH).fill(0));
    }
  }, [tunerData, isListening]);

  // Standard tuning reference
  const standardStrings = useMemo(() => {
    const config = INSTRUMENTS[instrument];
    return [...config.strings].sort((a, b) => a - b).map(midi => {
        const details = getNoteDetails(midi);
        return { midi, label: details.full };
    });
  }, [instrument]);

  const renderGauge = (cents: number) => {
    const clampedCents = Math.max(-50, Math.min(50, cents));
    const percent = ((clampedCents + 50) / 100) * 100; 
    const absCents = Math.abs(cents);
    
    let colorClass = "bg-red-500";
    let glowClass = "";
    
    if (absCents <= TUNER_CENTER_THRESHOLD) {
        colorClass = "bg-green-500";
        glowClass = "shadow-[0_0_20px_rgba(34,197,94,0.8)]";
    } else if (absCents <= 15) {
        colorClass = "bg-amber-400";
    }

    return (
      <div className="w-full max-w-sm mx-auto mt-6 mb-2">
        {/* Main Arc Bar */}
        <div className="h-6 bg-slate-200 rounded-full overflow-hidden relative shadow-inner border border-slate-300">
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400 -translate-x-1/2 z-10"></div>
          
          {/* Ticks */}
          <div className="absolute top-1 bottom-1 left-[25%] w-px bg-slate-300"></div>
          <div className="absolute top-1 bottom-1 right-[25%] w-px bg-slate-300"></div>

          {/* Indicator Dot */}
          <div 
            className={`absolute top-0 bottom-0 w-6 h-6 rounded-full -ml-3 transition-all duration-100 ease-out border-2 border-white ${colorClass} ${glowClass}`}
            style={{ left: `${percent}%` }}
          />
        </div>
        
        {/* Scale Numbers */}
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono px-1">
          <span>Flat (b)</span>
          <span className="font-bold text-slate-500">0</span>
          <span>Sharp (#)</span>
        </div>
      </div>
    );
  };

  const renderHistoryGraph = () => {
      // SVG Coordinate system: X: 0-100, Y: 0-100. Center Y is 50.
      // -50 cents = 100Y (bottom), +50 cents = 0Y (top)
      
      const points = pitchHistory.map((cents, index) => {
          const x = (index / (HISTORY_LENGTH - 1)) * 100;
          // Clamp and invert Y axis
          const clamped = Math.max(-50, Math.min(50, cents));
          const y = 50 - clamped; 
          return `${x},${y}`;
      }).join(' ');

      return (
          <div className="w-full max-w-sm h-24 bg-slate-50 border border-slate-200 rounded-lg relative overflow-hidden mt-4">
              <div className="absolute top-2 left-2 text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                <Activity size={10} /> Intonáció
              </div>
              
              {/* Grid Lines */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-green-200 z-0"></div>
              <div className="absolute top-[25%] left-0 right-0 h-px bg-slate-100 border-t border-dashed border-slate-200 z-0"></div>
              <div className="absolute top-[75%] left-0 right-0 h-px bg-slate-100 border-t border-dashed border-slate-200 z-0"></div>

              <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline 
                    points={points} 
                    fill="none" 
                    stroke={Math.abs(tunerData?.cents || 0) < TUNER_CENTER_THRESHOLD ? "#22c55e" : "#64748b"} 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-colors duration-200"
                  />
              </svg>
          </div>
      );
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 animate-in fade-in zoom-in-95 duration-300 w-full">
      
      {audioError && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2 text-sm border border-red-100 mb-6 w-full max-w-md">
          <AlertCircle className="w-5 h-5" />
          {audioError}
        </div>
      )}

      {/* Control Button */}
      <button
        onClick={onToggleListening}
        className={`flex items-center justify-center gap-2 mb-8 py-3 px-6 rounded-full font-semibold shadow-sm transition-all active:scale-95 ${
          isListening
            ? 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
        }`}
      >
        {isListening ? <><MicOff className="w-4 h-4" /> Leállítás</> : <><Mic className="w-4 h-4" /> Indítás</>}
      </button>

      {/* Main Display Circle */}
      <div className="relative w-56 h-56 bg-white rounded-full border-[6px] border-slate-100 shadow-xl flex flex-col items-center justify-center mb-6">
        
        {!isListening ? (
            <span className="text-slate-300 font-medium">Kikapcsolva</span>
        ) : !tunerData ? (
            <span className="text-slate-300 font-medium animate-pulse">Várok a hangra...</span>
        ) : (
            <>
                <div className="flex items-baseline relative z-10">
                    <span className={`text-7xl font-black tracking-tighter transition-colors duration-100 ${
                        Math.abs(tunerData.cents) <= TUNER_CENTER_THRESHOLD ? 'text-green-500' : 'text-slate-800'
                    }`}>
                        {tunerData.note}
                    </span>
                    <span className="text-2xl text-slate-400 font-medium ml-1">
                        {tunerData.octave}
                    </span>
                </div>
                
                {/* Cents Display */}
                <div className={`text-lg font-mono font-bold mt-1 tabular-nums ${
                    Math.abs(tunerData.cents) <= TUNER_CENTER_THRESHOLD ? 'text-green-600' : 
                    tunerData.cents < 0 ? 'text-amber-500' : 'text-red-500'
                }`}>
                    {tunerData.cents > 0 ? '+' : ''}{Math.round(tunerData.cents)}
                    <span className="text-xs ml-1 font-normal opacity-70">cents</span>
                </div>

                {/* Hz Display */}
                <div className="text-xs font-mono text-slate-400 mt-2 bg-slate-50 px-2 py-1 rounded-md">
                    {frequency?.toFixed(1)} Hz
                </div>
            </>
        )}
      </div>

      {/* Linear Gauge */}
      {isListening && tunerData && renderGauge(tunerData.cents)}

      {/* Intonation History Graph */}
      {isListening && renderHistoryGraph()}

      {/* Reference Strings */}
      <div className="mt-8 w-full max-w-md">
        <h3 className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            {INSTRUMENTS[instrument].name} Húrok
        </h3>
        <div className="flex justify-center gap-2">
            {standardStrings.map((stringNote) => {
                const isMatch = tunerData && tunerData.midi === stringNote.midi;
                return (
                    <div 
                        key={stringNote.midi}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 text-sm font-bold ${
                            isMatch 
                            ? 'bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg' 
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                    >
                        {stringNote.label.replace(/[0-9]/g, '')}
                        <span className="text-[9px] align-top opacity-70 font-normal">{stringNote.label.replace(/[^0-9]/g, '')}</span>
                    </div>
                )
            })}
        </div>
      </div>

    </div>
  );
};

export default Tuner;
