import { sel } from '@/constants'
import { TOUR_ACTIONS, type TourAction } from './use-tour-action'
import { tourText, type TourMessages } from './tour-messages'

/**
 * Every opt-in walkthrough, in one place.
 *
 * Tier 2 assumed a single core task ("create an object") back when that WAS the
 * product. There are now several distinct things a person might want walking
 * through, and the profile menu offered exactly one — so the registry is what
 * lets the menu grow without a component per tour.
 *
 * A definition is data, not a component: `route` says where the tour has to be
 * to make sense, `group` names its copy namespace, and `steps` builds the step
 * list from a loaded bundle. The runner owns navigation, driver config and
 * teardown.
 */

export type TourId =
  | 'create-object'
  | 'create-process'
  | 'build-template'
  | 'write-formula'
  | 'share-objects'
  | 'define-constant'
  | 'roll-up-values'
  | 'run-import'
  | 'work-with-drafts'

interface TourStep {
  element: string
  disableActiveInteraction?: boolean
  /**
   * Ask the page to do this step's thing when advancing with Next.
   *
   * The steps after a gate live inside a sheet that does not exist until it is
   * opened, so Next has to actually open it. The page performs the action
   * through its own handler — simulating a click on the trigger meant depending
   * on how that particular control happens to be built.
   */
  action?: TourAction
  /**
   * What Previous does at the step AFTER this one, undoing `action`.
   *
   * Defaults to `closeSheet`, which is right for a gate that opened a sheet. A
   * gate that changed the page some other way says so here — accepting a
   * hierarchy is undone by clearing it, not by closing anything.
   */
  undo?: TourAction
  popover: { title: string; description: string }
}

/**
 * A tour whose icon the ROUTE cannot supply. Resolved in `navbar/nav-icons`, so
 * this module stays free of the React runtime like `site.ts` beside it.
 *
 * Only for a second tour on a route another already claims: create-object and
 * work-with-drafts both run on /objects, and the menu stacked two identical
 * marks.
 */
export type TourIcon = 'drafts'

export interface TourDefinition {
  id: TourId
  /** Where the tour runs. The runner navigates here before driving. */
  route: string
  /** Overrides the icon derived from `route`. See TourIcon. */
  icon?: TourIcon
  /** Copy namespace in `messages/onboarding/{locale}.json`. */
  group: string
  /**
   * Put the page back when the tour ends, however it ended — Done, Escape, the
   * X, or a click on the overlay.
   *
   * Opt-in per tour rather than a blanket teardown: ending the create-object
   * tour on the Submit button should LEAVE the sheet open, since the next thing
   * the user does is fill it in. Only a tour that staged something of its own
   * has anything to take back.
   */
  onEnd?: TourAction
  steps: (m: TourMessages) => TourStep[]
}

/** `title`/`description` for `<group>.<key>` / `<group>.<key>Description`. */
const step = (
  m: TourMessages,
  group: string,
  key: string,
  element: string,
  extra?: Omit<TourStep, 'element' | 'popover'>
): TourStep => ({
  element,
  ...extra,
  popover: {
    title: tourText(m, group, key),
    description: tourText(m, group, `${key}Description`),
  },
})

