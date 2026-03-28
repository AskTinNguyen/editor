import type { EditorUiInspectorSceneContext } from '@pascal-app/editor'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildUiInspectorContextPayload } from '../../../../shared/ui-inspector-context'
import type { UiInspectorSnapshot, UiInspectorState } from '../../../../shared/ui-inspector'
import type { ProjectId } from '../../../../shared/projects'
import { buildSceneInspectorSnapshot } from './build-scene-snapshot'
import { captureDomInspectorTarget } from './capture-dom'

type CaptureTargetInput = {
  target: Element
}

export type AttachedUiInspectorSnapshot = {
  projectId: ProjectId
  snapshot: UiInspectorSnapshot
}

type AttachedUiInspectorSnapshotAction =
  | {
      type: 'attach'
      projectId: ProjectId
      snapshot: UiInspectorSnapshot
    }
  | {
      type: 'project-changed'
      projectId: ProjectId
    }
  | {
      type: 'clear'
    }

const EMPTY_STATE: UiInspectorState = {
  mode: 'idle',
  snapshot: null,
  updatedAt: null,
}

export function reduceAttachedUiInspectorSnapshot(
  current: AttachedUiInspectorSnapshot | null,
  action: AttachedUiInspectorSnapshotAction,
): AttachedUiInspectorSnapshot | null {
  switch (action.type) {
    case 'attach':
      return {
        projectId: action.projectId,
        snapshot: action.snapshot,
      }
    case 'project-changed':
      return current?.projectId === action.projectId ? current : null
    case 'clear':
      return null
  }
}

export function useUiInspector(
  projectId: ProjectId,
  sceneContext: EditorUiInspectorSceneContext | null,
) {
  const [state, setState] = useState<UiInspectorState>(EMPTY_STATE)
  const [attachedSnapshotState, setAttachedSnapshotState] =
    useState<AttachedUiInspectorSnapshot | null>(null)

  useEffect(() => {
    setAttachedSnapshotState((current) =>
      reduceAttachedUiInspectorSnapshot(current, {
        type: 'project-changed',
        projectId,
      }),
    )
  }, [projectId])

  useEffect(() => {
    const api = window.pascalDesktop.uiInspector
    if (!api) {
      setState(EMPTY_STATE)
      return
    }

    let cancelled = false
    void api.getState(projectId).then((next) => {
      if (!cancelled) {
        setState(next)
      }
    })

    const unsubscribe = api.subscribe(projectId, (next) => {
      if (!cancelled) {
        setState(next)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [projectId])

  const setMode = useCallback(
    async (mode: UiInspectorState['mode']) => {
      const result = await window.pascalDesktop.uiInspector?.setMode(projectId, mode)
      if (result?.success) {
        setState(result.data)
      }
    },
    [projectId],
  )

  const clear = useCallback(async () => {
    const result = await window.pascalDesktop.uiInspector?.clear(projectId)
    if (result?.success) {
      setState(result.data)
      setAttachedSnapshotState((current) =>
        reduceAttachedUiInspectorSnapshot(current, {
          type: 'clear',
        }),
      )
    }
  }, [projectId])

  const captureTarget = useCallback(
    async ({ target }: CaptureTargetInput) => {
      let snapshot: UiInspectorSnapshot | null = null

      if (target instanceof HTMLCanvasElement && sceneContext) {
        snapshot = buildSceneInspectorSnapshot({
          scene: sceneContext,
          click: {
            bounds: {
              x: target.getBoundingClientRect().x,
              y: target.getBoundingClientRect().y,
              width: target.getBoundingClientRect().width,
              height: target.getBoundingClientRect().height,
            },
            route: window.location.pathname,
            targetId: sceneContext.hoveredNodeId ?? sceneContext.selectedNodeIds[0],
            label: sceneContext.hoveredNodeId ?? sceneContext.selectedNodeIds[0] ?? 'Scene canvas',
          },
        })
      } else {
        snapshot = captureDomInspectorTarget(target)
      }

      if (!snapshot) return

      const snapshotResult = await window.pascalDesktop.uiInspector?.setSnapshot(projectId, snapshot)
      if (snapshotResult?.success) {
        setState(snapshotResult.data)
      }

      const modeResult = await window.pascalDesktop.uiInspector?.setMode(projectId, 'idle')
      if (modeResult?.success) {
        setState(modeResult.data)
      }
    },
    [projectId, sceneContext],
  )

  const copyContext = useCallback(async () => {
    if (!state.snapshot) return
    await navigator.clipboard.writeText(buildUiInspectorContextPayload(state.snapshot))
  }, [state.snapshot])

  const attachSnapshot = useCallback(() => {
    if (state.snapshot) {
      const snapshot = state.snapshot
      setAttachedSnapshotState((current) =>
        reduceAttachedUiInspectorSnapshot(current, {
          type: 'attach',
          projectId,
          snapshot,
        }),
      )
    }
  }, [projectId, state.snapshot])

  const clearAttachedSnapshot = useCallback(() => {
    setAttachedSnapshotState((current) =>
      reduceAttachedUiInspectorSnapshot(current, {
        type: 'clear',
      }),
    )
  }, [])

  const attachedSnapshot =
    attachedSnapshotState?.projectId === projectId ? attachedSnapshotState.snapshot : null

  const attachment = useMemo(
    () =>
      attachedSnapshot
        ? {
            label: attachedSnapshot.label,
            source: attachedSnapshot.source,
            route: attachedSnapshot.route,
            selector: attachedSnapshot.selector,
            selectedNodeIds: attachedSnapshot.scene?.selectedNodeIds,
          }
        : null,
    [attachedSnapshot],
  )

  return {
    state,
    snapshot: state.snapshot,
    attachedSnapshot,
    attachment,
    setMode,
    captureTarget,
    clear,
    copyContext,
    attachSnapshot,
    clearAttachedSnapshot,
  }
}
