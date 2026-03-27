import { contextBridge, ipcRenderer } from 'electron'
import { AGENT_IPC_CHANNELS } from '../shared/agents'
import type { PascalDesktopApi } from '../shared/projects'

const pascalDesktopApi: PascalDesktopApi = {
  projects: {
    create: (input) => ipcRenderer.invoke('projects:create', input),
    getInitialProject: () => ipcRenderer.invoke('projects:get-initial-project'),
    open: (projectId) => ipcRenderer.invoke('projects:open', { projectId }),
    saveScene: (projectId, scene) =>
      ipcRenderer.invoke('projects:save-scene', { projectId, scene }),
    listRecent: () => ipcRenderer.invoke('projects:list-recent'),
    applySceneCommands: (projectId, commands) =>
      ipcRenderer.invoke('projects:apply-scene-commands', { projectId, commands }),
  },
  agents: {
    getSession: (projectId) =>
      ipcRenderer.invoke(AGENT_IPC_CHANNELS.getSession, { projectId }),
    sendMessage: (projectId, prompt, options) =>
      ipcRenderer.invoke(AGENT_IPC_CHANNELS.sendMessage, { projectId, prompt, options }),
    subscribe: (projectId, listener) => {
      ipcRenderer.send(AGENT_IPC_CHANNELS.subscribe, { projectId })

      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { projectId: string; event: Parameters<typeof listener>[0] },
      ) => {
        if (payload.projectId === projectId) {
          listener(payload.event)
        }
      }

      ipcRenderer.on(AGENT_IPC_CHANNELS.event, handler)

      return () => {
        ipcRenderer.removeListener(AGENT_IPC_CHANNELS.event, handler)
        ipcRenderer.send(AGENT_IPC_CHANNELS.unsubscribe, { projectId })
      }
    },
  },
}

contextBridge.exposeInMainWorld('pascalDesktop', pascalDesktopApi)
