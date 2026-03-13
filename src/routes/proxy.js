const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// GET /api/proxy/*
router.get('/*', async (req, res) => {
    try {
        let targetUrl = req.query.url;

        if (!targetUrl || !targetUrl.startsWith('http')) {
            return res.status(400).send('Invalid target URL: ' + targetUrl);
        }

        const headers = { ...req.headers };

        // Clean up headers
        delete headers.host;
        delete headers.referer;
        delete headers['user-agent'];
        delete headers.cookie;

        // Apply our custom headers from Query Parameters (sent by live.html filter)
        if (req.query.ua) {
            headers['User-Agent'] = req.query.ua;
        }
        if (req.query.ref) {
            headers['Referer'] = req.query.ref;
        }

        const client = targetUrl.startsWith('https') ? https : http;
        const proxyReq = client.get(targetUrl, { headers }, (proxyRes) => {
            res.status(proxyRes.statusCode);

            const resHeaders = { ...proxyRes.headers };
            delete resHeaders['transfer-encoding'];

            // Allow all CORS natively
            resHeaders['Access-Control-Allow-Origin'] = '*';
            resHeaders['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
            resHeaders['Access-Control-Allow-Headers'] = '*';

            res.set(resHeaders);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err.message);
            res.status(500).send('Proxy Error');
        });

        req.on('close', () => {
            proxyReq.destroy();
        });

    } catch (err) {
        console.error('Proxy error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Handle OPTIONS requests for CORS
router.options('/*', (req, res) => {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
    });
    res.end();
});

module.exports = router;
