import { useRef, useState, type ReactNode } from 'react'
import type { EditorUiInspectorSceneContext, SaveStatus } from '@pascal-app/editor'
import type { CreateProjectInput, PascalProjectFile } from '../../../shared/projects'
import { UiInspectorOverlay } from './ui-inspector/ui-inspector-overlay'
import { UiInspectorPanel } from './ui-inspector/ui-inspector-panel'
import { MissionConsole } from './mission-console'
import { ProjectToolbar } from './project-toolbar'
import { ProviderSettings } from './provider-settings'
import { useUiInspector } from '../lib/ui-inspector/use-ui-inspector'

export interface WorkbenchShellProps {
  /** The currently loaded project (drives toolbar display). */
  project: PascalProjectFile
  /** Current save status from the editor's auto-save hook. */
  saveStatus: SaveStatus
  /** IDs of nodes currently selected in the editor canvas. */
  selectedNodeIds?: string[]
  /** Current scene-aware inspector context from the shared editor runtime. */
  uiInspectorSceneContext?: EditorUiInspectorSceneContext | null
  /** Callback when the user clicks "Open" in the toolbar. */
  onOpenRecents: () => void
  /** Callback when the user clicks "New" in the toolbar. */
  onCreateProject: (input: CreateProjectInput) => void
  /** The editor surface (takes all remaining vertical space). */
  children: ReactNode
}

/**
 * Desktop-native workbench chrome that wraps the editor.
 *
 * Layout (top to bottom):
 *   1. ProjectToolbar  — project title, save state, open/create actions
 *   2. Editor region   — flex-1, takes all remaining space
 *   3. MissionConsole  — bottom console for agent interaction
 */
export function WorkbenchShell({
  project,
  saveStatus,
  selectedNodeIds,
  uiInspectorSceneContext,
  onOpenRecents,
  onCreateProject,
  children,
}: WorkbenchShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const editorRegionRef = useRef<HTMLElement | null>(null)
  const uiInspector = useUiInspector(project.projectId, uiInspectorSceneContext ?? null)

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Top chrome: project toolbar */}
      <ProjectToolbar
        project={project}
        saveStatus={saveStatus}
        onOpenRecents={onOpenRecents}
        onCreateProject={onCreateProject}
        isInspecting={uiInspector.state.mode === 'inspect'}
        onToggleInspect={() =>
          void uiInspector.setMode(uiInspector.state.mode === 'inspect' ? 'idle' : 'inspect')
        }
      />

      {/* Central editor region */}
      <main className="relative flex-1 overflow-hidden" ref={editorRegionRef}>
        {children}
        <UiInspectorOverlay
          state={uiInspector.state}
          containerRef={editorRegionRef}
          onCaptureTarget={(input) => {
            void uiInspector.captureTarget(input)
          }}
          onStop={() => {
            void uiInspector.setMode('idle')
          }}
        />
        <UiInspectorPanel
          state={uiInspector.state}
          attachedSnapshot={uiInspector.attachedSnapshot}
          onToggleMode={() => {
            void uiInspector.setMode(uiInspector.state.mode === 'inspect' ? 'idle' : 'inspect')
          }}
          onAttachSnapshot={uiInspector.attachSnapshot}
          onCopyContext={() => {
            void uiInspector.copyContext()
          }}
          onClear={() => {
            void uiInspector.clear()
          }}
        />
      </main>

      {/* Settings bar */}
      <div className="flex items-center justify-end border-t border-border/40 bg-card px-2 py-0.5">
        <button
          type="button"
          className="text-xs text-foreground/40 hover:text-foreground/70"
          onClick={() => setSettingsOpen(true)}
        >
          Settings
        </button>
      </div>

      {/* Bottom: mission console */}
      <MissionConsole
        projectId={project.projectId}
        selectedNodeIds={selectedNodeIds}
        uiInspectorSnapshot={uiInspector.attachedSnapshot}
        onUiInspectorSnapshotSent={uiInspector.clearAttachedSnapshot}
      />

      {/* Provider settings slide-over */}
      <ProviderSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
