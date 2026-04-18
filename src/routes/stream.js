const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { pool, logActivity } = require('../config/database');

// === Performance Caches ===

// Auth cache: avoids bcrypt.compare on every stream request
// Key: "username:password" -> { userId, expDate, allowedIps, allowedUa, ts }
const authCache = new Map();
const AUTH_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Channel URL cache: avoids DB lookup for channel URLs
// Key: channelId -> { url, name, ts }
const channelCache = new Map();
const CHANNEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedAuth(username, password) {
    const key = `${username}:${password}`;
    const cached = authCache.get(key);
    if (cached && (Date.now() - cached.ts) < AUTH_CACHE_TTL) {
        return cached;
    }
    authCache.delete(key);
    return null;
}

function setCachedAuth(username, password, user) {
    const key = `${username}:${password}`;
    authCache.set(key, {
        userId: user.id,
        expDate: user.exp_date,
        allowedIps: user.allowed_ips,
        allowedUa: user.allowed_ua,
        active: user.active,
        ts: Date.now()
    });
    // Limit cache size
    if (authCache.size > 500) {
        const firstKey = authCache.keys().next().value;
        authCache.delete(firstKey);
    }
}

function getCachedChannel(id) {
    const cached = channelCache.get(id);
    if (cached && (Date.now() - cached.ts) < CHANNEL_CACHE_TTL) {
        return cached;
    }
    channelCache.delete(id);
    return null;
}

function setCachedChannel(id, channel) {
    channelCache.set(id, { url: channel.url, name: channel.name, ts: Date.now() });
    if (channelCache.size > 1000) {
        const firstKey = channelCache.keys().next().value;
        channelCache.delete(firstKey);
    }
}

// Non-blocking log function (fire-and-forget)
function logStreamActivity(userId, channelId, userAgent, currentIp) {
    pool.execute(
        `SELECT id FROM stream_logs WHERE user_id = ? AND channel_id = ? AND ip_address = ? AND start_time > (NOW() - INTERVAL 1 MINUTE)`,
        [userId, channelId, currentIp]
    ).then(([existing]) => {
        if (existing.length > 0) {
            pool.execute('UPDATE stream_logs SET start_time = NOW() WHERE id = ?', [existing[0].id]).catch(() => { });
        } else {
            pool.execute(
                'INSERT INTO stream_logs (user_id, channel_id, user_agent, ip_address, start_time) VALUES (?, ?, ?, ?, NOW())',
                [userId, channelId, userAgent, currentIp]
            ).catch(() => { });
        }
    }).catch(() => { });
}

// GET /stream.php or /api/stream - Stream redirector (optimized)
// Also matches /api/stream/file.mpd or /api/stream/file.m3u8 for players needing extensions
router.get(['/', '/:filename'], async (req, res) => {
    try {
        const username = req.query.username || req.query.u || '';
        const password = req.query.password || req.query.p || '';
        const streamId = req.query.stream_id || req.query.id || '';

        const currentIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';

        // Validate parameters
        if (!username || !password || !streamId) {
            return res.status(400).send('Missing parameters');
        }

        // Try auth cache first (skip bcrypt!)
        let userId, expDate, activeStatus;
        const cached = getCachedAuth(username, password);

        // Block Desktop Browsers (Simple Check)
        // Adjust regex as needed. Blocks Windows/Mac/Linux desktop browsers.
        // Browser Block removed from stream.js to support Custom UAs (which mimic browsers).
        // Browser blocking is enforced in playlist.js instead.

        if (cached) {
            userId = cached.userId;
            expDate = cached.expDate;
            activeStatus = cached.active;
        } else {
            // Cache miss - do full auth
            const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);

            if (users.length === 0) {
                return res.status(401).send('Unauthorized');
            }

            const user = users[0];

            // Verify password (slow bcrypt - only on cache miss)
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).send('Unauthorized');
            }

            // Cache successful auth
            setCachedAuth(username, password, user);
            userId = user.id;
            expDate = user.exp_date;
            activeStatus = user.active;
        }

        const hostUrl = `${req.protocol}://${req.get('host')}`;
        
        // Check if user is blocked
        if (activeStatus === 0) {
            return res.redirect(302, `${hostUrl}/blocked.mp4`);
        }

        // Check expiry
        if (expDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const userExp = new Date(expDate);
            userExp.setHours(23, 59, 59, 999); // expires at end of day
            
            if (today > userExp) {
                return res.redirect(302, `${hostUrl}/expired.mp4`);
            }
        }

        // Device lock is NOT enforced here — only in playlist.js
        // Reason: IPTV players often use different User-Agents for playlist vs stream
        // (e.g. OTT Navigator uses ExoPlayer for actual streaming)
        // Since stream URLs already contain credentials, playlist-level lock is sufficient.


        // Get channel (with cache)
        let channelUrl;
        const cachedChannel = getCachedChannel(streamId);

        if (cachedChannel) {
            channelUrl = cachedChannel.url;
        } else {
            const [channels] = await pool.execute(
                'SELECT id, url, name FROM channels WHERE id = ?',
                [streamId]
            );

            if (channels.length === 0) {
                return res.status(404).send('Channel not found');
            }

            setCachedChannel(streamId, channels[0]);
            channelUrl = channels[0].url;
        }

        // Log stream activity (non-blocking - don't wait!)
        logStreamActivity(userId, streamId, userAgent, currentIp);

        // 302 redirect to real stream URL immediately
        res.redirect(302, channelUrl);

    } catch (err) {
        console.error('Stream error:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
