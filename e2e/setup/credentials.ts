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
        'See internal-docs/11-e2e-test-plan.md §4.8.'
    )
  }

  return { email, password }
}

/** Where the authenticated browser state is cached between runs. Gitignored. */
export const AUTH_STATE = 'e2e/.auth/user.json'
