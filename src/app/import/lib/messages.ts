/**
 * The pure layers emit a key and its values; the component calls `t(key, values)`. Keeps
 * `parse-sheet`, `build-items` and `use-import-wizard` free of a locale, and keeps their tests
 * asserting `problem.key` rather than prose any copy edit breaks.
 *
 * The union is explicit so a key missing from the message files is a type error rather than
 * "import.problem.whatever" rendered raw on screen.
 */

export type ImportMessageKey =
  // parse-sheet refusals
  | 'import.error.fileTooBig'
  | 'import.error.unsupportedType'
  | 'import.error.noData'
  | 'import.error.unreadable'
  // build-items row refusals
  | 'import.problem.levelBlank'
  | 'import.problem.keyBlank'
  | 'import.problem.nameBlank'
  | 'import.problem.duplicateKey'
  | 'import.problem.parentUnresolved'
  // Distinct: the parent WAS declared, it was just refused itself. Sending the operator hunting a
  // typo that is not there is worse than saying nothing.
  | 'import.problem.parentDropped'
  // wizard preconditions
  | 'import.blocked.noFile'
  | 'import.blocked.noName'
  | 'import.blocked.createsNothing'
  | 'import.blocked.tooManyObjects'

export interface ImportMessage {
  key: ImportMessageKey
  /** Interpolated into the translation. Numbers are formatted by next-intl, not by us. */
  values?: Record<string, string | number>
}
