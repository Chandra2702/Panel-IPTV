#!/bin/bash

# ============================================================
#  IPTV PANEL - INSTALLER (Node.js + MySQL)
#  Supports: Ubuntu 20+, Debian 11+, Armbian
#  Usage: sudo bash install.sh
#         sudo bash install.sh --port 8080
# ============================================================

set -e

# ======================== COLORS ============================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ======================== HELPERS ===========================
print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════╗"
    echo "║         🚀 IPTV PANEL - INSTALLER               ║"
    echo "║         Node.js + MySQL Edition                  ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info()    { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[✔]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[!]${NC}    $1"; }
log_error()   { echo -e "${RED}[✘]${NC}    $1"; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Script harus dijalankan sebagai root (sudo bash install.sh)"
        exit 1
    fi
}

# ======================== DEFAULTS ==========================
DEFAULT_PORT=3000

DEFAULT_DB_HOST="localhost"
DEFAULT_DB_NAME="iptv_panel"
DEFAULT_DB_USER="iptv"
DEFAULT_NODE_ENV="production"

# Script directory detection
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
INSTALL_DIR="/opt/iptv-panel"
SERVICE_NAME="iptv-panel"

# ===================== PARSE CLI ARGS =======================
CLI_PORT=""

CLI_DB_ROOT_PASS=""
CLI_DB_USER=""
CLI_DB_PASS=""
CLI_DB_NAME=""
CLI_NON_INTERACTIVE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)        CLI_PORT="$2"; shift 2 ;;

        --db-root-pass) CLI_DB_ROOT_PASS="$2"; shift 2 ;;
        --db-user)     CLI_DB_USER="$2"; shift 2 ;;
        --db-pass)     CLI_DB_PASS="$2"; shift 2 ;;
        --db-name)     CLI_DB_NAME="$2"; shift 2 ;;
        --yes|-y)      CLI_NON_INTERACTIVE="true"; shift ;;
        --help|-h)
            echo "Usage: sudo bash install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --port PORT          Port untuk Panel Server (default: $DEFAULT_PORT)"
            echo "  --db-root-pass PASS  MySQL Root password (jika ada)"
            echo "  --db-user USER       Database username (default: $DEFAULT_DB_USER)"
            echo "  --db-pass PASS       Database password"
            echo "  --db-name NAME       Database name (default: $DEFAULT_DB_NAME)"
            echo "  --yes, -y            Non-interactive mode (skip prompts)"
            echo "  --help, -h           Tampilkan bantuan ini"
            exit 0
            ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

