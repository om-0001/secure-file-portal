# Secure File Exchange Portal with Cryptographic Ephemeral Link Control
## Comprehensive College Project Report & Technical Documentation

---

## 1. Abstract
In modern digital collaboration environments, standard file-sharing solutions (e.g., cloud drives, conventional shared links) distribute files under an implicit permanent permission model. Once a link is generated, it often remains valid indefinitely, can be arbitrarily forwarded to unauthorized parties, and lacks server-enforced granular usage constraints.

This project designs and implements the **Secure File Exchange Portal with Cryptographic Ephemeral Link Control**. The system ensures that **a link is never treated as permanent permission**. The portal implements an end-to-end security pipeline:
1. File validation and quarantine staging.
2. Malware scanning (ClamAV with transparent isolated fallback).
3. AES-256-GCM authenticated envelope encryption before persistence in an isolated vault.
4. Cryptographically secure random token generation (CSPRNG, 256 bits of entropy) stored as SHA-256 digests.
5. Strict receiver binding preventing unauthorized forwarding.
6. Server-side enforced View-Only streaming vs. Attachment downloading.
7. Atomic counter-based and time-based self-destruction.
8. Instant manual revocation by the sender.
9. An immutable security audit log recording every access attempt.

---

## 2. Problem Statement
When sensitive or proprietary files are shared across digital channels, senders routinely lose control over their data:
- **Link Forwarding**: A recipient forwards a confidential link to unauthorized third parties.
- **Perpetual Accessibility**: Links remain active long after their legitimate purpose has ended.
- **Uncontrolled Downloading**: Users download local copies when only viewing was intended.
- **Malware Propagation**: Senders unintentionally upload compromised or infected documents.
- **Lack of Accountability**: Organizations have no audit visibility into who accessed what, when, and from where.

---

## 3. Existing Systems vs. Proposed System

| Parameter | Conventional Cloud Links (Drive, Dropbox) | Proposed Secure File Exchange Portal |
| :--- | :--- | :--- |
| **Link Authorization** | Link possession equals access ("Bearer permission") | **Zero-Trust**: Link + Authenticated Designated Receiver required |
| **Forwarding Prevention** | None (Anyone with the URL can access) | **Strictly Blocked**: Unauthorized users receive `ACCESS DENIED (WRONG_RECEIVER)` |
| **At-Rest Security** | Cloud-managed encryption (transparent to users) | **AES-256-GCM Envelope Encryption** with distinct IVs & unique DEKs |
| **Malware Quarantine** | Scanned post-upload in background | **Pre-Storage Quarantine & Purge**: Threats rejected before persistence |
| **View-Only Enforcement** | Frontend UI toggle (download URL still accessible) | **Server-Side Rejection**: Backend returns `403 Forbidden` on download endpoints |
| **Access Limits** | Unlimited clicks/downloads | **Atomic Invalidation**: Self-destructs after 1 or $N$ accesses |
| **Audit Logs** | Limited or high-tier enterprise only | **Comprehensive Security Audit Trail** for every access and denial |

---

## 4. System Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                               SENDER WORKFLOW                                     |
+-----------------------------------------------------------------------------------+
  1. Authenticate (Session / DRF Token)
  2. Upload Document (Multipart/form-data)
         |
         v
  [ Quarantine Holding Area: storage/quarantine/ ]
         |
         v
  3. Malware Inspection (ClamAV Daemon / Isolated Scanner)
         |
         +-----> INFECTED? ---> Purge File Immediately ---> Return 400 Threat Alert
         |
        CLEAN
         |
         v
  4. Compute SHA-256 Plaintext Fingerprint (Integrity)
  5. Generate 256-bit DEK & 96-bit Nonce
  6. Encrypt Payload via AES-256-GCM
  7. Wrap DEK with Master KEK
  8. Store Ciphertext in [ storage/encrypted/{uuid}.enc ]
  9. Purge Quarantine Plaintext Immediately
 10. Configure Ephemeral Policy:
     - Designated Receiver (Receiver Binding)
     - Access Type (VIEW_ONLY vs DOWNLOAD)
     - Expiry Duration (e.g. 10 minutes)
     - Maximum Accesses (e.g. 1-time self-destruct)
 11. Generate CSPRNG Ephemeral Token:
     - Cleartext Token (256-bit entropy) sent in link
     - SHA-256 Token Hash stored in Database
         |
         v
