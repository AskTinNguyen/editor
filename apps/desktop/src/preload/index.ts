import { contextBridge, ipcRenderer } from 'electron'
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
}

contextBridge.exposeInMainWorld('pascalDesktop', pascalDesktopApi)
