import type { Page } from '@playwright/test'

import type { TourId } from '@/components/onboarding/tour-registry'
import { ONBOARDING_EPOCH, PREFERENCES } from '@/constants/preferences'

/**
 * Listed rather than imported from the registry: `tour-registry` reaches `use-tour-action` and
 * `use-onboarding` reaches `usePreference`, so either runtime import drags React and
 * `next/navigation` into the Playwright process, which resolves neither.
 *
 * The types are erased at compile time but still bind this list to the app's: a renamed tour fails
 * the `Record<TourId, true>` key check, and an ADDED one fails it as a missing property.
 */
const TOUR_IDS: Record<TourId, true> = {
  'create-object': true,
  'create-process': true,
  'build-template': true,
  'write-formula': true,
  'share-objects': true,
  'define-constant': true,
  'roll-up-values': true,
  'run-import': true,
  'work-with-drafts': true,
}

const ALL_TOURS = [...Object.keys(TOUR_IDS), 'initial-login']

/**
 * Every preference at its registry default, as one `PATCH me/preferences` bag.
 *
 * Derived from `PREFERENCES` rather than listed here: a key added to the registry is reset from
 * the day it lands, instead of waiting for someone to notice a spec failing on state the previous
 * run left behind.
 */
function defaultsPatch(): Record<string, Record<string, unknown>> {
  const patch: Record<string, Record<string, unknown>> = {}
  for (const [name, spec] of Object.entries(PREFERENCES)) {
    patch[spec.ns] ??= {}
    patch[spec.ns][spec.key ?? name] = spec.default
  }

  // `toursSeen` is the one preference whose DEFAULT is hostile here: empty means "never onboarded",
  // so resetting it arms every tour and `driver-overlay` then swallows the first click on each list
  // page. Every tour marked seen instead — `15-onboarding` starts the ones it wants explicitly.
  const onboarding = patch[PREFERENCES.toursSeen.ns]
  onboarding[PREFERENCES.toursSeen.key ?? 'toursSeen'] = ALL_TOURS
  // The stored epoch defaults to 0 and `ONBOARDING_EPOCH` is 1, so leaving it at its default marks
  // the whole list stale and re-arms every tour however complete `toursSeen` is.
  onboarding[PREFERENCES.onboardingEpoch.key ?? 'onboardingEpoch'] =
    ONBOARDING_EPOCH

  return patch
}

/**
 * Send one merge patch to `me/preferences`.
 *
 * Runs in the page so it borrows the session cookie and `__IOM_CONFIG__` — a `page.request` call
 * carries the cookie but cannot mint the short-lived core token the node wants.
 */
export async function patchPreferences(
  page: Page,
  patch: Record<string, Record<string, unknown>>
): Promise<void> {
  const failure = await page.evaluate(async (body) => {
    const config = (
      window as unknown as {
        __IOM_CONFIG__?: { authBaseUrl?: string; coreBaseUrl?: string }
      }
    ).__IOM_CONFIG__
    if (!config?.authBaseUrl || !config?.coreBaseUrl) {
      return 'runtime config missing authBaseUrl/coreBaseUrl'
    }

    const minted = await fetch(`${config.authBaseUrl}/api/auth/token`, {
      credentials: 'include',
    })
    if (!minted.ok) return `token mint failed: ${minted.status}`
    const { token } = (await minted.json()) as { token?: string }
    if (!token) return 'token endpoint returned no token'

    const res = await fetch(`${config.coreBaseUrl}/api/v1/me/preferences`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    return res.ok ? null : `PATCH me/preferences failed: ${res.status}`
  }, patch)

  if (failure) {
    throw new Error(`Could not patch preferences — ${failure}`)
  }
}

/**
 * Reset the account to its default preferences.
 *
 * Preferences are ACCOUNT state stored on the node, so they outlive a run: a spec that leaves
 * `/processes` in the Sankey view, an access scope on `shared`, or a hidden column breaks unrelated
 * specs in the NEXT run, and the failure looks exactly like an app regression.
 */
export async function resetPreferences(page: Page): Promise<void> {
  await patchPreferences(page, defaultsPatch())
}

/**
 * Empty `toursSeen`, so the welcome tour arms on the next signed-in render.
 *
 * The one preference `resetPreferences` deliberately does NOT restore to its registry default, and
 * the reason it does not is the reason this exists: an armed tour drops `driver-overlay` over every
 * list page and swallows the first click. Only a case that is ABOUT the tour may set this, and it
 * owes `resetPreferences` afterwards.
 */
export async function armInitialLoginTour(page: Page): Promise<void> {
  await patchPreferences(page, {
    [PREFERENCES.toursSeen.ns]: {
      [PREFERENCES.toursSeen.key ?? 'toursSeen']: [],
      [PREFERENCES.onboardingEpoch.key ?? 'onboardingEpoch']: ONBOARDING_EPOCH,
    },
  })
}
