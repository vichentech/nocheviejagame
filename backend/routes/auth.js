const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Game = require('../models/Game');
const User = require('../models/User');

// @route   POST api/auth/game/register
// @desc    Register a new game (Family)
// @access  Public (or Admin only later)
router.post('/game/register', async (req, res) => {
    const { name, password } = req.body;
    try {
        let game = await Game.findOne({ name });
        if (game) return res.status(400).json({ msg: 'Game name already exists' });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        game = new Game({ name, passwordHash });
        await game.save();

        res.json({ msg: 'Game registered successfully', gameId: game._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/game/login
// @desc    Login to a game
// @access  Public
router.post('/game/login', async (req, res) => {
    const { name, password } = req.body;
    try {
        const game = await Game.findOne({ name });
        if (!game) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, game.passwordHash);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        res.json({ msg: 'Game access granted', gameId: game._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/user/register
// @desc    Register a user for a game
// @access  Public (Requires Game Access technically, but simplified)
router.post('/user/register', async (req, res) => {
    const { username, password, gameId } = req.body;
    try {
        // Check if user exists in this game
        let user = await User.findOne({ username, gameId });
        if (user) return res.status(400).json({ msg: 'User already exists in this game' });

        // Check if this is the FIRST user in the game
        const userCount = await User.countDocuments({ gameId });
        const role = userCount === 0 ? 'family_admin' : 'jugador';

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        user = new User({ username, passwordHash, gameId, role, canPlay: role === 'family_admin' });
        await user.save();

        // If family admin, update the game
        if (role === 'family_admin') {
            await Game.findByIdAndUpdate(gameId, { adminUserId: user._id });
        }

        const payload = { user: { id: user.id, username: user.username, role: user.role, gameId: user.gameId, canPlay: user.canPlay } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '365d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, username: user.username, role: user.role, canPlay: user.canPlay } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/user/login
// @desc    Login user
// @access  Public
router.post('/user/login', async (req, res) => {
    const { username, password, gameId } = req.body;
    try {
        const user = await User.findOne({ username, gameId });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        const payload = { user: { id: user.id, username: user.username, role: user.role, gameId: user.gameId, canPlay: user.canPlay } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '365d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, username: user.username, role: user.role, canPlay: user.canPlay } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/admin/login
// @desc    Superadmin login
router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        const payload = { user: { id: 'admin', role: 'admin' } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } else {
        res.status(400).json({ msg: 'Invalid Admin Credentials' });
    }
});

// @route   GET api/auth/me
// @desc    Get current user (for refreshing state)
router.get('/me', require('../middleware/auth'), async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            return res.json({ id: 'admin', role: 'admin' });
        }
        const user = await User.findById(req.user.id).select('-passwordHash');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
