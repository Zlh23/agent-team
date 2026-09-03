import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ApprovalOutcome, ApprovalRequest } from '@deepseek-ai/dsh-user-approval'
import type { AskUserQuestionAnswer, AskUserQuestionRequest } from '@deepseek-ai/dsh-user-questions'
import { AgentTeamError } from '../domain/errors.js'
import type { InteractionResponseInput, PendingInteractionView, QuestionAnswerView, QuestionItemView } from '../transport/contracts.js'

type PendingInteractionRecord =
  | { id: string; kind: 'question'; sessionId: string; questions: QuestionItemView[]; resolve: (answer: AskUserQuestionAnswer) => void; reject: (reason: unknown) => void; signal?: AbortSignal }
  | { id: string; kind: 'approval'; sessionId: string; approvalId: string; toolName: string; callId?: string; reason?: string; resolve: (outcome: ApprovalOutcome) => void; reject: (reason: unknown) => void; signal?: AbortSignal }

export interface TeamInteractionScope {
  acceptsSession: (sessionId: string) => boolean
  onChange: (sessionId: string) => void
}

/** Adapts the current DSH interaction waterfalls to the Agent Team workbench. */
export class TeamInteractionBridge {
  private readonly records = new Map<string, PendingInteractionRecord>()
  private readonly scopes = new Set<TeamInteractionScope>()
  private readonly disposers: Array<() => void> = []
  private started = false

  constructor(private readonly ctx: Context, scope?: TeamInteractionScope) {
    if (scope !== undefined) this.scopes.add(scope)
  }

  registerScope(scope: TeamInteractionScope): () => void {
    this.scopes.add(scope)
    return () => { this.scopes.delete(scope) }
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.disposers.push(
      this.ctx.on('user-questions/request', (request, next) => this.captureQuestion(request, next), { prepend: true }),
      this.ctx.on('approval/request', (request, next) => this.captureApproval(request, next), { prepend: true }),
    )
  }

  list(sessionId: string): PendingInteractionView[] {
    return [...this.records.values()].filter(record => record.sessionId === sessionId).map(toView)
  }

  forget(sessionId: string): void {
    for (const [id, record] of this.records) {
      if (record.sessionId === sessionId) {
        record.reject(new Error('Agent Team interaction owner was removed'))
        this.records.delete(id)
      }
    }
  }

  async respond(sessionId: string, interactionId: string, response: InteractionResponseInput): Promise<void> {
    const record = this.records.get(interactionId)
    if (record === undefined) throw new AgentTeamError('INTERACTION_NOT_FOUND', '该交互请求已结束或不存在')
    if (record.sessionId !== sessionId || !this.acceptsSession(sessionId)) throw new AgentTeamError('INTERACTION_NOT_FOUND', '该交互请求不属于指定的会话')
    if (record.kind === 'question') {
      if (response.kind !== 'question') throw new AgentTeamError('INTERACTION_INVALID', '交互响应类型与待处理请求不匹配')
      record.resolve({ answers: normalizeQuestionAnswers(record.questions, response.answers) })
    } else {
      if (response.kind !== 'approval') throw new AgentTeamError('INTERACTION_INVALID', '交互响应类型与待处理请求不匹配')
      record.resolve(response.outcome)
    }
    this.remove(record.id, sessionId)
  }

  async dispose(): Promise<void> {
    for (const dispose of this.disposers.splice(0)) dispose()
    for (const record of this.records.values()) record.reject(new Error('Agent Team interaction bridge stopped'))
    this.records.clear()
    this.started = false
  }

  private captureQuestion(request: AskUserQuestionRequest, next: () => Promise<AskUserQuestionAnswer>): Promise<AskUserQuestionAnswer> {
    const sessionId = sessionIdOf(request.agent)
    if (sessionId === undefined || !this.acceptsSession(sessionId)) return next()
    if (request.questions.length < 1 || request.questions.length > 3) {
      return Promise.reject(new AgentTeamError(
        'INTERACTION_INVALID',
        'Agent Team 每次只接受 1 至 3 个问题，请重新生成精简的问题列表',
      ))
    }
    if (new Set(request.questions.map(question => question.id)).size !== request.questions.length) {
      return Promise.reject(new AgentTeamError(
        'INTERACTION_INVALID',
        'Agent Team 收到重复的问题 id，请重新生成问题',
      ))
    }
    const deferred = deferredValue<AskUserQuestionAnswer>()
    const record: PendingInteractionRecord = {
      id: `question:${randomUUID()}`, kind: 'question', sessionId,
      questions: request.questions.map(question => ({
        id: question.id, question: question.question,
        ...(question.detail === undefined ? {} : { detail: question.detail }),
        ...(question.header === undefined ? {} : { header: question.header }),
        ...(question.options === undefined ? {} : { options: question.options.map(option => ({ label: option.label, ...(option.description === undefined ? {} : { description: option.description }) })) }),
        ...(question.multiSelect === undefined ? {} : { multiSelect: question.multiSelect }),
        ...(question.intent === undefined ? {} : { intent: { ...question.intent } }),
      })),
      resolve: deferred.resolve, reject: deferred.reject,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    }
    this.add(record)
    return deferred.promise
  }

