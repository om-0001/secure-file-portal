# Secure File Exchange with Cryptographic Ephemeral Access Control & Cross-Platform Sharing

An enterprise-grade, privacy-centric file exchange portal engineered with **Zero-Trust Access Control**, **Hardware-grade AES-256-GCM Encryption**, and **Cross-Platform Ephemeral Sharing**. Senders can securely distribute temporary access links through **WhatsApp, Gmail, Telegram, Native Device Share, and Direct Copy Link** while retaining centralized, revocable access control over the underlying file.

---

## 🌟 Key Features

### 1. Cross-Platform External App Sharing (New Feature)
- **WhatsApp**: Generates direct WhatsApp web/app intent links with pre-filled security advisory and ephemeral access URL.
- **Gmail**: Creates pre-formatted draft emails with subject, policy description, recipient verification notice, and access link.
- **Telegram**: Prepares seamless Telegram share intents with secure URL and summary.
- **Native Device Share**: Integrates with the browser's `navigator.share` API on supported mobile and desktop browsers.
- **Copy Link**: Copies the cryptographically bound access URL directly to the clipboard with one-click feedback.
- **No Third-Party Account Linking**: Users do **not** need to link personal WhatsApp, Telegram, or Gmail credentials to the portal; standard web intents and protocols are leveraged securely.

### 2. Receiver-Bound Link Protection
- **Anti-Forwarding Protection**: The ephemeral sharing URL is **not sufficient on its own** to authorize access.
- Each link is cryptographically bound to the intended recipient's authenticated account on the backend.
- If **Receiver A** forwards the link to **Receiver B**, Receiver B is rejected with a `403 Forbidden` (`You are not the designated recipient for this file`).
- URLs contain **no secret encryption keys, passwords, or plaintext filenames**.

### 3. Sender Dashboard: External Shares & Telemetry
- Dedicated **External Shares** tab displaying:
  - **File Name** and size
  - **Intended Receiver** email and identity
  - **Sharing Method** badge (WhatsApp, Gmail, Telegram, Native Share, Copy Link)
  - **Access Mode** (View Only vs Decrypted Download)
  - **Link Creation Time** & **Expiry Timestamp**
  - **Access Usage** (e.g. `1 / 3 accesses`)
  - **Current Status** (`Active`, `Expired`, `Revoked`, `Access Limit Reached`)
  - **Last Access Time** (Timestamp of the most recent access event or "Never")
- Interactive Actions:
  - **Copy Link**: Copy ephemeral URL to clipboard.
  - **Share Again**: Re-open WhatsApp, Gmail, Telegram, or Native Share sheet.
  - **View Access History**: Audit trail modal displaying all access attempts, external shares, and timestamps for that specific policy.
  - **Revoke Access**: Instant server-side revocation that invalidates the link across all external apps immediately.

### 4. Zero-Trust Security Pipeline
1. **Malware Quarantine & Scan**: Scans all uploaded files against ClamAV antivirus signatures (and mock signatures like EICAR) before saving.
2. **AES-256-GCM Envelope Encryption**: Plaintext files are never persisted on disk. Each file is encrypted with a unique 256-bit symmetric key, 96-bit IV, and 128-bit authentication tag.
3. **CSPRNG Ephemeral Access Tokens**: 256-bit cryptographic entropy URLs (`secrets.token_urlsafe(32)`) hashed at rest with SHA-256 to prevent token extraction from database dumps.
4. **Server-Enforced View-Only**: View-Only mode renders documents in a protected, watermarked in-browser canvas viewer. Download endpoints are strictly blocked at the backend with `403 Forbidden`.
5. **Time & Counter Expiration**: Links self-destruct upon reaching their TTL (e.g., 5 min, 15 min, 1 hr) or max access counter.
6. **Immutable Audit Logging**: Every grant, download, external share event, and failed forward attempt is recorded.

---

## ⚠️ Important Architectural Limitations

As documented in Section 8 of the security architecture:
1. **Controlled Access Links vs. Raw Attachments**: The portal distributes a temporary, controlled access link rather than sending an uncontrolled raw file attachment.
2. **Post-Download Retention Limitation**: If a sender grants **Download** permission and the authorized receiver downloads the plaintext file, the portal cannot remotely delete that local copy from the receiver's physical storage or prevent them from copying it elsewhere.
3. **View-Only Mode Limitation**: View-Only mode renders documents in a canvas viewer with identity watermarks to deter leakage, but cannot physically prevent physical camera captures or external OS-level screen recording.

These limitations are disclosed transparently to senders in the portal interface.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Frontend** | React 18, Vite, Vanilla CSS, Lucide Icons, PDF.js |
| **Backend** | Python 3.11+, Django 5.x, Django REST Framework |
| **Database** | SQLite (Dev) / PostgreSQL (Production) |
| **Cryptography** | AES-256-GCM (`cryptography`), SHA-256, CSPRNG (`secrets`) |
| **Malware Engine** | ClamAV Antivirus Daemon + Isolated Quarantine |
| **Sharing Integrations** | WhatsApp Web Intents, Gmail Web Compose, Telegram API, Web Share API |

