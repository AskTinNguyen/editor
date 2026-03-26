---
name: pascal-target-vs-current-architecture-gap-map
description: Target-vs-current architecture gap map for Pascal Desktop as of 2026-03-26, covering the Electron shell, workspace runtime, editor runtime, agent runtime, scene engine, render runtime, and background workers.
---

# Pascal Desktop — Target vs Current Architecture Gap Map

## Summary

Pascal has made **real foundation progress** toward the target architecture. The repo is no longer only a web-hosted editor with plans for desktop. It now has a working Electron shell, trusted file-backed project persistence, a preload bridge, a desktop workbench wrapper, and an emerging headless `@pascal/scene-engine` command kernel.

The main gap is that the repo is still in the **desktop-foundation stage**, not yet the **embedded-agent-runtime stage**.

Today, the strongest completed moves are:

- `apps/desktop` is a real product shell, not just a packaging idea
- project files are owned by trusted Electron-main services instead of browser-local persistence
- `@pascal/scene-engine` exists as a headless parsing/validation/command boundary
- scene mutations are starting to move through deterministic command application in trusted host code
- the desktop renderer has a workbench shell seam with space reserved for the mission console

The largest missing pieces are:

- no real workspace runtime package yet
- no embedded persistent agent runtime yet
- no CodeMode-style typed execution gateway yet
- no mission console implementation yet
- no worker/job runtime yet
- manual editing still does not consistently route through the same typed command surface used by the new desktop command path

## North-star target

The current target architecture is documented in:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:6`
- `docs/superpowers/specs/2026-03-25-pascal-agent-workbench-design.md:6`

That target is:

- **local-first desktop app**
- **Electron-primary shell**
- **precision-first editor remains primary**
- **embedded always-on agent runtime**
- **shared deterministic scene mutation surface for manual + agent edits**
- **host-owned persistence, permissions, and process orchestration**
- **background workers for heavy jobs**

## Executive gap map

| Layer | Target state | Current state | Gap level | Notes |
|---|---|---|---|---|
| Electron shell | Desktop trust boundary and product shell | Implemented and active | Low | Strong progress |
| Workspace runtime | Host-owned project/jobs/assets/workflow runtime | Partially present inside `apps/desktop/main/projects` | Medium-High | Exists conceptually, not yet extracted as a clear runtime layer |
| Editor runtime | Precision-first runtime using shared mutation surfaces | Existing editor still works and is hosted in desktop | Medium | Editor still appears to save/load through direct scene document callbacks rather than command-first mutation |
| Agent runtime | Persistent project-scoped agent, context-aware, always-on | Not implemented | High | Only workbench placeholder exists |
| Scene engine | Headless schema/validation/deterministic command kernel | Implemented in first useful form | Medium | Good start, but not yet the singular mutation authority for the whole app |
| Render runtime | Dedicated rendering/runtime layer separate from scene engine | Still mostly bundled in existing viewer/editor structure | Medium | Architectural separation exists conceptually more than structurally |
| Background workers | Workerized exports/indexing/validation/generation/workflows | Not implemented | High | No worker pool or job runtime yet |
| Review + permission model | Inspect / propose / apply / take over ladder | Not implemented as product runtime | High | Current system is foundation-first, not trust-ladder-first |
| CodeMode gateway | One typed code-driven execution surface for agent actions | Not implemented | High | Current desktop API is narrow IPC, not model-facing CodeMode |

## Layer-by-layer target vs current

## 1. Electron shell

### Target

The target design makes Electron the real control plane for:

- lifecycle
- filesystem
- secrets
- permissions
- process orchestration
- IPC routing

Reference:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:65`

### Current

This is now materially real:

- app bootstrap exists: `apps/desktop/src/main/index.ts:1`
- project IPC is registered in main: `apps/desktop/src/main/projects/project-ipc.ts:14`
- preload exposes a narrow bridge: `apps/desktop/src/preload/index.ts:4`
- desktop renderer mounts the editor inside a shell: `apps/desktop/src/renderer/src/app.tsx:19`

### Gap

**Status: mostly on track.**

Remaining Electron-shell gaps:

- no native permission system yet
- no secrets/credentials boundary yet
- no worker/process orchestration yet
- no broader capability families such as `jobs.*`, `agents.*`, `settings.*`, `dialogs.*`

### Assessment

