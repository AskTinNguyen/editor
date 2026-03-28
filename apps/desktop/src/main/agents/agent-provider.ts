import type { SceneCommand } from '@pascal/scene-engine'
import type { AgentMessage } from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'
import type {
  InspectorResult,
  UiInspectorContextOptions,
  UiInspectorState,
} from '../../shared/ui-inspector'

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
  vesper_ui_get_state: (payload: {
    projectId: ProjectId
    windowId?: number
  }) => Promise<InspectorResult<UiInspectorState>>
  vesper_ui_get_selection: (payload: {
    projectId: ProjectId
    windowId?: number
  }) => Promise<InspectorResult<NonNullable<UiInspectorState['snapshot']>>>
  vesper_ui_get_context: (payload: {
    projectId: ProjectId
    windowId?: number
  } & UiInspectorContextOptions) => Promise<InspectorResult<string>>
  vesper_ui_capture_screenshot: (payload: {
    projectId: ProjectId
    windowId?: number
  }) => Promise<
    InspectorResult<{
      screenshotDataUrl: string
      screenshotByteSize: number
    }>
  >
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
  {
    name: 'vesper_ui_get_state',
    description:
      'Read the current UI inspector state for the active desktop window. Returns typed read-only inspector data.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project ID to read inspector state for' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'vesper_ui_get_selection',
    description:
      'Read the current inspected UI selection for the active desktop window. Returns the same selection shown in the inspector panel.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project ID to read inspector selection for' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'vesper_ui_get_context',
    description:
      'Build the current UI inspector context payload for the active desktop window. Use this for UI and UX reasoning.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project ID to read inspector context for' },
        includeHtml: { type: 'boolean', description: 'Include the trimmed HTML excerpt' },
        includeStyles: { type: 'boolean', description: 'Include the trimmed style subset' },
        includeDataAttributes: {
          type: 'boolean',
          description: 'Include the trimmed data attribute subset',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'vesper_ui_capture_screenshot',
    description:
      'Return a screenshot for the current inspected UI selection in the active desktop window when screenshot capture is enabled.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project ID to capture inspector screenshot for' },
      },
      required: ['projectId'],
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
