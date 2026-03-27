import type { SceneCommand } from '@pascal/scene-engine'
import type { AgentMessage } from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'

// ---------------------------------------------------------------------------
// Tool call handler — host-owned callbacks the provider can invoke
// ---------------------------------------------------------------------------

export type PascalToolCallHandler = {
  project_read: (projectId: ProjectId) => Promise<{ name: string; scene: unknown }>
  scene_read: (projectId: ProjectId) => Promise<unknown>
  scene_applyCommands: (payload: {
    projectId: ProjectId
    commands: SceneCommand[]
  }) => Promise<{ status: string; result: unknown }>
}

// ---------------------------------------------------------------------------
// Tool definitions — schema descriptions for LLM providers
// ---------------------------------------------------------------------------

export type PascalToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export const PASCAL_TOOL_DEFINITIONS: PascalToolDefinition[] = [
  {
    name: 'project_read',
    description:
      'Read the current project metadata and scene graph. Returns { name, scene } where scene contains nodes and rootNodeIds.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project ID to read' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'scene_read',
    description:
      'Read only the scene graph (nodes and rootNodeIds) for a project. Use this when you only need the scene data without project metadata.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project ID to read' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'scene_applyCommands',
    description:
      'Apply one or more scene commands to modify the scene graph. Supports: create-node, update-node, move-node, delete-node. Commands are validated and applied atomically — if any command fails, all are rolled back.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to modify',
        },
        commands: {
          type: 'array',
          description: 'Array of scene commands to apply',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['create-node', 'update-node', 'move-node', 'delete-node'],
              },
            },
          },
        },
      },
      required: ['projectId', 'commands'],
    },
  },
]

// ---------------------------------------------------------------------------
// Provider interface — implemented by Anthropic, OpenAI, Vesper Gateway, Stub
// ---------------------------------------------------------------------------

export type PascalAgentProvider = {
  /** Human-readable name for logging and UI. */
  readonly name: string

  /**
   * Run a single agent turn. The provider:
   * 1. Sends the prompt + context to the LLM
   * 2. Handles tool-use loops (calling tools via the handler)
   * 3. Returns the final text response and tool call count
   *
   * The host owns all tool implementations — the provider just routes calls.
   */
  runTurn(params: {
    projectId: ProjectId
    prompt: string
    sceneContext: unknown
    messageHistory: AgentMessage[]
    tools: PascalToolCallHandler
    selectionContext?: {
      selectedNodeIds: string[]
      selectedNodeTypes: string[]
    }
  }): Promise<{
    response: string
    toolCallsExecuted: number
  }>
}
