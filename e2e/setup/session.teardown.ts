import { test as teardown } from '@playwright/test'

import { restoreSession } from '../utils/session'

/**
 * Put the primary account back, whatever the run did to it.
 *
 * io2p-auth keeps ONE live session per origin, so any spec that signs in as somebody else — the
 * cross-user share cases, and every `14-auth` case — ends the session the rest of the suite runs
 * on. A file-local `afterAll` only repairs it when that file is in the selection, so which spec
 * gets logged out depends on the folder arguments. This runs once per run and does not.
 */
teardown('restore the primary session', async ({ page }) => {
  await restoreSession(page)
})
