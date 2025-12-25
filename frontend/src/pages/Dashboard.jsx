import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaList, FaPlus, FaMusic, FaPlay, FaTrash, FaSignOutAlt, FaStop, FaEdit, FaKey, FaUser, FaPause } from 'react-icons/fa';
import Modal from '../components/Modal';

const Dashboard = () => {
    const { user, game, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('challenges');
    const [challenges, setChallenges] = useState([]);
    const [audios, setAudios] = useState([]);

    // Modal State
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', children: null, onConfirm: null });

    // Password Change State
    const [passData, setPassData] = useState({ current: '', newPass: '', confirmPass: '' });

    // Form States
    const [newChallenge, setNewChallenge] = useState({
        title: '', text: '', timeLimit: 60, participants: 1, objects: '', description: '', rules: '', notes: '', voiceConfig: 'default',
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

    const handleCreateOrUpdateChallenge = async (e) => {
        e.preventDefault();
        try {
            const challengeToSave = { ...newChallenge };
            if (challengeToSave.isTimeUntilNext) {
                challengeToSave.timeLimit = 0;
            }

            if (editingId) {
                await axios.put(`/api/challenges/${editingId}`, challengeToSave);
                showModal('Éxito', 'Prueba actualizada correctamente');
            } else {
                await axios.post('/api/challenges', challengeToSave);
                showModal('Éxito', 'Prueba creada correctamente');
            }

            resetForm();
            fetchChallenges();
            setActiveTab('challenges');
        } catch (err) {
            showModal('Error', 'No se pudo guardar la prueba');
        }
    };

    const resetForm = () => {
        setNewChallenge({ title: '', text: '', timeLimit: 60, participants: 1, objects: '', description: '', rules: '', notes: '', voiceConfig: 'default', isTimeUntilNext: false });
        setEditingId(null);
    };

    const handleEditChallenge = (challenge) => {
        setNewChallenge({ ...challenge, isTimeUntilNext: challenge.timeLimit === 0 });
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
            const voiceName = challenge.voiceConfig;
            if (voiceName && voiceName !== 'default') {
                const selected = voices.find(v => v.name === voiceName);
                if (selected) utterance.voice = selected;
            }
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
                setMsg('Funcionalidad de cambio de contraseña pendiente de backend (Simulado: OK)');
                setTimeout(() => setModal({ ...modal, isOpen: false }), 2000);
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

        showModal('Cambiar Contraseña', '', 'custom', null, <PasswordForm />);
    };

    // TTS Preview (Form Button)
    const previewSpeak = (text, voiceConfig) => {
        if (synthRef.current.speaking) {
            synthRef.current.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        const voiceName = voiceConfig || newChallenge.voiceConfig;

        if (voiceName !== 'default') {
            const selected = voices.find(v => v.name === voiceName);
            if (selected) utterance.voice = selected;
        }
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

            <div className="glass-panel" style={{ marginTop: '20px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                    <h3>Hola, {user.username}</h3>
                    <h5 style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><FaUser /> Familia {game?.name}</h5>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-secondary" onClick={openChangePassword} title="Cambiar Contraseña"><FaKey /></button>
                    <button className="btn-primary" onClick={() => navigate('/game')}><FaPlay /> Jugar</button>
                    <button className="btn-secondary" onClick={() => logout()}><FaSignOutAlt /></button>
                </div>
            </div>

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
                            <div key={c._id} className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.05)' }}>
                                <h4>{c.title}</h4>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{c.text.substring(0, 50)}...</p>
                                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem' }}>⏱ {c.timeLimit === 0 ? '∞' : c.timeLimit + 's'}</span>

                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button className="btn-secondary" style={{ padding: '5px 10px' }} onClick={() => handlePlayChallenge(c)} title="Reproducir"><FaPlay /></button>
                                        {(c.uploaderId === user.id || user.role === 'admin') && (
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
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Voz del Robot</label>
                            <select
                                className="glass-input"
                                value={newChallenge.voiceConfig}
                                onChange={e => setNewChallenge({ ...newChallenge, voiceConfig: e.target.value })}
                                style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }} // Improved contrast
                            >
                                <option value="default">Voz por Defecto (Español)</option>
                                {voices.filter(v => v.lang.startsWith('es')).map(v => ( // Only Spanish
                                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                                ))}
                            </select>
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
                                        {(a.uploaderId === user.id || user.role === 'admin') &&
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
