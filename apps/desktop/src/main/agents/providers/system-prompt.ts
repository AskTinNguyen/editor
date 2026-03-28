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

/** Maximum number of nodes to include in the compact scene dump. */
const SCENE_DUMP_LIMIT = 50

/**
 * Build a compact representation of scene nodes for inclusion in the prompt.
 * Extracts only the fields the LLM needs per node type, keeping the token
 * count manageable.
 */
function buildCompactSceneDump(nodes: Record<string, SceneNode>): unknown[] {
  const entries = Object.entries(nodes)
  const capped = entries.slice(0, SCENE_DUMP_LIMIT)

  return capped.map(([id, node]) => {
    const compact: Record<string, unknown> = { id, type: node.type }
    if (node.parentId) compact.parentId = node.parentId

    // Include key geometry fields per type
    switch (node.type) {
      case 'wall':
        compact.start = node.start
        compact.end = node.end
        if (node.thickness != null) compact.thickness = node.thickness
        if (node.height != null) compact.height = node.height
        break
      case 'zone':
        compact.name = node.name
        compact.polygon = node.polygon
        break
      case 'slab':
      case 'ceiling':
        compact.polygon = node.polygon
        if (node.height != null) compact.height = node.height
        break
      case 'door':
      case 'window':
        compact.wallId = node.wallId
        compact.width = node.width
        compact.height = node.height
        if (node.position) compact.position = node.position
        break
      case 'item':
        if (node.position) compact.position = node.position
        if (node.asset && typeof node.asset === 'object') {
          const a = node.asset as Record<string, unknown>
          compact.asset = { id: a.id, name: a.name }
        }
        break
      case 'level':
        if (node.level != null) compact.level = node.level
        break
      case 'building':
        if (node.position) compact.position = node.position
        break
      case 'roof':
        if (node.position) compact.position = node.position
        break
      case 'roof-segment':
        if (node.roofType) compact.roofType = node.roofType
        break
      case 'guide':
      case 'scan':
        if (node.url) compact.url = node.url
        break
    }

    return compact
  })
}

// ---------------------------------------------------------------------------
// Node schema reference — all 14 types
// ---------------------------------------------------------------------------

const NODE_SCHEMA_REFERENCE = `## Node Schemas (for create-node)

Every node MUST have: object: "node", id: "{type}_{unique}", type: "{type}", parentId: null, visible: true, metadata: {}, children: []

### site (root node)
The top-level container. Usually one per project.
Example: { object: "node", id: "site_001", type: "site", parentId: null, visible: true, metadata: {}, children: [] }

### building (parent: site)
Optional: position: [x, y, z], rotation: [x, y, z]
Example: { object: "node", id: "building_001", type: "building", parentId: "site_001", visible: true, metadata: {}, children: [] }

### level (parent: building)
Optional: level: number (floor number, default 0)
Example: { object: "node", id: "level_001", type: "level", parentId: "building_001", visible: true, metadata: {}, children: [], level: 0 }

### wall (parent: level)
Required: start: [x, z], end: [x, z]
Optional: thickness (meters, default 0.15), height (meters, default 2.8)
Children: doors, windows, items attached to wall
Example: { object: "node", id: "wall_001", type: "wall", parentId: "level_001", visible: true, metadata: {}, children: [], start: [0, 0], end: [5, 0], thickness: 0.15, height: 2.8 }

### zone (parent: level)
Required: name: string, polygon: [[x,z], [x,z], ...]
Optional: color (hex, default "#3b82f6")
Example: { object: "node", id: "zone_001", type: "zone", parentId: "level_001", visible: true, metadata: {}, children: [], name: "Living Room", polygon: [[0,0], [5,0], [5,4], [0,4]] }

### slab (parent: level)
Required: polygon: [[x,z], ...]
Optional: elevation (default 0.05), holes: [polygon, ...]
Example: { object: "node", id: "slab_001", type: "slab", parentId: "level_001", visible: true, metadata: {}, children: [], polygon: [[0,0], [5,0], [5,4], [0,4]] }

### ceiling (parent: level)
Required: polygon: [[x,z], ...]
Optional: height (default 2.5), holes: [polygon, ...]
Example: { object: "node", id: "ceiling_001", type: "ceiling", parentId: "level_001", visible: true, metadata: {}, children: [], polygon: [[0,0], [5,0], [5,4], [0,4]], height: 2.5 }

### door (parent: wall — set BOTH parentId AND wallId to the wall ID)
Optional: width (0.9), height (2.1), position: [x,y,z], side: "front"|"back", wallId: "wall_xxx", hingesSide: "left"|"right", swingDirection: "inward"|"outward"
Example: { object: "node", id: "door_001", type: "door", parentId: "wall_001", visible: true, metadata: {}, children: [], wallId: "wall_001", width: 0.9, height: 2.1, position: [2.5, 0, 0] }

### window (parent: wall — set BOTH parentId AND wallId to the wall ID)
Optional: width (1.5), height (1.5), position: [x,y,z], side: "front"|"back", wallId: "wall_xxx"
Example: { object: "node", id: "window_001", type: "window", parentId: "wall_001", visible: true, metadata: {}, children: [], wallId: "wall_001", width: 1.5, height: 1.5, position: [2, 1, 0] }

### item (parent: level or wall)
Required: asset: { id, category, name, thumbnail, src, dimensions: [w,h,d] }
Optional: position: [x,y,z], rotation: [x,y,z], scale: [x,y,z]
Note: Items need a 3D model asset — for now just use position/rotation to place items.
Example: { object: "node", id: "item_001", type: "item", parentId: "level_001", visible: true, metadata: {}, children: [], position: [2.5, 0, 2] }

### roof (parent: level)
Children: roof-segment nodes
Optional: position: [x,y,z], rotation: number
Example: { object: "node", id: "roof_001", type: "roof", parentId: "level_001", visible: true, metadata: {}, children: [] }

### roof-segment (parent: roof)
Optional: roofType: "gable"|"hip"|"shed"|"flat"|"gambrel"|"dutch"|"mansard", width, depth, wallHeight, roofHeight
Example: { object: "node", id: "roof-segment_001", type: "roof-segment", parentId: "roof_001", visible: true, metadata: {}, children: [] }

### guide (parent: level)
Required: url: string (image URL)
Optional: position: [x,y,z], rotation: [x,y,z], scale: [x,y,z], opacity (0-100)
Example: { object: "node", id: "guide_001", type: "guide", parentId: "level_001", visible: true, metadata: {}, children: [], url: "https://example.com/floorplan.png" }

### scan (parent: level)
Required: url: string (model URL)
Optional: position: [x,y,z], rotation: [x,y,z], scale: [x,y,z], opacity (0-100)
Example: { object: "node", id: "scan_001", type: "scan", parentId: "level_001", visible: true, metadata: {}, children: [], url: "https://example.com/scan.glb" }`

