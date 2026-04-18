const express = require('express');
const router = express.Router();
const { pool, logActivity } = require('../../config/database');
const { requireAdmin } = require('../../middleware/auth');

router.use(requireAdmin);

// GET /api/admin/categories
router.get('/', async (req, res) => {
    try {
        const [categories] = await pool.execute(`
            SELECT c.*, COUNT(ch.id) as channelCount 
            FROM categories c 
            LEFT JOIN channels ch ON ch.group_title = c.name 
            GROUP BY c.id 
            ORDER BY c.name ASC
        `);
        res.json({ categories });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/categories
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        const [result] = await pool.execute('INSERT INTO categories (name) VALUES (?)', [name]);
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/categories/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        await pool.execute('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/categories/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
