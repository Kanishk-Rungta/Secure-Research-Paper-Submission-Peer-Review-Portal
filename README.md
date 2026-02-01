# Secure Research Paper Submission & Peer-Review Portal

A production-quality demonstration of secure research paper submission with end-to-end encryption, role-based access control, digital signatures, and comprehensive security logging for a Foundations of Cyber Security course.

## Quick Start

1. **Install dependencies:**

   ```powershell
   npm install
   ```

2. **Start the server:**

   ```powershell
   npm start
   ```

3. **Visit the application:**
   - Open `http://localhost:3000` in your browser
   - You'll see the professional landing page with navigation links

## User Flow Guide

### Step 1: Sign Up

1. Click **"Sign Up"** in the navigation menu or on the home page
2. Fill in the sign-up form:
   - **Email:** Enter any email address (e.g., `author@example.com`)
   - **Role:** Select one of three roles:
     - **Author** - Can create and submit papers
     - **Collaborator** - Can review papers and issue final decisions
     - **Reviewer** - Can review papers (read-only)
   - **Password:** Must meet security requirements:
     - Minimum 12 characters
     - At least one uppercase letter (A-Z)
     - At least one lowercase letter (a-z)
     - At least one digit (0-9)
     - At least one symbol (!@#$%^&\*()\_+-=[]{};':"\\|,.<>/?)

   ✅ **Real-time validation:** As you type, you'll see the password requirements update. The input border turns green when all requirements are met.

3. Click **"Create Account"**
4. You'll see a success message indicating:
   - ✓ Account created successfully
   - 📧 An OTP code has been sent to your email
   - 🔐 Redirecting to verification page...

### Step 2: Email Verification (OTP)

1. On the verification page, your email is pre-filled (read-only)
2. Check your email inbox for the OTP verification code
3. **For Development/Testing:**
   - Open **Developer Tools** (Press `F12`)
   - Look for the message: `🔐 OTP for {email}: {code} (expires in 5 minutes)`
   - The OTP is also logged to the server console
4. Enter the 6-digit code in the **OTP Code** field
5. Click **"Verify Email"**
6. ✓ Email verified successfully - redirects to login page

### Step 3: Login

1. On the login page, enter:
   - **Email:** Your registered email
   - **Password:** Your password
2. Click **"Sign In"**
3. ✓ Login successful - you're redirected to your personal dashboard

### Step 4: Dashboard (Role-Specific)

**As an Author:**

- View papers you've created
- See reviews from reviewers
- View final decisions from collaborators
- Submit new research papers

**As a Collaborator:**

- View assigned papers
- Read peer reviews
- Issue final decisions with digital signatures

**As a Reviewer:**

- View assigned papers
- Submit peer reviews

## Security Features

### Authentication & Session Management

- ✅ **Password Hashing:** bcryptjs with per-user salt
- ✅ **Email OTP Verification:** Cryptographically secure 6-digit codes
  - Single-use enforcement (can't reuse the same code)
  - 5-minute expiration
  - 5-attempt limit before lockout
  - Audit logged for all attempts
- ✅ **Account Lockout:** 5 failed login attempts → 15-minute lockout
- ✅ **Server-Side Sessions:** express-session with httpOnly cookies
- ✅ **Session TTL:** 2-hour timeout with auto-logout
- ✅ **Private Key Protection:** RSA private keys encrypted at rest using PBKDF2

### Authorization (Role-Based Access Control)

- ✅ **Three Roles:** Author, Collaborator, Reviewer
- ✅ **Three Objects:** Paper, Review, FinalDecision
- ✅ **Formal ACL Matrix:** Every endpoint enforces access control
- ✅ **Detailed Denial Logging:** All access violations are logged with context

### Cryptography & Data Protection

- ✅ **RSA-2048:** OAEP+SHA256 padding for key wrapping
- ✅ **AES-256-GCM:** Authenticated encryption (confidentiality + integrity)
- ✅ **PBKDF2:** 100k iterations for deriving symmetric keys from passwords
- ✅ **SHA-256:** Hashing for integrity verification
- ✅ **RSA Signatures:** Collaborators sign final decisions (non-repudiation)

### Security Controls

- ✅ **CSRF Protection:** Token-based defense on all state-changing requests
- ✅ **Rate Limiting:** 200 requests per 15 minutes per IP
- ✅ **Input Validation:** Password policies, email format, role enums
- ✅ **Secure Headers:** helmet.js for HTTP security headers
- ✅ **Comprehensive Logging:** Security-critical events logged to `data.json`

## File Structure

```
Secure-Research-Paper-Submission-Peer-Review-Portal/
├── server/
│   ├── index.js              # Express server + all endpoints
│   ├── crypto.js             # RSA, AES, PBKDF2, SHA-256, signatures
│   ├── acl.js                # Role-based access control matrix
│   ├── db.js                 # File-backed persistence
│   └── utils.js              # Password validation, hashing, OTP, UUID
├── client/
│   ├── index.html            # Professional landing page
│   ├── login.html            # Login page with validation
│   ├── signup.html           # Signup page with password validation
│   ├── verify-otp.html       # OTP verification page
│   ├── dashboard.html        # Dashboard container
│   ├── dashboard.js          # Dashboard logic + actions
│   ├── app.js                # Shared utilities (CSRF, messaging)
│   └── style.css             # Professional responsive styling
├── scripts/
│   └── e2e.js                # End-to-end test suite
├── data.json                 # Persistent file-backed store
├── package.json              # Dependencies + scripts
└── README.md                 # This file
```

## API Endpoints

### Authentication

- `POST /api/signup` - Register new user
- `POST /api/verify-otp` - Verify email with OTP
- `POST /api/login` - Login with email/password
- `POST /api/logout` - Logout and clear session

### Papers

- `POST /api/papers` - Submit new paper (encrypted)
- `GET /api/papers` - List user's papers (summaries)
- `GET /api/papers/:id` - Decrypt and read specific paper

### Reviews

- `POST /api/papers/:id/reviews` - Submit peer review (encrypted)
- `GET /api/reviews/:id` - Decrypt and read specific review

### Decisions

- `POST /api/papers/:id/decision` - Issue signed final decision
- `GET /api/papers/:id/decision` - Read decision + verify signature

### Utilities

- `GET /api/csrf-token` - Get CSRF token for requests
- `GET /api/me` - Get current user info
- `GET /api/dashboard` - Get role-specific dashboard data

## Testing & Troubleshooting

### Test Credentials

You can create test accounts with any of these roles:

- **Author** - Can create papers
- **Collaborator** - Can issue decisions
- **Reviewer** - Can submit reviews

### Finding OTP Codes (Development)

1. **Server Console:** When you sign up, the OTP is printed to the terminal:
   ```
   🔐 OTP for author@example.com: 123456 (expires in 5 minutes)
   ```
2. **Browser Console:** Open Developer Tools (F12 → Console tab) and look for OTP messages
3. **Email:** In production, the OTP would be sent via email

### Common Issues

| Issue                                  | Solution                                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password not accepting valid password  | Real-time validation is enabled. Make sure all requirements are met (12+ chars, uppercase, lowercase, digit, symbol). The input border turns green when valid. |
| Button clears form but nothing happens | Check the error message displayed below the form. Common errors: invalid password, missing role, email already in use.                                         |
| OTP page not showing                   | You must complete signup first. The page is reached via the automatic redirect.                                                                                |
| Can't find OTP code                    | Open Developer Tools (F12) and look at the server console output or browser console logs.                                                                      |
| Login fails with correct credentials   | Your account might be locked (5 failed attempts = 15-minute lockout). Wait 15 minutes and try again.                                                           |

## Configuration

### Environment Variables

```bash
NODE_ENV=production           # production for secure cookies
PORT=3000                     # Server port (default: 3000)
SESSION_SECRET=your-secret    # Session encryption key
SMTP_HOST=smtp.example.com    # Email server (for real OTP sending)
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
```

If SMTP is not configured, the server falls back to Ethereal test mail.

## Production Deployment

### Security Recommendations

1. **Database:** Migrate from `data.json` to SQLite or PostgreSQL
2. **TLS/HTTPS:** Configure SSL certificates
3. **Environment Secrets:** Use `.env` files and never commit secrets
4. **Email:** Configure real SMTP for OTP delivery
5. **Monitoring:** Set up audit log aggregation and alerting
6. **Rate Limiting:** Consider using Redis for distributed rate limiting
7. **Backups:** Regular encrypted backups of user data and audit logs

### Hardening Details

- **OTP:** Cryptographically secure generation, single-use enforcement, attempt limits
- **Key Derivation:** PBKDF2 with 100k iterations prevents dictionary attacks
- **RSA:** OAEP padding prevents chosen-ciphertext attacks
- **AES:** GCM mode provides authenticated encryption (confidentiality + integrity)
- **Passwords:** bcrypt with adaptive work factor resists brute-force
- **Session:** Server-side sessions keep secrets out of client cookies
- **CSRF:** Token-based protection on all state-changing requests
- **Account Lockout:** Temporary lockout after failed attempts prevents brute-force

## Evaluation Checklist

- ✅ **Authentication:** bcrypt + OTP/MFA, account lockout, session management
- ✅ **Authorization:** Role-based ACL, formally defined in matrix, enforced on every endpoint
- ✅ **Confidentiality:** AES-256-GCM encryption, per-object unique keys, per-recipient key wrapping
- ✅ **Integrity:** SHA-256 hashing, authenticated encryption (GCM auth tags)
- ✅ **Authenticity:** RSA signatures on final decisions
- ✅ **Non-Repudiation:** Digital signatures with public-key verification
- ✅ **Protections:** Replay prevention (OTP single-use), man-in-the-middle mitigation (RSA-OAEP), unauthorized access blocking (ACL), privilege escalation prevention (role validation), brute-force defense (account lockout)
- ✅ **Audit Logging:** Comprehensive security event logging

## License

MIT License - See LICENSE file for details
