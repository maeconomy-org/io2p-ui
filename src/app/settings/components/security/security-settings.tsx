'use client'

import { ChangePasswordCard } from './change-password-card'
import { TwoFactorCard } from './two-factor-card'
import { ConnectedAccountsCard } from './connected-accounts-card'
import { ActiveSessionsCard } from './active-sessions-card'

export function SecuritySettings() {
  return (
    <div className="space-y-6" data-testid="security-settings">
      <ChangePasswordCard />
      <TwoFactorCard />
      <ConnectedAccountsCard />
      <ActiveSessionsCard />
    </div>
  )
}
