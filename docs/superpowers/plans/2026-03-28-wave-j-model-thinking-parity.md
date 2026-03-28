# Wave J: Model Selection & Thinking Mode Parity

**Goal:** Match Vesper's model selection and thinking level features in Pascal Desktop.

---

## What to build

### 1. Model + thinking types (`apps/desktop/src/shared/agents.ts`)
- `ThinkingLevel` type: `'off' | 'think' | 'max'` (Claude family)
- `ModelDefinition` type with id, name, contextWindow
- Model list constants for the Vesper Gateway provider
- `getThinkingTokens(level, model)` helper
- Add `model` and `thinkingLevel` to `AgentSession`

### 2. Bridge model + thinking support (`vesper-bridge.ts`)
- Accept per-turn `model` and `thinkingLevel` overrides in `chat()`
- Pass `maxThinkingTokens` to the Anthropic SDK `messages.create()` call
- Default: `model=claude-sonnet-4-6`, `thinkingLevel=think`

### 3. Session manager wiring (`agent-session-manager.ts`)
- Accept `model` and `thinkingLevel` in `sendMessage` options
- Pass through to the bridge's `chat()` call
- Persist in the session

### 4. IPC + preload (`shared/agents.ts`, `agent-ipc.ts`, `preload/index.ts`)
- Add `model` and `thinkingLevel` to `sendMessage` options
- Add `setModel` and `setThinkingLevel` IPC channels

### 5. UI controls (`mission-console.tsx` or new component)
- Model selector dropdown above/beside the composer
- Thinking level toggle (off / think / max)
- Show current model in the console status row

---

## Model list (from Vesper)

```ts
const MODELS = [
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', family: 'claude', contextWindow: 200000 },
  { id: 'claude-opus-4-6', name: 'Opus 4.6', family: 'claude', contextWindow: 200000 },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', family: 'claude', contextWindow: 200000 },
]
```

## Thinking levels (Claude family)

```ts
type ThinkingLevel = 'off' | 'think' | 'max'

function getThinkingTokens(level: ThinkingLevel): number {
  switch (level) {
    case 'off': return 0
    case 'think': return 4000
    case 'max': return 16000
  }
}
```

## Anthropic SDK integration

```ts
const response = await client.messages.create({
  model,
  max_tokens: maxTokens + thinkingTokens,
  thinking: thinkingLevel !== 'off' ? { type: 'enabled', budget_tokens: thinkingTokens } : undefined,
  // ... rest
})
```
