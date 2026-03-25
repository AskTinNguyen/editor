---
name: pascal-desktop-electron-native-design
description: Local-first Electron-native target architecture for Pascal Desktop with precision-first editing and embedded Vesper-style agent workflows.
---

# Pascal Desktop Electron-Native Target Design

## Summary

Pascal should evolve from a web-hosted editor into a local-first Electron desktop application where precision editing remains the primary user experience, while an always-on agent runtime is available for natural-language creation, workflows, skill packs, and guided automation.

The target is not an "AI-first toy editor" and not "Electron as a thin wrapper around Next.js." The target is a desktop-native architectural workspace with:

- precise direct-manipulation tools for architects and designers
- local project files as the source of truth
- a headless scene engine that owns deterministic building mutations
- an embedded agent runtime inspired by Vesper
- a CodeMode-style typed execution gateway for precise, code-driven agent tool use
- background workers for expensive generation, export, indexing, and validation tasks

## Product Direction

### Chosen constraints

- Local-first desktop app
- Electron-primary, web-secondary
- Strong local project system plus background workers
- Manual editing remains primary
- Agents are always present, context-aware, and able to take over when invited

### Product posture

Pascal Desktop should feel like a trustworthy professional design tool first and an agent-native workspace second, while still making agent workflows a first-class architectural capability from day one.

This means:

- architects and designers can continue to work with precise tools and direct manipulation
- AI is not bolted on as chat; it is embedded into the workspace model
- agents can inspect, suggest, generate, automate, and drive workflows
- agent edits remain governed by the same underlying mutation system as manual edits

## Design Goals

- Make Electron the real product shell, not a packaging afterthought
- Replace browser storage assumptions with desktop-native persistence
- Separate scene logic from React/rendering concerns
- Keep manual editing trustworthy and precise
- Add Vesper-style agent workflows, skill packs, and orchestration as first-class runtime layers
- Give agents a compact, typed, code-driven work surface for precise operations
- Run expensive work off the renderer thread
- Support gradual migration from the current codebase

## Non-Goals

- Rebuilding the entire product in one cutover
- Making agents the only primary interaction mode
- Preserving the current package boundaries exactly as they are
- Treating the current Next.js app as the long-term system-of-record shell
- Giving agents a hidden mutation path that bypasses editor safety and undoability

## Target Architecture

## Layer model

### 1. Electron shell

The Electron shell is the desktop trust boundary and platform control plane.

Responsibilities:

- app/window lifecycle
- native menus and shortcuts
- secrets and credentials
- recent projects and workspace bootstrap
- filesystem access
- permission enforcement
- IPC routing
- process orchestration

### 2. Workspace runtime

The workspace runtime owns project-level application behavior that should not live in the renderer and should not be mixed into scene rendering.

Responsibilities:

- local project management
- autosave and crash-safe recovery
- asset catalog and storage
- versions, snapshots, and diffs
- search and indexing
- workflow orchestration
- background job coordination
- skill-pack and workflow installation
- approval and policy state

### 3A. Editor runtime

The editor runtime owns the precision-first experience.

Responsibilities:

- tool state
- selection state
- panels and inspector UI
- floorplan UI
- direct manipulation tools
- view-specific editing UX
- proposal review and accept/reject UX

### 3B. Agent runtime

The agent runtime is a first-class subsystem, not a sidebar feature.

Responsibilities:

- natural-language interaction
- workflow execution
- skill-pack execution
- context assembly
- project and scene inspection
- proposal generation
- permission-aware execution
- CodeMode execution gateway

### 4A. Scene engine

The scene engine is the headless domain kernel of Pascal Desktop.

Responsibilities:

- schema and scene graph
- validation and migrations
- deterministic commands
- geometry/business rules
- constraint handling
- undo/redo-safe mutation application
- command logs and change sets

The scene engine must not depend on DOM, localStorage, IndexedDB, or React Three Fiber assumptions.

### 4B. Render runtime

The render runtime consumes scene-engine state and renders it into 3D and 2D interaction surfaces.

