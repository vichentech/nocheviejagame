const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const Audio = require('../models/Audio');
const Game = require('../models/Game');
const mongoose = require('mongoose');

// @route   GET api/game/current
// @desc    Get current game details (including config)
// @access  Private
router.get('/current', auth, async (req, res) => {
    try {
        const game = await Game.findById(req.user.gameId).select('-passwordHash');
        if (!game) return res.status(404).json({ msg: 'Game not found' });
        res.json(game);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/game/users
// @desc    Get all users in the game with their challenge count
// @access  Private
router.get('/users', auth, async (req, res) => {
    try {
        const users = await User.find({ gameId: req.user.gameId }).select('username _id');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/game/user-challenges/:userId
// @desc    Get all challenges for a specific user
// @access  Private
router.get('/user-challenges/:userId', auth, async (req, res) => {
    try {
        const challenges = await Challenge.find({
            uploaderId: req.params.userId,
            gameId: req.user.gameId
        }).populate('soundId');
        res.json(challenges);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/game/data/:challengeId
// @desc    Get full game data (victim + music + challenge) by challenge ID
// @access  Private
router.get('/data/:challengeId', auth, async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.challengeId).populate('soundId');
        if (!challenge) return res.status(404).json({ msg: 'Challenge not found' });

        const user = await User.findById(challenge.uploaderId);

        // Find music
        const userAudios = await Audio.find({ uploaderId: user._id });
        let userMusic = null;
        if (userAudios.length > 0) {
            userMusic = userAudios[Math.floor(Math.random() * userAudios.length)];
        }

        res.json({
            challenge: challenge,
            victim: {
                username: user.username,
                _id: user._id
            },
            music: userMusic
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/game/random
// @desc    Get a random challenge + random victim user + user's music with HISTORY logic
// @access  Private
router.get('/random', auth, async (req, res) => {
    let retries = 3;
    while (retries > 0) {
        try {
            const gameId = req.user.gameId;
            const game = await Game.findById(gameId);

            if (!game) {
                return res.status(404).json({ msg: 'Game not found' });
            }

            // Initialize arrays if missing (defensive programming)
            if (!game.playedUsers) game.playedUsers = [];
            if (!game.playedChallenges) game.playedChallenges = [];

            // 1. Get all users in the game
            const users = await User.find({ gameId: gameId });
            if (users.length === 0) return res.status(400).json({ msg: 'No users found in this game' });

            // Helper for string comparison (safe map with null checks)
            // We use default empty array if somehow property is missing still
            const playedUserIds = (game.playedUsers || [])
                .filter(id => id) // remove potential nulls
                .map(id => id.toString());

            const playedChallengeIds = (game.playedChallenges || [])
                .filter(id => id) // remove potential nulls
                .map(id => id.toString());

            // 2. Filter Available Users (Users NOT in playedUsers)
            let availableUsers = users.filter(u => u._id && !playedUserIds.includes(u._id.toString()));

            // If all users played, reset user history
            if (availableUsers.length === 0) {
                game.playedUsers = [];
                availableUsers = users;
            }

            if (availableUsers.length === 0) {
                return res.status(500).json({ msg: 'No available users found (unexpected state)' });
            }

            // 3. Pick a random "Victim" User from available
            const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];

            // 5. Find if this user has uploaded any audio (Music)
            const userAudios = await Audio.find({ uploaderId: randomUser._id });
            let userMusic = null;
            if (userAudios.length > 0) {
                userMusic = userAudios[Math.floor(Math.random() * userAudios.length)];
            }

            // 6. Find challenges for this user.
            let allUserChallenges = await Challenge.find({ uploaderId: randomUser._id, gameId: gameId }).populate('soundId');

            // Filter out played challenges globally
            let availableChallenges = allUserChallenges.filter(c => c._id && !playedChallengeIds.includes(c._id.toString()));

            // If NO available challenges for this user (they played all theirs), reset THEIR challenges
            if (availableChallenges.length === 0 && allUserChallenges.length > 0) {
                const userChallengeIds = allUserChallenges.map(c => c._id.toString());
                // Clear from history: filter out any ID that belongs to this user
                game.playedChallenges = game.playedChallenges.filter(id => id && !userChallengeIds.includes(id.toString()));

                // Available is now all of them
                availableChallenges = allUserChallenges;
            }

            let selectedChallenge = null;
            if (availableChallenges.length > 0) {
                selectedChallenge = availableChallenges[Math.floor(Math.random() * availableChallenges.length)];
            }

            if (!selectedChallenge) {
                return res.status(400).json({ msg: `No challenges available for user ${randomUser.username}` });
            }

            // 7. Final Save of History

            // Push randomUser if not already there 
            const currentPlayedUsersStr = game.playedUsers.map(id => id ? id.toString() : '');
            if (!currentPlayedUsersStr.includes(randomUser._id.toString())) {
                game.playedUsers.push(randomUser._id);
            }

            // Push selectedChallenge
            game.playedChallenges.push(selectedChallenge._id);

            await game.save();

            return res.json({
                challenge: selectedChallenge,
                victim: {
                    username: randomUser.username,
                    _id: randomUser._id
                },
                music: userMusic
            });

        } catch (err) {
            // Check for VersionError
            if (err.name === 'VersionError') {
                console.warn(`VersionError in game/random caused retry. Retries left: ${retries - 1}`);
                retries--;
                if (retries === 0) {
                    return res.status(500).json({ msg: 'Database concurrency error (VersionError)', error: err.message });
                }
                continue; // Retry loop
            }

            console.error("Error in game/random:", err);
            return res.status(500).json({ msg: 'Server error', error: err.message, stack: err.stack });
        }
    }
});

// @route   GET api/game/used-random-numbers
// @desc    Get used random numbers
// @access  Private
router.get('/used-random-numbers', auth, async (req, res) => {
    try {
        const game = await Game.findById(req.user.gameId);
        res.json({ usedRandomNumbers: game.usedRandomNumbers || [] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/game/record-random-numbers
// @desc    Record generated random numbers as used
// @access  Private
router.post('/record-random-numbers', auth, async (req, res) => {
    try {
        const { numbers, resetRangeMax } = req.body;
        const game = await Game.findById(req.user.gameId);

        if (!game.usedRandomNumbers) game.usedRandomNumbers = [];

        // If resetRangeMax is provided, we clear numbers <= resetRangeMax before adding new ones
        if (resetRangeMax) {
            game.usedRandomNumbers = game.usedRandomNumbers.filter(n => n > resetRangeMax);
        }

        // Add unique numbers
        const newNumbers = numbers.filter(n => !game.usedRandomNumbers.includes(n));
        game.usedRandomNumbers = [...game.usedRandomNumbers, ...newNumbers];

        await game.save();
        res.json({ usedRandomNumbers: game.usedRandomNumbers });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
