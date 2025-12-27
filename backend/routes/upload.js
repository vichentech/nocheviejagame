const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
        // Sanitize filename to remove weird characters
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, `media-${Date.now()}-${safeName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB global max (refined in handler)
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|mp3|mpeg|wav|mp4|webm|ogg|pdf|txt|msword|vnd.openxmlformats-officedocument.wordprocessingml.document/;
        const extensionMatch = /pdf|txt|doc|docx/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = extensionMatch.test(path.extname(file.originalname).toLowerCase());

        // Allow audio/mpeg and documents explicitly
        if (file.mimetype === 'audio/mpeg' || mimetype || extname) {
            return cb(null, true);
        }

        console.log(`Upload Rejected: ${file.originalname} - Mime: ${file.mimetype}`);
        cb(new Error('Formato de archivo no soportado.'));
    }
});

// @route   POST api/upload
// @desc    Upload a generic file
// @access  Private
router.post('/', [auth, upload.single('file')], (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        const fileSize = req.file.size;
        const mime = req.file.mimetype;
        let limit = 50 * 1024 * 1024; // Default/Max (Video)

        if (mime.startsWith('image/')) {
            limit = 8 * 1024 * 1024; // 8MB
            if (fileSize > limit) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ msg: 'La imagen supera el límite de 8MB.' });
            }
        } else if (mime.startsWith('audio/') || mime === 'audio/mpeg') {
            limit = 15 * 1024 * 1024; // 15MB
            if (fileSize > limit) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ msg: 'El audio supera el límite de 15MB.' });
            }
        } else if (mime.startsWith('video/')) {
            limit = 50 * 1024 * 1024; // 50MB
            if (fileSize > limit) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ msg: 'El video supera el límite de 50MB.' });
            }
        } else {
            // Document or other
            limit = 10 * 1024 * 1024; // 10MB
            if (fileSize > limit) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ msg: 'El documento supera el límite de 10MB.' });
            }
        }

        res.json({
            filename: req.file.filename,
            path: req.file.path,
            originalName: req.file.originalname,
            url: `/uploads/${req.file.filename}`
        });

    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