Responsibilities:

- Three / R3F scene rendering
- overlays and guides
- picking and highlighting
- camera and display modes
- renderer-side affordances

### 5. Background workers

Workers handle expensive, asynchronous, and interruptible operations.

Responsibilities:

- thumbnails
- exports
- indexing and search refresh
- validation passes
- AI asset generation
- workflow execution
- long-running batch transforms

## Target process model

### Main process

Owns:

- project files and workspace directories
- secrets and native integrations
- permission decisions
- worker lifecycle
- trusted host-side tool execution

### Preload

Exposes a narrow desktop API to the renderer.

It should provide capabilities such as:

- `projects.*`
- `jobs.*`
- `agents.*`
- `settings.*`
- `dialogs.*`
- event streams for status, progress, and approvals

### Renderer

Owns the visual application:

- editor UI
- agent UI
- review UI
- 2D/3D view composition

It should not become the source of truth for persistence, job execution, or privileged capabilities.

### Agent sandbox / code executor

Agent code execution should run in an isolated execution environment using a Vesper-like model:

- a compact code-mode tool gateway
- generated typed API surface
- host-side handler routing
- explicit timeout controls
- isolated execution with limited authority

### Worker pool

Heavy work should move into workers or utility processes rather than staying in the UI thread.

## Target package split

- `@pascal/scene-engine`
  Schema, scene graph, validation, deterministic commands, geometry/domain rules
- `@pascal/render-runtime`
  Viewer rendering, overlays, picking, render adapters
- `@pascal/editor-runtime`
  Precision tools, floorplan, panels, selection UX
- `@pascal/agent-runtime`
  Chat/workflows, skill packs, CodeMode gateway, approvals, context assembly
- `@pascal/workspace-runtime`
  Projects, autosave, jobs, assets, versions, indexing, orchestration
- `apps/desktop`
  Electron shell, preload, native integrations
- `apps/web`
  Optional web host for marketing, sharing, previews, or lighter future experiences

## Operating Model

## Manual editing path

1. The user interacts with a tool, panel, or direct handle.
2. The editor runtime emits a typed scene command.
3. The scene engine validates and applies the mutation.
4. The render runtime updates 2D/3D views.
5. The workspace runtime persists and records the change as needed.

## Agent-assisted path

1. The user asks in natural language or triggers a workflow/skill pack.
2. The agent runtime gathers context and plans steps.
3. The agent either proposes or executes code-eligible operations.
4. The agent issues the same typed command surface used by manual tools.
5. The scene engine validates and applies the mutation.
6. The workspace runtime records diffs, approvals, and jobs.

## Core rule

Agents must not bypass the scene engine.

Manual tools and agents should converge on one mutation surface so that edits stay:

- auditable
- undoable
- permissionable
- previewable
- consistent

The agent may reason differently, but it should not possess a secret direct-write path into scene state.

## Agent Architecture

## Agent posture

The agent runtime is always present and always context-aware, but it should not displace manual precision work by default.

The product stance is:

- manual editing is primary
- agents are always on
- agents can drive when invited

## CodeMode-inspired execution

Pascal should adopt a Vesper-style CodeMode pattern for precise agent tool use.

Instead of exposing many loose tools directly to the model, Pascal should bundle code-eligible workspace operations behind a compact typed gateway. The agent should be able to write short code against a generated API surface, for example:

- `pascal.scene.createWall(...)`
- `pascal.scene.placeWindowFamily(...)`
- `pascal.assets.generateMaterialBoard(...)`
- `pascal.project.listLevels(...)`
- `pascal.workflow.runSkillPack(...)`
- `pascal.jobs.await(...)`

This gives the model:

- more precision
- less schema noise
- stronger batching ability
- a programmable surface for multi-step operations

This gives the app:

- better permission mediation
- clearer code-eligible vs non-code-eligible boundaries
- easier logging and replay
- safer host-side control

## Agent modes

### Conversation mode

Used for:

- planning
- explanation
- questions
- lightweight individual tool use
- proposal generation

### Pascal CodeMode

Used for:

- exact scene manipulation
- batch edits
- structured generation pipelines
- workflow execution
- multi-step tool chains

CodeMode should be the precision gateway, not the only agent mode.

## Tool packs

The typed API should be pack-aware, similar to Vesper's compact tool families.

Suggested packs:

- `scene`
- `project`
- `assets`
- `workflow`
- `jobs`
- `review`

## Code-eligible vs non-code-eligible actions

### Code-eligible

- scene reads and deterministic writes
- project metadata reads/writes
- asset generation requests
- workflow launches
- job polling
- search/index reads
- review staging

### Not code-eligible

- native file dialogs
- OAuth or browser-based auth flows
- UI-only rendering actions
- operations that block on human input
- permission-escalation prompts themselves

## Safety and Permissions

## User-facing trust ladder

The trust model should be progressive rather than binary.

### Inspect

Agents can:

- read project context
- inspect scene and assets
- analyze issues
- suggest plans

### Propose

Agents can:

- stage scene command patches
- create reviewable change sets
- generate assets or layouts for approval

### Apply

Agents can:

- execute approved code-eligible operations directly
- still only through the shared mutation surface

### Take over

Temporary elevated mode for larger guided operations such as:

- laying out a floor
- refactoring window families
- generating multiple concept variants
- executing a multi-step workflow

Takeover mode should always expose:

- visible progress
- current step
- stop/cancel affordance
- change preview where feasible

## Review model

Agent-generated changes should be easy to:

- inspect
- accept
- reject
- undo
- diff
- replay

Proposal UX is a critical adoption bridge for professional users learning to trust agents gradually.

## Migration Strategy

The migration should be seam-by-seam, not a rewrite.

### Phase 1. Split the scene engine

Refactor the current `core` package into:

- headless scene-engine concerns
- render/runtime-facing concerns

Goal:

- remove React/runtime assumptions from the domain kernel

### Phase 2. Create workspace runtime

Move persistence, assets, job orchestration, indexing, and project services out of editor/runtime-heavy packages.

Goal:

- make local project files and desktop services the source of truth

### Phase 3. Stand up `apps/desktop`

Create the real Electron shell with:

- preload API
- local project directories
- native integrations
- worker management

Goal:

- stop treating the web host as the primary shell

### Phase 4. Embed agent runtime

Add the always-on agent runtime in conversation mode first.

Goal:

- establish context assembly, permissions, workflows, and project inspection

### Phase 5. Add Pascal CodeMode

Add the compact typed gateway for scene/project/workflow operations.

Goal:

- enable precise, programmable agent action with strong safety boundaries

### Phase 6. Route manual tools onto shared command surfaces

Standardize more existing precision tools around typed commands.

Goal:

- converge manual and agent edits on one mutation path

### Phase 7. Extract hotspots

Large orchestration-heavy files such as the floorplan panel should be decomposed as they cross these new seams.

Goal:

- reduce monolithic UI/runtime files and improve maintainability

## Impact On Current Repo

## What stays conceptually useful

- the idea of a thin host app
- packageized viewer/editor/core responsibilities
- the normalized scene graph approach
- shared scene mutation concepts

## What should change

- `core` should stop being both domain kernel and runtime/render helper bucket
- `@pascal-app/editor` should stop being the orchestration catch-all
- browser storage assumptions should stop being the persistence foundation
- agent workflows should move from "future feature" to "first-class runtime layer"

## Immediate Architectural Recommendation

If implementation planning starts next, the first concrete planning effort should focus on:

1. defining the new `scene-engine` boundary
2. defining the desktop project model in `workspace-runtime`
3. defining the renderer/preload/main-process API contract
4. defining the first Pascal CodeMode tool packs and command surfaces

## Open Principles To Preserve During Implementation

- Do not let agents mutate state through a hidden bypass
- Do not keep privileged persistence inside renderer-local browser storage
- Do not collapse agent/runtime/platform responsibilities into one giant editor package
- Do not rebuild everything at once
- Keep the migration compatible with a professional precision-editing workflow from day one
