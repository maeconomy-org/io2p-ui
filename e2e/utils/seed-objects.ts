import type { Page } from '@playwright/test'

/**
 * Enough root objects that `/objects` pages.
 *
 * The default page size is 20 and `TablePagination` returns `null` at one page, so on an account
 * with fewer roots `page-indicator` and `page-next` are correctly ABSENT — and L1/L2 fail on a
 * locator timeout that names neither the account nor the count. `chrome.read.spec.ts` refuses to
 * skip on purpose ("a genuinely single-page account now FAILS here rather than quietly deleting the
 * test"), so the precondition has to be met rather than detected.
 *
 * 25 rather than 21: the write specs soft-delete roots as they go, and a deleted one leaves the
 * default list. Headroom is what stops the next run tipping back under the boundary.
 */
const MIN_ROOT_OBJECTS = 25

/**
 * Top the account up to `MIN_ROOT_OBJECTS` roots, creating only the shortfall.
 *
 * Idempotent by COUNT, not by name: a populated account writes nothing at all, and there is no
 * fixed set of rows a spec could come to depend on. `auth.setup.ts` already owns account
 * preconditions — it resets every preference — so this belongs beside that rather than in a spec.
 *
 * Runs in the page for the same reason `resetPreferences` does: `page.request` carries the session
 * cookie but cannot mint the short-lived core token the node wants.
 */
export async function ensureRootObjects(page: Page): Promise<void> {
  const failure = await page.evaluate(async (minimum) => {
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

    const auth = { authorization: `Bearer ${token}` }

    // `parent=` empty asks for ROOTS, which is what the list renders. Counting every object would
    // top up to a number the page never shows.
    //
    // `scope=all` because the objects page reads the `objectsScope` preference, whose default is
    // `all`, while the endpoint defaults to `mine`. Counting only owned roots over-seeds on an
    // account holding shared ones — safe in direction, but it writes objects nobody asked for and
    // says nothing about why.
    const listed = await fetch(
      `${config.coreBaseUrl}/api/v1/objects?parent=&scope=all&page=1&size=1`,
      { headers: auth }
    )
    if (!listed.ok) return `list objects failed: ${listed.status}`
    const body = (await listed.json()) as {
      page?: { totalElements?: number }
    }
    const have = body.page?.totalElements ?? 0
    if (have >= minimum) return null

    const stamp = Date.now()

    for (let i = have; i < minimum; i++) {
      const created = await fetch(`${config.coreBaseUrl}/api/v1/objects`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        // A run id, not just the index. `i` starts at the current count, so after the write specs
        // soft-delete a few roots the next run mints a SECOND `…-root-21` — latent today, and a
        // strict-mode violation the day a spec searches for one of these names.
        body: JSON.stringify({
          name: `e2e-fixture-root-${stamp}-${i + 1}`,
        }),
      })
      if (!created.ok) return `create object failed: ${created.status}`
    }
    return null
  }, MIN_ROOT_OBJECTS)

  if (failure) {
    throw new Error(`Could not seed root objects — ${failure}`)
  }
}
