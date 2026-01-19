'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores'

/**
 * Development component to monitor render performance
 * Only shows in development mode
 */
export function PerformanceMonitor() {
  const [isVisible, setIsVisible] = useState(false)
  const renderMetrics = useUIStore((state) => state.renderMetrics)
  const resetRenderMetrics = useUIStore((state) => state.resetRenderMetrics)

  // Only show in development
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development')
  }, [])

  if (!isVisible) {
    return null
  }

  const totalRenders = Object.values(renderMetrics).reduce(
    (sum, count) => sum + count,
    0
  )
  const componentCount = Object.keys(renderMetrics).length

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/80 text-white p-4 rounded-lg text-xs font-mono max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">Performance Monitor</h3>
        <button
          onClick={resetRenderMetrics}
          className="text-red-400 hover:text-red-300"
        >
          Reset
        </button>
      </div>

      <div className="space-y-1">
        <div>Total Renders: {totalRenders}</div>
        <div>Components: {componentCount}</div>

        {componentCount > 0 && (
          <div className="mt-2 max-h-32 overflow-y-auto">
            <div className="text-gray-300 mb-1">Render Counts:</div>
            {Object.entries(renderMetrics)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([component, count]) => (
                <div key={component} className="flex justify-between">
                  <span className="truncate mr-2">{component}</span>
                  <span
                    className={
                      count > 10
                        ? 'text-red-400'
                        : count > 5
                          ? 'text-yellow-400'
                          : 'text-green-400'
                    }
                  >
                    {count}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Hook to track component renders for performance monitoring
 */
export function useRenderTracker(componentName: string) {
  const trackRender = useUIStore((state) => state.trackRender)

  useEffect(() => {
    trackRender(componentName)
  })
}
