---
name: pascal-agent-workbench-design
description: Next Pascal Desktop milestone for desktop workbench UX, a Vesper-inspired CodeMode execution gateway, and the first persistent agent-driven scene editing loop.
---

# Pascal Agent Workbench Design

## Summary

The next Pascal Desktop milestone should turn the current Electron foundation into a real desktop workbench with an always-on agent that can inspect the current project, plan a scene edit, and apply that edit immediately through a typed deterministic command surface.

This milestone is not about full workflow automation or a skill-pack marketplace yet. It is about proving the core product loop:

- open a local Pascal project in a desktop-native shell
- ask the agent for a scoped design change
- let the agent execute through a bounded code-driven surface
- see the scene update immediately
- preserve undo/history and local persistence

## Product Goal

Make Pascal feel like a professional design tool with an embedded operator console.

The user should still experience precision-first manual editing as the primary mode, but the agent should already feel:

- always present
- context-aware
- capable of driving when asked
- precise rather than hand-wavy
- accountable for what it changed

## Chosen User Flow

This milestone optimizes for one end-to-end success path:

1. The user opens Pascal Desktop into a desktop workbench.
2. The user opens an existing project or creates a new one.
3. The user asks the agent for a scoped architectural scene change.
4. The agent reads project and scene context.
5. The agent emits a typed scene command plan through a Vesper-style code execution gateway.
6. The desktop runtime applies the command batch immediately.
7. The mission console reports what changed, why, and what to do next.
8. Undo/history still works and the project persists after reopen.

## Product Direction

### Manual-first, agent-always-ready

Manual editing remains the trusted primary interaction model.

The agent is not a novelty sidebar and not an approval-only assistant. It is an active collaborator that can take over when invited, but it is still governed by the same underlying mutation system as the rest of the product.

### Immediate apply by default

For this milestone, the default posture is immediate apply rather than review-first.

That choice only works if the execution surface is intentionally narrow and typed. The safety model should come from bounded authority, visibility, and undoability, not from forcing a confirmation dialog on every edit.

## Architecture

## Layer model for this milestone

### 1. Desktop shell

`apps/desktop` becomes the real product shell.

Responsibilities:

- recent projects and create/open flows
- project title and save state chrome
- mission console shell
- preload bridge wiring
- trusted access to project persistence
- trusted orchestration of agent execution

### 2. Workspace runtime

The workspace runtime remains host-owned and trusted.

Responsibilities:

- file-backed project lifecycle
- recent-project index
- autosave coordination
- command application orchestration
- persistent per-project agent session lifecycle
- execution logging and status streaming

### 3. Editor runtime

The editor runtime remains the precision-first visual tool surface.

Responsibilities:

- direct manipulation tools
- selection and camera state
- panel UX
- rendering and interaction feedback

It should consume scene updates from the same deterministic command path the agent uses, rather than gaining a second mutation system.

### 4. Agent runtime

The first agent runtime should be narrow but real.

Responsibilities:

- maintain one persistent project-scoped session
- gather scene and project context
- translate natural language into typed scene operations
- execute through a CodeMode-style gateway
- emit status, summaries, and execution traces to the mission console

### 5. Scene engine

`@pascal/scene-engine` becomes the mutation kernel for agent-driven edits.

Responsibilities in this milestone:

- schema ownership
- scene parsing and validation
- deterministic command definitions
- pure command application
- command batching
- command results that are easy to log and summarize

## Vesper Lessons Applied

### Narrative-first console

The mission console should follow the strongest Mission Control lesson from Vesper: lead with meaning, not telemetry.

The dominant reading path should be:

1. what changed
2. why it matters
3. what is already done
4. what the user can do next

Raw tool traces and execution details should remain available, but secondary.

### CodeMode instead of tool sprawl

Pascal should borrow Vesper's CodeMode pattern directly instead of exposing many loose mutation tools to the model.

The model-facing execution surface should be one typed tool such as `pascal_execute`, backed by a generated `pascal` API object in a sandboxed code runner.

That execution surface should:

- collapse many potential operations into one model-facing tool
- support batching inside a single execution
- reduce prompt/tool overhead
- keep the host-side handlers centralized
- make command emission precise and code-driven

### Persistent visible session, ephemeral background runs

Pascal should also borrow Vesper's session continuity model:

- one visible persistent agent session per open project/workbench
- separate ephemeral internal runs for future background jobs such as indexing, validation, or workflow execution

This keeps the visible agent conversation continuous while still allowing background systems later.

### Permission boundaries by capability class

The important Vesper permission lesson is that immediate apply does not mean unlimited authority.

For this milestone:

- scene mutation is allowed through the typed scene command gateway
- project file IO remains host-owned
- destructive project operations remain separately gated
- shell, arbitrary filesystem mutation, and network actions are not part of the design agent surface

## UX Design

