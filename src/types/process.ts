/**
 * ProcessModel — the stable shape the process UI speaks.
 *
 * It has NO knowledge of statements. The `process-codec` adapter translates between this
 * model and `IS_INPUT_OF` statement property bags; when the rewrite gives processes their
 * own API, only the codec + data hooks change, not this type or the components (see the
 * processes-redesign plan, §4.2).
 */

/** A process-level property — plain, like an object property. No quantity concept. */
export interface ProcessProperty {
  /** code identifier (slug of label); used in the p./in./out. statement keys */
  key: string
  /** human label shown in the UI and on charts */
  label: string
  /** one or more free-text values, exactly as typed */
  values: string[]
}

/**
 * An input/output material property. Same as a process property, but one may be flagged as
 * the quantity (the flow magnitude). `unit` / `canonicalValue` are DERIVED — populated on
 * decode for convenience and recomputed on encode; never an authoritative input field.
 */
export interface ProcessMaterialProperty extends ProcessProperty {
  isQuantity?: boolean
  /** unit text as typed, parsed from the value (e.g. "t"); null when absent/unparseable */
  unit?: string | null
  /** value in the dimension's canonical unit; used by charts/sums */
  canonicalValue?: number | null
}

/** A selected input or output object plus its dynamic properties. */
export interface ProcessMaterial {
  /** UUID of the selected object */
  objectUuid: string
  /** display name of the object (not persisted by the codec — it lives on the object) */
  objectName?: string
  properties: ProcessMaterialProperty[]
}

/** A whole process: identity + a few predefined fields + dynamic properties + flows. */
export interface ProcessModel {
  /** stable identity stamped on every edge of this process */
  processId: string
  name: string
  type?: string
  description?: string
  /** process-level dynamic properties (plain) */
  properties: ProcessProperty[]
  inputs: ProcessMaterial[]
  outputs: ProcessMaterial[]
}
