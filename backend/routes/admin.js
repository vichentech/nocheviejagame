const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const Game = require('../models/Game');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Middleware to check if user is admin
const adminAuth = (req, res, next) => {
    // Admin login uses a special token payload: { user: { id: 'admin', role: 'admin' } }
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ msg: 'Access denied: Adsmin only' });
    }
};

// ==========================================
// GAMES MANAGEMENT
// ==========================================

// @route   GET api/admin/games
// @desc    Get all games
router.get('/games', [auth, adminAuth], async (req, res) => {
    try {
        const games = await Game.find().select('-passwordHash');
        res.json(games);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/admin/games/:id
// @desc    Update game name or password
router.put('/games/:id', [auth, adminAuth], async (req, res) => {
    const { name, password } = req.body;
    const gameFields = {};
    if (name) gameFields.name = name;

    try {
        if (password) {
            const salt = await bcrypt.genSalt(10);
            gameFields.passwordHash = await bcrypt.hash(password, salt);
        }

        let game = await Game.findByIdAndUpdate(
            req.params.id,
            { $set: gameFields },
            { new: true }
        ).select('-passwordHash');

        res.json(game);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/admin/games/:id
// @desc    Delete game and associated users/challenges?
router.delete('/games/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Game.findByIdAndDelete(req.params.id);
        // Optional: Cascade delete users and challenges
        await User.deleteMany({ gameId: req.params.id });
        await Challenge.deleteMany({ gameId: req.params.id });

        res.json({ msg: 'Game deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


// ==========================================
// USERS MANAGEMENT
// ==========================================

// @route   GET api/admin/games/:gameId/users
// @desc    Get users for a game
router.get('/games/:gameId/users', [auth, adminAuth], async (req, res) => {
    try {
        const users = await User.find({ gameId: req.params.gameId }).select('-passwordHash');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/admin/users/:id
// @desc    Update user
router.put('/users/:id', [auth, adminAuth], async (req, res) => {
    const { username, password } = req.body;
    const userFields = {};
    if (username) userFields.username = username;

    try {
        if (password) {
            const salt = await bcrypt.genSalt(10);
            userFields.passwordHash = await bcrypt.hash(password, salt);
        }

        let user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: userFields },
            { new: true }
        ).select('-passwordHash');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/admin/users/:id
// @desc    Delete user
router.delete('/users/:id', [auth, adminAuth], async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        // Optional: Delete user's challenges
        await Challenge.deleteMany({ uploaderId: req.params.id });
        res.json({ msg: 'User deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


// ==========================================
// CHALLENGES MANAGEMENT
// ==========================================

// @route   GET api/admin/users/:userId/challenges
// @desc    Get challenges for a user
router.get('/users/:userId/challenges', [auth, adminAuth], async (req, res) => {
    try {
        const challenges = await Challenge.find({ uploaderId: req.params.userId });
        res.json(challenges);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/admin/challenges/:id
// @desc    Update challenge
router.put('/challenges/:id', [auth, adminAuth], async (req, res) => {
    // Allow updating title, text, timeLimit, participants, objects, rules, etc.
    const { title, text, timeLimit, participants, objects, rules, notes, voiceConfig } = req.body;
    const challengeFields = { title, text, timeLimit, participants, objects, rules, notes, voiceConfig };

    // Remove undefined
    Object.keys(challengeFields).forEach(key => challengeFields[key] === undefined && delete challengeFields[key]);

    try {
        let challenge = await Challenge.findByIdAndUpdate(
            req.params.id,
            { $set: challengeFields },
            { new: true }
        );
        res.json(challenge);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/admin/challenges/:id
// @desc    Delete challenge
router.delete('/challenges/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Challenge.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Challenge deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
