import type {
  NormalizedProperty,
  PassportFile,
} from '@/components/object-sheets/passport/utils/passport-utils'

export interface PassportAddressInfo {
  uuid?: string
  fullAddress?: string
  street?: string
  houseNumber?: string
  city?: string
  postalCode?: string
  country?: string
  state?: string
  district?: string
}

export interface PassportDataResult {
  object: {
    uuid: string
    name: string
    abbreviation: string
    description: string
  }
  properties: NormalizedProperty[]
  files: PassportFile[]
  addressInfo: PassportAddressInfo | null
}
