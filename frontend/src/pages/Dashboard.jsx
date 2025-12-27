import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaList, FaPlus, FaMusic, FaPlay, FaTrash, FaSignOutAlt, FaStop, FaEdit, FaKey, FaUser, FaPause, FaCrown, FaCog, FaCheck, FaTimes, FaLock, FaGamepad, FaHammer, FaBullhorn, FaGavel, FaSave, FaUsers } from 'react-icons/fa';
import Modal from '../components/Modal';

const Dashboard = () => {
    const { user, game, logoutUser, logoutGame } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('challenges');
    const [challenges, setChallenges] = useState([]);
    const [audios, setAudios] = useState([]);

    // Modal State
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', children: null, onConfirm: null });

    // Family Admin State
    const [familyUsers, setFamilyUsers] = useState([]);
    const [showFamilyModal, setShowFamilyModal] = useState(false);

    // Form States
    const [newChallenge, setNewChallenge] = useState({
        title: '', text: '', timeLimit: 60,
        durationLimit: 1, durationType: 'fixed', // 'fixed', 'untilNext', 'multiChallenge'
        participants: 1, objects: '', description: '', rules: '', notes: '',
        voiceConfig: { name: 'default', rate: 1.0, pitch: 1.0 },
        punishment: '',
        playerConfig: { targetType: 'all', grouping: 'individual', position: 'none', positionOffset: 0, ageRange: 'all', customText: '' },
        multimedia: { image: null, audio: null, video: null, document: null }
    });
    const [formTab, setFormTab] = useState('game'); // game, players, tools, rules, customization
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [audioFile, setAudioFile] = useState(null);
    const [audioDuration, setAudioDuration] = useState(30);
    const [voices, setVoices] = useState([]);
    const synthRef = useRef(window.speechSynthesis);

    useEffect(() => {
        fetchChallenges();
        fetchAudios();
        const loadVoices = () => {
            const vs = synthRef.current.getVoices();
            setVoices(vs);
        };
        loadVoices();
        synthRef.current.onvoiceschanged = loadVoices;
    }, []);

    // Auto-select Spanish voice if 'default' and available
    useEffect(() => {
        if (voices.length > 0 && newChallenge.voiceConfig.name === 'default') {
            const esVoice = voices.find(v => v.lang.toLowerCase().startsWith('es'));
            if (esVoice) {
                setNewChallenge(prev => ({
                    ...prev,
                    voiceConfig: { ...prev.voiceConfig, name: esVoice.name }
                }));
            }
        }
    }, [voices, activeTab]); // Run when voices load or tab changes (reset)

    // Player Constraint Logic: forward -> participants = 1
    useEffect(() => {
        if (newChallenge.playerConfig.targetType === 'forward') {
            if (newChallenge.participants !== 1) {
                setNewChallenge(prev => ({ ...prev, participants: 1 }));
            }
        }
    }, [newChallenge.playerConfig.targetType]);

    useEffect(() => {
        if (user.role === 'family_admin') {
            fetchFamilyUsers();
        }
    }, [user.role, showFamilyModal]);

    const showModal = (title, message, type = 'alert', onConfirm = null, children = null) => {
        setModal({ isOpen: true, title, message, type, onConfirm, children });
    };

    const fetchChallenges = async () => {
        try {
            const res = await axios.get('/api/challenges');
            setChallenges(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchAudios = async () => {
        try {
            const res = await axios.get('/api/audio');
            setAudios(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchFamilyUsers = async () => {
        try {
            const res = await axios.get('/api/family/users');
            setFamilyUsers(res.data);
        } catch (err) { console.error(err); }
    };

    const handleCreateOrUpdateChallenge = async (e) => {
        e.preventDefault();
        try {
            const challengeToSave = { ...newChallenge };

            // Map durationType to timeLimit (legacy support for untilNext)
            if (challengeToSave.durationType === 'untilNext') {
                challengeToSave.timeLimit = 0;
            } else if (challengeToSave.durationType === 'multiChallenge') {
                challengeToSave.timeLimit = -1; // Special value? Or just keep it as is
            }

            if (editingId) {
                await axios.put(`/api/challenges/${editingId}`, challengeToSave);
                const hasAudio = audios.some(a => a.uploaderId === user.id);
                showModal('Éxito', hasAudio ? 'Prueba actualizada correctamente' : 'Prueba actualizada. ⚠ ¡RECUERDA SUBIR TU AUDIO IDENTIFICATIVO!');
            } else {
                await axios.post('/api/challenges', challengeToSave);
                const hasAudio = audios.some(a => a.uploaderId === user.id);
                showModal('Éxito', hasAudio ? 'Prueba creada correctamente' : 'Prueba creada. ⚠ ¡RECUERDA SUBIR TU AUDIO IDENTIFICATIVO OBLIGATORIO!');
            }

            resetForm();
            fetchChallenges();
            setActiveTab('challenges');
        } catch (err) {
            showModal('Error', 'No se pudo guardar la prueba');
        }
    };

    const resetForm = () => {
        setNewChallenge(prev => ({
            title: '', text: '', timeLimit: 60,
            durationLimit: 1, durationType: 'fixed',
            participants: 1, objects: '', description: '', rules: '', notes: '',
            voiceConfig: { name: 'default', rate: 1.0, pitch: 1.0 },
            punishment: '',
            playerConfig: { targetType: 'all', grouping: 'individual', position: 'none', positionOffset: 0, ageRange: 'all', customText: '' },
            multimedia: { image: null, audio: null, video: null, document: null }
        }));
        setFormTab('game');
        setEditingId(null);
    };

    const handleEditChallenge = (challenge) => {
        let vConfig = challenge.voiceConfig;
        if (typeof vConfig === 'string') {
            vConfig = { name: vConfig, rate: 1.0, pitch: 1.0 };
        } else if (!vConfig) {
            vConfig = { name: 'default', rate: 1.0, pitch: 1.0 };
        }

        const pConfig = challenge.playerConfig || { targetType: 'all', grouping: 'individual', position: 'none', positionOffset: 0, ageRange: 'all', customText: '' };

        // Handle multimedia legacy or new format
        let mMedia = { image: null, audio: null, video: null, document: null };
        if (challenge.multimedia) {
            if (challenge.multimedia.type && challenge.multimedia.type !== 'none') {
                // Legacy format conversion
                mMedia[challenge.multimedia.type] = { url: challenge.multimedia.url, filename: challenge.multimedia.filename };
            } else {
                // New format or empty
                mMedia = { ...mMedia, ...challenge.multimedia };
            }
        }

        // Infer durationMode from legacy data if missing
        let dType = challenge.durationType || 'fixed';
        if (challenge.timeLimit === 0) dType = 'untilNext';
        else if (challenge.timeLimit === -1) dType = 'multiChallenge';

        setNewChallenge({
            ...challenge,
            voiceConfig: vConfig,
            playerConfig: pConfig,
            multimedia: mMedia,
            durationType: dType,
            durationLimit: challenge.durationLimit || 1
        });
        setEditingId(challenge._id);
        setActiveTab('new');
    };

    // Updated Play Function to Read All Fields
    const handlePlayChallenge = (challenge) => {
        if (synthRef.current.speaking) {
            synthRef.current.cancel();
        }

        const speakText = (text, delay = 0) => {
            const utterance = new SpeechSynthesisUtterance(text);

            // Normalize config if it's old string format
            let config = challenge.voiceConfig;
            if (typeof config === 'string') config = { name: config, rate: 1.0, pitch: 1.0 };
            if (!config) config = { name: 'default', rate: 1.0, pitch: 1.0 };

            if (config.name && config.name !== 'default') {
                const selected = voices.find(v => v.name === config.name);
                if (selected) utterance.voice = selected;
            }
            utterance.rate = config.rate || 1.0;
            utterance.pitch = config.pitch || 1.0;

            synthRef.current.speak(utterance);
        };

        // Queue utterances
        speakText(`Título: ${challenge.title}`);
        speakText(`Descripción: ${challenge.text}`);

        // Player config reading logic
        const pConfig = challenge.playerConfig || {};
        const targetMap = { 'all': 'Todos', 'odd': 'Impares', 'even': 'Pares', 'random': 'Aleatorio', 'custom': 'Personalizado', 'forward': 'Posición Relativa' };

        if (pConfig.targetType === 'forward') {
            speakText(`Participante: Jugador a ${pConfig.positionOffset || 1} posiciones.`);
        } else if (pConfig.targetType && pConfig.targetType !== 'all') {
            speakText(`Jugadores: ${targetMap[pConfig.targetType] || pConfig.targetType}`);
        }

        if (pConfig.targetType === 'custom' && pConfig.customText) {
            speakText(`Detalles: ${pConfig.customText}`);
        }
        if (pConfig.grouping && pConfig.grouping !== 'individual' && challenge.participants > 1) {
            speakText(`Agrupación: ${pConfig.grouping === 'pairs' ? 'Por Parejas' : 'Por Tríos'}`);
        }
        if (pConfig.position && pConfig.position !== 'none' && pConfig.targetType !== 'forward') {
            let posText = '';
            switch (pConfig.position) {
                case 'next': posText = 'Al lado'; break;
                case 'opposite': posText = 'Enfrente'; break;
                case 'left': posText = 'A la izquierda'; break;
                case 'right': posText = 'A la derecha'; break;
                case 'forward': posText = `${pConfig.positionOffset || 1} posiciones adelante`; break;
            }
            if (posText) speakText(`Posición: ${posText}`);
        }

        if (challenge.durationType === 'untilNext' || challenge.timeLimit === 0) {
            speakText("Tiempo: Hasta la siguiente prueba");
        } else if (challenge.durationType === 'multiChallenge' || challenge.timeLimit === -1) {
            speakText(`Tiempo: Durante ${challenge.durationLimit || 1} pruebas`);
        } else {
            speakText(`Tiempo: ${challenge.timeLimit} segundos`);
        }
        if (challenge.objects) {
            speakText(`Objetos necesarios: ${challenge.objects}`);
        }

        if (challenge.rules) {
            speakText(`Reglas adicionales: ${challenge.rules}`);
        }

        if (challenge.punishment) {
            speakText(`Castigo: ${challenge.punishment}`);
        }
    };

    const handleMediaUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploadingMedia(true);
        try {
            const res = await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setNewChallenge(prev => ({
                ...prev,
                multimedia: {
                    ...prev.multimedia,
                    [type]: { // Update specific type
                        url: res.data.url,
                        filename: res.data.originalName || file.name // Fallback if originalName not in res
                    }
                }
            }));
        } catch (err) {
            showModal('Error', 'Error subiendo archivo multimedia');
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleUploadAudio = async (e) => {
        e.preventDefault();
        if (!audioFile) return;
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('duration', audioDuration);
        try {
            await axios.post('/api/audio', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setAudioFile(null);
            fetchAudios();
            showModal('Éxito', 'Audio subido correctamente');
        } catch (err) {
            showModal('Error', 'Error subiendo audio');
        }
    };

    const handleDeleteChallenge = (id) => {
        showModal('Confirmar', '¿Estás seguro de que deseas borrar esta prueba?', 'confirm', async () => {
            try {
                await axios.delete(`/api/challenges/${id}`);
                fetchChallenges();
            } catch (err) { console.error(err); }
        });
    };

    const handleDeleteAudio = (id) => {
        showModal('Confirmar', '¿Estás seguro de que deseas borrar este audio?', 'confirm', async () => {
            try {
                await axios.delete(`/api/audio/${id}`);
                fetchAudios();
            } catch (err) { console.error(err); }
        });
    };

    // --- FAMILY ADMIN ACTIONS ---

    const handleDeleteFamilyUser = (userId) => {
        showModal('Confirmar Borrado', '¿Seguro que quieres borrar a este usuario? Se borrarán sus pruebas también.', 'confirm', async () => {
            try {
                await axios.delete(`/api/family/users/${userId}`);
                fetchFamilyUsers();
            } catch (e) { alert(e.response?.data?.msg || 'Error deleting user'); }
        });
    };

    const handleTogglePlayPermission = async (userId, newStatus) => {
        try {
            await axios.put(`/api/family/users/${userId}/permissions`, { canPlay: newStatus });
            // Optimistic update or refetch
            setFamilyUsers(prev => prev.map(u => u._id === userId ? { ...u, canPlay: newStatus } : u));
        } catch (e) {
            console.error(e);
            showModal('Error', 'No se pudo cambiar el permiso');
        }
    };

    const handleUpdateGame = (name, password) => {
        const payload = {};
        if (name) payload.name = name;
        if (password) payload.password = password;

        // Confirmation is implicit in the form submission usually, but here we just call API
        axios.put('/api/family/game', payload).then(() => {
            showModal('Éxito', 'Juego actualizado correctamente');
            setShowFamilyModal(false);
        }).catch(e => showModal('Error', 'No se pudo actualizar'));
    };

    const handleDeleteGame = () => {
        showModal('⚠ BORRADO TOTAL ⚠', 'ESTA ACCIÓN ES IRREVERSIBLE.\n\nSe borrará TU JUEGO, TODOS LOS USUARIOS y TODAS LAS PRUEBAS.\n\n¿CONTINUAR?', 'confirm', async () => {
            try {
                await axios.delete('/api/family/game');
                logoutGame();
                navigate('/');
            } catch (e) { showModal('Error', 'No se pudo borrar el juego'); }
        });
    };

    // Open User Change Password (Self)
    const openChangePassword = () => {
        const PasswordForm = () => {
            const [localPassData, setLocalPassData] = useState({ current: '', newPass: '', confirmPass: '' });
            const [msg, setMsg] = useState('');

            const handleSubmitPass = async (e) => {
                e.preventDefault();
                if (localPassData.newPass !== localPassData.confirmPass) {
                    setMsg('Las contraseñas no coinciden');
                    return;
                }
                // Placeholder - We didn't implement self-password change backend yet properly for user, 
                // but requirements focused on Family Admin managing Game. 
                setMsg('Solicitud enviada (Simulación)');
                setTimeout(() => setModal({ ...modal, isOpen: false }), 1500);
            };

            return (
                <form onSubmit={handleSubmitPass} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input className="glass-input" type="password" placeholder="Contraseña Actual" required
                        value={localPassData.current} onChange={e => setLocalPassData({ ...localPassData, current: e.target.value })} />
                    <input className="glass-input" type="password" placeholder="Nueva Contraseña" required
                        value={localPassData.newPass} onChange={e => setLocalPassData({ ...localPassData, newPass: e.target.value })} />
                    <input className="glass-input" type="password" placeholder="Confirmar Nueva" required
                        value={localPassData.confirmPass} onChange={e => setLocalPassData({ ...localPassData, confirmPass: e.target.value })} />
                    {msg && <p style={{ color: 'yellow' }}>{msg}</p>}
                    <button type="submit" className="btn-primary">Cambiar</button>
                </form>
            );
        };
        showModal('Cambiar Mi Contraseña', '', 'custom', null, <PasswordForm />);
    };

    // Open Family Modal
    const openFamilySettings = () => {
        setShowFamilyModal(true);
    };

    // TTS Preview (Form Button)
    const previewSpeak = (text, specificConfig) => {
        if (synthRef.current.speaking) {
            synthRef.current.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);

        let config = specificConfig || newChallenge.voiceConfig;
        if (typeof config === 'string') config = { name: config, rate: 1.0, pitch: 1.0 };
        if (!config) config = { name: 'default', rate: 1.0, pitch: 1.0 };

        if (config.name && config.name !== 'default') {
            const selected = voices.find(v => v.name === config.name);
            if (selected) utterance.voice = selected;
        }
        utterance.rate = config.rate || 1.0;
        utterance.pitch = config.pitch || 1.0;

        synthRef.current.speak(utterance);
    };

    const stopSpeak = () => {
        synthRef.current.cancel();
    };

    const handleLogoutUser = (e) => {
        if (e) e.preventDefault();
        // Check if game exists before logout just to be safer, though logoutUser doesn't clear it.
        // We want to ensure we navigate to /login-user, which requires 'game' to be present.
        logoutUser();
        navigate('/login-user');
    };

    return (
        <div className="container" style={{ paddingBottom: '80px' }}>
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onConfirm={modal.onConfirm}
            >
                {modal.children}
            </Modal>

            {/* Family Admin Modal */}
            <Modal
                isOpen={showFamilyModal}
                onClose={() => setShowFamilyModal(false)}
                title="⚙ Gestión de Familia (Admin)"
                message=""
                type="custom"
            >
                <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '5px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ borderBottom: '1px solid gray', paddingBottom: '5px' }}>Usuarios ({familyUsers.length})</h4>
                        {familyUsers.map(u => (
                            <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', marginBottom: '5px', borderRadius: '5px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span>{u.username} {u._id === user.id ? '(Tú)' : ''}</span>
                                    {u._id !== user.id && (
                                        <div
                                            onClick={() => handleTogglePlayPermission(u._id, !u.canPlay)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                cursor: 'pointer', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px'
                                            }}
                                            title={u.canPlay ? "Deshabilitar Juego" : "Habilitar Juego"}
                                        >
                                            <div style={{
                                                width: '10px', height: '10px', borderRadius: '50%',
                                                background: u.canPlay ? '#4ade80' : '#ef4444'
                                            }} />
                                            <span style={{ fontSize: '0.75rem', color: 'gray' }}>{u.canPlay ? 'Juego ON' : 'Juego OFF'}</span>
                                        </div>
                                    )}
                                </div>
                                {u._id !== user.id && (
                                    <button className="btn-danger" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => handleDeleteFamilyUser(u._id)}><FaTrash /></button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ borderBottom: '1px solid gray', paddingBottom: '5px' }}>Configurar Juego</h4>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'gray' }}>Renombrar Juego</label>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input className="glass-input" id="newGameName" placeholder={game?.name} />
                                <button className="btn-primary" onClick={() => handleUpdateGame(document.getElementById('newGameName').value, null)}><FaCheck /></button>
                            </div>
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'gray' }}>Cambiar Contraseña Juego</label>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input className="glass-input" id="newGamePass" type="password" placeholder="Nueva pass" />
                                <button className="btn-primary" onClick={() => handleUpdateGame(null, document.getElementById('newGamePass').value)}><FaCheck /></button>
                            </div>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid #ef4444', paddingTop: '10px' }}>
                        <button className="btn-danger" style={{ width: '100%' }} onClick={handleDeleteGame}>
                            <FaTrash /> BORRAR JUEGO ENTERO
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="glass-panel" style={{ marginTop: '20px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ flex: '1 0 200px' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Hola, {user.username} {user.role === 'family_admin' && <FaCrown title="Administrador de Familia" style={{ color: 'gold', marginLeft: '5px' }} />}</h3>
                    <h5 style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}><FaUser /> Familia {game?.name}</h5>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '1 0 250px', justifyContent: 'flex-end' }}>
                    {user.role === 'family_admin' && (
                        <button className="btn-secondary" style={{ borderColor: 'gold', color: 'gold', flex: 1, minWidth: '40px', padding: '10px' }} onClick={openFamilySettings} title="Ajustes de Familia"><FaCog /></button>
                    )}
                    <button className="btn-secondary" style={{ flex: 1, minWidth: '40px', padding: '10px' }} onClick={openChangePassword} title="Cambiar Contraseña"><FaKey /></button>
                    {(user.role === 'family_admin' || user.canPlay) ? (
                        <button className="btn-primary" style={{ flex: 3, minWidth: '100px' }} onClick={() => navigate('/game')}><FaPlay /> Jugar</button>
                    ) : (
                        <button className="btn-secondary" style={{ opacity: 0.5, cursor: 'not-allowed', flex: 3, minWidth: '100px' }} title="Espera a que el admin habilite el juego"><FaLock /> Bloqueado</button>
                    )}
                    <button className="btn-secondary" style={{ flex: 1, minWidth: '40px', padding: '10px' }} onClick={handleLogoutUser}><FaSignOutAlt /></button>
                </div>
            </div>

            {!audios.some(a => a.uploaderId === user.id) && (
                <div style={{ background: '#ef4444', color: 'white', padding: '10px', marginTop: '20px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                    ⚠ ¡ATENCIÓN! Es OBLIGATORIO subir un audio identificativo (tu himno). <br />
                    Ve a la pestaña "Música" y sube uno ahora.
                </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <button className={`btn-secondary ${activeTab === 'challenges' ? 'active' : ''}`} onClick={() => { setActiveTab('challenges'); stopSpeak(); }} style={{ flex: 1, background: activeTab === 'challenges' ? 'var(--secondary)' : 'transparent', color: activeTab === 'challenges' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FaList /> <span className="hide-mobile">Mis Pruebas</span>
                </button>
                <button className={`btn-secondary ${activeTab === 'new' ? 'active' : ''}`} onClick={() => { setActiveTab('new'); stopSpeak(); }} style={{ flex: 1, background: activeTab === 'new' ? 'var(--secondary)' : 'transparent', color: activeTab === 'new' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {editingId ? <><FaEdit /> <span className="hide-mobile">Editar</span></> : <><FaPlus /> <span className="hide-mobile">Nueva</span></>}
                </button>
                <button className={`btn-secondary ${activeTab === 'music' ? 'active' : ''}`} onClick={() => { setActiveTab('music'); stopSpeak(); }} style={{ flex: 1, background: activeTab === 'music' ? 'var(--secondary)' : 'transparent', color: activeTab === 'music' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FaMusic /> <span className="hide-mobile">Música</span>
                </button>
            </div>

            <div className="glass-panel animate-fade-in" style={{ marginTop: '20px', padding: '20px', minHeight: '400px' }}>
                {activeTab === 'challenges' && (
                    <div className="grid-auto">
                        {challenges.map(c => (
                            <div key={c._id} className="glass-panel"
                                style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer' }}
                                onClick={() => handleEditChallenge(c)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h4 style={{ margin: 0 }}>{c.title}</h4>
                                    <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                        <FaUser /> {c.participants}
                                    </span>
                                </div>

                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>{c.text.substring(0, 80)}{c.text.length > 80 ? '...' : ''}</p>

                                {c.objects && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--primary)', margin: 0 }}>
                                        <strong>Objetos:</strong> {c.objects}
                                    </p>
                                )}

                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                    <span style={{ fontSize: '0.8rem' }}>⏱ {c.timeLimit === 0 ? '∞' : c.timeLimit + 's'}</span>

                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                        <button className="btn-secondary" style={{ padding: '8px 12px' }} onClick={() => handlePlayChallenge(c)} title="Reproducir"><FaPlay /></button>
                                        <button className="btn-secondary" style={{ padding: '8px 12px', color: '#06b6d4' }} onClick={stopSpeak} title="Parar Audio"><FaStop /></button>
                                        {(c.uploaderId === user.id || user.role === 'admin' || user.role === 'family_admin') && (
                                            <>
                                                <button className="btn-secondary" style={{ padding: '8px 12px' }} onClick={() => handleEditChallenge(c)} title="Editar"><FaEdit /></button>
                                                <button className="btn-danger" style={{ padding: '8px 12px' }} onClick={() => handleDeleteChallenge(c._id)} title="Borrar"><FaTrash /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {challenges.length === 0 && <p>No hay pruebas. ¡Crea una!</p>}
                    </div>
                )}

                {activeTab === 'new' && (
                    <form onSubmit={handleCreateOrUpdateChallenge} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '700px', margin: '0 auto' }}>

                        {/* Header & Controls */}
                        <div style={{ borderBottom: '1px solid gray', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{editingId ? 'Editar Prueba' : 'Crear Nueva Prueba'}</h3>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button type="button" className="btn-secondary" onClick={() => handlePlayChallenge(newChallenge)} title="Escuchar Completa"><FaPlay /></button>
                                <button type="button" className="btn-secondary" onClick={() => window.speechSynthesis.pause()} title="Pausar"><FaPause /></button>
                                <button type="button" className="btn-danger" onClick={() => window.speechSynthesis.cancel()} title="Parar"><FaStop /></button>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '15px' }}>
                            {[
                                { key: 'game', label: 'Juego', icon: <FaGamepad /> },
                                { key: 'players', label: 'Jugadores', icon: <FaUsers /> },
                                { key: 'tools', label: 'Herramientas', icon: <FaHammer /> },
                                { key: 'rules', label: 'Reglas', icon: <FaGavel /> },
                                { key: 'customization', label: 'Voz', icon: <FaBullhorn /> }
                            ].map(t => {
                                const isActive = formTab === t.key;
                                return (
                                    <button
                                        type="button"
                                        key={t.key}
                                        className={`btn-secondary ${isActive ? 'active' : ''}`}
                                        onClick={() => setFormTab(t.key)}
                                        title={t.label}
                                        style={{
                                            background: isActive ? 'var(--secondary)' : 'transparent',
                                            color: isActive ? 'white' : 'var(--text-main)',
                                            flex: 1,
                                            fontSize: '1rem',
                                            padding: '12px 5px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px',
                                            minWidth: '60px'
                                        }}
                                    >
                                        {t.icon}
                                        <span style={{ fontSize: '0.65rem', display: 'block' }} className="hide-mobile">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* TAB: JUEGO (GAME) */}
                        {formTab === 'game' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Nombre de la Prueba</label>
                                    <input className="glass-input" value={newChallenge.title} onChange={e => setNewChallenge({ ...newChallenge, title: e.target.value })} required autoFocus />
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Descripción (Leída por el Robot)</label>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
                                        <textarea className="glass-input" rows="4" value={newChallenge.text} onChange={e => setNewChallenge({ ...newChallenge, text: e.target.value })} required />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <button type="button" className="btn-secondary" onClick={() => previewSpeak(newChallenge.text, newChallenge.voiceConfig)}><FaPlay /></button>
                                            <button type="button" className="btn-danger" onClick={stopSpeak}><FaStop /></button>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Duración</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>

                                        {/* OPTION 1: FIXED TIME */}
                                        <div
                                            onClick={() => setNewChallenge({ ...newChallenge, durationType: 'fixed' })}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px',
                                                background: newChallenge.durationType === 'fixed' ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                                                border: `1px solid ${newChallenge.durationType === 'fixed' ? 'var(--secondary)' : 'rgba(255,255,255,0.1)'}`,
                                                cursor: 'pointer', flex: 1, minWidth: '200px'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', border: '2px solid white',
                                                background: newChallenge.durationType === 'fixed' ? 'white' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }} />
                                            <span style={{ fontSize: '0.9rem', color: newChallenge.durationType === 'fixed' ? 'white' : 'gray' }}>Tiempo Definido</span>
                                            <input
                                                className="glass-input"
                                                type="number"
                                                value={newChallenge.timeLimit}
                                                onChange={e => setNewChallenge({ ...newChallenge, timeLimit: parseInt(e.target.value) || 0 })}
                                                onClick={e => e.stopPropagation()}
                                                style={{ textAlign: 'center', maxWidth: '70px', padding: '4px', opacity: newChallenge.durationType === 'fixed' ? 1 : 0.4 }}
                                                disabled={newChallenge.durationType !== 'fixed'}
                                            />
                                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>seg</span>
                                        </div>

                                        {/* OPTION 2: UNTIL NEXT */}
                                        <div
                                            onClick={() => setNewChallenge({ ...newChallenge, durationType: 'untilNext' })}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px',
                                                background: newChallenge.durationType === 'untilNext' ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                                                border: `1px solid ${newChallenge.durationType === 'untilNext' ? 'var(--secondary)' : 'rgba(255,255,255,0.1)'}`,
                                                cursor: 'pointer', flex: 1, minWidth: '200px'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', border: '2px solid white',
                                                background: newChallenge.durationType === 'untilNext' ? 'white' : 'transparent'
                                            }} />
                                            <span style={{ fontSize: '0.9rem', color: newChallenge.durationType === 'untilNext' ? 'white' : 'gray' }}>Hasta Siguiente Prueba</span>
                                        </div>

                                        {/* OPTION 3: DURING X TESTS */}
                                        <div
                                            onClick={() => setNewChallenge({ ...newChallenge, durationType: 'multiChallenge' })}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px',
                                                background: newChallenge.durationType === 'multiChallenge' ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                                                border: `1px solid ${newChallenge.durationType === 'multiChallenge' ? 'var(--secondary)' : 'rgba(255,255,255,0.1)'}`,
                                                cursor: 'pointer', flex: 1, minWidth: '200px'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', border: '2px solid white',
                                                background: newChallenge.durationType === 'multiChallenge' ? 'white' : 'transparent'
                                            }} />
                                            <span style={{ fontSize: '0.9rem', color: newChallenge.durationType === 'multiChallenge' ? 'white' : 'gray' }}>Durante</span>
                                            <input
                                                className="glass-input"
                                                type="number"
                                                value={newChallenge.durationLimit}
                                                onChange={e => setNewChallenge({ ...newChallenge, durationLimit: parseInt(e.target.value) || 1 })}
                                                onClick={e => e.stopPropagation()}
                                                style={{ textAlign: 'center', maxWidth: '60px', padding: '4px', opacity: newChallenge.durationType === 'multiChallenge' ? 1 : 0.4 }}
                                                disabled={newChallenge.durationType !== 'multiChallenge'}
                                            />
                                            <span style={{ fontSize: '0.9rem', color: newChallenge.durationType === 'multiChallenge' ? 'white' : 'gray' }}>pruebas</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: JUGADORES (PLAYERS) */}
                        {formTab === 'players' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                                <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.03)' }}>
                                    <label style={{ display: 'block', marginBottom: '10px', color: 'var(--secondary)', fontWeight: 'bold' }}>¿Quiénes juegan?</label>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                                        {['all:Todos', 'odd:Los Impares', 'even:Los Pares', 'random:Aleatorio', 'custom:Personalizado', 'forward:Posición Relativa'].map(opt => {
                                            const [val, label] = opt.split(':');
                                            return (
                                                <div key={val}
                                                    onClick={() => setNewChallenge({ ...newChallenge, playerConfig: { ...newChallenge.playerConfig, targetType: val } })}
                                                    style={{
                                                        padding: '12px',
                                                        background: newChallenge.playerConfig.targetType === val ? 'var(--secondary)' : 'rgba(0,0,0,0.3)',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        textAlign: 'center',
                                                        fontSize: '0.9rem',
                                                        transition: '0.2s',
                                                        border: `1px solid ${newChallenge.playerConfig.targetType === val ? 'white' : 'transparent'}`
                                                    }}
                                                >
                                                    {label}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                        {/* Conditional participants/offset block */}
                                        {(newChallenge.playerConfig.targetType === 'random' || newChallenge.playerConfig.targetType === 'custom') && (
                                            <div style={{ flex: '1 1 200px' }} className="animate-fade-in">
                                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Número de Participantes</label>
                                                <input
                                                    className="glass-input"
                                                    type="number"
                                                    value={newChallenge.participants}
                                                    onChange={e => setNewChallenge({ ...newChallenge, participants: parseInt(e.target.value) || 1 })}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                        )}

                                        {newChallenge.playerConfig.targetType === 'forward' && (
                                            <div style={{ flex: '1 1 200px' }} className="animate-fade-in">
                                                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Avanzar posiciones</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <input
                                                        className="glass-input" type="number" placeholder="1" style={{ width: '80px' }}
                                                        value={newChallenge.playerConfig.positionOffset || 1}
                                                        onChange={e => setNewChallenge({ ...newChallenge, playerConfig: { ...newChallenge.playerConfig, positionOffset: parseInt(e.target.value) || 0 } })}
                                                    />
                                                    <span style={{ fontSize: '0.8rem', color: 'gray' }}>puestos (desde ti)</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Always Visible Components integrated here */}
                                        <div style={{ flex: '1 1 200px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Edad / Características</label>
                                            <select className="glass-input" value={newChallenge.playerConfig.ageRange} onChange={e => setNewChallenge({ ...newChallenge, playerConfig: { ...newChallenge.playerConfig, ageRange: e.target.value } })} style={{ width: '100%' }}>
                                                <option value="all">Cualquiera</option>
                                                <option value="adults">Solo Adultos</option>
                                                <option value="kids">Solo Niños</option>
                                                <option value="teens">Adolescentes</option>
                                            </select>
                                        </div>

                                        {newChallenge.participants > 1 && (
                                            <div style={{ flex: '1 1 200px' }} className="animate-fade-in">
                                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Agrupación</label>
                                                <select className="glass-input" value={newChallenge.playerConfig.grouping} onChange={e => setNewChallenge({ ...newChallenge, playerConfig: { ...newChallenge.playerConfig, grouping: e.target.value } })} style={{ width: '100%' }}>
                                                    <option value="individual">Individual</option>
                                                    <option value="pairs">Por Parejas</option>
                                                    <option value="trios">Por Tríos</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {newChallenge.playerConfig.targetType === 'custom' && (
                                        <div className="animate-fade-in" style={{ marginTop: '15px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Detalles Personalizados</label>
                                            <textarea
                                                className="glass-input"
                                                rows="2"
                                                placeholder="Escribe aquí reglas o detalles específicos..."
                                                value={newChallenge.playerConfig.customText}
                                                onChange={e => setNewChallenge({ ...newChallenge, playerConfig: { ...newChallenge.playerConfig, customText: e.target.value } })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB: HERRAMIENTAS (TOOLS) */}
                        {formTab === 'tools' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Objetos Necesarios</label>
                                    <input className="glass-input" value={newChallenge.objects} onChange={e => setNewChallenge({ ...newChallenge, objects: e.target.value })} placeholder="Ej: Una pelota, una cuchara..." />
                                </div>

                                <div className="form-group" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '10px', color: 'var(--secondary)', fontWeight: 'bold' }}>Multimedia (Opcional)</label>
                                    <p style={{ fontSize: '0.8rem', color: 'gray', marginTop: '-5px', marginBottom: '15px' }}>Sube archivos para mostrar durante la prueba. El nuevo reemplaza al anterior.</p>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                                        {/* Image Upload */}
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>🖼 Imagen (Máx 8MB)</label>
                                            <input type="file" className="glass-input" onChange={e => handleMediaUpload(e, 'image')} accept="image/*" style={{ fontSize: '0.8rem' }} title="Subir imagen" />
                                            {newChallenge.multimedia?.image?.url ? (
                                                <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#4ade80' }}>✓ {newChallenge.multimedia.image.filename}</div>
                                            ) : <div style={{ marginTop: '5px', fontSize: '0.8rem', color: 'gray' }}>Sin archivo</div>}
                                        </div>

                                        {/* Audio Upload */}
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>🎵 Audio (Máx 15MB)</label>
                                            <input type="file" className="glass-input" onChange={e => handleMediaUpload(e, 'audio')} accept="audio/*" style={{ fontSize: '0.8rem' }} title="Subir audio" />
                                            {newChallenge.multimedia?.audio?.url ? (
                                                <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#4ade80' }}>✓ {newChallenge.multimedia.audio.filename}</div>
                                            ) : <div style={{ marginTop: '5px', fontSize: '0.8rem', color: 'gray' }}>Sin archivo</div>}
                                        </div>

                                        {/* Video Upload */}
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>🎬 Video (Máx 50MB)</label>
                                            <input type="file" className="glass-input" onChange={e => handleMediaUpload(e, 'video')} accept="video/*" style={{ fontSize: '0.8rem' }} title="Subir video" />
                                            {newChallenge.multimedia?.video?.url ? (
                                                <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#4ade80' }}>✓ {newChallenge.multimedia.video.filename}</div>
                                            ) : <div style={{ marginTop: '5px', fontSize: '0.8rem', color: 'gray' }}>Sin archivo</div>}
                                        </div>

                                        {/* Document Upload (NEW) */}
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>📄 Documento (PDF, etc)</label>
                                            <input type="file" className="glass-input" onChange={e => handleMediaUpload(e, 'document')} accept=".pdf,.txt,.doc,.docx" style={{ fontSize: '0.8rem' }} title="Subir documento" />
                                            {newChallenge.multimedia?.document?.url ? (
                                                <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#4ade80' }}>✓ {newChallenge.multimedia.document.filename}</div>
                                            ) : <div style={{ marginTop: '5px', fontSize: '0.8rem', color: 'gray' }}>Sin archivo</div>}
                                        </div>
                                    </div>

                                    {uploadingMedia && <p className="animate-pulse" style={{ marginTop: '15px', textAlign: 'center', color: 'var(--secondary)' }}>⏳ Subiendo archivo...</p>}
                                </div>
                            </div>
                        )}

                        {/* TAB: REGLAS (RULES) */}
                        {formTab === 'rules' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Reglas / Instrucciones Adicionales</label>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
                                        <textarea className="glass-input" rows="4" value={newChallenge.rules} onChange={e => setNewChallenge({ ...newChallenge, rules: e.target.value })} placeholder="Detalles extra que debe leer el sistema..." />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <button type="button" className="btn-secondary" onClick={() => previewSpeak(`Reglas: ${newChallenge.rules}`, newChallenge.voiceConfig)}><FaPlay /></button>
                                            <button type="button" className="btn-danger" onClick={stopSpeak}><FaStop /></button>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#ef4444' }}>Castigo (Para el perdedor)</label>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
                                        <textarea className="glass-input" rows="4" value={newChallenge.punishment} onChange={e => setNewChallenge({ ...newChallenge, punishment: e.target.value })} style={{ borderColor: 'rgba(239,68,68,0.3)' }} placeholder="¿Qué pasa si pierden?" />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <button type="button" className="btn-secondary" onClick={() => previewSpeak(`Castigo: ${newChallenge.punishment}`, newChallenge.voiceConfig)}><FaPlay /></button>
                                            <button type="button" className="btn-danger" onClick={stopSpeak}><FaStop /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: PERSONALIZACIÓN (CUSTOMIZATION - VOZ) */}
                        {formTab === 'customization' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="form-group" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                    <label style={{ display: 'block', marginBottom: '15px', color: 'var(--secondary)', fontWeight: 'bold' }}>Configuración de Voz (TTS)</label>

                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Seleccionar Voz</label>
                                        <select
                                            className="glass-input"
                                            value={newChallenge.voiceConfig?.name || 'default'}
                                            onChange={e => setNewChallenge({ ...newChallenge, voiceConfig: { ...newChallenge.voiceConfig, name: e.target.value } })}
                                            style={{ marginTop: '5px' }}
                                        >
                                            <option value="default">Voz por Defecto (Español)</option>
                                            {voices.filter(v => v.lang.startsWith('es')).map(v => (
                                                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', gap: '20px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <span>Velocidad</span>
                                                <span>{newChallenge.voiceConfig?.rate || 1.0}x</span>
                                            </label>
                                            <input
                                                type="range" min="0.5" max="2.0" step="0.1"
                                                value={newChallenge.voiceConfig?.rate || 1.0}
                                                onChange={e => setNewChallenge({ ...newChallenge, voiceConfig: { ...newChallenge.voiceConfig, rate: parseFloat(e.target.value) } })}
                                                style={{ width: '100%', accentColor: 'var(--secondary)', marginTop: '5px' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <span>Tono</span>
                                                <span>{newChallenge.voiceConfig?.pitch || 1.0}</span>
                                            </label>
                                            <input
                                                type="range" min="0.5" max="2.0" step="0.1"
                                                value={newChallenge.voiceConfig?.pitch || 1.0}
                                                onChange={e => setNewChallenge({ ...newChallenge, voiceConfig: { ...newChallenge.voiceConfig, pitch: parseFloat(e.target.value) } })}
                                                style={{ width: '100%', accentColor: 'var(--secondary)', marginTop: '5px' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                                        <button type="button" className="btn-secondary" onClick={() => previewSpeak("Hola, esta es una prueba de voz.", newChallenge.voiceConfig)}>
                                            <FaPlay /> Probar esta voz
                                        </button>
                                        <button type="button" className="btn-danger" onClick={stopSpeak} style={{ marginLeft: '10px' }}><FaStop /></button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer Actions */}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                            {editingId && (
                                <button type="button" className="btn-secondary" onClick={() => { resetForm(); setActiveTab('challenges'); }} style={{ flex: 1 }}>
                                    Cancelar
                                </button>
                            )}
                            <button type="submit" className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <FaSave /> {editingId ? 'Guardar Cambios' : 'Crear Prueba'}
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'music' && (
                    <div>
                        <form onSubmit={handleUploadAudio} style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                            <div style={{ flex: '1 0 250px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Seleccionar archivo (MP3, WAV)</label>
                                <input type="file" className="glass-input" accept="audio/*" onChange={e => setAudioFile(e.target.files[0])} />
                            </div>

                            <div style={{ flex: '1 0 150px' }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    <span>Duración</span>
                                    <span>{audioDuration}s</span>
                                </label>
                                <input
                                    type="range" min="5" max="30" step="1"
                                    value={audioDuration}
                                    onChange={e => setAudioDuration(parseInt(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--secondary)' }}
                                />
                            </div>

                            <button type="submit" className="btn-primary" disabled={!audioFile} style={{ flex: '1 0 100px' }}>Subir Himno</button>
                            <div style={{ width: '100%', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Límite: 15MB</span>
                            </div>
                        </form>
                        <div className="grid-auto">
                            {audios.map(a => (
                                <div key={a._id} className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.05)' }}>
                                    <p style={{ marginBottom: '5px', wordBreak: 'break-all', fontWeight: 'bold' }}>{a.originalName}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Duración: {a.duration || 30}s</p>
                                    <audio controls style={{ width: '100%' }}>
                                        <source src={`/uploads/${a.filename}`} type="audio/mpeg" />
                                    </audio>
                                    <div style={{ marginTop: '10px', textAlign: 'right' }}>
                                        {(a.uploaderId === user.id || user.role === 'admin' || user.role === 'family_admin') &&
                                            <button className="btn-danger" onClick={() => handleDeleteAudio(a._id)}><FaTrash /></button>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
