#!/bin/bash

# FIX NGINX CONFIG FOR IPTV MONITORING (Xtream Codes Support)
# Usage: sudo bash fix_nginx.sh [PORT]
# Default Port: 8080

PORT=${1:-8080}
CONFIG_FILE="/etc/nginx/sites-available/iptv-$PORT"
SITE_PATH="/var/www/html/iptv"

echo "🔧 FIXING NGINX CONFIGURATION FOR PORT: $PORT"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: Config file $CONFIG_FILE not found!"
    echo "   Please specify the correct port: sudo bash fix_nginx.sh <PORT>"
    exit 1
fi

# Backup
cp "$CONFIG_FILE" "${CONFIG_FILE}.bak"
echo "✅ Backup created: ${CONFIG_FILE}.bak"

# Write New Config with Rewrite Rule
cat > "$CONFIG_FILE" <<EOF
server {
    listen $PORT;
    server_name _;
    root $SITE_PATH;
    index index.php index.html;

    # Logs
    access_log /var/log/nginx/iptv_access.log;
    error_log /var/log/nginx/iptv_error.log;

    # MAIN LOCATION
    location / {
        try_files \$uri \$uri/ =404;
    }

    # XTREAM CODES API REDIRECT (LIVE)
    # Maps /live/user/pass/id.ts -> stream.php
    location /live/ {
        rewrite ^/live/([^/]+)/([^/]+)/([^/.]+)(?:\.(ts|m3u8))?\$ /stream.php?username=\$1&password=\$2&stream_id=\$3&ext=\$4 last;
    }

    # XTREAM CODES API REDIRECT (VOD/SERIES) - Optional placeholder
    location /movie/ {
        rewrite ^/movie/([^/]+)/([^/]+)/([^/.]+)(?:\.(mp4|mkv))?\$ /stream.php?username=\$1&password=\$2&stream_id=\$3&ext=\$4 last;
    }

    # PHP HANDLING
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        # Auto-detect PHP version or fallback to 8.2/8.1/7.4
        fastcgi_pass unix:/run/php/php8.2-fpm.sock; 
        # Note: If 8.2 fails, Nginx might error. The installer managed this dynamically.
        # We will try to preserve the existing PHP version line if possible, but hardcoding for now is risky.
        # Let's check socket path first.
    }

    # DENY HIDDEN FILES
    location ~ /\.ht {
        deny all;
    }
}
EOF

# FIX PHP VERSION (Retrieve from backup to be safe)
# Grep the socket path from backup
OLD_SOCK=$(grep "fastcgi_pass" "${CONFIG_FILE}.bak" | head -n 1 | awk '{print $2}' | sed 's/;//')
if [ ! -z "$OLD_SOCK" ]; then
    echo "ℹ️  Restoring PHP Socket: $OLD_SOCK"
    sed -i "s|fastcgi_pass unix:/run/php/php8.2-fpm.sock;|fastcgi_pass $OLD_SOCK;|" "$CONFIG_FILE"
fi

echo "✅ Configuration Updated."

# Test and Restart
nginx -t
if [ $? -eq 0 ]; then
    systemctl restart nginx
    echo "🚀 NGINX RESTARTED SUCCESSFULLY!"
    echo "👉 XC Monitoring Support Enabled."
else
    echo "❌ Nginx Config Error! Restoring backup..."
    cp "${CONFIG_FILE}.bak" "$CONFIG_FILE"
    systemctl restart nginx
fi
