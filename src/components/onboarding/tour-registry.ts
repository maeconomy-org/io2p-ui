import { sel } from '@/constants'
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
  | 'build-template'
  | 'write-formula'
  | 'share-objects'
  | 'work-with-drafts'

interface TourStep {
  element: string
  disableActiveInteraction?: boolean
  popover: { title: string; description: string }
}

export interface TourDefinition {
  id: TourId
  /** Where the tour runs. The runner navigates here before driving. */
  route: string
  /** Copy namespace in `messages/onboarding/{locale}.json`. */
  group: string
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
      step(m, 'demo', 'createObjects', sel('createObject')),
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
    id: 'build-template',
    route: '/templates',
    group: 'buildTemplate',
    steps: (m) => [
      step(m, 'buildTemplate', 'start', sel('templatesCreate')),
      step(m, 'buildTemplate', 'reuse', sel('createObject')),
    ],
  },
  {
    id: 'write-formula',
    route: '/formulas',
    group: 'writeFormula',
    steps: (m) => [
      step(m, 'writeFormula', 'start', sel('formulasCreate')),
      step(m, 'writeFormula', 'reference', sel('formulasReference')),
    ],
  },
  {
    id: 'share-objects',
    route: '/shares',
    group: 'shareObjects',
    steps: (m) => [
      step(m, 'shareObjects', 'start', sel('sharesCreate')),
      step(m, 'shareObjects', 'tabs', sel('sharesTabs')),
    ],
  },
  {
    id: 'work-with-drafts',
    route: '/objects',
    group: 'workWithDrafts',
    steps: (m) => [
      step(m, 'workWithDrafts', 'start', sel('createObject')),
      step(m, 'workWithDrafts', 'pinned', sel('draftRows')),
    ],
  },
] as const

export const getTour = (id: TourId) => TOURS.find((tour) => tour.id === id)
