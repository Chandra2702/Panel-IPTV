const express = require('express');
const multer = require('multer');
const axios = require('axios');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Explicitly serve index.html on root for Vercel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const upload = multer({ storage: multer.memoryStorage() });

// In-memory store for parsed playlists waiting to be checked
const jobs = new Map();

// Parse M3U
function parseM3U(content) {
    const lines = content.split(/\r?\n/);
    const channels = [];
    let currentChannel = {};
    let rawHeadersBuffer = [];

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.startsWith('#')) {
            // Don't accumulate the global header
            if (line === '#EXTM3U') continue;

            rawHeadersBuffer.push(line);

            // Extract core info if it's the main EXTINF line
            if (line.startsWith('#EXTINF:')) {
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                const groupMatch = line.match(/group-title="([^"]+)"/);
                const nameMatch = line.match(/,(.+)$/);
                currentChannel.name = nameMatch ? nameMatch[1].trim() : 'Unknown';
                currentChannel.logo = logoMatch ? logoMatch[1] : null;
                currentChannel.group = groupMatch ? groupMatch[1] : 'Tanpa Kategori';
            }

            // Extract custom HTTP headers to be used during connection check
            if (line.toLowerCase().startsWith('#extvlcopt:http-user-agent=')) {
                currentChannel.userAgent = line.substring(27).trim();
            }
            if (line.toLowerCase().startsWith('#extvlcopt:http-referrer=')) {
                currentChannel.referer = line.substring(25).trim();
            }
        } else {
            // This is a URL line
            if (currentChannel.name || rawHeadersBuffer.length > 0) {
                currentChannel.url = line;
                // Save all preceding header lines as a single string
                currentChannel.raw = rawHeadersBuffer.join('\n');

                // Fallback name if no EXTINF was found for this URL
                if (!currentChannel.name) currentChannel.name = 'Unknown';
                if (!currentChannel.group) currentChannel.group = 'Tanpa Kategori';

                channels.push({ ...currentChannel });

                // Reset for next channel
                currentChannel = {};
                rawHeadersBuffer = [];
            }
        }
    }
    return channels;
}

app.post('/api/upload', upload.array('m3u', 10), async (req, res) => {
    let allContent = '';

    // Handle array of uploaded files
    if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
            allContent += file.buffer.toString('utf-8') + '\n';
        });
    }
    // Handle array of URLs
    else if (req.body.urls && Array.isArray(req.body.urls)) {
        try {
            const fetchPromises = req.body.urls.map(url => axios.get(url, { timeout: 10000 }).catch(e => ({ data: '' })));
            const responses = await Promise.all(fetchPromises);
            responses.forEach(response => {
                if (response.data) allContent += response.data + '\n';
            });
        } catch (error) {
            return res.status(400).json({ error: 'Failed to fetch M3U from one or more URLs' });
        }
    }
    // Fallback for single URL
    else if (req.body.url) {
        try {
            const response = await axios.get(req.body.url, { timeout: 10000 });
            allContent = response.data;
        } catch (error) {
            return res.status(400).json({ error: 'Failed to fetch M3U from URL' });
        }
    }
    else {
        return res.status(400).json({ error: 'No files or URLs provided' });
    }

    const channels = parseM3U(allContent);
    if (channels.length === 0) {
        return res.status(400).json({ error: 'No channels found in M3U' });
    }

    const jobId = crypto.randomUUID();
    jobs.set(jobId, channels);

    res.json({ jobId, total: channels.length });
});

// Create custom agent to ignore SSL errors and timeout quickly
const httpAgent = new http.Agent({ timeout: 5000 });
const httpsAgent = new https.Agent({ timeout: 5000, rejectUnauthorized: false });

