const TelegramBot = require('node-telegram-bot-api');
const { pool } = require('../config/database');

class TelegramService {
    static bot = null;
    static isInitialized = false;

    static async initialize() {
        try {
            const [settings] = await pool.execute('SELECT telegram_bot_token, telegram_admin_id FROM settings WHERE id = 1');
            const token = settings[0]?.telegram_bot_token;
            const adminId = settings[0]?.telegram_admin_id;

            if (!token || !adminId) {
                console.log('Telegram bot not configured');
                return false;
            }

            this.bot = new TelegramBot(token, { polling: true });
            this.adminId = adminId;
            this.isInitialized = true;

            // Handle callback queries (button clicks)
            this.bot.on('callback_query', async (query) => {
                await this.handleCallback(query);
            });

            console.log('Telegram bot initialized successfully');
            return true;
        } catch (err) {
            console.error('Failed to initialize Telegram bot:', err.message);
            return false;
        }
    }

    static async sendOrderNotification(order) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!this.bot) return;

        try {
            const message = `
🛒 *New Order Received*

📦 Package: ${order.package_name}
💰 Amount: Rp ${order.amount.toLocaleString()}
👤 Client ID: ${order.client_id}
📅 Date: ${new Date().toLocaleString()}

Status: Waiting for approval
            `.trim();

            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: `approve_${order.id}` },
                        { text: '❌ Reject', callback_data: `reject_${order.id}` }
                    ]
                ]
            };

            await this.bot.sendMessage(this.adminId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

        } catch (err) {
            console.error('Failed to send Telegram notification:', err.message);
        }
    }

    static async handleCallback(query) {
        const data = query.data;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        try {
            if (data.startsWith('approve_')) {
                const orderId = data.replace('approve_', '');
                await this.approveOrder(orderId);

                await this.bot.editMessageText(
                    query.message.text + '\n\n✅ *APPROVED*',
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
                );
                await this.bot.answerCallbackQuery(query.id, { text: 'Order approved!' });

            } else if (data.startsWith('reject_')) {
                const orderId = data.replace('reject_', '');
                await this.rejectOrder(orderId);

                await this.bot.editMessageText(
                    query.message.text + '\n\n❌ *REJECTED*',
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
                );
                await this.bot.answerCallbackQuery(query.id, { text: 'Order rejected!' });
            }
        } catch (err) {
            console.error('Callback error:', err);
            await this.bot.answerCallbackQuery(query.id, { text: 'Error processing' });
        }
    }

    static async approveOrder(orderId) {
        // Update order status
        await pool.execute(
            'UPDATE orders SET status = ?, approved_at = NOW() WHERE id = ?',
            ['approved', orderId]
        );

        // Get order details for activation
        const [orders] = await pool.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        const order = orders[0];

        if (order) {
            // Get client info
            const [clients] = await pool.execute('SELECT * FROM clients WHERE id = ?', [order.client_id]);
            const client = clients[0];

            if (client) {
                // Generate random username and password
                const username = 'user_' + Math.random().toString(36).substring(2, 10);
                const password = Math.random().toString(36).substring(2, 12);

                // Calculate expiry date
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + order.package_days);

                // Create IPTV user
                const [result] = await pool.execute(
                    `INSERT INTO users (username, password, email, exp_date, max_connections, is_trial, status, created_by)
                     VALUES (?, ?, ?, ?, 1, 0, 'active', 'system')`,
                    [username, password, client.email, expiryDate]
                );

                const userId = result.insertId;

                // Assign default bouquet (first available)
                const [bouquets] = await pool.execute('SELECT id FROM bouquets LIMIT 1');
                if (bouquets.length > 0) {
                    await pool.execute(
                        'INSERT INTO user_bouquets (user_id, bouquet_id) VALUES (?, ?)',
                        [userId, bouquets[0].id]
                    );
                }

                // Update order with user credentials
                await pool.execute(
                    'UPDATE orders SET activated_user_id = ?, activation_notes = ? WHERE id = ?',
                    [userId, JSON.stringify({ username, password }), orderId]
                );

                console.log(`Order ${orderId} activated: Created user ${username} for client ${client.email}`);

                // Send activation email (optional enhancement)
                try {
                    const EmailService = require('./emailService');
                    await EmailService.sendActivationEmail(client.email, username, password, expiryDate);
                } catch (err) {
                    console.error('Failed to send activation email:', err.message);
                }
            }
        }
    }

    static async rejectOrder(orderId) {
        await pool.execute(
            'UPDATE orders SET status = ? WHERE id = ?',
            ['rejected', orderId]
        );
    }
}

module.exports = TelegramService;
