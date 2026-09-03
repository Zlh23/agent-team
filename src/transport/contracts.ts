import type {
  AddTeamMemberInput,
  AssistantTemplate,
  CloneTeamInput,
  CreateAssistantInput,
  CreateTeamDraftInput,
  TeamAggregate,
  TeamMessage,
  UpdateAssistantInput,
} from '../domain/types.js'

export const AGENT_TEAM_API_PATH = '/agent-team/api'
export const AGENT_TEAM_EVENTS_PATH = '/agent-team/events'

export const AGENT_TEAM_METHODS = [
  'catalog.get',
  'catalog.model.get',
  'skill.catalog',
  'mcp.catalog',
  'assistant.list',
  'assistant.get',
  'assistant.create',
  'assistant.update',
  'assistant.clone',
  'assistant.delete',
  'team.list',
  'team.get',
  'team.createDraft',
  'team.clone',
  'team.start',
  'team.addMember',
  'team.removeMember',
  'team.changeLeader',
  'team.reset',
  'team.message.send',
  'team.workbench.get',
  'team.member.stop',
  'team.interaction.respond',
  'team.member.setPermissionPreset',
  'team.member.setReasoningEffort',
  'team.dissolve',
] as const

export type AgentTeamMethod = typeof AGENT_TEAM_METHODS[number]

export type AssistantView = AssistantTemplate
export type TeamView = TeamAggregate

export interface PageView<T> {
  items: T[]
  total: number
}

export interface CatalogView {
  providers: Array<{ id: string; name: string }>
  models: Record<string, Array<{ id: string; name: string; description?: string }>>
  agentPresets: Array<{ id: string; name: string; description?: string; broken?: string }>
  permissionPresets: Array<{ value: string; name: string; description?: string }>
}

export interface ModelCapabilitiesView {
  provider: string
  model: string
  reasoning?: {
    efforts: Array<{ id: string; name: string; description?: string }>
    defaultEffort?: string
  }
}

export interface SkillCatalogView {
  agentPresetId: string
  skills: Array<{
    name: string
    description: string
    source: string
    modelInvocable: boolean
    userInvocable: boolean
  }>
}

export interface McpCatalogView {
  agentPresetId: string
  servers: Array<{
    name: string
    tools: Array<{ name: string; description: string }>
  }>
}

export type ConversationNode =
  | {
    id: string
    kind: 'user' | 'assistant'
    seq: number
    time: number
    text: string
    reasoning?: string
    reasoningStartedAt?: number
    reasoningCompletedAt?: number
    streaming?: boolean
  }
  | {
    id: string
    kind: 'team-message'
    seq: number
    time: number
    text: string
    senderName: string
    senderId: string
    senderRole: 'leader' | 'member' | 'system'
    messageType: 'instruction' | 'progress' | 'result' | 'question' | 'warning' | 'system'
    relatedTaskId?: string
  }
  | {
    id: string
    kind: 'tool'
    seq: number
    time: number
    callId: string
    name: string
    arguments: string
    status: 'running' | 'success' | 'error'
    result?: string
    error?: string
  }
  | {
    id: string
    kind: 'notice'
    seq: number
    time: number
    tone: 'neutral' | 'error' | 'warning'
    text: string
  }

export interface QuestionOptionView {
  label: string
  description?: string
}

export interface QuestionItemView {
  id: string
  question: string
  detail?: string
  header?: string
  options?: QuestionOptionView[]
  multiSelect?: boolean
  intent?: {
    kind: 'plan-review'
    approve: string
  }
}

export type PendingInteractionView =
  | {
    id: string
    kind: 'question'
    questions: QuestionItemView[]
  }
  | {
    id: string
    kind: 'approval'
    approvalId: string
    toolName: string
    callId?: string
    reason?: string
  }

export interface QuestionAnswerView {
  id: string
  selected: string[]
  custom?: string
}

export type InteractionResponseInput =
  | {
    kind: 'question'
    answers: QuestionAnswerView[]
  }
  | {
    kind: 'approval'
    outcome: 'allowed-once' | 'rejected'
  }

export interface MemberConversationView {
  slotId: string
  sessionId: string
  throughSeq: number
  status: 'offline' | 'starting' | 'idle' | 'running' | 'waiting_approval' | 'error'
  nodes: ConversationNode[]
  pendingInteractions: PendingInteractionView[]
}

export interface TeamWorkbenchView {
  schemaVersion: 1
  teamId: string
  revision: number
  conversations: MemberConversationView[]
}

export interface AgentTeamRequestMap {
  'catalog.get': { payload: undefined; result: CatalogView }
  'catalog.model.get': {
    payload: { provider: string; model: string }
    result: ModelCapabilitiesView
  }
  'skill.catalog': { payload: { agentPresetId: string }; result: SkillCatalogView }
  'mcp.catalog': { payload: { agentPresetId: string }; result: McpCatalogView }
  'assistant.list': { payload: undefined; result: PageView<AssistantView> }
  'assistant.get': { payload: { id: string }; result: AssistantView }
  'assistant.create': { payload: CreateAssistantInput; result: AssistantView }
  'assistant.update': { payload: { id: string; value: UpdateAssistantInput }; result: AssistantView }
  'assistant.clone': { payload: { id: string; name?: string }; result: AssistantView }
  'assistant.delete': { payload: { id: string }; result: null }
  'team.list': { payload: undefined; result: PageView<TeamView> }
  'team.get': { payload: { id: string }; result: TeamView }
  'team.createDraft': { payload: CreateTeamDraftInput; result: TeamView }
  'team.clone': { payload: CloneTeamInput & { teamId: string }; result: TeamView }
  'team.start': { payload: { id: string }; result: TeamView }
  'team.addMember': { payload: { teamId: string; value: AddTeamMemberInput }; result: TeamView }
  'team.removeMember': { payload: { teamId: string; slotId: string }; result: TeamView }
  'team.changeLeader': { payload: { teamId: string; successorSlotId: string }; result: TeamView }
  'team.reset': { payload: { teamId: string; confirmation: string }; result: TeamView }
  'team.message.send': {
    payload: { teamId: string; content: string; targetSlotId?: string }
    result: TeamMessage
  }
  'team.workbench.get': { payload: { id: string }; result: TeamWorkbenchView }
  'team.member.stop': { payload: { teamId: string; slotId: string }; result: { accepted: boolean } }
  'team.interaction.respond': {
    payload: {
      teamId: string
      slotId: string
      interactionId: string
      response: InteractionResponseInput
    }
    result: { accepted: boolean }
  }
  'team.member.setPermissionPreset': {
    payload: { teamId: string; slotId: string; permissionPresetId: string }
    result: TeamView
  }
  'team.member.setReasoningEffort': {
    payload: { teamId: string; slotId: string; reasoningEffort?: string }
    result: TeamView
  }
  'team.dissolve': { payload: { teamId: string; confirmation: string }; result: null }
}

export type AgentTeamPayload<M extends AgentTeamMethod> = AgentTeamRequestMap[M]['payload']
export type AgentTeamResult<M extends AgentTeamMethod> = AgentTeamRequestMap[M]['result']

export interface AgentTeamRequest {
  requestId: string
  method: AgentTeamMethod
  expectedRevision?: number
  payload: unknown
}

export type AgentTeamResponse =
  | { requestId: string; ok: true; value: unknown }
  | {
    requestId: string
    ok: false
    error: {
      code: string
      message: string
      details?: Readonly<Record<string, unknown>>
    }
  }
