/**
 * The only place the e2e credentials are read.
 *
 * `e2e/` is tracked in git — only `e2e/.auth/` is ignored — so a literal password in a spec is
 * committed permanently and rotating it later does not remove it from history. Values live in
 * `.env.local`, which `playwright.config.ts` already loads via dotenv.
 */

export interface Credentials {
  email: string
  password: string
}

/**
 * Throws rather than returning a partial, so a missing variable fails at setup naming itself
 * instead of surfacing later as a login the app appears to have rejected.
 */
export function requireCredentials(): Credentials {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_EMAIL and E2E_PASSWORD must be set in .env.local. ' +
        'See docs/e2e-docs/e2e-test-plan.md §4.8.'
    )
  }

  return { email, password }
}

/**
 * A SECOND account, for the cases one account cannot express: a share needs a member, and
 * "read-only for the grantee" needs the grantee.
 *
 * Optional, and `null` rather than a throw — the specs that need it skip on a condition and print
 * the reason, so a machine without it still runs the rest of the suite instead of failing at setup.
 */
export function secondCredentials(): Credentials | null {
  const email = process.env.E2E_EMAIL_2
  const password = process.env.E2E_PASSWORD_2
  return email && password ? { email, password } : null
}

/** Where the authenticated browser state is cached between runs. Gitignored. */
export const AUTH_STATE = 'e2e/.auth/user.json'
