# Quick Start Guide

## 5-Minute Setup

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Generate RSA Keys

```bash
npm run keygen
```

Output:

```
✓ Public key saved to keys/public.pem
✓ Private key saved to keys/private.pem (mode: 0600)
```

### Step 3: Configure Environment

Copy `.env.example` to `.env` and set these values:

```bash
# REQUIRED: MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/research-portal?retryWrites=true&w=majority

# REQUIRED: Gmail SMTP Configuration
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx  # App-specific password (16 chars with spaces)

# REQUIRED: Session Secret (change this!)
SESSION_SECRET=your-super-secret-key-at-least-32-characters-long-change-this

# OPTIONAL: Server Settings
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
```

**Getting MongoDB URI:**

1. Go to https://cloud.mongodb.com
2. Create free cluster
3. Click "Connect" → "Drivers" → Copy connection string
4. Replace `<password>` and `<username>`

**Getting Gmail App Password:**

1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Generate 16-character password
4. Copy to EMAIL_PASS (keep spaces)

### Step 4: Start Server

```bash
npm run dev
```

Expected output:

```
✓ MongoDB Atlas connected successfully

╔════════════════════════════════════════════════════════════╗
║  Research Paper Submission & Peer-Review Portal            ║
║  Secure Backend Server                                      ║
╚════════════════════════════════════════════════════════════╝

✓ Server running on http://localhost:3000

Security Features Enabled:
  ✓ NIST SP 800-63-2 Compliant Authentication
  ✓ Multi-Factor Authentication (Email OTP)
  ...
```

## First Time Usage

### Create Test Accounts

1. **Author Account**
   - Go to `http://localhost:3000`
   - Click "Register"
   - Fill form with:
     - Full Name: "Dr. Smith"
     - Username: "drsmith"
     - Email: your-email@gmail.com
     - Role: "Author"
   - Check email for OTP
   - Enter OTP on login screen

2. **Reviewer Account**
   - Register new account with Role: "Reviewer"
   - Name: "Dr. Johnson"
   - Verify OTP

3. **Editor Account**
   - Register new account with Role: "Editor"
   - Name: "Prof. Wilson"
   - Verify OTP

### Test Paper Submission

**As Author:**

1. Login to dashboard
2. Click "Submit New Paper"
3. Fill:
   - Title: "Machine Learning for Climate Analysis"
   - Abstract: (copy from below)
   - Keywords: machine learning, climate, neural networks
   - Upload a PDF file
4. Click "Submit Paper"

Sample Abstract:

```
This paper presents a novel approach to climate pattern prediction using deep
learning techniques. We analyze 50 years of climate data and demonstrate how
neural networks can identify non-linear patterns that traditional statistical
methods miss. Our model achieves 95% accuracy in short-term predictions.
```

### Test Review Process

**As Editor:**

1. Login to dashboard
2. View all papers
3. Click paper → "Manage"
4. Assign reviewers (select Dr. Johnson)
5. Save

**As Reviewer:**

1. Login to dashboard
2. See "Assigned Reviews" card
3. Click "View Assigned"
4. Select paper
5. Fill review:
   - Summary: Detailed feedback about paper
   - Rating: 4/5
   - Recommendation: MINOR_REVISION
6. Submit review

**As Editor (continued):**

1. Go back to papers
2. Click paper
3. View all reviews
4. Create final decision:
   - Decision: ACCEPTED or REJECTION_REQUESTED
   - Summary: Editorial comments
5. Submit (automatically digitally signed)

**As Author:**

1. Dashboard shows paper status changed
2. Click "Check Status"
3. View final decision and reviewer comments

## API Testing

Without frontend, test API directly:

```bash
# Test health check
curl http://localhost:3000/api/health

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePassword123!@#",
    "confirmPassword": "SecurePassword123!@#",
    "role": "Author"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "username": "testuser",
    "password": "SecurePassword123!@#"
  }'

# Verify OTP (after getting OTP from email)
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"otp": "123456"}'

# Get current user
curl http://localhost:3000/api/auth/me \
  -b cookies.txt
```

## Automated Testing

```bash
node test-api.js
```

Runs basic tests for:

- User registration
- Login
- Input validation
- Error handling
- Role validation

## Common Issues

### "Cannot connect to MongoDB"

- Check MONGODB_URI is correct
- Verify IP is whitelisted in MongoDB Atlas
- Test connection: `mongo "mongodb+srv://..."`

### "OTP not received"

- Check EMAIL_USER and EMAIL_PASS
- Verify app-specific password (not account password)
- Check spam folder
- Wait 2 minutes (rate limited)

### "Port 3000 already in use"

```bash
# Kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :3000
kill -9 <PID>
```

### "Cannot read private key"

```bash
npm run keygen
# Regenerates keys/public.pem and keys/private.pem
```

## Project Structure Overview

```
research-portal/
├── server.js              ← Start here (Main entry point)
├── models/                ← Database schemas
├── controllers/           ← Business logic
├── middleware/            ← Auth & ACL enforcement
├── routes/                ← API endpoints
├── services/              ← Crypto, email, audit
├── keys/                  ← RSA keys (auto-generated)
├── views/                 ← Frontend templates (Pug)
├── public/styles/         ← CSS stylesheet
└── README.md              ← Full documentation
```

## Security Features

### What's Implemented

✓ Password hashing (bcrypt, cost 12)
✓ MFA via email OTP (5-minute expiry)
✓ File encryption (AES-256-CBC)
✓ Key exchange (RSA-2048)
✓ File integrity (SHA-256 hashing)
✓ Digital signatures (RSA-PSS)
✓ Role-based access control
✓ ACL enforcement at every route
✓ Session management (1-hour timeout)
✓ Audit logging
✓ Input validation
✓ CSRF protection (SameSite cookies)
✓ XSS protection (httpOnly cookies)

### What to Verify

1. **Encryption**: File uploaded → encrypted in DB → decrypted on download
2. **Signatures**: Editor signs decision → can be verified by anyone
3. **ACL**: Author can't view other papers, Reviewer can't review unassigned
4. **MFA**: Can't login without OTP verification
5. **Audit**: Check logs in MongoDB for all actions

## Next Steps

1. **Customize**: Modify colors, emails, validation rules
2. **Deploy**: Use Heroku, AWS, or DigitalOcean
3. **Scale**: Add caching (Redis), load balancing
4. **Monitor**: Set up error tracking (Sentry), logging (LogRocket)
5. **Extend**: Add email templates, analytics, notifications

## Support

For issues:

1. Check `README.md` for detailed documentation
2. Review `test-api.js` for endpoint examples
3. Check MongoDB Atlas for data
4. Look at console logs for errors

---

That's it! You now have a fully secure, production-ready research paper portal. 🎉
