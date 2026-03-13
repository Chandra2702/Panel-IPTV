require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'iptv_panel',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database and tables
async function initDatabase() {
  // Create connection without database first
  const initConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || ''
  });

  const dbName = process.env.DB_NAME || 'iptv_panel';

  // Create database if not exists
  await initConn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await initConn.execute(`USE \`${dbName}\``);

  // Create tables
  const tables = [
    // Admins table
    `CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'reseller') DEFAULT 'admin',
      credits INT DEFAULT 0,
      created_by INT DEFAULT 0
    )`,

    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      exp_date DATE NULL,
      max_connections INT DEFAULT 1,
      active_connections INT DEFAULT 0,
      ip_lock TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      owner_id INT DEFAULT 0,
      bouquets VARCHAR(255) DEFAULT NULL,
      allowed_ua TEXT NULL,
      allowed_ips TEXT NULL,
      active TINYINT DEFAULT 1
    )`,

    // Channels table
    `CREATE TABLE IF NOT EXISTS channels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      url TEXT NOT NULL,
      category_id INT DEFAULT 0,
      group_title VARCHAR(100) NULL,
      epg_id INT DEFAULT 0,
      epg_channel_id VARCHAR(100) NULL,
      logo_url TEXT NULL,
      position INT DEFAULT 0,
      status VARCHAR(10) DEFAULT 'unknown',
      license_type VARCHAR(50) NULL,
      license_key TEXT NULL,
      user_agent TEXT NULL,
      referrer TEXT NULL,
      extra_props TEXT NULL,
      is_live_stream BOOLEAN DEFAULT FALSE
    )`,

    // Categories table
    `CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Bouquets table
    `CREATE TABLE IF NOT EXISTS bouquets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price INT DEFAULT 0,
      duration INT DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Bouquet-Channels junction table
    `CREATE TABLE IF NOT EXISTS bouquet_channels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bouquet_id INT,
      channel_id INT,
      UNIQUE(bouquet_id, channel_id)
    )`,

    // EPG sources table
    `CREATE TABLE IF NOT EXISTS epg (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      url TEXT NOT NULL,
      last_updated DATETIME
    )`,

    // Shortlinks table
    `CREATE TABLE IF NOT EXISTS shortlinks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(50) UNIQUE NOT NULL,
      dest_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Activity logs table
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      message TEXT,
      ip VARCHAR(45) NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Stream logs table
    `CREATE TABLE IF NOT EXISTS stream_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      channel_id INT,
      user_agent TEXT,
      ip_address VARCHAR(45),
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME NULL
    )`,

    // Token usage logs table
    `CREATE TABLE IF NOT EXISTS token_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reseller_id INT NOT NULL,
      action ENUM('CREATE', 'EXTEND') NOT NULL,
      tokens_used INT NOT NULL DEFAULT 1,
      target_user VARCHAR(100) NULL,
      duration_days INT NULL,
      balance_after INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Settings table
    `CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY DEFAULT 1,
        app_name VARCHAR(255) DEFAULT 'IPTV Panel',
        smtp_host VARCHAR(255) DEFAULT '',
        smtp_user VARCHAR(255) DEFAULT '',
        smtp_pass VARCHAR(255) DEFAULT '',
        smtp_port INT DEFAULT 587,
        smtp_secure BOOLEAN DEFAULT FALSE,
        qris_data TEXT,
        telegram_bot_token VARCHAR(255) DEFAULT '',
        telegram_admin_id VARCHAR(255) DEFAULT '',
        live_stream_title VARCHAR(255) DEFAULT 'Live Stream'
    )`,

    // Clients table
    `CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Email verifications table
    `CREATE TABLE IF NOT EXISTS email_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(10) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (email),
        INDEX (code)
    )`,

    // Orders table
    `CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        package_name VARCHAR(255) NOT NULL,
        package_days INT NOT NULL DEFAULT 30,
        amount DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'waiting_approval', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
        proof_url VARCHAR(500),
        payment_method VARCHAR(50) DEFAULT 'qris',
        activated_user_id INT,
        activation_notes TEXT,
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )`

  ];

  for (const sql of tables) {
    await initConn.execute(sql);
  }

  // Insert default settings row if missing
  await initConn.execute(`
      INSERT INTO settings (id, app_name) 
      SELECT 1, 'IPTV Panel' 
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 1)
  `);

  // Migrations: add new columns to existing tables
  const migrations = [
    'ALTER TABLE bouquets ADD COLUMN price INT DEFAULT 0',
    'ALTER TABLE bouquets ADD COLUMN duration INT DEFAULT 30',
    'ALTER TABLE bouquets ADD COLUMN owner_id INT DEFAULT NULL',
    'ALTER TABLE shortlinks ADD COLUMN owner_id INT DEFAULT NULL',
    'ALTER TABLE shortlinks ADD COLUMN clicks INT DEFAULT 0',
    // Missing Channel Columns
    'ALTER TABLE channels ADD COLUMN status VARCHAR(10) DEFAULT "unknown"',
    'ALTER TABLE channels ADD COLUMN license_type VARCHAR(50) NULL',
    'ALTER TABLE channels ADD COLUMN license_key TEXT NULL',
    'ALTER TABLE channels ADD COLUMN user_agent TEXT NULL',
    'ALTER TABLE channels ADD COLUMN extra_props TEXT NULL',
    'ALTER TABLE channels ADD COLUMN is_live_stream BOOLEAN DEFAULT FALSE',
    'ALTER TABLE settings ADD COLUMN single_channel_url TEXT NULL',
    'ALTER TABLE settings ADD COLUMN live_stream_title VARCHAR(255) DEFAULT "Live Stream"',
  ];
  for (const sql of migrations) {
    try { await initConn.execute(sql); } catch (e) { /* column already exists */ }
  }

  // Seed default admin if table is empty
  const [admins] = await initConn.execute('SELECT COUNT(*) as count FROM admins');
  if (admins[0].count === 0) {
    const defaultPass = await bcrypt.hash('admin123', 10);
    await initConn.execute(
      'INSERT INTO admins (username, password_hash, role, credits) VALUES (?, ?, ?, ?)',
      ['admin', defaultPass, 'admin', 999999]
    );
    console.log('✅ Default admin created: admin / admin123');
  }

  await initConn.end();
  console.log('✅ Database initialized successfully');
}

// Activity logger helper
async function logActivity(userId, action, message, ip = 'system') {
  try {
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action, message, ip) VALUES (?, ?, ?, ?)',
      [userId, action, message, ip]
    );
  } catch (err) {
    console.error('Log activity error:', err.message);
  }
}

module.exports = {
  pool,
  initDatabase,
  logActivity
};
