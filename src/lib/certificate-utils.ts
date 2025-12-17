import fs from 'fs'
import https from 'https'
import path from 'path'
import { VERIFY_CERTIFICATES, ALLOW_INSECURE_FALLBACK } from '@/constants'

export interface CertificateConfig {
  certPath?: string
  password?: string
  rejectUnauthorized?: boolean
  fallbackToInsecure?: boolean
}

/**
 * Creates an HTTPS agent with client certificate authentication
 * @param config Configuration options for certificate loading
 * @returns HTTPS Agent configured with certificates or fallback agent
 */
export function createCertificateAgent(
  config: CertificateConfig = {}
): https.Agent {
  const {
    certPath = process.env.CERTIFICATE_PATH ||
      path.join(process.cwd(), './certs/uuprotocol_dev.pem'),
    password,
    rejectUnauthorized = VERIFY_CERTIFICATES, // Use environment variable
    fallbackToInsecure = ALLOW_INSECURE_FALLBACK, // Use environment variable
  } = config

  try {
    // Create HTTPS agent options with base security settings
    const agentOptions: https.AgentOptions = {
      rejectUnauthorized,
      checkServerIdentity: () => undefined, // Always disable hostname verification for certificate mismatch
      // Additional SSL options for better compatibility
      secureProtocol: 'TLS_method',
      honorCipherOrder: true,
      ciphers: 'HIGH:!aNULL:!MD5:!RC4:!3DES',
    }

    // Check if certificate file exists
    if (fs.existsSync(certPath)) {
      const cert = fs.readFileSync(certPath)
      const certString = cert.toString()

      // Check if this is a PEM-formatted certificate with private key
      const hasPemKey =
        certString.includes('-----BEGIN PRIVATE KEY-----') ||
        certString.includes('-----BEGIN RSA PRIVATE KEY-----') ||
        certString.includes('-----BEGIN EC PRIVATE KEY-----') ||
        certString.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----')

      // Handle different certificate formats
      const fileExtension = path.extname(certPath).toLowerCase()

      if (fileExtension === '.p12' || fileExtension === '.pfx') {
        // PKCS#12 format - contains both certificate and private key
        agentOptions.pfx = cert
        if (password) {
          agentOptions.passphrase = password
        }
      } else if (fileExtension === '.cer' || fileExtension === '.crt') {
        // Certificate format - check if it contains private key
        if (hasPemKey) {
          // PEM format with both cert and key
          agentOptions.cert = cert
          agentOptions.key = cert // Same file contains both
          if (password) {
            agentOptions.passphrase = password
          }
        } else {
          // Only certificate, look for separate key file
          const keyPath = certPath.replace(/\.(cer|crt)$/i, '.key')
          const keyPathPem = certPath.replace(/\.(cer|crt)$/i, '.pem')

          if (fs.existsSync(keyPath)) {
            const key = fs.readFileSync(keyPath)
            agentOptions.cert = cert
            agentOptions.key = key
            if (password) {
              agentOptions.passphrase = password
            }
          } else if (fs.existsSync(keyPathPem)) {
            const key = fs.readFileSync(keyPathPem)
            agentOptions.cert = cert
            agentOptions.key = key
            if (password) {
              agentOptions.passphrase = password
            }
          } else {
            // No separate key file found, use certificate only
            agentOptions.cert = cert
            if (password) {
              agentOptions.passphrase = password
            }
          }
        }
      } else {
        // Default to certificate format (including .pem files)
        if (hasPemKey) {
          // PEM file with both cert and key
          agentOptions.cert = cert
          agentOptions.key = cert
          if (password) {
            agentOptions.passphrase = password
          }
        } else {
          // Just certificate
          agentOptions.cert = cert
          if (password) {
            agentOptions.passphrase = password
          }
        }
      }

      const agent = new https.Agent(agentOptions)
      return agent
    } else {
      if (fallbackToInsecure) {
        return new https.Agent({
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
        })
      } else {
        throw new Error(`Certificate file not found: ${certPath}`)
      }
    }
  } catch (error) {
    console.warn(
      'Certificate setup error:',
      error instanceof Error ? error.message : String(error)
    )
    if (fallbackToInsecure) {
      return new https.Agent({
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      })
    } else {
      throw error
    }
  }
}

/**
 * Checks if the certificate file exists and is readable
 * @param certPath Path to the certificate file (defaults to CERTIFICATE_PATH env var or certs/uuprotocol_dev.cer)
 * @returns boolean indicating if certificate is available
 */
export function isCertificateAvailable(certPath?: string): boolean {
  const actualPath =
    certPath ||
    process.env.CERTIFICATE_PATH ||
    path.join(process.cwd(), './certs/uuprotocol_dev.cer')

  try {
    return fs.existsSync(actualPath) && fs.statSync(actualPath).isFile()
  } catch (error) {
    console.warn('Error checking certificate availability:', error)
    return false
  }
}

/**
 * Gets information about the certificate file
 * @param certPath Path to the certificate file (defaults to CERTIFICATE_PATH env var or certs/uuprotocol_dev.cer)
 * @returns Certificate information or null if not available
 */
export function getCertificateInfo(certPath?: string) {
  const actualPath =
    certPath ||
    process.env.CERTIFICATE_PATH ||
    path.join(process.cwd(), './certs/uuprotocol_dev.cer')

  try {
    if (!fs.existsSync(actualPath)) {
      return null
    }

    const stats = fs.statSync(actualPath)
    const extension = path.extname(actualPath).toLowerCase()

    let format = 'Unknown'
    if (extension === '.p12' || extension === '.pfx') {
      format = 'PKCS#12'
    } else if (extension === '.cer' || extension === '.crt') {
      format = 'Certificate'
    } else if (extension === '.pem') {
      format = 'PEM'
    }

    return {
      path: actualPath,
      size: stats.size,
      modified: stats.mtime,
      exists: true,
      format,
      extension,
    }
  } catch (error) {
    console.warn('Error getting certificate info:', error)
    return null
  }
}
