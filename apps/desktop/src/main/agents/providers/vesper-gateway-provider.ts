import type { PascalAgentProvider, PascalToolCallHandler } from '../agent-provider'
import { buildSystemPrompt } from './system-prompt'

// ---------------------------------------------------------------------------
// Vesper Gateway config
// ---------------------------------------------------------------------------

export type VesperGatewayProviderConfig = {
  /** Override auth token (if not provided, auto-discovers from OS). */
  authToken?: string
  /** Override base URL (if not provided, auto-discovers from OS). */
  baseUrl?: string
  /** Model to request. Default: 'claude-sonnet-4-6'. */
  model?: string
  /** Max tokens per response. Default: 4096. */
  maxTokens?: number
}

// ---------------------------------------------------------------------------
// Tool definitions (same as Anthropic provider — Anthropic-compatible format)
// ---------------------------------------------------------------------------

const pascalTools = [
  {
    name: 'project_read',
    description: 'Read project metadata and scene graph',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'The project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'scene_read',
    description: 'Read the scene graph for a project',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'The project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'scene_applyCommands',
    description:
      'Apply scene commands (create-node, update-node, move-node, delete-node) to modify the scene graph. Commands are validated and applied atomically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'The project ID' },
        commands: {
          type: 'array',
          description: 'Scene commands to apply',
          items: { type: 'object' },
        },
      },
      required: ['projectId', 'commands'],
    },
  },
]

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Create a Vesper AI Gateway provider.
 *
 * The gateway is Anthropic-compatible — it uses the same `@anthropic-ai/sdk`
 * with a custom base URL and bearer token auth. If no credentials are provided
 * in the config, they are auto-discovered from the OS (environment variables,
 * macOS Keychain, config files).
 */
export function createVesperGatewayProvider(
  config?: VesperGatewayProviderConfig,
): PascalAgentProvider {
  const model = config?.model ?? 'claude-sonnet-4-6'
  const maxTokens = config?.maxTokens ?? 4096
  const maxIterations = 10

  return {
    name: 'vesper-gateway',

    async runTurn({ prompt, sceneContext, messageHistory, tools: toolHandler, selectionContext }) {
      // Resolve credentials: explicit config > auto-discovery
      let authToken = config?.authToken
      let baseUrl = config?.baseUrl

      if (!authToken || !baseUrl) {
        // Dynamic import to keep the credential module optional
        const { getAiGatewayCredentials } = await import('./ai-gateway-credentials')
        const discovered = getAiGatewayCredentials()

        if (!authToken) {
          authToken = discovered?.authToken
        }
        if (!baseUrl) {
          baseUrl = discovered?.baseUrl
        }
      }

      if (!authToken) {
        throw new Error(
          'Vesper AI Gateway: no auth token found. ' +
            'Set ANTHROPIC_AUTH_TOKEN, add credentials to macOS Keychain ' +
            '(service "ai-gateway", account "prod"), or pass authToken in config.',
        )
      }

      if (!baseUrl) {
        // Fallback should not happen (getAiGatewayBaseUrl always returns a value),
        // but guard defensively.
        baseUrl = 'https://ai-gateway.atherlabs.com'
      }

      // Dynamic import so the module can be loaded without the SDK installed.
      // The SDK is only needed when runTurn is actually called.
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      const client = new Anthropic({
        apiKey: authToken,
        baseURL: baseUrl,
      })

      const systemPrompt = buildSystemPrompt(sceneContext, selectionContext)

      // Build the Anthropic messages array from history + current prompt
      type MessageParam = InstanceType<typeof Anthropic>['messages'] extends {
        create(params: { messages: infer M }): unknown
      }
        ? M extends Array<infer P>
          ? P
          : never
        : never

      const messages: MessageParam[] = []

      for (const msg of messageHistory) {
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.content } as MessageParam)
        } else {
          messages.push({ role: 'assistant', content: msg.content } as MessageParam)
        }
      }

      // Append the current user prompt
      messages.push({ role: 'user', content: prompt } as MessageParam)

      let toolCallsExecuted = 0

      for (let i = 0; i < maxIterations; i++) {
        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
          tools: pascalTools,
        })

        // Separate text blocks from tool-use blocks
        const textBlocks = response.content.filter(
          (b: { type: string }) => b.type === 'text',
        ) as Array<{ type: 'text'; text: string }>

        const toolUseBlocks = response.content.filter(
          (b: { type: string }) => b.type === 'tool_use',
        ) as Array<{ type: 'tool_use'; id: string; name: string; input: unknown }>

        // If there are no tool calls or the model chose to stop, return the text.
        if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
          const finalText = textBlocks.map((b) => b.text).join('\n') || 'Done.'
          return { response: finalText, toolCallsExecuted }
        }

        // The assistant message (with tool_use blocks) must be added before
        // the tool results so the conversation stays well-formed.
        messages.push({ role: 'assistant', content: response.content } as MessageParam)

        // Execute each tool call and collect results
        const toolResults: Array<{
          type: 'tool_result'
          tool_use_id: string
          content: string
        }> = []

        for (const block of toolUseBlocks) {
          const input = block.input as Record<string, unknown>
          let result: unknown

          try {
            switch (block.name) {
              case 'project_read':
                result = await toolHandler.project_read(input.projectId as any)
                break
              case 'scene_read':
                result = await toolHandler.scene_read(input.projectId as any)
                break
              case 'scene_applyCommands':
                result = await toolHandler.scene_applyCommands({
                  projectId: input.projectId as any,
                  commands: input.commands as any,
                })
                break
              default:
                result = { error: `Unknown tool: ${block.name}` }
            }
            toolCallsExecuted++
          } catch (err) {
            result = { error: err instanceof Error ? err.message : String(err) }
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }

        // Feed tool results back as a user message (Anthropic's format)
        messages.push({ role: 'user', content: toolResults } as MessageParam)
      }

      // Safety: if we exhausted iterations, return what we have
      return { response: 'Max tool-use iterations reached.', toolCallsExecuted }
    },
  }
}
