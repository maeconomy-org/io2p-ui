/**
 * Mirrors io2p-auth's isPendingApproval: a social account without
 * `status: 'active'` has a session but no core token.
 */
export function isPendingApproval(
  user: { origin?: unknown; status?: unknown } | null | undefined
): boolean {
  return user?.origin === 'social' && user.status !== 'active'
}
