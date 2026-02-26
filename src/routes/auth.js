const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { pool, logActivity } = require('../config/database');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password diperlukan' });
        }

        // Find admin by username
        const [admins] = await pool.execute(
            'SELECT * FROM admins WHERE username = ?',
            [username]
        );

        if (admins.length === 0) {
            await logActivity(username, 'LOGIN_FAIL', 'Admin tidak ditemukan', req.ip);
            return res.status(401).json({ error: 'Username atau Password Salah!' });
        }

        const admin = admins[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, admin.password_hash);

        if (!validPassword) {
            await logActivity(username, 'LOGIN_FAIL', 'Password salah', req.ip);
            return res.status(401).json({ error: 'Username atau Password Salah!' });
        }

        // Set session
        req.session.adminLoggedIn = true;
        req.session.adminId = admin.id;
        req.session.adminUsername = admin.username;
        req.session.adminRole = admin.role;
        req.session.adminCredits = admin.credits;

        await logActivity(admin.username, 'ADMIN_LOGIN', 'Admin Logged In', req.ip);

        res.json({
            success: true,
            message: 'Login berhasil',
            user: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                credits: admin.credits
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    const username = req.session?.adminUsername || 'Unknown';

    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// GET /api/auth/me - Get current user info
router.get('/me', (req, res) => {
    if (!req.session || !req.session.adminLoggedIn) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
        id: req.session.adminId,
        username: req.session.adminUsername,
        role: req.session.adminRole,
        credits: req.session.adminCredits
    });
});

module.exports = router;
