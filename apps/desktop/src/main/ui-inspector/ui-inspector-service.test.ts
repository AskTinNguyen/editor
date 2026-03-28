import { describe, expect, test } from 'bun:test'
import type { ProjectId } from '../../shared/projects'
import { createUiInspectorService } from './ui-inspector-service'

describe('ui inspector service', () => {
  test('keeps snapshots isolated by projectId and windowId', () => {
    const service = createUiInspectorService()
    service.setSnapshot('project_a:1', {
      label: 'A',
      source: 'dom',
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    })
    service.setSnapshot('project_a:2', {
      label: 'B',
      source: 'dom',
      bounds: { x: 10, y: 10, width: 20, height: 20 },
    })

    expect(service.getState('project_a:1').snapshot?.label).toBe('A')
    expect(service.getState('project_a:2').snapshot?.label).toBe('B')
  })

  test('clearWindow removes state only for the matching project and window', () => {
    const service = createUiInspectorService()
    service.setSnapshot('project_a:1', {
      label: 'Keep',
      source: 'dom',
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    })
    service.setSnapshot('project_a:2', {
      label: 'Remove',
      source: 'dom',
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    })

    service.clearWindow('project_a' as ProjectId, 2)

    expect(service.getState('project_a:1').snapshot?.label).toBe('Keep')
    expect(service.getState('project_a:2').snapshot).toBeNull()
  })

  test('notifies subscribers when the tracked scope changes', () => {
    const service = createUiInspectorService()
    const updates: string[] = []

    const unsubscribe = service.subscribe('project_a:1', (state) => {
      updates.push(state.mode)
    })

    service.setMode('project_a:1', 'inspect')
    unsubscribe()
    service.setMode('project_a:1', 'idle')

    expect(updates).toEqual(['inspect'])
  })
})
