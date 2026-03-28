import type { ProjectId } from '../../shared/projects'
import type { UiInspectorMode, UiInspectorSnapshot, UiInspectorState } from '../../shared/ui-inspector'

type UiInspectorListener = (state: UiInspectorState) => void

function createEmptyState(): UiInspectorState {
  return {
    mode: 'idle',
    snapshot: null,
    updatedAt: null,
  }
}

function createScopeKey(projectId: ProjectId, windowId: number): string {
  return `${projectId}:${windowId}`
}

export function createUiInspectorService() {
  const stateByScope = new Map<string, UiInspectorState>()
  const listenersByScope = new Map<string, Set<UiInspectorListener>>()

  function getState(scopeKey: string): UiInspectorState {
    return stateByScope.get(scopeKey) ?? createEmptyState()
  }

  function emit(scopeKey: string) {
    const listeners = listenersByScope.get(scopeKey)
    if (!listeners || listeners.size === 0) return

    const state = getState(scopeKey)
    for (const listener of listeners) {
      listener(state)
    }
  }

  function writeState(scopeKey: string, next: UiInspectorState): UiInspectorState {
    stateByScope.set(scopeKey, next)
    emit(scopeKey)
    return next
  }

  function setMode(scopeKey: string, mode: UiInspectorMode): UiInspectorState {
    const prev = getState(scopeKey)
    return writeState(scopeKey, {
      ...prev,
      mode,
      updatedAt: new Date().toISOString(),
    })
  }

  function setSnapshot(scopeKey: string, snapshot: UiInspectorSnapshot): UiInspectorState {
    const prev = getState(scopeKey)
    return writeState(scopeKey, {
      ...prev,
      snapshot,
      updatedAt: new Date().toISOString(),
    })
  }

  function clear(scopeKey: string): UiInspectorState {
    const prev = getState(scopeKey)
    return writeState(scopeKey, {
      ...prev,
      snapshot: null,
      updatedAt: new Date().toISOString(),
    })
  }

  function clearWindow(projectId: ProjectId, windowId: number): void {
    const scopeKey = createScopeKey(projectId, windowId)
    stateByScope.delete(scopeKey)
    listenersByScope.delete(scopeKey)
  }

  function subscribe(scopeKey: string, listener: UiInspectorListener): () => void {
    const listeners = listenersByScope.get(scopeKey) ?? new Set<UiInspectorListener>()
    listeners.add(listener)
    listenersByScope.set(scopeKey, listeners)

    return () => {
      const current = listenersByScope.get(scopeKey)
      if (!current) return
      current.delete(listener)
      if (current.size === 0) {
        listenersByScope.delete(scopeKey)
      }
    }
  }

  return {
    createScopeKey,
    getState,
    setMode,
    setSnapshot,
    clear,
    clearWindow,
    subscribe,
  }
}
