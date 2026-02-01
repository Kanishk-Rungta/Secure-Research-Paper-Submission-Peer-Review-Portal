const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const csurf = require('csurf');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const cryptoLib = require('./crypto');
const db = require('./db');
const utils = require('./utils');
const acl = require('./acl');

const app = express();
app.use(helmet());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Use server-side sessions to avoid storing secrets in client cookies
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 2 * 60 * 60 * 1000, sameSite: 'lax' }
}));

// In-memory private key store for decrypted user private keys tied to session ID
const privateKeyStore = new Map();

// cleanup helper
function storePrivateKeyForSession(sessionId, privateKeyPem) {
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // match session maxAge
  privateKeyStore.set(sessionId, { privateKeyPem, expiresAt });
}

function getPrivateKeyForSession(sessionId) {
  const rec = privateKeyStore.get(sessionId);
  if (!rec) return null;
  if (Date.now() > rec.expiresAt) { privateKeyStore.delete(sessionId); return null; }
  return rec.privateKeyPem;
}

function clearPrivateKeyForSession(sessionId) { privateKeyStore.delete(sessionId); }

const limiter = rateLimit({ windowMs: 15*60*1000, max: 200 });
app.use(limiter);

app.use(express.static(path.join(__dirname, '..', 'client')));

// Use cookie-based CSRF tokens so clients (including unauthenticated) can fetch tokens for forms
const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: 'lax' } });
app.use(csrfProtection);

// Route to fetch a CSRF token for client-side JS to include in AJAX requests
app.get('/api/csrf-token', (req, res) => {
  try {
    return res.json({ csrfToken: req.csrfToken() });
  } catch (e) {
    return res.status(500).json({ error: 'csrf unavailable' });
  }
});

async function sendOTPByEmail(toEmail, otp) {
  try {
    let transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: process.env.SMTP_PORT || 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    } else {
      // create ethereal test account
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, auth: { user: testAccount.user, pass: testAccount.pass } });
    }
    const info = await transporter.sendMail({ from: 'no-reply@secure-portal.example', to: toEmail, subject: 'Your OTP', text: `Your OTP is: ${otp}. It expires in 5 minutes.` });
    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      console.log('Preview OTP email at:', url);
    }
    return true;
  } catch (e) {
    console.error('sendOTP error', e);
    return false;
  }
}

function loadDB() { return db.readDB(); }

app.get('/api/ping', (req, res) => res.json({ ok: true }));

// Signup: create user, generate RSA keypair and store private key encrypted with password-derived key
app.post('/api/signup', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ error: 'missing' });
  if (!['Author','Collaborator','Reviewer'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  if (!utils.validatePassword(password)) return res.status(400).json({ error: 'weak password' });
  const DB = loadDB();
  DB.users = DB.users || {};
  if (DB.users[email]) return res.status(400).json({ error: 'exists' });

  const { publicKey, privateKey } = cryptoLib.generateRSAKeyPair();
  // Derive a symmetric key from password to encrypt private key (PBKDF2)
  const saltBuf = require('crypto').randomBytes(16);
  const saltHex = saltBuf.toString('hex');
  const derived = cryptoLib.deriveKey(password, saltHex);
  const enc = cryptoLib.aesEncrypt(Buffer.from(privateKey, 'utf8'), derived);

  DB.users[email] = {
    email,
    role,
    passwordHash: utils.hashPassword(password),
    rsaPublicKey: publicKey,
    rsaPrivateKeyEncrypted: enc,
    rsaPrivSalt: saltHex,
    failedLogins: 0,
    id: utils.id()
  };
  db.writeDB(DB);
  db.logEvent(DB, { event: 'signup', email });
  // Issue OTP for email verification
  const otp = utils.generateOTP();
  DB.otps = DB.otps || {};
  DB.otps[email] = { otp, expires: Date.now() + 5*60*1000, used: false };
  db.writeDB(DB);
  // Log OTP to console for development/testing
  console.log(`\n🔐 OTP for ${email}: ${otp} (expires in 5 minutes)\n`);
  // Send OTP by email (uses real SMTP if configured, otherwise ethereal test)
  (async ()=>{ const sent = await sendOTPByEmail(email, otp); db.logEvent(DB, { event: 'otp_sent', email, sent }); })();
  return res.json({ ok: true, note: 'verify otp sent to email (may be simulated in test environment)' });
});

