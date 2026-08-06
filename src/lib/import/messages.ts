/**
 * What the import's pure layers say, as DATA rather than sentences.
 *
 * `parse-sheet`, `build-items` and `use-import-wizard` all produce text a user reads, and all
 * three are logic: no React, no `next-intl`, unit-tested against awkward sheets directly. Emitting
 * an English string there would either drag a locale into a pure module or leave the feature
 * permanently monolingual below the component line — which is what it did.
 *
 * So they emit a key and its values, and the component calls `t(key, values)`. Same shape as
 * `saveErrorMessage` in `lib/io2p-errors.ts`, for the same reason: the message stays comparable in
 * a test (`expect(problem.key).toBe(…)`) instead of being asserted as prose that any copy edit
 * breaks.
 *
 * The union is explicit so a key that no longer exists in the message files is a type error rather
 * than a "import.problem.whatever" rendered raw on screen.
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
  // Distinct from the above: the parent WAS declared, it was just refused itself. Sending the
  // operator to look for a typo that is not there is worse than saying nothing.
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
