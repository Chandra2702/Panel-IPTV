#!/bin/bash

# UNINSTALLER IPTV PANEL
# Removes Files, Nginx Config, and Database

# DEFAULTS
DB_NAME="iptv_panel"
APP_USER="iptv_user"
SITE_PATH="/var/www/html/iptv"

echo "=========================================="
echo "    🗑️  IPTV PANEL UNINSTALLER           "
echo "=========================================="
echo "⚠️  WARNING: This will DELETE all data!"
echo "   - Database: $DB_NAME"
echo "   - Files: $SITE_PATH"
echo "   - Nginx Config"
echo ""
read -p "Are you sure? Type 'DELETE' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
    echo "❌ Uninstallation Cancelled."
    exit 1
fi

echo ""
read -p "Enter MySQL Root Password (to drop DB): " DB_ROOT_PASS

# 1. REMOVE NGINX CONFIG
echo "🌐 REMOVING NGINX CONFIG..."
# Find files starting with iptv- in sites-available
rm -f /etc/nginx/sites-enabled/iptv-*
rm -f /etc/nginx/sites-available/iptv-*
systemctl reload nginx

# 2. REMOVE FILES
echo "📂 REMOVING FILES..."
rm -rf $SITE_PATH
echo "✅ Files removed."

# 3. DROP DATABASE (OPTIONAL)
echo ""
read -p "❓ Drop Database ($DB_NAME)? (y/n): " DROP_DB
if [ "$DROP_DB" == "y" ]; then
    read -p "Enter MySQL Root Password: " DB_ROOT_PASS
    echo "🗄️  DROPPING DATABASE..."
    mysql -u root -p"$DB_ROOT_PASS" -e "DROP DATABASE IF EXISTS $DB_NAME;"
    mysql -u root -p"$DB_ROOT_PASS" -e "DROP USER IF EXISTS '$APP_USER'@'localhost';"
    echo "✅ Database removed."
else
    echo "⏩ Database preserved."
fi

echo ""
echo "✨ Uninstallation Complete. System is clean."