export const TOURS: readonly TourDefinition[] = [
  {
    id: 'create-object',
    route: '/objects',
    group: 'demo',
    steps: (m) => [
      step(m, 'demo', 'filters', sel('filters')),
      step(m, 'demo', 'viewOptions', sel('viewSelector')),
      step(m, 'demo', 'createObjects', sel('createObject'), {
        action: TOUR_ACTIONS.createObject,
      }),
      step(m, 'demo', 'modelTemplates', sel('sheetTemplate')),
      step(m, 'demo', 'parentRelationships', sel('sheetParents')),
      step(m, 'demo', 'objectMetadata', sel('sheetMetadata')),
      step(m, 'demo', 'locationInfo', sel('sheetAddress')),
      step(m, 'demo', 'fileAttachments', sel('sheetFiles')),
      step(m, 'demo', 'customProperties', sel('sheetProperties')),
      step(m, 'demo', 'completeCreation', sel('sheetSubmit'), {
        disableActiveInteraction: true,
      }),
    ],
  },
  {
    id: 'create-process',
    route: '/processes',
    group: 'createProcess',
    steps: (m) => [
      step(m, 'createProcess', 'start', sel('processesCreate'), {
        action: TOUR_ACTIONS.createProcess,
      }),
      step(m, 'createProcess', 'template', sel('sheetTemplate')),
      step(m, 'createProcess', 'details', sel('sheetMetadata')),
      step(m, 'createProcess', 'properties', sel('sheetProperties')),
      // Flows are NOT walked here — that is a bigger tour. But the tab strip
      // still gets a step, because a process will not save without at least one
      // input and one output: a tour that went straight from properties to Save
      // would teach a flow that 422s.
      step(m, 'createProcess', 'flows', sel('sheetTabs')),
      step(m, 'createProcess', 'save', sel('sheetSubmit'), {
        disableActiveInteraction: true,
      }),
    ],
  },
  {
    id: 'build-template',
    route: '/templates',
    group: 'buildTemplate',
    steps: (m) => [
      step(m, 'buildTemplate', 'start', sel('templatesCreate'), {
        action: TOUR_ACTIONS.createTemplate,
      }),
      step(m, 'buildTemplate', 'properties', sel('sheetProperties')),
      step(m, 'buildTemplate', 'save', sel('sheetSubmit'), {
        disableActiveInteraction: true,
      }),
    ],
  },
  {
    id: 'write-formula',
    route: '/formulas',
    group: 'writeFormula',
    steps: (m) => [
      step(m, 'writeFormula', 'reference', sel('formulasReference')),
      step(m, 'writeFormula', 'start', sel('formulasCreate'), {
        action: TOUR_ACTIONS.createFormula,
      }),
      step(m, 'writeFormula', 'expression', sel('formulaExpression')),
    ],
  },
  {
    id: 'share-objects',
    route: '/shares',
    group: 'shareObjects',
    steps: (m) => [
      step(m, 'shareObjects', 'tabs', sel('sharesTabs')),
      step(m, 'shareObjects', 'start', sel('sharesCreate'), {
        action: TOUR_ACTIONS.createShare,
      }),
      step(m, 'shareObjects', 'resources', sel('shareResources')),
      step(m, 'shareObjects', 'members', sel('shareMembers')),
    ],
  },
  {
    id: 'define-constant',
    route: '/constants',
    group: 'defineConstant',
    steps: (m) => [
      step(m, 'defineConstant', 'what', sel('constantsList')),
      step(m, 'defineConstant', 'start', sel('constantsCreate'), {
        action: TOUR_ACTIONS.createConstant,
      }),
      step(m, 'defineConstant', 'name', sel('sheetConstantName')),
      step(m, 'defineConstant', 'value', sel('sheetConstantValue')),
      step(m, 'defineConstant', 'save', sel('sheetSubmit'), {
        disableActiveInteraction: true,
      }),
    ],
  },
  {
    id: 'roll-up-values',
    route: '/rollup-rules',
    group: 'rollUpValues',
    steps: (m) => [
      step(m, 'rollUpValues', 'what', sel('rollupRulesList')),
      step(m, 'rollUpValues', 'start', sel('rollupRulesCreate'), {
        action: TOUR_ACTIONS.createRollupRule,
      }),
      // The aggregation select gets NO step: it has one option and will in v1,
      // so pointing at it only asks "where are the others?".
      step(m, 'rollUpValues', 'keys', sel('sheetRollupKeys')),
      step(m, 'rollUpValues', 'save', sel('sheetSubmit'), {
        disableActiveInteraction: true,
      }),
    ],
  },
  {
    id: 'run-import',
    route: '/import',
    group: 'runImport',
    // Every step past the dropzone renders FROM the sample sheet this tour
    // loads, so ending anywhere has to drop it again.
    onEnd: TOUR_ACTIONS.resetImport,
    steps: (m) => [
      step(m, 'runImport', 'jobs', sel('importJobs')),
      step(m, 'runImport', 'start', sel('importTabs'), {
        action: TOUR_ACTIONS.startImport,
      }),
      step(m, 'runImport', 'steps', sel('importStepper'), {
        action: TOUR_ACTIONS.importAdvance,
      }),
      step(m, 'runImport', 'sheet', sel('importSheet'), {
        action: TOUR_ACTIONS.importAdvance,
      }),
      // FOUR steps on the mapper, because it is the only screen here where
      // pointing is not enough. The hierarchy box and the applied-hierarchy bar
      // cannot both be on screen — one renders while no hierarchy is set and the
      // other while one is — so the walkthrough accepts a hierarchy in the
      // middle and shows the before and the after.
      step(m, 'runImport', 'columns', sel('importColumns')),
      step(m, 'runImport', 'hierarchy', sel('importHierarchy'), {
        action: TOUR_ACTIONS.importSuggestLevels,
        undo: TOUR_ACTIONS.importHideSuggestion,
      }),
      step(m, 'runImport', 'proposal', sel('importHierarchyEffect'), {
        action: TOUR_ACTIONS.importApplyLevels,
        undo: TOUR_ACTIONS.importClearLevels,
      }),
      step(m, 'runImport', 'levels', sel('importLevelBar'), {
        action: TOUR_ACTIONS.importAdvance,
      }),
      step(m, 'runImport', 'check', sel('importCheck'), {
        action: TOUR_ACTIONS.importAdvance,
      }),
      // The last step describes the run without offering it. Nothing is written
      // by reaching this screen — the footer button does that, and it sits
      // OUTSIDE the highlight, so the overlay is what keeps it unpressable while
      // the sample is loaded.
      step(m, 'runImport', 'run', sel('importRun'), {
        disableActiveInteraction: true,
      }),
    ],
  },
  {
    id: 'work-with-drafts',
    route: '/objects',
    icon: 'drafts',
    group: 'workWithDrafts',
    steps: (m) => [
      step(m, 'workWithDrafts', 'start', sel('createObject'), {
        action: TOUR_ACTIONS.createObject,
      }),
      step(m, 'workWithDrafts', 'fill', sel('sheetMetadata')),
    ],
  },
] as const