This is one of the strongest areas of progress. The repo has already crossed the line from **"Electron as wrapper"** to **"Electron as trusted shell foundation."**

## 2. Workspace runtime

### Target

The target architecture calls for a host-owned workspace runtime responsible for:

- project lifecycle
- autosave and recovery
- versions/snapshots/diffs
- assets and indexing
- workflow orchestration
- background jobs
- approval/policy state

Reference:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:80`

### Current

A partial version of this exists inside the desktop main process project services:

- file-backed project store: `apps/desktop/src/main/projects/project-store.ts:173`
- recent project listing: `apps/desktop/src/main/projects/project-store.ts:260`
- initial bootstrap path: `apps/desktop/src/main/projects/project-bootstrap.ts:1`
- host-side scene command orchestration: `apps/desktop/src/main/projects/project-command-service.ts:22`

### Gap

**Status: partially started, not yet a distinct runtime layer.**

What is present:

- trusted project file lifecycle
- recent-project index
- trusted save/load path
- host-side scene command orchestration

What is missing:

- explicit `@pascal/workspace-runtime` package
- autosave policy coordination beyond basic save path wiring
- crash recovery
- snapshots/version records/diffs
- asset catalog/storage runtime
- indexing/search runtime
- workflow records and lifecycle
- approval/policy persistence
- per-project agent session ownership

### Assessment

The repo has **workspace-runtime-shaped code**, but not yet a clearly extracted workspace runtime.

## 3. Editor runtime

### Target

The editor runtime should remain the precision-first surface for:

- direct manipulation
- selection/camera state
- panels/inspector UX
- proposal review UX

It should converge on the same typed mutation surface as agent-driven edits.

References:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:96`
- `docs/superpowers/specs/2026-03-25-pascal-agent-workbench-design.md:89`

### Current

The existing editor is preserved and hosted inside desktop:

- desktop host renders `<Editor />`: `apps/desktop/src/renderer/src/app.tsx:95`
- current project document is loaded via `onLoad`: `apps/desktop/src/renderer/src/app.tsx:96`
- save is still done through `onSave`: `apps/desktop/src/renderer/src/app.tsx:97`

### Gap

**Status: preserved successfully, but not yet converged onto command-first mutation.**

Strengths:

- manual editing still works in the desktop shell
- current editor remains the dominant surface
- desktop shell does not replace precision editing

Missing convergence:

- the editor is still primarily document-callback-driven rather than command-surface-driven
- there is not yet a clear proposal/review UX layer
- there is not yet a shared command bus used consistently by both manual tools and future agents

### Assessment

This is the right transitional posture, but not yet the final architecture. The editor survives intact, which is good, but it has **not yet been structurally re-routed** onto the new deterministic mutation seam.

## 4. Agent runtime

### Target

The target calls for a first-class agent runtime responsible for:

- natural-language interaction
- project-scoped persistent session
- context assembly
- workflow execution
- permission-aware execution
- command emission through a typed gateway

References:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:110`
- `docs/superpowers/specs/2026-03-25-pascal-agent-workbench-design.md:102`

### Current

Current evidence is limited to workbench shell preparation:

- mission console slot reserved: `apps/desktop/src/renderer/src/components/workbench-shell.tsx:53`
- project toolbar / shell framing exists: `apps/desktop/src/renderer/src/components/workbench-shell.tsx:33`

### Gap

**Status: largely not implemented yet.**

Missing pieces:

- no persistent project-scoped agent session
- no context assembly service
- no prompt/execution/runtime loop
- no mission console UI
- no agent status streaming
- no execution logs or summaries
- no skill/workflow runtime

### Assessment

This is the single largest architectural gap between current repo state and the stated north star.

## 5. Scene engine

### Target

`@pascal/scene-engine` should become the headless domain kernel for:

- schema
- parsing and validation
- migrations
- deterministic commands
- business rules
- undoable mutation application
- command logs / change sets

Reference:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:125`

### Current

Strong progress has landed:

- package entry exports parsing + commands: `packages/scene-engine/src/index.ts:1`
- deterministic command definitions exist: `packages/scene-engine/src/commands/scene-command.ts:12`
- command application exists: `packages/scene-engine/src/commands/apply-scene-command.ts:88`
- graph integrity validation exists: `packages/scene-engine/src/document/assert-scene-graph-integrity.ts:33`

