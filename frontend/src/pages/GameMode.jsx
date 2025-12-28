import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaPause, FaStop, FaForward, FaClock, FaMusic, FaRedo, FaUser, FaList, FaImage, FaVideo } from 'react-icons/fa';

const GameMode = () => {
    const { user, game } = useAuth();
    const navigate = useNavigate();

    // Config States (Initialized from localStorage or Game Config)
    const [minTime, setMinTime] = useState(() => {
        const storedMin = parseInt(localStorage.getItem('gameSessionMinTime'));
        if (!isNaN(storedMin)) return storedMin;
        return game?.config?.minTime || 60;
    });

    const [maxTime, setMaxTime] = useState(() => {
        const storedMax = parseInt(localStorage.getItem('gameSessionMaxTime'));
        if (!isNaN(storedMax)) return storedMax;
        return game?.config?.maxTime || 300;
    });

    const [isManualMode, setIsManualMode] = useState(false);
    const isFamilyAdmin = user?.role === 'family_admin' || user?.role === 'admin';

    // Validate session config against Game DB Config on load/update
    useEffect(() => {
        if (game?.config) {
            let currentMin = minTime;
            let currentMax = maxTime;
            let changed = false;

            // Enforce Lower Bound
            if (currentMin < game.config.minTime) {
                currentMin = game.config.minTime;
                changed = true;
            }
            // Enforce Upper Bound
            if (currentMax > game.config.maxTime) {
                currentMax = game.config.maxTime;
                changed = true;
            }
            // Ensure Min <= Max
            if (currentMin > currentMax) {
                currentMin = currentMax; // or adjust max
                changed = true;
            }

            if (changed) {
                setMinTime(currentMin);
                setMaxTime(currentMax);
                localStorage.setItem('gameSessionMinTime', currentMin);
                localStorage.setItem('gameSessionMaxTime', currentMax);
            }

            setNumWinners(game.config.defaultParticipants);
        }
    }, [game]); // Removed minTime/maxTime from deps to avoid loop. only check when game.config loads

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
    const timerRef = useRef(null);
    const isFetchingRef = useRef(false);

    // Random Generator State
    const [usedRandomNumbers, setUsedRandomNumbers] = useState([]);
    const [generatedNumbers, setGeneratedNumbers] = useState([]);
    const [randomMax, setRandomMax] = useState(10);
    const [pendingRandomData, setPendingRandomData] = useState(null);
    const [challengeTab, setChallengeTab] = useState('info'); // 'info' | 'media'
    const [numWinners, setNumWinners] = useState(game?.config?.defaultParticipants || 1); // Allow Admin to override participants count. Read from global config.

    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };


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
        localStorage.setItem('gameSessionMinTime', cleanMin);
        localStorage.setItem('gameSessionMaxTime', cleanMax);
    };

    const validateAndSaveConfig = () => {
        const globalMin = game?.config?.minTime || 60;
        const globalMax = game?.config?.maxTime || 300;

        let finalMin = parseInt(minTime);
        if (isNaN(finalMin) || finalMin < globalMin) finalMin = globalMin;

        let finalMax = parseInt(maxTime);
        if (isNaN(finalMax) || finalMax > globalMax) finalMax = globalMax;
        if (finalMax < finalMin) finalMax = finalMin;

        setMinTime(finalMin);
        setMaxTime(finalMax);
        localStorage.setItem('gameSessionMinTime', finalMin);
        localStorage.setItem('gameSessionMaxTime', finalMax);

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

    const speak = (text, voiceConfig, callback) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Always cancel previous

            const utterance = new SpeechSynthesisUtterance(text);

            // Handle voiceConfig as object or string
            let voiceName = 'default';
            let rate = 1.0;
            let pitch = 1.0;

            if (voiceConfig && typeof voiceConfig === 'object') {
                voiceName = voiceConfig.name || 'default';
                rate = voiceConfig.rate || 1.0;
                pitch = voiceConfig.pitch || 1.0;
            } else if (typeof voiceConfig === 'string') {
                voiceName = voiceConfig;
            }

            if (voiceName && voiceName !== 'default') {
                const voices = window.speechSynthesis.getVoices();
                const selected = voices.find(v => v.name === voiceName);
                if (selected) utterance.voice = selected;
            }

            utterance.rate = rate;
            utterance.pitch = pitch;

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

        // Clear existing interval to prevent race conditions
        if (timerRef.current) clearInterval(timerRef.current);
        if (timerId) clearInterval(timerId); // Fallback for state

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

        timerRef.current = id;
        setTimerId(id);
    };

    // 2a. Automatic Fetch
    const fetchAndStartChallenge = async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const res = await axios.get('/api/game/random');
            startChallengeFlow(res.data);
        } catch (err) {
            console.error("Fetch error full:", err);
            if (err.response && err.response.data) {
                console.error("Server Error Data:", err.response.data);
            }
            speak("Error obteniendo prueba. Reintentando.", null, startNextGameCycle);
        } finally {
            isFetchingRef.current = false;
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
        const needed = numWinners || 1;
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
        stopAllAudio();
        setCurrentData(data);

        // Play Music
        setStatus('VICTIM_MUSIC');
        // Reset Random State
        setGeneratedNumbers([]);
        setPendingRandomData(null);
        setRandomMax(manualUsers.length > 0 ? manualUsers.length : 10);

        // Max 30s for hymn, or use defined duration from user profile
        let durationRaw = 30;
        if (data.music && data.music.duration) {
            durationRaw = parseInt(data.music.duration);
        }
        const duration = Math.min(isNaN(durationRaw) ? 30 : durationRaw, 30);

        console.log(`Playing hymn for ${duration} seconds (Source: ${data.music ? 'Profile' : 'Default'})`);

        setMusicTimer(duration);
        setIsPlayingAudio(true);

        if (data.music && data.music.filename) {
            console.log("Playing Audio File:", data.music.filename);
            if (musicRef.current) musicRef.current.pause();
            musicRef.current = new Audio(`/uploads/${data.music.filename}`);
            musicRef.current.play().catch(e => console.log("Audio play error", e));
        }

        // Initialize Num Winners
        setNumWinners(data.challenge?.participants || 1);

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

            // --- AUTO GENERATE RANDOM NUMBERS ---
            let randomNumbersText = '';
            if (challenge.playerConfig.targetType === 'random') {
                const needed = challenge.participants || 1;
                const max = randomMax; // Use current randomMax state

                const allInMax = Array.from({ length: max }, (_, i) => i + 1);
                let available = allInMax.filter(n => !usedRandomNumbers.includes(n));
                let resetRangeMax = null;

                if (available.length < needed) {
                    available = allInMax;
                    resetRangeMax = max;
                }

                const picked = [];
                let currentPool = [...available];
                for (let i = 0; i < needed; i++) {
                    if (currentPool.length === 0) break;
                    const idx = Math.floor(Math.random() * currentPool.length);
                    picked.push(currentPool[idx]);
                    currentPool.splice(idx, 1);
                }

                // Update State so they appear on screen instantly
                setGeneratedNumbers(picked);
                setPendingRandomData({ numbers: picked, resetRangeMax });

                randomNumbersText = `Los números seleccionados son: ${picked.join(', ')}. Repito: ${picked.join(', ')}.`;
            }
            // ------------------------------------

            // Generate detailed description of player config
            let playerConfigDesc = '';
            if (challenge.playerConfig.targetType === 'random') {
                const count = challenge.participants || 1;
                playerConfigDesc = count === 1
                    ? `Será elegido 1 jugador al azar.`
                    : `Serán elegidos ${count} jugadores al azar.`;
            } else if (challenge.playerConfig.targetType === 'forward') {
                playerConfigDesc = `El jugador objetivo es el que está ${challenge.playerConfig.positionOffset || 1} posiciones por delante de ti.`;
            } else if (challenge.playerConfig.targetType === 'even') {
                playerConfigDesc = "Para todos los jugadores en posiciones pares.";
            } else if (challenge.playerConfig.targetType === 'odd') {
                playerConfigDesc = "Para todos los jugadores en posiciones impares.";
            } else if (challenge.playerConfig.targetType === 'all') {
                playerConfigDesc = "Esta prueba es para todos los jugadores.";
            }

            const texts = [
                `Atención. Reto para todos, propuesto por ${victim.username}.`,
                `Título de la prueba: ${challenge.title}.`,
                `Descripción: ${challenge.text}.`,
                playerConfigDesc,
                randomNumbersText, // Inserted here
                challenge.playerConfig.ageRange !== 'all' ? `Rango de edad: ${challenge.playerConfig.ageRange === 'adults' ? 'Solo adultos' : challenge.playerConfig.ageRange === 'kids' ? 'Solo niños' : 'Adolescentes'}.` : '',
                // REMOVED Redundant participant count
                challenge.playerConfig.grouping !== 'individual' ? `Agrupación: ${challenge.playerConfig.grouping === 'pairs' ? 'Por parejas' : 'Por tríos'}.` : '',
                `Duración: ${challenge.durationType === 'untilNext' ? "Hasta la siguiente prueba." :
                    challenge.durationType === 'multiChallenge' ? `Durante las próximas ${challenge.durationLimit || 1} pruebas.` :
                        challenge.timeLimit === 0 ? "Indefinido." :
                            `${challenge.timeLimit} segundos.`
                }`,
                challenge.objects ? `Objetos necesarios: ${challenge.objects}.` : '',
                challenge.punishment ? `Atención al castigo: ${challenge.punishment}.` : '',
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
        } else if (challenge.multimedia && challenge.multimedia.audio && challenge.multimedia.audio.filename) {
            // Auto-play attached audio if no specific SFX is set
            sfxRef.current = new Audio(`/uploads/${challenge.multimedia.audio.filename}`);
            sfxRef.current.play().catch(e => console.log("Multimedia Audio Play Error", e));
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
                        {status !== 'IDLE' && (
                            <button className="btn-secondary" onClick={stopAndReset} style={{ fontSize: '0.9rem', borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)' }}>
                                <FaStop /> REINICIAR
                            </button>
                        )}
                        <button className="btn-danger" onClick={() => { stopAndReset(); navigate('/dashboard'); }} style={{ fontSize: '0.9rem', background: 'rgba(220, 38, 38, 0.6)' }}>
                            SALIR
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>


                    {/* IDLE STATE */}
                    {status === 'IDLE' && (
                        <div className="animate-fade-in">
                            {/* NEW: Game Name Header */}
                            {game?.name && (
                                <h2 style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>
                                    {game.name}
                                </h2>
                            )}
                            <hr />
                            <br />
                            <h1 style={{ marginBottom: '30px' }}>Vamos a Jugar</h1>

                            {isFamilyAdmin && (
                                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                    <button className={`btn-secondary ${!isManualMode ? 'active' : ''}`} onClick={() => setIsManualMode(false)} style={{ background: !isManualMode ? 'var(--secondary)' : 'transparent', color: 'white' }}>AUTOMÁTICO</button>
                                    <button className={`btn-secondary ${isManualMode ? 'active' : ''}`} onClick={() => setIsManualMode(true)} style={{ background: isManualMode ? 'var(--secondary)' : 'transparent', color: 'white' }}>MANUAL</button>
                                </div>
                            )}

                            {isFamilyAdmin && (
                                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Intervalo de Tiempo (seg)</label>
                                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <small>Mín</small>
                                            <input
                                                className="glass-input"
                                                type="number"
                                                value={minTime}
                                                onChange={(e) => setMinTime(parseInt(e.target.value) || 0)}
                                                onBlur={(e) => {
                                                    const globalMin = game?.config?.minTime || 60;
                                                    let val = parseInt(e.target.value);
                                                    if (isNaN(val) || val < globalMin) val = globalMin;
                                                    if (val > maxTime) val = maxTime;
                                                    setMinTime(val);
                                                    localStorage.setItem('gameSessionMinTime', val);
                                                }}
                                                style={{ textAlign: 'center', width: '80px', fontSize: '1.2rem' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <small>Máx</small>
                                            <input
                                                className="glass-input"
                                                type="number"
                                                value={maxTime}
                                                onChange={(e) => setMaxTime(parseInt(e.target.value) || 0)}
                                                onBlur={(e) => {
                                                    const globalMax = game?.config?.maxTime || 300;
                                                    let val = parseInt(e.target.value);
                                                    if (isNaN(val) || val > globalMax) val = globalMax;
                                                    if (val < minTime) val = minTime;
                                                    setMaxTime(val);
                                                    localStorage.setItem('gameSessionMaxTime', val);
                                                }}
                                                style={{ textAlign: 'center', width: '80px', fontSize: '1.2rem' }}
                                            />
                                        </div>
                                    </div>
                                    <small style={{ color: 'gray', fontSize: '0.7rem' }}>Límites Globales: {game?.config?.minTime || 60}s - {game?.config?.maxTime || 300}s</small>
                                </div>
                            )}

                            <button className="btn-primary btn-xl" onClick={startNextGameCycle}>
                                <FaPlay /> CONTINUAR
                            </button>
                        </div>
                    )}

                    {/* COUNTDOWN STATE */}
                    {status === 'COUNTDOWN' && (
                        <div>
                            <h2>Próximo Reto en...</h2>
                            <div className="countdown-text" style={{ fontSize: '10rem', lineHeight: 1 }}>{countdown}</div>
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
                        <div className="animate-fade-in" style={{ maxWidth: '100%', width: '100%', margin: '0 auto', padding: '0 5px' }}>
                            {game?.name && <h3 style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.7, marginBottom: '10px', fontSize: '1rem', textAlign: 'center' }}>{game.name}</h3>}

                            <h5 style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Jugador que Propone:</h5>
                            <h2 style={{ color: 'var(--secondary)', marginBottom: '10px', fontSize: '1.2rem' }}>{currentData?.victim?.username}</h2>

                            <div style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '10px', borderRadius: '15px', background: 'rgba(0,0,0,0.3)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>

                                {/* TABS HEADER */}
                                {(currentData?.challenge?.multimedia?.image || currentData?.challenge?.multimedia?.video || currentData?.challenge?.multimedia?.document) && (
                                    <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => setChallengeTab('info')}
                                            className="btn-text"
                                            style={{
                                                borderBottom: challengeTab === 'info' ? '3px solid var(--primary)' : '3px solid transparent',
                                                color: challengeTab === 'info' ? 'white' : 'rgba(255,255,255,0.5)',
                                                background: challengeTab === 'info' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                padding: '8px 15px',
                                                borderRadius: '8px 8px 0 0',
                                                fontSize: '1rem',
                                                fontWeight: challengeTab === 'info' ? 'bold' : 'normal',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.2s',
                                                flex: 1,
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <FaList /> La Prueba
                                        </button>
                                        <button
                                            onClick={() => setChallengeTab('media')}
                                            className="btn-text"
                                            style={{
                                                borderBottom: challengeTab === 'media' ? '3px solid var(--primary)' : '3px solid transparent',
                                                color: challengeTab === 'media' ? 'white' : 'rgba(255,255,255,0.5)',
                                                background: challengeTab === 'media' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                padding: '8px 15px',
                                                borderRadius: '8px 8px 0 0',
                                                fontSize: '1rem',
                                                fontWeight: challengeTab === 'media' ? 'bold' : 'normal',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.2s',
                                                flex: 1,
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <FaImage /> Media <span className="badge" style={{ background: 'var(--primary)', fontSize: '0.6rem', marginLeft: '3px' }}>!</span>
                                        </button>
                                    </div>
                                )}

                                {/* INFO TAB CONTENT */}
                                {(!((currentData?.challenge?.multimedia?.image || currentData?.challenge?.multimedia?.video || currentData?.challenge?.multimedia?.document)) || challengeTab === 'info') && (
                                    <div className="animate-fade-in" style={{ padding: '0 5px' }}>
                                        <h1 style={{ marginBottom: '10px', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', textAlign: 'center', color: '#fbbf24', wordWrap: 'break-word' }}>{currentData?.challenge?.title}</h1>
                                        <p style={{ fontSize: 'clamp(1rem, 3vw, 1.4rem)', marginBottom: '20px', lineHeight: '1.5', whiteSpace: 'pre-wrap', textAlign: 'left', wordWrap: 'break-word' }}>{currentData?.challenge?.text}</p>

                                        {/* Audio Player (Always Visible) */}
                                        {currentData?.challenge?.multimedia?.audio && (
                                            <div style={{ marginBottom: '15px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '50%' }}><FaMusic /></div>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontSize: '0.8rem', marginBottom: '3px', opacity: 0.8 }}>Audio de la prueba</p>
                                                    <audio controls src={currentData.challenge.multimedia.audio.url} style={{ width: '100%' }} />
                                                </div>
                                            </div>
                                        )}

                                        {currentData?.challenge?.punishment && (
                                            <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(220, 38, 38, 0.15)', borderRadius: '8px', borderLeft: '5px solid #ef4444' }}>
                                                <strong style={{ fontSize: '1rem', color: '#fca5a5' }}>💀 CASTIGO:</strong>
                                                <p style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', margin: '3px 0 0 0' }}>{currentData.challenge.punishment}</p>
                                            </div>
                                        )}

                                        {/* RANDOM NUMBERS */}
                                        {currentData?.challenge?.playerConfig?.targetType === 'random' && (
                                            <div style={{ margin: '15px 0', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', border: '1px dashed rgba(255,255,255,0.2)' }}>
                                                <h3 style={{ marginBottom: '10px', textAlign: 'center', color: 'var(--secondary)', fontSize: '1.2rem' }}>🎲 Sorteo Aleatorio</h3>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <label style={{ fontSize: '0.9rem' }}>Máx:</label>
                                                        <input type="number" className="glass-input" value={randomMax} onChange={(e) => setRandomMax(parseInt(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', fontSize: '1rem' }} disabled={!isFamilyAdmin} />
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <label style={{ fontSize: '0.9rem' }}>Ganadores:</label>
                                                        <input type="number" className="glass-input" value={numWinners} onChange={(e) => setNumWinners(parseInt(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', fontSize: '1rem' }} disabled={!isFamilyAdmin} />
                                                    </div>
                                                    {isFamilyAdmin && <button className="btn-secondary" onClick={generateRandomNumbers} style={{ fontSize: '0.8rem', padding: '5px 10px' }}>RE-GENERAR</button>}
                                                </div>
                                                {generatedNumbers.length > 0 && (
                                                    <div style={{ fontSize: 'clamp(2rem, 6vw, 2.5rem)', fontWeight: 'bold', color: '#fbbf24', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                                                        {generatedNumbers.map((num, i) => (
                                                            <div key={i} className="animate-bounce-in" style={{
                                                                background: 'linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2))',
                                                                padding: '5px 15px',
                                                                borderRadius: '10px',
                                                                border: '2px solid rgba(251, 191, 36, 0.5)',
                                                                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                                                minWidth: '50px',
                                                                textAlign: 'center'
                                                            }}>{num}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* MEDIA TAB CONTENT */}
                                {challengeTab === 'media' && (currentData?.challenge?.multimedia?.image || currentData?.challenge?.multimedia?.video || currentData?.challenge?.multimedia?.document) && (
                                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', width: '100%', padding: '5px' }}>

                                        {/* Image */}
                                        {currentData.challenge.multimedia.image && (
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <h4 style={{ marginBottom: '5px', opacity: 0.8, fontSize: '1rem' }}><FaImage /> Imagen Adjunta</h4>
                                                <img src={currentData.challenge.multimedia.image.url} alt="Prueba" style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: '10px', objectFit: 'contain', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }} />
                                            </div>
                                        )}

                                        {/* Video */}
                                        {currentData.challenge.multimedia.video && (
                                            <div style={{ width: '100%', maxWidth: '800px', marginTop: '10px' }}>
                                                <h4 style={{ marginBottom: '5px', textAlign: 'center', opacity: 0.8, fontSize: '1rem' }}><FaVideo /> Video Adjunto</h4>

                                                {currentData.challenge.multimedia.video.isYoutube ? (
                                                    // Try Embed first, fallback to Link
                                                    getYoutubeId(currentData.challenge.multimedia.video.url) ? (
                                                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                                                            <iframe
                                                                src={`https://www.youtube.com/embed/${getYoutubeId(currentData.challenge.multimedia.video.url)}`}
                                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                                                allowFullScreen
                                                                title="Video YouTube"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '15px' }}>
                                                            <p style={{ marginBottom: '10px', fontSize: '0.9rem' }}>No se pudo incrustar el video. Ábrelo directamente:</p>
                                                            <a href={currentData.challenge.multimedia.video.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', padding: '10px 20px', fontSize: '1rem' }}>
                                                                <FaPlay /> VER VIDEO
                                                            </a>
                                                        </div>
                                                    )
                                                ) : (
                                                    <video controls src={currentData.challenge.multimedia.video.url} style={{ width: '100%', maxHeight: '50vh', borderRadius: '15px', backgroundColor: '#000', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} />
                                                )}
                                            </div>
                                        )}

                                        {/* Document */}
                                        {currentData.challenge.multimedia.document && (
                                            <a href={currentData.challenge.multimedia.document.url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '12px', fontSize: '1rem', marginTop: '10px' }}>
                                                <FaList /> <span>Ver Documento Adjunto</span>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {status === 'PLAYING_CHALLENGE' && (
                        <div className="animate-fade-in">
                            {game?.name && <h3 style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.7, marginBottom: '20px', fontSize: '1.2rem' }}>{game.name}</h3>}
                            <h2>¡Tiempo Restante!</h2>
                            <div className="countdown-text" style={{ fontSize: '12rem', color: countdown <= 10 ? '#ef4444' : 'var(--text-light)' }}>
                                {countdown}
                            </div>
                            <div style={{ marginTop: '20px' }}>
                                <FaClock className="animate-spin-slow" style={{ fontSize: '3rem', opacity: 0.5 }} />
                            </div>
                            <button className="btn-secondary" onClick={finishChallenge} style={{ marginTop: '30px' }}>
                                <FaStop /> Terminar Ahora
                            </button>
                        </div>
                    )}

                    {status === 'FINISHED' && (
                        <div className="animate-fade-in">
                            <h1 style={{ fontSize: '4rem', color: '#fbbf24', marginBottom: '30px' }}>¡PRUEBA FINALIZADA!</h1>
                            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                                <button className="btn-primary btn-xl" onClick={startNextGameCycle}>
                                    <FaForward /> SIGUIENTE RETO
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div >
    );
};

export default GameMode;
