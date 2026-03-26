import { ipcMain } from 'electron'
import type {
  CreateProjectInput,
  ProjectCommandPayload,
  ProjectId,
  ProjectScenePayload,
} from '../../shared/projects'
import { applyProjectSceneCommands } from './project-command-service'
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
  ipcMain.handle('projects:list-recent', () => store.listRecentProjects())
  ipcMain.handle('projects:apply-scene-commands', (_event, payload: ProjectCommandPayload) =>
    applyProjectSceneCommands(store, payload.projectId, payload.commands),
  )
}
