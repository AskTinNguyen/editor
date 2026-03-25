import { ipcMain } from 'electron'
import type {
  CreateProjectInput,
  ProjectId,
  ProjectScenePayload,
} from '../../shared/projects'
import { ensureInitialProject } from './project-bootstrap'
import type { createProjectStore } from './project-store'

type ProjectStore = ReturnType<typeof createProjectStore>

export function registerProjectIpc(store: ProjectStore) {
  ipcMain.handle('projects:get-initial-project', () => ensureInitialProject(store))
  ipcMain.handle('projects:create', async (_event, input: CreateProjectInput) => {
    const project = await store.createProject(input)

    return {
      projectId: project.projectId,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }
  })
  ipcMain.handle('projects:open', (_event, { projectId }: { projectId: ProjectId }) =>
    store.openProjectById(projectId),
  )
  ipcMain.handle('projects:save-scene', (_event, payload: ProjectScenePayload) =>
    store.saveProjectScene(payload.projectId, payload.scene),
  )
}
