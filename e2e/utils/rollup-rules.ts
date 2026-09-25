import type { Page } from '@playwright/test'

/**
 * Remove the rules a spec created, by property key.
 *
 * Through the API rather than the row menu, because this runs from `afterAll` — the point in a
 * run where the UI is least trustworthy. A UI sweep has to find the row on a paged list of 137
 * rules, open a menu, and clear a modal; any one of those failing leaves the rule alive, which is
 * the leak the cleanup exists to prevent. It also has to work after a test failed mid-dialog.
 *
 * A live rule is not a catalogue entry: while it exists, every write to a matching key computes
 * it and every sweep fans out over it, node-wide and forever.
 *
 * Runs in the page for the same reason `ensureRootObjects` does — `page.request` carries the
 * session cookie but cannot mint the short-lived core token the node wants.
 *
 * Never throws: a rejection inside `afterAll` loses the page context and says nothing useful.
 * It returns the reason instead, and the caller decides how loud to be.
 */
export async function deleteRollupRulesByKey(
  page: Page,
  keys: readonly string[]
): Promise<string | null> {
  if (keys.length === 0) return null

  return page.evaluate(
    async (wanted: string[]) => {
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
      const target = new Set(wanted)
      const ids: string[] = []

      // `system=false` — a system rule is read-only and 403s on delete, so listing them only
      // widens the scan. `refNames=false` skips a batched name lookup nothing here reads.
      for (let page_ = 1; page_ <= 20; page_ += 1) {
        const listed = await fetch(
          `${config.coreBaseUrl}/api/v1/rollup-rules?page=${page_}&size=100&system=false&refNames=false`,
          { headers: auth }
        )
        if (!listed.ok) return `list rules failed: ${listed.status}`
        const body = (await listed.json()) as {
          data?: { id: string; propertyKey: string }[]
          page?: { totalPages?: number }
        }
        for (const rule of body.data ?? []) {
          if (target.has(rule.propertyKey)) ids.push(rule.id)
        }
        if (page_ >= (body.page?.totalPages ?? 1)) break
      }

      const failures: string[] = []
      for (const id of ids) {
        const removed = await fetch(
          `${config.coreBaseUrl}/api/v1/rollup-rules/${id}`,
          { method: 'DELETE', headers: auth }
        )
        // 404 is the success case when the test deleted the rule itself.
        if (!removed.ok && removed.status !== 404) {
          failures.push(`${id}: ${removed.status}`)
        }
      }

      return failures.length > 0
        ? `delete failed — ${failures.join(', ')}`
        : null
    },
    [...keys]
  )
}
