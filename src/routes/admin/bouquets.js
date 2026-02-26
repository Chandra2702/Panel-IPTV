const express = require('express');
const router = express.Router();
const { pool, logActivity } = require('../../config/database');
const { requireAuth } = require('../../middleware/auth');

// Both admin and reseller can access bouquets
router.use(requireAuth);

// GET /api/admin/bouquets - List bouquets (filtered by owner for resellers)
router.get('/', async (req, res) => {
    try {
        const role = req.session.adminRole;
        const adminId = req.session.adminId;

        let bouquets;
        // Filter bouquets by owner - Admin sees only their own, Reseller sees only their own
        [bouquets] = await pool.execute(
            'SELECT * FROM bouquets WHERE owner_id = ? ORDER BY name ASC',
            [adminId]
        );

        res.json({ bouquets });
    } catch (err) {
        console.error('Bouquets list error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/bouquets - Create bouquet
router.post('/', async (req, res) => {
    try {
        const { name, price, duration } = req.body;
        const adminId = req.session.adminId;
        const role = req.session.adminRole;

        if (role === 'reseller' && (duration === 0 || duration === -1)) {
            return res.status(403).json({ error: 'Reseller tidak diizinkan membuat paket Lifetime' });
        }

        const [result] = await pool.execute(
            'INSERT INTO bouquets (name, price, duration, owner_id) VALUES (?, ?, ?, ?)',
            [name, price ?? 0, duration ?? 30, adminId]
        );
        await logActivity(adminId, 'ADD_BOUQUET', `Created bouquet ${name}`, req.ip);

        res.json({ success: true, id: result.insertId, message: 'Bouquet created!' });
    } catch (err) {
        console.error('Create bouquet error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/bouquets/:id - Update bouquet
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, duration } = req.body;
        const role = req.session.adminRole;
        const adminId = req.session.adminId;

        if (role === 'reseller' && (duration === 0 || duration === -1)) {
            return res.status(403).json({ error: 'Reseller tidak diizinkan mengubah paket menjadi Lifetime' });
        }

        // All roles can only edit their own bouquets
        const [[bouquet]] = await pool.execute('SELECT id FROM bouquets WHERE id = ? AND owner_id = ?', [id, adminId]);
        if (!bouquet) return res.status(403).json({ error: 'Akses ditolak' });

        await pool.execute(
            'UPDATE bouquets SET name = ?, price = ?, duration = ? WHERE id = ?',
            [name, price ?? 0, duration ?? 30, id]
        );
        res.json({ success: true, message: 'Bouquet updated!' });
    } catch (err) {
        console.error('Update bouquet error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/bouquets/:id - Delete bouquet
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const role = req.session.adminRole;
        const adminId = req.session.adminId;

        // All roles can only delete their own bouquets
        const [[bouquet]] = await pool.execute('SELECT id FROM bouquets WHERE id = ? AND owner_id = ?', [id, adminId]);
        if (!bouquet) return res.status(403).json({ error: 'Akses ditolak' });

        await pool.execute('DELETE FROM bouquet_channels WHERE bouquet_id = ?', [id]);
        await pool.execute('DELETE FROM bouquets WHERE id = ?', [id]);
        res.json({ success: true, message: 'Bouquet deleted!' });
    } catch (err) {
        console.error('Delete bouquet error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/bouquets/:id/channels - Get channels in bouquet
router.get('/:id/channels', async (req, res) => {
    try {
        const { id } = req.params;
        const [channels] = await pool.execute(
            `SELECT c.* FROM channels c 
       JOIN bouquet_channels bc ON c.id = bc.channel_id 
       WHERE bc.bouquet_id = ? ORDER BY c.name`,
            [id]
        );
        res.json({ channels });
    } catch (err) {
        console.error('Get bouquet channels error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/bouquets/:id/channels - Update channels in bouquet
router.put('/:id/channels', async (req, res) => {
    try {
        const { id } = req.params;
        const { channelIds } = req.body;

        await pool.execute('DELETE FROM bouquet_channels WHERE bouquet_id = ?', [id]);

        if (channelIds && channelIds.length > 0) {
            for (const chId of channelIds) {
                await pool.execute(
                    'INSERT IGNORE INTO bouquet_channels (bouquet_id, channel_id) VALUES (?, ?)',
                    [id, chId]
                );
            }
        }

        res.json({ success: true, message: 'Bouquet channels updated!' });
    } catch (err) {
        console.error('Update bouquet channels error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
