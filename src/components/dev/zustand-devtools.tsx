'use client'

import { useEffect, useState } from 'react'
import { useStoreDebugger } from '@/stores'

/**
 * Zustand DevTools component for debugging stores
 * Only shows in development mode
 */
export function ZustandDevTools() {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const stores = useStoreDebugger()

  // Only show in development
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development')
  }, [])

  // Keyboard shortcut to toggle DevTools
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + D to toggle DevTools
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === 'D'
      ) {
        event.preventDefault()
        setIsExpanded((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed bottom-4 left-4 z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Toggle Zustand DevTools (Ctrl+Shift+D)"
      >
        🛠️
      </button>

      {/* DevTools Panel */}
      {isExpanded && (
        <div className="fixed inset-4 z-40 bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden">
          <div className="flex h-full">
            {/* Store List */}
            <div className="w-1/4 bg-gray-800 p-4 overflow-y-auto">
              <h2 className="font-bold mb-4">Zustand Stores</h2>
              <div className="space-y-2">
                {Object.entries(stores).map(([storeName, storeState]) => (
                  <div key={storeName} className="p-2 bg-gray-700 rounded">
                    <div className="font-semibold capitalize">{storeName}</div>
                    <div className="text-xs text-gray-300">
                      {Object.keys(storeState).length} properties
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Store Details */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Store State</h2>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {Object.entries(stores).map(([storeName, storeState]) => (
                  <div key={storeName} className="bg-gray-800 p-4 rounded">
                    <h3 className="font-semibold capitalize mb-2">
                      {storeName} Store
                    </h3>
                    <pre className="text-xs overflow-x-auto bg-gray-900 p-2 rounded">
                      {JSON.stringify(storeState, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Store action logger for debugging
 */
export function useStoreActionLogger() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    // Log store actions in development
    const originalConsoleLog = console.log
    console.log = (...args) => {
      if (args[0]?.includes?.('[Store Action]')) {
        originalConsoleLog('🏪', ...args)
      } else {
        originalConsoleLog(...args)
      }
    }

    return () => {
      console.log = originalConsoleLog
    }
  }, [])
}
