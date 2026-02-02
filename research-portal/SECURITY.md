# Security Architecture & Quick Reference

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Browser)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Landing Page (index.pug)                               │  │
│  │ • Registration (register.pug)                            │  │
│  │ • Login + MFA (login.pug)                                │  │
│  │ • Dashboard (dashboard.pug)                              │  │
│  │ • Papers List (papers.pug)                               │  │
│  │ • Style (main.css - responsive, accessible)             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS.JS SERVER                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Routes (/api/auth, /api/papers, etc.)                  │    │
│  │         ↓                                              │    │
│  │ Middleware (Authentication, ACL, Session)             │    │
│  │         ↓                                              │    │
│  │ Controllers (Business Logic)                           │    │
│  │         ↓                                              │    │
│  │ Services (Crypto, Email, Audit)                        │    │
│  │         ↓                                              │    │
│  │ Models (Database Operations)                           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Security Features:                                             │
│  • Session Management (express-session)                         │
│  • Password Hashing (bcrypt)                                   │
│  • MFA (Email OTP)                                             │
│  • Encryption (AES-256-CBC + RSA-2048)                         │
│  • Digital Signatures (RSA-PSS)                                │
│  • Audit Logging                                               │
│  • ACL Enforcement                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ TLS
┌─────────────────────────────────────────────────────────────────┐
│                   MONGODB ATLAS (Cloud)                         │
│                                                                  │
│  Collections:                                                   │
│  • users              (Authentication & MFA)                    │
│  • papers             (Encrypted file storage)                  │
│  • reviews            (Peer reviews)                            │
│  • decisions          (Editorial decisions)                     │
│  • auditlogs          (Security audit trail)                    │
│  • sessions           (Server-side sessions)                    │
│                                                                  │
│  Features:                                                      │
│  • Encrypted at rest                                           │
│  • TLS in transit                                              │
│  • Automatic backups                                           │
│  • Connection pooling                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
User Request
    │
    ├─→ Check Session Valid?
    │       ├─→ YES: Continue to route
    │       └─→ NO: Redirect to /login
    │
    ├─→ [At Login]
    │   ├─→ Validate Email/Username & Password
    │   ├─→ Generate 6-digit OTP
    │   ├─→ Store OTP + 5-min expiry in database
    │   ├─→ Send OTP via Gmail SMTP
    │   └─→ Create session (mfaVerified = false)
    │
    ├─→ [User enters OTP]
    │   ├─→ Verify OTP code (6 digits, not expired)
    │   ├─→ Verify OTP matches stored value
    │   ├─→ Update session (mfaVerified = true)
    │   └─→ User can now access protected routes
    │
    └─→ [Session expires after 1 hour]
        └─→ Require re-login
```

## Encryption/Decryption Flow

### File Upload (Encryption)

```
User uploads PDF
    │
    ├─→ Validate file (PDF only, < 50MB)
    │
    ├─→ Generate AES-256 key (32 random bytes)
    ├─→ Generate IV (16 random bytes)
    ├─→ Encrypt file: Ciphertext = AES-256-CBC(PDF, Key, IV)
    ├─→ Hash original: Hash = SHA-256(PDF)
    │
    ├─→ Encrypt AES key: EncryptedKey = RSA-2048(Key, PublicKey)
    │
    ├─→ Store in MongoDB:
    │   ├─ encryptedData: Base64(Ciphertext)
    │   ├─ encryptedIV: Base64(IV)
    │   ├─ encryptedAESKey: Base64(EncryptedKey)
    │   ├─ fileHash: Hash
    │   └─ metadata: filename, size, author
    │
    └─→ Success: File is encrypted, AES key is protected
```

### File Download (Decryption)

```
User requests download
    │
    ├─→ Check ACL: Can user access this paper?
    │
    ├─→ Retrieve encrypted package from MongoDB
    │
    ├─→ Decrypt AES key: Key = RSA-2048-Decrypt(EncryptedKey, PrivateKey)
    ├─→ Get IV from database
    ├─→ Decrypt file: Plaintext = AES-256-CBC-Decrypt(Ciphertext, Key, IV)
    │
    ├─→ Verify integrity:
    │   ├─ Calculate hash: CalculatedHash = SHA-256(Plaintext)
    │   ├─ Compare: StoredHash == CalculatedHash?
    │   └─ If mismatch: Return error (file corrupted)
    │
    ├─→ Log access in audit log
    │
    └─→ Return decrypted PDF to user