async function checkUrl(url) {
    try {
        // Try a HEAD request first
        const res = await axios.head(url, {
            timeout: 5000,
            httpAgent,
            httpsAgent,
            maxRedirects: 3
        });
        return res.status >= 200 && res.status < 400;
    } catch (e) {
        // If HEAD fails (e.g., 405 Method Not Allowed), try GET with a stream and abort immediately
        try {
            const source = axios.CancelToken.source();
            const req = axios.get(url, {
                responseType: 'stream',
                timeout: 5000,
                httpAgent,
                httpsAgent,
                cancelToken: source.token
            });

            // We don't want to actually download the stream, just check headers
            const response = await req;
            // Cancel the stream download as we only care if it connects
            source.cancel('Connection successful, cancelling body download');
            return response.status >= 200 && response.status < 400;
        } catch (e2) {
            if (axios.isCancel(e2)) return true; // Connected successfully and cancelled it
            return false;
        }
    }
}

app.get('/api/check', (req, res) => {
    const jobId = req.query.jobId;
    const concurrency = parseInt(req.query.concurrency) || 30;
    const timeout = parseInt(req.query.timeout) || 5000;

    if (!jobs.has(jobId)) {
        return res.status(404).json({ error: 'Job not found' });
    }

    const channels = jobs.get(jobId);
    jobs.delete(jobId); // Prevent re-checking for the same job

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let currentIndex = 0;
    let activeWorkers = 0;
    let isCancelled = false;

    // Create custom agent to ignore SSL errors and timeout quickly
    const httpAgent = new http.Agent({ timeout });
    const httpsAgent = new https.Agent({ timeout, rejectUnauthorized: false });

    async function checkUrlWithTimeout(url, customHeaders = {}) {
        try {
            // Some streams only allow GET and throw 405 on HEAD, but HEAD is faster
            // We use standard Chrome User-Agent if none is provided via EXTVLCOPT
            const headers = {
                'User-Agent': customHeaders['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...customHeaders
            };

            const res = await axios.head(url, { headers, timeout, httpAgent, httpsAgent, maxRedirects: 3 });
            return res.status >= 200 && res.status < 400;
        } catch (e) {
            try {
                const headers = {
                    'User-Agent': customHeaders['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    ...customHeaders
                };

                const source = axios.CancelToken.source();
                const reqObj = axios.get(url, { headers, responseType: 'stream', timeout, httpAgent, httpsAgent, cancelToken: source.token });
                const response = await reqObj;
                source.cancel('Connection successful');
                return response.status >= 200 && response.status < 400;
            } catch (e2) {
                if (axios.isCancel(e2)) return true;
                return false;
            }
        }
    }

    function sendEvent(data) {
        if (!isCancelled) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }

    async function processNext() {
        if (isCancelled || currentIndex >= channels.length) {
            if (activeWorkers === 0 && !isCancelled) {
                res.write('event: done\ndata: {}\n\n');
                res.end();
            }
            return;
        }

        const index = currentIndex++;
        activeWorkers++;
        const channel = channels[index];

        const customHeaders = {};
        if (channel.userAgent) customHeaders['User-Agent'] = channel.userAgent;
        if (channel.referer) customHeaders['Referer'] = channel.referer;

        const isOnline = await checkUrlWithTimeout(channel.url, customHeaders);

        sendEvent({
            index,
            name: channel.name,
            logo: channel.logo,
            group: channel.group,
            raw: channel.raw,
            url: channel.url,
            status: isOnline ? 'online' : 'offline'
        });

        activeWorkers--;
        processNext(); // Fetch next item
    }

    // Start initial batch of workers
    for (let i = 0; i < concurrency && i < channels.length; i++) {
        processNext();
    }

    // Handle client disconnect mid-process
    req.on('close', () => {
        isCancelled = true;
        res.end();
    });
});

const PORT = process.env.PORT || 3090; // Allow Vercel to assign port or fallback to 3090

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`M3U Checker backend listening on port ${PORT}`);
    });
}

// Export the Express API for Vercel Serverless Functions
module.exports = app;
