# Wave H: Editor ↔ Agent Bridge

**Goal:** Add `onSelect` and `highlightNodeIds` props to the Editor component, wire them through the desktop app so the agent can reference selected nodes and visually highlight affected nodes after edits.

---

## Architecture

The Editor uses `useViewer` store for selection state (`selection.selectedIds`) and `outliner.hoveredObjects` for visual highlights. We add two new props:

- `onSelect(selectedIds: string[])` — called when the user selects/deselects nodes
- `highlightNodeIds: string[]` — drives a temporary cyan pulsing outline on the specified nodes

Both are optional props that leave existing behavior unchanged when omitted.

## File Changes (exact)

### 1. `packages/editor/src/components/editor/index.tsx`

**Add to EditorProps interface (line ~57):**
```ts
onSelect?: (selectedIds: string[]) => void
highlightNodeIds?: string[]
```

**Add to Editor function destructure (line ~306):**
```ts
onSelect,
highlightNodeIds,
```

**Add a `useEffect` that watches `useViewer` selection and calls `onSelect`:**
```ts
// Notify host when selection changes
useEffect(() => {
  if (!onSelect) return
  const unsubscribe = useViewer.subscribe(
    (state) => state.selection.selectedIds,
    (selectedIds) => onSelect(selectedIds),
  )
  return unsubscribe
}, [onSelect])
```

**Add a `HighlightManager` child component that maps `highlightNodeIds` to outliner objects:**
```tsx
{highlightNodeIds && highlightNodeIds.length > 0 && (
  <AgentHighlightManager nodeIds={highlightNodeIds} />
)}
```

### 2. `packages/editor/src/components/editor/agent-highlight-manager.tsx` (CREATE)

A component that:
1. Receives `nodeIds: string[]`
2. Uses `useRegistry()` from `@pascal-app/core` to look up the THREE.Object3D for each node ID
3. Adds those objects to `useViewer.getState().outliner.hoveredObjects`
4. Removes them after 3 seconds (auto-fade)
5. Cleans up on unmount

```tsx
import { useEffect, useRef } from 'react'
import { useRegistry } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'

export function AgentHighlightManager({ nodeIds }: { nodeIds: string[] }) {
  const registry = useRegistry()
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (nodeIds.length === 0) return

    const objects = nodeIds
      .map((id) => registry.get(id))
      .filter(Boolean)

    if (objects.length === 0) return

    // Add to hovered outliner for cyan pulsing highlight
    const outliner = useViewer.getState().outliner
    outliner.hoveredObjects.push(...objects)

    // Auto-clear after 3 seconds
    timeoutRef.current = setTimeout(() => {
      for (const obj of objects) {
        const idx = outliner.hoveredObjects.indexOf(obj)
        if (idx >= 0) outliner.hoveredObjects.splice(idx, 1)
      }
    }, 3000)

    return () => {
      clearTimeout(timeoutRef.current)
      for (const obj of objects) {
        const idx = outliner.hoveredObjects.indexOf(obj)
        if (idx >= 0) outliner.hoveredObjects.splice(idx, 1)
      }
    }
  }, [nodeIds, registry])

  return null
}
```

### 3. `packages/editor/src/index.tsx`

**No changes needed** — EditorProps is already re-exported from the component file.

### 4. `apps/desktop/src/renderer/src/types/pascal-editor.d.ts`

**Update the type declaration to include the new props:**
```ts
export type EditorProps = {
  projectId?: string | null
  onLoad?: () => Promise<SceneGraph | null>
  onSave?: (scene: SceneGraph) => Promise<void>
  onSaveStatusChange?: (status: SaveStatus) => void
  onSelect?: (selectedIds: string[]) => void
  highlightNodeIds?: string[]
}
```

### 5. `apps/desktop/src/renderer/src/app.tsx`

**Add state for selectedNodeIds and highlightNodeIds:**
```ts
const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
const [highlightNodeIds, setHighlightNodeIds] = useState<string[]>([])
```

**Pass to Editor:**
```tsx
<Editor
  key={`${currentProject.projectId}_${sceneRevision}`}
  onLoad={async () => currentProject.scene}
  onSave={...}
  onSaveStatusChange={setSaveStatus}
  onSelect={setSelectedNodeIds}
  highlightNodeIds={highlightNodeIds}
  projectId={currentProject.projectId}
/>
```

**Update the agent event subscription to set highlights:**
In the existing `useEffect` that subscribes to agent events, after refreshing the scene:
```ts
if (shouldRefreshScene(event)) {
  // ... existing refresh logic ...
  // Set highlight for affected nodes
  if (event.type === 'turn-completed') {
    setHighlightNodeIds(event.result.affectedNodeIds)
    // Auto-clear after 4 seconds (agent-highlight-manager handles the visual)
    setTimeout(() => setHighlightNodeIds([]), 4000)
  }
}
```

**Update the `useAgentSession` hook usage or `sendMessage` in the mission console to pass selection:**
The `useAgentSession` hook's `sendMessage` already supports options. We need to pass `selectedNodeIds`. The simplest approach: the MissionConsole needs access to `selectedNodeIds`.

**Pass selectedNodeIds to WorkbenchShell as a prop:**
```tsx
<WorkbenchShell
  project={currentProject}
  saveStatus={saveStatus}
  selectedNodeIds={selectedNodeIds}
  ...
>
```

### 6. `apps/desktop/src/renderer/src/components/workbench-shell.tsx`

**Add `selectedNodeIds` prop:**
```ts
export interface WorkbenchShellProps {
  // ... existing props
  selectedNodeIds?: string[]
}
```

**Pass to MissionConsole:**
```tsx
<MissionConsole projectId={project.projectId} selectedNodeIds={selectedNodeIds} />
```

### 7. `apps/desktop/src/renderer/src/components/mission-console.tsx`

**Accept `selectedNodeIds` prop and pass to `sendMessage`:**
```tsx
export function MissionConsole({ projectId, selectedNodeIds }: {
  projectId: ProjectId
  selectedNodeIds?: string[]
}) {
  const { session, status, sendMessage, isProcessing } = useAgentSession(projectId)

  const handleSend = useCallback((prompt: string) => {
    sendMessage(prompt, { selectedNodeIds })
  }, [sendMessage, selectedNodeIds])

  return (
    <div className="flex flex-col border-t border-border/60 bg-card">
      <MissionConsoleStatus status={status} />
      <MissionConsoleLog messages={session?.messages ?? []} lastTurnResult={session?.lastTurnResult ?? null} />
      <MissionConsoleComposer onSend={handleSend} disabled={isProcessing} />
    </div>
  )
}
```

### 8. `apps/desktop/src/renderer/src/lib/agent-client.ts`

**Update `sendMessage` in the hook to accept and forward options:**
The `useAgentSession` hook's `sendMessage` currently accepts `(prompt: string)`. Update to:
```ts
const sendMessage = useCallback(
  async (prompt: string, options?: { selectedNodeIds?: string[] }) => {
    // ... existing logic, pass options to client
    const result = await getAgentClient().sendMessage(pid, prompt, options)
    return result
  },
  [],
)
```

---

## Verification

```bash
bun test
cd packages/editor && bun x tsc --noEmit  # or tsc --build if that's how it's configured
cd apps/desktop && bun x tsc --noEmit
```

## Expected Commits

- `feat(editor): add onSelect and highlightNodeIds props to Editor`
- `feat(desktop): wire selection context and node highlighting end-to-end`
