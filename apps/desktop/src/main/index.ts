import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerAgentIpc } from './agents/agent-ipc'
import { createAgentSessionManager } from './agents/agent-session-manager'
import { createAgentSessionStore } from './agents/agent-session-store'
import { createPascalCodeExecutor } from './agents/pascal-code-executor'
import { createMainWindow } from './create-main-window'
import { applyProjectSceneCommands } from './projects/project-command-service'
import { registerProjectIpc } from './projects/project-ipc'
import { createProjectStore } from './projects/project-store'

const rootDir = join(app.getPath('userData'), 'projects')

const projectStore = createProjectStore({ rootDir })
const sessionStore = createAgentSessionStore({ rootDir })

const executor = createPascalCodeExecutor({
  project_read: async (projectId) => {
    const project = await projectStore.openProjectById(projectId)
    return { name: project.name, scene: project.scene }
  },
  scene_read: async (projectId) => {
    const project = await projectStore.openProjectById(projectId)
    return project.scene
  },
  scene_applyCommands: async (payload) => {
    const result = await applyProjectSceneCommands(
      projectStore,
      payload.projectId,
      payload.commands,
    )
    return result
  },
})

import type { AgentSessionEvent } from '../shared/agents'
import type { ProjectId } from '../shared/projects'

// Late-bound event broadcaster — wired after IPC registration
let broadcast: ((projectId: ProjectId, event: AgentSessionEvent) => void) | undefined

const sessionManager = createAgentSessionManager({
  sessionStore,
  projectStore,
  executor,
  onEvent: (projectId, event) => broadcast?.(projectId, event),
})

app.whenReady().then(() => {
  registerProjectIpc(projectStore)
  const agentIpc = registerAgentIpc(sessionManager)
  broadcast = agentIpc.broadcastEvent
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
