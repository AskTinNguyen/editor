import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { AgentSessionEvent } from '../shared/agents'
import type { ProjectId } from '../shared/projects'
import { registerAgentIpc } from './agents/agent-ipc'
import { createAgentSessionManager } from './agents/agent-session-manager'
import { createAgentSessionStore } from './agents/agent-session-store'
import { createMainWindow } from './create-main-window'
import { applyProjectSceneCommands } from './projects/project-command-service'
import { registerProjectIpc } from './projects/project-ipc'
import { createProjectStore } from './projects/project-store'
import { createProvider, type ProviderConfig } from './agents/providers'
import { loadProviderConfig, resolveProviderFromConfig } from './agents/providers/provider-config'

const rootDir = join(app.getPath('userData'), 'projects')

const projectStore = createProjectStore({ rootDir })
const sessionStore = createAgentSessionStore({ rootDir })

// Tool handler — host-owned callbacks that route to trusted desktop APIs
const toolHandler = {
  project_read: async (projectId: ProjectId) => {
    const project = await projectStore.openProjectById(projectId)
    return { name: project.name, scene: project.scene }
  },
  scene_read: async (projectId: ProjectId) => {
    const project = await projectStore.openProjectById(projectId)
    return project.scene
  },
  scene_applyCommands: async (payload: {
    projectId: ProjectId
    commands: any[]
  }) => {
    const result = await applyProjectSceneCommands(
      projectStore,
      payload.projectId,
      payload.commands,
    )
    return result
  },
}

// ---------------------------------------------------------------------------
// Provider selection — reads persisted config then falls back to env vars
// ---------------------------------------------------------------------------

function resolveProviderConfigFromEnv(): ProviderConfig {
  const providerId = process.env.PASCAL_AGENT_PROVIDER ?? 'stub'

  switch (providerId) {
    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for the anthropic provider')
      return {
        provider: 'anthropic',
        config: {
          apiKey,
          model: process.env.PASCAL_AGENT_MODEL,
          baseURL: process.env.ANTHROPIC_BASE_URL,
        },
      }
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('OPENAI_API_KEY is required for the openai provider')
      return {
        provider: 'openai',
        config: {
          apiKey,
          model: process.env.PASCAL_AGENT_MODEL,
          baseURL: process.env.OPENAI_BASE_URL,
        },
      }
    }
    case 'vesper-gateway':
      return {
        provider: 'vesper-gateway',
        config: {
          model: process.env.PASCAL_AGENT_MODEL,
        },
      }
    case 'stub':
      return { provider: 'stub' }
    default:
      console.warn(`Unknown PASCAL_AGENT_PROVIDER "${providerId}", falling back to stub`)
      return { provider: 'stub' }
  }
}

// Late-bound event broadcaster — wired after IPC registration
let broadcast: ((projectId: ProjectId, event: AgentSessionEvent) => void) | undefined

app.whenReady().then(async () => {
  // Load persisted provider config; fall back to env-var resolution
  let providerConfig: ProviderConfig
  try {
    const persisted = await loadProviderConfig(rootDir)
    providerConfig = resolveProviderFromConfig(persisted)
  } catch {
    providerConfig = resolveProviderConfigFromEnv()
  }

  const provider = createProvider(providerConfig)

  const sessionManager = createAgentSessionManager({
    sessionStore,
    projectStore,
    provider,
    toolHandler,
    onEvent: (projectId, event) => broadcast?.(projectId, event),
  })

  registerProjectIpc(projectStore)
  const agentIpc = registerAgentIpc(sessionManager, { rootDir, toolHandler })
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
