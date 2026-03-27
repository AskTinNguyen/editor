import { useState, type ReactNode } from 'react'
import type { SaveStatus } from '@pascal-app/editor'
import type { CreateProjectInput, PascalProjectFile } from '../../../shared/projects'
import { MissionConsole } from './mission-console'
import { ProjectToolbar } from './project-toolbar'
import { ProviderSettings } from './provider-settings'

export interface WorkbenchShellProps {
  /** The currently loaded project (drives toolbar display). */
  project: PascalProjectFile
  /** Current save status from the editor's auto-save hook. */
  saveStatus: SaveStatus
  /** IDs of nodes currently selected in the editor canvas. */
  selectedNodeIds?: string[]
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
  onOpenRecents,
  onCreateProject,
  children,
}: WorkbenchShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Top chrome: project toolbar */}
      <ProjectToolbar
        project={project}
        saveStatus={saveStatus}
        onOpenRecents={onOpenRecents}
        onCreateProject={onCreateProject}
      />

      {/* Central editor region */}
      <main className="relative flex-1 overflow-hidden">{children}</main>

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
      <MissionConsole projectId={project.projectId} selectedNodeIds={selectedNodeIds} />

      {/* Provider settings slide-over */}
      <ProviderSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
