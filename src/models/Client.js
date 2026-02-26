const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

class Client {
    static async create({ email, password, name, phone }) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO clients (email, password, name, phone, is_verified) VALUES (?, ?, ?, ?, FALSE)',
            [email, hashedPassword, name, phone]
        );
        return result.insertId;
    }

    static async findByEmail(email) {
        const [rows] = await pool.execute('SELECT * FROM clients WHERE email = ?', [email]);
        return rows[0];
    }

    static async verify(id) {
        await pool.execute('UPDATE clients SET is_verified = TRUE WHERE id = ?', [id]);
    }

    static async checkPassword(client, password) {
        return await bcrypt.compare(password, client.password);
    }
}

module.exports = Client;
