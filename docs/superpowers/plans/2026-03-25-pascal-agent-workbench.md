# Pascal Agent Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Electron foundation into a desktop workbench with recent-project UX, a Vesper-style typed `pascal_execute` gateway, and the first persistent agent-driven scene edit loop.

**Architecture:** Keep `apps/desktop` as the trusted desktop shell and workspace runtime, expand `@pascal/scene-engine` into the deterministic mutation kernel, and add a narrow main-process agent runtime that executes typed scene command batches through a CodeMode-style worker. The renderer stays focused on workbench UI plus a bottom mission console, while project persistence and agent execution remain host-owned.

**Tech Stack:** Electron, electron-vite, React 19, Tailwind CSS 4, Bun test, TypeScript 5.9, Node `worker_threads`, `acorn`, `@pascal/scene-engine`

---

## Scope Guard

This plan intentionally covers only the approved agent workbench milestone:

- desktop workbench chrome and recent-project flows
- node-level deterministic scene commands in `@pascal/scene-engine`
- trusted project command application in the desktop main process
- a persistent project-scoped agent session
- a Vesper-style typed `pascal_execute` gateway
- a bottom mission console that drives one real agent edit loop

This plan does **not** include:

- skill-pack/workflow marketplace
- multi-agent orchestration
- arbitrary shell or network tools for the design agent
- broad `@pascal-app/editor` typecheck cleanup
- web-host parity work

## Implementation Notes

- Keep the existing `@pascal-app/editor` package untouched unless a small compatibility change is unavoidable. The current workspace has unrelated editor typecheck debt; the safest path is to build the new behavior around `apps/desktop` and `@pascal/scene-engine`.
- Prefer package-local verification for `apps/desktop` and `@pascal/scene-engine`. Do not claim workspace-wide typecheck is clean unless the existing `@pascal-app/editor` baseline is actually resolved.
- Keep the model-facing execution surface narrow. The agent should only read project/scene state and apply scene command batches in this milestone.
- Treat agent-applied scene refresh as a trusted host event with an explicit history policy. For this milestone, a successful agent apply should become the new clean renderer baseline rather than merging invisibly into an older undo stack.
- Do not rely on `parseSceneGraph(...)` alone for mutation safety. Node-level command execution must also validate parent-child referential integrity and forbid generic mutation of structural fields.

## Planned File Structure

### Desktop shell and project UX

- `apps/desktop/src/shared/projects.ts`
  Expand desktop project IPC contracts with recent-project and project selection APIs
- `apps/desktop/src/main/projects/project-store.ts`
  Add trusted recent-project listing and project lookup helpers
- `apps/desktop/src/main/projects/project-ipc.ts`
  Register desktop shell project IPC for recent/open/create flows
- `apps/desktop/src/preload/index.ts`
  Expose the expanded `projects.*` API
- `apps/desktop/src/renderer/src/app.tsx`
  Mount a workbench shell around the existing editor host
- `apps/desktop/src/renderer/src/components/workbench-shell.tsx`
  Main desktop layout: top chrome, editor region, bottom mission console slot
- `apps/desktop/src/renderer/src/components/project-toolbar.tsx`
  Project title, save state, create/open controls
- `apps/desktop/src/renderer/src/components/recent-project-sheet.tsx`
  Recent-project list and selection surface

### Scene engine command kernel

- `packages/scene-engine/src/commands/scene-command.ts`
  Expand command union with node-level deterministic operations
- `packages/scene-engine/src/commands/scene-command-result.ts`
  Typed result shape for command application
- `packages/scene-engine/src/commands/apply-scene-command.ts`
  Pure command application with batch support
- `packages/scene-engine/src/commands/apply-scene-command.test.ts`
  Deterministic regression tests for create/update/move/delete/batch behavior
- `packages/scene-engine/src/document/assert-scene-graph-integrity.ts`
  Explicit graph-integrity validation for parent-child consistency and root safety
- `packages/scene-engine/src/index.ts`
  Export the new command types and result surface

### Trusted command application in desktop main

- `apps/desktop/src/shared/projects.ts`
  Add typed request/response contracts for scene command batches
- `apps/desktop/src/main/projects/project-command-service.ts`
  Read a project, apply scene-engine commands, persist the next document, and return a typed result
- `apps/desktop/src/main/projects/project-command-service.test.ts`
  Tests for apply/persist/reopen behavior and invalid-command rejection
- `apps/desktop/src/main/projects/project-ipc.ts`
  Register `projects:apply-scene-commands`
- `apps/desktop/src/preload/index.ts`
  Expose `projects.applySceneCommands(...)`

