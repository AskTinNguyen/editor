import { assertSceneGraphIntegrity } from '../document/assert-scene-graph-integrity'
import type { ParsedSceneGraph } from '../document/scene-graph'
import type { SceneCommandBatchResult, SceneCommandResult } from './scene-command-result'
import type { SceneCommand } from './scene-command'

/** A node value from the scene graph (non-nullable). */
type SceneNode = NonNullable<ParsedSceneGraph['nodes'][string]>

export type ApplySceneCommandOutput = {
  document: ParsedSceneGraph | null
  result: SceneCommandResult | SceneCommandBatchResult
}

function ok(commandType: string): SceneCommandResult {
  return { status: 'ok', commandType }
}

function err(commandType: string, error: string): SceneCommandResult {
  return { status: 'error', commandType, error }
}

/**
 * Safely retrieve a node from the nodes record.
 * Returns undefined if the node does not exist.
 */
function getNode(nodes: ParsedSceneGraph['nodes'], id: string): SceneNode | undefined {
  return nodes[id]
}

/**
 * Returns a shallow copy of the nodes record with one node replaced.
 * Never mutates the input.
 */
function withNode(
  nodes: ParsedSceneGraph['nodes'],
  id: string,
  node: SceneNode,
): ParsedSceneGraph['nodes'] {
  return { ...nodes, [id]: node }
}

/**
 * Returns a shallow copy of the nodes record without the given id.
 */
function withoutNode(
  nodes: ParsedSceneGraph['nodes'],
  id: string,
): ParsedSceneGraph['nodes'] {
  const { [id]: _removed, ...rest } = nodes
  return rest
}

/**
 * Get the string children IDs from a node, handling the fact that not all
 * node types declare a children field, and that children can be inline objects.
 */
function getChildIds(node: SceneNode): string[] {
  if ('children' in node && Array.isArray(node.children)) {
    return (node.children as unknown[]).filter(
      (c): c is string => typeof c === 'string',
    )
  }
  return []
}

/**
 * Return a clone of the node with an updated children array.
 * Works for any node type that has a children field.
 */
function withChildren(node: SceneNode, children: string[]): SceneNode {
  return { ...node, children } as unknown as SceneNode
}

/**
 * Validate the graph after mutation. Returns an error result if invalid.
 */
function validateGraph(
  graph: ParsedSceneGraph,
  commandType: string,
): SceneCommandResult | null {
  const integrityErrors = assertSceneGraphIntegrity(graph)
  if (integrityErrors.length > 0) {
    return err(commandType, integrityErrors.map((e) => e.message).join('; '))
  }
  return null
}

