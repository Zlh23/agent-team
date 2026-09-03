import { describe, expect, it } from 'vitest'
import {
  AGENT_TEAM_METHODS,
} from '../src/transport/contracts.js'

describe('Agent Team transport contracts', () => {
  it('keeps API method names unique', () => {
    expect(new Set(AGENT_TEAM_METHODS).size).toBe(AGENT_TEAM_METHODS.length)
  })
})