app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const DB = loadDB();
  const record = DB.otps && DB.otps[email];
  if (!record) return res.status(400).json({ error: 'no otp' });
  // enforce single-use and expiration
  record.attempts = record.attempts || 0;
  if (record.used) { db.logEvent(DB, { event: 'otp_replay_attempt', email, ip: req.ip }); return res.status(400).json({ error: 'otp used' }); }
  if (Date.now() > record.expires) { db.logEvent(DB, { event: 'otp_expired', email }); return res.status(400).json({ error: 'expired' }); }
  if (record.otp !== otp) {
    record.attempts += 1; db.writeDB(DB);
    db.logEvent(DB, { event: 'otp_invalid', email, attempts: record.attempts });
    if (record.attempts >= 5) { record.used = true; db.writeDB(DB); }
    return res.status(400).json({ error: 'invalid' });
  }
  record.used = true; db.writeDB(DB);
  db.logEvent(DB, { event: 'otp_verified', email });
  return res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const DB = loadDB();
  const user = DB.users && DB.users[email];
  if (!user) { db.logEvent(DB, { event:'login_failed_unknown', email, ip: req.ip }); return res.status(401).json({ error: 'invalid' }); }
  // check account lockout
  if (user.lockUntil && Date.now() < user.lockUntil) {
    db.logEvent(DB, { event:'login_locked', email, ip: req.ip });
    return res.status(423).json({ error: 'account locked' });
  }
  if (!utils.verifyPassword(password, user.passwordHash)) {
    user.failedLogins = (user.failedLogins||0) + 1;
    if (user.failedLogins >= 5) { user.lockUntil = Date.now() + 15*60*1000; }
    db.writeDB(DB);
    db.logEvent(DB, { event:'login_failed', email, ip: req.ip, failedAttempts: user.failedLogins });
    return res.status(401).json({ error: 'invalid' });
  }
  // successful password auth: reset counters
  user.failedLogins = 0; user.lockUntil = null;
  // Derive key using PBKDF2 and decrypt private key server-side, then store private key only in server memory associated to session id
  try {
    const privKey = (function(){
      const keyBuf = cryptoLib.deriveKey(password, user.rsaPrivSalt);
      const plain = cryptoLib.aesDecrypt(user.rsaPrivateKeyEncrypted, keyBuf);
      return plain.toString('utf8');
    })();
    req.session.user = { email: user.email, role: user.role, id: user.id };
    // store private key in memory keyed by session id
    storePrivateKeyForSession(req.sessionID, privKey);
    db.writeDB(DB);
    db.logEvent(DB, { event: 'login_success', email, ip: req.ip });
    return res.json({ ok: true });
  } catch (e) {
    db.logEvent(DB, { event: 'login_priv_decrypt_failed', email, err: String(e) });
    return res.status(500).json({ error: 'crypto' });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  const sessId = req.sessionID;
  clearPrivateKeyForSession(sessId);
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'logout failed' });
    return res.json({ ok: true });
  });
});

// CSRF error handler
app.use(function (err, req, res, next) {
  if (err && err.code === 'EBADCSRFTOKEN') {
    const DB = loadDB();
    db.logEvent(DB, { event: 'csrf_error', by: req.session && req.session.user && req.session.user.email, ip: req.ip });
    return res.status(403).json({ error: 'invalid csrf token' });
  }
  next(err);
});

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  const DB = loadDB();
  db.logEvent(DB, { event: 'unauthenticated_access', path: req.path, ip: req.ip });
  return res.status(401).json({ error: 'auth required' });
}

