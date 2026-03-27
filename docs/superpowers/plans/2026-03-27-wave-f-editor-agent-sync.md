# Wave F: Editor ↔ Agent Bidirectional Sync

**Goal:** Connect the editor's selection and visual state to the agent so prompts have spatial context and agent edits are visually highlighted.

**Architecture:** Extend the shared desktop contract with selection context, add a node highlight system to the viewer, and enrich the agent's scene context with the user's current selection.

---

## Scope

- Editor selection → agent context (pass selected nodes to the prompt)
- Agent edits → editor highlight (flash affected nodes after apply)
- Undo checkpoint for agent edits (push single undo entry instead of history reset)

This wave does NOT include:
- Streaming mid-turn updates
- Multi-turn conversation memory optimization
- Provider settings UI

## File Ownership

### Task F1: Selection context for agent prompts

Owns only:
- `apps/desktop/src/shared/agents.ts` (MODIFY — add selection context type)
- `apps/desktop/src/main/agents/agent-session-manager.ts` (MODIFY — pass selection to provider)
- `apps/desktop/src/main/agents/agent-provider.ts` (MODIFY — add selectionContext to runTurn params)
- `apps/desktop/src/renderer/src/app.tsx` (MODIFY — track editor selection and pass to mission console)

### Task F2: Agent edit highlighting

Owns only:
- `apps/desktop/src/shared/agents.ts` (MODIFY — add affectedNodeIds to turn result)
- `apps/desktop/src/renderer/src/lib/agent-client.ts` (MODIFY — expose affected node IDs)
- `apps/desktop/src/renderer/src/app.tsx` (MODIFY — pass highlight IDs to editor)

### Task F3: Undo checkpoint (stretch)

This is a stretch goal — only attempt if F1 and F2 are clean.

Owns only:
- `apps/desktop/src/renderer/src/app.tsx` (MODIFY — push undo checkpoint before refresh)

---

## Task F1: Selection context for agent prompts

Add a `selectionContext` field to the `runTurn` params:

```ts
// In agent-provider.ts, add to runTurn params:
selectionContext?: {
  selectedNodeIds: string[]
  selectedNodeTypes: string[]
}
```

In `app.tsx`, track the editor's current selection (if the Editor exposes an `onSelect` callback) and forward it to the session manager via a new `sendMessage` parameter.

In the session manager, pass `selectionContext` through to `provider.runTurn()`.

In the system prompt, if selection context is provided, include: "The user has selected: {nodeIds} ({nodeTypes}). When they say 'this wall' or 'the selected item', they mean these nodes."

---

## Task F2: Agent edit highlighting

After a successful agent turn that applied scene commands, the turn result should include the IDs of affected nodes.

The stub provider already returns this info implicitly (the wall ID it created). For LLM providers, parse the `scene_applyCommands` tool results to extract created/modified node IDs.

In `app.tsx`, after refreshing the scene, temporarily pass the affected node IDs to the editor for visual highlighting. If the Editor supports a `highlightNodeIds` prop, use it. Otherwise, log the IDs for now and add the visual later.

---

## Verification

```bash
bun test
cd apps/desktop && bun x tsc --noEmit
```

## Expected Commits

- `feat(agent): pass editor selection context to agent prompts`
- `feat(agent): highlight affected nodes after agent edits`
