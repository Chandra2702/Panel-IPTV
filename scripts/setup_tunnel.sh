#!/bin/bash

# Cloudflare Tunnel Installer
echo "☁️ Installing Cloudflare Tunnel (cloudflared)..."

# Detect Arch
ARCH=$(dpkg --print-architecture)
if [[ "$ARCH" == "amd64" ]]; then
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
elif [[ "$ARCH" == "arm64" ]]; then
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb"
elif [[ "$ARCH" == "i386" || "$ARCH" == "i686" ]]; then
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-386.deb"
else
    echo "❌ Architecture $ARCH not supported automatically."
    exit 1
fi

# Download & Install
wget -q $URL -O cloudflared.deb
dpkg -i cloudflared.deb
rm cloudflared.deb

echo "✅ Cloudflared Installed!"
echo ""
echo "👉 NEXT STEPS (Run these manually):"
echo "1. Login to Cloudflare:"
echo "   cloudflared tunnel login"
echo ""
echo "2. Create Tunnel:"
echo "   cloudflared tunnel create iptv-server"
echo ""
echo "3. Connect Domain (Replace 'iptv.yourdomain.com' with your domain):"
echo "   cloudflared tunnel route dns iptv-server iptv.yourdomain.com"
echo ""
echo "4. Run Tunnel:"
echo "   cloudflared tunnel run --url http://localhost:80 iptv-server"
