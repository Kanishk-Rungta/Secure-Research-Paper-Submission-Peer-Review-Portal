# 📚 Research Paper Portal - Project Navigation

## 🎯 Start Here

**New to the project?** Follow this path:

1. **Read**: [QUICKSTART.md](QUICKSTART.md) (5 minutes)
   - Get the server running locally
   - Configure environment variables
   - Create test accounts

2. **Explore**: [server.js](server.js) (10 minutes)
   - Main entry point
   - Express setup
   - Route configuration

3. **Learn**: [README.md](README.md) (30 minutes)
   - Full feature overview
   - API documentation
   - Architecture explanation

4. **Deep Dive**: [SECURITY.md](SECURITY.md) (20 minutes)
   - Security architecture
   - Encryption flows
   - ACL implementation

5. **Verify**: [IMPLEMENTATION.md](IMPLEMENTATION.md) (10 minutes)
   - Requirement checklist
   - Feature summary
   - Code statistics

---

## 📂 Project Structure Guide

### Core Application

```
server.js              ← Start here (app entry point)
package.json           ← Dependencies
.env.example           ← Configuration template
test-api.js            ← Test suite
```

### Configuration

```
config/
├── database.js        ← MongoDB connection
└── session.js         ← Session management
```

### Database Layer

```
models/
├── User.js            ← User authentication + MFA
├── Paper.js           ← Research papers (encrypted)
├── Review.js          ← Peer reviews
├── Decision.js        ← Editorial decisions (signed)
└── AuditLog.js        ← Security audit trail
```

### Request Handling

```
routes/
├── authRoutes.js      ← Authentication endpoints (7 routes)
└── paperRoutes.js     ← Paper, review, decision (13 routes)
```

### Business Logic

```
controllers/
├── authController.js  ← Register, login, MFA logic
├── paperController.js ← File upload/download with encryption
├── reviewController.js ← Review submission
└── decisionController.js ← Final decisions + signatures
```

### Security & Middleware

```
middleware/
├── authMiddleware.js  ← Session, authentication checks
└── aclMiddleware.js   ← Role-based access control
```

### Cryptography & Services

```
services/
├── cryptoService.js   ← AES, RSA, signatures, hashing
├── emailService.js    ← OTP delivery via Gmail
└── auditService.js    ← Logging and audit trail
```

### Key Management

```
keys/
├── generate-keys.js   ← RSA key pair generator
├── public.pem         ← RSA-2048 public key
└── private.pem        ← RSA-2048 private key (git-ignored)
```

### Frontend (User Interface)

```
views/
├── index.pug          ← Landing page
├── register.pug       ← User registration
├── login.pug          ← Login + OTP verification
├── dashboard.pug      ← User dashboard
└── papers.pug         ← Papers listing

public/styles/
└── main.css           ← Responsive stylesheet
```

---

## 📖 Documentation Map

| Document                               | Purpose                        | Read Time |
| -------------------------------------- | ------------------------------ | --------- |
| [QUICKSTART.md](QUICKSTART.md)         | Get running in 5 minutes       | 5 min     |
| [README.md](README.md)                 | Complete project documentation | 30 min    |
| [SECURITY.md](SECURITY.md)             | Security architecture details  | 20 min    |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Requirements verification      | 10 min    |
| Inline comments                        | Code explanations              | as needed |

---

## 🔑 Key Files Explained

### [server.js](server.js) - Entry Point

**What**: Main Express application setup
**Contains**:

- Database connection
- Middleware configuration
- Route registration
- Error handling
- Server startup

**Why**: Everything starts here. This is the core of the application.

### [services/cryptoService.js](services/cryptoService.js) - Encryption Engine

**What**: All cryptographic operations
**Contains**:

- AES-256-CBC encryption/decryption
- RSA-2048 key wrapping
- SHA-256 hashing
- RSA-PSS digital signatures
- OTP generation

**Why**: Implements all cryptography required by NIST standards.

### [middleware/aclMiddleware.js](middleware/aclMiddleware.js) - Access Control

**What**: Role-based access enforcement
**Contains**:

- ACL matrix implementation
- Role validation
- Resource ownership checks
- Access denial logging

**Why**: Ensures users can only access what they're permitted to.

### [controllers/paperController.js](controllers/paperController.js) - File Handling

**What**: File upload and download with encryption
**Contains**:

- File upload with hybrid encryption
- File download with decryption
- Hash verification
- Paper listing with filtering