// Paper submission: Authors create paper; data arrives base64; encrypt with AES; store AES key encrypted with recipients' public keys
app.post('/api/papers', requireAuth, (req, res) => {
  const user = req.session.user;
  if (!acl.checkAccess(user.role, 'Paper', 'create')) { db.logEvent(DB, { event:'access_denied', by: user.email, object:'Paper', action:'create' }); return res.status(403).json({ error: 'forbidden' }); }
  const { title, metadata, fileBase64, collaborators=[], reviewers=[] } = req.body;
  if (!title || !fileBase64) return res.status(400).json({ error: 'missing' });
  const DB = loadDB();
  const aesKey = cryptoLib.generateAESKey();
  const fileBuf = Buffer.from(fileBase64, 'base64');
  const enc = cryptoLib.aesEncrypt(fileBuf, aesKey);
  const hash = cryptoLib.sha256(fileBuf);
  // Build recipients: author, collaborators, reviewers
  const recipients = [user.email, ...collaborators, ...reviewers].filter((v,i,a)=>a.indexOf(v)===i);
  const encryptedKeys = {};
  recipients.forEach(r => {
    const u = DB.users && DB.users[r];
    if (u && u.rsaPublicKey) encryptedKeys[r] = cryptoLib.rsaEncrypt(u.rsaPublicKey, aesKey);
  });
  DB.papers = DB.papers || {};
  const pid = utils.id();
  DB.papers[pid] = {
    id: pid,
    title,
    metadata,
    owner: user.email,
    collaborators,
    reviewers,
    versions: [{ ts: new Date().toISOString(), enc, hash }]
  };
  DB.papers[pid].encryptedKeys = encryptedKeys;
  db.writeDB(DB);
  db.logEvent(DB, { event: 'paper_created', pid, by: user.email });
  return res.json({ ok: true, id: pid });
});

// Read paper (only allowed if the user is recipient and ACL allows read)
app.get('/api/papers/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const pid = req.params.id;
  const DB = loadDB();
  const paper = DB.papers && DB.papers[pid];
  if (!paper) return res.status(404).json({ error: 'not found' });
  // check membership
  const allowedUsers = [paper.owner, ...(paper.collaborators||[]), ...(paper.reviewers||[])];
  if (!allowedUsers.includes(user.email)) { db.logEvent(DB, { event:'access_denied', by: user.email, pid, reason:'not a recipient' }); return res.status(403).json({ error: 'forbidden' }); }
  if (!acl.checkAccess(user.role, 'Paper', 'read')) return res.status(403).json({ error: 'forbidden-role' });
  // decrypt AES key for the user
  const encKey = paper.encryptedKeys && paper.encryptedKeys[user.email];
  if (!encKey) return res.status(403).json({ error: 'no key' });
  try {
    const priv = getPrivateKeyForSession(req.sessionID);
    if (!priv) return res.status(401).json({ error: 'private key not available; re-login required' });
    const aesKey = cryptoLib.rsaDecrypt(priv, encKey);
    const latest = paper.versions[paper.versions.length-1];
    const plain = cryptoLib.aesDecrypt(latest.enc, aesKey);
    db.logEvent(DB, { event: 'paper_decrypted', pid, by: user.email });
    return res.json({ id: pid, title: paper.title, metadata: paper.metadata, fileBase64: plain.toString('base64'), hash: latest.hash });
  } catch (e) {
    db.logEvent(DB, { event: 'decrypt_failed', pid, by: user.email, err: String(e) });
    return res.status(500).json({ error: 'decrypt' });
  }
});

// Reviewer submits review encrypted similarly
app.post('/api/papers/:id/reviews', requireAuth, (req, res) => {
  const user = req.session.user;
  const pid = req.params.id;
  const { reviewBase64 } = req.body;
  const DB = loadDB();
  const paper = DB.papers && DB.papers[pid];
  if (!paper) return res.status(404).json({ error: 'not found' });
  if (!paper.reviewers.includes(user.email)) return res.status(403).json({ error: 'not assigned' });
  if (!acl.checkAccess(user.role, 'Review', 'create')) return res.status(403).json({ error: 'forbidden-role' });
  const aesKey = cryptoLib.generateAESKey();
  const revBuf = Buffer.from(reviewBase64, 'base64');
  const enc = cryptoLib.aesEncrypt(revBuf, aesKey);
  const hash = cryptoLib.sha256(revBuf);
  // encrypt aesKey for author and collaborators (they can read reviews)
  const recipients = [paper.owner, ...(paper.collaborators||[])];
  const encryptedKeys = {};
  recipients.forEach(r => {
    const u = DB.users && DB.users[r];
    if (u && u.rsaPublicKey) encryptedKeys[r] = cryptoLib.rsaEncrypt(u.rsaPublicKey, aesKey);
  });
  DB.reviews = DB.reviews || {};
  const rid = utils.id();
  DB.reviews[rid] = { id: rid, pid, by: user.email, enc, hash, encryptedKeys, ts: new Date().toISOString() };
  db.writeDB(DB);
  db.logEvent(DB, { event:'review_submitted', rid, pid, by: user.email });
  return res.json({ ok: true, id: rid });
});

