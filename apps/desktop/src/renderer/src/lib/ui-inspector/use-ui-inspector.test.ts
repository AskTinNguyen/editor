import { describe, expect, test } from 'bun:test'
import {
  reduceAttachedUiInspectorSnapshot,
  type AttachedUiInspectorSnapshot,
} from './use-ui-inspector'

const SNAPSHOT = {
  source: 'dom' as const,
  label: 'Primary button',
  bounds: { x: 10, y: 20, width: 120, height: 40 },
}

describe('reduceAttachedUiInspectorSnapshot', () => {
  test('attaches the current project snapshot', () => {
    const result = reduceAttachedUiInspectorSnapshot(null, {
      type: 'attach',
      projectId: 'project_a',
      snapshot: SNAPSHOT,
    })

    expect(result).toEqual({
      projectId: 'project_a',
      snapshot: SNAPSHOT,
    } satisfies AttachedUiInspectorSnapshot)
  })

  test('clears an attached snapshot when the active project changes', () => {
    const attached: AttachedUiInspectorSnapshot = {
      projectId: 'project_a',
      snapshot: SNAPSHOT,
    }

    const result = reduceAttachedUiInspectorSnapshot(attached, {
      type: 'project-changed',
      projectId: 'project_b',
    })

    expect(result).toBeNull()
  })

  test('keeps the attachment when the project stays the same', () => {
    const attached: AttachedUiInspectorSnapshot = {
      projectId: 'project_a',
      snapshot: SNAPSHOT,
    }

    const result = reduceAttachedUiInspectorSnapshot(attached, {
      type: 'project-changed',
      projectId: 'project_a',
    })

    expect(result).toEqual(attached)
  })
})
