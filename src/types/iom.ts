/**
 * Canonical IoM domain types — the single source, re-exported from `io2p-client`.
 *
 * Migrated code imports domain types from here (`@/types/iom`), NOT from `iom-sdk` (dormant, being
 * removed) or `io2p-client` directly — so the SDK boundary stays swappable in one place. See
 * `internal-docs/layer-0-plan.md`.
 */

/** Server-minted id (UUIDv7). io2p-core exposes no branded id type — ids are plain strings. */
export type UUID = string

export type {
  // ── entity read models (share properties[].values[].files[]) ──────────────
  ObjectDTO,
  ProcessDTO,
  TemplateDTO,
  // ── leaf read models ──────────────────────────────────────────────────────
  FormulaDTO,
  ConstantDTO,
  // ── cross-cutting read models ─────────────────────────────────────────────
  FileDTO,
  UserDTO,
  UserSummaryDTO,
  GrantDTO,
  GrantResponse,
  ShareDTO,
  SharedByMeItem,
  RevokeResult,
  LivenessDTO,
  ReadinessDTO,
  ProblemDetails,
  // ── entity write bodies ───────────────────────────────────────────────────
  CreateObjectResponse,
  UpdateObjectBody,
  CreateProcessResponse,
  UpdateProcessBody,
  UpdateTemplateBody,
  // ── leaf / access write bodies ────────────────────────────────────────────
  CreateFormulaBody,
  CreateConstantBody,
  AppendConstantVersionBody,
  CreateShareBody,
  UpdateShareBody,
  GrantBody,
  RevokeBody,
  // ── list query shapes ─────────────────────────────────────────────────────
  ObjectListQuery,
  ProcessListQuery,
  // ── file upload (multipart presign) ───────────────────────────────────────
  InitUploadBody,
  InitUploadResponse,
  CompleteBody,
  CompleteResponse,
  SignedUrlResponse,
  FileTarget,
} from 'io2p-client'

export type {
  // ── the branded entity write model (ST-9: value `data` XOR `calc`) ─────────
  CreateObjectInput,
  CreateProcessInput,
  CreateTemplateInput,
  ValueInput,
  PropertyInput,
  CalcInput,
  CalcArgInput,
  FileInput,
} from 'io2p-client'

/** Ergonomic `Partial` list-filter aliases (page/size optional; the node defaults them). */
export type {
  ListObjectsQuery,
  ListProcessesQuery,
  ListTemplatesQuery,
  ListFormulasQuery,
  ListConstantsQuery,
  ListFilesQuery,
  ListSharesQuery,
  ListUsersQuery,
} from 'io2p-client'

/** Offset-pagination envelope returned by every `.list()`. */
export type { Page } from 'io2p-client'

/**
 * The typed error hierarchy — re-exported as VALUES (runtime classes used with `instanceof`),
 * never `export type`, or `isForbiddenError`-style guards would break.
 */
export {
  IomError,
  ValidationError,
  ConflictError,
  PreconditionFailedError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  mapProblemToError,
} from 'io2p-client'
