# Research Paper Submission & Peer-Review Portal

A secure, NIST-compliant backend for research paper submission, peer review, and editorial decision management.

## Features

### Security Architecture

#### Authentication & Authorization

- **NIST SP 800-63-2 Compliant**: Industry-standard identity proofing and authentication
- **Multi-Factor Authentication (MFA)**: Email OTP with 5-minute expiry
- **Bcrypt Password Hashing**: Per-user salt with cost factor 12
- **Session Management**: Server-side sessions with 1-hour timeout
- **Role-Based Access Control**: Three roles (Author, Reviewer, Editor) with mandatory ACL enforcement

#### Encryption

- **Hybrid Encryption**: AES-256-CBC + RSA-2048 for files
- **Per-Session Keys**: Unique AES keys for each file
- **File Integrity**: SHA-256 hashing for verification
- **Digital Signatures**: RSA-PSS signatures for non-repudiation

#### Database & Logging

- **MongoDB Atlas**: Cloud database with encryption at rest
- **Audit Logging**: Comprehensive logging of all security events
- **TLS/SSL**: Encrypted data in transit

### Access Control Matrix

```
┌─────────┬──────────────┬──────────────┬────────────────┐
│  Role   │ Paper        │ Review       │ Final Decision │
├─────────┼──────────────┼──────────────┼────────────────┤
│ Author  │ R/W own only │ Read only    │ Read only      │
│ Reviewer│ R assigned   │ W own only   │ None           │
│ Editor  │ R/W all      │ R all        │ R/W + Sign     │
└─────────┴──────────────┴──────────────┴────────────────┘
```

## Installation

### Prerequisites

- Node.js LTS (v18+)
- MongoDB Atlas account (free tier available)
- Gmail account (for SMTP)
- Git

### Setup Steps

1. **Clone and Install**

```bash
cd research-portal
npm install
```

2. **Generate RSA Keys**

```bash
npm run keygen
```

This creates `keys/public.pem` and `keys/private.pem` for hybrid encryption.

3. **Configure Environment Variables**

Copy `.env.example` to `.env` and fill in:

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/research-portal?retryWrites=true&w=majority

# Email (Gmail SMTP)
# Note: Use an App-specific password, not your account password
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Session
SESSION_SECRET=your-very-long-secure-random-string-change-this

# Server
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Security
SESSION_TIMEOUT=3600000
OTP_EXPIRY=300000
```

4. **Create MongoDB Atlas Database**

- Visit https://cloud.mongodb.com
- Create a free cluster
- Get connection string: `mongodb+srv://...`
- Add your IP to whitelist
- Create database user

5. **Set Up Gmail SMTP**

- Enable 2-factor authentication on Gmail
- Generate app-specific password: https://myaccount.google.com/apppasswords
- Use the 16-character password in `.env`

6. **Start Server**

```bash
npm run dev  # Development with nodemon
npm start    # Production
```

Server runs on `http://localhost:3000`

## API Endpoints

### Authentication

```
POST   /api/auth/register
       Body: { fullName, username, email, password, confirmPassword, role, institution }
       Returns: userId, email

POST   /api/auth/login
       Body: { username, password }
       Returns: userId, email (OTP sent to email)

POST   /api/auth/verify-otp
       Body: { otp }
       Returns: user object (authentication complete)

POST   /api/auth/resend-otp
       No body required (requires active session)

POST   /api/auth/logout
       No body required

GET    /api/auth/me
       Returns: current user object
```

### Papers

```
POST   /api/papers
       Body: FormData with { title, abstractText, keywords, paper (PDF file) }
       ACL: Authors only
       Returns: paperId, success message

GET    /api/papers
       Query: none
       ACL: All (filtered by role)
       Returns: papers array

GET    /api/papers/:paperId
       ACL: Author (own), Reviewer (assigned), Editor (all)
       Returns: paper details

GET    /api/papers/:paperId/download
       ACL: Same as GET /papers/:paperId
       Returns: Decrypted PDF file

PUT    /api/papers/:paperId/status
       Body: { status, assignedReviewers }
       ACL: Editor only
       Returns: updated paper

GET    /api/papers/:paperId/with-reviews
       ACL: Editor only
       Returns: paper with all reviews
```

### Reviews

```
POST   /api/papers/:paperId/reviews
       Body: { summary, strengths, weaknesses, suggestions, rating, recommendation }
       ACL: Assigned reviewers only
       Returns: reviewId

GET    /api/papers/:paperId/reviews
       ACL: Editor only
       Returns: reviews array

GET    /api/reviews/my
       ACL: Reviewers only
       Returns: reviewer's reviews

GET    /api/reviews/:reviewId
       ACL: Reviewer (own), Editor (all)
       Returns: review details
```

### Decisions

```
POST   /api/papers/:paperId/decision
       Body: { decision, summary }
       ACL: Editor only
       Returns: decisionId, digitally signed

GET    /api/papers/:paperId/decision
       ACL: Author (own), Editor (all)
       Returns: decision with signature

GET    /api/decisions/:decisionId/verify
       ACL: Same as GET /decision
       Returns: signature verification result

GET    /api/decisions
       ACL: Editor only
       Returns: all decisions
```

## Architecture

### Directory Structure

