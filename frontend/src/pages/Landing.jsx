import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaPlay, FaGamepad } from 'react-icons/fa';

const Landing = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const { loginGame, registerGame } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        const savedName = localStorage.getItem('rememberedGameName');
        if (savedName) {
            setName(savedName);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isLogin && password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        try {
            if (isLogin) {
                await loginGame(name, password);
            } else {
                await registerGame(name, password);
                await loginGame(name, password);
            }

            if (rememberMe) {
                localStorage.setItem('rememberedGameName', name);
            } else {
                localStorage.removeItem('rememberedGameName');
            }

            navigate('/login-user');
        } catch (err) {
            setError(err.response?.data?.msg || 'An error occurred');
        }
    };

    return (
        <div className="full-screen-center">
            <div className="glass-panel text-center floating-card" style={{ padding: '3rem', maxWidth: '400px', width: '100%' }}>
                <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem', background: 'linear-gradient(to right, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Nochevieja Game
                </h1>

                <div style={{ marginBottom: '2rem' }}>
                    <button
                        className={`btn-secondary ${isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(true)}
                        style={{ marginRight: '10px', background: isLogin ? 'rgba(236, 72, 153, 0.2)' : 'transparent' }}
                    >
                        Entrar
                    </button>
                    <button
                        className={`btn-secondary ${!isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(false)}
                        style={{ background: !isLogin ? 'rgba(236, 72, 153, 0.2)' : 'transparent' }}
                    >
                        Crear Juego
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Nombre de Familia/Juego"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="glass-input"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="glass-input"
                        required
                    />

                    {!isLogin && (
                        <input
                            type="password"
                            placeholder="Confirmar Contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="glass-input"
                            required
                        />
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <input
                            type="checkbox"
                            id="rememberMe"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            style={{ accentColor: 'var(--secondary)', width: '16px', height: '16px' }}
                        />
                        <label htmlFor="rememberMe" style={{ cursor: 'pointer' }}>Recordar mi acceso</label>
                    </div>

                    {error && <p style={{ color: '#ef4444', marginTop: '0.5rem' }}>{error}</p>}

                    <button type="submit" className="btn-primary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        {isLogin ? <><FaPlay /> Jugar</> : <><FaGamepad /> Crear</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Landing;
