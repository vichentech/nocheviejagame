const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    text: { type: String, required: true },
    voiceConfig: { type: String, default: 'default' }, // ID or name of the voice
    participants: { type: Number, default: 1 },
    timeLimit: { type: Number, default: 60 }, // in seconds
    objects: { type: String },
    description: { type: String },
    soundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Audio' }, // Optional linked audio
    rules: { type: String },
    notes: { type: String },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Challenge', challengeSchema);
