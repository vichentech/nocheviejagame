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
    const isFamilyAdmin = user?.role === 'family_admin';

    // Ensure non-admins are always in Auto mode
    useEffect(() => {
        if (!isFamilyAdmin && isManualMode) {
            setIsManualMode(false);
        }
    }, [isFamilyAdmin, isManualMode]);

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

    // Random Generator State
    const [usedRandomNumbers, setUsedRandomNumbers] = useState([]);
    const [generatedNumbers, setGeneratedNumbers] = useState([]);
    const [randomMax, setRandomMax] = useState(10);
    const [pendingRandomData, setPendingRandomData] = useState(null);


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
        fetchUsedRandomNumbers();


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

    const fetchUsedRandomNumbers = async () => {
        try {
            const res = await axios.get('/api/game/used-random-numbers');
            setUsedRandomNumbers(res.data.usedRandomNumbers);
        } catch (err) { console.error(err); }
    };

    const generateRandomNumbers = () => {
        const needed = currentData.challenge.participants || 1;
        const max = randomMax;

        // Calculate available in [1..max]
        const allInMax = Array.from({ length: max }, (_, i) => i + 1);
        let available = allInMax.filter(n => !usedRandomNumbers.includes(n));

        let resetRangeMax = null;

        // If not enough, reset pool logic
        if (available.length < needed) {
            available = allInMax;
            resetRangeMax = max;
        }

        // Pick randoms
        const picked = [];
        let currentPool = [...available];

        for (let i = 0; i < needed; i++) {
            if (currentPool.length === 0) break;
            const idx = Math.floor(Math.random() * currentPool.length);
            picked.push(currentPool[idx]);
            currentPool.splice(idx, 1);
        }

        setGeneratedNumbers(picked);
        setPendingRandomData({ numbers: picked, resetRangeMax });
    };

    // Common Flow Start
    const startChallengeFlow = (data) => {
        setCurrentData(data);

        // Play Music
        setStatus('VICTIM_MUSIC');
        // Reset Random State
        setGeneratedNumbers([]);
        setPendingRandomData(null);
        setRandomMax(manualUsers.length > 0 ? manualUsers.length : 10);

        // Max 30s for hymn, or use defined duration
        const duration = Math.min((data.music && data.music.duration) ? data.music.duration : 30, 30);
        setMusicTimer(duration);
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
        if (timerId) clearInterval(timerId); // Stop the music timer if active
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
                `Atención. Reto para todos, propuesto por ${victim.username}.`,
                `Título de la prueba: ${challenge.title}.`,
                `Descripción: ${challenge.text}.`,
                challenge.playerConfig.targetType === 'forward' ? `Jugador objetivo: el que está ${challenge.playerConfig.positionOffset || 1} posiciones por delante de ti.` : '',
                challenge.playerConfig.ageRange !== 'all' ? `Rango de edad: ${challenge.playerConfig.ageRange === 'adults' ? 'Solo adultos' : challenge.playerConfig.ageRange === 'kids' ? 'Solo niños' : 'Adolescentes'}.` : '',
                challenge.participants > 1 ? `Número de participantes: ${challenge.participants}.` : 'Juega un solo participante.',
                challenge.playerConfig.grouping !== 'individual' ? `Agrupación: ${challenge.playerConfig.grouping === 'pairs' ? 'Por parejas' : 'Por tríos'}.` : '',
                `Duración: ${challenge.durationType === 'untilNext' ? "Hasta la siguiente prueba." :
                    challenge.durationType === 'multiChallenge' ? `Durante las próximas ${challenge.durationLimit || 1} pruebas.` :
                        challenge.timeLimit === 0 ? "Indefinido." :
                            `${challenge.timeLimit} segundos.`
                }`,
                challenge.objects ? `Objetos necesarios: ${challenge.objects}.` : '',
                challenge.punishment ? `Castigo si no se cumple: ${challenge.punishment}.` : '',
                "¿Estáis listos? Pues a jugar."
            ].filter(t => t !== '');

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
    const playChallenge = async () => {
        superStopAllAudio(); // Stop audio on play

        // Commit Random Numbers if generated
        if (pendingRandomData) {
            try {
                await axios.post('/api/game/record-random-numbers', pendingRandomData);
                // Optimistically update used (though we might fetch later)
                // If reset happened, we clear lower numbers first
                let newUsed = [...usedRandomNumbers];
                if (pendingRandomData.resetRangeMax) {
                    newUsed = newUsed.filter(n => n > pendingRandomData.resetRangeMax);
                }
                newUsed = [...newUsed, ...pendingRandomData.numbers];
                setUsedRandomNumbers(newUsed);
                setPendingRandomData(null); // Clear pending
            } catch (err) { console.error("Error saving randoms", err); }
        }

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
        setPendingRandomData(null); // Discard randoms
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

                {/* Header Section for Controls */}
                <div style={{
                    padding: '10px 15px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {(status === 'ANNOUNCING' || status === 'READY_TO_PLAY') && (
                            <>
                                <button className="btn-secondary" onClick={repeatInstructions} title="Repetir" disabled={isPlayingAudio} style={{ opacity: isPlayingAudio ? 0.5 : 1, padding: '8px' }}>
                                    <FaRedo />
                                </button>
                                <button className="btn-secondary" onClick={pauseInstructions} title="Pausar" style={{ padding: '8px' }}><FaPause /></button>
                                <button className="btn-secondary" onClick={resumeInstructions} title="Continuar" style={{ padding: '8px' }}><FaPlay /></button>
                                <button className="btn-danger" onClick={superStopAllAudio} title="Parar Audio" style={{ padding: '8px' }}><FaStop /></button>
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        {status !== 'IDLE' && <button className="btn-secondary" onClick={stopAndReset} style={{ fontSize: '0.8rem' }}><FaStop /> RESET</button>}
                        <button className="btn-danger" onClick={() => { stopAndReset(); navigate('/dashboard'); }} style={{ fontSize: '0.8rem' }}><FaStop /> SALIR</button>
                    </div>
                </div>

                <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>


                    {/* IDLE STATE */}
                    {status === 'IDLE' && (
                        <div className="animate-fade-in">
                            <h1 style={{ marginBottom: '30px' }}>Configuración del Juego</h1>

                            {isFamilyAdmin && (
                                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                    <button className={`btn-secondary ${!isManualMode ? 'active' : ''}`} onClick={() => setIsManualMode(false)} style={{ background: !isManualMode ? 'var(--secondary)' : 'transparent', color: 'white' }}>AUTOMÁTICO</button>
                                    <button className={`btn-secondary ${isManualMode ? 'active' : ''}`} onClick={() => setIsManualMode(true)} style={{ background: isManualMode ? 'var(--secondary)' : 'transparent', color: 'white' }}>MANUAL</button>
                                </div>
                            )}

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

                            <button className="btn-primary btn-xl" onClick={startNextGameCycle}>
                                <FaPlay /> CONTINUAR
                            </button>
                        </div>
                    )}

                    {/* COUNTDOWN STATE */}
                    {status === 'COUNTDOWN' && (
                        <div>
                            <h2>Próximo Reto en...</h2>
                            <div className="countdown-text">{countdown}</div>
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
                            <h3 style={{ marginTop: '20px', fontSize: '2.5rem', color: 'var(--secondary)' }}>{currentData?.victim?.username}</h3>
                            <p style={{ marginTop: '20px' }}>Escuchando himno... {musicTimer}s</p>

                            <button
                                className="btn-primary"
                                style={{ marginTop: '30px', padding: '15px 40px', width: 'auto' }}
                                onClick={() => announceChallenge(currentData)}
                            >
                                <FaForward /> LEER PRUEBA
                            </button>
                        </div>
                    )}

                    {(status === 'ANNOUNCING' || status === 'READY_TO_PLAY') && (
                        <div className="animate-fade-in">
                            <h5 style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Jugador que Propone:</h5>
                            <h2 style={{ color: 'var(--secondary)', marginBottom: '15px', fontSize: '1.4rem' }}>{currentData?.victim?.username}</h2>

                            <div style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '15px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)' }}>
                                <h1 style={{ marginBottom: '10px', fontSize: '1.5rem' }}>{currentData?.challenge?.title}</h1>
                                <p style={{ fontSize: '1.1rem', marginBottom: '15px', minHeight: '60px' }}>{currentData?.challenge?.text}</p>

                                {/* MULTIMEDIA DISPLAY */}
                                {currentData?.challenge?.multimedia && currentData.challenge.multimedia.type !== 'none' && (
                                    <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                                        {currentData.challenge.multimedia.type === 'image' && (
                                            <img src={currentData.challenge.multimedia.url} alt="Prueba" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '10px' }} />
                                        )}
                                        {currentData.challenge.multimedia.type === 'audio' && (
                                            <audio controls src={currentData.challenge.multimedia.url} style={{ width: '100%' }} />
                                        )}
                                        {currentData.challenge.multimedia.type === 'video' && (
                                            <video controls src={currentData.challenge.multimedia.url} style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '10px' }} />
                                        )}
                                    </div>
                                )}

                                {currentData?.challenge?.punishment && (
                                    <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255, 0, 0, 0.2)', borderRadius: '5px' }}>
                                        <strong>💀 CASTIGO:</strong> {currentData.challenge.punishment}
                                    </div>
                                )}

                                {/* RANDOM NUMBER GENERATOR */}
                                {currentData?.challenge?.playerConfig?.targetType === 'random' && (
                                    <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                                        <h3 style={{ marginBottom: '10px' }}>🎲 Generar Números Aleatorios</h3>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                                            <label>Máximo:</label>
                                            <input type="number" className="glass-input" value={randomMax} onChange={(e) => setRandomMax(parseInt(e.target.value))} style={{ width: '80px', textAlign: 'center' }} />
                                            <button className="btn-secondary" onClick={generateRandomNumbers}>GENERAR</button>
                                        </div>
                                        {generatedNumbers.length > 0 && (
                                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24', letterSpacing: '2px' }}>
                                                {generatedNumbers.join(' - ')}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', fontSize: '0.95rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                                    <div><strong>👥 Participantes:</strong> {currentData?.challenge?.participants}</div>
                                    <div><strong>⏱ Tiempo:</strong> {
                                        currentData?.challenge?.durationType === 'untilNext' ? "Hasta Prox." :
                                            currentData?.challenge?.durationType === 'multiChallenge' ? `Durante ${currentData?.challenge?.durationLimit} pruebas` :
                                                currentData?.challenge?.timeLimit === 0 ? 'Indefinido' : currentData?.challenge?.timeLimit + 's'
                                    }</div>
                                    <div><strong>🎒 Objetos:</strong> {currentData?.challenge?.objects || 'Ninguno'}</div>
                                    {currentData?.challenge?.playerConfig?.ageRange !== 'all' && (
                                        <div><strong>🎂 Edad:</strong> {currentData.challenge.playerConfig.ageRange}</div>
                                    )}
                                    <div style={{ gridColumn: '1 / -1' }}><strong>📜 Reglas:</strong> {currentData?.challenge?.rules || 'Ninguna'}</div>
                                </div>
                            </div>

                            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button className="btn-secondary" style={{ flex: 1, minWidth: '140px' }} onClick={skipChallenge}>
                                    <FaForward /> Saltar
                                </button>
                                <button className="btn-primary btn-xl" style={{ flex: 2, minWidth: '200px' }} onClick={playChallenge} disabled={status === 'ANNOUNCING'}>
                                    <FaPlay /> JUGAR
                                </button>
                            </div>
                        </div>
                    )}

                    {status === 'PLAYING_CHALLENGE' && (
                        <div>
                            <h2 style={{ color: '#ec4899' }}>¡EN CURSO!</h2>
                            <div className="countdown-text" style={{ fontFamily: 'monospace' }}>
                                {countdown}
                            </div>
                            <p style={{ fontSize: '1.2rem' }}>{currentData?.challenge?.title}</p>
                            {countdown === '∞' && (
                                <button className="btn-primary" onClick={finishChallenge}>TERMINAR</button>
                            )}
                        </div>
                    )}

                    {status === 'FINISHED' && (
                        <div className="animate-fade-in">
                            <h1 style={{ fontSize: '2.5rem', color: '#ec4899', marginBottom: '30px' }}>¡Tiempo Terminado!</h1>
                            <button className="btn-primary btn-xl" onClick={startNextGameCycle}>
                                <FaForward /> CONTINUAR
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameMode;
