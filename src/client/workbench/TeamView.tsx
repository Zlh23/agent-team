import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TeamView as TeamViewType, TeamWorkbenchView, CatalogView } from '../../transport/contracts.js'
import { callAgentTeam, subscribeAgentTeam, subscribeAgentTeamConversation } from '../api.js'
import { useAssistantCatalog } from '../teams/TeamLauncher.js'
import { isTeamExecuting } from '../team-status.js'
import { ConversationColumn } from './ConversationColumn.js'
import { TeamCard } from '../teams/TeamCard.js'
import css from '../AgentTeam.module.css'

export function TeamView({
  sessionId,
  openSubagent,
}: {
  sessionId: SessionId
  openSubagent: (member: { slotId: string; displayName: string; role: string }) => Promise<void>
}): JSX.Element | null {
  const [team, setTeam] = useState<TeamViewType>()
  const [snapshot, setSnapshot] = useState<TeamWorkbenchView>()
  const [catalog, setCatalog] = useState<CatalogView>()
  const assistants = useAssistantCatalog()
  const [error, setError] = useState<string>()
  const [managementOpen, setManagementOpen] = useState(false)
  const [sideOpen, setSideOpen] = useState(true)
  const loadGeneration = useRef(0)
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      try {
        const [nextTeam, nextCatalog] = await Promise.all([
          callAgentTeam('team.list'),
          callAgentTeam('catalog.get'),
        ])
        if (cancelled) return
        const match = nextTeam.items.find(candidate =>
          Object.values(candidate.members).some(member => member.sessionId === sessionId))
        if (match === undefined) {
          setTeam(undefined)
          return
        }
        setTeam(match)
        setCatalog(nextCatalog)
        setError(undefined)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      }
    }
    void load()
    const offChange = subscribeAgentTeam(() => { void load() }, () => {
      setError('事件连接已断开，正在等待重连')
    })
    return () => {
      cancelled = true
      offChange()
    }
  }, [sessionId])

  useEffect(() => {
    if (team === undefined) return
    const generation = ++loadGeneration.current
    void (async () => {
      try {
        const next = await callAgentTeam('team.workbench.get', { id: team.id })
        if (generation === loadGeneration.current) {
          setSnapshot(next)
          setError(undefined)
        }
      } catch (cause) {
        if (generation === loadGeneration.current) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }
    })()
    return subscribeAgentTeamConversation(team.id, conversation => {
      if (conversation !== undefined) {
        setSnapshot(current => {
          if (current === undefined) return current
          const conversations = current.conversations.filter(item => item.slotId !== conversation.slotId)
          return { ...current, conversations: [...conversations, conversation] }
        })
        return
      }
      if (refreshTimer.current !== undefined) return
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = undefined
        void (async () => {
          try {
            const next = await callAgentTeam('team.workbench.get', { id: team.id })
            setSnapshot(next)
          } catch {
            // Keep the last snapshot; the change channel re-triggers loads.
          }
        })()
      }, 50)
    }, () => {
      setError('实时连接已断开，正在等待重连')
    }, () => {
      setError(undefined)
    })
  }, [team?.id, team?.revision, sessionId])

  useEffect(() => () => {
    if (refreshTimer.current !== undefined) clearTimeout(refreshTimer.current)
  }, [])

  if (team === undefined) {
    if (error !== undefined) return <div className={css.teamViewEmpty}><div role="alert">{error}</div></div>
    return <div className={css.teamViewEmpty}><span>正在加载团队…</span></div>
  }

  const members = Object.values(team.members)
  const conversations = new Map(snapshot?.conversations.map(item => [item.slotId, item]) ?? [])
  const tasks = Object.values(team.tasks)

  return (
    <div className={css.teamView}>
      <div className={css.teamViewColumns}>
        {members.map(member => (
          <ConversationColumn
            key={member.id}
            team={team}
            member={member}
            conversation={conversations.get(member.id)}
            permissionPresets={catalog?.permissionPresets ?? []}
            onSent={async () => {
              const next = await callAgentTeam('team.workbench.get', { id: team.id })
              setSnapshot(next)
            }}
            onTeamChanged={async () => {
              const value = await callAgentTeam('team.list')
              setTeam(value.items.find(candidate => candidate.id === team.id))
            }}
          />
        ))}
      </div>
      <aside className={`${css.teamViewSide} ${sideOpen ? '' : css.teamViewSideCollapsed}`}>
        <div className={css.teamViewSideHeader}>
          <strong title={team.name}>
            {team.name}
            {isTeamExecuting(team) && <span className={`${css.badge} ${css.badgeSuccess ?? ''}`}>执行中</span>}
          </strong>
          <button
            type="button"
            className={css.iconButton}
            aria-label={sideOpen ? '收起侧栏' : '展开侧栏'}
            onClick={() => { setSideOpen(current => !current) }}
          >
            {sideOpen ? '›' : '‹'}
          </button>
        </div>
        {sideOpen && (
          <div className={css.teamViewSideBody}>
            <section className={css.teamViewSection} aria-label="团队成员">
              <strong className={css.teamViewSectionTitle}>成员</strong>
              <div className={css.teamViewMemberList}>
                {members.map(member => {
                  const conversation = conversations.get(member.id)
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={css.teamViewMemberRow}
                      onClick={() => { void openSubagent({ slotId: member.id, displayName: member.displayName, role: member.role }) }}
                      title={`打开 ${member.displayName} 的对话`}
                    >
                      <span className={css.teamViewMemberAvatar}>{member.displayName.slice(0, 1).toUpperCase()}</span>
                      <span className={css.teamViewMemberCopy}>
                        <span className={css.teamViewMemberName}>
                          {member.displayName}
                          {member.role === 'leader' && <span className={css.leaderBadge}>Leader</span>}
                        </span>
                        <span>{member.assistantSnapshot.provider} / {member.assistantSnapshot.model}</span>
                      </span>
                      <span className={`${css.statusDot} ${conversation?.status === 'running' ? css.statusRunning : css.statusIdle}`} />
                    </button>
                  )
                })}
              </div>
            </section>
            {tasks.length > 0 && (
              <section className={css.teamViewSection} aria-label="任务板">
                <strong className={css.teamViewSectionTitle}>任务板</strong>
                <div className={css.teamViewTaskList}>
                  {tasks.map(task => (
                    <div key={task.id} className={css.memberRow}>
                      <span>{task.title}</span>
                      <span className={css.muted}>
                        {task.status}
                        {task.ownerSlotId !== undefined ? ` · ${team.members[task.ownerSlotId]?.displayName ?? '已移除成员'}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <button type="button" className={css.teamViewManageButton} onClick={() => { setManagementOpen(true) }}>
              团队管理
            </button>
          </div>
        )}
      </aside>
      <TeamManagementDialog
        open={managementOpen}
        team={team}
        assistants={assistants}
        catalog={catalog}
        onClose={() => { setManagementOpen(false) }}
        onChanged={async () => {
          const value = await callAgentTeam('team.list')
          setTeam(value.items.find(candidate => candidate.id === team.id))
        }}
      />
    </div>
  )
}

function TeamManagementDialog({
  open,
  team,
  assistants,
  catalog,
  onClose,
  onChanged,
}: {
  open: boolean
  team: TeamViewType
  assistants: import('../../transport/contracts.js').AssistantView[]
  catalog: CatalogView | undefined
  onClose: () => void
  onChanged: () => Promise<void>
}): JSX.Element | null {
  if (!open) return null
  return (
    <div className={css.managementDialogBackdrop} role="dialog" aria-modal="true" aria-label="团队管理">
      <div className={css.managementDialogShell}>
        <button type="button" className={css.managementDialogClose} aria-label="关闭" onClick={onClose}>×</button>
        <TeamCard
          team={team}
          catalog={catalog}
          assistants={assistants}
          onChanged={onChanged}
          compact
        />
      </div>
    </div>
  )
}
