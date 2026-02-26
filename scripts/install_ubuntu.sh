#!/bin/bash

# INSTALLER IPTV PANEL FOR UBUNTU SERVER (Nginx + PHP-FPM + MySQL)
# Run as root: sudo bash install_ubuntu.sh

# 1. CONFIGURATION
DB_NAME="iptv_panel"
DB_USER="root"
DB_PASS="admin123" # Same as in db.php
SITE_PATH="/var/www/html/iptv"

echo "🚀 STARTING INSTALLATION..."

# 2. UPDATE SYSTEM
apt update && apt upgrade -y
apt install -y nginx mariadb-server unzip git
apt install -y php-fpm php-mysql php-curl php-xml php-mbstring php-zip

# DETECT PHP VERSION
PHP_VER=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
echo "ℹ️ Detected PHP Version: $PHP_VER"

# 3. CONFIGURE DATABASE
echo "🛠️ CONFIGURING DATABASE..."
systemctl start mariadb
systemctl enable mariadb

# Setup Root Password & Create DB
# Note: Allows connection via password for root
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$DB_PASS';"
mysql -u root -p$DB_PASS -e "FLUSH PRIVILEGES;"
mysql -u root -p$DB_PASS -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"

echo "✅ Database '$DB_NAME' created."

# 4. SETUP FILES
echo "📂 SETTING UP FILES..."
mkdir -p $SITE_PATH
# Assuming you upload files to /tmp/iptv or git clone. 
# For now, we create a placeholder index if empty.
if [ -z "$(ls -A $SITE_PATH)" ]; then
   echo "<?php phpinfo(); ?>" > $SITE_PATH/index.php
   echo "⚠️ No files found inside script. Please upload your PHP files to $SITE_PATH"
fi

# Set Permissions
chown -R www-data:www-data $SITE_PATH
chmod -R 755 $SITE_PATH

# 5. CONFIGURE NGINX
echo "🌐 CONFIGURING NGINX..."
cat > /etc/nginx/sites-available/iptv <<EOF
server {
    listen 80;
    server_name _;
    root $SITE_PATH;
    index index.php index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php${PHP_VER}-fpm.sock;
    }

    location ~ /\.ht {
        deny all;
    }
}
EOF

# Enable Site
ln -sf /etc/nginx/sites-available/iptv /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Restart Nginx
nginx -t && systemctl restart nginx

echo "=================================================="
echo "🎉 INSTALLATION COMPLETE!"
echo "Put your PHP files in: $SITE_PATH"
echo "Database Host: localhost"
echo "Database Name: $DB_NAME"
echo "Database User: $DB_USER"
echo "Database Pass: $DB_PASS"
echo "=================================================="
