const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:8080'],
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authRoutes = require('./routes/auth');
const challengeRoutes = require('./routes/challenges');
const audioRoutes = require('./routes/audio');
const gameRoutes = require('./routes/game');
const User = require('./models/User'); // For seeding
const bcrypt = require('bcryptjs');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/family', require('./routes/family'));

// Database Connection & Seeding
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(async () => {
        console.log('MongoDB connected');

        // Seed Admin
        try {
            const adminUser = await User.findOne({ username: process.env.ADMIN_USER });
            if (!adminUser) {
                console.log('Seeding Admin User...');
                // In a real app, Admin might not need gameId or handled differently. 
                // Here assuming Admin is a special User without GameId or special GameId.
                // Our User model has gameId optional ref.
                // But Auth middleware might expect a user to exist. 
                // Admin logic in routes/auth.js handles admin login separately without DB user if we want, 
                // BUT requirements say "Un usuario administrador 'hardcodeado', user: 'vichen', password: 'vichen'".
                // And "Acceso Total". 
                // Let's rely on the hardcoded check in /auth/admin/login for simplicity as implemented.
                // However, if we want the admin to 'act' as a user in some DB contexts, we might need a dummy.
                // The Auth route `router.post('/admin/login')` handles it purely via ENV.
                // So we technically don't need to seed a User document unless we want to managing things via standard CRUD that requires User ID.
                // Let's stick to the Env based auth for Admin as implemented in auth.js.
                console.log('Admin Access Configured via ENV');
            }
        } catch (e) {
            console.error("Seeding error", e);
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
