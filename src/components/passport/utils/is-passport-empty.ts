import { flattenValues, type NormalizedProperty } from './passport-utils'
import type { PassportAddressInfo } from '../components/address-card'
import type { PassportFile } from '../components/documents-strip'

/**
 * Returns true when the passport has nothing meaningful to render.
 *
 * The backend hands back a non-null `address` blob with empty string fields
 * even when no address was ever set, so a simple `!addressInfo` check is too
 * lenient — we have to look for any non-empty line. Properties with empty
 * flattened values (`""`) also count as absent.
 */
export function isPassportEmpty({
  properties,
  files,
  addressInfo,
}: {
  properties: NormalizedProperty[]
  files: PassportFile[]
  addressInfo: PassportAddressInfo | null
}): boolean {
  const propertyCount = (properties ?? []).filter(
    (p) => flattenValues(p) !== ''
  ).length

  const hasAddress =
    !!addressInfo &&
    [
      addressInfo.fullAddress,
      addressInfo.street,
      addressInfo.houseNumber,
      addressInfo.city,
      addressInfo.postalCode,
      addressInfo.country,
    ].some((s) => typeof s === 'string' && s.trim() !== '')

  const liveFileCount = (files ?? []).filter((f) => !f.deleted).length

  return propertyCount === 0 && !hasAddress && liveFileCount === 0
}
