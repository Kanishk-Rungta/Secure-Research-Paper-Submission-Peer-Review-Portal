/**
 * RSA-2048 Key Pair Generator
 * Run once to generate server keys: node keys/generate-keys.js
 * Generates public and private keys for hybrid encryption
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Generating RSA-2048 key pair...');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const keyDir = path.join(__dirname);

// Write public key
fs.writeFileSync(path.join(keyDir, 'public.pem'), publicKey);
console.log('✓ Public key saved to keys/public.pem');

// Write private key with restricted permissions
fs.writeFileSync(path.join(keyDir, 'private.pem'), privateKey, { mode: 0o600 });
console.log('✓ Private key saved to keys/private.pem (mode: 0600)');

console.log('\n⚠️  IMPORTANT: Keep private.pem secure and never commit to version control!');
console.log('Add "keys/private.pem" to .gitignore');
