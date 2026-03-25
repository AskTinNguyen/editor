import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './create-main-window'
import { registerProjectIpc } from './projects/project-ipc'
import { createProjectStore } from './projects/project-store'

const projectStore = createProjectStore({
  rootDir: join(app.getPath('userData'), 'projects'),
})

app.whenReady().then(() => {
  registerProjectIpc(projectStore)
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