Current command surface includes:

- `replace-scene-document`
- `clear-scene-document`
- `create-node`
- `update-node`
- `move-node`
- `delete-node`
- `batch-commands`

### Gap

**Status: strong foundation, still incomplete as final domain kernel.**

What is already good:

- headless package exists
- command application is pure and deterministic in structure
- structural integrity checks are present
- main-process code is already using it

What is still missing or immature:

- not yet clearly the single mutation authority for the whole product
- no command log/change-set model yet
- limited domain-rule depth beyond graph-structure integrity
- no explicit migration layer yet
- command results are still relatively thin for rich UI/agent summaries
- undo/replay integration is implied rather than fully defined through this layer

### Assessment

This is the strongest architecture seam in flight after the Electron shell. It is the correct kernel to build on.

## 6. Render runtime

### Target

The target architecture separates the render runtime from the scene engine. Rendering should own:

- 2D/3D presentation
- overlays/guides
- camera/display modes
- picking/highlighting
- renderer affordances

Reference:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:141`

### Current

The existing viewer/editor split still carries most of this responsibility conceptually, but there is no extracted `@pascal/render-runtime` package yet.

Current state remains closer to the prior app structure:

- viewer remains presentation-oriented per `CLAUDE.md`
- desktop currently hosts the existing editor stack rather than a newly extracted render-runtime layer

### Gap

**Status: conceptually aligned, structurally incomplete.**

Missing:

- explicit `@pascal/render-runtime`
- hard architectural seam between render-runtime concerns and remaining runtime/editor concerns
- clearer migration of render-facing code out of mixed legacy package boundaries

### Assessment

This is not blocked, but it also is not yet substantially executed as a packaging/runtime move.

## 7. Background workers and jobs

### Target

Heavy work should move into workers for:

- exports
- indexing
- validation passes
- AI generation
- long-running transforms
- workflow execution

Reference:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:153`

### Current

No real worker/job runtime is visible yet.

### Gap

**Status: not started in product terms.**

Missing:

- worker pool
- job records
- queue/retry model
- job progress streams
- cancellation model
- host-side worker lifecycle orchestration

### Assessment

This remains a major future layer, not current architecture reality.

## 8. CodeMode-style execution gateway

### Target

The target design explicitly wants a Vesper-style typed execution gateway where the model writes code against a narrow API surface rather than calling many loose tools.

References:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:291`
- `docs/superpowers/specs/2026-03-25-pascal-agent-workbench-design.md:275`

### Current

The repo currently has a **desktop IPC API**, not a **model-facing CodeMode gateway**.

Current narrow APIs:

- `projects.getInitialProject()`: `apps/desktop/src/shared/projects.ts:47`
- `projects.create(...)`: `apps/desktop/src/shared/projects.ts:48`
- `projects.open(...)`: `apps/desktop/src/shared/projects.ts:49`
- `projects.saveScene(...)`: `apps/desktop/src/shared/projects.ts:50`
- `projects.listRecent()`: `apps/desktop/src/shared/projects.ts:51`
- `projects.applySceneCommands(...)`: `apps/desktop/src/shared/projects.ts:52`

### Gap

**Status: foundational prerequisite exists, but CodeMode itself does not.**

What is present:

- narrow host-owned typed API for project operations
- trusted scene command application endpoint

What is missing:

- sandboxed code executor
- generated typed `pascal` API surface
- model-facing single execution tool such as `pascal_execute`
- timeout / logging / execution trace surface
- agent-specific capability mediation

### Assessment

The current IPC API is the right substrate, but it is still **host plumbing**, not the agent execution layer described in the target design.

## 9. Permissions, approvals, and review model

### Target

The target trust ladder is:

- inspect
- propose
- apply
- take over

And agent changes should be:

- inspectable
- undoable
- previewable
- permissionable
- reviewable

Reference:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:375`

### Current

Current state is still foundation-first:

- host-owned mutation path exists
- command batches can be applied through trusted main-process code: `apps/desktop/src/main/projects/project-ipc.ts:33`
- batch application is fail-or-rollback in command service: `apps/desktop/src/main/projects/project-command-service.ts:34`

### Gap

**Status: trust infrastructure is embryonic, not productized.**

Missing:

- permission modes in product UX
- review-first proposals
- change preview UX
- execution summaries in the desktop UI
- audit trail / replay surface
- visible takeover flow with progress + stop/cancel affordances