// Collaborator issues final decision: must sign using private key
app.post('/api/papers/:id/decision', requireAuth, (req, res) => {
  const user = req.session.user;
  const pid = req.params.id;
  const { decisionText } = req.body;
  const DB = loadDB();
  const paper = DB.papers && DB.papers[pid];
  if (!paper) return res.status(404).json({ error: 'not found' });
  if (!paper.collaborators.includes(user.email)) return res.status(403).json({ error: 'not collaborator' });
  if (!acl.checkAccess(user.role, 'FinalDecision', 'create')) return res.status(403).json({ error: 'forbidden-role' });
  const priv = getPrivateKeyForSession(req.sessionID);
  if (!priv) return res.status(401).json({ error: 'private key not available; re-login required' });
  const buf = Buffer.from(decisionText, 'utf8');
  const hash = cryptoLib.sha256(buf);
  const signature = cryptoLib.sign(priv, buf);
  DB.papers[pid].decision = { by: user.email, decisionText, hash, signature, ts: new Date().toISOString() };
  db.writeDB(DB);
  db.logEvent(DB, { event:'decision_issued', pid, by: user.email });
  return res.json({ ok: true });
});

// Read final decision: Authors and Collaborators can read; Reviewers cannot by ACL
app.get('/api/papers/:id/decision', requireAuth, (req, res) => {
  const user = req.session.user;
  const pid = req.params.id;
  const DB = loadDB();
  const paper = DB.papers && DB.papers[pid];
  if (!paper || !paper.decision) return res.status(404).json({ error: 'no decision' });
  if (!acl.checkAccess(user.role, 'FinalDecision', 'read')) { db.logEvent(DB, { event:'access_denied', by: user.email, object:'FinalDecision', pid }); return res.status(403).json({ error: 'forbidden' }); }
  // verify signature
  const dec = paper.decision;
  const authorPublic = DB.users && DB.users[dec.by] && DB.users[dec.by].rsaPublicKey;
  const ok = cryptoLib.verify(authorPublic, Buffer.from(dec.decisionText,'utf8'), dec.signature);
  db.logEvent(DB, { event: 'decision_read', pid, by: user.email, verified: ok });
  return res.json({ decision: dec, signature_valid: ok });
});

// Simple logs endpoint for admins (not exposing sensitive private keys)
app.get('/api/logs', requireAuth, (req, res) => {
  const user = req.session.user;
  if (!acl.checkAccess(user.role, 'FinalDecision', 'read')) { db.logEvent(DB, { event:'access_denied', by: user.email, object:'FinalDecision', pid }); return res.status(403).json({ error: 'forbidden' }); }
  const DB = loadDB();
  return res.json({ logs: DB.logs || [] });
});

// Return basic session user info
app.get('/api/me', requireAuth, (req, res) => {
  const u = req.session.user;
  return res.json({ ok: true, user: { email: u.email, role: u.role, id: u.id } });
});

// List papers the user can access (summaries only)
app.get('/api/papers', requireAuth, (req, res) => {
  const user = req.session.user;
  const DB = loadDB();
  const papers = Object.values(DB.papers || {}).filter(p => {
    const allowed = [p.owner, ...(p.collaborators||[]), ...(p.reviewers||[])];
    return allowed.includes(user.email);
  }).map(p => {
    const versions = p.versions || [];
    const latest = versions[versions.length-1] || {};
    // review progress
    const reviews = Object.values(DB.reviews || {}).filter(r => r.pid === p.id);
    return { id: p.id, title: p.title, owner: p.owner, collaborators: p.collaborators, reviewers: p.reviewers, versionCount: versions.length, hash: latest.hash, reviewCount: reviews.length };
  });
  db.logEvent(DB, { event: 'papers_list', by: user.email });
  return res.json({ ok: true, papers });
});