### Agent runtime and CodeMode gateway

- `apps/desktop/package.json`
  Add `acorn` for syntax validation
- `apps/desktop/src/shared/agents.ts`
  Agent session, message, status, event-channel constants, and IPC contract types
- `apps/desktop/src/main/agents/agent-session-store.ts`
  Persist/load one visible agent session per project
- `apps/desktop/src/main/agents/pascal-code-executor.ts`
  Host-side syntax validation, worker spawn, tool routing, timeout enforcement
- `apps/desktop/src/main/agents/pascal-code-executor-worker.ts`
  Worker-side `pascal` proxy and console capture
- `apps/desktop/src/main/agents/agent-session-manager.ts`
  Project-scoped session lifecycle, prompt handling, status updates, and command execution
- `apps/desktop/src/main/agents/agent-ipc.ts`
  Register `agents.*` IPC methods and status subscriptions
- `apps/desktop/src/main/agents/pascal-code-executor.test.ts`
  Tests for AST validation, timeout, tool dispatch, and structured logs
- `apps/desktop/src/main/index.ts`
  Register agent IPC and create the manager once at app boot
- `apps/desktop/src/preload/index.ts`
  Expose `agents.*` APIs and cleanup-safe subscriptions
- `apps/desktop/electron.vite.config.ts`
  Adjust build config if the worker entry needs explicit bundling support

### Mission console renderer

- `apps/desktop/src/renderer/src/components/mission-console.tsx`
  Narrative-first bottom console shell
- `apps/desktop/src/renderer/src/components/mission-console-status.tsx`
  Idle/reading/planning/applying/error header row
- `apps/desktop/src/renderer/src/components/mission-console-log.tsx`
  Summary-first history with expandable trace rows
- `apps/desktop/src/renderer/src/components/mission-console-composer.tsx`
  Prompt entry and quick actions
- `apps/desktop/src/renderer/src/lib/agent-client.ts`
  Renderer-side wrappers for `window.pascalDesktop.agents`
- `apps/desktop/src/renderer/src/app.tsx`
  Wire project loading, mission console state, and agent-driven project refresh
- `apps/desktop/src/renderer/src/vite-env.d.ts`
  Add `agents.*` typing to the preload surface

### Documentation

- `README.md`
  Add environment/setup notes for the mission console and agent runtime

## Task 1: Build the desktop workbench shell and recent-project UX

**Files:**
- Modify: `apps/desktop/src/shared/projects.ts`
- Modify: `apps/desktop/src/main/projects/project-store.ts`
- Modify: `apps/desktop/src/main/projects/project-ipc.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/renderer/src/app.tsx`
- Create: `apps/desktop/src/renderer/src/components/workbench-shell.tsx`
- Create: `apps/desktop/src/renderer/src/components/project-toolbar.tsx`
- Create: `apps/desktop/src/renderer/src/components/recent-project-sheet.tsx`
- Test: `apps/desktop/src/main/projects/project-store.test.ts`

- [ ] **Step 1: Write the failing recent-project tests**

Add tests proving:

```ts
test('lists recent projects with most recently touched project first', async () => {
  const store = createProjectStore({ rootDir })
  const first = await store.createProject({ name: 'First' })
  const second = await store.createProject({ name: 'Second' })
  await store.openProject(first.projectFilePath)

  const recent = await store.listRecentProjects()

  expect(recent.map((project) => project.projectId)).toEqual([first.projectId, second.projectId])
})
```

- [ ] **Step 2: Run the project-store tests to verify the new expectations fail**

Run: `bun test apps/desktop/src/main/projects/project-store.test.ts`
Expected: the new store assertion may already PASS because recent-project ordering exists today; if so, keep it as a contract test and continue because the real missing behavior is still the IPC/preload/renderer workbench flow

- [ ] **Step 3: Expand the trusted project contract**

Add exact IPC-safe contract types to `apps/desktop/src/shared/projects.ts` for:

- `ListRecentProjectsResult`
- `OpenProjectResult`
- `CurrentProjectSummary`

Expose preload/main contracts for:

```ts
listRecent(): Promise<ProjectSummary[]>
open(projectId: ProjectId): Promise<PascalProjectFile>
create(input: CreateProjectInput): Promise<ProjectSummary>
```

- [ ] **Step 4: Implement recent-project listing and selection in the main process**

Update `project-store.ts` and `project-ipc.ts` so the trusted store can:

- list recent projects in last-opened order
- reopen by project ID
- keep the workspace index as the source of truth

- [ ] **Step 5: Build the workbench shell around the editor host**

