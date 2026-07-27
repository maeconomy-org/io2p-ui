'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/contexts/auth-context'
import { getCachedConfig } from '@/constants/client'
import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import { UploadQueue, type UploadTask } from '@/lib/upload-queue'

export interface UploadQueueSummary {
  total: number
  pending: number
  uploading: number
  cancelling: number
  completed: number
  failed: number
}

export interface UploadQueueValue {
  tasks: UploadTask[]
  summary: UploadQueueSummary
  /** Nothing queued or in flight — safe to navigate away. */
  isIdle: boolean
  enqueue: (
    items: Omit<
      UploadTask,
      'status' | 'progress' | 'retries' | 'abortController'
    >[]
  ) => void
  cancel: (id: string) => void
  retry: (id: string) => void
  remove: (id: string) => void
  clearCompleted: () => void
}

const UploadQueueContext = createContext<UploadQueueValue | null>(null)

/**
 * Module-level singleton, keyed on the client AND the user id.
 *
 * NOT on the JWT: the token rotates every few minutes while the user stays the same, and keying on
 * it rebuilt the queue mid-upload — the file finished but the widget sat at "uploading 0%" and the
 * navigation guard never disarmed. `userId` only changes on login/logout/switch, which is exactly
 * when dropping in-flight state is correct.
 */
let singletonClient: unknown = null
let singletonIdentity: string | null = null
let singletonQueue: UploadQueue | null = null

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const client = useIomClient()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const identity = userId ?? null

  // A ref so the settle handler can invalidate without the queue depending on React state.
  const invalidate = useRef((entityId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.objects.detail(entityId),
    })
  })
  invalidate.current = (entityId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.objects.detail(entityId),
    })
  }

  if (
    !singletonQueue ||
    singletonClient !== client ||
    singletonIdentity !== identity
  ) {
    singletonQueue = new UploadQueue(client, {
      maxConcurrent: getCachedConfig()?.fileUploadConcurrency,
      // The upload IS the attach, so a finished file changes the entity — refetch it so the sheet
      // and any list showing it pick the file up without a manual reload.
      onSettled: (task) => invalidate.current(task.target.entityId),
    })
    singletonClient = client
    singletonIdentity = identity
  }
  const queue = singletonQueue

  const [tasks, setTasks] = useState<UploadTask[]>(() => queue.getTasks())

  useEffect(() => {
    setTasks(queue.getTasks())
    return queue.subscribe(() => setTasks(queue.getTasks()))
  }, [queue])

  const summary = useMemo(() => {
    const s: UploadQueueSummary = {
      total: 0,
      pending: 0,
      uploading: 0,
      cancelling: 0,
      completed: 0,
      failed: 0,
    }
    for (const task of tasks) {
      s.total += 1
      s[task.status] += 1
    }
    return s
  }, [tasks])

  const isIdle = summary.pending === 0 && summary.uploading === 0

  // Bytes in flight are lost on a reload, and the user has no way to know that — so let the browser
  // ask. Only while something is actually running; an always-on guard trains people to ignore it.
  useEffect(() => {
    if (isIdle) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Chrome only shows the prompt when this is set
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isIdle])

  const value = useMemo<UploadQueueValue>(
    () => ({
      tasks,
      summary,
      isIdle,
      enqueue: (items) => items.forEach((item) => queue.enqueue(item)),
      cancel: (id) => queue.cancel(id),
      retry: (id) => queue.retry(id),
      remove: (id) => queue.remove(id),
      clearCompleted: () => queue.clearCompleted(),
    }),
    [tasks, summary, isIdle, queue]
  )

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
    </UploadQueueContext.Provider>
  )
}

export function useUploadQueue(): UploadQueueValue {
  const context = useContext(UploadQueueContext)
  if (!context) {
    throw new Error('useUploadQueue must be used within an UploadQueueProvider')
  }
  return context
}

/** For components that may render outside the provider (tests, isolated stories). */
export function useOptionalUploadQueue(): UploadQueueValue | null {
  return useContext(UploadQueueContext)
}

/** Exported for tests — resets the module singleton between cases. */
export function resetUploadQueueSingleton(): void {
  singletonQueue = null
  singletonClient = null
  singletonIdentity = null
}

export const useUploadQueueTasks = (): UploadTask[] => useUploadQueue().tasks
