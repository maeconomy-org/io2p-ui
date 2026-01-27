/**
 * Shared types for import-related hooks and components
 */

export type ImportJobStatus =
  | 'pending'
  | 'receiving'
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'

export interface ImportJobSummary {
  jobId: string
  status: ImportJobStatus
  total: number
  processed: number
  failed: number
  createdAt: number | null
  completedAt: number | null
  error: string | null
}

export interface ImportJobDetails extends ImportJobSummary {
  // Additional fields from detailed status API
}

/**
 * Check if a job status is considered "active" (still processing)
 */
export function isActiveJobStatus(status: ImportJobStatus): boolean {
  return ['pending', 'receiving', 'processing'].includes(status)
}

/**
 * Check if a job status is considered "finished"
 */
export function isFinishedJobStatus(status: ImportJobStatus): boolean {
  return ['completed', 'completed_with_errors', 'failed'].includes(status)
}
