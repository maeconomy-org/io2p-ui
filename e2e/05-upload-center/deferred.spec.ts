import { test } from '@playwright/test'

/**
 * Deferred specs from the upload-testing plan. These cover real invariants
 * but each needs scaffolding the app doesn't expose yet:
 *
 *   §17 cancel-during-hashing — requires the SDK to surface a hash-phase
 *        hook so the test can cancel before init fires. Currently
 *        indistinguishable from §18 cancel-during-init.
 *   §19 watchdog (real-time) — already covered by the upload-service unit
 *        test using vi.useFakeTimers + the test-hook variant in §25 TC253.
 *   §23 preview-ttl — needs a fake-clock test hook on React Query staleTime.
 *        Adding the hook crosses into production-code surface that isn't
 *        justified by one test.
 *   §26 validation E2E — empty-file + tooLarge are pending the §12 backend
 *        validation work; deliberately deferred per scope decision.
 *   §28 preview-modal — needs object fixtures with attachments seeded by
 *        the test setup, not generated inline.
 *   §29 auth-singleton — requires runtime token rotation in the auth
 *        context. The unit test in upload-service-singleton already proves
 *        the keying invariant; an E2E variant would mostly retest the auth
 *        context.
 *   §31 sentry-redaction E2E — needs a Sentry transport mock plumbed into
 *        the app's runtime config. Sentry init reads from runtime config at
 *        first paint; rerouting it for one spec is high-risk.
 *
 * Each is captured here as `test.skip` so the plan stays accountable and
 * the next person sees what's missing and why.
 */

test.skip('TC171: cancel during hashing — pending SDK hash-phase hook', () => {})
test.skip('TC191: watchdog real-time — covered by unit + §25 TC253', () => {})
test.skip('TC231: preview-url TTL refresh — pending fake-clock test hook', () => {})
test.skip('TC261: empty-file reject — pending §12 validation work', () => {})
test.skip('TC262: tooLarge reject — pending §12 validation work', () => {})
test.skip('TC281: preview modal kinds — pending seeded-attachment fixtures', () => {})
test.skip('TC291: token rotation mid-upload — pending auth runtime hook', () => {})
test.skip('TC311: Sentry redaction E2E — pending Sentry transport mock', () => {})
