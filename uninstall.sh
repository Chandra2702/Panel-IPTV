#!/bin/bash

# ============================================================
#  IPTV PANEL - UNINSTALLER
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[✔]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[!]${NC}    $1"; }
log_error()   { echo -e "${RED}[✘]${NC}    $1"; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Script harus dijalankan sebagai root (sudo bash uninstall.sh)"
        exit 1
    fi
}

INSTALL_DIR="/opt/iptv-panel"
SERVICE_NAME="iptv-panel"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║         🗑️ IPTV PANEL - UNINSTALLER              ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

check_root

read -p "$(echo -e "${YELLOW}🚨 PERINGATAN! Ini akan menghapus Panel-IPTV dari server Anda. Lanjutkan? (y/N): ${NC}")" confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    log_info "Proses uninstall dibatalkan."
    exit 0
fi

# 1. Stop and Disable Service
if systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
    log_info "Menghentikan service ${SERVICE_NAME}..."
    systemctl stop "${SERVICE_NAME}" || true
    systemctl disable "${SERVICE_NAME}" || true
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload
    log_success "Service ${SERVICE_NAME} dihapus."
else
    log_warn "Service ${SERVICE_NAME} tidak ditemukan, melompati..."
fi

# 2. Database Removal (Optional)
read -p "$(echo -e "${YELLOW}Hapus juga seluruh Database (iptv_panel) dan data penggunanya? (y/N): ${NC}")" del_db
if [[ "$del_db" =~ ^[Yy]$ ]]; then
    log_info "Menghapus database..."
    # Read the env file logic to find the database name if needed, but we'll try to find it
    if [ -f "$INSTALL_DIR/.env" ]; then
        source "$INSTALL_DIR/.env"
    else
        DB_NAME="iptv_panel"
        DB_USER="iptv"
    fi
    
    # Prompt for root password to drop
    read -sp "$(echo -e "${CYAN}Masukkan MySQL Root Password (biarkan kosong jika tidak dipassword): ${NC}")" db_root_pass
    echo ""
    
    if [ -n "$db_root_pass" ]; then
        mysql -u root -p"${db_root_pass}" -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;" 2>/dev/null || log_warn "Gagal menghapus database. Lanjutkan..."
        mysql -u root -p"${db_root_pass}" -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" 2>/dev/null || true
    else
        mysql -u root -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;" 2>/dev/null || log_warn "Gagal menghapus database. Lanjutkan..."
        mysql -u root -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" 2>/dev/null || true
    fi
    log_success "Database berhasil dihapus."
else
    log_info "Database dipertahankan."
fi

# 3. Remove application files
if [ -d "$INSTALL_DIR" ]; then
    log_info "Menghapus file aplikasi di ${INSTALL_DIR}..."
    rm -rf "$INSTALL_DIR"
    log_success "File aplikasi dihapus."
else
    log_warn "Folder aplikasi tidak ditemukan, melompati..."
fi

echo ""
echo -e "${GREEN}✅ UNINSTALL SELESAI! Panel-IPTV telah dihapus dari sistem Anda.${NC}"
echo ""
