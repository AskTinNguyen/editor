import type { PascalAgentProvider, PascalToolCallHandler } from '../agent-provider'

// ---------------------------------------------------------------------------
// Anthropic-specific config
// ---------------------------------------------------------------------------

export type AnthropicProviderConfig = {
  apiKey: string
  model?: string // default: 'claude-sonnet-4-6'
  maxTokens?: number // default: 4096
  baseURL?: string // optional, for gateway compatibility
}

// ---------------------------------------------------------------------------
// Tool definitions (plain objects — typed via the SDK at call time)
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
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(sceneContext: unknown): string {
  const scene = sceneContext as {
    nodes: Record<string, { type: string; [k: string]: unknown }>
    rootNodeIds: string[]
  }

  const nodes = scene?.nodes ?? {}
  const nodeCount = Object.keys(nodes).length
  const nodeTypes = [...new Set(Object.values(nodes).map((n) => n.type))]

  return `You are a Pascal scene editing assistant. You help users modify architectural floor plans.

Current scene has ${nodeCount} nodes of types: ${nodeTypes.join(', ')}.

Available tools:
- project_read: Read project metadata and full scene graph
- scene_read: Read only the scene graph
- scene_applyCommands: Apply scene modifications (create-node, update-node, move-node, delete-node)

Node types: site, building, level, wall, door, window, item, zone, slab, ceiling, roof, roof-segment, scan, guide.
Node IDs follow the pattern: {type}_{uuid} (e.g., wall_abc123).
The scene hierarchy is: site → building → level → [walls, zones, slabs, etc.]

When creating nodes, always:
1. Use the correct ID prefix for the node type
2. Set required fields for the node type
3. Specify the correct parentId (usually a level for walls/zones/slabs)

For walls, required fields: id, type: "wall", start: [x, z], end: [x, z], children: []
For items, required fields: id, type: "item", position: [x, y, z]`
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

export function createAnthropicProvider(
  config: AnthropicProviderConfig,
): PascalAgentProvider {
  const model = config.model ?? 'claude-sonnet-4-6'
  const maxTokens = config.maxTokens ?? 4096
  const maxIterations = 10

  return {
    name: 'anthropic',

    async runTurn({ prompt, sceneContext, messageHistory, tools: toolHandler }) {
      // Dynamic import so the module can be loaded without the SDK installed.
      // The SDK is only needed when runTurn is actually called.
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      const client = new Anthropic({
        apiKey: config.apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      })

      const systemPrompt = buildSystemPrompt(sceneContext)

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
