# Pascal Workbench — Wave A: Close the Milestone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining gaps in the Pascal Agent Workbench milestone so it passes all verification gates including a real end-to-end agent-driven scene edit loop.

**Architecture:** All changes stay within `apps/desktop` and the existing `@pascal/scene-engine` contracts. No new packages, no LLM integration, no scope expansion.

**Tech Stack:** Electron, electron-vite, React 19, Tailwind CSS 4, Bun test, TypeScript 5.9, `@pascal/scene-engine`

---

## Scope Guard

This plan covers only the remaining gaps within the approved agent workbench milestone:

- fix `vite-env.d.ts` agents typing
- wire agent-driven project refresh in `app.tsx`
- implement undo/history-reset policy for agent-applied refreshes
- adjust `electron.vite.config.ts` for worker bundling
- verify `desktop:build`

This plan does **not** include:

- LLM provider integration
- new scene commands or node types
- skill-pack/workflow marketplace
- multi-agent orchestration
- broad `@pascal-app/editor` typecheck cleanup

---

## Current State

- 42 tests pass across 4 test files
- Desktop typecheck and scene-engine typecheck are clean
- 5 commits on main covering Tasks 1-5

## File Ownership

### Task A1: Fix vite-env.d.ts agents typing

Owns only:
- `apps/desktop/src/renderer/src/vite-env.d.ts`

### Task A2: Wire agent-driven project refresh

Owns only:
- `apps/desktop/src/renderer/src/app.tsx`

### Task A3: Adjust electron.vite.config.ts for worker bundling

Owns only:
- `apps/desktop/electron.vite.config.ts`

### Task A4: Verify desktop:build

Owns nothing — verification only.

---

## Task A1: Fix vite-env.d.ts agents typing

**Files:**
- Modify: `apps/desktop/src/renderer/src/vite-env.d.ts`

- [ ] **Step 1: Update the Window type declaration**

The current `vite-env.d.ts` only declares `projects` on `PascalDesktopApi`. Update it so the `Window.pascalDesktop` type includes `agents` from the shared contract.

The import should reference `PascalDesktopApi` from `../../shared/projects.ts` which already includes the `agents` field (added in commit `a95d71a`).

Verify:
```bash
cd apps/desktop && bun x tsc --noEmit
```

---

## Task A2: Wire agent-driven project refresh in app.tsx

**Files:**
- Modify: `apps/desktop/src/renderer/src/app.tsx`

- [ ] **Step 1: Add a scene revision counter or refresh key**

Add a `sceneRevision` state (number, starting at 0) to `App`. When an agent turn completes with scene commands applied, increment this counter.

- [ ] **Step 2: Subscribe to agent turn completion**

After `sendMessage` returns in the mission console, the `useAgentSession` hook already updates session state. The `App` component needs to react to successful agent turns that applied scene commands.

Add a callback prop or effect that detects when `session.lastTurnResult?.sceneCommandsApplied > 0` and triggers a project reload.

- [ ] **Step 3: Reload project scene from trusted desktop runtime**

When the revision counter changes:
- call `window.pascalDesktop.projects.open(currentProject.projectId)` to get the fresh scene from disk
- update `currentProject` state with the new scene
- pass the fresh scene to `Editor` via `onLoad`

- [ ] **Step 4: Implement history-reset policy**

The plan review recommends: successful agent apply becomes the new clean baseline for the renderer session. Since the `Editor` component uses `key={projectId}` for remounting, the simplest approach is to use `key={projectId + '_' + sceneRevision}` on the `Editor` component so it remounts with the fresh scene, clearing Zundo temporal history.

Verify:
```bash
cd apps/desktop && bun x tsc --noEmit
```

---

## Task A3: Adjust electron.vite.config.ts for worker bundling

**Files:**
- Modify: `apps/desktop/electron.vite.config.ts`

- [ ] **Step 1: Check if the worker resolves correctly in dev mode**

The executor uses `new URL('./pascal-code-executor-worker.ts', import.meta.url).href` to resolve the worker path. In Bun's test runner this works because Bun handles TypeScript natively. In electron-vite's production build, the worker file needs to be included.

- [ ] **Step 2: Add the worker as a separate build entry if needed**

If electron-vite doesn't bundle the worker automatically via the URL import, add it as an additional entry in the main process build config:

```ts
main: {
  plugins: [externalizeDepsPlugin()],
  build: {
    outDir: 'dist/main',
    rollupOptions: {
      input: {
        index: 'src/main/index.ts',
        'pascal-code-executor-worker': 'src/main/agents/pascal-code-executor-worker.ts',
      },
    },
  },
},
```

Verify:
```bash
cd apps/desktop && bun run build
```

---

## Task A4: Verify desktop:build

- [ ] **Step 1: Run the full build**

```bash
cd apps/desktop && bun run build
```

Expected: exits 0 with no errors.

- [ ] **Step 2: Run the full test suite**

```bash
bun test packages/scene-engine/src/commands/apply-scene-command.test.ts
bun test apps/desktop/src/main/projects/project-store.test.ts apps/desktop/src/main/projects/project-command-service.test.ts
bun test apps/desktop/src/main/agents/pascal-code-executor.test.ts
cd packages/scene-engine && bun x tsc --noEmit
cd apps/desktop && bun x tsc --noEmit
```

Expected: 42+ tests pass, both typechecks clean.

---

## Expected Commits

- `fix(desktop): update vite-env with agents typing and wire agent refresh`
- `fix(desktop): adjust electron-vite config for worker bundling`

## Completion Handoff

When this wave is complete:

- [ ] Desktop workbench chrome replaces the bare editor host
- [ ] Recent-project flows work through trusted main-process APIs
- [ ] `@pascal/scene-engine` owns node-level deterministic commands
- [ ] The desktop main process applies scene command batches and persists the result
- [ ] `pascal_execute` is the narrow model-facing execution surface
- [ ] One persistent agent session exists per open project
- [ ] The mission console is narrative-first, with expandable execution evidence
- [ ] Agent-driven scene edit refreshes the editor with history-reset policy
- [ ] Production build compiles cleanly