// Dashboard aggregation (role-specific)
app.get('/api/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  const DB = loadDB();
  if (user.role === 'Author') {
    const my = Object.values(DB.papers || {}).filter(p => p.owner === user.email).map(p => {
      const reviews = Object.values(DB.reviews || {}).filter(r => r.pid === p.id);
      return { id: p.id, title: p.title, collaborators: p.collaborators, reviewers: p.reviewers, versions: p.versions.length, reviews: reviews.length, decision: p.decision || null };
    });
    db.logEvent(DB, { event: 'dashboard_view', role: 'Author', by: user.email });
    return res.json({ ok: true, role: 'Author', papers: my });
  }
  if (user.role === 'Collaborator') {
    const assigned = Object.values(DB.papers || {}).filter(p => (p.collaborators||[]).includes(user.email)).map(p => {
      const reviews = Object.values(DB.reviews || {}).filter(r => r.pid === p.id);
      return { id: p.id, title: p.title, owner: p.owner, reviews: reviews.map(r => ({ id: r.id, by: r.by, ts: r.ts })) , decision: p.decision || null };
    });
    db.logEvent(DB, { event: 'dashboard_view', role: 'Collaborator', by: user.email });
    return res.json({ ok: true, role: 'Collaborator', papers: assigned });
  }
  if (user.role === 'Reviewer') {
    const assigned = Object.values(DB.papers || {}).filter(p => (p.reviewers||[]).includes(user.email)).map(p => ({ id: p.id, title: p.title, owner: p.owner }));
    db.logEvent(DB, { event: 'dashboard_view', role: 'Reviewer', by: user.email });
    return res.json({ ok: true, role: 'Reviewer', papers: assigned });
  }
  return res.status(400).json({ error: 'unknown role' });
});

// Fetch a review (decrypted) - only Collaborators and Paper Owner may read reviews
app.get('/api/reviews/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const rid = req.params.id;
  const DB = loadDB();
  const review = DB.reviews && DB.reviews[rid];
  if (!review) return res.status(404).json({ error: 'not found' });
  const paper = DB.papers && DB.papers[review.pid];
  if (!paper) return res.status(404).json({ error: 'parent paper not found' });
  const isOwnerOrCollab = (paper.owner === user.email) || ((paper.collaborators||[]).includes(user.email));
  if (!isOwnerOrCollab) { db.logEvent(DB, { event:'access_denied', by: user.email, rid, reason:'not owner or collaborator' }); return res.status(403).json({ error: 'forbidden' }); }
  if (!acl.checkAccess(user.role, 'Review', 'read')) return res.status(403).json({ error: 'forbidden-role' });
  const encKey = review.encryptedKeys && review.encryptedKeys[user.email];
  if (!encKey) return res.status(403).json({ error: 'no key' });
  try {
    const priv = getPrivateKeyForSession(req.sessionID);
    if (!priv) return res.status(401).json({ error: 'private key not available; re-login required' });
    const aesKey = cryptoLib.rsaDecrypt(priv, encKey);
    const plain = cryptoLib.aesDecrypt(review.enc, aesKey);
    db.logEvent(DB, { event: 'review_decrypted', rid, by: user.email });
    return res.json({ id: rid, pid: review.pid, by: review.by, fileBase64: plain.toString('base64'), hash: review.hash, ts: review.ts });
  } catch (e) {
    db.logEvent(DB, { event: 'review_decrypt_failed', rid, by: user.email, err: String(e) });
    return res.status(500).json({ error: 'decrypt' });
  }
});

// Periodic cleanup of expired private keys to reduce memory exposure
setInterval(() => {
  const now = Date.now();
  for (const [sid, rec] of privateKeyStore.entries()) {
    if (rec.expiresAt <= now) privateKeyStore.delete(sid);
  }
}, 60*60*1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
