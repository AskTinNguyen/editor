import { Editor } from '@pascal-app/editor'
import { useEffect, useState } from 'react'
import type { PascalProjectFile } from '../../shared/projects'

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

  if (loadError) {
    return <LoadingState message={loadError} />
  }

  if (!currentProject) {
    return <LoadingState message="Opening your latest project..." />
  }

  return (
    <div className="h-screen w-screen">
      <Editor
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
        projectId={currentProject.projectId}
      />
    </div>
  )
}
