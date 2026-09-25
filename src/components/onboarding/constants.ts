/** Starts an opt-in walkthrough. Detail carries the registry `id`. */
export const TOUR_START_EVENT = 'onboarding:tour:start'

/**
 * Asks the page to perform the thing a tour step is describing — open the create
 * sheet, usually. Detail carries a `TourAction` id.
 *
 * Synthesising a click on the button is not good enough. A Radix dropdown
 * trigger opens on `pointerdown` and has no click handler; a menu item lives in
 * a portal that does not exist until the menu is open; and either way the tour
 * ends up reverse-engineering how a component happens to be wired. The page
 * already owns a function that opens its sheet, so the tour calls that instead —
 * the same mechanism the nav and profile menus already use.
 */
export const TOUR_ACTION_EVENT = 'onboarding:tour:action'
export const USER_MENU_TOGGLE_EVENT = 'onboarding:user-menu:toggle'

/**
 * Opens a grouped nav menu (currently only Library) so a tour can highlight what
 * is inside it. Carries the nav item's `key`, since the group is rendered from
 * `NAV_ITEMS` rather than hand-written.
 *
 * A tour step that points at a dropdown TRIGGER can only ever describe the
 * trigger — which is how the Library step ended up narrating "Models &
 * Templates" while Formulas and Constants, the two genuinely new items, stayed
 * hidden behind an unopened menu.
 */
export const NAV_MENU_TOGGLE_EVENT = 'onboarding:nav-menu:toggle'

/**
 * How long driver.js waits for a step's element before giving up on it.
 *
 * Paired with `skipMissingElement`, this is what makes a tour survive an anchor
 * that no longer exists: driver waits, times out, skips the step, and keeps
 * going. The hand-rolled polls this replaced had no such exit — they simply
 * stopped, leaving the tour parked on a step it could never advance past.
 */
export const ELEMENT_WAIT_MS = 6000

/**
 * Tours animate unless the user asked not to. Read at `driver()` construction
 * rather than cached, so a mid-session change to the OS setting is picked up by
 * the next tour.
 */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
