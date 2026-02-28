const express = require('express');
const axios = require('axios');
const multer = require('multer');
const router = express.Router();
const { pool, logActivity } = require('../../config/database');
const { requireAdmin } = require('../../middleware/auth');

// Apply admin-only middleware
router.use(requireAdmin);

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/admin/channels - List channels with pagination
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, q: search, status } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClauses = [];
        let params = [];

        if (search) {
            whereClauses.push('name LIKE ?');
            params.push(`%${search}%`);
        }

        if (status) {
            whereClauses.push('status = ?');
            params.push(status);
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count total
        const [[countResult]] = await pool.execute(
            `SELECT COUNT(*) as total FROM channels ${whereSQL}`,
            params
        );

        // Get channels
        const [channels] = await pool.execute(
            `SELECT * FROM channels ${whereSQL} ORDER BY id ASC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
            params
        );

        // Get EPG sources
        const [epgList] = await pool.execute('SELECT * FROM epg ORDER BY name ASC');

        res.json({
            channels,
            epgList,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });

    } catch (err) {
        console.error('Channels list error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/channels - Create channel
router.post('/', async (req, res) => {
    try {
        const { name, group, url, logo, epg_id, epg_chan_id, license_type, license_key, user_agent, referrer, extra_props, position } = req.body;

        await pool.execute(
            'INSERT INTO channels (name, group_title, url, logo_url, epg_id, epg_channel_id, position, license_type, license_key, user_agent, referrer, extra_props) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, group, url, logo || null, epg_id || 0, epg_chan_id || null, position !== undefined ? position : 999, license_type || null, license_key || null, user_agent || null, referrer || null, extra_props || null]
        );

        await logActivity(req.session.adminId, 'ADD_CH', `Added channel ${name}`, req.ip);
        res.json({ success: true, message: 'Channel ditambahkan!' });

    } catch (err) {
        console.error('Create channel error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/channels/:id - Update channel
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, group, url, logo, epg_id, epg_chan_id, license_type, license_key, user_agent, referrer, extra_props, position } = req.body;

        await pool.execute(
            'UPDATE channels SET name=?, group_title=?, url=?, logo_url=?, epg_id=?, epg_channel_id=?, license_type=?, license_key=?, user_agent=?, referrer=?, extra_props=?, position=? WHERE id=?',
            [name, group, url, logo || null, epg_id || 0, epg_chan_id || null, license_type || null, license_key || null, user_agent || null, referrer || null, extra_props || null, position !== undefined ? position : 999, id]
        );

        await logActivity(req.session.adminId, 'EDIT_CH', `Updated channel ID ${id}`, req.ip);
        res.json({ success: true, message: 'Channel updated!' });

    } catch (err) {
        console.error('Update channel error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/channels/:id - Delete channel
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.execute('DELETE FROM channels WHERE id = ?', [id]);
        await logActivity(req.session.adminId, 'DEL_CH', `Deleted channel ID ${id}`, req.ip);

        res.json({ success: true, message: 'Channel dihapus' });

    } catch (err) {
        console.error('Delete channel error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/channels/bulk-delete - Bulk delete
router.post('/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: 'No IDs provided' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const [result] = await pool.execute(`DELETE FROM channels WHERE id IN (${placeholders})`, ids);

        await logActivity(req.session.adminId, 'BULK_DEL', `Deleted ${result.affectedRows} channels`, req.ip);
        res.json({ success: true, message: `${result.affectedRows} channels dihapus` });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/channels/bulk-update-position - Bulk update positions
router.post('/bulk-update-position', async (req, res) => {
    try {
        const { positions } = req.body; // Array of {id, position}

        if (!positions || !Array.isArray(positions)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            for (const item of positions) {
                await connection.execute('UPDATE channels SET position = ? WHERE id = ?', [item.position, item.id]);
            }
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        await logActivity(req.session.adminId, 'REORDER_CH', `Reordered channels`, req.ip);
        res.json({ success: true, message: 'Urutan saluran berhasil disimpan' });

    } catch (err) {
        console.error('Bulk update position error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/channels/import - Import M3U
router.post('/import', upload.single('m3u_file'), async (req, res) => {
    try {
        const m3u_url = req.body.m3u_url || req.body.url;
        const clear_first = req.body.clear_first;
        let content = '';

        // Get content from file or URL
        if (req.file) {
            content = req.file.buffer.toString('utf-8');
        } else if (m3u_url) {
            const response = await axios.get(m3u_url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 30000,
                maxRedirects: 5
            });
            content = response.data;
        }

        if (!content) {
            return res.status(400).json({ error: 'No M3U content provided' });
        }

        // Clear existing if requested
        if (clear_first === 'true' || clear_first === true || clear_first === 'on') {
            await pool.execute('TRUNCATE TABLE channels');
        }

        // Parse M3U
        const lines = content.replace(/\r\n/g, '\n').split('\n');
        let imported = 0;
        let skipped = 0;
        let position = 0;
        let currentInfo = null;
        let propsBuffer = '';

        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;

                if (line.startsWith('#EXTINF:')) {
                    const nameParts = line.split(',');
                    const name = nameParts[nameParts.length - 1].trim();

                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);

                    currentInfo = {
                        name,
                        group: groupMatch ? groupMatch[1] : 'Uncategorized',
                        logo: logoMatch ? logoMatch[1] : '',
                        license_type: '',
                        license_key: '',
                        user_agent: '',
                        referrer: '',
                        extra_props: ''
                    };
                    propsBuffer = '';

                } else if (line.startsWith('#KODIPROP:') || line.startsWith('#EXTVLCOPT:')) {
                    propsBuffer += line + '\n';

                    // Only update if currentInfo exists
                    if (currentInfo) {
                        if (line.includes('license_type=')) {
                            currentInfo.license_type = line.split('=')[1] || '';
                        }
                        if (line.includes('license_key=')) {
                            currentInfo.license_key = line.split('=').slice(1).join('=') || '';
                        }
                        if (line.includes('http-user-agent=')) {
                            currentInfo.user_agent = line.split('=')[1] || '';
                        }
                        if (line.includes('http-referrer=')) {
                            currentInfo.referrer = line.split('=')[1] || '';
                        }
                    }

                } else if (!line.startsWith('#') && currentInfo) {
                    currentInfo.extra_props = propsBuffer.trim();

                    // Check for duplicate (same name + same url)
                    const [existing] = await conn.execute(
                        'SELECT id FROM channels WHERE name = ? AND url = ? LIMIT 1',
                        [currentInfo.name, line]
                    );

                    if (existing.length > 0) {
                        skipped++;
                    } else {
                        await conn.execute(
                            `INSERT INTO channels (name, group_title, url, logo_url, position, license_type, license_key, user_agent, referrer, extra_props) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                currentInfo.name, currentInfo.group, line, currentInfo.logo,
                                position++, currentInfo.license_type, currentInfo.license_key,
                                currentInfo.user_agent, currentInfo.referrer, currentInfo.extra_props
                            ]
                        );
                        imported++;
                    }
                    currentInfo = null;
                }
            }

            await conn.commit();
            await logActivity(req.session.adminId, 'IMPORT', `Imported ${imported} channels (${skipped} skipped)`, req.ip);

            res.json({ success: true, message: `Berhasil import ${imported} saluran baru${skipped > 0 ? `, ${skipped} duplikat dilewati` : ''}`, imported, skipped });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: 'Import failed: ' + err.message });
    }
});

