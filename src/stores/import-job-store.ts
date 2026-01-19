import { createStoreWithDevtools } from './utils/store-utils'

export interface ImportJob {
  id: string
  type: 'bulk-import' | 'chunked-import' | 'single-import'
  status: 'starting' | 'processing' | 'completed' | 'failed' | 'cancelled'
  totalItems: number
  processedItems: number
  failedItems: number
  startTime: Date
  endTime?: Date
  error?: string
  result?: any
  data?: {
    objectCount: number
    estimatedSizeMB: number
    fileName?: string
    [key: string]: any
  }
}

export interface ImportJobState {
  // State
  jobs: ImportJob[]
  activeJobCount: number

  // Actions
  addJob: (job: ImportJob) => void
  updateJob: (jobId: string, updates: Partial<ImportJob>) => void
  removeJob: (jobId: string) => void
  clearCompletedJobs: () => void
  clearAllJobs: () => void
  getJob: (jobId: string) => ImportJob | undefined
  getUserJobs: () => ImportJob[]
  getActiveJobs: () => ImportJob[]
  getCompletedJobs: () => ImportJob[]
  getFailedJobs: () => ImportJob[]
}

export const useImportJobStore = createStoreWithDevtools<ImportJobState>(
  (set, get) => ({
    // Initial state
    jobs: [],
    activeJobCount: 0,

    // Add a new import job
    addJob: (job) => {
      set((draft) => {
        draft.jobs.unshift(job) // Add to beginning for newest first
        draft.activeJobCount = draft.jobs.filter(
          (j) => j.status === 'starting' || j.status === 'processing'
        ).length
      })
    },

    // Update an existing job
    updateJob: (jobId, updates) => {
      set((draft) => {
        const jobIndex = draft.jobs.findIndex((j) => j.id === jobId)
        if (jobIndex !== -1) {
          Object.assign(draft.jobs[jobIndex], updates)

          // Update active job count
          draft.activeJobCount = draft.jobs.filter(
            (j) => j.status === 'starting' || j.status === 'processing'
          ).length
        }
      })
    },

    // Remove a job
    removeJob: (jobId) => {
      set((draft) => {
        draft.jobs = draft.jobs.filter((j) => j.id !== jobId)
        draft.activeJobCount = draft.jobs.filter(
          (j) => j.status === 'starting' || j.status === 'processing'
        ).length
      })
    },

    // Clear completed jobs
    clearCompletedJobs: () => {
      set((draft) => {
        draft.jobs = draft.jobs.filter((j) => j.status !== 'completed')
        draft.activeJobCount = draft.jobs.filter(
          (j) => j.status === 'starting' || j.status === 'processing'
        ).length
      })
    },

    // Clear all jobs
    clearAllJobs: () => {
      set((draft) => {
        draft.jobs = []
        draft.activeJobCount = 0
      })
    },

    // Get a specific job
    getJob: (jobId) => {
      return get().jobs.find((j) => j.id === jobId)
    },

    // Get jobs for current user (all jobs are user-specific now)
    getUserJobs: () => {
      return get().jobs
    },

    // Get active jobs
    getActiveJobs: () => {
      return get().jobs.filter(
        (j) => j.status === 'starting' || j.status === 'processing'
      )
    },

    // Get completed jobs
    getCompletedJobs: () => {
      return get().jobs.filter((j) => j.status === 'completed')
    },

    // Get failed jobs
    getFailedJobs: () => {
      return get().jobs.filter((j) => j.status === 'failed')
    },
  }),
  {
    name: 'import-job-store',
    persist: {
      key: 'iom-import-jobs',
      partialize: (state) => ({
        // Persist jobs but not active count (recalculated on load)
        jobs: state.jobs.filter((job) => {
          // Only persist jobs from last 24 hours
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          return job.startTime > oneDayAgo
        }),
      }),
    },
  }
)

// Selectors for performance optimization
export const importJobSelectors = {
  jobs: (state: ImportJobState) => state.jobs,
  activeJobCount: (state: ImportJobState) => state.activeJobCount,
  activeJobs: (state: ImportJobState) =>
    state.jobs.filter(
      (j) => j.status === 'starting' || j.status === 'processing'
    ),
  completedJobs: (state: ImportJobState) =>
    state.jobs.filter((j) => j.status === 'completed'),
  failedJobs: (state: ImportJobState) =>
    state.jobs.filter((j) => j.status === 'failed'),
  hasActiveJobs: (state: ImportJobState) => state.activeJobCount > 0,
  recentJobs: (state: ImportJobState) => state.jobs.slice(0, 10), // Last 10 jobs
}
