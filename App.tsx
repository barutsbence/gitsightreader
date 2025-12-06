
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Mic, MicOff, Music, Eye, EyeOff, Trophy, Volume2, AlertCircle, Settings2, Play, Square, Minus, Plus, Timer, Hand, RefreshCw, AudioWaveform, Gamepad2, X } from 'lucide-react';
import Staff from './components/Staff';
import Fretboard from './components/Fretboard';
import Tuner from './components/Tuner';
import { AudioService } from './services/audio';
import { MetronomeService } from './services/metronome';
import { generateRandomNote, getNoteDetails, KEYS, INSTRUMENTS } from './utils/music';
import { GameStatus, InstrumentType, InputMode } from './types';

const App: React.FC = () => {
    // Tab State: 'game' | 'tuner'
    const [activeTab, setActiveTab] = useState<'game' | 'tuner'>('game');

    const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
    const [targetMidi, setTargetMidi] = useState<number | null>(null);
    const [detectedMidi, setDetectedMidi] = useState<number | null>(null);
    const [currentFrequency, setCurrentFrequency] = useState<number | null>(null); // For Tuner
    const [streak, setStreak] = useState(0);
    const [showFretboard, setShowFretboard] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [isAudioInitialized, setIsAudioInitialized] = useState(false);
    
    // Settings State
    const [instrument, setInstrument] = useState<InstrumentType>('guitar');
    const [currentKey, setCurrentKey] = useState<string>('C');
    const [inputMode, setInputMode] = useState<InputMode>('microphone');
    const [startFret, setStartFret] = useState(0); // For Position (Lage)
    const [showSettings, setShowSettings] = useState(false);

    // Range Settings
    const [minMidiRange, setMinMidiRange] = useState<number | null>(null);
    const [maxMidiRange, setMaxMidiRange] = useState<number | null>(null);

    // Audio Input Settings
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [selectedChannel, setSelectedChannel] = useState<number>(-1); // -1: Default, 0: Ch1, 1: Ch2

    // Metronome State
    const [bpm, setBpm] = useState(60);
    const [metronomePlaying, setMetronomePlaying] = useState(false);
    const metronomeServiceRef = useRef<MetronomeService>(new MetronomeService(60));

    const audioServiceRef = useRef<AudioService | null>(null);
    const stabilityCounter = useRef(0);
    const lastDetectedMidi = useRef<number | null>(null);

    // Load Devices
    const loadAudioDevices = async () => {
        const devices = await AudioService.getInputDevices();
        setAudioDevices(devices);
    };

    useEffect(() => {
        loadAudioDevices();
        navigator.mediaDevices?.addEventListener('devicechange', loadAudioDevices);
        return () => {
            navigator.mediaDevices?.removeEventListener('devicechange', loadAudioDevices);
        };
    }, []);

    // Initial setup
    useEffect(() => {
        const customRange = (minMidiRange !== null && maxMidiRange !== null)
            ? { min: minMidiRange, max: maxMidiRange }
            : undefined;

        setTargetMidi(generateRandomNote(instrument, currentKey, startFret, customRange));
    }, [instrument, currentKey, startFret, minMidiRange, maxMidiRange]);

    const startAudio = async () => {
        // If service doesn't exist, create it
        if (!audioServiceRef.current) {
            audioServiceRef.current = new AudioService(handlePitchDetected);
        }

        try {
            await audioServiceRef.current.start(selectedDeviceId, selectedChannel);
            
            if (audioServiceRef.current.audioContext?.state === 'running') {
                setStatus(GameStatus.LISTENING);
                setAudioError(null);
                setIsAudioInitialized(true);
                loadAudioDevices();
            } else {
                setIsAudioInitialized(false);
            }
        } catch (err: any) {
            console.error(err);
            setAudioError(err.message || "Nem sikerült elindítani a mikrofont.");
            setStatus(GameStatus.ERROR);
            setIsAudioInitialized(false);
        }
    };

    // Automatically restart audio service with new settings if device/channel changes while active
    useEffect(() => {
        if (status === GameStatus.LISTENING && inputMode === 'microphone') {
            const restartAudio = async () => {
                await startAudio();
            };
            restartAudio();
        }
    }, [selectedDeviceId, selectedChannel]);

    useEffect(() => {
        return () => {
            if (audioServiceRef.current) {
                audioServiceRef.current.stop();
            }
            metronomeServiceRef.current.stop();
        };
    }, []);


    // Sync BPM
    useEffect(() => {
        metronomeServiceRef.current.setBpm(bpm);
    }, [bpm]);

    const handlePitchDetected = useCallback((freq: number) => {
        // Always update raw frequency for Tuner
        setCurrentFrequency(freq);

        const midi = Math.round(12 * (Math.log(freq / 440) / Math.log(2)) + 69);
        
        if (midi < 20 || midi > 95) return;

        if (midi === lastDetectedMidi.current) {
            stabilityCounter.current++;
        } else {
            stabilityCounter.current = 0;
            lastDetectedMidi.current = midi;
        }

        if (stabilityCounter.current > 1) { // Reduced for faster response
            setDetectedMidi(midi);
        }
    }, []);

    const stopAudio = () => {
        if (audioServiceRef.current) {
            audioServiceRef.current.stop();
        }
        setStatus(GameStatus.IDLE);
        setDetectedMidi(null);
        setCurrentFrequency(null);
    };

    const toggleListening = async () => {
        const isAudioActive = audioServiceRef.current?.audioContext?.state === 'running';
        
        if (isAudioActive && status === GameStatus.LISTENING) {
            stopAudio();
        } else {
            if (inputMode === 'microphone') {
                await startAudio();
            } else if (activeTab === 'game') {
                setStatus(GameStatus.LISTENING);
                setShowFretboard(true);
            }
        }
    };

    const handleManualNoteInput = (midi: number) => {
        if (status === GameStatus.LISTENING && activeTab === 'game') {
            setDetectedMidi(midi);
            stabilityCounter.current = 10; 
        }
    };

    const toggleMetronome = () => {
        if (metronomePlaying) {
            metronomeServiceRef.current.stop();
        } else {
            metronomeServiceRef.current.start();
        }
        setMetronomePlaying(!metronomePlaying);
    };

    const adjustBpm = (amount: number) => {
        setBpm(prev => Math.max(40, Math.min(240, prev + amount)));
    };

    // Game Loop Logic
    useEffect(() => {
        if (activeTab === 'game' && status === GameStatus.LISTENING && detectedMidi !== null && targetMidi !== null) {
            const isMatch = detectedMidi === targetMidi || 
                           (instrument === 'bass' && (Math.abs(detectedMidi - targetMidi) === 12 || Math.abs(detectedMidi - targetMidi) === 24));

            if (isMatch) {
                setStatus(GameStatus.CORRECT);
                setStreak(s => s + 1);
                
                setTimeout(() => {
                    const customRange = (minMidiRange !== null && maxMidiRange !== null)
                        ? { min: minMidiRange, max: maxMidiRange }
                        : undefined;
                    setTargetMidi(generateRandomNote(instrument, currentKey, startFret, customRange));
                    setDetectedMidi(null);
                    setStatus(GameStatus.LISTENING);
                    stabilityCounter.current = 0;
                }, 1000); 
            } else if (inputMode === 'manual') {
                 setTimeout(() => {
                    setDetectedMidi(null); 
                 }, 500);
            }
        }
    }, [detectedMidi, targetMidi, status, instrument, currentKey, startFret, inputMode, activeTab, minMidiRange, maxMidiRange]);

    // Handle Tab Switching
    const handleTabSwitch = async (tab: 'game' | 'tuner') => {
        if (activeTab === tab) return;
        setActiveTab(tab);

        if (inputMode === 'microphone') {
            if (!audioServiceRef.current || audioServiceRef.current.audioContext?.state !== 'running') {
                await startAudio();
            }
        }
    };

    const currentNoteName = detectedMidi ? getNoteDetails(detectedMidi).full : '--';

    const instrumentNoteOptions = useMemo(() => {
        const inst = INSTRUMENTS[instrument];
        const options = [];
        for (let i = inst.minMidi; i <= inst.maxMidi; i++) {
            options.push({ value: i, label: getNoteDetails(i).full });
        }
        return options;
    }, [instrument]);

    // Mobile "Tap to Start" Overlay
    if (!isAudioInitialized && inputMode === 'microphone') {
        return (
            <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center p-6 text-white text-center animate-in fade-in duration-500">
                <Music className="w-16 h-16 mb-6 text-indigo-400 animate-pulse" />
                <h1 className="text-2xl font-bold mb-2">Üdvözöllek!</h1>
                <p className="text-slate-300 mb-8 max-w-xs">
                    Az alkalmazás használatához engedélyezned kell a mikrofont. Kérlek, kattints az indításhoz.
                </p>
                <button 
                    onClick={() => startAudio()}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:bg-indigo-500 transition-transform active:scale-95 flex items-center gap-2"
                >
                    <Play fill="currentColor" /> Indítás
                </button>
                {audioError && (
                    <p className="mt-4 text-red-400 bg-red-900/50 p-3 rounded text-sm max-w-xs">{audioError}</p>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
            
            <nav className="w-full bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-600">
                    <Music className="w-6 h-6" />
                    <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-800">Guitar SightReader</h1>
                </div>
                {activeTab === 'game' && (
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-slate-700">{streak}</span>
                    </div>
                )}
            </nav>

            <main className="w-full max-w-lg px-4 pt-4 md:pt-6 flex flex-col gap-4 md:gap-6">
                
                {/* Tab Navigation */}
                <div className="flex p-1 bg-slate-200 rounded-xl">
                    <button 
                        onClick={() => handleTabSwitch('game')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                            activeTab === 'game' 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Gamepad2 className="w-4 h-4" /> Játék
                    </button>
                    <button 
                        onClick={() => handleTabSwitch('tuner')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                            activeTab === 'tuner' 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <AudioWaveform className="w-4 h-4" /> Hangoló
                    </button>
                </div>

                {/* Settings Toggle */}
                <div className="flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {activeTab === 'game' ? 'Gyakorlás' : 'Hangszer Hangolás'}
                     </span>
                     <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-sm text-slate-500 flex items-center gap-1 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm"
                    >
                        <Settings2 className="w-4 h-4" /> Beállítások
                    </button>
                </div>

                {showSettings && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Hangszer & Hangnem</label>
                                <div className="flex gap-2 mb-2">
                                    <button 
                                        onClick={() => setInstrument('guitar')}
                                        className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-all ${instrument === 'guitar' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        Gitár
                                    </button>
                                    <button 
                                        onClick={() => setInstrument('bass')}
                                        className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-all ${instrument === 'bass' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        Basszus
                                    </button>
                                </div>
                                {activeTab === 'game' && (
                                    <>
                                        <select 
                                            value={currentKey} 
                                            onChange={(e) => setCurrentKey(e.target.value)}
                                            className="w-full py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {Object.values(KEYS).map(k => (
                                                <option key={k.name} value={k.name}>{k.label}</option>
                                            ))}
                                        </select>
                                    </>
                                )}
                            </div>
                            {activeTab === 'game' && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Hangterjedelem</label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={minMidiRange ?? ''}
                                            onChange={e => setMinMidiRange(Number(e.target.value))}
                                            className="w-full py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700"
                                        >
                                            <option value="">Tól...</option>
                                            {instrumentNoteOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                        <select
                                            value={maxMidiRange ?? ''}
                                            onChange={e => setMaxMidiRange(Number(e.target.value))}
                                            className="w-full py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700"
                                        >
                                            <option value="">Ig...</option>
                                            {instrumentNoteOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                        <button onClick={() => { setMinMidiRange(null); setMaxMidiRange(null); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                            <X size={16}/>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Felülbírálja a Fekvés-alapú generálást.</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">Audio Bemenet</label>
                                    <button onClick={loadAudioDevices} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded" title="Eszközök frissítése"><RefreshCw size={12} /></button>
                                </div>
                                <select 
                                    value={selectedDeviceId} 
                                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                                    className="w-full py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 mb-2"
                                >
                                    <option value="">Alapértelmezett Eszköz</option>
                                    {audioDevices.map((device, idx) => (
                                        <option key={device.deviceId || idx} value={device.deviceId}>
                                            {device.label || `Eszköz ${idx + 1} (Névtelen)`}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">Ha nem látod az eszközödet, indítsd el a mikrofont, majd frissíts.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- GAME VIEW --- */}
                {activeTab === 'game' && (
                    <>
                        {audioError && inputMode === 'microphone' && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2 text-sm border border-red-100">
                                <AlertCircle className="w-5 h-5" />
                                {audioError}
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => {
                                    const newMode = inputMode === 'microphone' ? 'manual' : 'microphone';
                                    setInputMode(newMode);
                                }}
                                className={`text-sm px-3 py-1 rounded-full border transition-all flex items-center gap-1 ${
                                    inputMode === 'manual' 
                                    ? 'bg-amber-100 border-amber-200 text-amber-800' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600'
                                }`}
                            >
                                {inputMode === 'manual' ? <Hand size={14} /> : <Mic size={14} />}
                                {inputMode === 'manual' ? 'Nincs hangszer' : 'Mikrofon mód'}
                            </button>
                        </div>

                        <div className="relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-widest z-10">
                                Target Note
                            </div>
                            <Staff 
                                targetMidi={targetMidi} 
                                detectedMidi={detectedMidi} 
                                instrument={instrument} 
                                currentKey={currentKey}
                            />
                        </div>

                        <div className="flex flex-col items-center justify-center min-h-[50px] md:min-h-[60px]">
                            {status === GameStatus.CORRECT ? (
                                <div className="flex flex-col items-center text-center animate-bounce">
                                    <div className="text-xl md:text-2xl font-bold text-green-600">
                                        Helyes! 🎉
                                    </div>
                                    <div className="text-lg font-bold text-green-700 mt-1 font-mono">
                                        {targetMidi !== null ? getNoteDetails(targetMidi).full : ''}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-slate-500">
                                    {inputMode === 'microphone' ? (
                                        <Volume2 className={`w-5 h-5 ${status === GameStatus.LISTENING ? 'animate-pulse text-indigo-500' : ''}`} />
                                    ) : (
                                        <Hand className={`w-5 h-5 ${status === GameStatus.LISTENING ? 'animate-pulse text-amber-500' : ''}`} />
                                    )}
                                    <span className="text-lg font-mono font-medium">
                                        {inputMode === 'microphone' ? 'Hallott: ' : 'Bevitel: '} 
                                        <span className="text-slate-900">{currentNoteName}</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={toggleListening}
                                className={`flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold shadow-sm transition-all active:scale-95 ${
                                    status === GameStatus.LISTENING || status === GameStatus.CORRECT
                                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                }`}
                            >
                                {status === GameStatus.LISTENING || status === GameStatus.CORRECT ? (
                                    <>
                                        {inputMode === 'manual' ? <Square className="w-5 h-5" /> : <MicOff className="w-5 h-5" />} Szünet
                                    </>
                                ) : (
                                    <>
                                        {inputMode === 'manual' ? <Play className="w-5 h-5" /> : <Mic className="w-5 h-5" />} Folytatás
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => setShowFretboard(!showFretboard)}
                                className={`flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-medium border transition-all active:scale-95 shadow-sm ${
                                    inputMode === 'manual' && status === GameStatus.LISTENING
                                    ? 'bg-amber-50 border-amber-200 text-amber-700 ring-2 ring-amber-500/20'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                {showFretboard ? (
                                    <>
                                        <EyeOff className="w-5 h-5" /> {inputMode === 'manual' ? 'Bevitel' : 'Súgó'}
                                    </>
                                ) : (
                                    <>
                                        {inputMode === 'manual' ? <Hand className="w-5 h-5" /> : <Eye className="w-5 h-5" />} 
                                        {inputMode === 'manual' ? 'Bevitel Nyitása' : 'Súgó'}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Metronome Control Bar */}
                        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Timer className="w-5 h-5" />
                                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wide">Metronóm</span>
                            </div>

                            <div className="flex items-center gap-3 flex-1 justify-center">
                                <button 
                                    onClick={() => adjustBpm(-5)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 active:scale-95"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                
                                <div className="flex flex-col items-center w-24">
                                    <span className="text-lg font-mono font-bold text-slate-700 leading-none">{bpm}</span>
                                    <span className="text-[10px] text-slate-400">BPM</span>
                                </div>

                                <button 
                                    onClick={() => adjustBpm(5)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 active:scale-95"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="border-l border-slate-100 pl-4">
                                <button
                                    onClick={toggleMetronome}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
                                        metronomePlaying 
                                        ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {metronomePlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Fretboard (Collapsible) */}
                        <div 
                            className={`transform transition-all duration-500 ease-in-out overflow-hidden w-full ${
                                showFretboard ? 'max-h-80 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-4'
                            }`}
                        >
                            <div className="pt-2 pb-4">
                                <Fretboard 
                                    targetMidi={targetMidi} 
                                    instrument={instrument} 
                                    inputMode={inputMode}
                                    startFret={startFret}
                                    currentKey={currentKey}
                                    onPositionChange={setStartFret}
                                    onNoteInput={handleManualNoteInput}
                                    showTarget={inputMode === 'microphone' || status === GameStatus.CORRECT}
                                />
                                {inputMode === 'manual' && (
                                    <p className="text-center text-xs text-amber-600 mt-2 font-medium">
                                        Érintsd meg a fogólapon a megfelelő hangot!
                                    </p>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* --- TUNER VIEW --- */}
                {activeTab === 'tuner' && (
                    <Tuner 
                        frequency={currentFrequency}
                        isListening={!!audioServiceRef.current && status === GameStatus.LISTENING}
                        onToggleListening={toggleListening}
                        instrument={instrument}
                        audioError={audioError}
                    />
                )}

            </main>
        </div>
    );
};

export default App;