# Host-Controlled Workbench Foundation Parallel Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach the next safe completion stage for Pascal Desktop by shipping the desktop workbench shell, trusted recent-project flows, deterministic scene commands, and the trusted main-process command application seam.

**Architecture:** Split the work into one coordinator lane plus independent worker lanes with disjoint write scopes. Wave 1 builds the desktop host contracts, renderer shell, and scene-engine mutation kernel in parallel; Wave 2 lands the trusted `applySceneCommands(...)` seam after the earlier slices are integrated.

**Tech Stack:** Electron, electron-vite, React 19, Tailwind CSS 4, Bun test, TypeScript 5.9, Node main/preload IPC, `@pascal/scene-engine`

---

## Stage Boundary

This plan ends at the **Host-Controlled Workbench Foundation** checkpoint.

At completion, we should have:

- desktop-native workbench chrome around the editor
- recent-project create/open/list flows owned by Electron main
- deterministic scene commands in `@pascal/scene-engine`
- trusted `projects.applySceneCommands(...)` persistence in the desktop main process
- targeted package-local tests and typechecks passing

This stage intentionally does **not** include:

- agent runtime
- `pascal_execute`
- mission console UI
- provider integration
- multi-agent orchestration inside the product

## Parallelization Rules

- Use separate git worktrees or isolated agent workspaces for every worker.
- Do not let two workers own the same file in the same wave.
- Every worker must assume they are not alone in the codebase and must not revert the work of other agents.
- The coordinator integrates Wave 1 before launching Wave 2.
- The coordinator owns final verification.

## File Ownership by Wave

### Wave 1

#### Worker A: Desktop host contract and recent-project APIs

Owns only:

- `apps/desktop/src/shared/projects.ts`
- `apps/desktop/src/main/projects/project-store.ts`
- `apps/desktop/src/main/projects/project-store.test.ts`
- `apps/desktop/src/main/projects/project-ipc.ts`
- `apps/desktop/src/preload/index.ts`

#### Worker B: Desktop renderer workbench shell

Owns only:

- `apps/desktop/src/renderer/src/app.tsx`
- `apps/desktop/src/renderer/src/components/workbench-shell.tsx`
- `apps/desktop/src/renderer/src/components/project-toolbar.tsx`
- `apps/desktop/src/renderer/src/components/recent-project-sheet.tsx`
- `apps/desktop/src/renderer/src/vite-env.d.ts` if needed for renderer-only typing

#### Worker C: Scene-engine deterministic command kernel

Owns only:

- `packages/scene-engine/src/commands/scene-command.ts`
- `packages/scene-engine/src/commands/scene-command-result.ts`
- `packages/scene-engine/src/commands/apply-scene-command.ts`
- `packages/scene-engine/src/commands/apply-scene-command.test.ts`
- `packages/scene-engine/src/document/assert-scene-graph-integrity.ts`
- `packages/scene-engine/src/index.ts`

### Wave 2

#### Worker D: Trusted command application in desktop main

Owns only:

- `apps/desktop/src/main/projects/project-command-service.ts`
- `apps/desktop/src/main/projects/project-command-service.test.ts`
- `apps/desktop/src/shared/projects.ts`
- `apps/desktop/src/main/projects/project-ipc.ts`
- `apps/desktop/src/preload/index.ts`

Wave 2 starts only after Wave 1 is integrated because Worker D depends on the scene-command kernel and the desktop project contract.

## Coordinator Checklist

### Task 1: Baseline and branch hygiene

**Files:**
- None

- [ ] **Step 1: Capture baseline repo state**

Run:

```bash
git status --short
```

Expected:

- unrelated local user changes may exist
- do not revert them

- [ ] **Step 2: Capture current verification baseline**

Run:

```bash
bun test apps/desktop/src/main/projects/project-store.test.ts
bun test packages/scene-engine/src/commands/apply-scene-command.test.ts
cd apps/desktop && bun x tsc --noEmit
cd packages/scene-engine && bun x tsc --noEmit
```

Expected:

- record what already passes before implementation starts
- use this to avoid treating existing behavior as newly added behavior

- [ ] **Step 3: Create one worktree per worker lane**

Suggested worktree names:

- `../editor-foundation-host`
- `../editor-foundation-renderer`
- `../editor-foundation-scene`
- `../editor-foundation-command`

- [ ] **Step 4: Dispatch Wave 1 workers**

Launch Workers A, B, and C in parallel using the prompts below.

- [ ] **Step 5: Integrate Wave 1**

After all Wave 1 workers return:

- review summaries
- merge or cherry-pick carefully
- resolve any type-level drift
- run the Wave 1 verification gate

- [ ] **Step 6: Dispatch Wave 2**

Launch Worker D only after Wave 1 passes.

- [ ] **Step 7: Run final stage verification**

