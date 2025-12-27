const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    text: { type: String, required: true },
    voiceConfig: {
        name: { type: String, default: 'default' },
        rate: { type: Number, default: 1.0 },
        pitch: { type: Number, default: 1.0 }
    },
    participants: { type: Number, default: 1 },
    timeLimit: { type: Number, default: 60 }, // in seconds
    durationLimit: { type: Number, default: 1 }, // in number of tests (if type is 'multiChallenge')
    durationType: { type: String, default: 'fixed' }, // 'fixed', 'untilNext', 'multiChallenge'
    objects: { type: String },
    description: { type: String },
    soundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Audio' }, // Optional linked audio
    rules: { type: String },
    notes: { type: String },
    punishment: { type: String }, // New field for punishment text
    playerConfig: {
        targetType: { type: String, default: 'all' }, // 'all', 'odd', 'even', 'specific', 'custom', 'random'
        grouping: { type: String, default: 'individual' }, // 'individual', 'pairs', 'trios'
        position: { type: String, default: 'none' }, // 'none', 'next', 'opposite', 'left', 'right', 'forward'
        positionOffset: { type: Number, default: 0 }, // For 'forward' (X positions ahead)
        ageRange: { type: String }, // 'all', 'adults', 'kids'
        customText: { type: String } // TextArea content
    },
    multimedia: {
        image: { url: String, filename: String },
        audio: { url: String, filename: String },
        video: { url: String, filename: String },
        document: { url: String, filename: String }
    },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Challenge', challengeSchema);
