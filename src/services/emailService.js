const nodemailer = require('nodemailer');
const { pool } = require('../config/database');

class EmailService {
    static async getTransporter() {
        const [rows] = await pool.execute('SELECT * FROM settings WHERE id = 1');
        const settings = rows[0];

        if (!settings || !settings.smtp_host) {
            throw new Error('SMTP Settings not configured');
        }

        return nodemailer.createTransport({
            host: settings.smtp_host,
            port: settings.smtp_port,
            secure: settings.smtp_secure == 1, // true for 465, false for other ports
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass
            }
        });
    }

    static async sendOTP(email, code) {
        try {
            const transporter = await this.getTransporter();
            const [rows] = await pool.execute('SELECT app_name FROM settings WHERE id = 1');
            const appName = rows[0]?.app_name || 'IPTV Panel';

            const info = await transporter.sendMail({
                from: `"${appName}" <no-reply@panel.com>`,
                to: email,
                subject: `${code} is your verification code`,
                text: `Your verification code for ${appName} is: ${code}. It expires in 15 minutes.`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Verification Code</h2>
                        <p>Your verification code for <strong>${appName}</strong> is:</p>
                        <h1 style="color: #4f46e5; letter-spacing: 5px;">${code}</h1>
                        <p>This code expires in 15 minutes.</p>
                    </div>
                `
            });
            console.log('Email sent: %s', info.messageId);
            return true;
        } catch (err) {
            console.error('Email send error:', err);
            throw new Error('Failed to send email. Check SMTP settings.');
        }
    }

    static async sendActivationEmail(email, username, password, expiryDate) {
        try {
            const transporter = await this.getTransporter();
            const [rows] = await pool.execute('SELECT app_name FROM settings WHERE id = 1');
            const appName = rows[0]?.app_name || 'IPTV Panel';

            const info = await transporter.sendMail({
                from: `"${appName}" <no-reply@panel.com>`,
                to: email,
                subject: `Your IPTV Account is Ready!`,
                text: `Your IPTV account has been activated.\n\nUsername: ${username}\nPassword: ${password}\nExpires: ${expiryDate.toLocaleDateString()}\n\nEnjoy!`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
                        <h2 style="color: #4f46e5;">🎉 Your Account is Ready!</h2>
                        <p>Your order has been approved and your IPTV account is now active.</p>
                        
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
                            <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
                            <p style="margin: 5px 0;"><strong>Expires:</strong> ${expiryDate.toLocaleDateString()}</p>
                        </div>
                        
                        <p style="color: #666;">Use these credentials in your IPTV player app.</p>
                        <p>Thank you for your purchase!</p>
                    </div>
                `
            });
            console.log('Activation email sent: %s', info.messageId);
            return true;
        } catch (err) {
            console.error('Activation email error:', err);
            throw err;
        }
    }
}

module.exports = EmailService;
