/**
 * Regression: systemIdentity ⇄ useMessagingStore is an import cycle. Loading
 * systemIdentity first used to evaluate the store while SYSTEM_USER_ID was
 * still in its temporal dead zone ("Cannot access 'SYSTEM_USER_ID' before
 * initialization"). The constants now live in dependency-free systemConstants.
 */
import { describe, it, expect } from 'vitest'

describe('import order', () => {
  it('systemIdentity can load before useMessagingStore', async () => {
    const sys = await import('../systemIdentity')
    const { useMessagingStore } = await import('../../../stores/useMessagingStore')
    expect(useMessagingStore.getState().peerProfiles[sys.SYSTEM_USER_ID]?.firstName).toBe('System')
  })
})