```

## Access Control Matrix (ACL)

### Protected Resources

#### Papers (Document)

```
Author   : Can read/write own papers only
Reviewer : Can read only assigned papers
Editor   : Can read/write ALL papers
```

#### Reviews (Document)

```
Author   : Cannot access reviews (hidden from authors)
Reviewer : Can write own reviews, cannot read others'
Editor   : Can read all reviews
```

#### Decisions (Document)

```
Author   : Can read decisions on own papers
Reviewer : Cannot access decisions (hidden from reviewers)
Editor   : Can read/write all decisions, sign decisions
```

### ACL Enforcement

```
User makes API request
    │
    ├─→ Check authentication (session valid + MFA verified)
    │
    ├─→ Check role:
    │   ├─ Author: Has user.role == 'Author'?
    │   ├─ Reviewer: Has user.role == 'Reviewer'?
    │   └─ Editor: Has user.role == 'Editor'?
    │
    ├─→ Check resource access:
    │   ├─ For papers: Author (own) vs Reviewer (assigned) vs Editor (all)
    │   ├─ For reviews: Reviewer (own) vs Editor (all)
    │   └─ For decisions: Author (own) vs Editor (all)
    │
    ├─→ If allowed: Continue to controller
    │
    └─→ If denied:
        ├─ Return 403 Forbidden
        ├─ Log access denial in audit log
        └─ No response body (prevent info leakage)
```

## Digital Signature Process

### Making a Decision (with Signature)

```
Editor creates decision
    │
    ├─→ Collect decision data:
    │   ├─ paperId
    │   ├─ decision (ACCEPTED/REJECTED/REVISION_REQUESTED)
    │   ├─ summary
    │   └─ decidedAt (timestamp)
    │
    ├─→ Create signable data: JSON.stringify(data)
    │
    ├─→ Sign decision:
    │   DataToSign = Buffer.from(data)
    │   Signature = RSA-PSS-Sign(DataToSign, PrivateKey, SHA-256)
    │   Signature = Base64(Signature)
    │
    ├─→ Store in database:
    │   ├─ decision, summary, decidedAt
    │   ├─ editorId, editorEmail
    │   ├─ signature (Base64)
    │   ├─ signatureAlgorithm ("RSA-PSS with SHA-256")
    │   └─ Only Editor can see it (ACL)
    │
    └─→ Email notification sent to Author
```

### Verifying Decision Signature

```
User verifies decision authenticity
    │
    ├─→ Retrieve decision from database
    │
    ├─→ Reconstruct original data:
    │   DataToVerify = Buffer.from(original_data)
    │
    ├─→ Get signature:
    │   SignatureBuffer = Base64.decode(storedSignature)
    │
    ├─→ Verify signature:
    │   IsValid = RSA-PSS-Verify(DataToVerify, Signature, PublicKey, SHA-256)
    │
    ├─→ If valid:
    │   ├─ Decision was definitely signed by Editor
    │   ├─ No one can claim they didn't make this decision (non-repudiation)
    │   └─ Data hasn't been modified since signing
    │
    └─→ Return verification result
