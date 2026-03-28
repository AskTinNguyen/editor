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
import { createVesperBridge, type VesperBridgeConfig } from './agents/vesper-bridge'
import { getAiGatewayCredentials } from './agents/providers/ai-gateway-credentials'
import { registerUiInspectorIpc } from './ui-inspector/ipc-ui-inspector'
import { createUiInspectorService } from './ui-inspector/ui-inspector-service'
import { buildUiInspectorContextPayload } from '../shared/ui-inspector-context'

const rootDir = join(app.getPath('userData'), 'projects')

const projectStore = createProjectStore({ rootDir })
const sessionStore = createAgentSessionStore({ rootDir })
const uiInspectorService = createUiInspectorService()

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
  vesper_ui_get_state: async (payload: { projectId: ProjectId; windowId?: number }) => {
    if (!payload.windowId) {
      return {
        success: false as const,
        error: {
          code: 'TOOL_UNAVAILABLE' as const,
          message: 'UI inspector state is not available without a window context.',
          retriable: false,
        },
      }
    }

    return {
      success: true as const,
      data: uiInspectorService.getState(
        uiInspectorService.createScopeKey(payload.projectId, payload.windowId),
      ),
    }
  },
  vesper_ui_get_selection: async (payload: { projectId: ProjectId; windowId?: number }) => {
    if (!payload.windowId) {
      return {
        success: false as const,
        error: {
          code: 'TOOL_UNAVAILABLE' as const,
          message: 'UI inspector selection is not available without a window context.',
          retriable: false,
        },
      }
    }

    const state = uiInspectorService.getState(
      uiInspectorService.createScopeKey(payload.projectId, payload.windowId),
    )
    if (!state.snapshot) {
      return {
        success: false as const,
        error: {
          code: 'NO_SELECTION' as const,
          message: 'No UI selection is currently captured.',
          retriable: true,
        },
      }
    }

    return {
      success: true as const,
      data: state.snapshot,
    }
  },
  vesper_ui_get_context: async (payload: {
    projectId: ProjectId
    windowId?: number
    includeHtml?: boolean
    includeStyles?: boolean
    includeDataAttributes?: boolean
  }) => {
    if (!payload.windowId) {
      return {
        success: false as const,
        error: {
          code: 'TOOL_UNAVAILABLE' as const,
          message: 'UI inspector context is not available without a window context.',
          retriable: false,
        },
      }
    }

    const state = uiInspectorService.getState(
      uiInspectorService.createScopeKey(payload.projectId, payload.windowId),
    )
    if (!state.snapshot) {
      return {
        success: false as const,
        error: {
          code: 'NO_SELECTION' as const,
          message: 'No UI selection is currently captured.',
          retriable: true,
        },
      }
    }

    return {
      success: true as const,
      data: buildUiInspectorContextPayload(state.snapshot, {
        includeHtml: payload.includeHtml,
        includeStyles: payload.includeStyles,
        includeDataAttributes: payload.includeDataAttributes,
      }),
    }
  },
  vesper_ui_capture_screenshot: async (_payload: { projectId: ProjectId; windowId?: number }) => {
    return {
      success: false as const,
      error: {
        code: 'TOOL_UNAVAILABLE' as const,
        message: 'UI inspector screenshot capture is not implemented yet.',
        retriable: false,
      },
    }
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

// ---------------------------------------------------------------------------
// Bridge config resolution — maps provider config to Vesper bridge config
// ---------------------------------------------------------------------------

function resolveBridgeConfig(config: ProviderConfig): VesperBridgeConfig | null {
  switch (config.provider) {
    case 'anthropic':
      return {
        apiKey: config.config.apiKey,
        model: config.config.model,
        baseURL: config.config.baseURL,
      }
    case 'vesper-gateway': {
      const creds = getAiGatewayCredentials()
      if (!creds) return null
      return {
        apiKey: creds.authToken,
        baseURL: creds.baseUrl,
        model: config.config?.model,
      }
    }
    case 'openai':
      // OpenAI uses a different SDK — keep using the provider path
      return null
    case 'stub':
      return null
    default:
      return null
  }
}

// Late-bound event broadcaster — wired after IPC registration
let broadcast: ((projectId: ProjectId, event: AgentSessionEvent) => void) | undefined

app.whenReady().then(async () => {
  // Provider selection priority: env var > persisted config > stub default
  let providerConfig: ProviderConfig
  if (process.env.PASCAL_AGENT_PROVIDER && process.env.PASCAL_AGENT_PROVIDER !== 'stub') {
    providerConfig = resolveProviderConfigFromEnv()
  } else {
    try {
      const persisted = await loadProviderConfig(rootDir)
      providerConfig = resolveProviderFromConfig(persisted)
    } catch {
      providerConfig = resolveProviderConfigFromEnv()
    }
  }

  // Create a Vesper bridge when a compatible real LLM provider is configured
  let bridge: ReturnType<typeof createVesperBridge> | undefined
  if (providerConfig.provider !== 'stub') {
    const bridgeConfig = resolveBridgeConfig(providerConfig)
    if (bridgeConfig) {
      bridge = createVesperBridge(bridgeConfig, toolHandler)
    }
  }

  const sessionManager = createAgentSessionManager({
    sessionStore,
    projectStore,
    provider: bridge ? undefined : createProvider(providerConfig),
    bridge,
    toolHandler,
    onEvent: (projectId, event) => broadcast?.(projectId, event),
  })

  registerProjectIpc(projectStore)
  const agentIpc = registerAgentIpc(sessionManager, { rootDir, toolHandler })
  broadcast = agentIpc.broadcastEvent
  registerUiInspectorIpc(uiInspectorService)
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
