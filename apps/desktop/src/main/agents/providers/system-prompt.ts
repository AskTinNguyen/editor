// ---------------------------------------------------------------------------
// Shared system prompt for all LLM providers
// ---------------------------------------------------------------------------

type SceneNode = {
  type: string
  id?: string
  parentId?: string | null
  [k: string]: unknown
}

type SceneContext = {
  nodes: Record<string, SceneNode>
  rootNodeIds: string[]
}

/**
 * Build the system prompt for the Pascal agent.
 *
 * Includes:
 * - Scene graph structure explanation
 * - Available tools and scene commands
 * - Concrete node schema examples (wall, zone, item)
 * - Current scene summary (node count, types, level IDs)
 * - Important rules for node creation and mutation
 */
export function buildSystemPrompt(
  sceneContext: unknown,
  selectionContext?: { selectedNodeIds: string[]; selectedNodeTypes: string[] },
): string {
  const scene = sceneContext as SceneContext | null | undefined
  const nodes = scene?.nodes ?? {}
  const nodeEntries = Object.values(nodes)
  const nodeCount = nodeEntries.length

  // Collect node types with counts
  const typeCounts = new Map<string, number>()
  for (const node of nodeEntries) {
    const t = node.type
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }
  const nodeTypeSummary =
    typeCounts.size > 0
      ? [...typeCounts.entries()].map(([t, c]) => `${t} (${c})`).join(', ')
      : '(none)'

  // Extract level node IDs — agents need these to create child nodes
  const levelIds = nodeEntries
    .filter((n) => n.type === 'level')
    .map((n) => n.id ?? '')
    .filter(Boolean)
  const levelIdList = levelIds.length > 0 ? levelIds.join(', ') : '(none)'

  const selectionSection =
    selectionContext && selectionContext.selectedNodeIds.length > 0
      ? `\n## Current Selection\nThe user has selected ${selectionContext.selectedNodeIds.length} node(s): ${selectionContext.selectedNodeIds.join(', ')} (types: ${selectionContext.selectedNodeTypes.join(', ')}).\nWhen the user refers to "this", "the selected", or "it", they mean these nodes.\n`
      : ''

  return `You are a Pascal scene editing assistant. You help users modify architectural floor plans by reading the scene graph and applying scene commands.

## Scene Graph Structure
The scene is a flat dictionary of nodes: { nodes: Record<id, Node>, rootNodeIds: string[] }
Each node has: id, type, parentId, children, object: "node", visible, metadata
Hierarchy: site → building → level → [wall, zone, slab, ceiling, roof, scan, guide]
Walls can have children: [door, window, item]

## Current Scene
${nodeCount} nodes of types: ${nodeTypeSummary}
Level nodes: ${levelIdList}
${selectionSection}
## Available Tools
- project_read(projectId): Read project name and full scene graph
- scene_read(projectId): Read only the scene graph
- scene_applyCommands(projectId, commands): Apply mutations atomically

## Scene Commands
Each command in the commands array must be one of:

### create-node
{ type: "create-node", parentId: "level_xxx", node: { ...full node object } }

### update-node
{ type: "update-node", nodeId: "wall_xxx", patch: { start: [1, 0], end: [6, 0] } }
NOTE: Cannot patch id, type, parentId, children, or object fields.

### move-node
{ type: "move-node", nodeId: "wall_xxx", newParentId: "level_yyy" }

### delete-node
{ type: "delete-node", nodeId: "wall_xxx" }

## Node Schema Examples

### Wall
{
  object: "node", id: "wall_abc123", type: "wall",
  parentId: "level_xyz", visible: true, metadata: {},
  children: [],
  start: [0, 0], end: [5, 0],
  thickness: 0.15, height: 2.8,
  frontSide: "unknown", backSide: "unknown"
}

### Zone (room/space)
{
  object: "node", id: "zone_abc123", type: "zone",
  parentId: "level_xyz", visible: true, metadata: {},
  polygon: { type: "polygon", points: [[0,0], [5,0], [5,4], [0,4]] }
}

### Item (furniture/fixture)
{
  object: "node", id: "item_abc123", type: "item",
  parentId: "level_xyz", visible: true, metadata: {},
  position: [2.5, 0, 2],
  children: []
}

## Important Rules
1. Node IDs must use the correct prefix: wall_, zone_, item_, door_, window_, slab_, etc.
2. Always set object: "node" on every node
3. Always provide parentId in the node object for create-node (usually a level ID)
4. Commands are validated atomically — if any fails, all roll back
5. Use scene_read first to understand the current state before making changes`
}
