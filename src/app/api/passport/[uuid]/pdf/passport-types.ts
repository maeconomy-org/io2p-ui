import type {
  NormalizedProperty,
  PassportFile,
} from '@/components/passport/utils/passport-utils'

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
    id: string
    name: string
    description: string
  }
  properties: NormalizedProperty[]
  files: PassportFile[]
  addressInfo: PassportAddressInfo | null
}
