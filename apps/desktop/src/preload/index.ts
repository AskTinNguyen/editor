import { contextBridge, ipcRenderer } from 'electron'
import type { PascalDesktopApi } from '../shared/projects'

const pascalDesktopApi: PascalDesktopApi = {
  projects: {
    create: (input) => ipcRenderer.invoke('projects:create', input),
    getInitialProject: () => ipcRenderer.invoke('projects:get-initial-project'),
    open: (projectId) => ipcRenderer.invoke('projects:open', { projectId }),
    saveScene: (projectId, scene) =>
      ipcRenderer.invoke('projects:save-scene', { projectId, scene }),
  },
}

contextBridge.exposeInMainWorld('pascalDesktop', pascalDesktopApi)
