import { ipcMain, type WebContents } from 'electron'
import {
  AGENT_IPC_CHANNELS,
  PROVIDER_CONFIG_IPC_CHANNELS,
  type AgentSessionEvent,
} from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'
import type { PascalToolCallHandler } from './agent-provider'
import type { createAgentSessionManager } from './agent-session-manager'
import {
  loadProviderConfig,
  saveProviderConfig,
  testProviderConnection,
  type PersistedProviderConfig,
} from './providers/provider-config'

type AgentSessionManager = ReturnType<typeof createAgentSessionManager>

// ---------------------------------------------------------------------------
// Subscription tracking
// ---------------------------------------------------------------------------

type SubscriptionMap = Map<WebContents, Set<ProjectId>>

function addSubscription(
  subscriptions: SubscriptionMap,
  webContents: WebContents,
  projectId: ProjectId,
): void {
  let projects = subscriptions.get(webContents)
  if (!projects) {
    projects = new Set()
    subscriptions.set(webContents, projects)

    // Clean up when the webContents is destroyed
    webContents.once('destroyed', () => {
      subscriptions.delete(webContents)
    })
  }
  projects.add(projectId)
}

function removeSubscription(
  subscriptions: SubscriptionMap,
  webContents: WebContents,
  projectId: ProjectId,
): void {
  const projects = subscriptions.get(webContents)
  if (projects) {
    projects.delete(projectId)
    if (projects.size === 0) {
      subscriptions.delete(webContents)
    }
  }
}

function broadcastEvent(
  subscriptions: SubscriptionMap,
  projectId: ProjectId,
  event: AgentSessionEvent,
): void {
  for (const [webContents, projects] of subscriptions) {
    if (projects.has(projectId) && !webContents.isDestroyed()) {
      webContents.send(AGENT_IPC_CHANNELS.event, { projectId, event })
    }
  }
}

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

export function registerAgentIpc(
  manager: AgentSessionManager,
  opts: { rootDir: string; toolHandler: PascalToolCallHandler },
) {
  const subscriptions: SubscriptionMap = new Map()

  // Request-response handlers (invoke/handle)
  ipcMain.handle(
    AGENT_IPC_CHANNELS.getSession,
    (_event, { projectId }: { projectId: ProjectId }) => manager.getSession(projectId),
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.sendMessage,
    (
      _event,
      {
        projectId,
        prompt,
        options,
      }: {
        projectId: ProjectId
        prompt: string
        options?: {
          selectedNodeIds?: string[]
          model?: string
          thinkingLevel?: 'off' | 'think' | 'max'
          agentContextPrefix?: string
          uiInspectorAttachment?: { label: string; source: 'dom' | 'scene'; route?: string }
        }
      },
    ) =>
      manager.sendMessage(projectId, prompt, options),
  )

  // Fire-and-forget subscription handlers (on/send)
  ipcMain.on(
    AGENT_IPC_CHANNELS.subscribe,
    (event, { projectId }: { projectId: ProjectId }) => {
      addSubscription(subscriptions, event.sender, projectId)
    },
  )

  ipcMain.on(
    AGENT_IPC_CHANNELS.unsubscribe,
    (event, { projectId }: { projectId: ProjectId }) => {
      removeSubscription(subscriptions, event.sender, projectId)
    },
  )

  // ---------------------------------------------------------------------------
  // Provider config handlers
  // ---------------------------------------------------------------------------

  ipcMain.handle(PROVIDER_CONFIG_IPC_CHANNELS.get, () =>
    loadProviderConfig(opts.rootDir),
  )

  ipcMain.handle(
    PROVIDER_CONFIG_IPC_CHANNELS.set,
    async (_event, config: PersistedProviderConfig) => {
      await saveProviderConfig(opts.rootDir, config)
      // NOTE: Provider hot-swap is a stretch goal.
      // For now, config takes effect on next app restart.
    },
  )

  ipcMain.handle(
    PROVIDER_CONFIG_IPC_CHANNELS.test,
    (_event, config: PersistedProviderConfig) =>
      testProviderConnection(config, opts.toolHandler),
  )

  // Return the event broadcaster for the session manager's onEvent callback
  return {
    broadcastEvent: (projectId: ProjectId, event: AgentSessionEvent) =>
      broadcastEvent(subscriptions, projectId, event),
  }
}
