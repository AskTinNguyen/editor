/**
 * Pascal tool definitions following Vesper's RuntimeToolDescriptor pattern.
 *
 * These descriptors are the canonical tool catalog for Pascal's scene tools.
 * They can be registered with any Vesper-compatible runtime (Claude, Pi, etc.)
 * or used directly by the VesperBridge for Anthropic API tool_use calls.
 */

export type PascalToolDescriptor = {
  name: string
  description: string
  category: 'scene' | 'project'
  inputSchema: Record<string, unknown>
}

export const PASCAL_TOOLS: PascalToolDescriptor[] = [
  {
    name: 'project_read',
    description: 'Read project metadata and scene graph',
    category: 'project',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'scene_read',
    description: 'Read the scene graph',
    category: 'scene',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'scene_applyCommands',
    description:
      'Apply scene commands (create-node, update-node, move-node, delete-node) atomically',
    category: 'scene',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        commands: { type: 'array', items: { type: 'object' } },
      },
      required: ['projectId', 'commands'],
    },
  },
]
