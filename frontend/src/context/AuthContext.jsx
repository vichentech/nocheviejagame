import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [game, setGame] = useState(null); // { id, name }
    const [token, setToken] = useState(sessionStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const fetchGameData = async () => {
        try {
            const res = await axios.get('/api/game/current');
            setGame(res.data);
            sessionStorage.setItem('gameInfo', JSON.stringify({ id: res.data._id, name: res.data.name })); // Keep basic info in session defaults
        } catch (err) {
            console.error("Error fetching game data", err);
        }
    };

    // Initial auth check
    useEffect(() => {
        const checkAuth = async () => {
            const storedGame = JSON.parse(sessionStorage.getItem('gameInfo'));
            if (storedGame) {
                setGame(storedGame);
            }

            if (token) {
                axios.defaults.headers.common['x-auth-token'] = token;
                if (storedGame) {
                    try {
                        const res = await axios.get('/api/auth/me');
                        const userData = res.data;
                        if (!userData.id && userData._id) userData.id = userData._id;
                        setUser(userData);

                        // Valid Token & Game -> Fetch Full Game Config
                        fetchGameData();

                    } catch (err) {
                        // If token invalid, clear it
                        console.error("Token verification failed", err);
                        logoutGame(); // Use logoutGame to be safe, or just clear user?
                        // If we use logoutGame it clears game too, which might be annoying if just user token expired.
                        // But if token is invalid, better start fresh.
                    }
                } else {
                    // Maybe it's admin?
                    try {
                        // Admin logic might be different if they don't have gameInfo
                        const decoded = JSON.parse(atob(token.split('.')[1]));
                        if (decoded.user.role === 'admin') {
                            setUser({ id: 'admin', role: 'admin', username: 'vichen' });
                        }
                    } catch (e) { logoutGame(); }
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, [token]);

    const loginGame = async (name, password) => {
        const res = await axios.post('/api/auth/game/login', { name, password });
        // Game login only gives access to enter the game portal, doesn't give a USER token yet unless we treat 'game' as a user which we don't.
        // Wait, the requirement says "Una vez dentro del juego elegido... Pantalla de selección o creación de usuario".
        // So 'logging in to game' just stores the game ID locally to allow user-login calls.
        setGame({ id: res.data.gameId, name });
        sessionStorage.setItem('gameInfo', JSON.stringify({ id: res.data.gameId, name }));
        return res.data;
    };

    const registerGame = async (name, password) => {
        const res = await axios.post('/api/auth/game/register', { name, password });
        return res.data;
    };

    const loginAdmin = async (username, password) => {
        const res = await axios.post('/api/auth/admin/login', { username, password });
        sessionStorage.setItem('token', res.data.token);
        setToken(res.data.token);
        // Admin user object construction 
        setUser({ id: 'admin', role: 'admin', username: 'vichen' });
        axios.defaults.headers.common['x-auth-token'] = res.data.token;
    };

    const loginUser = async (username, password) => {
        if (!game) throw new Error("No game selected");
        const res = await axios.post('/api/auth/user/login', { username, password, gameId: game.id });
        sessionStorage.setItem('token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        axios.defaults.headers.common['x-auth-token'] = res.data.token;
    };

    const registerUser = async (username, password) => {
        if (!game) throw new Error("No game selected");
        const res = await axios.post('/api/auth/user/register', { username, password, gameId: game.id });
        sessionStorage.setItem('token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        axios.defaults.headers.common['x-auth-token'] = res.data.token;
    };

    const logoutGame = () => {
        sessionStorage.removeItem('token');
        setToken(null);
        setUser(null);
        sessionStorage.removeItem('gameInfo');
        setGame(null);
        delete axios.defaults.headers.common['x-auth-token'];
    };

    const logoutUser = () => {
        sessionStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['x-auth-token'];
        // Ensure game is not null, restore from storage if needed (unlikely but safe)
        const storedGame = JSON.parse(sessionStorage.getItem('gameInfo'));
        if (!game && storedGame) {
            setGame(storedGame);
        }
    };

    return (
        <AuthContext.Provider value={{ user, game, loginGame, registerGame, loginUser, registerUser, loginAdmin, logoutGame, logoutUser, loading, fetchGameData }}>
            {children}
        </AuthContext.Provider>
    );
};
