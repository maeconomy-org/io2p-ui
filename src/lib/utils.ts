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
