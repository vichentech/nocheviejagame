import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaGamepad, FaUser, FaList, FaEdit, FaTrash, FaSignOutAlt, FaSearch, FaKey, FaTag } from 'react-icons/fa';
import Modal from '../components/Modal';

const AdminDashboard = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('games'); // games, users, challenges

    // DATA STATES
    const [games, setGames] = useState([]);
    const [users, setUsers] = useState([]);
    const [challenges, setChallenges] = useState([]);

    // SELECTION STATES
    const [selectedGameId, setSelectedGameId] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');

    // EDIT STATES
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', children: null, onConfirm: null });

    useEffect(() => {
        fetchGames();
    }, []);

    useEffect(() => {
        if (selectedGameId) fetchUsers(selectedGameId);
    }, [selectedGameId]);

    useEffect(() => {
        if (selectedUserId) fetchChallenges(selectedUserId);
    }, [selectedUserId]);

    const showModal = (title, message, type = 'alert', onConfirm = null, children = null) => {
        setModal({ isOpen: true, title, message, type, onConfirm, children });
    };

    const closeModal = () => setModal({ ...modal, isOpen: false });

    // API CALLS
    const fetchGames = async () => {
        try {
            const res = await axios.get('/api/admin/games');
            setGames(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchUsers = async (gameId) => {
        try {
            const res = await axios.get(`/api/admin/games/${gameId}/users`);
            setUsers(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchChallenges = async (userId) => {
        try {
            const res = await axios.get(`/api/admin/users/${userId}/challenges`);
            setChallenges(res.data);
        } catch (err) { console.error(err); }
    };

    // HANDLERS - GAMES
    const handleEditGameName = (game) => {
        const EditForm = () => {
            const [name, setName] = useState(game.name);
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label>Nuevo Nombre:</label>
                    <input className="glass-input" value={name} onChange={e => setName(e.target.value)} />
                    <button className="btn-primary" onClick={async () => {
                        try {
                            await axios.put(`/api/admin/games/${game._id}`, { name });
                            closeModal();
                            fetchGames();
                        } catch (e) { alert('Error updating'); }
                    }}>Guardar Cambios</button>
                </div>
            )
        };
        showModal('Cambiar Nombre del Juego', '', 'custom', null, <EditForm />);
    };

    const handleEditGamePass = (game) => {
        const EditForm = () => {
            const [password, setPassword] = useState('');
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label>Nueva Contraseña:</label>
                    <input className="glass-input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                    <button className="btn-primary" onClick={async () => {
                        try {
                            await axios.put(`/api/admin/games/${game._id}`, { password });
                            closeModal();
                            fetchGames();
                        } catch (e) { alert('Error updating'); }
                    }}>Cambiar Contraseña</button>
                </div>
            )
        };
        showModal('Cambiar Contraseña del Juego', '', 'custom', null, <EditForm />);
    };

    const handleDeleteGame = (id) => {
        showModal('⚠ BORRADO IRREVERSIBLE', '¡ATENCIÓN! Estás a punto de borrar un juego completo.\n\nESTA ACCIÓN BORRARÁ TAMBIÉN:\n- Todos los usuarios de esa familia.\n- Todas las pruebas creadas por esos usuarios.\n\n¿Estás ABSOLUTAMENTE SEGURO?', 'confirm', async () => {
            await axios.delete(`/api/admin/games/${id}`);
            fetchGames();
        });
    };

    // HANDLERS - USERS
    const handleEditUser = (user) => {
        const EditForm = () => {
            const [localData, setLocalData] = useState({ ...user, password: '' });
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label>Username:</label>
                    <input className="glass-input" placeholder="Username" value={localData.username} onChange={e => setLocalData({ ...localData, username: e.target.value })} />
                    <label>Password (Dejar en blanco para no cambiar):</label>
                    <input className="glass-input" type="password" placeholder="Nueva Contraseña" value={localData.password} onChange={e => setLocalData({ ...localData, password: e.target.value })} />
                    <button className="btn-primary" onClick={async () => {
                        try {
                            await axios.put(`/api/admin/users/${user._id}`, localData);
                            closeModal();
                            if (selectedGameId) fetchUsers(selectedGameId);
                        } catch (e) { alert('Error updating'); }
                    }}>Guardar</button>
                </div>
            )
        };
        showModal('Editar Usuario', '', 'custom', null, <EditForm />);
    };

    const handleDeleteUser = (id) => {
        showModal('Confirmar Borrado', '¿Seguro que quieres borrar este usuario?\n\nSe borrarán también todas sus pruebas asociadas.', 'confirm', async () => {
            await axios.delete(`/api/admin/users/${id}`);
            if (selectedGameId) fetchUsers(selectedGameId);
        });
    };

    // HANDLERS - CHALLENGES
    const handleEditChallenge = (challenge) => {
        const EditForm = () => {
            // Include all potentially editable fields
            const [localData, setLocalData] = useState({
                title: challenge.title || '',
                text: challenge.text || '',
                timeLimit: challenge.timeLimit || 0,
                participants: challenge.participants || 0,
                objects: challenge.objects || '',
                rules: challenge.rules || '',
                notes: challenge.notes || '',
                voiceConfig: challenge.voiceConfig || {}
            });

            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'gray' }}>Título</label>
                        <input className="glass-input" value={localData.title} onChange={e => setLocalData({ ...localData, title: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'gray' }}>Descripción (Texto)</label>
                        <textarea className="glass-input" rows="3" value={localData.text} onChange={e => setLocalData({ ...localData, text: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.8rem', color: 'gray' }}>Tiempo (s)</label>
                            <input className="glass-input" type="number" value={localData.timeLimit} onChange={e => setLocalData({ ...localData, timeLimit: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.8rem', color: 'gray' }}>Participantes</label>
                            <input className="glass-input" type="number" value={localData.participants} onChange={e => setLocalData({ ...localData, participants: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'gray' }}>Objetos Requeridos</label>
                        <input className="glass-input" value={localData.objects} onChange={e => setLocalData({ ...localData, objects: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'gray' }}>Reglas Especiales</label>
                        <textarea className="glass-input" rows="2" value={localData.rules} onChange={e => setLocalData({ ...localData, rules: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'gray' }}>Notas Internas</label>
                        <input className="glass-input" value={localData.notes} onChange={e => setLocalData({ ...localData, notes: e.target.value })} />
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>Configuración de Voz (TTS)</label>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.7rem', color: 'gray' }}>Rate (0.1 - 2.0)</label>
                                <input className="glass-input" type="number" step="0.1" value={localData.voiceConfig?.rate || 1.1}
                                    onChange={e => setLocalData({ ...localData, voiceConfig: { ...localData.voiceConfig, rate: parseFloat(e.target.value) } })} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.7rem', color: 'gray' }}>Pitch (0 - 2)</label>
                                <input className="glass-input" type="number" step="0.1" value={localData.voiceConfig?.pitch || 1.2}
                                    onChange={e => setLocalData({ ...localData, voiceConfig: { ...localData.voiceConfig, pitch: parseFloat(e.target.value) } })} />
                            </div>
                        </div>
                    </div>

                    <button className="btn-primary" style={{ marginTop: '10px' }} onClick={async () => {
                        try {
                            await axios.put(`/api/admin/challenges/${challenge._id}`, localData);
                            closeModal();
                            if (selectedUserId) fetchChallenges(selectedUserId);
                        } catch (e) { alert('Error updating'); }
                    }}>Guardar CAMBIOS</button>
                </div>
            )
        };
        showModal('EDITAR COMPLETAMENTE PRUEBA', '', 'custom', null, <EditForm />);
    };

    const handleDeleteChallenge = (id) => {
        showModal('Confirmar', '¿Borrar esta prueba permanentemente?', 'confirm', async () => {
            await axios.delete(`/api/admin/challenges/${id}`);
            if (selectedUserId) fetchChallenges(selectedUserId);
        });
    };


    return (
        <div className="container" style={{ paddingBottom: '50px' }}>
            <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} message={modal.message} type={modal.type} onConfirm={modal.onConfirm}>
                {modal.children}
            </Modal>

            <div className="glass-panel" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>🔧 Admin Panel</h2>
                <button className="btn-secondary" onClick={() => { logout(); navigate('/'); }}><FaSignOutAlt /> Salir</button>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button className={`btn-secondary ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')} style={{ background: activeTab === 'games' ? 'var(--secondary)' : 'transparent' }}>Juegos</button>
                <button className={`btn-secondary ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')} style={{ background: activeTab === 'users' ? 'var(--secondary)' : 'transparent' }}>Usuarios</button>
                <button className={`btn-secondary ${activeTab === 'challenges' ? 'active' : ''}`} onClick={() => setActiveTab('challenges')} style={{ background: activeTab === 'challenges' ? 'var(--secondary)' : 'transparent' }}>Pruebas</button>
            </div>

            <div className="glass-panel animate-fade-in" style={{ marginTop: '20px', padding: '20px', minHeight: '50vh' }}>

                {/* GAMES TAB */}
                {activeTab === 'games' && (
                    <div className="grid-auto">
                        {games.map(g => (
                            <div key={g._id} className="glass-panel" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <h4 style={{ margin: 0 }}>{g.name}</h4>
                                    <span style={{ fontSize: '0.7rem', color: 'gray' }}>{g._id}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                                    <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => handleEditGameName(g)} title="Cambiar Nombre"><FaTag /> Rename</button>
                                    <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => handleEditGamePass(g)} title="Cambiar Contraseña"><FaKey /> Pass</button>
                                    <button className="btn-danger" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => handleDeleteGame(g._id)} title="Borrar TODO"><FaTrash /> Del</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div>
                        <div style={{ marginBottom: '20px' }}>
                            <label>Selecciona Juego:</label>
                            <select className="glass-input" onChange={e => { setSelectedGameId(e.target.value); setSelectedUserId(''); setChallenges([]); }} value={selectedGameId}>
                                <option value="">-- Seleccionar --</option>
                                {games.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                            </select>
                        </div>

                        <div className="grid-auto">
                            {users.map(u => (
                                <div key={u._id} className="glass-panel" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <h4>{u.username}</h4>
                                        <div>
                                            <button className="btn-secondary" style={{ padding: '5px' }} onClick={() => handleEditUser(u)}><FaEdit /></button>
                                            <button className="btn-danger" style={{ padding: '5px' }} onClick={() => handleDeleteUser(u._id)}><FaTrash /></button>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'gray' }}>Role: {u.role}</p>
                                </div>
                            ))}
                            {selectedGameId && users.length === 0 && <p style={{ color: 'gray' }}>No user found.</p>}
                        </div>
                    </div>
                )}

                {/* CHALLENGES TAB */}
                {activeTab === 'challenges' && (
                    <div>
                        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <label>Selecciona Juego:</label>
                                <select className="glass-input" onChange={e => { setSelectedGameId(e.target.value); fetchUsers(e.target.value); setSelectedUserId(''); setChallenges([]); }} value={selectedGameId}>
                                    <option value="">-- Seleccionar --</option>
                                    {games.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>Selecciona Usuario:</label>
                                <select className="glass-input" onChange={e => setSelectedUserId(e.target.value)} value={selectedUserId} disabled={!selectedGameId}>
                                    <option value="">-- Seleccionar --</option>
                                    {users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid-auto">
                            {challenges.map(c => (
                                <div key={c._id} className="glass-panel" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px' }}>
                                    <h4 style={{ marginBottom: '5px' }}>{c.title}</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'gray', marginBottom: '10px' }}>{c.text.substring(0, 50)}...</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px' }}>
                                        <span className="badge">{c.timeLimit}s</span>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button className="btn-secondary" style={{ padding: '5px 10px' }} onClick={() => handleEditChallenge(c)} title="Editar COMPLETO"><FaEdit /></button>
                                            <button className="btn-danger" style={{ padding: '5px 10px' }} onClick={() => handleDeleteChallenge(c._id)} title="Borrar"><FaTrash /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {selectedUserId && challenges.length === 0 && <p style={{ color: 'gray' }}>No challenges found.</p>}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default AdminDashboard;
