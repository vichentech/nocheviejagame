const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' }, // Null for superadmin
    role: { type: String, enum: ['admin', 'jugador', 'family_admin'], default: 'jugador' },
    canPlay: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Compound index to ensure unique usernames per game (optional, but good practice)
// userSchema.index({ username: 1, gameId: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
