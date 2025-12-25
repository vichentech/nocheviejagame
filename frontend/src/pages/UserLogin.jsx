import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaUserPlus, FaSignInAlt } from 'react-icons/fa';

const UserLogin = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const { loginUser, registerUser, game } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        const savedUser = localStorage.getItem(`rememberedUser_${game?.id}`);
        if (savedUser) {
            setUsername(savedUser);
            setRememberMe(true);
        }
    }, [game]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await loginUser(username, password);
            } else {
                await registerUser(username, password);
            }

            if (rememberMe) {
                localStorage.setItem(`rememberedUser_${game?.id}`, username);
            } else {
                localStorage.removeItem(`rememberedUser_${game?.id}`);
            }

            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.msg || 'An error occurred');
        }
    };

    return (
        <div className="full-screen-center">
            <div className="glass-panel text-center animate-fade-in" style={{ padding: '3rem', maxWidth: '400px', width: '100%' }}>
                <h2 style={{ marginBottom: '1rem' }}>Hola, familia {game?.name}</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Identifícate para participar</p>

                <div style={{ marginBottom: '2rem' }}>
                    <button
                        className={`btn-secondary ${isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(true)}
                        style={{ marginRight: '10px', background: isLogin ? 'rgba(236, 72, 153, 0.2)' : 'transparent' }}
                    >
                        Soy Yo
                    </button>
                    <button
                        className={`btn-secondary ${!isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(false)}
                        style={{ background: !isLogin ? 'rgba(236, 72, 153, 0.2)' : 'transparent' }}
                    >
                        Soy Nuevo
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Tu Nombre"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="glass-input"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Tu Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="glass-input"
                        required
                    />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <input
                            type="checkbox"
                            id="rememberMeUser"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            style={{ accentColor: 'var(--secondary)', width: '16px', height: '16px' }}
                        />
                        <label htmlFor="rememberMeUser" style={{ cursor: 'pointer' }}>Recordarme</label>
                    </div>

                    {error && <p style={{ color: '#ef4444', marginTop: '0.5rem' }}>{error}</p>}

                    <button type="submit" className="btn-primary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        {isLogin ? <><FaSignInAlt /> Entrar</> : <><FaUserPlus /> Registrarse</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UserLogin;