## Workbench layout

The desktop app should feel like a workbench, not a bare Electron wrapper around the editor.

### Top app chrome

The top layer should show:

- project name
- save state
- create/open project affordances
- recent-project access
- room for future workspace actions

### Main editor area

The existing editor runtime remains the dominant central surface.

The workbench should not visually subordinate the editor to the chat surface. The mission console supports the editor; it does not replace it.

### Bottom mission console

The bottom mission console is the agent-native layer.

It should be:

- always present
- collapsible
- compact when idle
- expandable for detailed history and traces

It should show:

- agent status: idle, reading, planning, applying, failed
- natural-language summary of the latest change
- changed object count or labels when available
- concise command log
- quick actions such as undo, retry, explain, and refine

## Safety model

Because the default is immediate apply, the safety contract must be explicit:

- the agent may only mutate scene state through typed scene-engine commands
- command batches should be logged as one visible execution unit
- every applied batch should remain undoable through the normal editor history
- execution should surface clear results back into the console

The agent should never directly mutate renderer/editor internals, ad-hoc Zustand state, or raw project files.

## Technical Design

## Desktop shell UX seam

New desktop shell features should sit around the current editor host rather than forcing a rewrite of the editor itself.

The shell should add:

- recent-project listing
- explicit create/open project actions
- project metadata display
- save status surface
- mission console container and layout wiring

## Scene engine command kernel v1

The current scene-engine foundation is document-oriented. This milestone should expand it into a node-level deterministic command surface.

Recommended initial command set:

- `create-node`
- `update-node`
- `delete-node`
- `batch-commands`

The important constraint is not breadth. It is determinism.

Each command should:

- be pure
- validate inputs against schema
- return a new scene document
- produce a result shape that can be summarized in UI

### Command result shape

Command application should return typed execution results that are useful to both UI and agent runtime, such as:

- `applied: true | false`
- `changedNodeIds`
- `createdNodeIds`
- `deletedNodeIds`
- `warnings`
- `nextDocument`

This will let the mission console explain changes without reverse-engineering state diffs later.

## Pascal CodeMode gateway

The agent-facing execution path should be one typed tool, inspired by Vesper's `vesper_execute`.

### Model-facing shape

Example conceptual shape:

```ts
pascal_execute({
  code: `
    const scene = await pascal.scene_read();
    const wall = await pascal.scene_createNode({...});
    await pascal.scene_updateNode({...});
  `
})
```

### Host-side behavior

The desktop runtime should:

- validate code syntax before execution
- run the code in an isolated worker context
- inject a narrow typed `pascal` API proxy
- route tool calls back to trusted main-process handlers
- enforce execution timeout
- capture structured logs and results

### Allowed operations in this milestone

The `pascal` API should stay intentionally small:

- read current project summary
- read current scene document
- apply typed scene command batches
- return execution summaries/results

The first version should not expose arbitrary shell, filesystem, or network operations.

## Agent session lifecycle

Each open project should own one persistent visible agent session.

The session should preserve:

- message history
- current status
- latest summaries
- execution log
- future room for per-project preferences or style guidance

This session should be owned by the desktop workspace runtime, not by the renderer alone.

The renderer should subscribe to session state through the preload bridge.

## Data flow

```text
User request in mission console
  -> desktop agent session runtime
  -> pascal_execute
  -> typed pascal.scene.* handlers
  -> @pascal/scene-engine command application
  -> trusted workspace runtime persists next document
  -> editor host reloads/applies latest scene
  -> mission console receives summary + execution trace
```

## Scope for this milestone

### In scope

- desktop workbench chrome and project UX
- bottom mission console shell
- persistent project-scoped agent session
- Vesper-style typed code execution gateway
- scene-engine node-level deterministic commands
- auto-apply scene edits through the trusted desktop runtime
- visible change summaries and command traces

### Out of scope

- full workflow/skill-pack marketplace
- multi-agent orchestration
- broad tool catalogs
- arbitrary shell/file/network execution for the design agent
- complex approval matrix UX
- background workflow engine beyond the first session/runtime seam

## Verification

Success for this milestone should be demonstrated by the following product checks:

1. Open or create a project from the desktop shell.
2. Ask the agent for a scoped architectural change.
3. The agent reports that it is reading, planning, and applying.
4. The scene changes immediately in the editor.
5. The mission console summarizes what changed.
6. Undo restores the previous state.
7. Reopen the project and verify the change persisted.

## Done Criteria

This milestone is complete when:

- Pascal Desktop feels like a real desktop workbench rather than an Electron wrapper
- the agent is always present through a bottom mission console
- the first agent-driven scene change works end to end
- the agent executes through a Vesper-style typed code gateway
- scene changes flow only through deterministic scene-engine commands
- immediate apply works while staying bounded and undoable
- local persistence remains the source of truth
