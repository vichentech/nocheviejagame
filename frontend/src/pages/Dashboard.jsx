import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaList, FaPlus, FaMusic, FaPlay, FaTrash, FaSignOutAlt, FaStop, FaEdit, FaKey, FaUser, FaPause, FaCrown, FaCog, FaCheck, FaTimes } from 'react-icons/fa';
import Modal from '../components/Modal';

const Dashboard = () => {
    const { user, game, logout } = useAuth();
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
        title: '', text: '', timeLimit: 60, participants: 1, objects: '', description: '', rules: '', notes: '',
        voiceConfig: { name: 'default', rate: 1.0, pitch: 1.0 },
        isTimeUntilNext: false
    });
    const [editingId, setEditingId] = useState(null);
    const [audioFile, setAudioFile] = useState(null);
    const [voices, setVoices] = useState([]);
    const synthRef = useRef(window.speechSynthesis);

    useEffect(() => {
        fetchChallenges();
        fetchAudios();
        const loadVoices = () => {
            setVoices(synthRef.current.getVoices());
        };
        loadVoices();
        synthRef.current.onvoiceschanged = loadVoices;
    }, []);

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
            if (challengeToSave.isTimeUntilNext) {
                challengeToSave.timeLimit = 0;
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
        setNewChallenge({ title: '', text: '', timeLimit: 60, participants: 1, objects: '', description: '', rules: '', notes: '', voiceConfig: { name: 'default', rate: 1.0, pitch: 1.0 }, isTimeUntilNext: false });
        setEditingId(null);
    };

    const handleEditChallenge = (challenge) => {
        let vConfig = challenge.voiceConfig;
        if (typeof vConfig === 'string') {
            vConfig = { name: vConfig, rate: 1.0, pitch: 1.0 };
        } else if (!vConfig) {
            vConfig = { name: 'default', rate: 1.0, pitch: 1.0 };
        }
        setNewChallenge({ ...challenge, voiceConfig: vConfig, isTimeUntilNext: challenge.timeLimit === 0 });
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
        speakText(`Participantes: ${challenge.participants}`);
        if (challenge.timeLimit === 0) {
            speakText("Tiempo: Hasta la siguiente prueba");
        } else {
            speakText(`Tiempo: ${challenge.timeLimit} segundos`);
        }
        if (challenge.objects) {
            speakText(`Objetos necesarios: ${challenge.objects}`);
        }
        if (challenge.rules) {
            speakText(`Reglas adicionales: ${challenge.rules}`);
        }
    };

    const handleUploadAudio = async (e) => {
        e.preventDefault();
        if (!audioFile) return;
        const formData = new FormData();
        formData.append('file', audioFile);
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
                logout();
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
                            <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.05)', marginBottom: '5px', borderRadius: '5px' }}>
                                <span>{u.username} {u._id === user.id ? '(Tú)' : ''}</span>
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

            <div className="glass-panel" style={{ marginTop: '20px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                    <h3>Hola, {user.username} {user.role === 'family_admin' && <FaCrown title="Administrador de Familia" style={{ color: 'gold', marginLeft: '5px' }} />}</h3>
                    <h5 style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><FaUser /> Familia {game?.name}</h5>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {user.role === 'family_admin' && (
                        <button className="btn-secondary" style={{ borderColor: 'gold', color: 'gold' }} onClick={openFamilySettings} title="Ajustes de Familia"><FaCog /></button>
                    )}
                    <button className="btn-secondary" onClick={openChangePassword} title="Cambiar Contraseña"><FaKey /></button>
                    <button className="btn-primary" onClick={() => navigate('/game')}><FaPlay /> Jugar</button>
                    <button className="btn-secondary" onClick={() => logout()}><FaSignOutAlt /></button>
                </div>
            </div>

            {!audios.some(a => a.uploaderId === user.id) && (
                <div style={{ background: '#ef4444', color: 'white', padding: '10px', marginTop: '20px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                    ⚠ ¡ATENCIÓN! Es OBLIGATORIO subir un audio identificativo (tu himno). <br />
                    Ve a la pestaña "Música" y sube uno ahora.
                </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                <button className={`btn-secondary ${activeTab === 'challenges' ? 'active' : ''}`} onClick={() => { setActiveTab('challenges'); resetForm(); }} style={{ background: activeTab === 'challenges' ? 'var(--secondary)' : 'transparent', color: activeTab === 'challenges' ? 'white' : 'var(--text-main)' }}><FaList /> Mis Pruebas</button>
                <button className={`btn-secondary ${activeTab === 'new' ? 'active' : ''}`} onClick={() => { setActiveTab('new'); resetForm(); }} style={{ background: activeTab === 'new' ? 'var(--secondary)' : 'transparent', color: activeTab === 'new' ? 'white' : 'var(--text-main)' }}>
                    {editingId ? <><FaEdit /> Editar Prueba</> : <><FaPlus /> Nueva Prueba</>}
                </button>
                <button className={`btn-secondary ${activeTab === 'music' ? 'active' : ''}`} onClick={() => setActiveTab('music')} style={{ background: activeTab === 'music' ? 'var(--secondary)' : 'transparent', color: activeTab === 'music' ? 'white' : 'var(--text-main)' }}><FaMusic /> Música</button>
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

                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem' }}>⏱ {c.timeLimit === 0 ? '∞' : c.timeLimit + 's'}</span>

                                    <div style={{ display: 'flex', gap: '5px' }} onClick={(e) => e.stopPropagation()}>
                                        <button className="btn-secondary" style={{ padding: '5px 10px' }} onClick={() => handlePlayChallenge(c)} title="Reproducir"><FaPlay /></button>
                                        <button className="btn-secondary" style={{ padding: '5px 10px', color: '#06b6d4' }} onClick={stopSpeak} title="Parar Audio"><FaStop /></button>
                                        {(c.uploaderId === user.id || user.role === 'admin' || user.role === 'family_admin') && (
                                            <>
                                                <button className="btn-secondary" style={{ padding: '5px 10px' }} onClick={() => handleEditChallenge(c)} title="Editar"><FaEdit /></button>
                                                <button className="btn-danger" style={{ padding: '5px 10px' }} onClick={() => handleDeleteChallenge(c._id)} title="Borrar"><FaTrash /></button>
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
                    <form onSubmit={handleCreateOrUpdateChallenge} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px', margin: '0 auto' }}>

                        <div style={{ borderBottom: '1px solid gray', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{editingId ? 'Editar Prueba' : 'Crear Nueva Prueba'}</h3>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button type="button" className="btn-secondary" onClick={() => handlePlayChallenge(newChallenge)} title="Escuchar Completa"><FaPlay /></button>
                                <button type="button" className="btn-secondary" onClick={() => window.speechSynthesis.pause()} title="Pausar"><FaPause /></button>
                                <button type="button" className="btn-danger" onClick={() => window.speechSynthesis.cancel()} title="Parar"><FaStop /></button>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Nombre de la Prueba</label>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input className="glass-input" value={newChallenge.title} onChange={e => setNewChallenge({ ...newChallenge, title: e.target.value })} required />
                                <button type="button" className="btn-secondary" onClick={() => previewSpeak(newChallenge.title, newChallenge.voiceConfig)}><FaPlay /></button>
                            </div>
                        </div>

                        {/* Description/Text */}
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Descripción (Leída por el Robot)</label>
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
                                <textarea className="glass-input" rows="3" value={newChallenge.text} onChange={e => setNewChallenge({ ...newChallenge, text: e.target.value })} required />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => previewSpeak(newChallenge.text, newChallenge.voiceConfig)}><FaPlay /></button>
                                    <button type="button" className="btn-danger" onClick={stopSpeak}><FaStop /></button>
                                </div>
                            </div>
                        </div>

                        {/* Voice Selection */}
                        <div className="form-group" style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--secondary)', fontWeight: 'bold' }}>Personalización de Voz</label>

                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Seleccionar Voz</label>
                                <select
                                    className="glass-input"
                                    value={newChallenge.voiceConfig?.name || 'default'}
                                    onChange={e => setNewChallenge({ ...newChallenge, voiceConfig: { ...newChallenge.voiceConfig, name: e.target.value } })}
                                    style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }}
                                >
                                    <option value="default">Voz por Defecto (Español)</option>
                                    {voices.filter(v => v.lang.startsWith('es')).map(v => (
                                        <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>Velocidad (Rate)</span>
                                        <span>{newChallenge.voiceConfig?.rate || 1.0}</span>
                                    </label>
                                    <input
                                        type="range" min="0.5" max="2.0" step="0.1"
                                        value={newChallenge.voiceConfig?.rate || 1.0}
                                        onChange={e => setNewChallenge({ ...newChallenge, voiceConfig: { ...newChallenge.voiceConfig, rate: parseFloat(e.target.value) } })}
                                        style={{ width: '100%', accentColor: 'var(--secondary)' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>Tono (Pitch)</span>
                                        <span>{newChallenge.voiceConfig?.pitch || 1.0}</span>
                                    </label>
                                    <input
                                        type="range" min="0.5" max="2.0" step="0.1"
                                        value={newChallenge.voiceConfig?.pitch || 1.0}
                                        onChange={e => setNewChallenge({ ...newChallenge, voiceConfig: { ...newChallenge.voiceConfig, pitch: parseFloat(e.target.value) } })}
                                        style={{ width: '100%', accentColor: 'var(--secondary)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Time & Participants - Improved Layout */}
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Tiempo (segs)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {!newChallenge.isTimeUntilNext && (
                                        <input
                                            className="glass-input"
                                            type="number"
                                            value={newChallenge.timeLimit}
                                            onChange={e => setNewChallenge({ ...newChallenge, timeLimit: e.target.value })}
                                            style={{ textAlign: 'center' }}
                                        />
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                                        <input type="checkbox" checked={newChallenge.isTimeUntilNext} onChange={e => setNewChallenge({ ...newChallenge, isTimeUntilNext: e.target.checked })} style={{ width: '20px', height: '20px', accentColor: 'var(--secondary)' }} />
                                        <span>Indefinido</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Participantes (num)</label>
                                <input
                                    className="glass-input"
                                    type="number"
                                    value={newChallenge.participants}
                                    onChange={e => setNewChallenge({ ...newChallenge, participants: e.target.value })}
                                    style={{ textAlign: 'center' }}
                                />
                            </div>
                        </div>

                        {/* Objects */}
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Objetos Necesarios</label>
                            <input className="glass-input" value={newChallenge.objects} onChange={e => setNewChallenge({ ...newChallenge, objects: e.target.value })} />
                        </div>

                        {/* Rules */}
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Reglas / Instrucciones Adicionales</label>
                            <textarea className="glass-input" rows="2" value={newChallenge.rules} onChange={e => setNewChallenge({ ...newChallenge, rules: e.target.value })} />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingId ? 'Actualizar' : 'Guardar'} Prueba</button>
                            {editingId && <button type="button" className="btn-secondary" onClick={() => { resetForm(); setActiveTab('challenges'); }}>Cancelar</button>}
                        </div>
                    </form>
                )}

                {activeTab === 'music' && (
                    <div>
                        <form onSubmit={handleUploadAudio} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                            <input type="file" className="glass-input" accept="audio/*" onChange={e => setAudioFile(e.target.files[0])} />
                            <button type="submit" className="btn-primary" disabled={!audioFile}>Subir</button>
                        </form>
                        <div className="grid-auto">
                            {audios.map(a => (
                                <div key={a._id} className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.05)' }}>
                                    <p style={{ marginBottom: '10px', wordBreak: 'break-all' }}>{a.originalName}</p>
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
