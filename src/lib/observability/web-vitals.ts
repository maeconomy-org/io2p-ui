// Web-vitals reporter: metric callbacks feed the same ship pipeline as log
// records (observability plan §1.6 — no experimental browser OTel SDK; plain
// records the backend can chart). Tagged `category: 'web-vital'` so the
// collector side can split them from log records.

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'

import { shipThreshold } from './logger/client'
import { shipRecord } from './logger/ship'

let initialized = false

export function initWebVitals(): void {
  if (typeof window === 'undefined' || initialized) return
  // Ship sink dark (dev default) → no vitals either; a config flip enables
  // both without a redeploy.
  if (shipThreshold() === 'off') return
  initialized = true

  const report = (metric: Metric) => {
    // Bypasses the logger level gate on purpose (metrics are not logs) but
    // still rides the ship sink's batching, dedupe-by-key and beacon flush.
    shipRecord({
      level: 'info',
      time: new Date().toISOString(),
      msg: `web-vital ${metric.name}`,
      category: 'web-vital',
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      metricId: metric.id,
      navigationType: metric.navigationType,
      route: window.location.pathname,
    })
  }

  onCLS(report)
  onFCP(report)
  onINP(report)
  onLCP(report)
  onTTFB(report)
}
