import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [game, setGame] = useState(null); // { id, name }
    const [token, setToken] = useState(sessionStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Initial auth check
    useEffect(() => {
        const checkAuth = async () => {
            // In a real app we'd validate token with backend /me endpoint. 
            // Here we rely on decode or just presence and handling 401s later.
            // For simplicity, if token exists, we decode it or trust it until 401.
            // We also need game info. Ideally stored in sessionStorage too?
            const storedGame = JSON.parse(sessionStorage.getItem('gameInfo'));
            if (token && storedGame) {
                setUser({ ...JSON.parse(atob(token.split('.')[1])).user }); // Simple decode
                setGame(storedGame);
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

    const logout = () => {
        sessionStorage.removeItem('token');
        setToken(null);
        setUser(null);
        // Do we keep game? Requirement says "First page to create or access game".
        // Maybe logout clears everything.
        sessionStorage.removeItem('gameInfo');
        setGame(null);
        delete axios.defaults.headers.common['x-auth-token'];
    };

    return (
        <AuthContext.Provider value={{ user, game, loginGame, registerGame, loginUser, registerUser, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
