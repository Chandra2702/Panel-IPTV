const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const router = express.Router();
const { pool, logActivity } = require('../config/database');
const { botDetector } = require('../middleware/botDetector');

// Apply bot detector
router.use(botDetector);

// Main handler function
async function handlePlaylist(req, res) {
    try {
        // Support both ?username=x&password=y and /username/password formats
        let username = req.query.username || req.query.u || '';
        let password = req.query.password || req.query.p || '';

        // Parse TV-friendly URL format: /get.php?/username/password
        if (!username) {
            const queryString = req.originalUrl.split('?')[1] || '';
            if (queryString.startsWith('/')) {
                const parts = queryString.substring(1).split('/');
                if (parts.length >= 2) {
                    username = parts[0];
                    password = parts[1];
                }
            }
        }



        const currentIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection.remoteAddress;

        // Validate credentials
        if (!username || !password) {
            return res.status(401).send('User/Pass Salah');
        }

        // Get user from database
        const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);

        if (users.length === 0) {
            return res.status(401).send('User/Pass Salah');
        }

        const user = users[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).send('User/Pass Salah');
        }

        // Check expiry
        if (user.exp_date) {
            const today = new Date().toISOString().split('T')[0];
            if (today > user.exp_date) {
                res.set('Content-Type', 'audio/x-mpegurl');
                return res.send('#EXTM3U\n#EXTINF:-1,⛔ MASA AKTIF HABIS\nhttp://localhost/blocked\n');
            }
        }

        // IP Lock handling with Max Connections support (Fingerprint)
        let lockedIps = user.ip_lock ? user.ip_lock.split(',').map(s => s.trim()).filter(Boolean) : [];
        const maxConn = user.max_connections || 1;
        const currentIpStr = String(currentIp).trim();
        const userAgent = req.headers['user-agent'] || '';

        // Browser/Bot/App Checks
        const PLAYER_WHITELIST = ['TiviMate', 'OTT Navigator', 'VLC', 'ExoPlayer', 'Iptv', 'Smarters', 'm3u-ip.tv'];
        const isWhitelisted = PLAYER_WHITELIST.some(p => userAgent.toLowerCase().includes(p.toLowerCase()));

        if (!isWhitelisted) {
            // 1. Block Desktop Browsers
            if (userAgent.match(/(Windows NT|Macintosh|X11; Linux x86_64)/i) && !userAgent.includes('Android')) {
                if (userAgent.includes('Mozilla')) {
                    console.log(`[DEBUG PLAYLIST] BLOCKED DESKTOP BROWSER: UA=${userAgent}`);

                    // Redirect to website if configured
                    const redirectUrl = process.env.WEBSITE_URL || '';
                    if (redirectUrl) {
                        return res.redirect(redirectUrl);
                    }

                    res.set('Content-Type', 'audio/x-mpegurl');
                    return res.send('#EXTM3U\n#EXTINF:-1,⛔ DESKTOP BROWSER BLOCKED. USE APP.\nhttp://localhost/blocked\n');
                }
            }

            // 2. Block Mobile Browsers (Android + Chrome + Mobile)
            // Prevents Chrome on Android from downloading M3U, but allows Apps (if whitelisted or not Chrome)
            if (userAgent.includes('Android') && userAgent.includes('Chrome') && userAgent.includes('Mobile')) {
                console.log(`[DEBUG PLAYLIST] BLOCKED MOBILE BROWSER: UA=${userAgent}`);

                // Redirect to website if configured
                const redirectUrl = process.env.WEBSITE_URL || '';
                if (redirectUrl) {
                    return res.redirect(redirectUrl);
                }

                res.set('Content-Type', 'audio/x-mpegurl');
                return res.send('#EXTM3U\n#EXTINF:-1,⛔ MOBILE BROWSER BLOCKED. USE APP.\nhttp://localhost/blocked\n');
            }
        }

        // Generate Fingerprint
        console.log(`[DEBUG PLAYLIST] Request from IP=${currentIpStr}, UA=${userAgent}`);
        const uaHash = crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 6);
        const deviceId = `${currentIpStr}|${uaHash}`;
        let isDeviceAllowed = false;



        // 1. Exact Fingerprint Match
        if (lockedIps.includes(deviceId)) {
            isDeviceAllowed = true;
        }
        // 2. IP Match (Loose Mode) - Allow same IP regardless of UA to handle multi-UA apps/channels
        // Legacy Support (Strict IP Match only if no hash exists) -> Upgrade to Hash
        else if (lockedIps.includes(currentIpStr) && !lockedIps.some(s => s.includes('|'))) {
            const idx = lockedIps.indexOf(currentIpStr);
            lockedIps[idx] = deviceId;
            const newLock = lockedIps.join(',');
            pool.execute('UPDATE users SET ip_lock = ? WHERE id = ?', [newLock, user.id]).catch(console.error);
            isDeviceAllowed = true;
        }

        if (isDeviceAllowed) {
            // OK - Device is already locked and valid
        } else {
            // Device is NOT in lock list.
            // Check if we have slots available
            if (lockedIps.length < (user.max_connections || 1)) {
                // Add new lock
                lockedIps.push(deviceId);
                const newLock = lockedIps.join(',');
                pool.execute('UPDATE users SET ip_lock = ? WHERE id = ?', [newLock, user.id]).catch(console.error);

                // Log new lock
                await logActivity(username, 'LOCK_DEVICE', `Locked to ${deviceId}`, currentIpStr);
            } else {
                // BLOCKED
                console.log(`[DEBUG PLAYLIST] MAX CONN REACHED: Locked=${JSON.stringify(lockedIps)}, Current=${deviceId}`);
                res.set('Content-Type', 'audio/x-mpegurl');
                return res.send(`#EXTM3U\n#EXTINF:-1,⛔ MAX CONNECTION REACHED (${lockedIps.length}/${user.max_connections || 1})\nhttp://localhost/blocked\n`);
            }
        }

        // Allowed IPs check
        if (user.allowed_ips) {
            const allowedList = user.allowed_ips.split(',').map(ip => ip.trim());
            if (!allowedList.includes(currentIp)) {
                res.set('Content-Type', 'audio/x-mpegurl');
                return res.send(`#EXTM3U\n#EXTINF:-1,⛔ IP BLOCKED (${currentIp})\nhttp://localhost/blocked\n`);
            }
        }

        // Allowed UA check
        if (user.allowed_ua) {
            const ua = req.headers['user-agent'] || '';
            if (!ua.toLowerCase().includes(user.allowed_ua.toLowerCase())) {
                res.set('Content-Type', 'audio/x-mpegurl');
                return res.send(`#EXTM3U\n#EXTINF:-1,⛔ PLAYER RESTRICTED (${user.allowed_ua} Only)\nhttp://localhost/blocked\n`);
            }
        }

        // Log playlist access
        await logActivity(username, 'PLAYLIST', 'Downloading M3U', currentIp);

        // Generate playlist
        res.set('Content-Type', 'audio/x-mpegurl');
        res.set('Content-Disposition', 'inline; filename="channels.m3u"');

        let output = '#EXTM3U\n';

        // All packages include all channels - no bouquet filtering needed
        let channelsSql = 'SELECT * FROM channels ORDER BY position ASC';

        const [channels] = await pool.execute(channelsSql);
        output += generateM3UContent(channels, username, password, req);
        res.send(output);

    } catch (err) {
        console.error('Playlist error:', err);
        res.status(500).send('Server Error');
    }
}