```
research-portal/
├── server.js                    # Entry point
├── config/
│   ├── database.js             # MongoDB connection
│   └── session.js              # Session configuration
├── models/
│   ├── User.js                 # User schema
│   ├── Paper.js                # Paper schema
│   ├── Review.js               # Review schema
│   ├── Decision.js             # Decision schema
│   └── AuditLog.js             # Audit log schema
├── controllers/
│   ├── authController.js       # Auth logic
│   ├── paperController.js      # Paper operations
│   ├── reviewController.js     # Review operations
│   └── decisionController.js   # Decision logic
├── middleware/
│   ├── authMiddleware.js       # Authentication checks
│   └── aclMiddleware.js        # Authorization checks
├── routes/
│   ├── authRoutes.js           # Auth endpoints
│   └── paperRoutes.js          # Paper/review/decision endpoints
├── services/
│   ├── cryptoService.js        # Encryption/decryption
│   ├── emailService.js         # Email OTP delivery
│   └── auditService.js         # Audit logging
├── keys/
│   ├── generate-keys.js        # RSA key generation script
│   ├── public.pem              # RSA public key
│   └── private.pem             # RSA private key (git-ignored)
├── views/                       # Pug templates
│   ├── index.pug               # Landing page
│   ├── register.pug            # Registration
│   ├── login.pug               # Login + OTP
│   ├── dashboard.pug           # User dashboard
│   └── papers.pug              # Papers listing
├── public/
│   └── styles/
│       └── main.css            # Stylesheet
├── package.json
├── .env.example
└── README.md
```

### Encryption Process (File Upload)

1. User uploads PDF file
2. Generate AES-256 key and IV (random)
3. Encrypt file: `Ciphertext = AES-256-CBC(Plaintext, Key, IV)`
4. Generate hash: `Hash = SHA-256(Plaintext)`
5. Encrypt key: `EncryptedKey = RSA-2048(Key, PublicKey)`
6. Store: Base64(Ciphertext) + Base64(IV) + Base64(EncryptedKey) + Hash

### Decryption Process (File Download)

1. Retrieve encrypted package from database
2. Decrypt AES key: `Key = RSA-2048-Decrypt(EncryptedKey, PrivateKey)`
3. Decrypt file: `Plaintext = AES-256-CBC-Decrypt(Ciphertext, Key, IV)`
4. Verify hash: `SHA-256(Plaintext) == StoredHash`
5. Return decrypted file to user

### Digital Signature (Editor Decisions)

1. Create decision data
2. Sign: `Signature = RSA-PSS-Sign(Data, PrivateKey, SHA-256)`
3. Store signature with decision
4. Anyone can verify: `Valid = RSA-PSS-Verify(Data, Signature, PublicKey, SHA-256)`

## Security Features

### Protection Against Attacks

#### 1. Replay Attacks

- OTP expires after 5 minutes
- Session IDs are cryptographically random
- Timestamps prevent old requests

#### 2. Man-in-the-Middle (MITM)

- HTTPS/TLS in production (enforced via secure flag)
- Passwords never transmitted in plaintext (bcrypt verified on server)
- RSA encryption for key exchange

#### 3. Unauthorized Access

- ACL matrix enforced at every route
- Session authentication required
- MFA required for login

#### 4. Privilege Escalation

- Role cannot be changed via API
- ACL middleware checks role before every operation
- Audit log tracks all access denials

#### 5. File Tampering

- Files encrypted before storage
- SHA-256 hash verified on download
- Digital signatures prevent decision modification

#### 6. Injection Attacks

- Input validation on all fields
- Parameterized MongoDB queries
- HTML escaping in templates

## Testing

### Manual Testing Workflow

1. **Register as Author**
   - Go to `/register`
   - Create account with role "Author"
   - Verify email via OTP

2. **Submit a Paper**
   - Dashboard → Submit New Paper
   - Fill title, abstract, keywords
   - Upload sample PDF
   - File encrypted before storage

3. **Login as Reviewer**
   - Register with role "Reviewer"
   - Verify OTP
   - View assigned papers (empty until Editor assigns)

4. **Login as Editor**
   - Register with role "Editor"
   - View all papers
   - Assign reviewers
   - Create final decision (digitally signed)

5. **Verify Encryption**
   ```bash
   # Check database - file should be Base64 encoded encrypted data
   # Download file - should be decrypted automatically
   # Hash mismatch - would fail with integrity error
   ```

## Security Best Practices

1. **Always use HTTPS in production**
2. **Rotate RSA keys periodically**
3. **Store `.env` securely (never commit)**
4. **Review audit logs regularly**
5. **Use strong SESSION_SECRET (32+ characters)**
6. **Enable MongoDB IP whitelisting**
7. **Use app-specific Gmail passwords**
8. **Never hardcode credentials**

## Compliance

- **NIST SP 800-63-2**: Authentication standards
- **OWASP**: Security best practices
- **GDPR-Ready**: Can be extended with privacy features
- **Audit Trail**: All actions logged with timestamps

## Troubleshooting

### "MONGODB_URI not configured"

- Add `MONGODB_URI` to `.env`
- Check MongoDB Atlas connection string

### "OTP not received"

- Verify `EMAIL_USER` and `EMAIL_PASS` in `.env`
- Check spam folder
- Confirm Gmail app password (not account password)

### "Cannot read private key"

- Run `npm run keygen`
- Ensure `keys/private.pem` exists and is readable

### "File decryption failed"

- Verify file wasn't corrupted during upload
- Check hash matches stored value
- Ensure RSA keys haven't changed

## License

MIT License - Use freely for education and research

## Support

For issues, questions, or suggestions, refer to security best practices documentation or contact the development team.

---

Built with security and academic integrity in mind.
