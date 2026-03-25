import type { ParsedSceneGraph } from '../document/scene-graph'

export type SceneCommand =
  | { type: 'replace-scene-document'; document: ParsedSceneGraph }
  | { type: 'clear-scene-document' }
