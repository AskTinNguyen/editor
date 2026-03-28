import type { Phase, Mode, Tool } from '../store/use-editor'

export type EditorUiInspectorSceneContext = {
  selectedBuildingId: string | null
  selectedLevelId: string | null
  selectedZoneId: string | null
  selectedNodeIds: string[]
  hoveredNodeId: string | null
  phase: Phase
  mode: Mode
  tool: Tool | null
  cameraMode: 'perspective' | 'orthographic'
  levelMode: 'stacked' | 'exploded' | 'solo' | 'manual'
  wallMode: 'up' | 'cutaway' | 'down'
}
