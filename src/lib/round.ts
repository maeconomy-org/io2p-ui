/**
 * The node's frozen rounding policy: 12 significant figures
 * (io2p-core `shared/entity.normalize.ts`).
 *
 * Anything comparing a number computed HERE against one the node has already stored needs it.
 * `0.1 + 0.2` is `0.30000000000000004` in the browser and `0.3` on the node, and that difference
 * decides whether an object is its own whole total or 4e-17 short of it.
 *
 * Lives in `lib/` rather than beside its caller because it is a numeric rule shared with another
 * process, not a presentational detail of any one component.
 */
export const round = (n: number) => Number(n.toPrecision(12))
