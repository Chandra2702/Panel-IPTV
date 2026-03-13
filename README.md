# 📺 Panel IPTV

Panel manajemen IPTV berbasis **Node.js + Express + MySQL/MariaDB** dengan Admin UI modern menggunakan **Vue.js**.

## ✨ Fitur Utama

### 🔐 Manajemen User
- Tambah, edit, hapus user IPTV
- Sistem **Device Lock** — playlist terkunci ke perangkat pertama (tanpa lock IP, aman pindah WiFi/data)
- Max connections per user
- Expiry date otomatis
- Reset device lock dari admin panel

### 📦 Bouquet & Paket
- Manajemen paket/bouquet channel
- Durasi paket configurable (trial, bulanan, tahunan, lifetime)
- Assign paket ke user

### 📡 Channel Management
- Tambah/edit/hapus channel
- Support DRM (license type & key)
- Custom User-Agent & Referrer per channel
- Extra props (KODIPROP, EXTVLCOPT)
- Kategori/group channel
- Drag & drop reorder channel

### 👥 Reseller System
- Multi-level: Admin & Reseller
- Token/credit system untuk reseller
- Reseller bisa buat user sendiri dengan token
- Pembatasan akses sesuai role

### 🔗 Shortlink
- Generate shortlink untuk playlist user
- Proxy mode — shortlink langsung serve playlist tanpa redirect
- Integrasi TinyURL API

### 📊 Monitoring & Dashboard
- Dashboard statistik (total user, aktif, channel, dll)
- Stream monitoring — log aktivitas streaming user
- Activity log

### 🤖 Telegram Bot
- Notifikasi order via Telegram
- Manajemen melalui Telegram

### 🔒 Keamanan
- Device fingerprint (UA-based)
- Bot/browser detection & blocking
- Whitelist IP & User-Agent per user
- Session-based admin auth

---

## 🚀 Instalasi

### Auto Install (Ubuntu/Debian/Armbian)

```bash
sudo bash install.sh
```

Dengan opsi:
```bash
sudo bash install.sh --port 8080 --db-name iptv --db-user iptv --db-pass secretpass
```

### Manual Install

#### Prasyarat
- Node.js 20+
- MySQL / MariaDB

#### Langkah

```bash
# Clone repository
git clone https://github.com/Chandra2702/Panel-IPTV.git
cd Panel-IPTV

# Copy dan edit konfigurasi
cp .env.example .env
# Edit .env sesuai kebutuhan (database, port, dll)

# Install dependencies
npm install

# Build Admin UI
cd admin-ui && npm install && npm run build && cd ..

# Inisialisasi database
npm run db:init

# Jalankan server
npm start
```

---

## ⚙️ Konfigurasi (.env)

| Variable | Deskripsi | Default |
|----------|-----------|---------|
| `DB_HOST` | Host database | `localhost` |
| `DB_USER` | User database | `root` |
| `DB_PASS` | Password database | - |
| `DB_NAME` | Nama database | `iptv_panel` |
| `PORT` | Port server | `3000` |
| `SESSION_SECRET` | Secret untuk session | - |
| `NODE_ENV` | Environment | `development` |
| `WEBSITE_URL` | URL website (untuk redirect browser) | - |

---

## 📁 Struktur Proyek

```
Panel-IPTV/
├── src/
│   ├── app.js              # Entry point
│   ├── config/
│   │   └── database.js     # Koneksi DB & inisialisasi tabel
│   ├── middleware/
│   │   └── botDetector.js   # Deteksi bot & browser
│   ├── routes/
│   │   ├── auth.js          # Login/logout admin
│   │   ├── playlist.js      # Generate M3U playlist
│   │   ├── stream.js        # Stream proxy/redirect
│   │   ├── shortlink.js     # Shortlink handler
│   │   ├── proxy.js         # HTTP proxy
│   │   ├── public.js        # Public API (order, live)
│   │   └── admin/           # Admin API routes
│   │       ├── users.js
│   │       ├── channels.js
│   │       ├── bouquets.js
│   │       ├── categories.js
│   │       ├── resellers.js
│   │       ├── shortlinks.js
│   │       ├── monitor.js
│   │       ├── settings.js
│   │       └── dashboard.js
│   └── services/
│       ├── telegramService.js
│       └── emailService.js
├── admin-ui/                # Vue.js Admin Panel
├── public/                  # Static files & built admin UI
├── scripts/
│   └── init_db.js           # Database initializer
├── install.sh               # Auto installer
├── update.sh                # Auto updater
├── uninstall.sh             # Uninstaller
└── package.json
```

---

## 🛠️ Perintah Berguna

```bash
# Development mode (auto-reload)
npm run dev

# Production
npm start

# Build admin UI
npm run build:admin

# Init database
npm run db:init
```

### Systemd Service (setelah install.sh)

```bash
systemctl status iptv-panel     # Cek status
systemctl restart iptv-panel    # Restart
systemctl stop iptv-panel       # Stop
journalctl -u iptv-panel -f     # Lihat log
```

---

## 📱 Kompatibel Dengan

- TiviMate
- OTT Navigator
- VLC Media Player
- IPTV Smarters
- m3u-ip.tv
- ExoPlayer-based apps

---

## 📄 Lisensi

MIT License
