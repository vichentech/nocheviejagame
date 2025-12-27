const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Challenge = require('../models/Challenge');

// @route   POST api/challenges
// @desc    Create a new challenge
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const newChallenge = new Challenge({
            ...req.body,
            uploaderId: req.user.id,
            gameId: req.user.gameId
        });
        const challenge = await newChallenge.save();
        res.json(challenge);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/challenges
// @desc    Get all challenges for the user's game
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const challenges = await Challenge.find({ gameId: req.user.gameId, uploaderId: req.user.id }).sort({ createdAt: -1 });
        res.json(challenges);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/challenges/:id
// @desc    Update a challenge
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        let challenge = await Challenge.findById(req.params.id);
        if (!challenge) return res.status(404).json({ msg: 'Challenge not found' });

        // Ensure user owns challenge or is admin (omitted distinct admin check for now, assuming owner)
        if (challenge.uploaderId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        challenge = await Challenge.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(challenge);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/challenges/:id
// @desc    Delete a challenge
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.id);
        if (!challenge) return res.status(404).json({ msg: 'Challenge not found' });

        if (challenge.uploaderId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await Challenge.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Challenge removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
