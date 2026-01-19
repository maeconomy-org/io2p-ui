'use client'

import { useEffect } from 'react'

/**
 * Subscribe to store changes for cross-store communication
 * This allows stores to react to changes in other stores
 */
export function subscribeToStore<T>(
  store: any,
  selector: (state: T) => any,
  callback: (value: any, previousValue: any) => void
) {
  let previousValue = selector(store.getState())

  return store.subscribe((state: T) => {
    const currentValue = selector(state)
    if (currentValue !== previousValue) {
      callback(currentValue, previousValue)
      previousValue = currentValue
    }
  })
}

/**
 * Hook to subscribe to store changes in components
 */
export function useStoreSubscription<T>(
  store: any,
  selector: (state: T) => any,
  callback: (value: any, previousValue: any) => void
) {
  useEffect(() => {
    return subscribeToStore(store, selector, callback)
  }, [store, selector, callback])
}
