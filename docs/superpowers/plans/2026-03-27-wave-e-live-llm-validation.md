# Wave E: Live LLM Validation

**Goal:** Prove the full LLM provider stack works end-to-end with real API calls and harden error handling.

**Architecture:** No structural changes — validate existing providers, enrich the system prompt, and add error resilience.

---

## Scope

- Smoke test script for real LLM providers
- Enriched system prompt with concrete scene schema examples
- Provider error handling (auth failures, rate limits, network errors)

## File Ownership

### Task E1: Smoke test script

Owns only:
- `apps/desktop/src/main/agents/providers/smoke-test.ts` (CREATE)

### Task E2: Enrich system prompt

Owns only:
- `apps/desktop/src/main/agents/providers/system-prompt.ts` (CREATE)
- `apps/desktop/src/main/agents/providers/system-prompt.test.ts` (CREATE)
- `apps/desktop/src/main/agents/providers/anthropic-provider.ts` (MODIFY — use shared prompt)
- `apps/desktop/src/main/agents/providers/openai-provider.ts` (MODIFY — use shared prompt)
- `apps/desktop/src/main/agents/providers/vesper-gateway-provider.ts` (MODIFY — use shared prompt)

### Task E3: Provider error handling

Owns only:
- `apps/desktop/src/main/agents/providers/provider-errors.ts` (CREATE)
- `apps/desktop/src/main/agents/providers/provider-errors.test.ts` (CREATE)
- `apps/desktop/src/main/agents/providers/anthropic-provider.ts` (MODIFY — wrap errors)
- `apps/desktop/src/main/agents/providers/openai-provider.ts` (MODIFY — wrap errors)
- `apps/desktop/src/main/agents/providers/vesper-gateway-provider.ts` (MODIFY — wrap errors)

---

## Task E1: Smoke test script

Create a standalone script that exercises each provider against a real API.

```bash
# Usage:
PASCAL_AGENT_PROVIDER=vesper-gateway bun run apps/desktop/src/main/agents/providers/smoke-test.ts
ANTHROPIC_API_KEY=sk-ant-... PASCAL_AGENT_PROVIDER=anthropic bun run apps/desktop/src/main/agents/providers/smoke-test.ts
```

The script should:
1. Create a temp project store and project
2. Create the tool handler wired to the real store
3. Resolve the provider from env vars
4. Call `provider.runTurn()` with prompt "Add a wall from (0,0) to (5,0)"
5. Print the response, tool calls executed, and verify the wall was persisted
6. Exit 0 on success, 1 on failure

---

## Task E2: Enrich system prompt

Extract the system prompt into a shared module used by all three LLM providers.

The prompt should include:
- Scene graph structure explanation (nodes, rootNodeIds, parent-child hierarchy)
- Available node types with their required fields
- Wall schema: `{ id: "wall_...", type: "wall", start: [x, z], end: [x, z], children: [], object: "node", parentId: null, visible: true, metadata: {} }`
- Scene command format: `{ type: "create-node", parentId: "level_...", node: { ... } }`
- Examples of create-node, update-node, move-node, delete-node
- The current scene summary (node count, types, level IDs)

Write a test that verifies the prompt includes key schema elements.

---

## Task E3: Provider error handling

Create a typed error hierarchy for provider failures:

```ts
export type ProviderErrorCode =
  | 'auth_failed'        // invalid API key or token
  | 'rate_limited'       // too many requests
  | 'network_error'      // connection failed
  | 'model_not_found'    // invalid model ID
  | 'context_too_long'   // prompt exceeds model context
  | 'provider_error'     // generic provider-side error

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
```

Wrap SDK-specific errors in each provider's `runTurn()`:
- Anthropic: catch `AuthenticationError`, `RateLimitError`, `APIConnectionError`
- OpenAI: catch similar error classes
- Gateway: same as Anthropic + "credential not found" for auto-discovery failure

Test that each error code maps correctly from SDK errors.

---

## Verification

```bash
bun test apps/desktop/src/main/agents/providers/system-prompt.test.ts
bun test apps/desktop/src/main/agents/providers/provider-errors.test.ts
cd apps/desktop && bun x tsc --noEmit
```

## Expected Commits

- `feat(agent): add shared system prompt with scene schema examples`
- `feat(agent): add typed provider error handling`
- `feat(agent): add provider smoke test script`
