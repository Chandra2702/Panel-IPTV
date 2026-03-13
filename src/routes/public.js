const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET /api/public/live-url
router.get('/live-url', async (req, res) => {
    try {
        const [settingsRows] = await pool.execute('SELECT live_stream_title FROM settings WHERE id = 1');
        const mainTitle = settingsRows.length > 0 ? (settingsRows[0].live_stream_title || 'Live Stream') : 'Live Stream';

        const [channels] = await pool.execute('SELECT * FROM channels WHERE is_live_stream = 1 ORDER BY position ASC');

        if (channels.length === 0) {
            return res.status(404).json({ error: 'No live stream channels configured in settings.' });
        }

        const validStreams = channels.map(ch => {
            let drmObj = null;
            if (ch.license_key && ch.license_type) {
                const typeObj = {};
                // Determine format
                const rawType = ch.license_type.toLowerCase().trim();
                if (rawType.includes('clearkey')) {
                    typeObj.type = 'clearkey';
                    typeObj.keyId = ch.license_key.includes(':') ? ch.license_key.split(':')[0].trim() : '';
                    typeObj.key = ch.license_key.includes(':') ? ch.license_key.split(':')[1].trim() : ch.license_key.trim();
                } else if (rawType.includes('widevine')) {
                    typeObj.type = 'widevine';
                    typeObj.serverURL = ch.license_key;
                } else if (ch.license_type.toLowerCase().includes('playready')) {
                    typeObj.type = 'playready';
                    typeObj.serverURL = ch.license_key;
                } else {
                    typeObj.type = ch.license_type;
                    typeObj.serverURL = ch.license_key;
                }
                drmObj = typeObj;
            }

            return {
                title: ch.name || 'Channel',
                url: ch.url,
                userAgent: ch.user_agent || '',
                referrer: ch.referrer || '',
                drm: drmObj
            };
        }).filter(s => s.url);

        if (validStreams.length === 0) {
            return res.status(404).json({ error: 'No valid HTTP URL found in configured channels.' });
        }

        res.json({ title: mainTitle, streams: validStreams });
    } catch (err) {
        console.error('Failed to fetch public live URL:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
