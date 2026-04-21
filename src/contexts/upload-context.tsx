'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  FileUploadService,
  FileUploadTask,
  useUploadService,
} from '@/lib/upload-service'
import { queryKeys } from '@/lib/query-keys'
import { logger } from '@/lib'

export interface UploadContextValue {
  tasks: FileUploadTask[]
  summary: {
    total: number
    completed: number
    failed: number
    pending: number
    uploading: number
  }
  isIdle: boolean
  enqueue: (
    fileContexts: Array<{
      attachment: FileUploadTask['attachment']
      objectUuid?: string
      propertyUuid?: string
      valueUuid?: string
    }>
  ) => Promise<void>
  clearCompleted: () => void
}

const UploadContext = createContext<UploadContextValue | null>(null)

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const service = useUploadService()
  const queryClient = useQueryClient()
  const t = useTranslations()

  const [tasks, setTasks] = useState<FileUploadTask[]>(() =>
    service.getAllTasks()
  )

  // Remember which tasks we've already invalidated / toasted for so a re-render
  // doesn't fire the side effect twice.
  const settledIdsRef = useRef(new Set<string>())

  useEffect(() => {
    const unsubscribe = service.subscribe(() => {
      const next = service.getAllTasks()
      setTasks(next)

      for (const task of next) {
        if (
          (task.status === 'completed' || task.status === 'failed') &&
          !settledIdsRef.current.has(task.id)
        ) {
          settledIdsRef.current.add(task.id)

          if (task.status === 'completed' && task.objectUuid) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.aggregates.detail(task.objectUuid),
            })
            queryClient.invalidateQueries({
              queryKey: queryKeys.objects.detail(task.objectUuid),
            })
          }

          if (task.status === 'failed') {
            logger.error('Upload failed', {
              id: task.id,
              fileName: task.attachment?.fileName,
              error: task.error,
            })
          }
        }
      }
    })

    return unsubscribe
  }, [service, queryClient])

  const summary = useMemo(() => {
    const s = { total: 0, completed: 0, failed: 0, pending: 0, uploading: 0 }
    for (const task of tasks) {
      s.total += 1
      s[task.status] += 1
    }
    return s
  }, [tasks])

  const isIdle = summary.pending === 0 && summary.uploading === 0

  // Warn the user when they try to navigate/reload with uploads in flight.
  // The browser will show its standard "Leave site?" prompt — this is the
  // correct guardrail against silent data loss.
  useEffect(() => {
    if (isIdle) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Chrome requires returnValue to be set for the prompt to show.
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isIdle])

  const enqueue = useCallback<UploadContextValue['enqueue']>(
    async (fileContexts) => {
      if (fileContexts.length === 0) return

      toast.loading(
        t('objects.uploadingFiles', { count: fileContexts.length }),
        { id: 'upload-center' }
      )

      try {
        await service.queueFileUploadsWithContext(fileContexts)
        const post = service.getUploadSummary()
        if (post.failed.length > 0) {
          toast.error(
            t('objects.filesUploadFailed', { count: post.failed.length }),
            { id: 'upload-center' }
          )
        } else {
          toast.success(
            t('objects.filesUploadedSuccess', {
              count: post.completed.length,
            }),
            { id: 'upload-center' }
          )
        }
      } catch (err) {
        logger.error('Upload batch failed', err)
        toast.error(t('objects.filesUploadFailed', { count: 1 }), {
          id: 'upload-center',
        })
      }
    },
    [service, t]
  )

  const clearCompleted = useCallback(() => {
    service.clearCompleted()
    // Also forget their settled markers so re-uploads of the same id (rare)
    // trigger the invalidation path again.
    settledIdsRef.current.clear()
    tasks
      .filter((t) => t.status !== 'completed')
      .forEach((t) => settledIdsRef.current.add(t.id))
  }, [service, tasks])

  const value = useMemo<UploadContextValue>(
    () => ({ tasks, summary, isIdle, enqueue, clearCompleted }),
    [tasks, summary, isIdle, enqueue, clearCompleted]
  )

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  )
}

export function useUploadQueue(): UploadContextValue {
  const ctx = useContext(UploadContext)
  if (!ctx) {
    throw new Error('useUploadQueue must be used within an UploadProvider')
  }
  return ctx
}

// Convenience: returns null when outside the provider (useful for code paths
// that may render before the provider is ready, e.g. during auth bootstrap).
export function useOptionalUploadQueue(): UploadContextValue | null {
  return useContext(UploadContext)
}
