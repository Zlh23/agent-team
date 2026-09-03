import { beforeEach, describe, expect, it, vi } from 'vitest'

class FakeEventSource {
  static readonly OPEN = 1
  static instances: FakeEventSource[] = []

  readonly listeners = new Map<string, Array<(event: unknown) => void>>()
  readyState = 0
  onerror: (() => void) | null = null
  onopen: (() => void) | null = null
  closed = false

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener as (event: unknown) => void)
    this.listeners.set(type, listeners)
  }

  emit(type: string, data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ data: JSON.stringify(data) })
  }

  open(): void {
    this.readyState = FakeEventSource.OPEN
    this.onopen?.()
  }

  close(): void {
    this.closed = true
  }
}

describe('Agent Team client event hub', () => {
  beforeEach(() => {
    vi.resetModules()
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  it('shares one EventSource across list and conversation subscribers', async () => {
    const {
      subscribeAgentTeam,
      subscribeAgentTeamConversation,
    } = await import('../src/client/api.js')
    const listChange = vi.fn()
    const conversationChange = vi.fn()
    const opened = vi.fn()

    const unsubscribeList = subscribeAgentTeam(listChange, vi.fn())
    const unsubscribeConversation = subscribeAgentTeamConversation(
      'team-1',
      conversationChange,
      vi.fn(),
      opened,
    )

    expect(FakeEventSource.instances).toHaveLength(1)
    const source = FakeEventSource.instances[0]!
    source.open()
    source.emit('change', { entityId: 'team-1' })
    source.emit('conversation', {
      entityId: 'team-1',
      conversation: { slotId: 'slot-1', throughSeq: 3 },
    })

    expect(opened).toHaveBeenCalledOnce()
    expect(listChange).toHaveBeenCalledOnce()
    expect(conversationChange).toHaveBeenCalledWith(expect.objectContaining({ slotId: 'slot-1' }))

    unsubscribeList()
    expect(source.closed).toBe(false)
    unsubscribeConversation()
    expect(source.closed).toBe(true)
  })
})

describe('Agent Team client requests', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('submits a structured team interaction response', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => ({
      json: async () => ({ requestId: 'request-1', ok: true, value: { accepted: true } }),
    }))
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('crypto', { randomUUID: () => 'request-1' })
    const { callAgentTeam } = await import('../src/client/api.js')

    await callAgentTeam('team.interaction.respond', {
      teamId: 'team-1',
      slotId: 'slot-1',
      interactionId: 'question:rpc-1',
      response: {
        kind: 'question',
        answers: [{ id: 'name', selected: [], custom: 'Reviewer' }],
      },
    })

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1].body))).toMatchObject({
      method: 'team.interaction.respond',
      payload: {
        teamId: 'team-1',
        slotId: 'slot-1',
        interactionId: 'question:rpc-1',
        response: {
          kind: 'question',
          answers: [{ id: 'name', selected: [], custom: 'Reviewer' }],
        },
      },
    })
  })

  it('sends the current revision when updating an assistant', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => ({
      json: async () => ({ requestId: 'request-1', ok: true, value: { id: 'assistant-1' } }),
    }))
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('crypto', { randomUUID: () => 'request-1' })
    const { callAgentTeam } = await import('../src/client/api.js')

    await callAgentTeam('assistant.update', {
      id: 'assistant-1',
      value: { name: 'Updated Assistant' },
    }, 3)

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1].body))).toMatchObject({
      method: 'assistant.update',
      expectedRevision: 3,
      payload: {
        id: 'assistant-1',
        value: { name: 'Updated Assistant' },
      },
    })
  })
})
