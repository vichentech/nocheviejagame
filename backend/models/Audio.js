const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    path: { type: String, required: true },
    originalName: { type: String, required: true },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Audio', audioSchema);