export const getTour = (id: TourId) => TOURS.find((tour) => tour.id === id)

/**
 * How the profile menu breaks the list up.
 *
 * Nine flat rows read as one undifferentiated wall, and the labels alone do not
 * say where a walkthrough happens. Grouping by AREA answers that, and the route
 * is what decides the group — so a new tour is filed by where it runs rather
 * than by someone remembering to add it here.
 *
 * The order of `routes` is the display order, which is why the library group
 * puts constants before formulas: the Constants group in the formula editor is
 * empty until one exists, so learning them the other way round shows an empty
 * picker.
 */
export const TOUR_MENU_GROUPS = [
  { key: 'core', routes: ['/objects', '/processes'] },
  {
    key: 'library',
    routes: ['/templates', '/constants', '/formulas', '/rollup-rules'],
  },
  { key: 'exchange', routes: ['/shares', '/import'] },
] as const

export type TourMenuGroupKey = (typeof TOUR_MENU_GROUPS)[number]['key']

/** The registry as the menu renders it: grouped, and empty groups dropped. */
export function groupedTours(): {
  key: TourMenuGroupKey
  tours: TourDefinition[]
}[] {
  return TOUR_MENU_GROUPS.map((group) => ({
    key: group.key,
    tours: group.routes.flatMap((route) =>
      TOURS.filter((tour) => tour.route === route)
    ),
  })).filter((group) => group.tours.length > 0)
}
