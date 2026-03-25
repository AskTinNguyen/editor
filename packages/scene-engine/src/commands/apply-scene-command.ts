import type { ParsedSceneGraph } from '../document/scene-graph'
import type { SceneCommand } from './scene-command'

export function applySceneCommand(
  currentDocument: ParsedSceneGraph | null,
  command: SceneCommand,
): ParsedSceneGraph | null {
  switch (command.type) {
    case 'replace-scene-document':
      return command.document
    case 'clear-scene-document':
      return null
    default: {
      const exhaustiveCheck: never = command
      return exhaustiveCheck satisfies typeof currentDocument
    }
  }
}
