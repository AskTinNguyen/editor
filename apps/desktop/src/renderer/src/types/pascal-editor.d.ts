declare module '@pascal-app/editor' {
  import type { ComponentType } from 'react'

  export type SceneGraph = {
    nodes: Record<string, unknown>
    rootNodeIds: string[]
  }

  export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'paused' | 'error'

  export type EditorProps = {
    projectId?: string | null
    onLoad?: () => Promise<SceneGraph | null>
    onSave?: (scene: SceneGraph) => Promise<void>
    onSaveStatusChange?: (status: SaveStatus) => void
  }

  export const Editor: ComponentType<EditorProps>
}
