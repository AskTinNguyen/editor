import { useCallback, useEffect, useState } from 'react'
import type { ProjectId, ProjectSummary } from '../../../shared/projects'

export interface RecentProjectSheetProps {
  open: boolean
  onClose: () => void
  onSelectProject: (projectId: ProjectId) => void
  currentProjectId: ProjectId
}

export function RecentProjectSheet({
  open,
  onClose,
  onSelectProject,
  currentProjectId,
}: RecentProjectSheetProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setLoading(true)
    setError(null)

    window.pascalDesktop.projects
      .listRecent()
      .then((result) => {
        setProjects(result)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load recent projects')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open])

  const handleSelect = useCallback(
    (projectId: ProjectId) => {
      if (projectId === currentProjectId) {
        onClose()
        return
      }
      onSelectProject(projectId)
      onClose()
    },
    [currentProjectId, onSelectProject, onClose],
  )

  // Handle Escape key
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        role="presentation"
      />

      {/* Sheet panel */}
      <div className="fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
          <span className="font-semibold text-sm text-foreground">Recent Projects</span>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-muted-foreground">Loading projects...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <span className="text-xs text-red-500">{error}</span>
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-muted-foreground">No recent projects</span>
            </div>
          )}

          {!loading &&
            !error &&
            projects.map((project) => {
              const isCurrent = project.projectId === currentProjectId
              return (
                <button
                  key={project.projectId}
                  type="button"
                  className={`flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors ${
                    isCurrent
                      ? 'bg-accent/60 text-foreground'
                      : 'text-foreground hover:bg-accent/40'
                  }`}
                  onClick={() => handleSelect(project.projectId)}
                >
                  <span className="truncate text-sm font-medium">{project.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(project.updatedAt)}
                  </span>
                </button>
              )
            })}
        </div>
      </div>
    </>
  )
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}
