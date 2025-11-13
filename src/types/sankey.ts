export interface MaterialObject {
  uuid: string
  name: string
  type: 'input' | 'output' | 'intermediate'
  category?: string
  color?: string
}

export interface MaterialRelationship {
  predicate: 'IS_INPUT_OF' | 'IS_OUTPUT_OF'
  subject: {
    uuid: string
    name: string
  }
  object: {
    uuid: string
    name: string
  }
  quantity: number
  unit: string
  processName?: string
}
