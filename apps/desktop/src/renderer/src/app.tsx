import { Editor } from '@pascal-app/editor'
import type { EditorUiInspectorSceneContext, SaveStatus } from '@pascal-app/editor'
import { useCallback, useEffect, useState } from 'react'
import type { CreateProjectInput, PascalProjectFile, ProjectId } from '../../shared/projects'
import { RecentProjectSheet } from './components/recent-project-sheet'
import { WorkbenchShell } from './components/workbench-shell'
import { shouldRefreshScene } from './lib/scene-refresh'

function LoadingState({ message }: { message: string }) {
  return (
    <main className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
      <div className="flex max-w-md flex-col gap-3 rounded-2xl border border-border/60 bg-card px-6 py-5 shadow-xl">
        <h1 className="font-semibold text-xl">Pascal Desktop</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </main>
  )
}

export function App() {
  const [currentProject, setCurrentProject] = useState<PascalProjectFile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [recentsOpen, setRecentsOpen] = useState(false)
  const [sceneRevision, setSceneRevision] = useState(0)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [highlightNodeIds, setHighlightNodeIds] = useState<string[]>([])
  const [uiInspectorSceneContext, setUiInspectorSceneContext] =
    useState<EditorUiInspectorSceneContext | null>(null)

  // Load the initial project on mount
  useEffect(() => {
    let cancelled = false

    window.pascalDesktop.projects
      .getInitialProject()
      .then((project) => {
        if (!cancelled) {
          setCurrentProject(project)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load the initial project')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Subscribe to agent turn completions for scene refresh
  useEffect(() => {
    if (!currentProject) return

    const unsubscribe = window.pascalDesktop.agents.subscribe(
      currentProject.projectId,
      (event) => {
        if (shouldRefreshScene(event)) {
          window.pascalDesktop.projects
            .open(currentProject.projectId)
            .then((freshProject) => {
              setCurrentProject(freshProject)
              setSceneRevision((prev) => prev + 1)
              setSaveStatus('idle')
              // Highlight affected nodes after agent edits
              if (event.type === 'turn-completed' && event.result.affectedNodeIds?.length > 0) {
                setHighlightNodeIds(event.result.affectedNodeIds)
                setTimeout(() => setHighlightNodeIds([]), 4000)
              }
            })
            .catch(() => {})
        }
      },
    )

    return unsubscribe
  }, [currentProject?.projectId])

  // Switch to a different project by ID
  const handleOpenProject = useCallback(async (projectId: ProjectId) => {
    try {
      const project = await window.pascalDesktop.projects.open(projectId)
      setCurrentProject(project)
      setSaveStatus('idle')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to open project')
    }
  }, [])

  // Create a new project and switch to it
  const handleCreateProject = useCallback(async (input: CreateProjectInput) => {
    try {
      const summary = await window.pascalDesktop.projects.create(input)
      // After creation, open the full project file
      const project = await window.pascalDesktop.projects.open(summary.projectId)
      setCurrentProject(project)
      setSaveStatus('idle')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }, [])

  const handleOpenRecents = useCallback(() => {
    setRecentsOpen(true)
  }, [])

  const handleCloseRecents = useCallback(() => {
    setRecentsOpen(false)
  }, [])

  if (loadError) {
    return <LoadingState message={loadError} />
  }

  if (!currentProject) {
    return <LoadingState message="Opening your latest project..." />
  }

  return (
    <>
      <WorkbenchShell
        project={currentProject}
        saveStatus={saveStatus}
        selectedNodeIds={selectedNodeIds}
        uiInspectorSceneContext={uiInspectorSceneContext}
        onOpenRecents={handleOpenRecents}
        onCreateProject={handleCreateProject}
      >
        <Editor
          key={`${currentProject.projectId}_${sceneRevision}`}
          onLoad={async () => currentProject.scene}
          onSave={async (scene) => {
            await window.pascalDesktop.projects.saveScene(currentProject.projectId, scene)
            setCurrentProject((existingProject) =>
              existingProject
                ? {
                    ...existingProject,
                    updatedAt: new Date().toISOString(),
                  }
                : existingProject,
            )
          }}
          onSaveStatusChange={setSaveStatus}
          onSelect={setSelectedNodeIds}
          onUiInspectorSceneContextChange={setUiInspectorSceneContext}
          highlightNodeIds={highlightNodeIds}
          projectId={currentProject.projectId}
        />
      </WorkbenchShell>

      <RecentProjectSheet
        open={recentsOpen}
        onClose={handleCloseRecents}
        onSelectProject={handleOpenProject}
        currentProjectId={currentProject.projectId}
      />
    </>
  )
}
