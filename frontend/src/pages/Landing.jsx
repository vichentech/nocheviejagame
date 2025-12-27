import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaPlay, FaGamepad, FaEye, FaEyeSlash, FaQuestionCircle, FaUserShield, FaMusic, FaListUl, FaUsers } from 'react-icons/fa';
import Modal from '../components/Modal';

const Landing = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const { loginGame, registerGame, loginAdmin } = useAuth();
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
                if (name === 'vichen' && password === 'vichen') {
                    await loginAdmin(name, password);
                    navigate('/admin');
                    return;
                }
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
            <Modal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                title="¿Cómo funciona el juego?"
                type="custom"
            >
                <div style={{ textAlign: 'left', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '15px', color: 'var(--text-main)' }}>
                    <section>
                        <h4 style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaGamepad /> 1. Crear el Juego
                        </h4>
                        <p style={{ marginTop: '5px' }}>Un miembro de la familia debe pulsar en <strong>"Crear Juego"</strong>, elegir un nombre para el grupo y una contraseña. Comparte estos datos con los demás.</p>
                    </section>

                    <section>
                        <h4 style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaUsers /> 2. Unirse y Prepararse
                        </h4>
                        <p style={{ marginTop: '5px' }}>Cada jugador entra en el juego de la familia y se registra con su nombre. Dentro del panel, cada uno debe:</p>
                        <ul style={{ paddingLeft: '20px', marginTop: '5px', listStyleType: 'disc' }}>
                            <li>Subir su <strong>"Himno"</strong> (pestaña Música): Un audio que sonará para anunciar que es su turno.</li>
                            <li>Crear sus <strong>Pruebas</strong>: Retos para los demás. <em>Nota: Ni el admin ni los otros jugadores pueden ver tus pruebas hasta que salgan en el juego.</em></li>
                        </ul>
                    </section>

                    <section>
                        <h4 style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaUserShield /> 3. El Administrador
                        </h4>
                        <p style={{ marginTop: '5px' }}><strong>El primer jugador</strong> que se registre será el <strong>Admin de Familia</strong>. Funciones especiales:</p>
                        <ul style={{ paddingLeft: '20px', marginTop: '5px', listStyleType: 'disc' }}>
                            <li>Gestionar usuarios y activar la partida.</li>
                            <li><strong>Modo Manual</strong>: Solo el admin puede jugar en modo manual para elegir pruebas específicas de jugadores.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaPlay /> 4. ¡A Jugar!
                        </h4>
                        <p style={{ marginTop: '5px' }}>Una vez todos tengan sus pruebas y música listas, el Admin pulsa <strong>"Jugar"</strong>. El sistema elegirá un "proponente" al azar, sonará su música y se leerá su reto por el altavoz.</p>
                    </section>
                </div>
                <button className="btn-primary" onClick={() => setShowHelp(false)} style={{ width: '100%', marginTop: '20px' }}>¡Entendido!</button>
            </Modal>

            <div className="glass-panel text-center floating-card" style={{ padding: '2rem 1.5rem', maxWidth: '400px', width: '100%', position: 'relative' }}>
                <button
                    onClick={() => setShowHelp(true)}
                    style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--secondary)',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        zIndex: 10
                    }}
                    title="Ayuda / Instrucciones"
                >
                    <FaQuestionCircle />
                </button>

                <h1 style={{ marginBottom: '1.5rem', fontSize: '2rem', background: 'linear-gradient(to right, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1.2' }}>
                    Cena de Nochevieja GAME
                </h1>

                <div style={{ marginBottom: '2rem', display: 'flex', gap: '10px' }}>
                    <button
                        className={`btn-secondary ${isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(true)}
                        style={{ flex: 1, background: isLogin ? 'rgba(236, 72, 153, 0.2)' : 'transparent', fontSize: '0.9rem' }}
                    >
                        Entrar
                    </button>
                    <button
                        className={`btn-secondary ${!isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(false)}
                        style={{ flex: 1, background: !isLogin ? 'rgba(236, 72, 153, 0.2)' : 'transparent', fontSize: '0.9rem' }}
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
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Contraseña"
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
                            id="rememberMe"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            style={{ accentColor: 'var(--secondary)', width: '16px', height: '16px' }}
                        />
                        <label htmlFor="rememberMe" style={{ cursor: 'pointer' }}>Recordar mi acceso</label>
                    </div>

                    {error && <p style={{ color: '#ef4444', marginTop: '0.5rem' }}>{error}</p>}

                    <button type="submit" className="btn-primary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        {isLogin ? <><FaPlay /> Entrar</> : <><FaGamepad /> Crear</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Landing;
