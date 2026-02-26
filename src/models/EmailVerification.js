const { pool } = require('../config/database');

class EmailVerification {
    static async create(email, code) {
        // Delete old codes for this email
        await pool.execute('DELETE FROM email_verifications WHERE email = ?', [email]);

        // 15 minutes expiration
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await pool.execute(
            'INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)',
            [email, code, expiresAt]
        );
    }

    static async verify(email, code) {
        const [rows] = await pool.execute(
            'SELECT * FROM email_verifications WHERE email = ? AND code = ? AND expires_at > NOW()',
            [email, code]
        );
        return rows.length > 0;
    }

    static async cleanup(email) {
        await pool.execute('DELETE FROM email_verifications WHERE email = ?', [email]);
    }
}

module.exports = EmailVerification;
