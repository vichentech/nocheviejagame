const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const Game = require('../models/Game');

const BASE_URL = 'http://localhost:5000/api';

async function verify() {
    console.log('--- STARTING FAMILY ADMIN VERIFICATION ---');

    // 1. Register New Game
    const gameName = `TestFamily_${Date.now()}`;
    const password = 'pass';
    let gameId;

    try {
        const res = await axios.post(`${BASE_URL}/auth/game/register`, { name: gameName, password });
        gameId = res.data.gameId;
        console.log(`[PASS] Game Registered: ${gameName}`);
    } catch (e) { console.error('[FAIL] Game Register', e.response?.data); return; }

    // 2. Register First User (Should be Family Admin)
    let token1;
    let user1Id;
    try {
        const res = await axios.post(`${BASE_URL}/auth/user/register`, { username: 'AdminUser', password: '123', gameId });
        token1 = res.data.token;
        user1Id = res.data.user.id;
        if (res.data.user.role === 'family_admin') {
            console.log(`[PASS] First User is Family Admin`);
        } else {
            console.error(`[FAIL] First User role is ${res.data.user.role}, expected 'family_admin'`);
        }
    } catch (e) { console.error('[FAIL] User 1 Register', e.response?.data); return; }

    // 3. Register Second User (Should be Normal User)
    let token2;
    let user2Id;
    try {
        const res = await axios.post(`${BASE_URL}/auth/user/register`, { username: 'NormalUser', password: '123', gameId });
        token2 = res.data.token;
        user2Id = res.data.user.id;
        if (res.data.user.role === 'user') {
            console.log(`[PASS] Second User is Normal User`);
        } else {
            console.error(`[FAIL] Second User role is ${res.data.user.role}, expected 'user'`);
        }
    } catch (e) { console.error('[FAIL] User 2 Register', e.response?.data); return; }

    // 4. Test Permissions: User 2 tries to list users (Should Fail)
    try {
        await axios.get(`${BASE_URL}/family/users`, { headers: { 'x-auth-token': token2 } });
        console.error('[FAIL] Normal User WAS able to list family users (Should be forbidden)');
    } catch (e) {
        if (e.response?.status === 403) console.log('[PASS] Normal User correctly denied access to family users');
        else console.error('[FAIL] Unexpected error for User 2 listing', e.response?.status);
    }

    // 5. Test Permissions: User 1 lists users (Should Pass)
    try {
        const res = await axios.get(`${BASE_URL}/family/users`, { headers: { 'x-auth-token': token1 } });
        if (res.data.length === 2) console.log('[PASS] Admin User listed 2 users');
        else console.error('[FAIL] Admin User listed wrong count:', res.data.length);
    } catch (e) { console.error('[FAIL] Admin User list failed', e.response?.data); }

    // 6. Test Permissions: User 1 deletes User 2 (Should Pass)
    try {
        await axios.delete(`${BASE_URL}/family/users/${user2Id}`, { headers: { 'x-auth-token': token1 } });
        console.log('[PASS] Admin User deleted Normal User');
    } catch (e) { console.error('[FAIL] Admin delete user failed', e.response?.data); }

    console.log('--- VERIFICATION COMPLETE ---');
}

verify();