Create a shell that renders:

- top toolbar with project name and save state
- recent-project launcher
- editor region
- a reserved bottom mission console slot

Keep the editor as the dominant central surface.

- [ ] **Step 6: Run desktop-local verification**

Run: `bun test apps/desktop/src/main/projects/project-store.test.ts`

Run: `cd apps/desktop && bun x tsc --noEmit`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/shared apps/desktop/src/main/projects apps/desktop/src/preload apps/desktop/src/renderer
git commit -m "feat(desktop): add workbench shell and recent projects"
```

## Task 2: Expand `@pascal/scene-engine` into a node-level deterministic command kernel

**Files:**
- Modify: `packages/scene-engine/src/commands/scene-command.ts`
- Create: `packages/scene-engine/src/commands/scene-command-result.ts`
- Modify: `packages/scene-engine/src/commands/apply-scene-command.ts`
- Modify: `packages/scene-engine/src/commands/apply-scene-command.test.ts`
- Create: `packages/scene-engine/src/document/assert-scene-graph-integrity.ts`
- Modify: `packages/scene-engine/src/index.ts`

- [ ] **Step 1: Add failing tests for node-level commands**

Extend `apply-scene-command.test.ts` with tests for:

- `create-node`
- `update-node`
- `move-node`
- `delete-node`
- `batch-commands`

Suggested shape:

```ts
test('creates a node and links it to the requested parent', () => {
  const next = applySceneCommand(scene, {
    type: 'create-node',
    parentId: levelId,
    node: WallNode.parse({ id: 'wall_1', start: [0, 0], end: [3, 0] }),
  })

  expect(next.result.createdNodeIds).toEqual(['wall_1'])
  expect(next.document.nodes.wall_1).toBeDefined()
})
```

- [ ] **Step 2: Run the scene-engine command tests to verify they fail**

Run: `bun test packages/scene-engine/src/commands/apply-scene-command.test.ts`
Expected: FAIL because the node-level command union does not exist yet

- [ ] **Step 3: Define the typed command and result surfaces**

Implement:

```ts
export type SceneCommand =
  | { type: 'replace-scene-document'; document: ParsedSceneGraph }
  | { type: 'clear-scene-document' }
  | { type: 'create-node'; parentId: string | null; node: AnyNode }
  | { type: 'update-node'; nodeId: string; patch: SceneNodePatch }
  | { type: 'move-node'; nodeId: string; nextParentId: string | null }
  | { type: 'delete-node'; nodeId: string }
  | { type: 'batch-commands'; commands: SceneCommand[] }
