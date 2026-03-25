# Pascal Agent Workbench Plan Review

Date: 2026-03-25

Reviewed artifact:
- `docs/superpowers/plans/2026-03-25-pascal-agent-workbench.md`

Reference artifacts:
- `docs/superpowers/specs/2026-03-25-pascal-agent-workbench-design.md`
- `apps/desktop/src/shared/projects.ts`
- `apps/desktop/src/main/projects/project-store.ts`
- `apps/desktop/src/main/projects/project-ipc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/app.tsx`
- `packages/scene-engine/src/commands/apply-scene-command.ts`
- `packages/scene-engine/src/document/scene-graph.ts`
- `packages/scene-engine/src/schema/base.ts`

## Summary

The implementation plan is directionally strong and matches the repo's current Electron seam well:

- shared desktop contracts
- trusted main-process project store
- preload bridge
- renderer-hosted editor shell

The main risks are not in the desktop shell shape. They are in the mutation contract for scene commands, the lack of an explicit editor-history policy for agent refreshes, and the need for a more concrete event-channel contract for `agents.*`.

## Findings

### 1. `update-node` is too permissive for a deterministic scene-command kernel

The plan currently proposes:

```ts
{ type: 'update-node'; nodeId: string; patch: Partial<AnyNode> }
```

That is too broad for the current scene model.

Why this is risky:

- `BaseNode` allows `parentId` on every node.
- many node types also own `children`.
- `parseSceneGraph(...)` does not enforce full parent-child referential integrity.
- a broad partial patch could mutate `id`, `type`, `parentId`, or `children` into structurally inconsistent states that still parse.

Recommendation:

- keep `update-node` for property edits only
- explicitly forbid `id`, `type`, `parentId`, and `children` in generic patches
- add a dedicated `move-node` command for reparenting
- add graph-integrity validation beyond `parseSceneGraph(...)`

### 2. The plan needs an explicit undo/history policy for agent-applied scene refreshes

The current plan says the agent edit loop should refresh the current project scene while preserving normal undo/history expectations.

The current editor load path works like this:

- `Editor` reloads from `onLoad`
- `applySceneGraphToEditor(...)` calls `useScene.getState().setScene(...)`
- the scene store is wrapped by `zundo`

That means a full host-triggered scene reload can become entangled with the editor's temporal history unless we deliberately define the baseline behavior.

Recommendation:

- choose one explicit policy for agent-applied reloads
- recommended first milestone policy: successful agent apply becomes the new clean baseline for the renderer session
- implement that by clearing temporal history before or during the trusted host refresh path
- document that behavior in the plan and in the mission-console UX notes

### 3. `agents.subscribe(...)` needs a typed event-channel contract, not just method signatures

The current desktop API is invoke-only. The plan adds:

- `getSession(...)`
- `sendMessage(...)`
- `subscribe(...)`

That is the right shape, but the plan should specify:

- shared event channel names
- payload types for session events
- preload cleanup semantics for listeners
- tests for subscribe/unsubscribe lifecycle

Recommendation:

- put event channel constants and event payload unions in `apps/desktop/src/shared/agents.ts`
- expose a cleanup-returning preload subscription helper
- add one test that verifies listener removal on unsubscribe

### 4. Task 1's red-test expectation is slightly outdated

The plan currently assumes recent-project ordering behavior is still missing.

In the current codebase, the store already supports:

- recent-project tracking
- reopen by project ID
- list ordering based on most recently touched project

So the store-level test proposed in Task 1 may already pass.

Recommendation:

- keep the store test because it documents the contract
- update the task language so it does not assume that store behavior is absent
- make the real remaining gap explicit: IPC surface, preload exposure, and renderer shell wiring

## Recommended Plan Changes

1. Narrow the scene-command contract before implementation starts.
2. Add a graph-integrity validator to the planned `@pascal/scene-engine` work.
3. Add an explicit renderer history-reset policy for trusted agent refreshes.
4. Move `agents.*` channel/event typing into the shared desktop contract and test unsubscribe behavior.
5. Adjust Task 1 wording so the persistence layer is not treated as the missing piece when the real gap is the desktop workbench UI/API surface.

## Review Verdict

Approved with changes.

The plan should be tightened in the five areas above before task execution begins.
