const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { pool, logActivity } = require('../../config/database');

// GET /api/admin/resellers
router.get('/', async (req, res) => {
    try {
        const [resellers] = await pool.execute(
            `SELECT a.*, COUNT(u.id) as user_count 
             FROM admins a 
             LEFT JOIN users u ON u.owner_id = a.id 
             WHERE a.role = 'reseller' 
             GROUP BY a.id 
             ORDER BY a.id DESC`
        );
        res.json({ resellers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/resellers
router.post('/', async (req, res) => {
    try {
        const { username, password, credits } = req.body;
        const hash = await bcrypt.hash(password, 10);

        await pool.execute(
            'INSERT INTO admins (username, password_hash, role, credits, created_by) VALUES (?, ?, ?, ?, ?)',
            [username, hash, 'reseller', credits || 0, req.session.adminId]
        );

        await logActivity(req.session.adminId, 'ADD_RESELLER', `Created reseller ${username}`, req.ip);
        res.json({ success: true, message: 'Reseller created!' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/resellers/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password } = req.body;

        let sql = 'UPDATE admins SET username = ?';
        const params = [username];

        if (password) {
            sql += ', password_hash = ?';
            params.push(await bcrypt.hash(password, 10));
        }

        sql += ' WHERE id = ? AND role = ?';
        params.push(id, 'reseller');

        await pool.execute(sql, params);
        res.json({ success: true, message: 'Reseller updated!' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/resellers/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute("DELETE FROM admins WHERE id = ? AND role = 'reseller'", [id]);
        res.json({ success: true, message: 'Reseller deleted!' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/resellers/:id/add-credits
router.post('/:id/add-credits', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        await pool.execute(
            'UPDATE admins SET credits = credits + ? WHERE id = ?',
            [parseInt(amount) || 0, id]
        );

        res.json({ success: true, message: `Added ${amount} credits` });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
