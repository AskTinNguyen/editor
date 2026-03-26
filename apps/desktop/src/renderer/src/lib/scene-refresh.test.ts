import { describe, expect, test } from 'bun:test'
import { shouldRefreshScene } from './scene-refresh'
import type { AgentSessionEvent } from '../../../shared/agents'

describe('shouldRefreshScene', () => {
  test('returns true when turn completed with scene commands applied', () => {
    const event: AgentSessionEvent = {
      type: 'turn-completed',
      result: {
        status: 'completed',
        summary: 'Added 2 walls',
        executionLog: [],
        sceneCommandsApplied: 2,
      },
    }
    expect(shouldRefreshScene(event)).toBe(true)
  })

  test('returns false when turn completed with zero scene commands', () => {
    const event: AgentSessionEvent = {
      type: 'turn-completed',
      result: {
        status: 'completed',
        summary: 'Read the project',
        executionLog: [],
        sceneCommandsApplied: 0,
      },
    }
    expect(shouldRefreshScene(event)).toBe(false)
  })

  test('returns false when turn errored even with scene commands count', () => {
    const event: AgentSessionEvent = {
      type: 'turn-completed',
      result: {
        status: 'error',
        summary: 'Failed',
        executionLog: [],
        sceneCommandsApplied: 1,
        error: 'something went wrong',
      },
    }
    expect(shouldRefreshScene(event)).toBe(false)
  })

  test('returns false for non-turn-completed events', () => {
    const event: AgentSessionEvent = {
      type: 'status-changed',
      status: 'applying',
    }
    expect(shouldRefreshScene(event)).toBe(false)
  })
})