// ---------------------------------------------------------------------------
// All 14 node type names (for validation)
// ---------------------------------------------------------------------------

export const ALL_NODE_TYPES = [
  'site',
  'building',
  'level',
  'wall',
  'zone',
  'slab',
  'ceiling',
  'door',
  'window',
  'item',
  'roof',
  'roof-segment',
  'guide',
  'scan',
] as const

/**
 * Build the system prompt for the Pascal agent.
 *
 * Includes:
 * - Role and context
 * - Current project ID
 * - Compact scene dump (up to 50 nodes) so the LLM can skip scene_read
 * - Scene graph hierarchy explanation
 * - Complete node schema reference for all 14 node types
 * - Available tools and scene commands
 * - Selection context (when applicable)
 * - Important rules for node creation and mutation
 */
export function buildSystemPrompt(
  sceneContext: unknown,
  selectionContext?: { selectedNodeIds: string[]; selectedNodeTypes: string[] },
  projectId?: string,
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

  // Build compact scene dump
  let sceneDumpSection = ''
  if (nodeCount > 0) {
    const compact = buildCompactSceneDump(nodes)
    const truncated = nodeCount > SCENE_DUMP_LIMIT
    sceneDumpSection = truncated
      ? `\nShowing first ${SCENE_DUMP_LIMIT} of ${nodeCount} nodes:\n\`\`\`json\n${JSON.stringify(compact, null, 1)}\n\`\`\``
      : `\n\`\`\`json\n${JSON.stringify(compact, null, 1)}\n\`\`\``
  }

  // Selection section
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
Coordinates are in meters on the XZ plane (Y is up).

## Current Project
${projectId ? `Project ID: ${projectId} — use this ID for all tool calls.` : 'Project ID will be provided in the user message.'}

## Current Scene
${nodeCount} nodes of types: ${nodeTypeSummary}
Level nodes: ${levelIdList}${sceneDumpSection}
${selectionSection}
## Available Tools
- project_read(projectId): Read project name and full scene graph. Returns { name: string, scene: { nodes, rootNodeIds } }.
- scene_read(projectId): Read only the scene graph. Returns { nodes: Record<id, Node>, rootNodeIds: string[] }. Use this to get precise coordinates before making changes.
- scene_applyCommands(projectId, commands): Apply mutations atomically. Commands is an array and they execute in order.

## Scene Commands
Each command in the commands array must be one of:

### create-node
{ type: "create-node", parentId: "level_xxx", node: { ...full node object } }
Note: The parentId in the command is what matters for placement — the parentId inside the node object is set by the system.

### update-node
{ type: "update-node", nodeId: "wall_xxx", patch: { start: [1, 0], end: [6, 0] } }
NOTE: Cannot patch id, type, parentId, children, or object fields.

### move-node
{ type: "move-node", nodeId: "wall_xxx", newParentId: "level_yyy" }

### delete-node
{ type: "delete-node", nodeId: "wall_xxx" }

${NODE_SCHEMA_REFERENCE}

## Important Rules
1. Node IDs must use the format {type}_{unique_suffix} — e.g., wall_001, zone_kitchen, door_front
2. Always set object: "node" on every node
3. Always provide parentId in the command for create-node (usually a level ID)
4. Commands are validated atomically — if any fails, all roll back
5. When creating doors/windows on a wall, set BOTH parentId AND wallId to the wall's ID
6. For rooms: create 4 walls, a slab, a ceiling, and a zone
7. Coordinates are in meters, XZ plane (Y is up)
8. Call scene_read first if you need precise coordinates of existing nodes that are not shown in the scene dump above`
}
