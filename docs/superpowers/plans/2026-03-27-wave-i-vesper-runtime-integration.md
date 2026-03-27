# Wave I: Vesper Runtime Integration

**Goal:** Replace Pascal's custom agent session framework with Vesper's battle-tested runtime, gaining Pi's multi-turn tool use, conversation history, and MCP integration for free.

**Strategy:** Import `@vesper/shared` and `@vesper/core` as local dependencies. Wire Vesper's `createRuntime()` factory and `HeadlessSessionManager` into Pascal's Electron IPC layer. Register Pascal's scene tools (project_read, scene_read, scene_applyCommands) through Vesper's tool catalog pattern.

---

## What We Stop Maintaining

| Pascal Custom Code | Vesper Replacement |
|---|---|
| `agent-session-manager.ts` | Vesper's HeadlessSessionManager + RuntimeAgent.chat() |
| `pascal-code-executor.ts` + worker | Pi SDK's native tool execution |
| `anthropic-provider.ts` | Vesper's Claude runtime adapter |
| `openai-provider.ts` | Not needed (Vesper gateway routes to any model) |
| `vesper-gateway-provider.ts` | Vesper's native gateway support |
| `system-prompt.ts` | Vesper's prompt context builders |
| Custom AgentSessionEvent types | Vesper's `AgentEvent` types from `@vesper/core` |

## What We Keep

| Pascal Code | Why |
|---|---|
| `agent-ipc.ts` | Electron-specific IPC transport (adapt to EventSink pattern) |
| `agent-session-store.ts` | Disk persistence (adapt to Vesper session format) |
| `provider-config.ts` | Desktop-specific config persistence |
| `ai-gateway-credentials.ts` | Desktop-specific credential discovery |
| Scene tools (project_read, scene_read, scene_applyCommands) | Pascal-specific domain tools |
| Mission console renderer | Pascal-specific UI |

---

## File Changes

### Phase 1: Add Vesper dependencies

#### `apps/desktop/package.json` (MODIFY)

Add local references to Vesper packages:
```json
{
  "dependencies": {
    "@vesper/shared": "file:../../../vesper/packages/shared",
    "@vesper/core": "file:../../../vesper/packages/core",
    "@mariozechner/pi-coding-agent": "0.61.1",
    "@anthropic-ai/claude-agent-sdk": "^0.2.12",
    "@modelcontextprotocol/sdk": ">=1.0.0"
  }
}
```

### Phase 2: Create the Vesper bridge

#### `apps/desktop/src/main/agents/vesper-bridge.ts` (CREATE)

The bridge between Vesper's runtime and Pascal's desktop app:

```ts
import { createRuntime } from '@vesper/shared/agent/runtime/factory'
import type { RuntimeAgent, AgentEvent } from '@vesper/shared/agent/runtime/types'
import type { PascalToolCallHandler } from './agent-provider'
import type { ProjectId } from '../../shared/projects'

export type VesperBridgeConfig = {
  runtimeId: 'claude' | 'pi'
  model: string
  apiKey?: string
  baseURL?: string
  toolHandler: PascalToolCallHandler
  onEvent: (event: AgentEvent) => void
}

export function createVesperBridge(config: VesperBridgeConfig) {
  // Create runtime using Vesper's factory
  // Register Pascal scene tools as runtime tools
  // Return a simplified interface for the desktop session manager

  return {
    async chat(projectId: ProjectId, message: string): AsyncGenerator<AgentEvent>
    dispose(): void
  }
}
```

#### `apps/desktop/src/main/agents/pascal-tool-server.ts` (CREATE)

Register Pascal's scene tools as an MCP-compatible tool server that Vesper's runtime can discover:

```ts
// Exposes project_read, scene_read, scene_applyCommands as tools
// that the Pi or Claude runtime can call through their native tool-use loop
```

### Phase 3: Adapt the session manager

#### `apps/desktop/src/main/agents/agent-session-manager.ts` (REWRITE)

Replace the custom implementation with a thin wrapper around Vesper's runtime:

```ts
// Instead of: custom code generation + executor
// Now: vesperBridge.chat(projectId, message) yields AgentEvent
// The runtime handles multi-turn, conversation history, and tool execution natively
```

### Phase 4: Adapt the event bridge

#### `apps/desktop/src/shared/agents.ts` (MODIFY)

Replace custom event types with re-exports from `@vesper/core`:

```ts
// Instead of custom AgentSessionEvent, use:
import type { AgentEvent } from '@vesper/core/types'
export type { AgentEvent }
```

### Phase 5: Update renderer

#### Mission console components (MODIFY)

Adapt to render Vesper's `AgentEvent` types instead of the custom ones:
- `text_delta` / `text_complete` for streaming text
- `tool_start` / `tool_result` for tool execution evidence
- `status` / `info` for status updates
- `error` / `typed_error` for error states

---

## Verification

```bash
bun test
cd apps/desktop && bun x tsc --noEmit
PASCAL_AGENT_PROVIDER=vesper-gateway bun run apps/desktop/src/main/agents/providers/smoke-test.ts
```

## Expected Commits

- `chore(desktop): add vesper shared and core dependencies`
- `feat(agent): create vesper runtime bridge with pascal tool server`
- `refactor(agent): replace custom session manager with vesper runtime`
- `refactor(agent): adopt vesper AgentEvent types in renderer`

## Risk Mitigation

- Keep the stub provider and existing tests working throughout
- The Vesper bridge is an ADAPTER — if it breaks, the stub provider still works
- Phase the rollout: Phase 1-2 first (add bridge), Phase 3 later (replace session manager)