# ===================== GATHER INPUT =========================
gather_config() {
    print_banner

    echo -e "${BOLD}📋 KONFIGURASI INSTALASI${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # --- PORT ---
    if [ -n "$CLI_PORT" ]; then
        APP_PORT="$CLI_PORT"
    elif [ "$CLI_NON_INTERACTIVE" = "true" ]; then
        APP_PORT="$DEFAULT_PORT"
    else
        read -p "$(echo -e "${CYAN}Port Panel Server${NC} [${DEFAULT_PORT}]: ")" APP_PORT
        APP_PORT=${APP_PORT:-$DEFAULT_PORT}
    fi

    # --- DATABASE ---
    echo -e "${YELLOW}Catatan: Kosongkan jika MySQL root Anda tidak menggunakan password (default di Ubuntu/Debian).${NC}"
    if [ -n "$CLI_DB_ROOT_PASS" ]; then
        DB_ROOT_PASS="$CLI_DB_ROOT_PASS"
    elif [ "$CLI_NON_INTERACTIVE" = "true" ]; then
        DB_ROOT_PASS=""
    else
        read -sp "$(echo -e "${CYAN}MySQL Root Password${NC}: ")" DB_ROOT_PASS
        echo ""
    fi

    if [ -n "$CLI_DB_NAME" ]; then
        DB_NAME="$CLI_DB_NAME"
    elif [ "$CLI_NON_INTERACTIVE" = "true" ]; then
        DB_NAME="$DEFAULT_DB_NAME"
    else
        read -p "$(echo -e "${CYAN}Database Name${NC} [${DEFAULT_DB_NAME}]: ")" DB_NAME
        DB_NAME=${DB_NAME:-$DEFAULT_DB_NAME}
    fi

    if [ -n "$CLI_DB_USER" ]; then
        DB_USER="$CLI_DB_USER"
    elif [ "$CLI_NON_INTERACTIVE" = "true" ]; then
        DB_USER="$DEFAULT_DB_USER"
    else
        read -p "$(echo -e "${CYAN}Database User${NC} [${DEFAULT_DB_USER}]: ")" DB_USER
        DB_USER=${DB_USER:-$DEFAULT_DB_USER}
    fi

    if [ -n "$CLI_DB_PASS" ]; then
        DB_PASS="$CLI_DB_PASS"
    elif [ "$CLI_NON_INTERACTIVE" = "true" ]; then
        DB_PASS="iptv$(openssl rand -hex 8)"
    else
        while true; do
            read -sp "$(echo -e "${CYAN}Database Password${NC}: ")" DB_PASS
            echo ""
            if [ -z "$DB_PASS" ]; then
                log_warn "Password tidak boleh kosong!"
            else
                break
            fi
        done
    fi

    # --- SESSION SECRET ---
    SESSION_SECRET=$(openssl rand -hex 32)

    # --- WEBSITE URL ---
    if [ "$CLI_NON_INTERACTIVE" = "true" ]; then
        WEBSITE_URL="http://localhost:${APP_PORT}"
    else
        read -p "$(echo -e "${CYAN}Website URL${NC} [http://localhost:${APP_PORT}]: ")" WEBSITE_URL
        WEBSITE_URL=${WEBSITE_URL:-"http://localhost:${APP_PORT}"}
    fi

    # --- CONFIRMATION ---
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}📋 RINGKASAN KONFIGURASI:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  Panel Port     : ${GREEN}${APP_PORT}${NC}"
    echo -e "  Database Name  : ${GREEN}${DB_NAME}${NC}"
    if [ -n "$DB_ROOT_PASS" ]; then
        echo -e "  MySQL Root Pass: ${GREEN}********${NC}"
    else
        echo -e "  MySQL Root Pass: ${GREEN}(kosong)${NC}"
    fi
    echo -e "  Database User  : ${GREEN}${DB_USER}${NC}"
    echo -e "  Database Pass  : ${GREEN}********${NC}"
    echo -e "  Website URL    : ${GREEN}${WEBSITE_URL}${NC}"
    echo -e "  Install Dir    : ${GREEN}${INSTALL_DIR}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ "$CLI_NON_INTERACTIVE" != "true" ]; then
        read -p "$(echo -e "${YELLOW}Lanjutkan instalasi? (y/n)${NC} ")" CONFIRM
        if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
            log_warn "Instalasi dibatalkan."
            exit 0
        fi
    fi
}

# ================= INSTALL DEPENDENCIES =====================
install_dependencies() {
    log_info "Mengupdate sistem & menginstall dependencies..."

    apt update -qq

    # Install essential packages
    apt install -y -qq curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg > /dev/null 2>&1
    log_success "Paket dasar terinstall."

    # ---- Node.js 20.x ----
    if command -v node > /dev/null 2>&1; then
        NODE_VER=$(node -v)
        log_info "Node.js terdeteksi: $NODE_VER"
    else
        log_info "Menginstall Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
        apt install -y -qq nodejs > /dev/null 2>&1
        log_success "Node.js $(node -v) terinstall."
    fi

    # ---- MariaDB ----
    if command -v mysql > /dev/null 2>&1; then
        log_info "MariaDB/MySQL sudah terinstall."
    else
        log_info "Menginstall MariaDB Server..."
        apt install -y -qq mariadb-server > /dev/null 2>&1
        systemctl start mariadb
        systemctl enable mariadb > /dev/null 2>&1
        log_success "MariaDB terinstall."
    fi
}

# ================== SETUP DATABASE ==========================
setup_database() {
    log_info "Mengkonfigurasi database..."

    systemctl start mariadb 2>/dev/null || true

    run_mysql() {
        if [ -n "$DB_ROOT_PASS" ]; then
            mysql -u root -p"${DB_ROOT_PASS}" "$@"
        else
            mysql -u root "$@" 2>/dev/null || mysql "$@"
        fi
    }

    # Create database
    run_mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

    # Create user & grant privileges
    run_mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"

    run_mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"

    run_mysql -e "FLUSH PRIVILEGES;"

    log_success "Database '${DB_NAME}' dengan user '${DB_USER}' siap."
}

# ================== DEPLOY APPLICATION =====================
deploy_app() {
    log_info "Mendeploy aplikasi ke ${INSTALL_DIR}..."

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Install git if needed
    if ! command -v git > /dev/null 2>&1; then
        apt install -y -qq git > /dev/null 2>&1
    fi

    # Clone repository to a temporary directory
    TMP_DIR=$(mktemp -d)
    log_info "Mendownload source code dari GitHub..."
    git clone -q https://github.com/Chandra2702/Panel-IPTV.git "$TMP_DIR" || {
        log_error "Gagal mendownload source code."
        exit 1
    }

    # Copy project files (exclude node_modules and .git)
    rsync -a --exclude='node_modules' \
             --exclude='.git' \
             --exclude='admin-ui/node_modules' \
             --exclude='admin-ui/dist' \
             "$TMP_DIR/" "$INSTALL_DIR/"

    rm -rf "$TMP_DIR"

    log_success "File aplikasi tercopy."

    # ---- Generate .env ----
    log_info "Membuat file konfigurasi .env..."
    cat > "$INSTALL_DIR/.env" <<EOF
