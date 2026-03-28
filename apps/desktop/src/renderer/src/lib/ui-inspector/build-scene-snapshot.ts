import type { EditorUiInspectorSceneContext } from '@pascal-app/editor'
import type { UiInspectorBounds, UiInspectorSnapshot } from '../../../../shared/ui-inspector'

type BuildSceneInspectorSnapshotInput = {
  scene: EditorUiInspectorSceneContext
  click: {
    bounds: UiInspectorBounds
    route?: string
    label?: string
    targetId?: string
  }
}

function deriveLabel(scene: EditorUiInspectorSceneContext, click: BuildSceneInspectorSnapshotInput['click']) {
  return (
    click.label ??
    click.targetId ??
    scene.hoveredNodeId ??
    scene.selectedNodeIds[0] ??
    scene.selectedZoneId ??
    scene.selectedLevelId ??
    scene.selectedBuildingId ??
    'Scene canvas'
  )
}

export function buildSceneInspectorSnapshot(
  input: BuildSceneInspectorSnapshotInput,
): UiInspectorSnapshot {
  const targetId =
    input.click.targetId ??
    input.scene.hoveredNodeId ??
    input.scene.selectedNodeIds[0] ??
    input.scene.selectedZoneId ??
    input.scene.selectedLevelId ??
    input.scene.selectedBuildingId ??
    undefined

  return {
    source: 'scene',
    label: deriveLabel(input.scene, input.click),
    route: input.click.route,
    selector: 'canvas',
    targetId,
    bounds: input.click.bounds,
    capturedAt: new Date().toISOString(),
    scene: {
      selectedNodeIds: input.scene.selectedNodeIds,
      hoveredNodeId: input.scene.hoveredNodeId,
      phase: input.scene.phase,
      mode: input.scene.mode,
      tool: input.scene.tool,
      cameraMode: input.scene.cameraMode,
      levelMode: input.scene.levelMode,
      wallMode: input.scene.wallMode,
    },
  }
}