**Why**: Implements secure file storage and retrieval.

### [controllers/decisionController.js](controllers/decisionController.js) - Digital Signatures

**What**: Editorial decisions with non-repudiation
**Contains**:

- Decision creation
- RSA-PSS digital signatures
- Signature verification
- Editor accountability

**Why**: Ensures editors cannot deny their decisions.

---

## 🚀 Workflow Guide

### User Registration Flow

```
User fills form (register.pug)
    ↓ (POST /api/auth/register)
authController.register()
    ↓ (validates input, hashes password)
User saved to MongoDB
    ↓ (generate OTP)
OTP sent via Gmail
    ↓ (user redirects to login)
Login page (login.pug)
```

_See: [authController.js](controllers/authController.js#L26)_

### Paper Submission Flow

```
Author uploads PDF (dashboard.pug)
    ↓ (POST /api/papers)
paperController.submitPaper()
    ↓ (calls cryptoService.encryptFile)
File encrypted: AES-256-CBC + RSA-2048
    ↓ (store Base64 blobs in MongoDB)
Paper saved with encrypted data
    ↓ (audit log recorded)
Author sees success message
```

_See: [paperController.js](controllers/paperController.js#L26)_

### Decision Signing Flow

```
Editor makes decision (API POST)
    ↓ (POST /api/papers/:paperId/decision)
decisionController.makeDecision()
    ↓ (calls cryptoService.signData)
Decision signed with RSA-PSS
    ↓ (signature stored in database)
Decision saved with signature
    ↓ (author notified via email)
Anyone can verify signature
```

_See: [decisionController.js](controllers/decisionController.js#L29)_

---

## 🔐 Security Implementation Map

### Authentication

- Entry point: [authRoutes.js](routes/authRoutes.js)
- Logic: [authController.js](controllers/authController.js)
- Check: [authMiddleware.js](middleware/authMiddleware.js)

### Authorization

- Entry point: [aclMiddleware.js](middleware/aclMiddleware.js)
- Applied on: [paperRoutes.js](routes/paperRoutes.js)
- Enforced before: controllers execute

### Encryption

- Entry point: [paperController.js](controllers/paperController.js) submit/download
- Implementation: [cryptoService.js](services/cryptoService.js)
- Keys: Generated in [keys/generate-keys.js](keys/generate-keys.js)

### Audit Logging

- Entry point: [auditService.js](services/auditService.js)
- Called from: All controllers and middleware
- Stored in: MongoDB `auditlogs` collection

---

## 📊 API Endpoint Map

### Authentication Routes

```
POST   /api/auth/register          → authController.register()
POST   /api/auth/login              → authController.login()
POST   /api/auth/verify-otp         → authController.verifyOTP()
POST   /api/auth/resend-otp         → authController.resendOTP()
POST   /api/auth/logout             → authController.logout()
GET    /api/auth/me                 → authController.getCurrentUser()
```

_See: [authRoutes.js](routes/authRoutes.js)_

### Paper Routes (with ACL)

```
POST   /api/papers                  → paperController.submitPaper()
GET    /api/papers                  → paperController.listPapers()
GET    /api/papers/:paperId         → paperController.getPaper()
GET    /api/papers/:paperId/download → paperController.downloadPaper()
PUT    /api/papers/:paperId/status  → paperController.updatePaperStatus()
```

_See: [paperRoutes.js](routes/paperRoutes.js)_

### Review Routes (with ACL)

```
POST   /api/papers/:paperId/reviews  → reviewController.submitReview()
GET    /api/papers/:paperId/reviews  → reviewController.getReviewsForPaper()
GET    /api/reviews/my               → reviewController.getMyReviews()
GET    /api/reviews/:reviewId        → reviewController.getReview()
```

_See: [paperRoutes.js](routes/paperRoutes.js)_

### Decision Routes (with ACL)

```
POST   /api/papers/:paperId/decision            → decisionController.makeDecision()
GET    /api/papers/:paperId/decision            → decisionController.getDecision()
GET    /api/decisions/:decisionId/verify        → decisionController.verifyDecisionSignature()
GET    /api/decisions                           → decisionController.listDecisions()
```

_See: [paperRoutes.js](routes/paperRoutes.js)_

---

## 🧪 Testing Guide

### Automated Testing

```bash
npm run test-api          # Runs test-api.js
```

Tests basic endpoints without authentication.

### Manual Testing (with Frontend)

1. Start server: `npm run dev`
2. Register at: `http://localhost:3000/register`
3. Verify OTP from email
4. Login at: `http://localhost:3000/login`
5. Access dashboard: `http://localhost:3000/dashboard`

### API Testing (with curl)

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test","username":"test","email":"test@x.com","password":"Pass123!","confirmPassword":"Pass123!","role":"Author"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"test","password":"Pass123!"}'
```

---

## 🛠️ Development Tips

### Adding a New Route

1. Create controller method in `controllers/`
2. Add route in `routes/`
3. Apply middleware: `authMiddleware`, `aclMiddleware`
4. Document in README.md

### Adding a New Security Check

1. Create middleware in `middleware/`
2. Export as function
3. Apply to routes: `router.use(middleware)`
4. Log in auditService

### Modifying Encryption

1. Edit `services/cryptoService.js`
2. Update key sizes/algorithms
3. Regenerate keys: `npm run keygen`
4. Update comments with NIST reference

### Adding Audit Logging

1. Call `auditService.log()` after action
2. Include: userId, action, resource, status, details, IP
3. Results appear in MongoDB `auditlogs` collection

---

## 📚 Learning Resources

### Concepts

- **Hybrid Encryption**: [SECURITY.md](SECURITY.md#encryption-flow)
- **ACL Matrix**: [SECURITY.md](SECURITY.md#access-control-matrix)
- **Digital Signatures**: [SECURITY.md](SECURITY.md#digital-signature-process)
- **MFA Flow**: [SECURITY.md](SECURITY.md#authentication-flow)

### Standards

- **NIST SP 800-63-2**: Authentication (see [authMiddleware.js](middleware/authMiddleware.js))
- **NIST FIPS 197**: AES (see [cryptoService.js](services/cryptoService.js#L22))
- **NIST FIPS 186-4**: RSA (see [cryptoService.js](services/cryptoService.js#L50))

### Code Examples

- **File Encryption**: [paperController.js](controllers/paperController.js#L45)
- **File Decryption**: [paperController.js](controllers/paperController.js#L97)
- **Digital Signing**: [decisionController.js](controllers/decisionController.js#L80)

---

## ✅ Requirement Checklist

- [x] NIST SP 800-63-2 Authentication
- [x] Bcrypt Password Hashing (per-user salt, cost 12)
- [x] Multi-Factor Authentication (Email OTP)
- [x] Three Roles (Author, Reviewer, Editor)
- [x] Access Control Matrix (ACL)
- [x] File Encryption (AES-256-CBC + RSA-2048)
- [x] Digital Signatures (RSA-PSS)
- [x] Audit Logging
- [x] Input Validation
- [x] Encrypted File Storage
- [x] Session Management
- [x] Express.js Backend
- [x] MongoDB Atlas Database
- [x] Clean UI Frontend
- [x] Comprehensive Documentation

---

## 🎓 For Exam Preparation

**Key Topics to Master:**

1. Hybrid encryption implementation
2. ACL enforcement patterns
3. NIST authentication compliance
4. Digital signature non-repudiation
5. Session management security
6. MFA implementation
7. Audit logging
8. Input validation

**Key Files to Study:**

1. [cryptoService.js](services/cryptoService.js) - All crypto
2. [aclMiddleware.js](middleware/aclMiddleware.js) - Access control
3. [authController.js](controllers/authController.js) - Authentication
4. [decisionController.js](controllers/decisionController.js) - Signatures

**Key Concepts to Explain:**

1. Why hybrid encryption (AES + RSA)?
2. How RSA-PSS prevents forgery?
3. How ACL prevents privilege escalation?
4. How OTP prevents replay attacks?
5. How audit logs ensure accountability?

---

## 📞 Quick Help

| Issue                | Solution                 | Link                           |
| -------------------- | ------------------------ | ------------------------------ |
| Server won't start   | Check port 3000          | [QUICKSTART.md](QUICKSTART.md) |
| MongoDB error        | Verify connection string | [QUICKSTART.md](QUICKSTART.md) |
| OTP not received     | Check email config       | [QUICKSTART.md](QUICKSTART.md) |
| Cannot download file | Check hash verification  | [README.md](README.md)         |
| Access denied error  | Check ACL matrix         | [SECURITY.md](SECURITY.md)     |
| Keys missing         | Run npm run keygen       | [QUICKSTART.md](QUICKSTART.md) |

---

**Ready to dive in? Start with [QUICKSTART.md](QUICKSTART.md)!** 🚀
