'use client'

import { useEffect } from 'react'

import { useOptionalImportWatch } from '@/contexts/import-watch-context'
import { isTerminal, useImportJob } from '@/hooks/api/imports'

/** Renders nothing: the point is `useImportJob`'s invalidation when a job reaches a terminal status. */
export function ImportWatchers() {
  const watcher = useOptionalImportWatch()
  if (!watcher) return null

  return (
    <>
      {watcher.jobIds.map((jobId) => (
        <Watch key={jobId} jobId={jobId} onSettled={watcher.unwatch} />
      ))}
    </>
  )
}

/** One job, one component — the only way to run a hook per item in a list. */
function Watch({
  jobId,
  onSettled,
}: {
  jobId: string
  onSettled: (jobId: string) => void
}) {
  const { data } = useImportJob(jobId)
  const status = data?.status

  // Safe to drop the id here: `useImportJob` registers its invalidation effect before this one, so
  // the transition is always acted on before this unmounts. In an effect, not render — it sets
  // state on a parent.
  useEffect(() => {
    if (status && isTerminal(status)) onSettled(jobId)
  }, [status, jobId, onSettled])

  return null
}
