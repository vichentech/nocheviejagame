const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const Audio = require('../models/Audio');
const Game = require('../models/Game');
const mongoose = require('mongoose');

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
    try {
        const gameId = req.user.gameId;
        const game = await Game.findById(gameId);

        // 1. Get all users in the game
        const users = await User.find({ gameId: gameId });
        if (users.length === 0) return res.status(400).json({ msg: 'No users found in this game' });

        // 2. Filter Available Users (Users NOT in playedUsers)
        let availableUsers = users.filter(u => !game.playedUsers.includes(u._id));

        // If all users played, reset user history
        if (availableUsers.length === 0) {
            game.playedUsers = [];
            availableUsers = users;
            await game.save();
            // We save eagerly to ensure consistency if concurrent requests happen, though simplistic here.
        }

        // 3. Pick a random "Victim" User from available
        const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];

        // 4. Update Game History - playedUsers
        // We push this user to playedUsers. BUT we only save at the end to be atomic-ish or save now?
        // Let's save now to "lock" this user order? Actually, we save at the very end when everything is successful.

        // 5. Find if this user has uploaded any audio (Music)
        const userAudios = await Audio.find({ uploaderId: randomUser._id });
        let userMusic = null;
        if (userAudios.length > 0) {
            userMusic = userAudios[Math.floor(Math.random() * userAudios.length)];
        }

        // 6. Find challenges for this user.
        // We need to prioritize challenges created by this user NOT in playedChallenges.
        let allUserChallenges = await Challenge.find({ uploaderId: randomUser._id, gameId: gameId }).populate('soundId');

        // Filter out played challenges globally
        let availableChallenges = allUserChallenges.filter(c => !game.playedChallenges.includes(c._id));

        // If NO available challenges for this user (they played all theirs), reset THEIR challenges?
        // Requirement: "No se deben repetir hasta que no se seleccionen todas las de ese jugador"
        // This means if we run out, we should clear the playedChallenges that belong to THIS user.
        if (availableChallenges.length === 0 && allUserChallenges.length > 0) {
            // Find IDs of this user's challenges
            const userChallengeIds = allUserChallenges.map(c => c._id.toString());

            // Remove them from game.playedChallenges
            game.playedChallenges = game.playedChallenges.filter(id => !userChallengeIds.includes(id.toString()));

            // Now all are available again
            availableChallenges = allUserChallenges;
        }

        let selectedChallenge = null;

        if (availableChallenges.length > 0) {
            selectedChallenge = availableChallenges[Math.floor(Math.random() * availableChallenges.length)];
        }

        if (!selectedChallenge) {
            return res.status(400).json({ msg: 'No challenges available in this game' });
        }

        // 7. Final Save of History
        // Add randomUser to playedUsers
        // Add selectedChallenge to playedChallenges
        // Note: We need to be careful not to duplicate if we reset.

        // Re-read game state or just push? Since we might have modified it in memory (reset logic).
        // We push only if not present (although logical flow ensures uniqueness per cycle).

        if (!game.playedUsers.includes(randomUser._id)) {
            game.playedUsers.push(randomUser._id);
        }

        // Only push challenge if we selected one from the specific user pool. 
        // If we picked a random global fallback, do we track it? Ideally yes.
        game.playedChallenges.push(selectedChallenge._id);

        await game.save();

        // Return composite object
        res.json({
            challenge: selectedChallenge,
            victim: {
                username: randomUser.username,
                _id: randomUser._id
            },
            music: userMusic
        });

    } catch (err) {
        console.error("Error in game/random:", err.message);
        res.status(500).send('Server error');
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
