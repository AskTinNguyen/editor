declare module '@pascal-app/editor' {
  import type { ComponentType } from 'react'

  export type SceneGraph = {
    nodes: Record<string, unknown>
    rootNodeIds: string[]
  }

  export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'paused' | 'error'

  export type EditorUiInspectorSceneContext = {
    selectedBuildingId: string | null
    selectedLevelId: string | null
    selectedZoneId: string | null
    selectedNodeIds: string[]
    hoveredNodeId: string | null
    phase: 'site' | 'structure' | 'furnish'
    mode: 'select' | 'edit' | 'delete' | 'build'
    tool: string | null
    cameraMode: 'perspective' | 'orthographic'
    levelMode: 'stacked' | 'exploded' | 'solo' | 'manual'
    wallMode: 'up' | 'cutaway' | 'down'
  }

  export type EditorProps = {
    projectId?: string | null
    onLoad?: () => Promise<SceneGraph | null>
    onSave?: (scene: SceneGraph) => Promise<void>
    onSaveStatusChange?: (status: SaveStatus) => void
    onSelect?: (selectedIds: string[]) => void
    highlightNodeIds?: string[]
    onUiInspectorSceneContextChange?: (context: EditorUiInspectorSceneContext) => void
  }

  export const Editor: ComponentType<EditorProps>
}
