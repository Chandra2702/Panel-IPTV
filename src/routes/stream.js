const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const router = express.Router();
const { pool, logActivity } = require('../config/database');

// === Performance Caches ===

// Auth cache: avoids bcrypt.compare on every stream request
// Key: "username:password" -> { userId, expDate, maxConn, allowedIps, allowedUa, ipLock, ts }
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
        maxConn: user.max_connections,
        ipLock: user.ip_lock,
        allowedIps: user.allowed_ips,
        allowedUa: user.allowed_ua,
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
        let userId, expDate, userIpLock, allowedIps, maxConn;
        const cached = getCachedAuth(username, password);

        // Block Desktop Browsers (Simple Check)
        // Adjust regex as needed. Blocks Windows/Mac/Linux desktop browsers.
        // Browser Block removed from stream.js to support Custom UAs (which mimic browsers).
        // Browser blocking is enforced in playlist.js instead.

        if (cached) {
            userId = cached.userId;
            expDate = cached.expDate;
            userIpLock = cached.ipLock;
            allowedIps = cached.allowedIps;
            maxConn = cached.maxConn || 1;
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
            userIpLock = user.ip_lock;
            allowedIps = user.allowed_ips;
            maxConn = user.max_connections || 1;
        }

        // Check expiry
        if (expDate) {
            const today = new Date().toISOString().split('T')[0];
            if (today > expDate) {
                return res.status(403).send('Expired');
            }
        }

        // Enforce IP Lock with Max Connections (Fingerprint: IP + UA Hash)
        let lockedIps = userIpLock ? userIpLock.split(',').map(s => s.trim()).filter(Boolean) : [];
        maxConn = maxConn || 1; // Ensure maxConn is at least 1

        // Generete Fingerprint
        const uaHash = crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 6);
        const deviceId = `${currentIp}|${uaHash}`;



        // Check if device is allowed
        let isDeviceAllowed = false;

        // Extract IPs for loose checking
        const lockedIpAddresses = lockedIps.map(entry => entry.split('|')[0]);



        // 1. Exact Fingerprint Match
        if (lockedIps.includes(deviceId)) {
            isDeviceAllowed = true;
        }


        // 2. IP Match (Loose Mode) - READ-ONLY - Allow stream if IP matches, but do NOT update lock
        else if (lockedIpAddresses.includes(currentIp)) {
            // We allow the stream because IP is whitelisted by Playlist Login
            // But we don't update the device signature, to keep the playlist locked to original App.
            isDeviceAllowed = true;
        }

        if (isDeviceAllowed) {
            // Passthrough
        } else {
            // New Device trying to connect
            let isAllowed = false;

            // Check whitelist first
            if (allowedIps) {
                const whitelist = allowedIps.split(',').map(ip => ip.trim());
                if (whitelist.includes(currentIp)) isAllowed = true;
            }

            if (!isAllowed) {
                // Check if we have slots available
                if (lockedIps.length < maxConn) {
                    // Auto-lock new Device Fingerprint
                    lockedIps.push(deviceId);
                    const newLock = lockedIps.join(',');

                    // Fire and forget update
                    pool.execute('UPDATE users SET ip_lock = ? WHERE id = ?', [newLock, userId]).catch(console.error);

                    // Update cache
                    if (cached) cached.ipLock = newLock;

                    console.log(`[Stream Auto-Lock] User ${username} added Device ${deviceId}. Total: ${lockedIps.length}/${maxConn}`);
                } else {
                    // Full
                    console.log(`[Stream Blocked] User ${username} max connections reached (${lockedIps.length}/${maxConn}). Request from ${deviceId}`);
                    return res.status(403).send(`Max Connections Reached (${lockedIps.length}/${maxConn})`);
                }
            }
        }


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
