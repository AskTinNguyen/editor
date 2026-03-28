import { describe, expect, test } from 'bun:test'
import { buildSceneInspectorSnapshot } from './build-scene-snapshot'

describe('buildSceneInspectorSnapshot', () => {
  test('prefers scene semantics over raw canvas metadata', () => {
    const snapshot = buildSceneInspectorSnapshot({
      scene: {
        selectedBuildingId: 'building_001',
        selectedLevelId: 'level_001',
        selectedZoneId: null,
        selectedNodeIds: ['wall_001'],
        hoveredNodeId: 'wall_001',
        phase: 'structure',
        mode: 'select',
        tool: null,
        cameraMode: 'perspective',
        levelMode: 'stacked',
        wallMode: 'cutaway',
      },
      click: {
        bounds: { x: 10, y: 20, width: 30, height: 40 },
      },
    })

    expect(snapshot.source).toBe('scene')
    expect(snapshot.label).toBe('wall_001')
    expect(snapshot.selector).toBe('canvas')
    expect(snapshot.scene?.selectedNodeIds).toEqual(['wall_001'])
    expect(snapshot.scene?.phase).toBe('structure')
  })
})
