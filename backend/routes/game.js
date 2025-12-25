const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const Audio = require('../models/Audio');
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
// @desc    Get a random challenge + random victim user + user's music
// @access  Private
router.get('/random', auth, async (req, res) => {
    try {
        // 1. Get all users in the game
        const users = await User.find({ gameId: req.user.gameId });
        if (users.length === 0) return res.status(400).json({ msg: 'No users found in this game' });

        // 2. Pick a random "Victim" User
        const randomUser = users[Math.floor(Math.random() * users.length)];

        // 3. Find if this user has uploaded any audio (Music)
        // Ideally we'd have a specific "User Theme Song", but random upload works for now or "Last Uploaded".
        // Let's pick a random audio uploaded by this user.
        const userAudios = await Audio.find({ uploaderId: randomUser._id });
        let userMusic = null;
        if (userAudios.length > 0) {
            userMusic = userAudios[Math.floor(Math.random() * userAudios.length)];
        }
        // If no music, maybe fallback to game default? For now, null.

        // 4. Find challenges. Requirement says "Plays user's uploaded music and one of their challenges".
        // So we should prioritize challenges created by this user.
        let challenges = await Challenge.find({ uploaderId: randomUser._id, gameId: req.user.gameId }).populate('soundId');

        let selectedChallenge = null;

        if (challenges.length === 0) {
            // Fallback: If victim has no challenges, pick a random challenge from the game?
            // Or pick another user?
            // Let's pick a random challenge from ANYONE in the game.
            const anyChallenge = await Challenge.aggregate([
                { $match: { gameId: new mongoose.Types.ObjectId(req.user.gameId) } },
                { $sample: { size: 1 } }
            ]);
            if (anyChallenge.length > 0) {
                // We need to verify if the aggregate result needs population logic manually or simple fetch
                // Aggregate returns plain objects.
                selectedChallenge = anyChallenge[0];
                // Manually populate soundId if needed, though simple objects usually contain the ID. 
                // If frontend needs full sound obj, we might need to fetch it.
                // Let's re-fetch as Mongoose doc for consistency.
                selectedChallenge = await Challenge.findById(selectedChallenge._id).populate('soundId');
            }
        } else {
            selectedChallenge = challenges[Math.floor(Math.random() * challenges.length)];
        }

        if (!selectedChallenge) {
            return res.status(400).json({ msg: 'No challenges available in this game' });
        }

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

module.exports = router;
