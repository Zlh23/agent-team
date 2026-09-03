import { useState } from 'react'
import {
  IconPlusOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  AssistantView,
  CatalogView,
  TeamView,
} from '../../transport/contracts.js'
import { callAgentTeam } from '../api.js'
import { AssistantPanel } from '../assistants/AssistantPanel.js'
import css from '../AgentTeam.module.css'
import { AnimatedModal, Empty } from '../shared.js'

export function TeamPanel({
  catalog,
  assistants,
  teams,
}: {
  catalog: CatalogView | undefined
  assistants: AssistantView[]
  teams: TeamView[]
}): JSX.Element {
  const [managingAssistants, setManagingAssistants] = useState(false)

  return (
    <section className={css.section}>
      <div className={css.sectionHeader}>
        <div>
          <h2 className={css.sectionHeading}>团队 <span className={css.count}>{teams.length}</span></h2>
          <p className={css.sectionDescription}>选择 Leader 和成员，组建多个平级 Agent 的协作团队。团队对话从侧边栏“团队”入口打开。</p>
        </div>
        <div className={css.sectionHeaderActions}>
          <button
            type="button"
            className={css.addMemberButton}
            onClick={() => { setManagingAssistants(true) }}
          >
            <IconPlusOutline16 size={14} />
            管理助手
          </button>
        </div>
      </div>
      {teams.length === 0
        ? <Empty text="还没有团队" hint="在侧边栏底部点击“团队”按钮新建团队对话。" />
        : <div className={css.cardList}>{teams.map(team => (
            <div key={team.id} className={css.cardListItem}>
              <strong>{team.name}</strong>
              <span className={css.muted}>{Object.keys(team.members).length} 名成员</span>
            </div>
          ))}</div>}
      <AnimatedModal
        open={managingAssistants}
        onClose={() => { setManagingAssistants(false) }}
        title="管理助手"
        closeLabel="关闭"
        description="创建和维护可在不同团队间复用的助手模板。"
        className={css.assistantManagementDialog ?? ''}
        contentClassName={css.assistantManagementDialogContent ?? ''}
      >
        <div className={css.assistantManagementBody}>
          <AssistantPanel
            catalog={catalog}
            assistants={assistants}
            onChanged={async () => { /* Settings page owns its own refresh */ }}
          />
        </div>
      </AnimatedModal>
    </section>
  )
}

export function AddTeamMemberDialog({
  open,
  team,
  catalog,
  assistants,
  onClose,
  onChanged,
}: {
  open: boolean
  team: TeamView
  catalog: CatalogView | undefined
  assistants: AssistantView[]
  onClose: () => void
  onChanged: () => Promise<void>
}): JSX.Element {
  const [addingAssistantId, setAddingAssistantId] = useState<string>()
  const [configuringAssistants, setConfiguringAssistants] = useState(false)
  const [error, setError] = useState<string>()

  async function addMember(assistant: AssistantView): Promise<void> {
    setAddingAssistantId(assistant.id)
    try {
      await callAgentTeam('team.addMember', {
        teamId: team.id,
        value: { assistantId: assistant.id },
      }, team.revision)
      setError(undefined)
      onClose()
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setAddingAssistantId(undefined)
    }
  }

  function close(): void {
    if (addingAssistantId !== undefined) return
    setConfiguringAssistants(false)
    setError(undefined)
    onClose()
  }

  return (
    <>
      <AnimatedModal
        open={open}
        onClose={close}
        title="添加助手"
        description={`选择一个助手加入团队“${team.name}”。同一个助手可以多次加入。`}
        closeLabel="关闭"
        className={css.addMemberDialog ?? ''}
        contentClassName={css.addMemberDialogContent ?? ''}
      >
        <div className={css.addMemberDialogHeader}>
          <strong>助手列表</strong>
          <div className={css.addMemberDialogHeaderActions}>
            <span>{assistants.length} 个助手</span>
            <button
              type="button"
              className={css.addMemberButton}
              disabled={addingAssistantId !== undefined}
              onClick={() => { setConfiguringAssistants(true) }}
            >
              助手配置
            </button>
          </div>
        </div>
        <div className={css.addMemberMenuList}>
          {assistants.map(assistant => (
            <button
              key={assistant.id}
              type="button"
              className={css.addMemberOption}
              disabled={addingAssistantId !== undefined}
              onClick={() => { void addMember(assistant) }}
            >
              <span className={css.addMemberAvatar}>{assistant.name.slice(0, 1).toUpperCase()}</span>
              <span className={css.addMemberCopy}>
                <strong>{assistant.name}</strong>
                <span>{assistant.provider} / {assistant.model}</span>
              </span>
              <span className={css.addMemberOptionAction}>
                {addingAssistantId === assistant.id ? '添加中…' : <IconPlusOutline16 size={14} />}
              </span>
            </button>
          ))}
          {assistants.length === 0 && <span className={css.addMemberEmpty}>还没有可添加的助手模板</span>}
        </div>
        {error && <div role="alert" className={css.inlineError}>{error}</div>}
      </AnimatedModal>
      <AnimatedModal
        open={configuringAssistants}
        onClose={() => { setConfiguringAssistants(false) }}
        title="助手配置"
        closeLabel="关闭"
        description="创建和维护可在不同团队间复用的助手模板。"
        className={css.assistantManagementDialog ?? ''}
        contentClassName={css.assistantManagementDialogContent ?? ''}
      >
        <div className={css.assistantManagementBody}>
          <AssistantPanel
            catalog={catalog}
            assistants={assistants}
            onChanged={onChanged}
          />
        </div>
      </AnimatedModal>
    </>
  )
}
