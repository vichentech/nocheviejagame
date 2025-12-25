const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Audio = require('../models/Audio');

// Multer Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});

const upload = multer({ storage: storage });

// @route   POST api/audio
// @desc    Upload an audio file
// @access  Private
router.post('/', [auth, upload.single('file')], async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        const newAudio = new Audio({
            filename: req.file.filename,
            path: req.file.path,
            originalName: req.file.originalname,
            uploaderId: req.user.id,
            gameId: req.user.gameId
        });

        const audio = await newAudio.save();
        res.json(audio);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/audio
// @desc    Get all audio files for the game
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const audios = await Audio.find({ gameId: req.user.gameId }).sort({ createdAt: -1 });
        res.json(audios);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/audio/:id
// @desc    Delete audio
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const audio = await Audio.findById(req.params.id);
        if (!audio) return res.status(404).json({ msg: 'Audio not found' });

        if (audio.uploaderId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Delete file from filesystem
        fs.unlink(audio.path, (err) => {
            if (err) console.error("Failed to delete local file:", err);
        });

        await Audio.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Audio removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
