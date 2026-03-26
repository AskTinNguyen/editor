import type { AnyNode } from '../schema/types'
import type { ParsedSceneGraph } from '../document/scene-graph'

/**
 * Patch type for node updates. Excludes structural fields that must not
 * be mutated via a generic patch: id, type, parentId, children, object.
 */
export type SceneNodePatch = Partial<
  Omit<AnyNode, 'id' | 'type' | 'parentId' | 'children' | 'object'>
>

/** Document-level commands (can operate on null documents) */
export type DocumentCommand =
  | { type: 'replace-scene-document'; document: ParsedSceneGraph }
  | { type: 'clear-scene-document' }

/** Node-level commands (require a non-null document) */
export type NodeCommand =
  | { type: 'create-node'; node: AnyNode; parentId: string }
  | { type: 'update-node'; nodeId: string; patch: SceneNodePatch }
  | { type: 'move-node'; nodeId: string; newParentId: string }
  | { type: 'delete-node'; nodeId: string }

/** Batch command — applies multiple commands in sequence */
export type BatchCommand = {
  type: 'batch-commands'
  commands: SceneCommand[]
}

export type SceneCommand = DocumentCommand | NodeCommand | BatchCommand
