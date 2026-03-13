const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { requireAdmin } = require('../../middleware/auth');

router.use(requireAdmin);

// GET /api/admin/settings
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM settings WHERE id = 1');
        if (rows.length === 0) {
            return res.json({});
        }

        const settings = rows[0];
        // Mask passwords for security
        if (settings.smtp_pass) settings.smtp_pass = '********';

        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/settings
router.put('/', async (req, res) => {
    try {
        const {
            app_name,
            smtp_host, smtp_user, smtp_pass, smtp_port, smtp_secure,
            live_stream_title, single_channel_url
        } = req.body;

        // Build update query dynamically to handle masked password
        let query = 'UPDATE settings SET ';
        const params = [];
        const updates = [];

        if (app_name !== undefined) { updates.push('app_name = ?'); params.push(app_name); }
        if (smtp_host !== undefined) { updates.push('smtp_host = ?'); params.push(smtp_host); }
        if (smtp_user !== undefined) { updates.push('smtp_user = ?'); params.push(smtp_user); }

        // Only update password if it's not masked
        if (smtp_pass !== undefined && smtp_pass !== '********') {
            updates.push('smtp_pass = ?'); params.push(smtp_pass);
        }

        if (smtp_port !== undefined) { updates.push('smtp_port = ?'); params.push(smtp_port); }
        if (smtp_secure !== undefined) { updates.push('smtp_secure = ?'); params.push(smtp_secure ? 1 : 0); }

        if (live_stream_title !== undefined) { updates.push('live_stream_title = ?'); params.push(live_stream_title); }
        if (single_channel_url !== undefined) { updates.push('single_channel_url = ?'); params.push(single_channel_url); }

        if (updates.length === 0) return res.json({ success: true });

        query += updates.join(', ') + ' WHERE id = 1';

        await pool.execute(query, params);
        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
