const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Game = require('../models/Game');
const Challenge = require('../models/Challenge');
const bcrypt = require('bcryptjs');

// Middleware to check if user is Family Admin
const familyAdminAuth = (req, res, next) => {
    if (req.user.role !== 'family_admin') {
        return res.status(403).json({ msg: 'Access denied. Family Admin only.' });
    }
    next();
};

// @route   GET /api/family/users
// @desc    Get all users in my family/game
router.get('/users', [auth, familyAdminAuth], async (req, res) => {
    try {
        const users = await User.find({ gameId: req.user.gameId }).select('-passwordHash');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/family/users/:id
// @desc    Delete a user from my family
router.delete('/users/:id', [auth, familyAdminAuth], async (req, res) => {
    try {
        const userToDelete = await User.findById(req.params.id);
        if (!userToDelete) return res.status(404).json({ msg: 'User not found' });

        // Security check: Must belong to same game
        if (userToDelete.gameId.toString() !== req.user.gameId) {
            return res.status(403).json({ msg: 'Unauthorized to delete user from another game' });
        }

        // Prevent self-deletion via this route (optional, but good safety)
        if (userToDelete._id.toString() === req.user.id) {
            return res.status(400).json({ msg: 'Cannot delete yourself here. Delete the game instead?' });
        }

        await User.findByIdAndDelete(req.params.id);
        await Challenge.deleteMany({ uploaderId: req.params.id });

        res.json({ msg: 'User and their challenges deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT /api/family/users/:id/permissions
// @desc    Update user permissions (Enable/Disable Play)
router.put('/users/:id/permissions', [auth, familyAdminAuth], async (req, res) => {
    try {
        const { canPlay } = req.body;

        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ msg: 'User not found' });

        if (userToUpdate.gameId.toString() !== req.user.gameId) {
            return res.status(403).json({ msg: 'Unauthorized' });
        }

        userToUpdate.canPlay = canPlay;
        await userToUpdate.save();

        res.json(userToUpdate);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT /api/family/game
// @desc    Update my game (Name, Password, Config)
router.put('/game', [auth, familyAdminAuth], async (req, res) => {
    const { name, password, minTime, maxTime, defaultParticipants } = req.body;
    try {
        const game = await Game.findById(req.user.gameId);
        if (!game) return res.status(404).json({ msg: 'Game not found' });

        if (name) game.name = name;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            game.passwordHash = await bcrypt.hash(password, salt);
        }

        // Update Config
        if (!game.config) game.config = {};
        if (minTime !== undefined) game.config.minTime = parseInt(minTime);
        if (maxTime !== undefined) game.config.maxTime = parseInt(maxTime);
        if (defaultParticipants !== undefined) game.config.defaultParticipants = parseInt(defaultParticipants);

        await game.save();
        res.json({ msg: 'Game updated successfully', game });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/family/game
// @desc    Delete my entire game (IRREVERSIBLE)
router.delete('/game', [auth, familyAdminAuth], async (req, res) => {
    try {
        const gameId = req.user.gameId;

        // Delete Game
        await Game.findByIdAndDelete(gameId);

        // Delete Users
        await User.deleteMany({ gameId: gameId });

        // Delete Challenges
        await Challenge.deleteMany({ gameId: gameId });

        res.json({ msg: 'Game deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
