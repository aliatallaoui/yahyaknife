/**
 * Credential Encryption — AES-256-GCM encrypt/decrypt for sensitive config values.
 *
 * Uses CREDENTIAL_ENCRYPTION_KEY env var (32-byte hex or 64-char hex string).
 * Format: "iv:authTag:ciphertext" (all base64-encoded).
 *
 * Usage:
 *   const { encrypt, decrypt, encryptSensitiveKeys } = require('../shared/utils/credentialEncryption');
 *   const encrypted = encrypt('my-secret');
 *   const plaintext = decrypt(encrypted);
 */

const crypto = require('crypto');
const logger = require('../logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Config keys that must be encrypted before storage
const SENSITIVE_CONFIG_KEYS = new Set([
    'consumerSecret', 'apiToken', 'webhookSecret', 'apiKey', 'accessToken',
    'clientSecret', 'refreshToken'
]);

function getKey() {
    const envKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!envKey) {
        throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is not set');
    }
    // Accept 32-byte raw or 64-char hex
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
        return Buffer.from(envKey, 'hex');
    }
    if (envKey.length === 32) {
        return Buffer.from(envKey, 'utf8');
    }
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (or 64 hex chars)');
}

/**
 * Encrypt a plaintext string.
 * @param {string} plaintext
 * @returns {string} "iv:authTag:ciphertext" (base64)
 */
function encrypt(plaintext) {
    if (!plaintext) return plaintext;
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string.
 * @param {string} encryptedString - "iv:authTag:ciphertext" format
 * @returns {string} plaintext
 */
function decrypt(encryptedString) {
    if (!encryptedString || !isEncrypted(encryptedString)) return encryptedString;
    const key = getKey();
    const parts = encryptedString.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Check if a value looks like an encrypted string (iv:tag:cipher format).
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
    if (typeof value !== 'string') return false;
    const parts = value.split(':');
    return parts.length === 3 && parts.every(p => p.length > 0);
}

/**
 * Encrypt sensitive keys in a config Map/object. Non-sensitive keys are left as-is.
 * @param {Map|object} config
 * @returns {Map} config with sensitive values encrypted
 */
function encryptSensitiveKeys(config) {
    const result = new Map();
    const entries = config instanceof Map ? config.entries() : Object.entries(config);
    for (const [key, value] of entries) {
        if (SENSITIVE_CONFIG_KEYS.has(key) && value && !isEncrypted(value)) {
            result.set(key, encrypt(value));
        } else {
            result.set(key, value);
        }
    }
    return result;
}

/**
 * Decrypt sensitive keys in a config Map. Returns a plain object.
 * @param {Map|object} config
 * @returns {object} config with sensitive values decrypted
 */
function decryptSensitiveKeys(config) {
    const result = {};
    const entries = config instanceof Map ? config.entries() : Object.entries(config);
    for (const [key, value] of entries) {
        if (SENSITIVE_CONFIG_KEYS.has(key) && value && isEncrypted(value)) {
            try {
                result[key] = decrypt(value);
            } catch (err) {
                logger.error({ err, key }, 'Failed to decrypt config key');
                result[key] = null;
            }
        } else {
            result[key] = value;
        }
    }
    return result;
}

module.exports = {
    encrypt,
    decrypt,
    isEncrypted,
    encryptSensitiveKeys,
    decryptSensitiveKeys,
    SENSITIVE_CONFIG_KEYS,
};
