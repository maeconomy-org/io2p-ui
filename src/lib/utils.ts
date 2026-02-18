import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { v7 as uuidv7 } from 'uuid'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a UUID v7 using the uuid package
 */
export function generateUUIDv7(): string {
  // give some properties so that the uuid is more unique as uuidv7 uses the current time
  return uuidv7()
}

export const formatFingerprint = (fingerprint: string) => {
  if (!fingerprint) return ''
  return fingerprint.length > 24
    ? `${fingerprint.slice(0, 24)}...`
    : fingerprint
}

export function formatUUID(uuid: string) {
  return uuid.length > 12 ? `${uuid.slice(0, 12)}...${uuid.slice(-12)}` : uuid
}

export function toCapitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const isObjectDeleted = (object: any): boolean => {
  return object?.softDeleted === true
}

/**
 * Truncate long text with ellipsis
 */
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

/**
 * Format a numeric value to a reasonable precision
 * Handles floating point precision issues (e.g., 1.20000000000000730022 -> 1.2)
 * @param value - The value to format (can be string or number)
 * @param maxDecimals - Maximum decimal places (default: 4)
 * @returns Formatted string or original value if not a number
 */
export function formatNumericValue(
  value: string | number | null | undefined,
  maxDecimals: number = 4
): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const strValue = String(value)

  // Check if it's a numeric value
  const numValue = parseFloat(strValue)
  if (isNaN(numValue)) {
    return strValue // Return original if not a number
  }

  // Check if it has excessive decimal places
  if (strValue.includes('.')) {
    const decimalPart = strValue.split('.')[1]
    if (decimalPart && decimalPart.length > maxDecimals) {
      // Round to maxDecimals and remove trailing zeros
      return parseFloat(numValue.toFixed(maxDecimals)).toString()
    }
  }

  return strValue
}