# Database Configuration
DB_HOST=${DEFAULT_DB_HOST}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}

# Server Configuration
PORT=${APP_PORT}
API_URL=http://localhost:${APP_PORT}
SESSION_SECRET=${SESSION_SECRET}

# App Configuration
NODE_ENV=${DEFAULT_NODE_ENV}
WEBSITE_URL=${WEBSITE_URL}
EOF

    log_success "File .env dibuat."

    # ---- Install npm dependencies ----
    log_info "Menginstall npm dependencies (backend)..."
    cd "$INSTALL_DIR"
    npm install --omit=dev --silent 2>&1 | tail -1
    log_success "Dependencies backend terinstall."

    # ---- Build Admin UI ----
    log_info "Membuild Admin UI (Vue.js)..."
    if [ -d "$INSTALL_DIR/admin-ui" ]; then
        cd "$INSTALL_DIR/admin-ui"
        npm install --silent 2>&1 | tail -1
        npm run build 2>&1 | tail -3
        log_success "Admin UI berhasil di-build."
    else
        log_warn "Folder admin-ui tidak ditemukan, skip build."
    fi

    # ---- Initialize Database Tables ----
    log_info "Menginisialisasi tabel database..."
    cd "$INSTALL_DIR"
    node scripts/init_db.js 2>&1 || {
        log_warn "Inisialisasi DB manual — akan otomatis saat app start."
    }
    log_success "Database terinisialisasi."

    # Set permissions
    chown -R root:root "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
}

# ================== SYSTEMD SERVICE ========================
setup_service() {
    log_info "Membuat systemd service..."

    cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=IPTV Panel - Node.js Server
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which node) ${INSTALL_DIR}/src/app.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=${INSTALL_DIR}/.env

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}" > /dev/null 2>&1
    systemctl start "${SERVICE_NAME}"

    # Wait a moment and check status
    sleep 3
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        log_success "Service '${SERVICE_NAME}' berjalan."
    else
        log_warn "Service gagal start. Cek log: journalctl -u ${SERVICE_NAME} -n 50"
    fi
}

# ================== FIREWALL ================================
setup_firewall() {
    if command -v ufw > /dev/null 2>&1; then
        log_info "Mengkonfigurasi UFW firewall..."
        ufw allow "${APP_PORT}/tcp" > /dev/null 2>&1
        log_success "Port ${APP_PORT} diizinkan di firewall."
    fi
}

# ================== PRINT RESULT ============================
print_result() {
    # Get server IP
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    SERVER_IP=${SERVER_IP:-"YOUR-SERVER-IP"}

    echo ""
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════╗"
    echo "║       🎉 INSTALASI BERHASIL!                     ║"
    echo "╠══════════════════════════════════════════════════╣"
    echo -e "║  ${BOLD}Panel URL${NC}${GREEN}  : http://${SERVER_IP}:${APP_PORT}        "
    echo -e "║  ${BOLD}Admin Login${NC}${GREEN} : admin / admin123              "
    echo "╠══════════════════════════════════════════════════╣"
    echo -e "║  ${BOLD}Database${NC}${GREEN}    : ${DB_NAME}                     "
    echo -e "║  ${BOLD}DB User${NC}${GREEN}     : ${DB_USER}                     "
    echo -e "║  ${BOLD}Install Dir${NC}${GREEN} : ${INSTALL_DIR}                 "
    echo -e "║  ${BOLD}Service${NC}${GREEN}     : ${SERVICE_NAME}                "
    echo "╠══════════════════════════════════════════════════╣"
    echo "║  📌 USEFUL COMMANDS:                              ║"
    echo "║  Status  : systemctl status ${SERVICE_NAME}     "
    echo "║  Restart : systemctl restart ${SERVICE_NAME}    "
    echo "║  Logs    : journalctl -u ${SERVICE_NAME} -f     "
    echo "║  Stop    : systemctl stop ${SERVICE_NAME}       "
    echo "╚══════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# ======================== MAIN ==============================
main() {
    check_root
    gather_config
    install_dependencies
    setup_database
    deploy_app
    setup_service
    setup_firewall
    print_result
}

main
