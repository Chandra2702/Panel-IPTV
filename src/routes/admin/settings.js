const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { requireAdmin } = require('../../middleware/auth');

router.use(requireAdmin);

// GET /api/admin/settings
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM settings WHERE id = 1');
        if (rows.length === 0) {
            return res.json({});
        }

        const settings = rows[0];
        // Mask passwords for security
        if (settings.smtp_pass) settings.smtp_pass = '********';

        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/admin/settings
router.put('/', async (req, res) => {
    try {
        const {
            app_name,
            smtp_host, smtp_user, smtp_pass, smtp_port, smtp_secure,
            live_stream_title, single_channel_url
        } = req.body;

        // Build update query dynamically to handle masked password
        let query = 'UPDATE settings SET ';
        const params = [];
        const updates = [];

        if (app_name !== undefined) { updates.push('app_name = ?'); params.push(app_name); }
        if (smtp_host !== undefined) { updates.push('smtp_host = ?'); params.push(smtp_host); }
        if (smtp_user !== undefined) { updates.push('smtp_user = ?'); params.push(smtp_user); }

        // Only update password if it's not masked
        if (smtp_pass !== undefined && smtp_pass !== '********') {
            updates.push('smtp_pass = ?'); params.push(smtp_pass);
        }

        if (smtp_port !== undefined) { updates.push('smtp_port = ?'); params.push(smtp_port); }
        if (smtp_secure !== undefined) { updates.push('smtp_secure = ?'); params.push(smtp_secure ? 1 : 0); }

        if (live_stream_title !== undefined) { updates.push('live_stream_title = ?'); params.push(live_stream_title); }
        if (single_channel_url !== undefined) { updates.push('single_channel_url = ?'); params.push(single_channel_url); }

        if (updates.length === 0) return res.json({ success: true });

        query += updates.join(', ') + ' WHERE id = 1';

        await pool.execute(query, params);
        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// BACKUP & RESTORE
// ============================================================

const BACKUP_TABLES = [
    'admins', 'users', 'channels', 'categories', 'bouquets',
    'bouquet_channels', 'shortlinks', 'settings', 'token_logs'
];

// GET /api/admin/settings/backup - Download full database backup as JSON
router.get('/backup', async (req, res) => {
    try {
        const backup = {
            version: '1.0',
            created_at: new Date().toISOString(),
            tables: {}
        };

        for (const table of BACKUP_TABLES) {
            try {
                const [rows] = await pool.execute(`SELECT * FROM \`${table}\``);
                backup.tables[table] = rows;
            } catch (e) {
                // Table might not exist, skip
                backup.tables[table] = [];
            }
        }

        const filename = `iptv-backup-${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(JSON.stringify(backup, null, 2));

    } catch (err) {
        console.error('Backup error:', err);
        res.status(500).json({ error: 'Gagal membuat backup' });
    }
});

// POST /api/admin/settings/restore - Restore database from JSON backup
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

router.post('/restore', upload.single('backup'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'File backup tidak ditemukan' });
    }

    let backup;
    try {
        backup = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch (e) {
        return res.status(400).json({ error: 'File JSON tidak valid' });
    }

    if (!backup.tables) {
        return res.status(400).json({ error: 'Format backup tidak valid (missing tables)' });
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        // Disable FK checks during restore
        await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

        const restored = [];

        for (const table of BACKUP_TABLES) {
            const rows = backup.tables[table];
            if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

            // Truncate table
            await conn.execute(`TRUNCATE TABLE \`${table}\``);

            // Insert rows in batches
            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(',');
            const sql = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(',')}) VALUES (${placeholders})`;

            for (const row of rows) {
                const values = columns.map(col => {
                    let val = row[col];
                    if (val === null || val === undefined) return null;
                    
                    // Handle Date objects (shouldn't happen after JSON parse, but just in case)
                    if (val instanceof Date) {
                        return val.toISOString().replace('T', ' ').substring(0, 19);
                    }
                    
                    // MySQL strict mode datetime fix - convert ISO 8601 to MySQL format
                    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
                        return val.replace('T', ' ').substring(0, 19);
                    }
                    
                    return val;
                });
                await conn.execute(sql, values);
            }

            restored.push(`${table} (${rows.length})`);
        }

        await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
        await conn.commit();

        res.json({
            success: true,
            message: `Restore berhasil! Tabel: ${restored.join(', ')}`
        });

    } catch (err) {
        await conn.rollback();
        await conn.execute('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
        console.error('Restore error:', err);
        res.status(500).json({ error: `Restore gagal: ${err.message}` });
    } finally {
        conn.release();
    }
});

module.exports = router;
