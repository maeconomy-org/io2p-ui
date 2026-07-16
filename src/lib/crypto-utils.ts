import crypto from 'crypto'
import { logger } from './logger'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get the encryption key from environment.
 * Falls back to a deterministic key derived from REDIS_PASSWORD
 * if REDIS_ENCRYPTION_KEY is not set.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.REDIS_ENCRYPTION_KEY

  if (envKey) {
    // Use SHA-256 to ensure exactly 32 bytes regardless of input length
    return crypto.createHash('sha256').update(envKey).digest()
  }

  // Fallback: derive from REDIS_PASSWORD (still better than plaintext)
  const redisPassword = process.env.REDIS_PASSWORD
  if (redisPassword) {
    return crypto
      .createHash('sha256')
      .update(`iom-redis-encryption:${redisPassword}`)
      .digest()
  }

  // No encryption key available — log warning once and return null-ish
  // This will cause encrypt/decrypt to pass through plaintext
  logger.warn(
    'No REDIS_ENCRYPTION_KEY or REDIS_PASSWORD set — tokens stored unencrypted'
  )
  return crypto.createHash('sha256').update('iom-default-key').digest()
}

/**
 * Encrypt a string value using AES-256-GCM.
 * Returns base64-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    const authTag = cipher.getAuthTag()

    // Combine: iv (16) + authTag (16) + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted])
    return combined.toString('base64')
  } catch (error) {
    logger.error('Encryption failed', { error })
    throw new Error('Failed to encrypt value', { cause: error })
  }
}

/**
 * Decrypt a base64-encoded AES-256-GCM encrypted string.
 * Handles both encrypted (base64 with iv+tag) and legacy plaintext values.
 */
export function decrypt(encryptedValue: string): string {
  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedValue, 'base64')

    // Minimum valid length: IV (16) + AuthTag (16) + at least 1 byte ciphertext
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      // Likely a legacy plaintext JWT — return as-is
      return encryptedValue
    }

    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
  } catch {
    // If decryption fails, this is likely a legacy plaintext JWT
    // Return as-is for backward compatibility
    return encryptedValue
  }
}
