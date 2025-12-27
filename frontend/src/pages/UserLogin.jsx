import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaUserPlus, FaSignInAlt, FaEye, FaEyeSlash, FaSignOutAlt } from 'react-icons/fa';

const UserLogin = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { loginUser, registerUser, game, logoutGame } = useAuth();
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

        if (!isLogin && password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

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
        <div className="full-screen-center" style={{ background: 'linear-gradient(135deg, #1e1e2f 0%, #2a2a40 100%)' }}>
            <div className="glass-panel text-center animate-fade-in" style={{ padding: '3rem', maxWidth: '400px', width: '100%', border: '1px solid rgba(236, 72, 153, 0.5)' }}>
                <button onClick={logoutGame} style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <FaSignOutAlt /> Salir del Juego
                </button>
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
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Tu Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="glass-input"
                            required
                            style={{ width: '100%', paddingRight: '40px' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                            }}
                        >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>

                    {!isLogin && (
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Confirmar Contraseña"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="glass-input"
                                required
                                style={{ width: '100%', paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer'
                                }}
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    )}

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
