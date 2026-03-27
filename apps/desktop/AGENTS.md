# apps/desktop — Agent Runtime

Electron desktop app. Houses the agent runtime for project-scoped AI assistance. Main process owns filesystem access, permissions, and code execution; renderer hosts the editor UI and mission console.

---

## Agent Session Lifecycle

State machine managed by `AgentSessionManager` (`src/main/agents/agent-session-manager.ts`).

```
idle → reading → planning → applying → completed
                                     → error
```

| State | What happens |
|---|---|
| `idle` | No active turn. Session loaded from store. |
| `reading` | Loading current project and scene state. |
| `planning` | Building execution code (LLM integration point). |
| `applying` | Code executing in worker sandbox. |
| `completed` | Turn finished successfully. |
| `error` | Turn failed — see `AgentTurnResult.error`. |

`AgentSessionManager` is created via `createAgentSessionManager(deps)` with dependency-injected `executor`, `sessionStore`, `projectStore`, and an `onEvent` callback for UI sync. Messages use `user` | `agent` roles. Each turn emits events (`status-changed`, `message-added`, `execution-log`, `turn-completed`) to subscribed renderers.

---

## Session Persistence

`AgentSessionStore` (`src/main/agents/agent-session-store.ts`):

- **Storage path:** `{rootDir}/{projectId}/agent-session.json`
- **Atomic writes:** writes to `.tmp` file then renames — no partial-write corruption
- **In-memory cache:** `Map<ProjectId, AgentSession>` — disk read only on first access
- **Session ID format:** `session_{uuid}` (dashes stripped)

```ts
type AgentSession = {
  sessionId: AgentSessionId
  projectId: ProjectId
  status: AgentSessionStatus
  messages: AgentMessage[]
  lastTurnResult: AgentTurnResult | null
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
}
```

---

## IPC Channels

Defined in `src/shared/agents.ts` as `AGENT_IPC_CHANNELS`. Registered in `src/main/agents/agent-ipc.ts`.

| Channel | Direction | Pattern | Purpose |
|---|---|---|---|
| `agents:get-session` | renderer → main | `invoke`/`handle` | Load session for project |
| `agents:send-message` | renderer → main | `invoke`/`handle` | Send user prompt, returns `AgentTurnResult` |
| `agents:subscribe` | renderer → main | `send`/`on` | Subscribe to real-time events for a project |
| `agents:unsubscribe` | renderer → main | `send`/`on` | Unsubscribe from project events |
| `agents:event` | main → renderer | `send` | Broadcast `AgentSessionEvent` to subscribers |

Subscription tracking uses `Map<WebContents, Set<ProjectId>>`. Cleanup is automatic — subscriptions are removed when `WebContents` emits `destroyed`.

---

## Code Executor

`PascalCodeExecutor` (`src/main/agents/pascal-code-executor.ts`):

```
syntax validation → worker_threads spawn → tool call routing → result collection
```

1. **Syntax check** — `new Function(code)` validates JS before spawning a worker
2. **Worker spawn** — fresh `Worker` per execution
3. **Message loop** — routes `tool-call` messages to host-side `PascalProxyTools` handlers, sends results back
4. **Timeout** — default 30s (`DEFAULT_TIMEOUT_MS = 30_000`), terminates worker on expiry

`ExecutionLogEntry` types collected during execution:

| Type | Content |
|---|---|
| `tool-call` | Tool name + args |
| `tool-result` | Tool name + result |
| `console` | Captured `log`/`warn`/`error` + args |
| `scene-commands-applied` | `SceneCommandResult` or `SceneCommandBatchResult` |

---

## Worker Sandbox

`pascal-code-executor-worker.ts` runs in a `worker_threads` isolate.

The worker builds a `pascal` proxy object with **3 whitelisted tools**:

```ts
pascal.project_read(projectId)          // read project metadata + scene
pascal.scene_read(projectId)            // read scene state
pascal.scene_applyCommands(payload)     // { projectId?, commands: [] }
```

**Tool call flow:**
1. Worker calls `pascal.scene_read()` → sends `{ type: 'tool-call', id, tool, args }` to main
2. Main executes the real tool, sends `{ type: 'tool-result', id, result }` back
3. Worker promise resolves with result

**Console capture:** `console.log`, `console.warn`, `console.error` are intercepted — output is serialized and sent to main as `{ type: 'console', level, args }`.

**Code execution:** agent code is wrapped in `new Function('pascal', 'return (async () => { ... })()')` — top-level `await` works.

---

## AgentTurnResult Shape

```ts
type AgentTurnResult = {
  status: 'completed' | 'error'
  summary: string                    // human-readable turn summary
  executionLog: ExecutionLogEntry[]  // full execution trace
  sceneCommandsApplied: number      // count of scene-commands-applied entries
  error?: string                    // present when status is 'error'
}
```

---

## Renderer Hook

`useAgentSession(projectId)` (`src/renderer/src/lib/agent-client.ts`):

```ts
const { session, status, error, sendMessage, isProcessing } = useAgentSession(projectId)
```

| Return value | Type | Description |
|---|---|---|
| `session` | `AgentSession \| null` | Current session state |
| `status` | `AgentSessionStatus` | Live status from events |
| `error` | `string \| null` | Last error message |
| `sendMessage` | `(prompt: string) => Promise<AgentTurnResult \| null>` | Send user prompt |
| `isProcessing` | `boolean` | `true` when status is `reading`, `planning`, or `applying` |

Subscribes to `agents:event` on mount, unsubscribes on unmount. Accessed via `window.pascalDesktop.agents` (preload-exposed API).

---

## Safety Model

- **Isolation** — agent code runs in `worker_threads`, not the main process
- **Whitelisted tools only** — exactly 3 tool calls available (`project_read`, `scene_read`, `scene_applyCommands`)
- **Scene integrity** — all mutations go through `scene_applyCommands` → trusted main process handler → `applySceneCommand` → integrity check. Agents cannot bypass the scene engine.
- **Timeout enforcement** — worker is terminated after 30s (configurable via `timeoutMs`)
- **No filesystem access** — worker cannot read/write files or access IPC directly
- **Syntax pre-validation** — invalid code is rejected before a worker is spawned

---

## What Agents Should Know

**Extend the tool surface:**
1. Add method to the `pascal` proxy object in `pascal-code-executor-worker.ts`
2. Add matching `case` in the tool-call `switch` in `pascal-code-executor.ts`
3. Add type to `PascalProxyTools` in `src/shared/agents.ts`

**Add a new IPC channel:**
1. Define channel name in `AGENT_IPC_CHANNELS` (`src/shared/agents.ts`)
2. Register handler in `registerAgentIpc` (`src/main/agents/agent-ipc.ts`)
3. Expose in preload script for renderer access

**Rules:**
- Never let agent code directly access the filesystem or Electron IPC
- All scene mutations must go through `scene_applyCommands`
- Keep `PascalProxyTools` as the single source of truth for the agent tool surface
