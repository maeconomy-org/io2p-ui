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
 * Top the account up to `MIN_ROOT_OBJECTS` roots, creating only the shortfall, and make sure one
 * process exists: a fresh database has none, and PR1a needs a row on `/processes`.
 *
 * Idempotent by COUNT, not by name: a populated account writes nothing at all, and there is no
 * fixed set of rows a spec could come to depend on. `auth.setup.ts` already owns account
 * preconditions — it resets every preference — so this belongs beside that rather than in a spec.
 *
 * Runs in the page for the same reason `resetPreferences` does: `page.request` carries the session
 * cookie but cannot mint the short-lived core token the node wants.
 */
export async function ensureListRows(page: Page): Promise<void> {
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

    const processes = await fetch(
      `${config.coreBaseUrl}/api/v1/processes?scope=all&page=1&size=1`,
      { headers: auth }
    )
    if (!processes.ok) return `list processes failed: ${processes.status}`
    const processBody = (await processes.json()) as {
      page?: { totalElements?: number }
    }
    if ((processBody.page?.totalElements ?? 0) > 0) return null

    // A process needs one input and one output, each a ref to an existing object.
    const refs = await fetch(
      `${config.coreBaseUrl}/api/v1/objects?parent=&scope=mine&page=1&size=2`,
      { headers: auth }
    )
    if (!refs.ok) return `list objects for the process failed: ${refs.status}`
    const { data = [] } = (await refs.json()) as {
      data?: { id: string }[]
    }
    if (data.length < 2) return 'fewer than 2 own roots to link a process'
    const process = await fetch(`${config.coreBaseUrl}/api/v1/processes`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `e2e-fixture-process-${stamp}`,
        inputs: [{ ref: data[0].id }],
        outputs: [{ ref: data[1].id }],
      }),
    })
    if (!process.ok) return `create process failed: ${process.status}`
    return null
  }, MIN_ROOT_OBJECTS)

  if (failure) {
    throw new Error(`Could not seed the list rows — ${failure}`)
  }
}

export const CAPPED_PARENT = 'Capped parent'
/** The node counts up to 1,000 and answers 1001 for "more than 1,000". */
const CAPPED_TOTAL = 1001
// A multiple of 20 above 1,020: page 52 is full and page 54 is the first empty one. With 1,001,
// page 51 holds one row and is the last page, so no spec could reach past the cap.
const CAPPED_CHILDREN = 1060

/** A short-lived core token, minted in the page (the session cookie lives there). */
async function coreAccess(
  page: Page
): Promise<{ core: string; token: string }> {
  const out = await page.evaluate(async () => {
    const config = (
      window as unknown as {
        __IOM_CONFIG__?: { authBaseUrl?: string; coreBaseUrl?: string }
      }
    ).__IOM_CONFIG__
    if (!config?.authBaseUrl || !config?.coreBaseUrl) return null
    const minted = await fetch(`${config.authBaseUrl}/api/auth/token`, {
      credentials: 'include',
    })
    if (!minted.ok) return null
    const { token } = (await minted.json()) as { token?: string }
    return token ? { core: config.coreBaseUrl, token } : null
  })
  if (!out) throw new Error('Could not mint a core token in the page')
  return out
}

/**
 * One root named `CAPPED_PARENT` with more than 1,000 children, for the specs that need a capped
 * list from the real node. Tops up by count: when the parent already has enough, it writes nothing.
 *
 * On the second account, never the primary: 1,000+ rows in the primary's lists would change what
 * most specs see. The children are direct, so no ROOT list of this account is capped.
 *
 * Creates from Node with a token from the page: 1,000 `page.evaluate` round trips cost minutes.
 * Core limits a user to 300 requests a minute unless `RATE_LIMIT_DISABLED=true` (non-production).
 */
export async function ensureCappedParent(page: Page): Promise<string> {
  let { core, token } = await coreAccess(page)
  const call = async (
    path: string,
    init?: { method?: string; body?: string }
  ) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${core}/api/v1${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      })
      if (res.status === 401 && attempt === 0) {
        ;({ core, token } = await coreAccess(page))
        continue
      }
      if (res.status === 429) {
        throw new Error(
          'Core rate limit (429): run core with RATE_LIMIT_DISABLED=true for e2e'
        )
      }
      if (!res.ok)
        throw new Error(`${init?.method ?? 'GET'} ${path}: ${res.status}`)
      return res.json()
    }
    throw new Error(`${path}: 401 after a new token`)
  }

  const found = (await call(
    `/objects?parent=&scope=mine&size=100&q=${encodeURIComponent(CAPPED_PARENT)}`
  )) as { data: { id: string; name: string }[] }
  const parents = found.data.filter((o) => o.name === CAPPED_PARENT)
  if (parents.length > 1) {
    throw new Error(
      `${parents.length} roots are named "${CAPPED_PARENT}" (left by a failed run). Delete all but one.`
    )
  }
  const parentId =
    parents[0]?.id ??
    (
      (await call('/objects', {
        method: 'POST',
        body: JSON.stringify({ name: CAPPED_PARENT }),
      })) as { id: string }
    ).id

  // The node counts up to 1,000, so above that the rows on page 11 of 100 give the real number.
  const count = async () => {
    const first = (await call(
      `/objects?parent=${parentId}&scope=mine&size=1`
    )) as { page: { totalElements: number } }
    if (first.page.totalElements < CAPPED_TOTAL) return first.page.totalElements
    const past = (await call(
      `/objects?parent=${parentId}&scope=mine&size=100&page=11`
    )) as { data: unknown[] }
    return 1000 + past.data.length
  }

  const have = await count()
  if (have >= CAPPED_CHILDREN) return parentId

  const missing = CAPPED_CHILDREN - have
  const stamp = Date.now()
  let next = 0
  // One failed create rejects the batch; the others stop too, so the setup retry counts a still tree.
  let failed = false
  const worker = async () => {
    while (next < missing && !failed) {
      const i = next++
      try {
        await call('/objects', {
          method: 'POST',
          body: JSON.stringify({
            name: `QA-capped-${stamp}-${i + 1}`,
            parents: [parentId],
          }),
        })
      } catch (err) {
        failed = true
        throw err
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))

  const deadline = Date.now() + 120_000
  while ((await count()) < CAPPED_CHILDREN) {
    if (Date.now() > deadline) {
      throw new Error(
        `"${CAPPED_PARENT}" is still under ${CAPPED_CHILDREN} children 2 minutes after the creates`
      )
    }
    await new Promise((r) => setTimeout(r, 2_000))
  }
  return parentId
}
