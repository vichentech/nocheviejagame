const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    playedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    playedChallenges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' }],
    usedRandomNumbers: [{ type: Number }], // Field to track used random numbers
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // The Family Admin
});

module.exports = mongoose.model('Game', gameSchema);
