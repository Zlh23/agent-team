import { useCallback, useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { AssistantPanel } from './assistants/AssistantPanel.js'
import {
  callAgentTeam,
  subscribeAgentTeam,
} from './api.js'
import { TeamLauncher, useAssistantCatalog } from './teams/TeamLauncher.js'
import { TeamView } from './workbench/TeamView.js'
import css from './AgentTeam.module.css'
import type {
  AssistantView,
  CatalogView,
} from '../transport/contracts.js'

function useAgentTeamData(active = true): {
  catalog: CatalogView | undefined
  assistants: AssistantView[]
  loading: boolean
  error: string | undefined
  load: () => Promise<void>
} {
  const [catalog, setCatalog] = useState<CatalogView>()
  const [assistants, setAssistants] = useState<AssistantView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const requests = [
        callAgentTeam('catalog.get').then(value => { setCatalog(value) }),
        callAgentTeam('assistant.list').then(value => { setAssistants(value.items) }),
      ]
      const results = await Promise.allSettled(requests)
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason instanceof Error ? result.reason.message : String(result.reason))
      if (failures.length > 0) setError(failures.join('；'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    void load()
    return subscribeAgentTeam(() => { void load() }, () => { setError('事件连接已断开，正在等待重连') })
  }, [active, load])

  return { catalog, assistants, loading, error, load }
}

export function AgentTeamSettingsSection(_props: SettingsSectionOwnerProps): JSX.Element {
  const { catalog, assistants, loading, error, load } = useAgentTeamData()
  return (
    <section className={css.settingsSection}>
      <div className={css.settingsHeading}>
        <div>
          <h1 className={css.settingsTitle}>Agent 团队</h1>
          <p className={css.settingsDescription}>管理可在不同团队间复用的助手模板。团队对话从侧边栏底部的“团队”入口打开。</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { void load() }} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </Button>
      </div>
      {error && <div role="alert" className={css.error}>{error}</div>}
      <AssistantPanel catalog={catalog} assistants={assistants} onChanged={load} />
    </section>
  )
}

export function TeamSidebarAction({ wide }: SidebarFooterActionOwnerProps): JSX.Element {
  const assistants = useAssistantCatalog()
  return <TeamLauncher wide={wide} assistants={assistants} />
}

export function TeamConversationView({ sessionId, openMember }: TeamConversationViewProps): JSX.Element {
  return <TeamView sessionId={sessionId} openSubagent={openMember} />
}

export interface TeamConversationViewProps extends ConvViewProps {
  /** Open a teammate session as a subagent view under the leader session. */
  openMember: (member: { slotId: string; displayName: string; role: string }) => Promise<void>
}
