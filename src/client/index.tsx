import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  AgentTeamSettingsSection,
  TeamConversationView,
  TeamSidebarAction,
  type TeamConversationViewProps,
} from './components.js'

export const name = 'agent-team-client'
export const inject = ['sessions', 'slots']

interface MemberRef {
  slotId: string
  displayName: string
  role: string
}

type SessionServices = {
  readonly list: { getSnapshot(): { current?: string } }
  refreshSubagents: (id: SessionId) => Promise<void>
  openSubagent: (address: SubagentAddress) => void
}

function sessionsOf(ctx: ClientContext): SessionServices {
  return (ctx as unknown as { sessions: SessionServices }).sessions
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: 'agent-team', order: 40, label: 'Agent 团队' },
    AgentTeamSettingsSection,
  ))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'agent-team', order: 10, label: '团队' },
    TeamSidebarAction,
  ))
  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    {
      name: 'conversation.view',
      id: 'agent-team',
      order: 20,
      label: '团队',
      inject: (sessionId: SessionId) => ({
        async openMember(member: MemberRef): Promise<void> {
          if (member.role !== 'member') return
          const sessions = sessionsOf(ctx)
          await sessions.refreshSubagents(sessionId)
          if (sessions.list.getSnapshot().current !== sessionId) return
          const address: SubagentAddress = {
            parentSessionId: sessionId,
            childSessionId: member.slotId as SessionId,
            mode: 'continuable',
          }
          sessions.openSubagent(address)
        },
      }),
    },
    (props: TeamConversationViewProps) => <TeamConversationView {...props} />,
  ))
}
