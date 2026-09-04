'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * Imports worth polling, held above the router so a running job survives navigation. State only —
 * the polling is in `ImportWatchers`, so `useRunImport` can arm this without a module cycle.
 */
interface ImportWatchValue {
  jobIds: readonly string[]
  watch: (jobId: string) => void
  unwatch: (jobId: string) => void
}

const ImportWatchContext = createContext<ImportWatchValue | null>(null)

export function ImportWatchProvider({ children }: { children: ReactNode }) {
  const [jobIds, setJobIds] = useState<readonly string[]>([])

  const watch = useCallback((jobId: string) => {
    setJobIds((current) =>
      current.includes(jobId) ? current : [...current, jobId]
    )
  }, [])

  const unwatch = useCallback((jobId: string) => {
    setJobIds((current) => current.filter((id) => id !== jobId))
  }, [])

  const value = useMemo(
    () => ({ jobIds, watch, unwatch }),
    [jobIds, watch, unwatch]
  )

  return (
    <ImportWatchContext.Provider value={value}>
      {children}
    </ImportWatchContext.Provider>
  )
}

/** `null` outside the provider, not a throw: watching enhances a run, it does not gate one. */
export function useOptionalImportWatch(): ImportWatchValue | null {
  return useContext(ImportWatchContext)
}
