require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

// Database
const { initDatabase, pool } = require('./config/database');
const MySQLStore = require('express-mysql-session')(session);

// Session Store Options
const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000,
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
}, pool);

// Routes
const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlist');

const streamRoutes = require('./routes/stream');
const shortlinkRoutes = require('./routes/shortlink');
const adminRoutes = require('./routes/admin/index');

// Initialize Express app
const panelApp = express();
const PORT = process.env.PORT || 3000;

// ==============================================
// PANEL APP (Admin Panel + API Server)
// ==============================================
panelApp.set('trust proxy', true);

// CORS configuration
panelApp.use(cors({
    credentials: true
}));

panelApp.use(express.json());
panelApp.use(express.urlencoded({ extended: true }));

// Session configuration for Panel
panelApp.use(session({
    key: 'iptv_session_cookie',
    secret: process.env.SESSION_SECRET || 'iptv-panel-secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files (admin panel)
panelApp.use(express.static(path.join(__dirname, '../public'), {
    index: false // Disable auto index
}));

// API Routes
panelApp.use('/api/auth', authRoutes);
panelApp.use('/api/get', playlistRoutes);
panelApp.use('/api/stream', streamRoutes);
panelApp.use('/api/shorten', shortlinkRoutes);
panelApp.use('/api/admin', adminRoutes);

// Legacy PHP-style routes for IPTV player compatibility
panelApp.use('/get.php', playlistRoutes);
panelApp.use('/stream.php', streamRoutes);

// Shortlink redirect handler
panelApp.get('/s/:slug', require('./routes/shortlink').redirectHandler);

// Root redirect for Panel
panelApp.get('/', (req, res) => {
    res.redirect('/admin/');
});

// SPA fallback for Vue admin panel (must be before generic slug handler & 404)
panelApp.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Shortlink without /s/ prefix
panelApp.get('/:slug', require('./routes/shortlink').redirectHandler);

// 404 handler
panelApp.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
panelApp.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
});



// ==============================================
// Start Servers
// ==============================================
async function start() {
    try {
        // Initialize database
        await initDatabase();

        // Initialize Telegram bot (optional)
        const TelegramService = require('./services/telegramService');
        await TelegramService.initialize();

        // Start Panel Server
        panelApp.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║           IPTV Panel - Node.js Server                 ║
╠═══════════════════════════════════════════════════════╣
║  🔧 Panel Server: http://localhost:${PORT}              ║
║  👤 Admin Login: admin / admin123                  ║
╚═══════════════════════════════════════════════════════╝
        `);
        });

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
