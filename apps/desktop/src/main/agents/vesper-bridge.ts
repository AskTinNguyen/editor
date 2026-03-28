/**
 * Vesper Runtime Bridge for Pascal Desktop
 *
 * Follows Vesper's RuntimeAgent pattern but with a lean implementation
 * that only depends on @anthropic-ai/sdk (already installed).
 *
 * This bridge:
 * 1. Uses Vesper's AgentEvent type for event streaming
 * 2. Follows the async-generator chat() pattern
 * 3. Supports multi-turn tool use natively
 * 4. Manages conversation history
 * 5. Routes Pascal scene tools through the tool call handler
 */

import type { ThinkingLevel } from '../../shared/agents'
import { getThinkingBudgetTokens } from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'
import type { PascalToolCallHandler } from './agent-provider'

// ---------------------------------------------------------------------------
// AgentEvent type — mirrors @vesper/core but defined locally to avoid dep issues
// ---------------------------------------------------------------------------

export type PascalAgentEvent =
  | { type: 'status'; message: string }
  | { type: 'text_delta'; text: string }
  | { type: 'text_complete'; text: string }
  | {
      type: 'tool_start'
      toolName: string
      toolUseId: string
      input: Record<string, unknown>
    }
  | { type: 'tool_result'; toolUseId: string; result: string; isError: boolean }
  | { type: 'error'; message: string }
  | {
      type: 'complete'
      usage?: { inputTokens: number; outputTokens: number }
    }

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type VesperBridgeConfig = {
  apiKey: string
  baseURL?: string
  model?: string
  maxTokens?: number
}

export type ChatTurnOptions = {
  projectId: ProjectId
  sceneContext: unknown
  selectionContext?: {
    selectedNodeIds: string[]
    selectedNodeTypes: string[]
  }
  model?: string
  thinkingLevel?: ThinkingLevel
}

// ---------------------------------------------------------------------------
// Bridge factory
// ---------------------------------------------------------------------------

