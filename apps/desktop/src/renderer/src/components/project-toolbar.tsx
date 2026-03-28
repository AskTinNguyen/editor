import { useCallback, useState } from 'react'
import type { SaveStatus } from '@pascal-app/editor'
import type { PascalProjectFile, CreateProjectInput } from '../../../shared/projects'

export interface ProjectToolbarProps {
  project: PascalProjectFile
  saveStatus: SaveStatus
  onOpenRecents: () => void
  onCreateProject: (input: CreateProjectInput) => void
  isInspecting?: boolean
  onToggleInspect?: () => void
}

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Unsaved changes',
  saving: 'Saving...',
  saved: 'Saved',
  paused: 'Save paused',
  error: 'Save failed',
}

const SAVE_STATUS_COLORS: Record<SaveStatus, string> = {
  idle: 'text-muted-foreground',
  pending: 'text-amber-500',
  saving: 'text-muted-foreground',
  saved: 'text-emerald-500',
  paused: 'text-amber-500',
  error: 'text-red-500',
}

export function ProjectToolbar({
  project,
  saveStatus,
  onOpenRecents,
  onCreateProject,
  isInspecting = false,
  onToggleInspect,
}: ProjectToolbarProps) {
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = useCallback(() => {
    const name = `Untitled ${new Date().toLocaleDateString()}`
    setIsCreating(true)
    onCreateProject({ name })
    // Parent will handle the actual creation; reset local state optimistically
    setTimeout(() => setIsCreating(false), 1000)
  }, [onCreateProject])

  const statusLabel = SAVE_STATUS_LABELS[saveStatus]
  const statusColor = SAVE_STATUS_COLORS[saveStatus]

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 bg-card px-3">
      {/* Left: Project info */}
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm text-foreground truncate max-w-[240px]">
          {project.name}
        </span>
        {statusLabel && (
          <span className={`text-xs ${statusColor} transition-colors duration-200`}>
            {statusLabel}
          </span>
        )}
      </div>

      {/* Right: Project actions */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={onOpenRecents}
        >
          Open
        </button>
        <button
          type="button"
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            isInspecting
              ? 'bg-sky-600 text-white hover:bg-sky-700'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
          data-ui-inspector-chrome="true"
          onClick={onToggleInspect}
        >
          {isInspecting ? 'Inspecting' : 'Inspect'}
        </button>
        <button
          type="button"
          className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          onClick={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'New'}
        </button>
      </div>
    </header>
  )
}
