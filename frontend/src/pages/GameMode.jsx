import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaPause, FaStop, FaForward, FaClock, FaMusic, FaRedo, FaUser, FaList } from 'react-icons/fa';

const GameMode = () => {
    const { user, game } = useAuth();
    const navigate = useNavigate();

    // Config States (Stored in localStorage)
    const [minTime, setMinTime] = useState(localStorage.getItem('minTime') || 60);
    const [maxTime, setMaxTime] = useState(localStorage.getItem('maxTime') || 300);
    const [isManualMode, setIsManualMode] = useState(false);

    // Flow State: 'IDLE', 'COUNTDOWN', 'MANUAL_SELECTION', 'VICTIM_MUSIC', 'ANNOUNCING', 'READY_TO_PLAY', 'PLAYING_CHALLENGE', 'FINISHED'
    const [status, setStatus] = useState('IDLE');

    // Manual Selection Data
    const [manualUsers, setManualUsers] = useState([]);
    const [manualChallenges, setManualChallenges] = useState([]);
    const [selectedManualUser, setSelectedManualUser] = useState(null);
    const [selectedManualChallengeId, setSelectedManualChallengeId] = useState('');

    // Data States
    const [currentData, setCurrentData] = useState(null); // { challenge, victim, music }
    const [countdown, setCountdown] = useState(0);
    const [timerId, setTimerId] = useState(null);
    const [musicTimer, setMusicTimer] = useState(15);

    // Audio State
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    // Track if paused? Not strictly needed if we just use playing state, but for UI play/pause buttons implies TTS pause.
    // window.speechSynthesis.paused is available.

    // Refs
    const musicRef = useRef(null); // For victim music
    const sfxRef = useRef(null); // For challenge specific SFX
    const wakeLockRef = useRef(null);
    const announceTimeoutRef = useRef(null); // New ref to handle the 1s delay timeout

    useEffect(() => {
        // Wake Lock
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                }
            } catch (err) { console.error('Wake Lock error:', err); }
        };
        requestWakeLock();

        fetchManualUsers();

        return () => {
            if (wakeLockRef.current) wakeLockRef.current.release();
            stopAllAudio();
            if (timerId) clearInterval(timerId);
        };
    }, []);

    const fetchManualUsers = async () => {
        try {
            const res = await axios.get('/api/game/users');
            setManualUsers(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchManualChallenges = async (userId) => {
        try {
            const res = await axios.get(`/api/game/user-challenges/${userId}`);
            setManualChallenges(res.data);
        } catch (err) { console.error(err); }
    };

    const saveConfig = (min, max) => {
        let cleanMin = parseInt(min);
        if (cleanMin < 0) cleanMin = 0;
        setMinTime(cleanMin);
        let cleanMax = parseInt(max);
        setMaxTime(cleanMax);
    };

    const validateAndSaveConfig = () => {
        let finalMin = parseInt(minTime);
        if (isNaN(finalMin) || finalMin < 60) finalMin = 60;

        let finalMax = parseInt(maxTime);
        if (isNaN(finalMax) || finalMax < finalMin) finalMax = finalMin;

        setMinTime(finalMin);
        setMaxTime(finalMax);
        localStorage.setItem('minTime', finalMin);
        localStorage.setItem('maxTime', finalMax);

        return { min: finalMin, max: finalMax };
    };

    const stopAllAudio = () => {
        setIsPlayingAudio(false);
        if (musicRef.current) { musicRef.current.pause(); musicRef.current = null; }
        if (sfxRef.current) { sfxRef.current.pause(); sfxRef.current = null; }
        window.speechSynthesis.cancel();
        if (announceTimeoutRef.current) {
            clearTimeout(announceTimeoutRef.current);
            announceTimeoutRef.current = null;
        }
    };

    const handleStopAudio = () => {
        stopAllAudio();
    };

    const speak = (text, voiceName, callback) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Always cancel previous

            const utterance = new SpeechSynthesisUtterance(text);
            if (voiceName && voiceName !== 'default') {
                const voices = window.speechSynthesis.getVoices();
                const selected = voices.find(v => v.name === voiceName);
                if (selected) utterance.voice = selected;
            }

            utterance.onend = () => {
                if (callback) callback();
            };

            utterance.onerror = (e) => {
                console.error("TTS Error", e);
                // Continue anyway
                if (callback) callback();
            };

            window.speechSynthesis.speak(utterance);
        } else if (callback) {
            callback();
        }
    };

    // 1. Start Countdown to Next Challenge
    const startNextGameCycle = () => {
        stopAllAudio();
        const config = validateAndSaveConfig();

        setStatus('COUNTDOWN');

        const time = Math.floor(Math.random() * (config.max - config.min + 1) + config.min);
        setCountdown(time);

        const id = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(id);
                    if (isManualMode) {
                        setStatus('MANUAL_SELECTION');
                        setSelectedManualUser(null);
                        setSelectedManualChallengeId('');
                        setManualChallenges([]);
                    } else {
                        fetchAndStartChallenge();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        setTimerId(id);
    };

    // 2a. Automatic Fetch
    const fetchAndStartChallenge = async () => {
        try {
            const res = await axios.get('/api/game/random');
            startChallengeFlow(res.data);
        } catch (err) {
            console.error("Fetch error", err);
            speak("Error obteniendo prueba. Reintentando.", null, startNextGameCycle);
        }
    };

    // 2b. Manual Selection Finish
    const confirmManualSelection = async () => {
        if (!selectedManualChallengeId) return;
        try {
            const res = await axios.get(`/api/game/data/${selectedManualChallengeId}`);
            startChallengeFlow(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    // Common Flow Start
    const startChallengeFlow = (data) => {
        setCurrentData(data);

        // Play Music
        setStatus('VICTIM_MUSIC');
        setMusicTimer(15);
        setIsPlayingAudio(true);

        if (data.music && data.music.filename) {
            musicRef.current = new Audio(`/uploads/${data.music.filename}`);
            musicRef.current.play().catch(e => console.log("Audio play error", e));
        }

        // Countdown 15s for music
        const musId = setInterval(() => {
            setMusicTimer(prev => {
                if (prev <= 1) {
                    clearInterval(musId);
                    // Timer finished, proceed to announce
                    announceChallenge(data);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        setTimerId(musId);
    };

    // 3. Announce Challenge (TTS)
    const announceChallenge = (data) => {
        setStatus('ANNOUNCING');

        // Stop music properly
        if (musicRef.current) {
            musicRef.current.pause();
            musicRef.current = null;
        }

        // Set playing true immediately to disable Replay button during pause
        setIsPlayingAudio(true);

        // Pause before speaking (1 second)
        announceTimeoutRef.current = setTimeout(() => {
            const challenge = data.challenge;
            const victim = data.victim;

            const texts = [
                `Atención. Jugador que Propone: ${victim.username}.`,
                `Prueba: ${challenge.title}.`,
                `Descripción: ${challenge.text}.`,
                `Reglas: ${challenge.rules || 'Ninguna'}.`,
                `Participantes: ${challenge.participants}.`,
                `Tiempo límite: ${challenge.timeLimit === 0 ? "Indefinido" : challenge.timeLimit + " segundos"}.`,
                challenge.objects ? `Objetos: ${challenge.objects}.` : '',
                "Pulsa Jugar cuando estéis listos."
            ];

            let index = 0;

            const speakNext = () => {
                // IMPORTANT: Check isPlayingAudio via state setter callback logic or ref? 
                // Since this closure captures initial state, we need to trust that if we called stopAllAudio, 
                // the speech synthesis was cancelled. 
                // But we need to know if we should CONTINUE the loop.
                // We can't easily access the fresh 'isPlayingAudio' state inside this closure.
                // However, 'window.speechSynthesis.speaking' helps, but stopping is the key.
                // If we stopped, 'stopAllAudio' cancelled window.speechSynthesis.
                // So the 'onend' of the previous utterance would fire? Yes.
                // But if we explicitly cancelled, we don't want to continue.

                // Let's use a mutable ref for the loop control or just check cancellation.
                // Better: if status changed from ANNOUNCING, stop.
                // But status stays ANNOUNCING.

                // We will rely on checking 'window.speechSynthesis' actually speaking? No.
                // Let's check a ref wrapper around isPlayingAudio if we really need to break.
                // For now, simpler: we check if the component is still mounted and playing intended.

                if (index < texts.length) {
                    const text = texts[index];
                    index++;

                    // Proceed
                    speak(text, challenge.voiceConfig, () => {
                        // Determine if we should continue
                        // We use a small timeout for natural pause between sentences
                        announceTimeoutRef.current = setTimeout(() => {
                            // Check if audio was stopped by user (we can check if playing state is still true in a Ref? Or just check if valid)
                            // A simple hack: check if 'status' is still 'ANNOUNCING'. If user clicked 'Stop', status is ANNOUNCING but audio stopped? 
                            // No, handleStopAudio calls stopAllAudio which sets isPlayingAudio false. 
                            // We need access to that fresh state.
                            // We can use the setState functional update to check? No.

                            // Let's just trust that if we cancelled, the loop effectively breaks because we control the chain.
                            // But onend fires even on cancel? 
                            // Verify: cancel() fires the error-event or end-event? usually end-event behaves weirdly on cancel.
                            // We'll proceed. The key is if 'stopAllAudio' was called, we want to ABORT.
                            // For this we can use a ref 'shouldPlayRef'.
                            if (shouldPlayRef.current) {
                                speakNext();
                            }
                        }, 500);
                    });
                } else {
                    setIsPlayingAudio(false);
                    setStatus('READY_TO_PLAY');
                }
            };

            // Start loop
            shouldPlayRef.current = true;
            speakNext();

        }, 1000); // 1s pause
    };

    const shouldPlayRef = useRef(false);

    // Override stopAllAudio to update ref
    const superStopAllAudio = () => {
        shouldPlayRef.current = false;
        stopAllAudio();
    };

    const repeatInstructions = () => {
        if (currentData) {
            announceChallenge(currentData);
        }
    };

    const pauseInstructions = () => window.speechSynthesis.pause();
    const resumeInstructions = () => window.speechSynthesis.resume();

    // 4. Play
    const playChallenge = () => {
        superStopAllAudio(); // Stop audio on play

        const challenge = currentData.challenge;

        if (challenge.soundId && challenge.soundId.filename) {
            sfxRef.current = new Audio(`/uploads/${challenge.soundId.filename}`);
            sfxRef.current.play().catch(e => console.log(e));
        }

        if (challenge.timeLimit > 0) {
            setStatus('PLAYING_CHALLENGE');
            setCountdown(challenge.timeLimit);
            const id = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(id);
                        finishChallenge();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            setTimerId(id);
        } else {
            startNextGameCycle();
        }
    };

    const skipChallenge = () => {
        superStopAllAudio(); // Stop audio on skip
        startNextGameCycle();
    };

    // 5. Finished
    const finishChallenge = () => {
        if (sfxRef.current) sfxRef.current.pause();
        speak("¡Tiempo Terminado!", 'default');
        setStatus('FINISHED');
    };

    const stopAndReset = () => {
        superStopAllAudio();
        if (timerId) clearInterval(timerId);
        setStatus('IDLE');
        setCurrentData(null);
    };

    const handleManualUserClick = (u) => {
        setSelectedManualUser(u);
        fetchManualChallenges(u._id);
        setSelectedManualChallengeId('');
    };

    return (
        <div className="full-screen-center" style={{ flexDirection: 'column', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>

                {/* Top Controls */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '5px' }}>
                    {(status === 'ANNOUNCING' || status === 'READY_TO_PLAY') && (
                        <>
                            <button className="btn-secondary" onClick={repeatInstructions} title="Repetir" disabled={isPlayingAudio} style={{ opacity: isPlayingAudio ? 0.5 : 1 }}>
                                <FaRedo />
                            </button>
                            <button className="btn-secondary" onClick={pauseInstructions} title="Pausar"><FaPause /></button>
                            <button className="btn-secondary" onClick={resumeInstructions} title="Continuar"><FaPlay /></button>
                            <button className="btn-danger" onClick={superStopAllAudio} title="Parar Audio"><FaStop /></button>
                        </>
                    )}
                </div>

                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '10px' }}>
                    <button className="btn-danger" onClick={() => { stopAndReset(); navigate('/dashboard'); }}><FaStop /> SALIR</button>
                    {status !== 'IDLE' && <button className="btn-secondary" onClick={stopAndReset}><FaStop /> RESET</button>}
                </div>

                {/* IDLE STATE */}
                {status === 'IDLE' && (
                    <div className="animate-fade-in">
                        <h1 style={{ marginBottom: '30px' }}>Configuración del Juego</h1>

                        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            <button className={`btn-secondary ${!isManualMode ? 'active' : ''}`} onClick={() => setIsManualMode(false)} style={{ background: !isManualMode ? 'var(--secondary)' : 'transparent', color: !isManualMode ? 'white' : 'white' }}>AUTOMÁTICO</button>
                            <button className={`btn-secondary ${isManualMode ? 'active' : ''}`} onClick={() => setIsManualMode(true)} style={{ background: isManualMode ? 'var(--secondary)' : 'transparent', color: isManualMode ? 'white' : 'white' }}>MANUAL</button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '10px' }}>Mínimo (seg)</label>
                                <input className="glass-input" type="number" value={minTime} onChange={e => setMinTime(e.target.value)} style={{ textAlign: 'center', fontSize: '1.5rem', width: '100px' }} />
                                <small style={{ display: 'block', color: 'gray' }}>Mín 60s</small>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '10px' }}>Máximo (seg)</label>
                                <input className="glass-input" type="number" value={maxTime} onChange={e => setMaxTime(e.target.value)} style={{ textAlign: 'center', fontSize: '1.5rem', width: '100px' }} />
                            </div>
                        </div>

                        <button className="btn-primary" style={{ fontSize: '2rem', padding: '20px 60px' }} onClick={startNextGameCycle}>
                            <FaPlay /> CONTINUAR
                        </button>
                    </div>
                )}

                {/* COUNTDOWN STATE */}
                {status === 'COUNTDOWN' && (
                    <div>
                        <h2>Próximo Reto en...</h2>
                        <div style={{ fontSize: '8rem', fontWeight: 'bold', color: '#06b6d4', margin: '40px 0' }}>{countdown}</div>
                        <p className="animate-pulse">Esperando...</p>
                    </div>
                )}

                {status === 'MANUAL_SELECTION' && (
                    <div className="animate-fade-in" style={{ textAlign: 'left', maxHeight: '70vh', overflowY: 'auto' }}>
                        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Selección Manual</h2>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <div style={{ flex: 1, minWidth: '300px' }}>
                                <h4 style={{ borderBottom: '1px solid gray' }}>Usuarios</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {manualUsers.map(u => (
                                        <button
                                            key={u._id}
                                            className="btn-secondary"
                                            style={{ textAlign: 'left', background: selectedManualUser?._id === u._id ? 'var(--secondary)' : 'rgba(255,255,255,0.1)' }}
                                            onClick={() => handleManualUserClick(u)}
                                        >
                                            <FaUser /> {u.username}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {selectedManualUser && (
                                <div style={{ flex: 1, minWidth: '300px' }}>
                                    <h4 style={{ borderBottom: '1px solid gray' }}>Pruebas de {selectedManualUser.username}</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        {manualChallenges.map(c => (
                                            <button
                                                key={c._id}
                                                className="btn-secondary"
                                                style={{ textAlign: 'left', background: selectedManualChallengeId === c._id ? 'var(--secondary)' : 'rgba(255,255,255,0.1)' }}
                                                onClick={() => setSelectedManualChallengeId(c._id)}
                                            >
                                                <FaList /> {c.title}
                                            </button>
                                        ))}
                                        {manualChallenges.length === 0 && <p>Sin pruebas disponibles.</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                        {selectedManualChallengeId && (
                            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                <button className="btn-primary" style={{ fontSize: '1.5rem', padding: '10px 40px' }} onClick={confirmManualSelection}>
                                    SELECCIONAR ESTA PRUEBA
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {status === 'VICTIM_MUSIC' && (
                    <div className="animate-fade-in">
                        <FaMusic style={{ fontSize: '5rem', color: '#ec4899', marginBottom: '20px' }} className="animate-bounce" />
                        <h2>¡Seleccionando Jugador!</h2>
                        <h3 style={{ marginTop: '20px', fontSize: '2rem' }}>{currentData?.victim?.username}</h3>
                        <p style={{ marginTop: '30px' }}>Escuchando himno... {musicTimer}s</p>
                    </div>
                )}

                {(status === 'ANNOUNCING' || status === 'READY_TO_PLAY') && (
                    <div className="animate-fade-in">
                        <h5 style={{ color: 'var(--text-muted)' }}>Jugador que Propone:</h5>
                        <h2 style={{ color: 'var(--secondary)', marginBottom: '20px' }}>{currentData?.victim?.username}</h2>

                        <div style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '20px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)' }}>
                            <h1 style={{ marginBottom: '10px' }}>{currentData?.challenge?.title}</h1>
                            <p style={{ fontSize: '1.4rem', marginBottom: '20px', minHeight: '80px' }}>{currentData?.challenge?.text}</p>

                            <div style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '1rem' }}>
                                <div><strong>Participantes:</strong> {currentData?.challenge?.participants}</div>
                                <div><strong>Tiempo:</strong> {currentData?.challenge?.timeLimit === 0 ? 'Indefinido' : currentData?.challenge?.timeLimit + 's'}</div>
                                <div><strong>Objetos:</strong> {currentData?.challenge?.objects || 'Ninguno'}</div>
                                <div style={{ gridColumn: '1 / -1' }}><strong>Reglas:</strong> {currentData?.challenge?.rules || 'Ninguna'}</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                            <button className="btn-secondary" style={{ fontSize: '1rem', padding: '10px 20px' }} onClick={skipChallenge}>
                                <FaForward /> Saltar Prueba
                            </button>
                            <button className="btn-primary" style={{ fontSize: '2rem', padding: '15px 50px' }} onClick={playChallenge} disabled={status === 'ANNOUNCING'}>
                                <FaPlay /> JUGAR
                            </button>
                        </div>
                    </div>
                )}

                {status === 'PLAYING_CHALLENGE' && (
                    <div>
                        <h2 style={{ color: '#ec4899' }}>¡EN CURSO!</h2>
                        <div style={{ fontSize: '8rem', fontWeight: 'bold', fontFamily: 'monospace', margin: '40px 0' }}>
                            {countdown}
                        </div>
                        <p>{currentData?.challenge?.title}</p>
                        {countdown === '∞' && (
                            <button className="btn-primary" onClick={finishChallenge}>TERMINAR</button>
                        )}
                    </div>
                )}

                {status === 'FINISHED' && (
                    <div className="animate-fade-in">
                        <h1 style={{ fontSize: '4rem', color: '#ec4899', marginBottom: '40px' }}>¡Tiempo Terminado!</h1>
                        <button className="btn-primary" style={{ fontSize: '2rem', padding: '20px 60px' }} onClick={startNextGameCycle}>
                            <FaForward /> CONTINUAR
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameMode;