---

## 📁 Repository Structure

```
├── backend/
│   ├── config/                     # Django settings, URLs, WSGI
│   ├── apps/
│   │   ├── accounts/               # User authentication, roles, tokens
│   │   ├── files/                  # AES-256-GCM storage, quarantine, ClamAV
│   │   └── access_control/         # Policies, tokens, sharing, validator, history
│   ├── tests/
│   │   └── test_full_system.py     # 16 automated end-to-end security test cases
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/             # ExternalShareModal, PolicyHistoryModal, StatusBadge...
│   │   ├── pages/                  # UnifiedPortal, AccessPortalPage, DocumentViewer...
│   │   ├── api/                    # Centralized fetch client
│   │   └── context/                # AuthContext
│   ├── package.json
│   └── vite.config.js
├── storage/
│   ├── quarantine/                 # Isolated temporary upload buffer
│   └── encrypted/                  # AES-256-GCM ciphertext vault
└── README.md
```

---

## 🚀 Setup and Run Instructions

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher & npm

### 1. Backend Setup & Run
```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start backend server on port 8000
python manage.py runserver 8000
```
Backend API will be accessible at: `http://localhost:8000`

### 2. Frontend Setup & Run
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend Web Portal will be accessible at: `http://localhost:5173`

---

## 📡 API Endpoints Reference

### Authentication & Receivers
- `POST /api/auth/register/` - Register sender or receiver account
- `POST /api/auth/login/` - Login and receive DRF Auth Token
- `GET /api/auth/receivers/` - List registered recipients for auto-complete

### File Upload & Encryption
- `POST /api/files/upload/` - Upload file to quarantine, scan for malware, encrypt with AES-256-GCM
- `GET /api/files/` - List vaulted encrypted files owned by sender

### Ephemeral Access Policies & External Sharing
- `POST /api/access/shares/create/` - Create ephemeral access policy bound to receiver email
- `GET /api/access/shares/sent/` - List all shares created by sender (with status & counters)
- `GET /api/access/shares/received/` - List all incoming files bound to receiver account
- `POST /api/access/shares/<pk>/track-share/` - **[NEW]** Track external share channel (WHATSAPP, GMAIL, TELEGRAM, NATIVE, CLIPBOARD)
- `GET /api/access/shares/<pk>/history/` - **[NEW]** Retrieve detailed audit history and access events for a policy
- `POST /api/access/shares/<pk>/revoke/` - Immediately revoke active access policy

### Token Resolution & Consumption
- `GET /api/access/token/<raw_token>/validate/` - Verify token validity, recipient binding, expiry, and access limits
- `GET /api/access/token/<raw_token>/view/` - Stream decrypted bytes for in-browser viewer (watermarked)
- `GET /api/access/token/<raw_token>/download/` - Download decrypted plaintext file (blocked if `VIEW_ONLY`)

---

## 🧪 Automated Security Test Results

The automated test suite (`backend/tests/test_full_system.py`) verifies all 16 core security and external sharing test cases:

```bash
cd backend
.\venv\Scripts\python.exe manage.py test tests.test_full_system
```

### Test Case Execution Report (16 / 16 PASSED):

| Test ID | Test Scenario Description | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| **TC01** | Safe file upload & scanning | File scanned CLEAN; AES-256-GCM encrypted | Plaintext purged; ciphertext stored | **PASSED** |
| **TC02** | EICAR malware upload rejection | Infected file detected; rejected with 400 | File purged immediately; 0 records stored | **PASSED** |
| **TC03** | Ephemeral share creation & CSPRNG | 256-bit token generated; SHA-256 stored | Raw token returned in URL only | **PASSED** |
| **TC04** | Authorized receiver download permission | Receiver B downloads plaintext | 200 OK; access counter incremented | **PASSED** |
| **TC05** | View-Only server-side enforcement | Download endpoint rejected with 403 | 403 Forbidden ("View-Only policy") | **PASSED** |
| **TC06** | Unauthorized user forwarding prevention | Receiver C blocked from using Receiver B link | 403 Forbidden ("Not designated recipient") | **PASSED** |
| **TC07** | Link expiration enforcement | Access attempt after TTL rejected | 403 Forbidden ("Link has expired") | **PASSED** |
| **TC08** | Atomic access limit burn-after-reading | Link burns after reaching max accesses | 403 Forbidden ("Access limit reached") | **PASSED** |
| **TC09** | Instant sender revocation | Revoked link rejected immediately | 403 Forbidden ("Sender has revoked access")| **PASSED** |
| **TC10** | Optional file passphrase protection | 2FA password verified before grant | 403 on wrong password; 200 on correct | **PASSED** |
| **TC11** | Cross-platform sharing tracking & audit | Channel tracked; audit log updated | `WHATSAPP`/`TELEGRAM` logged; history accessible | **PASSED** |
| **TC12** | External sharing instant revocation | Link shared on WhatsApp revoked instantly | Subsequent WhatsApp access returns 403 | **PASSED** |
| **TC13** | Unauthorized forwarding across external apps | Receiver B forwards WhatsApp link to Charlie | Charlie blocked with 403 Forbidden | **PASSED** |
| **TC14** | External link expiry rejection | Telegram shared link rejected post-expiry | 403 Forbidden ("Link has expired") | **PASSED** |
| **TC15** | External link burn-after-reading (N=1) | Download allowed once, second attempt blocked | 1st access 200 OK; 2nd access 403 Forbidden | **PASSED** |
| **TC16** | All external channels supported | WhatsApp, Gmail, Telegram, Native, Copy tracked | `is_external=True`; channel badges updated | **PASSED** |

