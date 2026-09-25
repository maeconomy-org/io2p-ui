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

  // Processes list
  processesCreate: 'processes-create',

  /**
   * The tab strip inside a sheet that has one (the process sheet's Details /
   * Files / Inputs / Outputs). Generic rather than process-specific: it is the
   * shell that renders it, so any tabbed sheet gets the anchor for free.
   */
  sheetTabs: 'sheet-tabs',

  // Library
  templatesCreate: 'templates-create',
  /** The "object template" item inside the create dropdown. */
  templatesCreateObject: 'templates-create-object',
  formulasCreate: 'formulas-create',
  formulasReference: 'formulas-reference',
  formulaExpression: 'formula-expression',
  constantsCreate: 'constants-create',
  constantsList: 'constants-list',
  sheetConstantName: 'sheet-constant-name',
  sheetConstantValue: 'sheet-constant-value',
  rollupRulesCreate: 'rollup-rules-create',
  rollupRulesList: 'rollup-rules-list',
  /** The property-key combobox and its Add button, which queue a chip each. */
  sheetRollupKeys: 'sheet-rollup-keys',

  // Import
  /** The status / wizard tab strip. Always mounted, whichever tab is active. */
  importTabs: 'import-tabs',
  importJobs: 'import-jobs',
  importStepper: 'import-stepper',
  importDropzone: 'import-dropzone',
  importSheet: 'import-sheet',
  importColumns: 'import-columns',
  /** The hierarchy box. Present ONLY while no hierarchy is applied. */
  importHierarchy: 'import-hierarchy',
  /** "N rows would become M objects" — the one part of a proposal a person can judge. */
  importHierarchyEffect: 'import-hierarchy-effect',
  /** The applied-hierarchy bar. The other half of the pair above; never both. */
  importLevelBar: 'import-level-bar',
  importCheck: 'import-check',
  importRun: 'import-run',

  // Shares
  sharesCreate: 'shares-create',
  sharesTabs: 'shares-tabs',
  shareResources: 'share-resources',
  shareMembers: 'share-members',
} as const

export type TourAnchorName = keyof typeof TOUR_ANCHORS

/** Spread onto the anchored element: `<div {...anchor('sheetTemplate')} />`. */
export const anchor = (name: TourAnchorName) =>
  ({ 'data-tour': TOUR_ANCHORS[name] }) as const

/** The selector a tour step targets: `element: sel('sheetTemplate')`. */
export const sel = (name: TourAnchorName) =>
  `[data-tour="${TOUR_ANCHORS[name]}"]`
