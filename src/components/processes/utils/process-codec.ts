/**
 * Process codec — the statements adapter.
 *
 * The ONLY file that knows how a ProcessModel maps onto `IS_INPUT_OF` statement property
 * bags. A process with N inputs and M outputs is stored as N×M edges; every edge carries
 * the same `processId` (identity), the process-level fields, and the specific input's /
 * output's properties under the `in.` / `out.` namespaces.
 *
 * Key convention (see processes-redesign plan §4):
 *   processId, processName, processType, processDescription   - identity + predefined
 *   p.<key>      / p.<key>#label                               - process-level property
 *   in.<key>     / in.<key>#label                              - input property
 *   in.<key>#qty / in.<key>#unit / in.<key>#canon              - input quantity extras
 *   out.<key>    (same companions)                             - output property
 *
 * No backward compatibility: there is no existing data (plan §10).
 */
import type { UUStatementDTO, UUStatementsProperty, Predicate } from 'iom-sdk'
import type {
  ProcessModel,
  ProcessProperty,
  ProcessMaterial,
  ProcessMaterialProperty,
} from '@/types/process'
import { parseQuantity } from '@/lib/units/parse-quantity'

const PREDICATE_INPUT = 'IS_INPUT_OF' as Predicate

const FIELD = {
  processId: 'processId',
  processName: 'processName',
  processType: 'processType',
  processDescription: 'processDescription',
} as const

const PREFIX = { process: 'p.', input: 'in.', output: 'out.' } as const
const SUFFIX = {
  label: '#label',
  qty: '#qty',
  unit: '#unit',
  canon: '#canon',
} as const

const ALL_SUFFIXES = Object.values(SUFFIX)

// --- small helpers -----------------------------------------------------------

const prop = (key: string, ...values: string[]): UUStatementsProperty => ({
  key,
  values: values.map((value) => ({ value })),
})

function firstValue(
  bag: UUStatementsProperty[],
  key: string
): string | undefined {
  return bag.find((p) => p.key === key)?.values?.[0]?.value
}

function allValues(bag: UUStatementsProperty[], key: string): string[] {
  const found = bag.find((p) => p.key === key)
  return (found?.values ?? [])
    .map((v) => v.value)
    .filter((v): v is string => v !== undefined)
}

/** True when `key` is a base property key under `prefix` (not a #companion). */
function isBaseKey(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false
  const rest = key.slice(prefix.length)
  return rest.length > 0 && !rest.includes('#')
}

// --- encode ------------------------------------------------------------------

/** Encode the process-level + a single material's properties into one edge's bag. */
function encodeMaterialProps(
  prefix: string,
  material: ProcessMaterial
): UUStatementsProperty[] {
  const out: UUStatementsProperty[] = []
  for (const p of material.properties) {
    const base = `${prefix}${p.key}`
    out.push(prop(base, ...p.values))
    out.push(prop(`${base}${SUFFIX.label}`, p.label))
    if (p.isQuantity) {
      out.push(prop(`${base}${SUFFIX.qty}`, '1'))
      const parsed = parseQuantity(p.values[0])
      if (parsed.unit) out.push(prop(`${base}${SUFFIX.unit}`, parsed.unit))
      if (parsed.canonicalValue !== null) {
        out.push(prop(`${base}${SUFFIX.canon}`, String(parsed.canonicalValue)))
      }
    }
  }
  return out
}

function encodeProcessLevelProps(
  properties: ProcessProperty[]
): UUStatementsProperty[] {
  const out: UUStatementsProperty[] = []
  for (const p of properties) {
    const base = `${PREFIX.process}${p.key}`
    out.push(prop(base, ...p.values))
    out.push(prop(`${base}${SUFFIX.label}`, p.label))
  }
  return out
}

/**
 * Encode a ProcessModel into one statement per input×output pair. Returns [] when there is
 * no input or no output (a process can't be represented as edges then — validation requires
 * at least one of each).
 */
export function encodeProcess(model: ProcessModel): UUStatementDTO[] {
  if (model.inputs.length === 0 || model.outputs.length === 0) return []

  const identity: UUStatementsProperty[] = [
    prop(FIELD.processId, model.processId),
    prop(FIELD.processName, model.name),
  ]
  if (model.type) identity.push(prop(FIELD.processType, model.type))
  if (model.description) {
    identity.push(prop(FIELD.processDescription, model.description))
  }
  const processLevel = encodeProcessLevelProps(model.properties)

  const statements: UUStatementDTO[] = []
  for (const input of model.inputs) {
    const inputProps = encodeMaterialProps(PREFIX.input, input)
    for (const output of model.outputs) {
      statements.push({
        subject: input.objectUuid,
        predicate: PREDICATE_INPUT,
        object: output.objectUuid,
        properties: [
          ...identity,
          ...processLevel,
          ...inputProps,
          ...encodeMaterialProps(PREFIX.output, output),
        ],
      })
    }
  }
  return statements
}

// --- decode ------------------------------------------------------------------