Run the final commands in the Verification Gate section.

## Wave 1 Verification Gate

Run:

```bash
bun test apps/desktop/src/main/projects/project-store.test.ts
bun test packages/scene-engine/src/commands/apply-scene-command.test.ts
cd apps/desktop && bun x tsc --noEmit
cd packages/scene-engine && bun x tsc --noEmit
```

Expected:

- Worker A store tests PASS
- Worker C command tests PASS
- desktop typecheck PASS
- scene-engine typecheck PASS

## Final Stage Verification Gate

Run:

```bash
bun test apps/desktop/src/main/projects/project-store.test.ts apps/desktop/src/main/projects/project-command-service.test.ts
bun test packages/scene-engine/src/commands/apply-scene-command.test.ts
cd apps/desktop && bun x tsc --noEmit
cd packages/scene-engine && bun x tsc --noEmit
```

Manual smoke:

```bash
cd apps/desktop && bun run dev
```

Check:

- workbench shell is visible
- project toolbar is visible
- recent-project UX works
- editor still loads the active project
- trusted command application tests cover persistence and invalid-command rejection

## Agent Initiation Prompts

### Worker A Prompt: Desktop host contract and recent-project APIs

```text
You are Worker A on the Pascal Desktop Host-Controlled Workbench Foundation stage.

You are not alone in the codebase. Other workers are making changes in parallel. Do not revert their work. Stay strictly within your owned files and adjust to upstream changes if needed.

Your ownership:
- apps/desktop/src/shared/projects.ts
- apps/desktop/src/main/projects/project-store.ts
- apps/desktop/src/main/projects/project-store.test.ts
- apps/desktop/src/main/projects/project-ipc.ts
- apps/desktop/src/preload/index.ts

Goal:
- finish the trusted desktop project contract for recent-project flows
- expose recent-project APIs through Electron main and preload
- keep the renderer-facing surface projectId-based and host-owned

Important context:
- recent-project ordering likely already exists in project-store.ts
- the missing work is making that contract explicit and wiring it cleanly through IPC/preload
- do not add agent runtime APIs
- do not edit renderer component files

Required behavior:
1. add or update tests in project-store.test.ts for:
   - recent project ordering
   - reopen by project ID
2. update shared/projects.ts with typed result/request shapes for:
   - listRecent()
   - open(projectId)
   - create(input)
3. update project-ipc.ts and preload/index.ts to expose listRecent cleanly
4. keep file paths hidden from renderer callers

Verification:
- bun test apps/desktop/src/main/projects/project-store.test.ts
- cd apps/desktop && bun x tsc --noEmit

Commit message:
- feat(desktop): add trusted recent-project desktop apis

Return:
- short summary of what changed
- exact verification commands run
- any follow-up integration notes for the coordinator
```

### Worker B Prompt: Desktop renderer workbench shell

```text
You are Worker B on the Pascal Desktop Host-Controlled Workbench Foundation stage.

You are not alone in the codebase. Other workers are making changes in parallel. Do not revert their work. Stay strictly within your owned files and adjust to upstream changes if needed.

Your ownership:
- apps/desktop/src/renderer/src/app.tsx
- apps/desktop/src/renderer/src/components/workbench-shell.tsx
- apps/desktop/src/renderer/src/components/project-toolbar.tsx
- apps/desktop/src/renderer/src/components/recent-project-sheet.tsx
- apps/desktop/src/renderer/src/vite-env.d.ts if needed

Goal:
- wrap the editor in a desktop-native workbench shell
- add top chrome for project title and project actions
- reserve a bottom slot for the future mission console

Important context:
- keep the editor as the dominant central surface
- do not build the mission console yet
- prefer using already-exposed project APIs only
- if listRecent is not yet available in your workspace, create the shell so the integration path is obvious and easy for the coordinator to finish

Required behavior:
1. keep the current loading/error states intact or improved
2. create a workbench shell component that supports:
   - top toolbar
   - central editor region
   - bottom reserved slot
3. create project-toolbar.tsx for project name, save state indicator, and open/create affordances
4. create recent-project-sheet.tsx for recent project selection UI
5. wire app.tsx so project switching still keeps the editor mounted correctly by projectId

Verification:
- cd apps/desktop && bun x tsc --noEmit

Manual note:
- if you can run the desktop app locally in your workspace, do a brief smoke and report what you saw

Commit message:
- feat(desktop): add workbench shell chrome

Return:
- short summary of what changed
- exact verification commands run
- any API expectations the coordinator should confirm when integrating
```

### Worker C Prompt: Scene-engine deterministic command kernel