```

Where `SceneNodePatch` explicitly excludes structural fields:

```ts
type SceneNodePatch = Partial<Omit<AnyNode, 'id' | 'type' | 'parentId' | 'children'>>
```

and a result model with:

- `applied`
- `changedNodeIds`
- `createdNodeIds`
- `deletedNodeIds`
- `warnings`
- `document`

- [ ] **Step 4: Implement pure command application**

Update `apply-scene-command.ts` so it:

- never mutates the input document
- validates the resulting document with `parseSceneGraph`
- validates the full graph with `assertSceneGraphIntegrity(...)`
- rejects generic patch attempts against `id`, `type`, `parentId`, and `children`
- updates parent `children` arrays when creating, moving, or deleting
- composes nested command batches deterministically

- [ ] **Step 5: Re-run scene-engine verification**

Run: `bun test packages/scene-engine/src/commands/apply-scene-command.test.ts`

Run: `cd packages/scene-engine && bun x tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/scene-engine/src/commands packages/scene-engine/src/document packages/scene-engine/src/index.ts
git commit -m "feat(scene-engine): add deterministic node commands"
```

## Task 3: Add trusted project command application in the desktop main process

**Files:**
- Modify: `apps/desktop/src/shared/projects.ts`
- Create: `apps/desktop/src/main/projects/project-command-service.ts`
- Create: `apps/desktop/src/main/projects/project-command-service.test.ts`
- Modify: `apps/desktop/src/main/projects/project-store.ts`
- Modify: `apps/desktop/src/main/projects/project-ipc.ts`
- Modify: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: Write the failing command-service tests**

Add tests for:

- applying a `create-node` batch to a project
- reopening the project and seeing the new scene persisted
- rejecting invalid command batches without writing the file

Suggested shape:

```ts
test('applies scene commands and persists the next project document', async () => {
  const project = await store.createProject({ name: 'Command Test' })
  const result = await service.applySceneCommands(project.projectId, [
    { type: 'create-node', parentId: levelId, node: wallNode },
  ])

  const reopened = await store.openProjectById(project.projectId)

  expect(result.createdNodeIds).toEqual([wallNode.id])
  expect(reopened.scene.nodes[wallNode.id]).toBeDefined()
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `bun test apps/desktop/src/main/projects/project-command-service.test.ts`
Expected: FAIL because the command service and IPC surface do not exist yet

- [ ] **Step 3: Add a trusted command application seam**

Create `project-command-service.ts` that:

- loads the current project document
- applies a `batch-commands` wrapper via `applySceneCommand`
- persists the resulting document atomically
- returns a typed command result payload

- [ ] **Step 4: Expose command application over IPC**

Extend `projects.*` with:

```ts
applySceneCommands(projectId: ProjectId, commands: SceneCommand[]): Promise<ProjectCommandResult>
```

Do not expose arbitrary file paths or raw filesystem writes to the renderer.

- [ ] **Step 5: Verify the trusted command path**

Run: `bun test apps/desktop/src/main/projects/project-store.test.ts apps/desktop/src/main/projects/project-command-service.test.ts`

Run: `cd apps/desktop && bun x tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/shared apps/desktop/src/main/projects apps/desktop/src/preload
git commit -m "feat(desktop): add trusted scene command application"
```

## Task 4: Build the persistent project-scoped agent runtime and `pascal_execute`

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/shared/agents.ts`
- Create: `apps/desktop/src/main/agents/agent-session-store.ts`
- Create: `apps/desktop/src/main/agents/pascal-code-executor.ts`
- Create: `apps/desktop/src/main/agents/pascal-code-executor-worker.ts`
- Create: `apps/desktop/src/main/agents/agent-session-manager.ts`
- Create: `apps/desktop/src/main/agents/agent-ipc.ts`
- Create: `apps/desktop/src/main/agents/pascal-code-executor.test.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/electron.vite.config.ts`

- [ ] **Step 1: Add failing executor tests**

Write tests proving:

- invalid code is rejected before execution
- the worker times out when `_timeoutMs` is exceeded
- a whitelisted `pascal.scene_applyCommands(...)` call routes through the host callback
- console output is captured into structured logs
- subscription listeners can be removed cleanly without duplicate event delivery

Suggested shape:

```ts
test('dispatches scene_applyCommands through the host callbacks', async () => {
  const executor = createPascalCodeExecutor({ sceneApplyCommands: mockHandler })
  const result = await executor.execute({
    code: `await pascal.scene_applyCommands({ projectId: 'project_1', commands: [] })`,
  })

  expect(mockHandler).toHaveBeenCalled()
  expect(result.status).toBe('completed')
})
```

- [ ] **Step 2: Run the executor tests to verify they fail**

Run: `bun test apps/desktop/src/main/agents/pascal-code-executor.test.ts`
Expected: FAIL because the executor and worker do not exist yet

- [ ] **Step 3: Add the narrow typed execution gateway**

Implement a Vesper-style `pascal_execute` host/worker pair with:

- `acorn` syntax validation before execution
- `worker_threads` isolation
- an injected `pascal` proxy with only:
  - `project_read`
  - `scene_read`
  - `scene_applyCommands`
- timeout enforcement
- structured log capture
- shared typed event channels for `agents:*`

- [ ] **Step 4: Add persistent project-scoped session storage**

Create an agent session store that persists one visible session per project with:

- message history
- latest status
- last command execution summary
- expandable execution log rows

Store this beside the trusted desktop workspace data, not in renderer-only state.

- [ ] **Step 5: Wire the main-process session manager and IPC**

Expose a minimal `agents.*` API:

```ts
getSession(projectId: ProjectId): Promise<DesktopAgentSession>
sendMessage(projectId: ProjectId, prompt: string): Promise<DesktopAgentTurnResult>
subscribe(projectId: ProjectId, listener: (event: AgentSessionEvent) => void): () => void
```

The first implementation may use a provider adapter seam internally, but the external contract must stay stable and desktop-owned.

Define the event channel names and payload union in `apps/desktop/src/shared/agents.ts`, and verify preload subscription cleanup so renderer listeners do not leak across project switches.

- [ ] **Step 6: Verify the agent runtime foundation**

Run: `bun test apps/desktop/src/main/agents/pascal-code-executor.test.ts`

Run: `cd apps/desktop && bun x tsc --noEmit`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/package.json apps/desktop/src/shared/agents.ts apps/desktop/src/main/agents apps/desktop/src/main/index.ts apps/desktop/src/preload/index.ts apps/desktop/electron.vite.config.ts
git commit -m "feat(agent): add pascal code execution runtime"
```

## Task 5: Build the mission console and connect the first end-to-end agent edit loop

**Files:**
- Create: `apps/desktop/src/renderer/src/lib/agent-client.ts`
- Create: `apps/desktop/src/renderer/src/components/mission-console.tsx`
- Create: `apps/desktop/src/renderer/src/components/mission-console-status.tsx`
- Create: `apps/desktop/src/renderer/src/components/mission-console-log.tsx`
- Create: `apps/desktop/src/renderer/src/components/mission-console-composer.tsx`
- Modify: `apps/desktop/src/renderer/src/components/workbench-shell.tsx`
- Modify: `apps/desktop/src/renderer/src/app.tsx`
- Modify: `apps/desktop/src/renderer/src/vite-env.d.ts`

- [ ] **Step 1: Add a failing renderer integration test or state-helper test**

If a full component test harness is too heavy, add a pure helper test proving that:

- agent session events fold into a summary-first timeline
- the latest successful scene edit becomes the visible “what changed” row

Suggested helper contract:

```ts
test('promotes the latest completed scene edit into the summary row', () => {
  expect(buildMissionConsoleState(events).headline).toContain('Added 1 wall')
})
```

- [ ] **Step 2: Run the new mission-console test to verify it fails**

Run: `bun test apps/desktop/src/renderer/src/lib/mission-console-state.test.ts`
Expected: FAIL because the renderer-side mission-console state builder does not exist yet

- [ ] **Step 3: Build the narrative-first bottom console**

The console should render:

- status row: idle / reading / planning / applying / failed
- summary-first turn cards
- expandable command trace
- prompt composer
- quick actions: undo, retry, explain, refine

Keep execution traces secondary to the narrative summary.

- [ ] **Step 4: Connect agent turns to trusted project refresh**

When `sendMessage(...)` completes:

- refresh the current project scene from the trusted desktop runtime
- keep the editor mounted on the same project ID
- make the refreshed scene the new renderer baseline by clearing temporal history before or during the trusted reload path
- do not rely on incidental `onLoad` identity changes for correctness; introduce an explicit host-owned refresh or revision path if needed

- [ ] **Step 5: Verify the visible agent edit loop**

Run: `cd apps/desktop && bun x tsc --noEmit`

Run: `cd apps/desktop && bun run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat(agent): add mission console workbench loop"
```

## Task 6: Documentation and milestone verification

**Files:**
- Modify: `README.md`
- Modify: `apps/desktop/package.json` (only if scripts/docs links need cleanup)

- [ ] **Step 1: Add mission-workbench setup notes**

Document:

- required install step
- `bun run desktop:dev`
- where desktop project files live
- where agent session artifacts live
- any required environment variables for the provider adapter

- [ ] **Step 2: Run the milestone verification suite**

Run:

```bash
bun test packages/scene-engine/src/commands/apply-scene-command.test.ts
bun test apps/desktop/src/main/projects/project-store.test.ts apps/desktop/src/main/projects/project-command-service.test.ts
bun test apps/desktop/src/main/agents/pascal-code-executor.test.ts
cd packages/scene-engine && bun x tsc --noEmit
cd packages/core && bun x tsc --build
cd apps/desktop && bun x tsc --noEmit
cd apps/desktop && bun run build
```

Expected:

- all listed tests PASS
- `packages/scene-engine` typecheck PASS
- `packages/core` build PASS
- desktop package typecheck/build PASS

- [ ] **Step 3: Run the desktop smoke manually**

Run: `bun run desktop:dev`

Manual checks:

- desktop shell opens into the workbench
- recent-project UX works
- the mission console is visible
- send one scoped agent prompt
- the agent reports reading/planning/applying
- the scene changes
- undo works
- relaunch preserves the change

- [ ] **Step 4: Commit**

```bash
git add README.md apps/desktop/package.json
git commit -m "docs(desktop): capture agent workbench verification"
```

## Final Verification Gate

Before calling this milestone complete:

- [ ] Desktop workbench chrome replaces the bare editor host
- [ ] Recent-project flows work through trusted main-process APIs
- [ ] `@pascal/scene-engine` owns node-level deterministic commands
- [ ] The desktop main process applies scene command batches and persists the result
- [ ] `pascal_execute` is the narrow model-facing execution surface
- [ ] One persistent agent session exists per open project
- [ ] The mission console is narrative-first, with expandable execution evidence
- [ ] One real agent-driven scene edit works end to end

## Execution Handoff

This plan is designed for direct execution in the current repo without touching the user's unrelated local changes.
