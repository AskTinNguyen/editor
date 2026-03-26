import { ipcMain, type WebContents } from 'electron'
import { AGENT_IPC_CHANNELS, type AgentSessionEvent } from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'
import type { createAgentSessionManager } from './agent-session-manager'

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

export function registerAgentIpc(manager: AgentSessionManager) {
  const subscriptions: SubscriptionMap = new Map()

  // Request-response handlers (invoke/handle)
  ipcMain.handle(
    AGENT_IPC_CHANNELS.getSession,
    (_event, { projectId }: { projectId: ProjectId }) => manager.getSession(projectId),
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.sendMessage,
    (_event, { projectId, prompt }: { projectId: ProjectId; prompt: string }) =>
      manager.sendMessage(projectId, prompt),
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

  // Return the event broadcaster for the session manager's onEvent callback
  return {
    broadcastEvent: (projectId: ProjectId, event: AgentSessionEvent) =>
      broadcastEvent(subscriptions, projectId, event),
  }
}
