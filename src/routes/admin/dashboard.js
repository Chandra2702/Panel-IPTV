const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');

// GET /api/admin/dashboard - Get dashboard stats (role-aware)
router.get('/', async (req, res) => {
    try {
        const role = req.session.adminRole;
        const adminId = req.session.adminId;
        const username = req.session.adminUsername;

        if (role === 'reseller') {
            // Reseller dashboard
            const [[usersCount]] = await pool.execute(
                'SELECT COUNT(*) as count FROM users WHERE owner_id = ?', [adminId]
            );
            const [[activeCount]] = await pool.execute(
                'SELECT COUNT(*) as count FROM users WHERE owner_id = ? AND (exp_date >= CURDATE() OR exp_date IS NULL)', [adminId]
            );
            const [[bouquetsCount]] = await pool.execute(
                'SELECT COUNT(*) as count FROM bouquets WHERE owner_id = ?', [adminId]
            );

            // Total revenue: sum of bouquet prices for all users owned by reseller
            const [[revenue]] = await pool.execute(`
                SELECT COALESCE(SUM(b.price), 0) as total FROM users u
                LEFT JOIN bouquets b ON FIND_IN_SET(b.id, u.bouquets) > 0
                WHERE u.owner_id = ?
            `, [adminId]);

            // Get reseller credits
            const [[admin]] = await pool.execute('SELECT credits FROM admins WHERE id = ?', [adminId]);

            // Get recent token usage logs
            const [tokenLogs] = await pool.execute(
                'SELECT * FROM token_logs WHERE reseller_id = ? ORDER BY created_at DESC LIMIT 20',
                [adminId]
            );

            // Chart data - Users created in last 7 days by this reseller
            const chartData = [];
            const chartLabels = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const [[count]] = await pool.execute(
                    `SELECT COUNT(*) as count FROM users WHERE owner_id = ? AND DATE(created_at) = ?`,
                    [adminId, dateStr]
                );
                chartData.push(count.count);
                chartLabels.push(date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
            }

            res.json({
                role: 'reseller',
                admin: { username },
                stats: {
                    totalUsers: usersCount.count,
                    activeUsers: activeCount.count,
                    totalBouquets: bouquetsCount.count,
                    totalRevenue: revenue.total || 0,
                    credits: admin?.credits || 0,
                },
                tokenLogs,
                chart: { labels: chartLabels, data: chartData }
            });

        } else {
            // Admin dashboard (original)
            const [[usersCount]] = await pool.execute('SELECT COUNT(*) as count FROM users');
            const [[activeCount]] = await pool.execute(
                'SELECT COUNT(*) as count FROM users WHERE exp_date >= CURDATE() OR exp_date IS NULL'
            );
            const [[channelsCount]] = await pool.execute('SELECT COUNT(*) as count FROM channels');
            const [[bouquetsCount]] = await pool.execute('SELECT COUNT(*) as count FROM bouquets');
            const [[resellersCount]] = await pool.execute(
                "SELECT COUNT(*) as count FROM admins WHERE role = 'reseller'"
            );

            // Active streams
            const [[streamsCount]] = await pool.execute(
                'SELECT COUNT(*) as count FROM stream_logs WHERE start_time > (NOW() - INTERVAL 5 MINUTE)'
            );

            const [recentLogs] = await pool.execute(
                'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 10'
            );

            // Chart data
            const chartData = [];
            const chartLabels = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const [[count]] = await pool.execute(
                    `SELECT COUNT(*) as count FROM activity_logs WHERE action = 'ADD_USER' AND DATE(timestamp) = ?`,
                    [dateStr]
                );
                chartData.push(count.count);
                chartLabels.push(date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
            }

            res.json({
                role: 'admin',
                admin: { username },
                stats: {
                    totalUsers: usersCount.count,
                    activeUsers: activeCount.count,
                    totalChannels: channelsCount.count,
                    totalBouquets: bouquetsCount.count,
                    totalResellers: resellersCount.count,
                    activeStreams: streamsCount.count,
                },
                recentLogs,
                chart: { labels: chartLabels, data: chartData }
            });
        }

    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
