#!/bin/bash

# NUCLEAR REPAIR FOR MARIADB / DPKG
# Purpose: Fix "Corrupt Info File" errors preventing installation/uninstallation.

echo "=========================================="
echo "    ☢️  MARIADB NUCLEAR REPAIR TOOL       "
echo "=========================================="
echo "This will forcibly remove package info for MariaDB"
echo "to allow apt/dpkg to recover."
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit
fi

# 1. STOP SERVICES
echo "🛑 Stopping Services..."
systemctl stop mysql 2>/dev/null
systemctl stop mariadb 2>/dev/null
killall -9 mysqld 2>/dev/null
killall -9 mysqld_safe 2>/dev/null

# 2. REMOVE CORRUPT DPKG INFO (The Key Step)
echo "🧹 Removing corrupt package info..."
rm -rf /var/lib/dpkg/info/mariadb*
rm -rf /var/lib/dpkg/info/mysql*
rm -rf /var/lib/dpkg/info/galera*

# 3. FORCE RECONFIGURE & FIX
echo "🔧 Fixing dpkg/apt state..."
dpkg --configure -a
apt update
apt install -f -y

# 4. OPTIONAL: PURGE MARIADB CLEANLY
echo ""
read -p "❓ Do you want to fully UNINSTALL MariaDB now? (y/n): " DO_PURGE
if [ "$DO_PURGE" == "y" ]; then
    echo "🗑️  Purging MariaDB..."
    apt purge -y mariadb-server mariadb-client mariadb-common mysql-common
    apt autoremove -y
    
    # Remove Data (Nuclear Option)
    rm -rf /var/lib/mysql
    rm -rf /etc/mysql
    
    echo "✅ MariaDB completely removed."
fi

echo ""
echo "✨ Repair Complete. You can now try installing again."
