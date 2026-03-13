const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { pool, logActivity } = require('../../config/database');

// Token cost based on duration (days)
function getTokenCost(days) {
    if (!days || days <= 0 || days === -1) return 0; // Unlimited = admin only, free
    if (days <= 3) return 0; // Trial
    if (days <= 30) return 1;
    if (days <= 90) return 3;
    if (days <= 180) return 6;
    if (days <= 360) return 12;
    if (days <= 720) return 20; // 2 Years
    return Math.ceil(days / 30); // Custom: proportional
}

// GET /api/admin/users - List users
router.get('/', async (req, res) => {
    try {
        const { q: search } = req.query;
        const adminId = req.session.adminId;
        const adminRole = req.session.adminRole;

        let sql = `
      SELECT u.*, a.username as owner_name 
      FROM users u 
      LEFT JOIN admins a ON u.owner_id = a.id 
      WHERE 1=1
    `;
        const params = [];

        // Reseller filter - only show their own users
        if (adminRole === 'reseller') {
            sql += ' AND u.owner_id = ?';
            params.push(adminId);
        }

        if (search) {
            sql += ' AND u.username LIKE ?';
            params.push(`%${search}%`);
        }

        sql += ' ORDER BY u.id DESC';

        const [users] = await pool.execute(sql, params);

        // Get bouquets for display - Admin sees ALL, Reseller sees only their own
        let bouquets;
        if (adminRole === 'reseller') {
            [bouquets] = await pool.execute('SELECT * FROM bouquets WHERE owner_id = ? ORDER BY name ASC', [adminId]);
        } else {
            [bouquets] = await pool.execute('SELECT * FROM bouquets ORDER BY name ASC');
        }

        res.json({ users, bouquets });

    } catch (err) {
        console.error('Users list error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/users/token-cost - Get token cost for a duration
router.get('/token-cost', (req, res) => {
    const parsed = parseInt(req.query.duration);
    const duration = isNaN(parsed) ? 30 : parsed;
    const cost = getTokenCost(duration);
    res.json({
        duration,
        cost,
        pricing: [
            { days: 3, label: '3 Hari (Trial)', tokens: 0 },
            { days: 30, label: '1 Bulan', tokens: 1 },
            { days: 90, label: '3 Bulan', tokens: 3 },
            { days: 180, label: '6 Bulan', tokens: 6 },
            { days: 360, label: '1 Tahun', tokens: 12 },
            { days: 720, label: '2 Tahun', tokens: 20 }
        ]
    });
});

// POST /api/admin/users - Create user
router.post('/', async (req, res) => {
    try {
        const adminId = req.session.adminId;
        const adminRole = req.session.adminRole;

        // Check credits for reseller (duration-based)
        const { username, password, duration, max_connections, bouquets, allowed_ua, allowed_ips } = req.body;
        const tokenCost = getTokenCost(duration);

        if (adminRole === 'reseller') {
            if (duration === 0 || duration === -1) {
                return res.status(403).json({ error: 'Reseller tidak diizinkan membuat user Lifetime' });
            }

            const [[admin]] = await pool.execute('SELECT credits FROM admins WHERE id = ?', [adminId]);
            if (admin.credits < tokenCost) {
                return res.status(400).json({ error: `Saldo token tidak cukup! Butuh ${tokenCost} token, sisa ${admin.credits}` });
            }
        }

        // Variables already destructured above

        // Sanitize username
        const cleanUsername = username.replace(/[^a-zA-Z0-9_]/g, '');

        // Calculate expiry
        const expDate = duration === -1 ? null :
            new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Hash password
        const hash = await bcrypt.hash(password, 10);

        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [insertResult] = await conn.execute(
                `INSERT INTO users (username, password, password_hash, exp_date, max_connections, owner_id, bouquets, allowed_ua, allowed_ips) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [cleanUsername, password, hash, expDate, max_connections || 1, adminId,
                    bouquets ? bouquets.join(',') : null, allowed_ua || null, allowed_ips || null]
            );

            // Deduct tokens for reseller (duration-based)
            if (adminRole === 'reseller') {
                console.log(`[DEBUG] Deducting ${tokenCost} tokens for reseller ID: ${adminId} (duration: ${duration} days)`);
                await conn.execute('UPDATE admins SET credits = credits - ? WHERE id = ?', [tokenCost, adminId]);

                // Update session with new credit value
                req.session.adminCredits = req.session.adminCredits - tokenCost;

                // Log token usage
                await conn.execute(
                    'INSERT INTO token_logs (reseller_id, action, tokens_used, target_user, duration_days, balance_after) VALUES (?, ?, ?, ?, ?, ?)',
                    [adminId, 'CREATE', tokenCost, cleanUsername, duration, req.session.adminCredits]
                );
            } else {
                console.log(`[DEBUG] Not a reseller, role is: ${adminRole}`);
            }

            await conn.commit();
            await logActivity(adminId, 'ADD_USER', `Created user ${cleanUsername}`, req.ip);

            res.json({
                success: true,
                id: insertResult.insertId,
                message: `User ${cleanUsername} berhasil ditambahkan!`,
                credits: req.session.adminCredits  // Return updated credits
            });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        console.error('Create user error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username sudah ada' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/users/:id - Update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.session.adminId;
        const adminRole = req.session.adminRole;
        const { password, exp_date, max_connections, bouquets, allowed_ua, allowed_ips } = req.body;

        let sql = 'UPDATE users SET max_connections = ?, exp_date = ?, bouquets = ?, allowed_ua = ?, allowed_ips = ?';

        // Ensure bouquets is an array if provided
        const bouquetsStr = (Array.isArray(bouquets)) ? bouquets.join(',') : (bouquets || null);

        // Format exp_date to YYYY-MM-DD if present
        let formattedExpDate = null;
        if (exp_date) {
            // Handle ISO string or YYYY-MM-DD
            try {
                formattedExpDate = new Date(exp_date).toISOString().split('T')[0];
            } catch (e) {
                formattedExpDate = null;
            }
        }

        const params = [
            max_connections || 1,
            formattedExpDate,
            bouquetsStr,
            allowed_ua || null,
            allowed_ips || null
        ];

        if (password) {
            sql += ', password_hash = ?';
            params.push(await bcrypt.hash(password, 10));
        }

        sql += ' WHERE id = ?';
        params.push(id);

        if (adminRole === 'reseller') {
            sql += ' AND owner_id = ?';
            params.push(adminId);
        }

        const [result] = await pool.execute(sql, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan atau akses ditolak' });
        }

        await logActivity(adminId, 'EDIT_USER', `Updated user ID ${id}`, req.ip);
        res.json({ success: true, message: 'User berhasil diupdate' });

    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.session.adminId;
        const adminRole = req.session.adminRole;

        let sql = 'DELETE FROM users WHERE id = ?';
        const params = [id];

        if (adminRole === 'reseller') {
            sql += ' AND owner_id = ?';
            params.push(adminId);
        }

        const [result] = await pool.execute(sql, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        await logActivity(adminId, 'DEL_USER', `Deleted user ID ${id}`, req.ip);
        res.json({ success: true, message: 'User dihapus' });

    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/users/bulk-delete - Bulk delete
router.post('/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        const adminId = req.session.adminId;
        const adminRole = req.session.adminRole;

        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: 'No IDs provided' });
        }

        const placeholders = ids.map(() => '?').join(',');
        let sql = `DELETE FROM users WHERE id IN (${placeholders})`;
        const params = [...ids];

        if (adminRole === 'reseller') {
            sql += ' AND owner_id = ?';
            params.push(adminId);
        }

        const [result] = await pool.execute(sql, params);

        await logActivity(adminId, 'BULK_DEL_USER', `Deleted ${result.affectedRows} users`, req.ip);
        res.json({ success: true, message: `${result.affectedRows} users dihapus` });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/users/:id/reset-ip - Reset IP lock
router.post('/:id/reset-ip', async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.session.adminId;

        await pool.execute('UPDATE users SET ip_lock = NULL WHERE id = ?', [id]);
        await logActivity(adminId, 'RESET_IP', `Reset IP for user ID ${id}`, req.ip);

        res.json({ success: true, message: 'Device Lock direset' });

    } catch (err) {
        console.error('Reset IP error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/users/:id/extend - Extend Duration
router.post('/:id/extend', async (req, res) => {
    try {
        const { id } = req.params;
        const { duration, new_bouquet_id } = req.body; // duration in days, optional new_bouquet_id
        const adminId = req.session.adminId;
        const adminRole = req.session.adminRole; // 'admin' or 'reseller'

        if (!duration || duration <= 0) {
            return res.status(400).json({ error: 'Durasi tidak valid' });
        }

        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // Check user ownership and get current expiry
            let sql = 'SELECT id, username, exp_date, bouquets FROM users WHERE id = ?';
            const params = [id];

            if (adminRole === 'reseller') {
                sql += ' AND owner_id = ?';
                params.push(adminId);
            }

            const [users] = await conn.execute(sql, params);
            if (users.length === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const user = users[0];

            // Handle Tokens for Reseller (duration-based)
            const tokenCost = getTokenCost(duration);
            if (adminRole === 'reseller') {
                if (duration === 0 || duration === -1) {
                    await conn.rollback();
                    return res.status(403).json({ error: 'Reseller tidak diizinkan membuat user Lifetime' });
                }

                const [[admin]] = await conn.execute('SELECT credits FROM admins WHERE id = ?', [adminId]);
                if (admin.credits < tokenCost) {
                    await conn.rollback();
                    return res.status(400).json({ error: `Saldo token tidak cukup! Butuh ${tokenCost} token, sisa ${admin.credits}` });
                }

                // Deduct tokens based on duration
                await conn.execute('UPDATE admins SET credits = credits - ? WHERE id = ?', [tokenCost, adminId]);
                req.session.adminCredits = req.session.adminCredits - tokenCost;

                // Log token usage
                await conn.execute(
                    'INSERT INTO token_logs (reseller_id, action, tokens_used, target_user, duration_days, balance_after) VALUES (?, ?, ?, ?, ?, ?)',
                    [adminId, 'EXTEND', tokenCost, user.username, duration, req.session.adminCredits]
                );
            }

            // Calculate new expiry
            // If expired, start from TODAY. If active, add to existing date.
            let currentExp = user.exp_date ? new Date(user.exp_date) : new Date();
            const today = new Date();

            // If current expiry is in the past, reset base to today
            if (currentExp < today) {
                currentExp = today;
            }

            currentExp.setDate(currentExp.getDate() + parseInt(duration));
            const newExpDate = currentExp.toISOString().split('T')[0];

            // Update user (expiry + optional bouquet change)
            let updateSql = 'UPDATE users SET exp_date = ?';
            const updateParams = [newExpDate];

            if (new_bouquet_id) {
                updateSql += ', bouquets = ?';
                updateParams.push(String(new_bouquet_id));
            }

            updateSql += ' WHERE id = ?';
            updateParams.push(id);

            await conn.execute(updateSql, updateParams);

            await conn.commit();
            await logActivity(adminId, 'EXTEND_USER', `Extended user ${user.username} by ${duration} days${new_bouquet_id ? ' (Changed Bouquet)' : ''}`, req.ip);

            res.json({
                success: true,
                message: `Berhasil diperpanjang ${duration} hari`,
                new_exp_date: newExpDate,
                credits: req.session.adminCredits,
                // Return new bouquet if changed so frontend can update local state
                new_bouquets: new_bouquet_id ? String(new_bouquet_id) : user.bouquets
            });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        console.error('Extend user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