+-----------------------------------------------------------------------------------+
|                        RECEIVER ACCESS & VALIDATION PIPELINE                      |
+-----------------------------------------------------------------------------------+
  Receiver opens: https://domain/access/{token}
         |
         v
  [ 12-Step Backend Access Validation Pipeline (Atomic) ]
  Step 1: Receiver Authentication Check
  Step 2: Lookup AccessToken by SHA-256(token)
  Step 3: Receiver Binding Check (Is current user == policy.receiver?)
          --> MISMATCH? Log WRONG_RECEIVER --> 403 Forbidden
  Step 4: Manual Revocation Check (Is status == REVOKED?)
          --> REVOKED? Log REVOKED --> 403 Forbidden
  Step 5: Expiration Timestamp Check (Is now >= expires_at?)
          --> EXPIRED? Invalidate Token & Status --> 403 Forbidden
  Step 6: Access Counter Check (Is access_count >= max_accesses?)
          --> LIMIT REACHED? Invalidate Token & Status --> 403 Forbidden
  Step 7: Token Active Check (Is token.is_active?)
  Step 8: Access Type Server Check:
          - If action is DOWNLOAD and policy is VIEW_ONLY:
            --> Block with 403 Forbidden!
  Step 9: Atomic Increment access_count (using select_for_update)
  Step 10: If access_count >= max_accesses, mark status = LIMIT_REACHED
  Step 11: Decrypt ciphertext in-memory using unwrapped DEK
  Step 12: Stream payload:
          - VIEW_ONLY: Content-Disposition: inline (In-Browser Renderer)
          - DOWNLOAD: Content-Disposition: attachment (Save to disk)
          - Record Security Audit Log
