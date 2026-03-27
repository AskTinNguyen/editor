import OpenAI from 'openai'
import type { PascalAgentProvider, PascalToolCallHandler } from '../agent-provider'
import { buildSystemPrompt } from './system-prompt'

// ---------------------------------------------------------------------------
// OpenAI provider configuration
// ---------------------------------------------------------------------------

export type OpenAIProviderConfig = {
  apiKey: string
  /** Model identifier. @default 'gpt-4o' */
  model?: string
  /** Maximum tokens for the completion. @default 4096 */
  maxTokens?: number
  /** Optional base URL for the OpenAI-compatible API. */
  baseURL?: string
}

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function-calling format)
// ---------------------------------------------------------------------------

const pascalTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'project_read',
      description: 'Read project metadata and scene graph',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'The project ID' },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scene_read',
      description: 'Read the scene graph for a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'The project ID' },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scene_applyCommands',
      description:
        'Apply scene commands (create-node, update-node, move-node, delete-node) to modify the scene graph atomically.',
      parameters: {
        type: 'object',
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
  },
]

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a `PascalAgentProvider` backed by the OpenAI Chat Completions API
 * with native function-calling support.
 */
export function createOpenAIProvider(
  config: OpenAIProviderConfig,
): PascalAgentProvider {
  return {
    name: 'openai',

    async runTurn({ projectId: _projectId, prompt, sceneContext, messageHistory, tools: toolHandler, selectionContext }) {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      })

      // -- Build the messages array ----------------------------------------

      const systemPrompt = buildSystemPrompt(sceneContext, selectionContext)

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ]

      for (const msg of messageHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })
      }

      messages.push({ role: 'user', content: prompt })

      // -- Multi-turn tool-use loop ----------------------------------------

      let toolCallsExecuted = 0
      const maxIterations = 10

      for (let i = 0; i < maxIterations; i++) {
        const response = await client.chat.completions.create({
          model: config.model ?? 'gpt-4o',
          max_tokens: config.maxTokens ?? 4096,
          messages,
          tools: pascalTools,
        })

        const choice = response.choices[0]
        if (!choice) break

        const message = choice.message

        // No tool calls — we have the final assistant reply.
        if (!message.tool_calls || message.tool_calls.length === 0) {
          return {
            response: message.content ?? 'Done.',
            toolCallsExecuted,
          }
        }

        // Append the assistant message (including its tool_calls) so the
        // conversation context stays consistent for the next iteration.
        messages.push(message)

        // Execute every tool call and feed results back.
        for (const toolCall of message.tool_calls) {
          const args = JSON.parse((toolCall as any).function.arguments)
          let result: unknown

          try {
            switch ((toolCall as any).function.name) {
              case 'project_read':
                result = await toolHandler.project_read(args.projectId)
                break
              case 'scene_read':
                result = await toolHandler.scene_read(args.projectId)
                break
              case 'scene_applyCommands':
                result = await toolHandler.scene_applyCommands({
                  projectId: args.projectId,
                  commands: args.commands,
                })
                break
              default:
                result = { error: `Unknown tool: ${(toolCall as any).function.name}` }
            }
            toolCallsExecuted++
          } catch (err) {
            result = {
              error: err instanceof Error ? err.message : String(err),
            }
          }

          messages.push({
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        }
      }

      // Exhausted the iteration budget without a final text response.
      return { response: 'Max iterations reached.', toolCallsExecuted }
    },
  }
}
