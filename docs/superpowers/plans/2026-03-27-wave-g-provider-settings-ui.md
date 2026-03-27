# Wave G: Provider Settings UI

**Goal:** Let users switch LLM providers and enter API keys from the desktop workbench UI, without env vars.

---

## Scope

- Persistent provider config stored as JSON on disk
- Settings panel accessible from the workbench toolbar
- Provider selector + API key input + connection test
- Config loaded at app boot, used by the session manager

## File Ownership

### Task G1: Provider config persistence

- `apps/desktop/src/main/agents/providers/provider-config.ts` (CREATE)
- `apps/desktop/src/main/agents/providers/provider-config.test.ts` (CREATE)

### Task G2: Provider config IPC + preload

- `apps/desktop/src/shared/agents.ts` (MODIFY — add config types and IPC channels)
- `apps/desktop/src/main/agents/agent-ipc.ts` (MODIFY — register config handlers)
- `apps/desktop/src/preload/index.ts` (MODIFY — expose config API)

### Task G3: Settings panel renderer

- `apps/desktop/src/renderer/src/components/provider-settings.tsx` (CREATE)
- `apps/desktop/src/renderer/src/components/workbench-shell.tsx` (MODIFY — add settings toggle)

---

## Task G1: Provider config persistence

Store provider config at `{rootDir}/.pascal-agent-config.json`:

```ts
export type PersistedProviderConfig = {
  provider: 'stub' | 'anthropic' | 'openai' | 'vesper-gateway'
  anthropicApiKey?: string
  openaiApiKey?: string
  model?: string
}
```

Functions:
- `loadProviderConfig(rootDir): Promise<PersistedProviderConfig>`
- `saveProviderConfig(rootDir, config): Promise<void>`
- `resolveProvider(config, rootDir): PascalAgentProvider` — creates the provider from persisted config, falling back to env vars

Tests: load default when no file exists, save and reload, resolve each provider type.

## Task G2: IPC channels

Add to shared/agents.ts:
```ts
export const PROVIDER_CONFIG_IPC_CHANNELS = {
  get: 'provider-config:get',
  set: 'provider-config:set',
  test: 'provider-config:test',
}
```

## Task G3: Settings panel

A slide-over panel (same pattern as RecentProjectSheet):
- Provider radio group: Stub / Anthropic / OpenAI / Vesper Gateway
- Conditional API key input (only for anthropic and openai)
- Model override input (optional)
- "Test Connection" button that calls the test IPC
- "Save" button
- Status indicator (connected / error / untested)
