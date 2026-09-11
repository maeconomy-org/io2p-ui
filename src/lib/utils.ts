import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Human-readable byte size (e.g. "1.5 MB"). Returns null for missing/invalid
 * sizes so callers can conditionally render the label.
 */
export function formatBytes(size?: number): string | null {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0)
    return null
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function truncateText(
  text: string,
  maxLength: number = 100,
  fromMiddle: boolean = false
): string {
  if (!text || text.length <= maxLength) return text
  if (fromMiddle) {
    const half = Math.floor(maxLength / 2)
    return `${text.substring(0, half)}...${text.substring(text.length - half)}`
  }
  return `${text.substring(0, maxLength)}...`
}
