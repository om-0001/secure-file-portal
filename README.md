# Secure File Exchange Portal with Cryptographic Ephemeral Link Control

A robust, enterprise-grade, privacy-centric web portal designed for temporary, strictly controlled file exchanges. Senders upload, scan, encrypt, and bind ephemeral links to specific receivers with precise view-only / download policies, expiration timers, and maximum access counters.

---

## 🌟 Key Features

1. **Malware Quarantine & Scan**: Integrates with ClamAV (or isolated mock mode) before files ever reach permanent storage.
2. **AES-256-GCM Encryption**: Files are encrypted at rest with authenticated ciphertexts and distinct initialization vectors (IVs).
3. **Cryptographically Secure Random Tokens**: 256-bit CSPRNG URLs (`secrets.token_urlsafe`), protected via SHA-256 hashing at rest.
4. **Strict Receiver Binding**: Ephemeral links are tied to the recipient's authenticated account—forwarding the link to unauthorized users results in `ACCESS DENIED`.
5. **Server-Enforced View-Only Control**: In-browser document viewer with no download buttons, reinforced by server-side rejection of download endpoints.
6. **Time & Counter Invalidation**: Links immediately self-destruct once their expiration timestamp or maximum access limit is reached.
7. **Instant Manual Revocation**: Senders can terminate an active link at any point in time.
8. **Comprehensive Audit Logging**: All security events (scans, grants, rejections, unauthorized forwarding attempts) are immutably logged.

---

## 🛠️ Technology Stack

- **Frontend**: React.js (Vite), Modern Vanilla CSS, Context API
- **Backend**: Python 3.11, Django 5.x, Django REST Framework
- **Database**: PostgreSQL 16 (or SQLite for development)
- **Security & Cryptography**: AES-256-GCM (`cryptography`), SHA-256, CSPRNG (`secrets`)
- **Malware Scanning**: ClamAV Antivirus Daemon

---

## 📁 Repository Structure

```
├── backend/            # Django REST API backend
│   ├── config/         # Settings & URLs
│   ├── apps/           # Modular applications (accounts, files, security, access_control)
│   └── requirements.txt
├── frontend/           # React + Vite frontend application
├── storage/            # Local isolated storage
│   ├── quarantine/     # Temporary hold for scanned files
│   ├── encrypted/      # AES-256-GCM ciphertext vault
│   └── test_samples/   # Test files (PDF, DOCX, IMG, EICAR)
├── docs/               # System documentation & college project report
├── docker-compose.yml  # Docker environment for Postgres & ClamAV
├── .env.example        # Environment variable template
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