```

---

## 5. Database Design & Entity Relationships

```
+--------------------+        +---------------------+        +--------------------+
|       User         | 1    * |     AccessPolicy    | *    1 |        File        |
|--------------------|--------|---------------------|--------|--------------------|
| id (UUID, PK)      |        | id (UUID, PK)       |        | id (UUID, PK)      |
| username           |        | file_id (FK)        |        | uploaded_by (FK)   |
| email (Unique)     |        | sender_id (FK)      |        | original_name      |
| password (PBKDF2)  |        | receiver_id (FK)    |        | file_size_bytes    |
| role (Choice)      |        | access_type (Choice)|        | mime_type          |
| date_joined        |        | expires_at          |        | sha256_hash        |
+--------------------+        | max_accesses        |        | scan_status        |
          |                   | access_count        |        | scan_details       |
          | 1                 | status (Choice)     |        | encrypted_file_path|
          |                   | created_at          |        | created_at         |
          |                   | revoked_at          |        +--------------------+
          |                   +---------------------+                  | 1
          |                              | 1                           |
          |                              | 1                           | 1
          |                   +---------------------+        +--------------------+
          |                   |     AccessToken     |        |FileEncryptionMeta  |
          |                   |---------------------|        |--------------------|
          |                   | id (UUID, PK)       |        | id (UUID, PK)      |
          |                   | policy_id (FK)      |        | file_id (FK, Unique|
          |                   | token_hash (SHA-256)|        | algorithm (AES-GCM)|
          |                   | is_active (Boolean) |        | nonce_base64       |
          |                   | created_at          |        | encrypted_key_blob |
          |                   +---------------------+        +--------------------+
          |                              |
          +------------------------------+
          |
          v *
+--------------------+
|     AccessLog      |
|--------------------|
| id (UUID, PK)      |
| policy_id (FK Null)|
| file_id (FK Null)  |
| user_id (FK Null)  |
| event_type         |
| status             |
| ip_address         |
| user_agent         |
| details            |
| timestamp          |
+--------------------+
```

---

## 6. Cryptographic Mechanisms

### 6.1 AES-256-GCM (Galois/Counter Mode)
- **Symmetric Authenticated Encryption**: Provides confidentiality and cryptographic integrity verification in a single pass.
- **Envelope Encryption**: Each file generates a random 256-bit Data Encryption Key (DEK). The DEK is encrypted with the Master Key Encryption Key (KEK).
- **Nonce/IV**: A unique 96-bit random vector is generated per file. Nonce reuse is mathematically prevented.
- **128-bit Authentication Tag**: Any modification or tampering with the encrypted bytes causes decryption to fail instantly (`InvalidTag`).

### 6.2 SHA-256 Hashing vs. Encryption
- **Encryption**: Reversible with the secret key. Protects file confidentiality.
- **Hashing**: One-way irreversible mathematical digest.
  - Used for file integrity fingerprinting (`sha256_hash`).
  - Used to store access tokens safely (`token_hash = SHA-256(raw_token)`).
- **Password Hashing**: Django's implementation uses PBKDF2 with SHA-256 and unique salts across 720,000 iterations to resist brute-force attacks.

### 6.3 CSPRNG Ephemeral Token Generation
- Generated via Python's `secrets.token_urlsafe(32)` using the operating system's cryptographic entropy source (`/dev/urandom` / `CryptGenRandom`).
- 256 bits of entropy prevents brute-force guessing or URL enumeration.

---

## 7. Error Rectification Log (System Hardening During Development)

| Issue ID | Error Observed | Root Cause Analysis | Corrective Implementation | Retest Result |
| :--- | :--- | :--- | :--- | :--- |
| **ERR-01** | `TypeError: list indices must be integers or slices` during malware scan test | Extension whitelist check rejected `eicar.com` prior to reaching the malware scanner | Updated test suite to use permitted `.txt` extension (`eicar_test.txt`), allowing file to pass format validation and enter quarantine scanner | **PASSED**: Antimalware engine detected EICAR, purged quarantine file, and returned 400 threat alert |
| **ERR-02** | `AssertionError: 'limit' not found` during 2nd access request | `token_record.is_active` check executed before the specific `access_count >= max_accesses` condition | Reordered validation steps so specific policy states (`LIMIT_REACHED`, `REVOKED`, `EXPIRED`) precede the generic token inactive check | **PASSED**: Exact explanatory message returned to client and recorded in audit log |
| **ERR-03** | `AssertionError: 'revoked' not found` on revoked link | `is_active` check took precedence over `status == REVOKED` check | Moved manual revocation inspection to Step 4, immediately after receiver identity validation | **PASSED**: Client receives explicit `Access Denied: Access revoked by sender` |

---

## 8. Automated Test Suite Results

```text
Found 19 test(s).
System check identified no issues (0 silenced).
...................
----------------------------------------------------------------------
Ran 19 tests in 15.001s

OK
```

### Verified Test Cases:
1. **TC01**: Valid User Registration & Password Hashing
2. **TC02**: Registration Password Mismatch Rejection
3. **TC03**: Duplicate Email Conflict Detection
4. **TC04**: Valid Login with Username & Token Issuance
5. **TC05**: Valid Login with Email Address
6. **TC06**: Invalid Login Credentials Rejection
7. **TC07**: Unauthenticated Protected Route Rejection (401)
8. **TC08**: Authenticated Profile Fetching with Token (200)
9. **TC09**: Token Invalidation upon User Logout
10. **TC10**: Receiver List Filtering (Excludes Caller)
11. **TC11**: Safe File Upload, Malware Quarantine & AES-256-GCM Vaulting
12. **TC12**: Harmless EICAR Malware Detection & Immediate Disk Purge
13. **TC13**: Ephemeral Link Creation & CSPRNG Token Hashing
14. **TC14**: Unauthorized Forwarding Protection (Receiver B forwards to C $\rightarrow$ Access Denied)
15. **TC15**: Server-Side View-Only Enforcement (Blocks Download Endpoint with 403)
16. **TC16**: Download Permitted Policy (Attachment Stream with Decryption)
17. **TC17**: Atomic Access Counter & One-Time Self-Destruct Invalidation
18. **TC18**: Expiration Timestamp Self-Destruct Invalidation
19. **TC19**: Instant Manual Sender Revocation

---

## 9. Important Limitations & Security Disclosures

To maintain strict academic and professional integrity, the following limitations are documented:
1. **View-Only Mode**: Disabling browser download buttons and blocking the download endpoint prevents application-level file downloads. However, **no web application can prevent external screen recording, screenshot software, or physical photography** of visible pixels.
2. **Downloaded Plaintext Copies**: Once an authorized user downloads a plaintext file under a `DOWNLOAD` policy, subsequent local copying or offline sharing of that file cannot be prevented by the web server.
3. **Malware Detection**: ClamAV scanning checks against known signatures and heuristics, but cannot guarantee 100% detection of novel zero-day malware.
4. **Zero-Knowledge Architecture**: Because the server performs antimalware inspection and server-side policy enforcement before storage, the architecture is a secure vaulted server architecture rather than a zero-knowledge client-side end-to-end encryption (E2EE) system.

---

## 10. Week-by-Week Implementation Documentation

- **Week 1: Problem Identification & Literature Review**
  - Studied limitations of standard bearer-token links and loss of control over digital assets.
  - Defined system scope: Ephemeral link control, receiver binding, view-only vs. download server enforcement.
- **Week 2: Comparative Study & Cryptographic Design**
  - Investigated AES-256-GCM envelope encryption, CSPRNG randomness, and SHA-256 integrity digests.
  - Evaluated ClamAV quarantine workflows.
- **Week 3: System Architecture & Relational Schema**
  - Designed the 12-step validation pipeline.
  - Established database entity models: `User`, `File`, `FileEncryptionMetadata`, `AccessPolicy`, `AccessToken`, `AccessLog`.
- **Week 4: Implementation of Core Cryptographic & Antivirus Engines**
  - Built AES-256-GCM envelope encryption/decryption modules in Python.
  - Built ClamAV integration with transparent mock mode for harmless EICAR testing.
- **Week 5: Backend Policy Engine & REST API Development**
  - Implemented 12-step atomic validation pipeline.
  - Built upload, share, validate, view-only, download, and revoke API endpoints.
- **Week 6: Frontend Integration, Testing & Error Rectification**
  - Built modern React cybersecurity dashboard with live upload animation, in-browser secure viewer, and telemetry logs.
  - Developed and executed 19-test automated test suite, logging and rectifying all edge cases.