export function applySceneCommand(
  currentDocument: ParsedSceneGraph | null,
  command: SceneCommand,
): ApplySceneCommandOutput {
  switch (command.type) {
    case 'replace-scene-document': {
      return { document: command.document, result: ok(command.type) }
    }

    case 'clear-scene-document': {
      return { document: null, result: ok(command.type) }
    }

    case 'create-node': {
      if (currentDocument === null) {
        return {
          document: null,
          result: err(command.type, 'Cannot create a node in a null document'),
        }
      }

      const { node, parentId } = command

      // Check node doesn't already exist
      if (node.id in currentDocument.nodes) {
        return {
          document: currentDocument,
          result: err(command.type, `Node "${node.id}" already exists in the graph`),
        }
      }

      // Check parent exists
      const parent = getNode(currentDocument.nodes, parentId)
      if (!parent) {
        return {
          document: currentDocument,
          result: err(command.type, `Parent node "${parentId}" does not exist in the graph`),
        }
      }

      const parentChildIds = getChildIds(parent)

      // Build new node with parentId set
      const newNode = { ...node, parentId } as unknown as SceneNode

      // Build new parent with child added
      const newParent = withChildren(parent, [...parentChildIds, node.id])

      // Build new graph
      const newNodes = withNode(
        withNode(currentDocument.nodes, node.id, newNode),
        parentId,
        newParent,
      )
      const newDoc: ParsedSceneGraph = {
        ...currentDocument,
        nodes: newNodes,
      }

      const validationError = validateGraph(newDoc, command.type)
      if (validationError) {
        return { document: currentDocument, result: validationError }
      }

      return { document: newDoc, result: ok(command.type) }
    }

    case 'update-node': {
      if (currentDocument === null) {
        return {
          document: null,
          result: err(command.type, 'Cannot update a node in a null document'),
        }
      }

      const { nodeId, patch } = command

      // Check node exists
      const existingNode = getNode(currentDocument.nodes, nodeId)
      if (!existingNode) {
        return {
          document: currentDocument,
          result: err(command.type, `Node "${nodeId}" does not exist in the graph`),
        }
      }

      // Ensure structural fields are not in the patch
      const forbiddenKeys = ['id', 'type', 'parentId', 'children', 'object'] as const
      for (const key of forbiddenKeys) {
        if (key in patch) {
          return {
            document: currentDocument,
            result: err(
              command.type,
              `Cannot update structural field "${key}" via update-node. Use the appropriate command instead.`,
            ),
          }
        }
      }

      const updatedNode = { ...existingNode, ...patch } as unknown as SceneNode

      const newDoc: ParsedSceneGraph = {
        ...currentDocument,
        nodes: withNode(currentDocument.nodes, nodeId, updatedNode),
      }

      return { document: newDoc, result: ok(command.type) }
    }

    case 'move-node': {
      if (currentDocument === null) {
        return {
          document: null,
          result: err(command.type, 'Cannot move a node in a null document'),
        }
      }

      const { nodeId, newParentId } = command

      // Check node exists
      const node = getNode(currentDocument.nodes, nodeId)
      if (!node) {
        return {
          document: currentDocument,
          result: err(command.type, `Node "${nodeId}" does not exist in the graph`),
        }
      }

      // Check new parent exists
      if (!getNode(currentDocument.nodes, newParentId)) {
        return {
          document: currentDocument,
          result: err(command.type, `New parent node "${newParentId}" does not exist in the graph`),
        }
      }

      const oldParentId = node.parentId

      // If moving to the same parent, no-op
      if (oldParentId === newParentId) {
        return { document: currentDocument, result: ok(command.type) }
      }

      let nodes = { ...currentDocument.nodes }

      // Remove from old parent's children
      if (oldParentId !== null && oldParentId !== undefined) {
        const oldParent = getNode(nodes, oldParentId)
        if (oldParent) {
          const oldChildren = getChildIds(oldParent).filter((id) => id !== nodeId)
          nodes = withNode(nodes, oldParentId, withChildren(oldParent, oldChildren))
        }
      }

      // Add to new parent's children
      const newParent = getNode(nodes, newParentId)!
      const newParentChildren = getChildIds(newParent)
      nodes = withNode(nodes, newParentId, withChildren(newParent, [...newParentChildren, nodeId]))

      // Update the node's parentId
      nodes = withNode(nodes, nodeId, { ...node, parentId: newParentId } as unknown as SceneNode)

      const newDoc: ParsedSceneGraph = { ...currentDocument, nodes }

      const validationError = validateGraph(newDoc, command.type)
      if (validationError) {
        return { document: currentDocument, result: validationError }
      }

      return { document: newDoc, result: ok(command.type) }
    }

    case 'delete-node': {
      if (currentDocument === null) {
        return {
          document: null,
          result: err(command.type, 'Cannot delete a node from a null document'),
        }
      }

      const { nodeId } = command

      // Check node exists
      const node = getNode(currentDocument.nodes, nodeId)
      if (!node) {
        return {
          document: currentDocument,
          result: err(command.type, `Node "${nodeId}" does not exist in the graph`),
        }
      }

      let nodes = { ...currentDocument.nodes }
      let rootNodeIds = [...currentDocument.rootNodeIds]

      // Remove from parent's children
      const parentId = node.parentId
      if (parentId !== null && parentId !== undefined) {
        const parent = getNode(nodes, parentId)
        if (parent) {
          const parentChildren = getChildIds(parent).filter((id) => id !== nodeId)
          nodes = withNode(nodes, parentId, withChildren(parent, parentChildren))
        }
      }

      // Remove from rootNodeIds if it's a root
      rootNodeIds = rootNodeIds.filter((id) => id !== nodeId)

      // Remove the node itself
      nodes = withoutNode(nodes, nodeId)

      const newDoc: ParsedSceneGraph = { ...currentDocument, nodes, rootNodeIds }

      return { document: newDoc, result: ok(command.type) }
    }

    case 'batch-commands': {
      const results: (SceneCommandResult | SceneCommandBatchResult)[] = []
      let doc = currentDocument

      for (const subCommand of command.commands) {
        const output = applySceneCommand(doc, subCommand)
        doc = output.document
        results.push(output.result)

        // Stop on first error
        if (output.result.status === 'error') {
          return {
            document: currentDocument, // roll back to original on error
            result: {
              status: 'error',
              commandType: 'batch-commands',
              results,
            } satisfies SceneCommandBatchResult,
          }
        }
      }

      return {
        document: doc,
        result: {
          status: 'ok',
          commandType: 'batch-commands',
          results,
        } satisfies SceneCommandBatchResult,
      }
    }

    default: {
      const exhaustiveCheck: never = command
      return exhaustiveCheck
    }
  }
}
