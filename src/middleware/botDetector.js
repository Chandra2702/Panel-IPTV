// Bot and browser detection middleware

const BOT_SIGNATURES = [
    'Bot', 'Crawler', 'Spider', 'Preview', 'TinyURL', 'Is.gd', 'Bit.ly',
    'WhatsApp', 'Telegram', 'Facebook', 'Twitter', 'Google', 'Applebot',
    'Slurp', 'DuckDuckGo', 'curl', 'wget', 'python-requests', 'GuzzleHttp'
];

const BROWSER_SIGNATURES = ['Mozilla', 'Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'MSIE'];

const PLAYER_WHITELIST = [
    'TiviMate', 'OTT Navigator', 'VLC', 'ExoPlayer', 'Iptv', 'Smarters',
    'GSE', 'Televizo', 'Purple', 'Perfect Player', 'okhttp', 'Go-http-client',
    'Lavf', 'NSPlayer', 'Daum', 'PotPlayer', 'm3u-ip.tv'
];

function isBot(userAgent) {
    if (!userAgent) return false;
    return BOT_SIGNATURES.some(sig => userAgent.toLowerCase().includes(sig.toLowerCase()));
}

function isBrowser(userAgent) {
    if (!userAgent) return false;

    // Check Whitelist FIRST (Always Allow Players)
    const isPlayer = PLAYER_WHITELIST.some(player =>
        userAgent.toLowerCase().includes(player.toLowerCase())
    );
    if (isPlayer) return false;

    // 1. Block Desktop Browsers (Windows/Mac/Linux)
    if (userAgent.match(/(Windows NT|Macintosh|X11; Linux x86_64)/i) && !userAgent.includes('Android')) {
        if (userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari')) {
            console.log(`[BotDetector] Desktop Browser Blocked: ${userAgent}`);
            return true;
        }
    }

    // 2. Block Mobile Browsers (Android + Chrome + Mobile)
    // Prevents downloading M3U from Chrome on Phone
    if (userAgent.includes('Android') && userAgent.includes('Chrome') && userAgent.includes('Mobile')) {
        console.log(`[BotDetector] Mobile Browser Blocked: ${userAgent}`);
        return true;
    }

    return false;
}

function botDetector(req, res, next) {
    const ua = req.headers['user-agent'] || '';

    // Bot detection - return fake OK response
    if (isBot(ua)) {
        res.set('Content-Type', 'audio/x-mpegurl');
        return res.send('#EXTM3U\n#EXTINF:-1,Bot Verified OK\nhttp://localhost/bot_check_ok');
    }

    // Browser blocking
    if (isBrowser(ua)) {
        // Redirect to website if configured
        const redirectUrl = process.env.WEBSITE_URL || '';
        if (redirectUrl) {
            return res.redirect(redirectUrl);
        }

        return res.status(403).send(
            '⛔ ACCESS DENIED: Browser Access Forbidden. Please use an IPTV Player App (TiviMate, OTT Navigator, VLC, etc).'
        );
    }

    next();
}

module.exports = {
    botDetector,
    isBot,
    isBrowser
};
