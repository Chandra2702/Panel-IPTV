#!/bin/bash

# ============================================================
#  IPTV PANEL - UPDATER
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
        log_error "Script harus dijalankan sebagai root (sudo bash update.sh)"
        exit 1
    fi
}

INSTALL_DIR="/opt/iptv-panel"
SERVICE_NAME="iptv-panel"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║          🔄 IPTV PANEL - UPDATER                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

check_root

if [ ! -d "$INSTALL_DIR" ]; then
    log_error "Instalasi Panel-IPTV tidak ditemukan di ${INSTALL_DIR}."
    exit 1
fi

log_info "1. Menghentikan service sementara..."
systemctl stop "${SERVICE_NAME}" || log_warn "Tidak dapat menghentikan service, mungkin belum berjalan."

log_info "2. Mengambil pembaruan terbaru dari repositori GitHub..."
cd "$INSTALL_DIR"

if [ ! -d ".git" ]; then
    log_info "Mengubah folder ke mode Git Repository..."
    git init -q
    git remote add origin https://github.com/Chandra2702/Panel-IPTV.git || true
    git fetch --all -q
    git reset --hard origin/main -q
else
    # Jika sudah berformat git
    log_info "Menarik (pull) perubahan terbaru..."
    git fetch origin main -q
    git reset --hard origin/main -q
fi
log_success "Source code berhasil diupdate."

log_info "3. Menginstall NPM Dependencies terbaru (Backend)..."
npm install --omit=dev --silent 2>&1 | tail -1
log_success "Dependensi Backend selesai."

if [ -d "$INSTALL_DIR/admin-ui" ]; then
    log_info "4. Memperbarui dan me-rebuild Admin UI (Frontend)..."
    cd "$INSTALL_DIR/admin-ui"
    npm install --silent 2>&1 | tail -1
    npm run build 2>&1 | tail -3
    log_success "Admin UI berhasil direbuild."
else
    log_warn "Folder admin-ui tidak ditemukan, melewatkan proses build frontend."
fi

# Set permissions
chown -R root:root "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"

log_info "5. Menjalankan ulang service Panel..."
systemctl daemon-reload
systemctl start "${SERVICE_NAME}"
systemctl enable "${SERVICE_NAME}" > /dev/null 2>&1

sleep 2
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    echo ""
    echo -e "${GREEN}✅ UPDATE BERHASIL! Panel-IPTV telah diperbarui dan berjalan ulang.${NC}"
    echo "Silakan akses kembali di browser dan jangan lupa membersihkan Cache (CTRL + F5)."
    echo ""
else
    log_warn "Service gagal start otomatis. Silakan cek error log dengan: journalctl -u ${SERVICE_NAME} -n 20"
fi
