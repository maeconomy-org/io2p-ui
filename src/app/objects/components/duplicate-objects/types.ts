export interface DuplicateSourceObject {
  uuid: string
  name: string
  childCount?: number
}

export interface CopyOptionValues {
  includeChildren: boolean
  copyProperties: boolean
  copyFiles: boolean
  copyAddress: boolean
}

export interface DuplicateObjectsOptions extends CopyOptionValues {
  sourceObjects: DuplicateSourceObject[]
  targetParentUuids: string[]
  namePrefix: string
}