---

## 🎓 College Project Review Demonstration Walkthrough

Follow this step-by-step demonstration during project review:

### Step 1: Login as Sender
1. Open `http://localhost:5173`.
2. Login with sender credentials (`alice@example.com` / `AlicePassword123!`).

### Step 2: Upload, Encrypt, and Choose Sharing Method
1. Click **Send & Encrypt** on the Unified Portal dashboard.
2. Select your recipient: `bob@example.com`.
3. Choose your sharing destination:
   - **Option A: My Portal Direct Transfer**: File is delivered directly to the recipient's internal portal inbox.
   - **Option B: External App Sharing**: Generate an ephemeral access link and share via WhatsApp, Gmail, Telegram, Copy Link, or Native Device Share (the file itself is never sent over the external app—only the controlled access link).
4. Enter Subject and Message (communicates context securely).
5. Select **Access Mode**: `View Only` or `Download Allowed`.
6. Set **Link Expiration**: `15 Minutes` and **Max Accesses**: `2`.
7. Drag & drop or browse a file (e.g. PDF or DOCX).
8. Click **⚡ Send Secure Message & File**.
9. The pipeline executes: **Quarantine -> ClamAV Scan -> AES-256-GCM Encryption -> CSPRNG Ephemeral Token Generation**.

### Step 3: Demonstrate External Sharing Flow
1. If **Option B** was selected, the chosen sharing channel opens automatically (WhatsApp Web, Gmail compose, Telegram web intent, or system share sheet).
2. The generated link follows the format: `https://<frontend-url>/access?token=<64-char-csprng-token>`.
3. The success screen displays instant quick-share buttons for all channels.

### Step 4: Access as Authorized Receiver
1. Open an incognito browser window and navigate to the generated ephemeral URL (or check Bob's Received Files tab if Option A was used).
2. Login as the authorized receiver (`bob@example.com` / `BobPassword123!`).
3. The receiver views the document in the watermarked in-browser viewer.
4. Attempting to call the download API directly is blocked if View Only was specified.

### Step 5: Test Anti-Forwarding (Receiver B forwards to Interceptor C)
1. Copy the same URL and login as `charlie@example.com` (unauthorized user).
2. The portal immediately rejects Charlie with:
   `"403 Forbidden: You are not the designated recipient for this file."`
3. Check the Audit Telemetry tab: the unauthorized attempt is logged with IP address and event `WRONG_RECEIVER`.

### Step 6: Separate Dashboard Tracking & Revocation
1. In the sender dashboard, observe two dedicated tracking tabs:
   - **My Portal Shares**: Tracks direct internal file deliveries, recipient verification status, and revocation.
   - **External Shares**: Tracks links shared via WhatsApp, Gmail, Telegram, and Copy Link, with specific channel badges, live access counters, and instant revocation buttons.
2. Click **Revoke** on any active share.
3. Refresh the receiver's page: access is immediately blocked server-side: `"The sender has revoked access to this file."`.

---

## 🚀 Live Server Deployment Guide (Render / Railway / Supabase)

### Production Architecture
- **Backend API**: Django 5 + Gunicorn + WhiteNoise on Render Web Service.
- **Frontend SPA**: React 18 + Vite on Render Static Site (or Vercel).
- **Database**: Hosted PostgreSQL (Render Managed Postgres, Supabase, or Neon) via `DATABASE_URL`.
- **Encrypted Storage Vault**: Render Persistent Disk mounted at `/var/data` (`STORAGE_DIR=/var/data/storage`).

### Step-by-Step Deployment (Render Blueprint)
1. Push all code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Add separated portal/external sharing and deployment configurations"
   git push origin main
   ```
2. Log into [Render.com](https://render.com) and click **New +** -> **Blueprint**.
3. Connect your GitHub repository. Render reads `render.yaml` automatically.
4. Render creates:
   - **PostgreSQL Database** (`secure-file-db`)
   - **Django Backend** (`secure-file-backend`) with persistent disk
   - **React Static Frontend** (`secure-file-frontend`)
5. In the backend service settings on Render, set:
   - `CORS_ALLOWED_ORIGINS`: `https://secure-file-frontend.onrender.com`
   - `CSRF_TRUSTED_ORIGINS`: `https://secure-file-frontend.onrender.com`
   - `FRONTEND_URL`: `https://secure-file-frontend.onrender.com`
6. In the frontend service settings, confirm:
   - `VITE_API_BASE_URL`: `https://secure-file-backend.onrender.com`

