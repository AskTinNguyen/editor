import type { ParsedSceneGraph } from './scene-graph'

export type IntegrityError = {
  code: string
  message: string
  nodeId?: string
}

/**
 * Extract string child IDs from a node, ignoring inline object children.
 */
function getChildIds(node: Record<string, unknown>): string[] {
  if ('children' in node && Array.isArray(node.children)) {
    return (node.children as unknown[]).filter(
      (c): c is string => typeof c === 'string',
    )
  }
  return []
}

/**
 * Validates the structural integrity of a parsed scene graph.
 *
 * Checks:
 * - Every node's children exist in the nodes record
 * - Every node with a parentId has that parent in the nodes record
 * - Every node with a parentId appears in that parent's children array
 * - Root nodes have null parentId
 * - No orphan nodes (every non-root node is reachable from a root)
 *
 * Returns an empty array when the graph is valid.
 */
export function assertSceneGraphIntegrity(graph: ParsedSceneGraph): IntegrityError[] {
  const errors: IntegrityError[] = []
  const referencedByParent = new Set<string>()

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    // Check children exist
    const childIds = getChildIds(node as Record<string, unknown>)
    for (const childId of childIds) {
      if (!(childId in graph.nodes)) {
        errors.push({
          code: 'MISSING_CHILD',
          message: `Node "${nodeId}" references child "${childId}" which does not exist in the graph`,
          nodeId,
        })
      } else {
        referencedByParent.add(childId)
      }
    }

    // Check parentId references a valid node
    if (node.parentId !== null && node.parentId !== undefined) {
      if (!(node.parentId in graph.nodes)) {
        errors.push({
          code: 'MISSING_PARENT',
          message: `Node "${nodeId}" references parent "${node.parentId}" which does not exist in the graph`,
          nodeId,
        })
      } else {
        // Check that the parent's children array contains this node
        const parent = graph.nodes[node.parentId]
        if (parent) {
          const parentChildIds = getChildIds(parent as Record<string, unknown>)
          if (!parentChildIds.includes(nodeId)) {
            errors.push({
              code: 'NOT_IN_PARENT_CHILDREN',
              message: `Node "${nodeId}" has parentId "${node.parentId}" but is not in that parent's children array`,
              nodeId,
            })
          }
        }
      }
    }

    // Check root nodes have null parentId
    if (graph.rootNodeIds.includes(nodeId)) {
      if (node.parentId !== null && node.parentId !== undefined) {
        errors.push({
          code: 'ROOT_HAS_PARENT',
          message: `Root node "${nodeId}" has a non-null parentId "${node.parentId}"`,
          nodeId,
        })
      }
    }
  }

  // Check for orphan nodes (not a root, and not referenced by any parent's children)
  for (const nodeId of Object.keys(graph.nodes)) {
    if (!graph.rootNodeIds.includes(nodeId) && !referencedByParent.has(nodeId)) {
      errors.push({
        code: 'ORPHAN_NODE',
        message: `Node "${nodeId}" is neither a root node nor referenced in any parent's children array`,
        nodeId,
      })
    }
  }

  return errors
}
