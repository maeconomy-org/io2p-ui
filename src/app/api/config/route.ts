import { NextResponse } from 'next/server'

// Runtime config API - serves env vars to client at runtime
// This allows one Docker image to work on multiple VMs with different configs
export async function GET() {
  return NextResponse.json({
    // API endpoints
    baseApiUrl: process.env.BASE_API_URL || '',
    uuidApiUrl: process.env.UUID_API_URL || '',

    // Sentry config (client-side)
    sentryDsn: process.env.SENTRY_DSN || '',
    sentryEnabled: process.env.SENTRY_ENABLED || 'false',
    sentryRelease: process.env.SENTRY_RELEASE || '',

    // Environment
    nodeEnv: process.env.NODE_ENV || 'development',

    // App information (client-side needed)
    appName: process.env.APP_NAME || 'Internet of Materials',
    appDescription: process.env.APP_DESCRIPTION || 'Material Management System',
    appAcronym: process.env.APP_ACRONYM || 'IoM',
    contactUrl: process.env.CONTACT_URL || 'https://example.com/contact',
    supportEmail:
      process.env.SUPPORT_EMAIL || 'support@internetofmaterials.com',

    // Import limits (client-side needed for UI)
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '100'),
    maxImportPayloadMB: parseInt(process.env.MAX_IMPORT_PAYLOAD_MB || '100'),
    maxObjectsPerImport: parseInt(
      process.env.MAX_OBJECTS_PER_IMPORT || '50000'
    ),
  })
}
