/**
 * Types for the import views.
 *
 * ALIASES of the SDK's, never hand-written copies: a local shape that merely resembles
 * `ImportJobDTO` drifts the moment the contract moves, and drifts silently. Aliasing makes the
 * compiler list every place the two disagree.
 *
 * The `LAB_JOBS` / `LAB_ITEMS` fixtures that used to sit here — 215 of this file's 233 lines —
 * are gone. They existed to judge layout before these views read the node; they have read it
 * since, nothing imported them, and a fixture nobody renders is a second description of the
 * contract that no compiler checks.
 */

import type { ImportItemDTO, ImportJobDTO } from 'io2p-client'

/** The seven states a job can be in — from the SDK, so it cannot fall behind the node. */
export type ImportJobStatus = ImportJobDTO['status']
export type ImportJob = ImportJobDTO
export type ImportItem = ImportItemDTO
