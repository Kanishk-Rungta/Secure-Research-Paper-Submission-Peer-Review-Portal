const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Cryptography Service
 * Implements AES-256-CBC for symmetric encryption, RSA-2048 for asymmetric,
 * SHA-256 for hashing, and RSA-PSS for digital signatures.
 * Follows NIST recommendations for encryption and key management.
 */

class CryptoService {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.hashAlgorithm = 'sha256';
    this.rsaKeySize = 2048;
  }

  /**
   * Generate a random AES key (256 bits = 32 bytes)
   * Used for per-session file encryption
   */
  generateAESKey() {
    return crypto.randomBytes(32);
  }

  /**
   * Generate random IV for AES-256-CBC (128 bits = 16 bytes)
   * IMPORTANT: IV must be unique per encryption operation
   */
  generateIV() {
    return crypto.randomBytes(16);
  }

  /**
   * Encrypt data using AES-256-CBC
   * @param {Buffer} plaintext - Data to encrypt
   * @param {Buffer} key - AES-256 key (32 bytes)
   * @param {Buffer} iv - Initialization vector (16 bytes)
   * @returns {Buffer} Encrypted data
   */
  encryptAES(plaintext, key, iv) {
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return encrypted;
  }

  /**
   * Decrypt data using AES-256-CBC
   * @param {Buffer} ciphertext - Encrypted data
   * @param {Buffer} key - AES-256 key (32 bytes)
   * @param {Buffer} iv - Initialization vector (16 bytes)
   * @returns {Buffer} Decrypted data
   */
  decryptAES(ciphertext, key, iv) {
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted;
  }

  /**
   * Encrypt AES key using RSA-2048 public key
   * Hybrid encryption: symmetric for data, asymmetric for key exchange
   * @param {Buffer} aesKey - AES-256 key to encrypt
   * @param {string} publicKeyPath - Path to RSA public key
   * @returns {Buffer} Encrypted AES key
   */
  encryptKeyWithRSA(aesKey, publicKeyPath) {
    try {
      const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        aesKey
      );
      return encrypted;
    } catch (error) {
      throw new Error(`RSA key encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt AES key using RSA-2048 private key
   * @param {Buffer} encryptedKey - Encrypted AES key
   * @param {string} privateKeyPath - Path to RSA private key
   * @returns {Buffer} Decrypted AES key
   */
  decryptKeyWithRSA(encryptedKey, privateKeyPath) {
    try {
      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        encryptedKey
      );
      return decrypted;
    } catch (error) {
      throw new Error(`RSA key decryption failed: ${error.message}`);
    }
  }

  /**
   * Calculate SHA-256 hash of data
   * Used for file integrity verification and digital signatures
   * @param {Buffer} data - Data to hash
   * @returns {string} Hex-encoded SHA-256 hash
   */
  hashSHA256(data) {
    return crypto.createHash(this.hashAlgorithm).update(data).digest('hex');
  }

  /**
   * Sign data using RSA-PSS (Probabilistic Signature Scheme)
   * More secure than PKCS#1 v1.5 padding
   * @param {Buffer} data - Data to sign
   * @param {string} privateKeyPath - Path to RSA private key
   * @returns {string} Base64-encoded signature
   */
  signData(data, privateKeyPath) {
    try {
      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      const signature = crypto.sign(
        'sha256',
        data,
        {
          key: privateKey,
          padding: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        }
      );
      return signature.toString('base64');
    } catch (error) {
      throw new Error(`Digital signature failed: ${error.message}`);
    }
  }

  /**
   * Verify digitally signed data using RSA-PSS
   * @param {Buffer} data - Original data
   * @param {string} signature - Base64-encoded signature
   * @param {string} publicKeyPath - Path to RSA public key
   * @returns {boolean} True if signature is valid
   */
  verifySignature(data, signature, publicKeyPath) {
    try {
      const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'base64');
      return crypto.verify(
        'sha256',
        data,
        {
          key: publicKey,
          padding: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        },
        signatureBuffer
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Encrypt a file for storage (Hybrid Encryption)
   * 1. Generate AES-256 key and IV
   * 2. Encrypt file with AES
   * 3. Encrypt AES key with RSA
   * 4. Return: Base64 encrypted file + encrypted AES key + SHA-256 hash
   * @param {Buffer} fileBuffer - File content
   * @param {string} publicKeyPath - Path to RSA public key
   * @returns {Object} Encrypted file package
   */
  encryptFile(fileBuffer, publicKeyPath) {
    const aesKey = this.generateAESKey();
    const iv = this.generateIV();

    // Encrypt file with AES
    const encryptedFile = this.encryptAES(fileBuffer, aesKey, iv);

    // Encrypt AES key with RSA
    const encryptedKey = this.encryptKeyWithRSA(aesKey, publicKeyPath);

    // Calculate hash for integrity verification
    const hash = this.hashSHA256(fileBuffer);

    return {
      // Base64 encoded encrypted file
      encryptedData: encryptedFile.toString('base64'),
      // Store IV separately (IV doesn't need to be encrypted, just unique)
      iv: iv.toString('base64'),
      // Base64 encoded RSA-encrypted AES key
      encryptedKey: encryptedKey.toString('base64'),
      // SHA-256 hash of original file
      hash: hash,
    };
  }

  /**
   * Decrypt a file for retrieval
   * @param {Object} encryptedPackage - Object from encryptFile
   * @param {string} privateKeyPath - Path to RSA private key
   * @returns {Object} Decrypted file and verification status
   */
  decryptFile(encryptedPackage, privateKeyPath) {
    try {
      // Decrypt AES key using RSA
      const encryptedKeyBuffer = Buffer.from(encryptedPackage.encryptedKey, 'base64');
      const aesKey = this.decryptKeyWithRSA(encryptedKeyBuffer, privateKeyPath);

      // Decrypt file using AES
      const iv = Buffer.from(encryptedPackage.iv, 'base64');
      const encryptedFileBuffer = Buffer.from(encryptedPackage.encryptedData, 'base64');
      const decryptedFile = this.decryptAES(encryptedFileBuffer, aesKey, iv);

      // Verify hash
      const calculatedHash = this.hashSHA256(decryptedFile);
      const hashVerified = calculatedHash === encryptedPackage.hash;

      return {
        data: decryptedFile,
        hashVerified: hashVerified,
        originalHash: encryptedPackage.hash,
        calculatedHash: calculatedHash,
      };
    } catch (error) {
      throw new Error(`File decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate cryptographic OTP (One-Time Password)
   * Uses crypto.randomInt for secure random number generation
   * NIST recommends at least 1 million OTPs (6 digits)
   * @returns {string} 6-digit OTP
   */
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Compare plain text with bcrypt hash
   * Note: bcrypt is handled separately in authService
   * @param {string} password - Plain text password
   * @param {string} hash - Bcrypt hash
   * @returns {Promise<boolean>}
   */
  async comparePassword(password, hash) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  }

  /**
   * Hash password with bcrypt
   * Bcrypt automatically generates per-user salt (cost factor 12)
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Bcrypt hash
   */
  async hashPassword(password) {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 12);
  }
}

module.exports = new CryptoService();
