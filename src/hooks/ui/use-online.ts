import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/** Whether the browser is online, as React Query sees it (it pauses and resumes on the same signal). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true
  )
}
