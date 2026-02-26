const express = require('express');
const router = express.Router();
const { pool, logActivity } = require('../../config/database');

// GET /api/admin/shortlinks - List shortlinks (filtered by owner for resellers)
router.get('/', async (req, res) => {
    try {
        const role = req.session.adminRole;
        const adminId = req.session.adminId;

        let shortlinks;
        if (role === 'reseller') {
            [shortlinks] = await pool.execute(
                'SELECT * FROM shortlinks WHERE owner_id = ? ORDER BY id DESC', [adminId]
            );
        } else {
            [shortlinks] = await pool.execute('SELECT * FROM shortlinks ORDER BY id DESC');
        }

        res.json({ shortlinks });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/shortlinks - Create shortlink
router.post('/', async (req, res) => {
    try {
        const { slug, dest_url } = req.body;
        const adminId = req.session.adminId;

        await pool.execute(
            'INSERT INTO shortlinks (slug, dest_url, owner_id) VALUES (?, ?, ?)',
            [slug, dest_url, adminId]
        );
        res.json({ success: true, message: 'Shortlink created!' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Slug already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/shortlinks/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const role = req.session.adminRole;
        const adminId = req.session.adminId;

        // Resellers can only delete their own shortlinks
        if (role === 'reseller') {
            const [[link]] = await pool.execute('SELECT id FROM shortlinks WHERE id = ? AND owner_id = ?', [id, adminId]);
            if (!link) return res.status(403).json({ error: 'Akses ditolak' });
        }

        await pool.execute('DELETE FROM shortlinks WHERE id = ?', [id]);
        res.json({ success: true, message: 'Shortlink deleted!' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/shortlinks/generate-for-user - Create shortlink using username as slug
router.post('/generate-for-user', async (req, res) => {
    try {
        const { user_id } = req.body;
        const adminId = req.session.adminId;

        const [[user]] = await pool.execute('SELECT id, username, password FROM users WHERE id = ?', [user_id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const slug = user.username;
        const password = user.password || '';
        const playlistUrl = `/api/get?username=${user.username}&password=${password}&type=m3u_plus`;

        const [[existing]] = await pool.execute(
            'SELECT id, owner_id FROM shortlinks WHERE slug = ?',
            [slug]
        );

        if (existing) {
            // If owner_id is NULL, claim it for this admin/reseller
            if (!existing.owner_id) {
                await pool.execute('UPDATE shortlinks SET owner_id = ? WHERE id = ?', [adminId, existing.id]);
            }
            res.json({ success: true, slug, message: `Shortlink already exists` });
        } else {
            await pool.execute(
                'INSERT INTO shortlinks (slug, dest_url, owner_id) VALUES (?, ?, ?)',
                [slug, playlistUrl, adminId]
            );
            res.json({ success: true, slug, message: `Shortlink created` });
        }
    } catch (err) {
        console.error('Generate shortlink error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.json({ success: true, slug: req.body.username, message: 'Shortlink already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
