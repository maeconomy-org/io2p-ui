/**
 * The `data-tour` contract between the onboarding tours and the rest of the app.
 *
 * `data-tour` is matched at runtime with `document.querySelector`, so nothing
 * typechecks it — renaming or deleting an anchored element used to fail silently
 * and only show up as a tour that stalls on a step it can never reach. That is
 * exactly how eight of the eleven demo steps ended up pointing at elements the
 * refactor had removed.
 *
 * Going through `anchor()` at the call site and `sel()` in the tour makes a
 * rename a typecheck failure instead. Lives in `constants/` rather than beside
 * the tours because `site.ts` needs the same values and constants sit below
 * components.
 */
export const TOUR_ANCHORS = {
  // Navigation
  topNav: 'top-nav',
  navObjects: 'nav-objects',
  navProcesses: 'nav-processes',
  navShares: 'nav-shares',
  /** The Library dropdown TRIGGER. Value kept as `nav-models` from before the
   *  menu was regrouped, so anything already in flight keeps resolving. */
  navLibrary: 'nav-models',
  navImport: 'nav-import',
  searchButton: 'search-button',
  userMenuTrigger: 'user-menu-trigger',
  demoTour: 'demo-tour',

  // Objects list
  filters: 'filters',
  viewSelector: 'view-selector',
  createObject: 'create-object',

  // Create sheet — one per section of `entity-sheet/create-form.tsx`
  sheetTemplate: 'sheet-template',
  sheetParents: 'sheet-parents',
  sheetMetadata: 'sheet-metadata',
  sheetAddress: 'sheet-address',
  sheetFiles: 'sheet-files',
  sheetProperties: 'sheet-properties',
  sheetSubmit: 'sheet-submit',

  // Library
  templatesCreate: 'templates-create',
  formulasCreate: 'formulas-create',
  formulasReference: 'formulas-reference',
  constantsCreate: 'constants-create',

  // Shares
  sharesCreate: 'shares-create',
  sharesTabs: 'shares-tabs',

  // Drafts
  draftRows: 'draft-rows',
} as const

export type TourAnchorName = keyof typeof TOUR_ANCHORS

/** Spread onto the anchored element: `<div {...anchor('sheetTemplate')} />`. */
export const anchor = (name: TourAnchorName) =>
  ({ 'data-tour': TOUR_ANCHORS[name] }) as const

/** The selector a tour step targets: `element: sel('sheetTemplate')`. */
export const sel = (name: TourAnchorName) =>
  `[data-tour="${TOUR_ANCHORS[name]}"]`