```text
You are Worker C on the Pascal Desktop Host-Controlled Workbench Foundation stage.

You are not alone in the codebase. Other workers are making changes in parallel. Do not revert their work. Stay strictly within your owned files and adjust to upstream changes if needed.

Your ownership:
- packages/scene-engine/src/commands/scene-command.ts
- packages/scene-engine/src/commands/scene-command-result.ts
- packages/scene-engine/src/commands/apply-scene-command.ts
- packages/scene-engine/src/commands/apply-scene-command.test.ts
- packages/scene-engine/src/document/assert-scene-graph-integrity.ts
- packages/scene-engine/src/index.ts

Goal:
- turn @pascal/scene-engine into the deterministic mutation kernel for trusted desktop edits

Important constraints:
- do not use Partial<AnyNode> as a generic structural mutation tool
- add move-node as a separate command
- forbid generic patch mutation of id, type, parentId, and children
- validate both parseSceneGraph(...) and explicit graph integrity

Required behavior:
1. extend tests first for:
   - create-node
   - update-node
   - move-node
   - delete-node
   - batch-commands
   - invalid graph cases
2. add SceneNodePatch that excludes structural fields
3. add scene-command-result.ts
4. add assert-scene-graph-integrity.ts
5. implement applySceneCommand(...) so it:
   - never mutates input
   - updates parent-child relationships deterministically
   - validates the final graph before returning success

Verification:
- bun test packages/scene-engine/src/commands/apply-scene-command.test.ts
- cd packages/scene-engine && bun x tsc --noEmit

Commit message:
- feat(scene-engine): add deterministic node commands

Return:
- short summary of what changed
- exact verification commands run
- any contract details Worker D must honor
```

### Worker D Prompt: Trusted project command application

```text
You are Worker D on the Pascal Desktop Host-Controlled Workbench Foundation stage.

You are not alone in the codebase. Other workers are making changes in parallel. Do not revert their work. Adjust to the integrated Wave 1 changes before editing.

This worker starts only after Wave 1 is integrated.

Your ownership:
- apps/desktop/src/main/projects/project-command-service.ts
- apps/desktop/src/main/projects/project-command-service.test.ts
- apps/desktop/src/shared/projects.ts
- apps/desktop/src/main/projects/project-ipc.ts
- apps/desktop/src/preload/index.ts

Goal:
- add the trusted Electron-main seam that applies scene commands and persists the next project document

Dependencies you should expect:
- recent-project desktop API already exists
- deterministic scene commands already exist in @pascal/scene-engine

Required behavior:
1. write failing tests in project-command-service.test.ts for:
   - create-node batch persists to disk
   - reopened project sees the new scene
   - invalid commands do not write the file
2. create project-command-service.ts
3. expose projects.applySceneCommands(projectId, commands) through shared contract, IPC, and preload
4. keep all filesystem access in Electron main only
5. return a typed command result payload to the renderer caller

Verification:
- bun test apps/desktop/src/main/projects/project-store.test.ts apps/desktop/src/main/projects/project-command-service.test.ts
- cd apps/desktop && bun x tsc --noEmit
- bun test packages/scene-engine/src/commands/apply-scene-command.test.ts

Commit message:
- feat(desktop): add trusted scene command application

Return:
- short summary of what changed
- exact verification commands run
- any remaining blocker before agent runtime work can begin
```

### Coordinator Prompt: Integration and verification

```text
You are the coordinator for the Host-Controlled Workbench Foundation stage.

You do not own a feature slice. Your job is to:
- dispatch Wave 1 workers in parallel
- review and integrate their results
- run the Wave 1 verification gate
- dispatch Wave 2
- run the final stage verification gate
- report whether the stage boundary is complete

Important rules:
- do not overwrite worker changes casually
- prefer integration fixes over rewrites
- if two workers drift on the shared contract, make the smallest unifying change
- keep the stage boundary strict: no agent runtime work yet

Definition of done:
- workbench shell exists
- recent-project desktop APIs are trusted and typed
- scene-engine deterministic commands exist with graph integrity checks
- trusted applySceneCommands path persists valid edits and rejects invalid ones
- targeted tests and typechecks pass
```

## Recommended Launch Order

1. Coordinator captures baseline and creates worktrees.
2. Launch Worker A, Worker B, and Worker C in parallel.
3. Integrate Wave 1 and run the Wave 1 Verification Gate.
4. Launch Worker D.
5. Run the Final Stage Verification Gate.
6. If green, mark the Host-Controlled Workbench Foundation stage complete.

## Expected Commits

- `feat(desktop): add trusted recent-project desktop apis`
- `feat(desktop): add workbench shell chrome`
- `feat(scene-engine): add deterministic node commands`
- `feat(desktop): add trusted scene command application`

## Completion Handoff

When this stage is complete, the next implementation doc should start at:

- desktop agent session types and event channels
- `pascal_execute` host/worker runtime
- first mission console renderer
- explicit editor refresh and history-baseline integration after trusted host applies
