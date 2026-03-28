---
name: pascal-desktop-ui-inspector-ai-handoff-design
description: Electron-first UI inspector design for Pascal Desktop with scene-aware viewer capture, mission-console handoff, and read-only agent parity tools.
---

# Pascal Desktop UI Inspector AI Handoff Design

## Summary

Pascal Desktop should gain a development-focused UI inspector that helps UI and UX work directly inside the Electron app. The inspector should let a developer click on either desktop UI chrome or the shared editor surface, capture one normalized selection snapshot, and send that same selection to the existing mission-console agent path.

This feature is not a generic browser devtools replacement and not a web-first implementation. It is an Electron-first, desktop-native workflow for inspecting Pascal's live UI, especially the editor and viewer surface, while keeping the existing architecture boundaries intact.

The defining constraint is parity by design:

- one shared snapshot schema
- one shared context builder
- one human handoff path through the existing `sendMessage(...)` flow
- one read-only agent tool path that returns the same underlying selection

## Product Goal

Help Pascal UI and UX development feel tighter, faster, and more precise inside the Electron workbench.

The desired day-to-day loop is:

1. Click `Inspect` in the desktop chrome.
2. Hover or click a UI surface or scene area.
3. See a compact floating panel summarize what was captured.
4. Send the captured context to the mission console with a normal prompt.
5. Let the agent read the same inspector state through read-only tools when needed.

## Chosen Direction

This design locks these decisions:

- Electron-first implementation
- permanent inspector entry point in the desktop chrome
- floating inspector panel rather than a docked sidebar
- full canvas-aware inspection support from v1
- scene semantics as the primary target for canvas captures
- mission console handoff through the existing chat send path
- read-only parity tools with canonical `vesper_ui_*` IDs

## Goals

- Keep the shared editor package reusable and platform-neutral
- Make the inspector feel first-class during desktop UI and scene-tool work
- Capture scene-aware context from the viewer without coupling the viewer to Electron
- Reuse the existing desktop agent send path instead of inventing a second LLM path
- Keep human and agent paths in parity through one shared contract
- Support screenshots as optional evidence without requiring them for basic use

## Non-Goals

- Web rollout in v1
- Production-mode availability in v1
- Persistent inspector history
- Multi-selection capture
- Deep Three.js object introspection as the main capture strategy
- General-purpose browser automation or remote inspection

## Architecture

## Ownership split

### 1. `apps/desktop`

`apps/desktop` owns the inspector as a desktop feature.

Responsibilities:

- permanent inspect button in desktop toolbar
- floating inspector overlay and panel
- inspect mode lifecycle
- main-process inspector state service
- IPC channels and preload bridge
- mission-console handoff
- read-only agent tool bridge
- screenshot capture and byte-cap enforcement

### 2. `packages/editor`

`packages/editor` stays the shared editor runtime and should expose only the minimum seam required for scene-aware inspection.

Responsibilities:

- provide current scene/editor context needed for inspection
- surface selected or hit-tested scene-node information where available
- avoid any Electron, IPC, or agent-runtime dependencies

### 3. `packages/viewer`

Touch `packages/viewer` only if the editor package cannot expose enough information cleanly. The preferred design is to keep scene-aware inspection routed through editor-owned state instead of building a separate Electron-to-viewer coupling.

## User Experience

## Entry point

The top desktop toolbar should gain a permanent `Inspect` control. In development mode this acts as the primary toggle for inspect mode. The feature is desktop-native and should feel like part of the workbench chrome, not a hidden debug shortcut.

## Inspect mode

When inspect mode is active:

- the cursor changes to a crosshair-style affordance
- hover highlighting follows the current target
- inspector chrome is excluded from capture via `data-ui-inspector-chrome="true"`
- `Esc` cancels active inspect mode or drops transient hover state

## Floating panel

The floating panel is the human-facing view of the shared inspector state. It should stay lightweight and close to the work surface.

Recommended v1 actions:

- `Inspect` or `Stop`
- `Send to Agent`
- `Copy Context`
- `Clear`

The panel may collapse to a chip, but it should not depend on the mission console being open to remain usable.

## Capture Model

## One normalized snapshot

All captures should resolve into one `UiInspectorSnapshot` contract, regardless of whether the source began as DOM UI or scene/viewer interaction.

The snapshot should support:

- selector or stable target identifier
- human label
- route or screen identifier
- bounds
- text and HTML excerpts, capped and redacted
- style subset and data attributes, capped and redacted
- component path or source hints when available in dev mode
- screenshot metadata or data URL when enabled
- scene-aware context fields for canvas-origin captures

## Standard UI capture

When the user clicks regular desktop UI, the renderer should capture a DOM-oriented snapshot using:

- stable selector fallback chain
- label extraction
- route identification
- text and markup excerpts
- redaction before storage
- cap enforcement before storage

## Scene-aware canvas capture

Canvas inspection should be semantic-first, not pixel-first.

For viewer-origin captures, the snapshot should prefer:

- selected scene node IDs
- directly hit or hovered node when available
- editor `phase`, `mode`, and active `tool`
- viewer mode and camera context
- viewport bounds
- optional screenshot as supporting evidence
- nearby shell DOM metadata only as secondary context

The design should avoid raw Three.js internals as the primary interface. The durable value is scene meaning, not renderer internals.

## Shared Contract

The feature should introduce one shared inspector module in the desktop shared layer.

Recommended exported types and helpers:

- `UiInspectorMode`
- `UiInspectorSnapshot`
- `UiInspectorState`
- `UiInspectorAttachment`
- `InspectorErrorCode`
- `InspectorError`
- `InspectorResult<T>`
- `buildUiInspectorContextPayload(snapshot, options)`

This shared module must be imported by:

- renderer overlay and panel
- main inspector state service
- preload API types
- desktop send adapter
- agent tool bridge

## State Model

Inspector state should be held in memory in the Electron main process and scoped by `projectId + windowId`.

This stricter scope is preferable to a workspace-only scope because it avoids cross-window leakage when two desktop windows are open on the same or different projects.

Required behaviors:

- captures in one window never overwrite another window's state
- state is cleared when the owning window is destroyed
- snapshot timestamps remain monotonic per scoped record
- no persistence to disk in v1

## Main Flow

1. Renderer enters inspect mode from toolbar action.
2. Renderer hover or click resolves a target.
3. Renderer builds a normalized snapshot.
4. Main process stores the snapshot in the inspector service.
5. Floating panel subscribes to and renders that stored state.
6. `Send to Agent` routes through the existing desktop `sendMessage(...)` path with a hidden `agentContextPrefix`.
7. Agent read-only tools read the same stored state and return typed results.

## Chat Handoff

The inspector must not create a parallel LLM execution path.

Instead, it should extend the existing desktop agent send path so the prompt continues flowing through the current `agents:send-message` pipeline. The handoff should include:

- the user prompt
- hidden `agentContextPrefix`
- optional visible `uiInspectorAttachment`

The attachment is for human readability in the console. The hidden prefix is what guarantees the current selection is available to the model even when the user writes a short prompt.

## Agent Parity Tools

The desktop runtime should expose canonical read-only inspector tools with these IDs:

- `vesper_ui_get_state`
- `vesper_ui_get_selection`
- `vesper_ui_get_context`
- `vesper_ui_capture_screenshot`

Internal callback action names should remain:

- `get_state`
- `get_selection`
- `get_context`
- `capture_screenshot`

These tools must read from the same stored inspector state used by the floating panel and chat handoff. No separate payload assembly path is allowed.

## IPC and Preload

Recommended IPC channels:

- `uiInspector:getState`
- `uiInspector:setMode`
- `uiInspector:setSnapshot`
- `uiInspector:clear`
- `uiInspector:stateChanged`
- `uiInspector:captureScreenshot`
- `uiInspector:sendToChat`

Recommended preload API surface:

- `uiInspectorGetState()`
- `uiInspectorSetMode(mode)`
- `uiInspectorSetSnapshot(snapshot)`
- `uiInspectorClear()`
- `uiInspectorCaptureScreenshot(bounds, scale?, captureContext?)`
- `uiInspectorSendToChat(projectId, prompt, options?)`
- `onUiInspectorStateChanged(callback)`

Renderer code should use the preload API only. It should not call raw IPC directly.

## Security and Redaction

The feature should follow the canonical inspector error taxonomy and cap rules from the shared contract.

Required error codes:

- `NO_SELECTION`
- `CAPTURE_FAILED`
- `SEND_FAILED`
- `TOOL_UNAVAILABLE`
- `PERMISSION_BLOCKED`

Required redaction rules:

- redact `password` and `hidden` input values
- redact secret-like substrings in text excerpts
- strip token-, secret-, password-, API-key-, and authorization-like fields
- avoid serializing unrelated form values outside the selected subtree
- enforce caps before storage and again before model handoff

Required kill switches:

- `uiInspectorEnabled`
- `uiInspectorScreenshotsEnabled`
- `uiInspectorSendToChatEnabled`

## Testing Strategy

The design should be considered complete only when parity and redaction are verified.

Minimum verification expectations:

- naming checks for `vesper_ui_*` IDs pass
- typed error taxonomy is present
- panel selection and agent selection are in parity
- redaction tests cover sensitive inputs and token-like text
- capture to send flow passes through the existing agent path
- state remains isolated by `projectId + windowId`

Manual smoke checks should include:

1. Capture a regular desktop UI element.
2. Capture a viewer or canvas-origin target.
3. Send both through mission console handoff.
4. Call `vesper_ui_get_selection`.
5. Confirm the tool payload matches what the floating panel showed.

## Rollout

V1 rollout should be development-only in the Electron desktop app.

This keeps the scope disciplined while still making the feature immediately useful for UI and UX iteration. Web rollout, production rollout, and richer persistence behaviors should be separate later decisions, not hidden inside this implementation.

## Risks

### Viewer seam ambiguity

The largest implementation risk is discovering that the current editor surface does not expose enough stable scene-target information for semantic-first canvas capture. If that happens, the first response should be a small editor seam, not a direct Electron-to-viewer dependency.

### Payload drift

The second major risk is allowing the floating panel, send-to-chat path, and agent tools to build different payloads. That risk is why the shared snapshot and shared context builder are mandatory parts of the design.

### Screenshot complexity

Screenshot capture can fail for size, crop, or timing reasons. The feature should remain useful with metadata-only capture, so screenshots should be optional and separately kill-switched.

## Implementation Boundary Recommendation

The preferred implementation order after planning:

1. shared inspector contracts and context builder
2. main-process scoped inspector service
3. preload and IPC bridge
4. renderer overlay and floating panel
5. mission-console handoff through existing send path
6. read-only parity tools
7. screenshot refinement and extra edge-case hardening

This order keeps the system testable at each step and reduces the risk of ending with a human-only feature that the agent path cannot read.