function decodeProcessLevelProps(
  bag: UUStatementsProperty[]
): ProcessProperty[] {
  const result: ProcessProperty[] = []
  for (const p of bag) {
    const key = p.key
    if (!key || !isBaseKey(key, PREFIX.process)) continue
    const baseKey = key.slice(PREFIX.process.length)
    result.push({
      key: baseKey,
      label: firstValue(bag, `${key}${SUFFIX.label}`) ?? baseKey,
      values: allValues(bag, key),
    })
  }
  return result
}

function decodeMaterialProps(
  bag: UUStatementsProperty[],
  prefix: string
): ProcessMaterialProperty[] {
  const result: ProcessMaterialProperty[] = []
  for (const p of bag) {
    const key = p.key
    if (!key || !isBaseKey(key, prefix)) continue
    const baseKey = key.slice(prefix.length)
    const isQuantity = bag.some((q) => q.key === `${key}${SUFFIX.qty}`)
    const decoded: ProcessMaterialProperty = {
      key: baseKey,
      label: firstValue(bag, `${key}${SUFFIX.label}`) ?? baseKey,
      values: allValues(bag, key),
      isQuantity,
    }
    if (isQuantity) {
      decoded.unit = firstValue(bag, `${key}${SUFFIX.unit}`) ?? null
      const canon = firstValue(bag, `${key}${SUFFIX.canon}`)
      decoded.canonicalValue = canon !== undefined ? parseFloat(canon) : null
    }
    result.push(decoded)
  }
  return result
}

/**
 * Decode all edges belonging to ONE process (same processId) back into a ProcessModel.
 * Identity + process-level fields are read from the first edge (they repeat on every edge);
 * inputs are the distinct subjects, outputs the distinct objects.
 */
export function decodeProcess(edges: UUStatementDTO[]): ProcessModel | null {
  if (edges.length === 0) return null
  const first = edges[0].properties ?? []

  const processId = firstValue(first, FIELD.processId) ?? ''
  const name = firstValue(first, FIELD.processName) ?? ''
  const type = firstValue(first, FIELD.processType)
  const description = firstValue(first, FIELD.processDescription)

  // distinct inputs (by subject) / outputs (by object), reading each one's props once
  const inputs = new Map<string, ProcessMaterial>()
  const outputs = new Map<string, ProcessMaterial>()
  for (const edge of edges) {
    const bag = edge.properties ?? []
    if (!inputs.has(edge.subject)) {
      inputs.set(edge.subject, {
        objectUuid: edge.subject,
        properties: decodeMaterialProps(bag, PREFIX.input),
      })
    }
    if (!outputs.has(edge.object)) {
      outputs.set(edge.object, {
        objectUuid: edge.object,
        properties: decodeMaterialProps(bag, PREFIX.output),
      })
    }
  }

  return {
    processId,
    name,
    type,
    description,
    properties: decodeProcessLevelProps(first),
    inputs: [...inputs.values()],
    outputs: [...outputs.values()],
  }
}

/** Group a mixed list of edges by processId — for turning a search result into processes. */
export function groupEdgesByProcess(
  edges: UUStatementDTO[]
): Map<string, UUStatementDTO[]> {
  const groups = new Map<string, UUStatementDTO[]>()
  for (const edge of edges) {
    const id = firstValue(edge.properties ?? [], FIELD.processId)
    if (!id) continue
    const list = groups.get(id)
    if (list) list.push(edge)
    else groups.set(id, [edge])
  }
  return groups
}

/**
 * Decode one side's material properties from an edge ('in' | 'out') into the clean
 * ProcessMaterialProperty list (key/label/values + isQuantity/unit/canonicalValue).
 * Used by the chart/detail layer so it never sees the raw namespaced keys.
 */
export function decodeEdgeProperties(
  edge: UUStatementDTO,
  side: 'in' | 'out'
): ProcessMaterialProperty[] {
  return decodeMaterialProps(
    edge.properties ?? [],
    side === 'in' ? PREFIX.input : PREFIX.output
  )
}

export interface EdgeQuantity {
  /** value in the dimension's canonical unit (from #canon), or null if none */
  canonical: number | null
  /** unit text as typed (#unit), or null */
  unit: string | null
  /** raw value as typed, or null */
  raw: string | null
}

/**
 * Read the flagged quantity for one side of an edge ('in' | 'out'). Finds the property that
 * carries a `#qty` flag under that namespace and returns its `#canon` / `#unit` / raw value.
 * Used by the chart layer for flow magnitudes. Returns nulls when no quantity is flagged.
 */
export function getEdgeQuantity(
  edge: UUStatementDTO,
  side: 'in' | 'out'
): EdgeQuantity {
  const prefix = side === 'in' ? PREFIX.input : PREFIX.output
  const bag = edge.properties ?? []
  const qtyFlag = bag.find(
    (p) => p.key?.startsWith(prefix) && p.key.endsWith(SUFFIX.qty)
  )
  if (!qtyFlag?.key) return { canonical: null, unit: null, raw: null }
  const baseKey = qtyFlag.key.slice(0, -SUFFIX.qty.length)
  const read = (suffix = '') => firstValue(bag, `${baseKey}${suffix}`) ?? null
  const canonStr = read(SUFFIX.canon)
  return {
    canonical: canonStr !== null ? parseFloat(canonStr) : null,
    unit: read(SUFFIX.unit),
    raw: read(),
  }
}
