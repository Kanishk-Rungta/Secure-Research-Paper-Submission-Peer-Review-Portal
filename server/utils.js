const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function validatePassword(password) {
  if (!password || password.length < 12) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(12);
  const h = bcrypt.hashSync(password, salt);
  return h;
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateOTP() {
  // cryptographically secure 6-digit OTP
  const n = crypto.randomInt(100000, 1000000);
  return n.toString();
}

function id() { return uuidv4(); }

module.exports = { validatePassword, hashPassword, verifyPassword, generateOTP, id };
