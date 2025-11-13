import { ClientConfig } from 'iom-sdk'

export const API_CONFIG: ClientConfig = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_API_URL || '',
  uuidServiceBaseUrl: process.env.NEXT_PUBLIC_UUID_API_URL || '',

  debug: {
    enabled: true,
    logLevel: 'error',
    logToConsole: true,
  },
}
