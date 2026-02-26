const { pool } = require('../src/config/database');

async function migrate() {
    console.log('🚀 Starting Phase 10 Table Migration (Fix)...');
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Create Settings Table (if not exists)
        // Storing as a single row with specific columns is 
        // easier for strict typing, though key-value is more flexible.
        // Let's stick to columns as per previous plan, but create table first.
        console.log('⚙️ Creating/Updating settings table...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT PRIMARY KEY DEFAULT 1,
                app_name VARCHAR(255) DEFAULT 'IPTV Panel',
                smtp_host VARCHAR(255) DEFAULT '',
                smtp_user VARCHAR(255) DEFAULT '',
                smtp_pass VARCHAR(255) DEFAULT '',
                smtp_port INT DEFAULT 587,
                smtp_secure BOOLEAN DEFAULT FALSE,
                qris_data TEXT,
                telegram_bot_token VARCHAR(255) DEFAULT '',
                telegram_admin_id VARCHAR(255) DEFAULT ''
            )
        `);

        // Insert default row if empty
        await conn.query(`
            INSERT INTO settings (id, app_name) 
            SELECT 1, 'IPTV Panel' 
            WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 1)
        `);

        // Ensure columns exist (in case table existed but was old)
        const columns = [
            "ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255) DEFAULT ''",
            "ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(255) DEFAULT ''",
            "ADD COLUMN IF NOT EXISTS smtp_pass VARCHAR(255) DEFAULT ''",
            "ADD COLUMN IF NOT EXISTS smtp_port INT DEFAULT 587",
            "ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT FALSE",
            "ADD COLUMN IF NOT EXISTS qris_data TEXT",
            "ADD COLUMN IF NOT EXISTS telegram_bot_token VARCHAR(255) DEFAULT ''",
            "ADD COLUMN IF NOT EXISTS telegram_admin_id VARCHAR(255) DEFAULT ''"
        ];

        for (const col of columns) {
            try {
                await conn.query(`ALTER TABLE settings ${col}`);
            } catch (e) { /* ignore */ }
        }


        // 2. Create Clients Table
        console.log('👤 Creating clients table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                phone VARCHAR(50),
                is_verified BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 3. Create Email Verifications Table
        console.log('📧 Creating email_verifications table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS email_verifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                code VARCHAR(10) NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX (email),
                INDEX (code)
            )
        `);

        // 4. Create Orders Table
        console.log('🛒 Creating orders table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS orders (
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
            )
        `);

        await conn.commit();
        console.log('✅ Migration Phase 10 Completed Successfully!');
        process.exit(0);

    } catch (err) {
        await conn.rollback();
        console.error('❌ Migration Failed:', err);
        process.exit(1);
    } finally {
        conn.release();
    }
}

migrate();
