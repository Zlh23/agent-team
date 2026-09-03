import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { AgentTeamError } from '../src/domain/errors.js'
import { normalizeQuestionAnswers, TeamInteractionBridge } from '../src/runtime/team-interaction-bridge.js'

describe('TeamInteractionBridge', () => {
  it('projects and answers a current DSH question waterfall request', async () => {
    const handlers = new Map<string, (request: never, next: () => Promise<never>) => Promise<unknown>>()
    const ctx = { on: vi.fn((event: string, handler: never) => { handlers.set(event, handler); return () => {} }) } as unknown as Context
    const sessionId = 'session-1'
    const onChange = vi.fn()
    const bridge = new TeamInteractionBridge(ctx, { acceptsSession: id => id === sessionId, onChange })
    bridge.start()
    const request = {
      agent: { session: { id: sessionId } },
      questions: [{ id: 'language', question: '选择语言？', options: [{ label: 'TypeScript' }] }],
    }
    const pending = handlers.get('user-questions/request')!(request as never, vi.fn() as never)
    await vi.waitFor(() => expect(bridge.list(sessionId)).toEqual([expect.objectContaining({ kind: 'question' })]))
    const interactionId = bridge.list(sessionId)[0]!.id
    await bridge.respond(sessionId, interactionId, { kind: 'question', answers: [{ id: 'language', selected: ['TypeScript'] }] })
    await expect(pending).resolves.toEqual({ answers: [{ id: 'language', selected: ['TypeScript'] }] })
    expect(bridge.list(sessionId)).toEqual([])
    expect(onChange).toHaveBeenCalled()
    await bridge.dispose()
  })

  it('projects and answers a current DSH approval waterfall request', async () => {
    const handlers = new Map<string, (request: never, next: () => Promise<never>) => Promise<unknown>>()
    const ctx = { on: vi.fn((event: string, handler: never) => { handlers.set(event, handler); return () => {} }) } as unknown as Context
    const bridge = new TeamInteractionBridge(ctx, { acceptsSession: () => true, onChange: vi.fn() })
    bridge.start()
    const pending = handlers.get('approval/request')!({
      agent: { session: { id: 'session-2' } }, toolName: 'bash', reason: '需要访问工作区',
    } as never, vi.fn() as never)
    await vi.waitFor(() => expect(bridge.list('session-2')).toHaveLength(1))
    await bridge.respond('session-2', bridge.list('session-2')[0]!.id, { kind: 'approval', outcome: 'allowed-once' })
    await expect(pending).resolves.toBe('allowed-once')
  })

  it('rejects malformed questionnaire explosions before rendering them', async () => {
    const handlers = new Map<string, (request: never, next: () => Promise<never>) => Promise<unknown>>()
    const ctx = { on: vi.fn((event: string, handler: never) => { handlers.set(event, handler); return () => {} }) } as unknown as Context
    const bridge = new TeamInteractionBridge(ctx, { acceptsSession: () => true, onChange: vi.fn() })
    bridge.start()
    const questions = Array.from({ length: 22 }, (_, index) => ({
      id: `scope-${index}`,
      question: '主要查找什么类型的资料？',
    }))

    const pending = handlers.get('user-questions/request')!({
      agent: { session: { id: 'session-malformed' } },
      questions,
    } as never, vi.fn() as never)

    await expect(pending).rejects.toMatchObject({ code: 'INTERACTION_INVALID' })
    expect(bridge.list('session-malformed')).toEqual([])
  })
})

describe('normalizeQuestionAnswers', () => {
  it('rejects incomplete and forged option answers', () => {
    const questions = [{ id: 'model', question: '选择模型？', options: [{ label: 'DeepSeek' }, { label: 'GLM' }] }]
    expect(() => normalizeQuestionAnswers(questions, [])).toThrow(AgentTeamError)
    expect(() => normalizeQuestionAnswers(questions, [{ id: 'model', selected: ['Unknown'] }])).toThrow('包含无效选项')
  })
})
