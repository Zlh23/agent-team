import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  IconAgentPresetOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { AssistantView, TeamView } from '../../transport/contracts.js'
import { callAgentTeam, subscribeAgentTeam } from '../api.js'
import { AnimatedModal } from '../shared.js'
import { isTeamExecuting } from '../team-status.js'
import { TeamForm } from './TeamForm.js'
import css from '../AgentTeam.module.css'

export function TeamLauncher({ wide, assistants }: { wide: boolean; assistants: AssistantView[] }): JSX.Element {
  const [teams, setTeams] = useState<TeamView[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadTeams = useCallback(async () => {
    try {
      const value = await callAgentTeam('team.list')
      setTeams(value.items)
    } catch {
      // Picker stays with last known teams; the workbench view surfaces errors.
    }
  }, [])

  useEffect(() => {
    if (!pickerOpen) return
    void loadTeams()
    return subscribeAgentTeam(() => { void loadTeams() }, () => { /* picker tolerates transient disconnects */ })
  }, [pickerOpen, loadTeams])

  useEffect(() => {
    if (!pickerOpen) return
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setPickerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [pickerOpen])

  async function openTeam(teamId: string): Promise<void> {
    setPickerOpen(false)
    await callAgentTeam('team.open', { teamId })
  }

  return (
    <div className={css.teamLauncherWrap}>
      <button
        type="button"
        className={css.teamLauncherButton}
        aria-label="打开团队"
        aria-expanded={pickerOpen}
        title="团队"
        onClick={() => { setPickerOpen(current => !current) }}
      >
        <IconAgentPresetOutline16 size={16} />
        {wide && <span>团队</span>}
      </button>
      {pickerOpen && (
        <>
          <div className={css.teamLauncherBackdrop} onClick={() => { setPickerOpen(false) }} />
          <div className={css.teamLauncherPopover} role="menu" aria-label="团队列表">
            <div className={css.teamLauncherPopoverHeader}>
              <strong>团队</strong>
              <Button variant="primary" size="sm" onClick={() => { setCreating(true) }}>
                新建团队
              </Button>
            </div>
            <div className={css.teamLauncherList} role="none">
              {teams.length === 0
                ? <div className={css.teamLauncherEmpty}>还没有团队</div>
                : teams.map(team => (
                    <button
                      key={team.id}
                      type="button"
                      role="menuitem"
                      className={css.teamLauncherItem}
                      onClick={() => { void openTeam(team.id) }}
                    >
                      <span className={css.teamLauncherItemName}>{team.name}</span>
                      {isTeamExecuting(team) && <span className={`${css.badge} ${css.badgeSuccess ?? ''}`}>执行中</span>}
                    </button>
                  ))}
            </div>
          </div>
        </>
      )}
      <AnimatedModal
        open={creating}
        onClose={() => { setCreating(false) }}
        title="新建团队"
        closeLabel="关闭"
        description="让多个 AI 助手组队协作。一个团队必须有且只有一个 Leader。"
        className={css.teamCreateDialog ?? ''}
        contentClassName={css.teamCreateContent ?? ''}
      >
        <TeamForm
          assistants={assistants}
          onCancel={() => { setCreating(false) }}
          onCreated={teamId => openTeam(teamId)}
        />
      </AnimatedModal>
    </div>
  )
}

export function useAssistantCatalog(): AssistantView[] {
  const [assistants, setAssistants] = useState<AssistantView[]>([])
  const load = useCallback(async () => {
    try {
      const value = await callAgentTeam('assistant.list')
      setAssistants(value.items)
    } catch {
      // Settings and workbench surfaces own their error display.
    }
  }, [])
  useEffect(() => {
    void load()
    return subscribeAgentTeam(() => { void load() }, () => { /* catalog tolerates transient disconnects */ })
  }, [load])
  return assistants
}
