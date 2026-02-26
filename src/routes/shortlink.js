const express = require('express');
const axios = require('axios');
const router = express.Router();
const { pool, logActivity } = require('../config/database');
const { isBot, isBrowser } = require('../middleware/botDetector');

// GET /api/shorten - Create shortlink
router.get('/', async (req, res) => {
    try {
        const { url, alias } = req.query;

        if (!url) {
            return res.json({ status: 'error', message: 'URL required' });
        }

        if (alias) {
            // Create local shortlink
            try {
                await pool.execute(
                    'INSERT INTO shortlinks (slug, dest_url) VALUES (?, ?)',
                    [alias, url]
                );

                const hostUrl = `${req.protocol}://${req.get('host')}`;
                const shortUrl = `${hostUrl}/${alias}`;

                return res.json({ status: 'success', result: shortUrl });
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.json({ status: 'error', message: 'Alias already exists' });
                }
                throw err;
            }
        } else {
            // Use TinyURL API
            try {
                const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, {
                    timeout: 10000
                });
                return res.json({ status: 'success', result: response.data });
            } catch (err) {
                return res.json({ status: 'error', message: 'TinyURL API failed' });
            }
        }
    } catch (err) {
        console.error('Shorten error:', err);
        res.json({ status: 'error', message: 'Server error' });
    }
});

// Redirect handler - GET /s/:slug
async function redirectHandler(req, res) {
    try {
        const { slug } = req.params;

        const [links] = await pool.execute(
            'SELECT dest_url FROM shortlinks WHERE slug = ?',
            [slug]
        );

        if (links.length === 0) {
            return res.status(404).send('Shortlink not found');
        }

        // Log activity
        await logActivity('SHORTLINK', 'REDIRECT', `Accessed shortlink: ${slug}`);

        // Check if destination is internal playlist API (Proxy Mode)
        // This solves "Why get.php" and player redirect compatibility issues
        const destUrl = links[0].dest_url;
        if (destUrl.startsWith('/get.php') || destUrl.startsWith('/api/get')) {
            const ua = req.headers['user-agent'] || '';

            // Bot detection - return fake OK response
            if (isBot(ua)) {
                res.set('Content-Type', 'audio/x-mpegurl');
                return res.send('#EXTM3U\n#EXTINF:-1,Bot Verified OK\nhttp://localhost/bot_check_ok');
            }

            // Browser blocking - same message as in playlist route
            if (isBrowser(ua)) {
                return res.status(403).send(
                    '⛔ ACCESS DENIED: Browser Access Forbidden. Please use an IPTV Player App (TiviMate, OTT Navigator, VLC, etc).'
                );
            }

            // Parse query string from destUrl
            // destUrl format: /get.php?username=...&password=...
            const queryParams = new URLSearchParams(destUrl.split('?')[1]);

            // Call playlist handler directly
            try {
                const { handlePlaylist } = require('./playlist');

                // Inject params into req.query
                req.query.username = queryParams.get('username');
                req.query.password = queryParams.get('password');
                req.query.type = queryParams.get('type');

                return await handlePlaylist(req, res);
            } catch (innerErr) {
                console.error('Shortlink Proxy Error:', innerErr);
                throw innerErr;
            }
        }

        // Redirect to external destination
        res.redirect(302, destUrl);
    } catch (err) {
        console.error('Redirect error:', err);
        res.status(500).send('Server Error');
    }
}

module.exports = router;
module.exports.redirectHandler = redirectHandler;
