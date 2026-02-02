const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const sessionMiddleware = require('./config/session');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB Atlas
connectDB();

// ==================== MIDDLEWARE ====================

// Body parsing
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// CORS configuration
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}));

// Session management (NIST SP 800-63-2 compliant)
app.use(sessionMiddleware);

// Set view engine (for frontend pages)
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // HTTPS only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ==================== ROUTES ====================

// Auth routes
app.use('/api/auth', require('./routes/authRoutes'));

// Paper, review, decision routes
app.use('/api/papers', require('./routes/paperRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Frontend routes
app.get('/', (req, res) => {
  if (req.session.userId && req.session.mfaVerified) {
    res.render('dashboard');
  } else {
    res.render('index');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/register/verify', (req, res) => {
  // Render OTP entry page for pending registrations
  res.render('verify-registration');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId || !req.session.mfaVerified) {
    return res.redirect('/login');
  }
  res.render('dashboard');
});

app.get('/papers', (req, res) => {
  if (!req.session.userId || !req.session.mfaVerified) {
    return res.redirect('/login');
  }
  res.render('papers');
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Multer file upload errors
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  // Generic error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ==================== SERVER STARTUP ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Research Paper Submission & Peer-Review Portal            ║');
  console.log('║  Secure Backend Server                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Security Features Enabled:');
  console.log('  ✓ NIST SP 800-63-2 Compliant Authentication');
  console.log('  ✓ Multi-Factor Authentication (Email OTP)');
  console.log('  ✓ Bcrypt Password Hashing (per-user salt, cost 12)');
  console.log('  ✓ AES-256-CBC File Encryption');
  console.log('  ✓ RSA-2048 Hybrid Encryption');
  console.log('  ✓ RSA-PSS Digital Signatures (non-repudiation)');
  console.log('  ✓ SHA-256 File Integrity Verification');
  console.log('  ✓ Role-Based Access Control (RBAC)');
  console.log('  ✓ Access Control Matrix (ACL) Enforcement');
  console.log('  ✓ Audit Logging');
  console.log('  ✓ Session Management with Timeout');
  console.log('  ✓ CORS & Security Headers');
  console.log('');
  console.log('API Endpoints:');
  console.log('  POST   /api/auth/register');
  console.log('  POST   /api/auth/login');
  console.log('  POST   /api/auth/verify-otp');
  console.log('  POST   /api/auth/logout');
  console.log('  GET    /api/auth/me');
  console.log('  POST   /api/papers');
  console.log('  GET    /api/papers');
  console.log('  GET    /api/papers/:paperId');
  console.log('  GET    /api/papers/:paperId/download');
  console.log('  POST   /api/papers/:paperId/reviews');
  console.log('  POST   /api/papers/:paperId/decision');
  console.log('  GET    /api/papers/:paperId/decision');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✓ Shutting down server...');
  process.exit(0);
});

module.exports = app;
