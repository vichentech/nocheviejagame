const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);
