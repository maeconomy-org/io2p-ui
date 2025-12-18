// Health dashboard types - shared between API and UI

export interface JobDetails {
  jobId: string
  status: string
  total: number
  processed: number
  failed: number
  failedCount: number
  createdAt: number | null
  completedAt: number | null
  userUUID: string | null
  error: string | null
}

export interface HealthData {
  status: 'healthy' | 'warning' | 'critical' | 'error'
  timestamp: string
  redis: {
    memory: {
      usedMB: number
      maxMB: number
      usedPercentage: number
      warning: boolean
      alert: boolean
    }
    keyCount: number
  }
  imports: {
    total: number
    active: number
    completed: number
    failed: number
    chunks: number
  }
  jobs: JobDetails[]
  system: {
    nodeVersion: string
    uptime: number
    uptimeFormatted: string
    memory: {
      heapUsedMB: number
      heapTotalMB: number
      rssMB: number
    }
  }
  environment: {
    nodeEnv: string
    verifyCertificates: boolean
    allowInsecureFallback: boolean
  }
  auth: {
    certFingerprint: string | null
    certSerial: string | null
  }
}

export interface FailureRecord {
  batchNumber: number
  index: number
  object: Record<string, unknown>
  error: string
  errorType: string
  timestamp: number
}