// GET /api/admin/channels/:id/check - Check stream status
router.get('/:id/check', async (req, res) => {
    try {
        const { id } = req.params;

        const [[channel]] = await pool.execute('SELECT url, user_agent, referrer FROM channels WHERE id = ?', [id]);

        if (!channel) {
            return res.json({ status: 'error', message: 'Channel not found' });
        }

        // Custom timeout and SSL agent
        const https = require('https');
        const http = require('http');
        const timeout = 10000;
        const httpAgent = new http.Agent({ timeout });
        const httpsAgent = new https.Agent({ timeout, rejectUnauthorized: false });

        const customHeaders = {};
        if (channel.user_agent) customHeaders['User-Agent'] = channel.user_agent;
        if (channel.referrer) customHeaders['Referer'] = channel.referrer;

        const headers = {
            'User-Agent': customHeaders['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ...customHeaders
        };

        // Advanced checking logic: try HEAD first, fallback to GET (stream)
        try {
            await axios.head(channel.url, { headers, timeout, httpAgent, httpsAgent, maxRedirects: 3 });
            await pool.execute('UPDATE channels SET status = ? WHERE id = ?', ['online', id]);
            res.json({ status: 'success', result: 'online' });
        } catch (e) {
            try {
                const source = axios.CancelToken.source();
                const reqObj = axios.get(channel.url, { headers, responseType: 'stream', timeout, httpAgent, httpsAgent, cancelToken: source.token });
                const response = await reqObj;
                source.cancel('Connection successful');

                if (response.status >= 200 && response.status < 400) {
                    await pool.execute('UPDATE channels SET status = ? WHERE id = ?', ['online', id]);
                    return res.json({ status: 'success', result: 'online' });
                }
                throw new Error('Bad status code');
            } catch (e2) {
                if (axios.isCancel(e2)) {
                    await pool.execute('UPDATE channels SET status = ? WHERE id = ?', ['online', id]);
                    return res.json({ status: 'success', result: 'online' });
                }
                await pool.execute('UPDATE channels SET status = ? WHERE id = ?', ['offline', id]);
                res.json({ status: 'success', result: 'offline' });
            }
        }

    } catch (err) {
        console.error('Check stream error:', err);
        res.json({ status: 'error', message: 'Check failed' });
    }
});

// POST /api/admin/channels/batch-check - Check multiple channels
router.post('/batch-check', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No channel IDs provided' });
        }

        const results = { online: 0, offline: 0, errors: 0 };
        const updates = [];

        // Concurrency limit
        const limit = 20;
        const chunks = [];
        for (let i = 0; i < ids.length; i += limit) {
            chunks.push(ids.slice(i, i + limit));
        }

        // Custom timeout and SSL agent
        const https = require('https');
        const http = require('http');
        const timeout = 5000;
        const httpAgent = new http.Agent({ timeout });
        const httpsAgent = new https.Agent({ timeout, rejectUnauthorized: false });

        for (const chunk of chunks) {
            const promises = chunk.map(async (id) => {
                try {
                    const [[channel]] = await pool.execute('SELECT url, user_agent, referrer FROM channels WHERE id = ?', [id]);
                    if (!channel) return;

                    const customHeaders = {};
                    if (channel.user_agent) customHeaders['User-Agent'] = channel.user_agent;
                    if (channel.referrer) customHeaders['Referer'] = channel.referrer;

                    const headers = {
                        'User-Agent': customHeaders['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        ...customHeaders
                    };

                    try {
                        await axios.head(channel.url, { headers, timeout, httpAgent, httpsAgent, maxRedirects: 3 });
                        updates.push({ id, status: 'online' });
                        results.online++;
                    } catch (e) {
                        try {
                            const source = axios.CancelToken.source();
                            const reqObj = axios.get(channel.url, { headers, responseType: 'stream', timeout, httpAgent, httpsAgent, cancelToken: source.token });
                            const response = await reqObj;
                            source.cancel('Connection successful');

                            if (response.status >= 200 && response.status < 400) {
                                updates.push({ id, status: 'online' });
                                results.online++;
                            } else {
                                throw new Error('Bad status');
                            }
                        } catch (e2) {
                            if (axios.isCancel(e2)) {
                                updates.push({ id, status: 'online' });
                                results.online++;
                            } else {
                                updates.push({ id, status: 'offline' });
                                results.offline++;
                            }
                        }
                    }
                } catch (e) {
                    results.errors++;
                }
            });

            await Promise.all(promises);
        }

        // Batch update DB
        if (updates.length > 0) {
            const conn = await pool.getConnection();
            await conn.beginTransaction();
            try {
                for (const update of updates) {
                    await conn.execute('UPDATE channels SET status = ? WHERE id = ?', [update.status, update.id]);
                }
                await conn.commit();
            } catch (err) {
                await conn.rollback();
                throw err;
            } finally {
                conn.release();
            }
        }

        res.json({ success: true, results });

    } catch (err) {
        console.error('Batch check error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
