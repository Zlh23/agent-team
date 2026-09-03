import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AgentTeamOverlay, AgentTeamSettingsSection } from './components.js'

export const name = 'agent-team-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: 'agent-team', order: 40, label: 'Agent 团队' },
    AgentTeamSettingsSection,
  ))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    {
      name: 'shell.overlay',
      id: 'agent-team',
      order: 20,
      label: '团队',
    },
    AgentTeamOverlay,
  ))
}