```

## Security Checklist

### Password Security

- [x] Bcrypt with cost factor 12 (not MD5, not SHA-1)
- [x] Per-user salt (built into bcrypt)
- [x] Minimum 12 characters
- [x] No plaintext storage
- [x] No transmission in logs

### Session Security

- [x] Server-side sessions in MongoDB
- [x] Session ID cryptographically random
- [x] HttpOnly flag (prevents XSS)
- [x] Secure flag (HTTPS only in production)
- [x] SameSite=strict (prevents CSRF)
- [x] 1-hour timeout
- [x] Regenerated after successful MFA

### File Security

- [x] Encrypted with AES-256-CBC
- [x] Random IV per file
- [x] RSA-2048 key wrapping
- [x] SHA-256 integrity verification
- [x] Size limit (50MB)
- [x] Type validation (PDF only)

### Cryptographic Security

- [x] AES-256-CBC (NIST standard)
- [x] RSA-2048 (NIST standard)
- [x] RSA-OAEP padding (not PKCS#1 v1.5)
- [x] RSA-PSS for signatures (not PKCS#1 v1.5)
- [x] SHA-256 for hashing (not MD5)
- [x] All using Node.js built-in crypto

### Access Control Security

- [x] ACL matrix implementation
- [x] Enforced at middleware level
- [x] Before controller execution
- [x] Role-based checks
- [x] Resource ownership checks
- [x] Access denial logging

### Input Security

- [x] Email format validation
- [x] Username length/format check
- [x] Password strength requirements
- [x] SQL injection prevention (MongoDB queries)
- [x] XSS prevention (template escaping)
- [x] CSRF prevention (SameSite cookies)

### Audit Security

- [x] All authentication logged
- [x] All access denials logged
- [x] All file operations logged
- [x] All decision changes logged
- [x] Timestamps on all logs
- [x] IP addresses recorded
- [x] User actions tracked

---

## Environment Variable Reference

```bash
# Required: MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Required: Gmail SMTP (App-specific password)
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx

# Required: Session Secret (change this!)
SESSION_SECRET=your-super-secret-key-must-be-at-least-32-characters-long

# Optional: Server Configuration
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# Optional: Security Timeouts
SESSION_TIMEOUT=3600000          # 1 hour in milliseconds
OTP_EXPIRY=300000                # 5 minutes in milliseconds
```

---

## Common Security Patterns

### 1. Protected Route Pattern

```javascript
router.get(
  "/protected",
  authMiddleware.checkSessionTimeout, // Check session not expired
  authMiddleware.isAuthenticated, // Check user logged in
  authMiddleware.refreshUserSession, // Update last activity
  aclMiddleware.requireEditor, // Check role
  controller.action,
);
```

### 2. ACL Check Pattern

```javascript
// In route
router.put(
  "/:paperId",
  aclMiddleware.canAccessPaper, // Check permission
  aclMiddleware.canModifyPaper, // Check can modify
  controller.updatePaper,
);

// In middleware
const paper = await Paper.findById(paperId);
if (user.role === "Editor" || paper.authorId === userId) {
  // Allow
}
```

### 3. Audit Log Pattern

```javascript
// After every action
await auditService.log(
  userId,
  'ACTION_NAME',
  resourceId,
  'SUCCESS' or 'FAILURE',
  'details',
  clientIP
);
```

### 4. Encryption Pattern

```javascript
// Encrypt on upload
const encrypted = cryptoService.encryptFile(fileBuffer, publicKeyPath);
// Store: encrypted.encryptedData, encrypted.encryptedIV, encrypted.encryptedKey, encrypted.hash

// Decrypt on download
const decrypted = cryptoService.decryptFile(encryptedPackage, privateKeyPath);
// Result: decrypted.data (original file), decrypted.hashVerified (true/false)
```

---

## Deployment Sequence

```
1. Generate RSA keys
   npm run keygen

2. Install dependencies
   npm install

3. Configure environment
   Copy .env.example → .env
   Set all required variables

4. Test locally
   npm run dev
   Access http://localhost:3000
   npm run test-api

5. Deploy to production
   Set NODE_ENV=production
   Use strong SESSION_SECRET
   Enable HTTPS/TLS
   Configure email domain whitelist
   Set MongoDB IP whitelist
   Deploy to cloud (Heroku, AWS, etc.)

6. Monitor
   Watch audit logs
   Monitor error rates
   Check database performance
   Rotate keys quarterly
```

---

## Quick Troubleshooting

| Problem                   | Solution                                 |
| ------------------------- | ---------------------------------------- |
| Server won't start        | Check if port 3000 is available          |
| Cannot connect to MongoDB | Verify MONGODB_URI and IP whitelist      |
| OTP not received          | Check EMAIL_USER/EMAIL_PASS, check spam  |
| Cannot read private key   | Run `npm run keygen`                     |
| "User not found" on login | Email/username not registered            |
| File download fails       | Check file hash, regenerate if corrupted |

---

This completes a **production-ready, security-first, NIST-compliant research paper portal**. 🎉
