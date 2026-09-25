import type { TemplateShareDependencies } from 'io2p-client'

export type { TemplateShareDependencies }

/** One row as the endpoint reports it, before the caller knows which list it came from. */
export type TemplateShareDependency =
  TemplateShareDependencies['formulas'][number]

/**
 * The same row once the caller has kept WHICH list it came from — the grant body names the resource
 * type, and the endpoint reports formulas and constants separately.
 */
export type ShareDependency = TemplateShareDependency & {
  type: 'formula' | 'constant'
}