export function createVesperBridge(
  config: VesperBridgeConfig,
  toolHandler: PascalToolCallHandler,
) {
  const model = config.model ?? 'claude-sonnet-4-6'
  const maxTokens = config.maxTokens ?? 4096
  const maxToolIterations = 10

  // Conversation history — persisted across turns
  const history: Array<{ role: 'user' | 'assistant'; content: unknown }> = []

  return {
    /**
     * Run a chat turn following Vesper's async-generator pattern.
     * Yields PascalAgentEvent as the turn progresses.
     */
    async *chat(
      message: string,
      options: ChatTurnOptions,
    ): AsyncGenerator<PascalAgentEvent> {
      // Use per-turn model override, fall back to bridge default
      const turnModel = options.model ?? model
      const thinkingLevel = options.thinkingLevel ?? 'think'
      const thinkingTokens = getThinkingBudgetTokens(thinkingLevel)

      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({
        apiKey: config.apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      })

      // Import the shared system prompt builder
      const { buildSystemPrompt } = await import('./providers/system-prompt')
      const systemPrompt = buildSystemPrompt(
        options.sceneContext,
        options.selectionContext,
        options.projectId,
      )

      // Pascal scene tools in Anthropic format
      const tools = [
        {
          name: 'project_read' as const,
          description: 'Read project metadata and scene graph',
          input_schema: {
            type: 'object' as const,
            properties: { projectId: { type: 'string' } },
            required: ['projectId'],
          },
        },
        {
          name: 'scene_read' as const,
          description: 'Read the scene graph for a project',
          input_schema: {
            type: 'object' as const,
            properties: { projectId: { type: 'string' } },
            required: ['projectId'],
          },
        },
        {
          name: 'scene_applyCommands' as const,
          description:
            'Apply scene commands atomically. Supports create-node, update-node, move-node, delete-node.',
          input_schema: {
            type: 'object' as const,
            properties: {
              projectId: { type: 'string' },
              commands: { type: 'array', items: { type: 'object' } },
            },
            required: ['projectId', 'commands'],
          },
        },
      ]

      // Add user message to history
      history.push({ role: 'user', content: message })

      yield { type: 'status', message: 'Thinking...' }

      // Build messages from history
      const messages = history.map((h) => ({
        role: h.role,
        content: h.content,
      }))

      for (let i = 0; i < maxToolIterations; i++) {
        let response: Awaited<ReturnType<typeof client.messages.create>>
        try {
          response = await client.messages.create({
            model: turnModel,
            max_tokens: maxTokens + thinkingTokens,
            system: systemPrompt,
            messages: messages as Parameters<
              typeof client.messages.create
            >[0]['messages'],
            tools,
            ...(thinkingTokens > 0 ? {
              thinking: { type: 'enabled' as const, budget_tokens: thinkingTokens }
            } : {}),
          })
        } catch (err) {
          const errMsg =
            err instanceof Error ? err.message : String(err)
          yield { type: 'error', message: errMsg }
          yield { type: 'complete' }
          return
        }

        // Filter out thinking blocks — only show text and tool_use to the user
        const textBlocks = response.content.filter(
          (b: any) => b.type === 'text',
        ) as Array<{ type: 'text'; text: string }>
        const toolUseBlocks = response.content.filter(
          (b: any) => b.type === 'tool_use',
        ) as Array<{
          type: 'tool_use'
          id: string
          name: string
          input: Record<string, unknown>
        }>

        // Yield text deltas
        for (const block of textBlocks) {
          yield { type: 'text_delta', text: block.text }
        }

        // If no tool calls or end of turn, finish
        if (
          toolUseBlocks.length === 0 ||
          response.stop_reason === 'end_turn'
        ) {
          const finalText =
            textBlocks.map((b) => b.text).join('\n') || 'Done.'
          history.push({ role: 'assistant', content: finalText })
          yield { type: 'text_complete', text: finalText }
          yield {
            type: 'complete',
            usage: {
              inputTokens: response.usage?.input_tokens ?? 0,
              outputTokens: response.usage?.output_tokens ?? 0,
            },
          }
          return
        }

        // Process tool calls — add assistant turn with tool_use blocks
        messages.push({
          role: 'assistant',
          content: response.content,
        } as (typeof messages)[number])

        const toolResults: Array<{
          type: 'tool_result'
          tool_use_id: string
          content: string
        }> = []

        for (const block of toolUseBlocks) {
          yield {
            type: 'tool_start',
            toolName: block.name,
            toolUseId: block.id,
            input: block.input,
          }

          let result: unknown
          let isError = false
          try {
            switch (block.name) {
              case 'project_read':
                result = await toolHandler.project_read(
                  block.input.projectId as ProjectId,
                )
                break
              case 'scene_read':
                result = await toolHandler.scene_read(
                  block.input.projectId as ProjectId,
                )
                break
              case 'scene_applyCommands':
                result = await toolHandler.scene_applyCommands({
                  projectId: block.input.projectId as ProjectId,
                  commands: block.input.commands as Parameters<
                    typeof toolHandler.scene_applyCommands
                  >[0]['commands'],
                })
                break
              default:
                result = { error: `Unknown tool: ${block.name}` }
                isError = true
            }
          } catch (err) {
            result = {
              error:
                err instanceof Error ? err.message : String(err),
            }
            isError = true
          }

          const resultStr = JSON.stringify(result)
          yield {
            type: 'tool_result',
            toolUseId: block.id,
            result: resultStr,
            isError,
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultStr,
          })
        }

        messages.push({
          role: 'user',
          content: toolResults,
        } as (typeof messages)[number])
      }

      yield { type: 'text_complete', text: 'Max tool iterations reached.' }
      yield { type: 'complete' }
    },

    /** Clear conversation history */
    resetConversation() {
      history.length = 0
    },

    /** Get current conversation length */
    getHistoryLength() {
      return history.length
    },
  }
}