  private captureApproval(request: ApprovalRequest, next: () => Promise<ApprovalOutcome>): Promise<ApprovalOutcome> {
    const sessionId = sessionIdOf(request.agent)
    if (sessionId === undefined || !this.acceptsSession(sessionId)) return next()
    const deferred = deferredValue<ApprovalOutcome>()
    const record: PendingInteractionRecord = {
      id: `approval:${randomUUID()}`, kind: 'approval', sessionId, approvalId: `approval:${randomUUID()}`, toolName: request.toolName,
      ...(request.callId === undefined ? {} : { callId: String(request.callId) }),
      ...(request.reason === undefined ? {} : { reason: request.reason }),
      resolve: deferred.resolve, reject: deferred.reject,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    }
    this.add(record)
    return deferred.promise
  }

  private add(record: PendingInteractionRecord): void {
    this.records.set(record.id, record)
    const abort = (): void => {
      record.reject(record.signal?.reason ?? new Error('Interaction cancelled'))
      this.remove(record.id, record.sessionId)
    }
    record.signal?.addEventListener('abort', abort, { once: true })
    this.notifyChange(record.sessionId)
  }

  private remove(id: string, sessionId: string): void {
    if (!this.records.delete(id)) return
    this.notifyChange(sessionId)
  }

  private acceptsSession(sessionId: string): boolean {
    return [...this.scopes].some(scope => scope.acceptsSession(sessionId))
  }

  private notifyChange(sessionId: string): void {
    for (const scope of this.scopes) if (scope.acceptsSession(sessionId)) scope.onChange(sessionId)
  }
}

function sessionIdOf(agent: Agent | undefined): string | undefined {
  return agent === undefined ? undefined : String(agent.session.id)
}

export function normalizeQuestionAnswers(questions: readonly QuestionItemView[], answers: readonly QuestionAnswerView[]): QuestionAnswerView[] {
  const byId = new Map<string, QuestionAnswerView>()
  for (const answer of answers) {
    if (byId.has(answer.id)) throw new AgentTeamError('INTERACTION_INVALID', `问题“${answer.id}”存在重复答案`)
    byId.set(answer.id, answer)
  }
  if (byId.size !== questions.length) throw new AgentTeamError('INTERACTION_INVALID', '请完成全部问题后再提交')
  return questions.map(question => {
    const answer = byId.get(question.id)
    if (answer === undefined) throw new AgentTeamError('INTERACTION_INVALID', `缺少问题“${question.id}”的答案`)
    const selected = [...answer.selected]
    if (new Set(selected).size !== selected.length) throw new AgentTeamError('INTERACTION_INVALID', `问题“${question.id}”包含重复选项`)
    const allowed = new Set(question.options?.map(option => option.label) ?? [])
    if (selected.some(label => !allowed.has(label))) throw new AgentTeamError('INTERACTION_INVALID', `问题“${question.id}”包含无效选项`)
    if (question.multiSelect !== true && selected.length > 1) throw new AgentTeamError('INTERACTION_INVALID', `问题“${question.id}”只能选择一个选项`)
    const custom = answer.custom?.trim()
    if (question.multiSelect !== true && custom !== undefined && custom.length > 0 && selected.length > 0) throw new AgentTeamError('INTERACTION_INVALID', `问题“${question.id}”的自定义答案不能与单选项同时提交`)
    if (selected.length === 0 && (custom === undefined || custom.length === 0)) throw new AgentTeamError('INTERACTION_INVALID', `请回答问题“${question.question}”`)
    return { id: question.id, selected, ...(custom === undefined || custom.length === 0 ? {} : { custom }) }
  })
}

function toView(record: PendingInteractionRecord): PendingInteractionView {
  if (record.kind === 'question') return { id: record.id, kind: record.kind, questions: record.questions }
  return { id: record.id, kind: record.kind, approvalId: record.approvalId, toolName: record.toolName, ...(record.callId === undefined ? {} : { callId: record.callId }), ...(record.reason === undefined ? {} : { reason: record.reason }) }
}

function deferredValue<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
