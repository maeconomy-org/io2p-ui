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
  | 'cancelled'

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
// Takes `undefined` so callers can ask about a job that has not loaded yet — which is not active.
export function isActiveJobStatus(status?: ImportJobStatus): boolean {
  return !!status && ['pending', 'receiving', 'processing'].includes(status)
}

/**
 * Check if a job status is considered "finished"
 */
export function isFinishedJobStatus(status: ImportJobStatus): boolean {
  return ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(
    status
  )
}
