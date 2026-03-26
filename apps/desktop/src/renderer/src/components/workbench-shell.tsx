import type { ReactNode } from 'react'
import type { SaveStatus } from '@pascal-app/editor'
import type { CreateProjectInput, PascalProjectFile } from '../../../shared/projects'
import { ProjectToolbar } from './project-toolbar'

/**
 * Minimum height for the bottom slot reserved for the future mission console.
 * Kept small so it doesn't eat editor space until the console ships.
 */
const MISSION_CONSOLE_MIN_HEIGHT = 'min-h-[28px]'

export interface WorkbenchShellProps {
  /** The currently loaded project (drives toolbar display). */
  project: PascalProjectFile
  /** Current save status from the editor's auto-save hook. */
  saveStatus: SaveStatus
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
 *   3. Bottom slot     — reserved for the future mission console
 */
export function WorkbenchShell({
  project,
  saveStatus,
  onOpenRecents,
  onCreateProject,
  children,
}: WorkbenchShellProps) {
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

      {/* Bottom slot: reserved for future mission console */}
      <div
        className={`shrink-0 ${MISSION_CONSOLE_MIN_HEIGHT} border-t border-border/60 bg-card`}
        data-slot="mission-console"
      />
    </div>
  )
}
