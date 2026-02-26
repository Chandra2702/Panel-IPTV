const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');

// GET /api/admin/monitor/streams - Active streams
router.get('/streams', async (req, res) => {
    try {
        const [streams] = await pool.execute(`
      SELECT sl.*, u.username, c.name as channel_name
      FROM stream_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      LEFT JOIN channels c ON sl.channel_id = c.id
      WHERE sl.end_time IS NULL AND sl.start_time > (NOW() - INTERVAL 24 HOUR)
      ORDER BY sl.start_time DESC
    `);
        res.json({ streams });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/monitor/logs - Activity logs
router.get('/logs', async (req, res) => {
    try {
        const { limit = 100, page = 1 } = req.query;
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM activity_logs');
        const total = countResult[0].total;

        const [logs] = await pool.execute(
            `SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
        );
        res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
