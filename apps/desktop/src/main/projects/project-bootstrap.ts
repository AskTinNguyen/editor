import type { PascalProjectFile } from '../../shared/projects'
import type { createProjectStore } from './project-store'

type ProjectStore = ReturnType<typeof createProjectStore>

export async function ensureInitialProject(store: ProjectStore): Promise<PascalProjectFile> {
  const recentProject = await store.getMostRecentProject()
  if (recentProject) {
    return recentProject
  }

  const createdProject = await store.createProject({ name: 'Untitled Project' })
  return {
    projectId: createdProject.projectId,
    name: createdProject.name,
    scene: createdProject.scene,
    createdAt: createdProject.createdAt,
    updatedAt: createdProject.updatedAt,
  }
}
