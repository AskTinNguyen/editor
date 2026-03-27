# docs/ — Superpowers Documentation Index

## Purpose

This directory contains implementation plans, design specs, and architectural reviews for the Pascal Desktop evolution — from web-hosted editor to local-first Electron desktop application with embedded agent workflows. All artifacts live under `docs/superpowers/`.

---

## Implementation Plans

| File | Summary | Status |
|---|---|---|
| `plans/2026-03-25-pascal-desktop-foundation.md` | Electron shell, local project persistence, first `@pascal/scene-engine` boundary | Done |
| `plans/2026-03-25-pascal-agent-workbench.md` | Workbench UX, deterministic command kernel, agent runtime, CodeMode gateway, mission console | In progress |
| `plans/2026-03-25-host-controlled-workbench-foundation-parallel.md` | Parallel execution plan for workbench shell, recent-project flows, and trusted command application seam | Done |
| `plans/2026-03-26-pascal-workbench-wave-a-close-milestone.md` | Close remaining gaps: agent-driven refresh wiring, undo/history policy, worker bundling, build verification | In progress |

## Design Specs

| File | Summary |
|---|---|
| `specs/2026-03-25-pascal-desktop-electron-native-design.md` | Target architecture for local-first Electron desktop with precision editing and embedded Vesper-style agent workflows |
| `specs/2026-03-25-pascal-agent-workbench-design.md` | Next milestone design: desktop workbench with always-on agent, typed `pascal_execute` gateway, and immediate-apply loop |

## Architectural Reviews

| File | Summary |
|---|---|
| `reviews/2026-03-25-pascal-agent-workbench-plan-review.md` | Review of agent workbench plan — flags mutation contract risks, history policy gaps, and event-channel contract needs |
| `reviews/2026-03-26-pascal-target-vs-current-architecture-gap-map.md` | Layer-by-layer gap analysis between target architecture and current state across all runtime layers |

---

## Current Status (as of 2026-03-26)

**Done:**
- Desktop foundation — Electron shell is a real product shell with window lifecycle and IPC routing
- `@pascal/scene-engine` package — headless schema, document parsing/validation, deterministic command kernel
- Workbench shell — desktop-native chrome around the editor with space reserved for mission console
- Trusted project persistence — file-backed project store owned by Electron main, not browser localStorage
- Recent-project flows — create/open/list owned by trusted main process
- Trusted command application — `projects.applySceneCommands(...)` seam in desktop main process

**In progress:**
- Command kernel as the real mutation seam — scene-engine commands exist but are not yet the singular mutation authority for both manual and agent edits
- Agent-driven project refresh wiring and undo/history-reset policy
- Worker bundling and desktop build verification

**Pending:**
- Agent runtime — persistent project-scoped agent with CodeMode-style typed execution gateway
- Mission console — narrative-first UI for agent status, execution logs, and scene change reporting
- Workspace runtime extraction — project/jobs/assets as a clear runtime layer rather than scattered main-process services
- Worker/job runtime — background workers for expensive export, indexing, validation, and generation tasks
- Review and permission model — inspect/propose/apply/take-over trust ladder

---

## Key Architectural Decisions

- **Agents must not bypass scene engine** — agent edits go through the same deterministic command surface as manual edits. No hidden mutation path that skips editor safety and undoability.
- **Immediate apply by default** — agent edits apply immediately rather than requiring review-first confirmation. Safety comes from bounded authority, visibility, and undoability, not approval dialogs.
- **Narrow CodeMode gateway instead of tool sprawl** — the agent gets one typed code-driven execution surface (`pascal_execute`) rather than a growing set of individual tools. This keeps the attack surface small and auditable.
- **Electron main owns persistence** — project files, agent sessions, and workspace state are owned by trusted main-process services. The renderer only sees project IDs and loaded payloads, never raw filesystem access.
- **Host-controlled agent execution** — agent code runs in a sandboxed worker spawned by the main process, not in the renderer. The host validates syntax, enforces timeouts, and routes tool calls.
- **Scene-engine as headless kernel** — `@pascal/scene-engine` has no React, no rendering, no UI dependencies. It is the single source of truth for schema, document structure, and deterministic mutation.
