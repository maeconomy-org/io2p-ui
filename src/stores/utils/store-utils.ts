import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export function createStoreWithDevtools<T>(
  storeCreator: (set: (fn: (state: T) => void) => void, get: () => T) => T,
  options: {
    name: string
    persist?: {
      key: string
      partialize?: (state: T) => Partial<T>
    }
  }
) {
  let store = create<T>()(
    devtools(
      (set, get) =>
        storeCreator(
          (fn) =>
            set((state) => {
              fn(state)
              return state
            }),
          get
        ),
      { name: options.name }
    )
  )

  if (options.persist) {
    store = create<T>()(
      persist(
        devtools(
          (set, get) =>
            storeCreator(
              (fn) =>
                set((state) => {
                  fn(state)
                  return state
                }),
              get
            ),
          { name: options.name }
        ),
        {
          name: options.persist.key,
          partialize: options.persist.partialize,
        }
      )
    )
  }

  return store
}

export const storeMetrics = {
  renderCount: new Map<string, number>(),

  trackRender: (storeName: string) => {
    const current = storeMetrics.renderCount.get(storeName) || 0
    storeMetrics.renderCount.set(storeName, current + 1)

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Store Metrics] ${storeName}: ${current + 1} renders`)
    }
  },

  getMetrics: () => Object.fromEntries(storeMetrics.renderCount),

  reset: () => storeMetrics.renderCount.clear(),
}