// GET /get.php or /api/get - Generate M3U playlist
router.get('/', handlePlaylist);

function generateM3UContent(channels, username, password, req) {
    let output = '';
    const hostUrl = `${req.protocol}://${req.get('host')}`;

    for (const ch of channels) {
        output += `#EXTINF:-1 group-title="${ch.group_title || ''}" tvg-logo="${ch.logo_url || ''}",${ch.name}\n`;

        // Extra props (DRM, UA, Referrer)
        if (ch.extra_props) {
            output += ch.extra_props.trim() + '\n';
        } else {
            if (ch.user_agent) output += `#EXTVLCOPT:http-user-agent=${ch.user_agent}\n`;
            if (ch.referrer) output += `#EXTVLCOPT:http-referrer=${ch.referrer}\n`;
            if (ch.license_type) output += `#KODIPROP:inputstream.adaptive.license_type=${ch.license_type}\n`;
            if (ch.license_key) output += `#KODIPROP:inputstream.adaptive.license_key=${ch.license_key}\n`;
        }

        // Stream URL (Proxy via /api/stream for Monitoring)
        // Stream URL (Proxy via /api/stream for Monitoring)
        // We force monitoring for ALL channels now, as requested.
        let extension = '';
        if (ch.url.includes('.mpd')) extension = '/stream.mpd';
        else if (ch.url.includes('.m3u8')) extension = '/stream.m3u8';

        output += `${hostUrl}/api/stream${extension}?id=${ch.id}&u=${username}&p=${password}\n`;
    }

    return output;
}

module.exports = router;
module.exports.handlePlaylist = handlePlaylist;