### Assessment

The current system has the beginnings of **bounded mutation plumbing**, but not yet the **user-facing trust ladder** that the architecture calls for.

## 10. Manual tools and agent tools converging on one mutation surface

### Target

One of the clearest target principles is:

> Agents must not bypass the scene engine.

And manual tools should converge on that same typed command surface.

Reference:

- `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md:265`

### Current

The new desktop command path already exists:

- trusted command endpoint: `apps/desktop/src/main/projects/project-ipc.ts:33`
- host-side command orchestration: `apps/desktop/src/main/projects/project-command-service.ts:22`
- scene-engine command application: `packages/scene-engine/src/commands/apply-scene-command.ts:88`

But the editor host still uses document load/save callbacks:

- `apps/desktop/src/renderer/src/app.tsx:96`
- `apps/desktop/src/renderer/src/app.tsx:97`

### Gap

**Status: principle established, convergence incomplete.**

Missing:

- manual tool mutations routing through `SceneCommand` surfaces
- consistent undo/history semantics centered on the command layer
- explicit change summaries and command logs surfaced in UI

### Assessment

This is the most important medium-term architecture gap after agent runtime. The repo has the new mutation seam, but the whole product has not yet been moved onto it.

## What is actually ahead of plan

A few things have already progressed well relative to a normal first foundation milestone:

1. **The desktop shell is real, not speculative**
2. **Recent-project flows exist**
3. **Scene command application already exists in trusted main-process code**
4. **The workbench shell seam is present, including reserved mission-console space**
5. **Graph-integrity validation exists inside scene-engine**

These are meaningful advances, not superficial scaffolding.

## What is still the biggest architecture risk

The biggest risk is **ending up with two mutation worlds**:

- legacy editor-local/document-local mutation behavior
- new scene-engine/desktop-command mutation behavior

If the repo does not converge those paths, the future embedded-agent runtime will either:

- bypass the real editor flow, or
- force the product to maintain two inconsistent mutation systems

That would directly violate the stated architecture principles.

## Recommended next architectural priorities

### Priority 1 — make the command surface the real mutation seam

Focus:

- route more manual editor actions through `SceneCommand`
- strengthen command results for UI summaries and undoability
- treat scene-engine as the authoritative mutation kernel

Why first:

- this is the foundation required before agent edits can be trustworthy

### Priority 2 — extract a real workspace runtime boundary

Focus:

- formalize project lifecycle, autosave, versions, recents, and command orchestration
- stop leaving this as implicit code inside `apps/desktop/main/projects`

Why:

- the host runtime will own project-scoped agent sessions, jobs, and policy later

### Priority 3 — ship the mission console shell as a real product surface

Focus:

- idle/reading/planning/applying/failed states
- narrative summaries first, traces second
- basic execution history surface

Why:

- this is the visible bridge from desktop foundation to embedded agent workbench

### Priority 4 — add the first persistent agent runtime and typed execution gateway

Focus:

- one visible project-scoped session
- one narrow execution surface
- no arbitrary shell/file/network authority
- scene/project reads + scene command application only

Why:

- this proves the core embedded-agent product loop without overexpanding scope

### Priority 5 — introduce worker/job seams only after the above loop is stable

Focus:

- long-running validation/export/indexing/generation tasks
- host-owned job lifecycle + progress streaming

Why:

- workers are valuable, but they are not the immediate blocker to proving the agent-native workbench loop

## Final assessment

## Current repo stage

**Current stage:** _desktop foundation with emerging command kernel_

## Target repo stage

**Target stage:** _precision-first desktop workbench with embedded agent runtime and one shared deterministic mutation surface_

## Overall gap judgment

The repo is **on the right path** and has already completed much of the hardest foundational work for the first milestone.

However, it is still **well short of the full target architecture** because the following core north-star layers are not yet live:

- workspace runtime as a distinct system
- persistent agent runtime
- mission console
- CodeMode execution gateway
- worker/job runtime
- full mutation-surface convergence between manual and agent editing

## Short version

Pascal has successfully started becoming a **desktop-native architecture**.

It has **not yet become an embedded-agent architecture**.

The next major leap is not “more shell polish.” The next major leap is:

**making the scene command surface the true shared mutation kernel, then layering the first real agent runtime and mission console on top of it.**
