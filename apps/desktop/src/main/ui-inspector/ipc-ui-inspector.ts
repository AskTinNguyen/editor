import { BrowserWindow, ipcMain, type WebContents } from 'electron'
import type { ProjectId } from '../../shared/projects'
import {
  UI_INSPECTOR_IPC_CHANNELS,
  type InspectorResult,
  type UiInspectorBounds,
  type UiInspectorMode,
  type UiInspectorSendOptions,
  type UiInspectorSnapshot,
} from '../../shared/ui-inspector'
import type { createUiInspectorService } from './ui-inspector-service'

type UiInspectorService = ReturnType<typeof createUiInspectorService>

type TrackedSender = {
  windowId: number
  projectIds: Set<ProjectId>
  unsubscribers: Map<string, () => void>
}

function permissionBlockedResult<T>(message: string): InspectorResult<T> {
  return {
    success: false,
    error: {
      code: 'TOOL_UNAVAILABLE',
      message,
      retriable: false,
    },
  }
}

export function registerUiInspectorIpc(service: UiInspectorService) {
  const trackedSenders = new Map<WebContents, TrackedSender>()

  function getWindowId(sender: WebContents): number {
    return BrowserWindow.fromWebContents(sender)?.id ?? sender.id
  }

  function getScopeKey(sender: WebContents, projectId: ProjectId): string {
    const windowId = getWindowId(sender)
    return service.createScopeKey(projectId, windowId)
  }

  function ensureTrackedSender(sender: WebContents): TrackedSender {
    const existing = trackedSenders.get(sender)
    if (existing) {
      return existing
    }

    const tracked: TrackedSender = {
      windowId: getWindowId(sender),
      projectIds: new Set<ProjectId>(),
      unsubscribers: new Map<string, () => void>(),
    }

    sender.once('destroyed', () => {
      const current = trackedSenders.get(sender)
      if (!current) return

      for (const unsubscribe of current.unsubscribers.values()) {
        unsubscribe()
      }
      for (const projectId of current.projectIds) {
        service.clearWindow(projectId, current.windowId)
      }

      trackedSenders.delete(sender)
    })

    trackedSenders.set(sender, tracked)
    return tracked
  }

  ipcMain.handle(
    UI_INSPECTOR_IPC_CHANNELS.getState,
    (event, { projectId }: { projectId: ProjectId }) => {
      ensureTrackedSender(event.sender).projectIds.add(projectId)
      return service.getState(getScopeKey(event.sender, projectId))
    },
  )

  ipcMain.handle(
    UI_INSPECTOR_IPC_CHANNELS.setMode,
    (event, { projectId, mode }: { projectId: ProjectId; mode: UiInspectorMode }) => {
      ensureTrackedSender(event.sender).projectIds.add(projectId)
      return {
        success: true,
        data: service.setMode(getScopeKey(event.sender, projectId), mode),
      } satisfies InspectorResult<ReturnType<UiInspectorService['setMode']>>
    },
  )

  ipcMain.handle(
    UI_INSPECTOR_IPC_CHANNELS.setSnapshot,
    (
      event,
      { projectId, snapshot }: { projectId: ProjectId; snapshot: UiInspectorSnapshot },
    ) => {
      ensureTrackedSender(event.sender).projectIds.add(projectId)
      return {
        success: true,
        data: service.setSnapshot(getScopeKey(event.sender, projectId), snapshot),
      } satisfies InspectorResult<ReturnType<UiInspectorService['setSnapshot']>>
    },
  )

  ipcMain.handle(
    UI_INSPECTOR_IPC_CHANNELS.clear,
    (event, { projectId }: { projectId: ProjectId }) => {
      ensureTrackedSender(event.sender).projectIds.add(projectId)
      return {
        success: true,
        data: service.clear(getScopeKey(event.sender, projectId)),
      } satisfies InspectorResult<ReturnType<UiInspectorService['clear']>>
    },
  )

  ipcMain.handle(
    UI_INSPECTOR_IPC_CHANNELS.captureScreenshot,
    async (
      event,
      payload: {
        projectId: ProjectId
        bounds?: UiInspectorBounds
        scale?: number
        captureContext?: string
      },
    ) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) {
          return {
            success: false,
            error: { code: 'NO_WINDOW', message: 'No window found', retriable: false },
          } satisfies InspectorResult<never>
        }

        const image = await win.webContents.capturePage(
          payload.bounds
            ? {
                x: Math.round(payload.bounds.x),
                y: Math.round(payload.bounds.y),
                width: Math.round(payload.bounds.width),
                height: Math.round(payload.bounds.height),
              }
            : undefined,
        )

        const pngBuffer = image.toPNG()
        const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`

        return {
          success: true,
          data: {
            screenshotDataUrl: dataUrl,
            screenshotByteSize: pngBuffer.length,
          },
        } satisfies InspectorResult<{ screenshotDataUrl: string; screenshotByteSize: number }>
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'CAPTURE_FAILED',
            message: err instanceof Error ? err.message : String(err),
            retriable: true,
          },
        } satisfies InspectorResult<never>
      }
    },
  )

  ipcMain.handle(
    UI_INSPECTOR_IPC_CHANNELS.sendToChat,
    (
      _event,
      _payload: { projectId: ProjectId; prompt: string; options?: UiInspectorSendOptions },
    ) => permissionBlockedResult('Inspector send-to-chat is not implemented yet.'),
  )

  ipcMain.on(
    UI_INSPECTOR_IPC_CHANNELS.stateChanged,
    (event, { projectId }: { projectId: ProjectId }) => {
      const tracked = ensureTrackedSender(event.sender)
      tracked.projectIds.add(projectId)
      const scopeKey = getScopeKey(event.sender, projectId)

      tracked.unsubscribers.get(scopeKey)?.()
      tracked.unsubscribers.set(
        scopeKey,
        service.subscribe(scopeKey, (state) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(UI_INSPECTOR_IPC_CHANNELS.stateChanged, { projectId, state })
          }
        }),
      )
    },
  )
}
