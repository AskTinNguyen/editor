import {
  applySceneCommand,
  type SceneCommand,
  type SceneCommandBatchResult,
  type SceneCommandResult,
} from '@pascal/scene-engine'
import type { ProjectCommandResult, ProjectId } from '../../shared/projects'
import type { createProjectStore } from './project-store'

type ProjectStore = ReturnType<typeof createProjectStore>

/**
 * Applies scene commands to a project in a trusted Electron-main context.
 *
 * 1. Loads the current project document from disk via the project store.
 * 2. Wraps the incoming commands in a batch-commands command.
 * 3. Applies the batch via applySceneCommand from @pascal/scene-engine.
 * 4. If any command errors, returns the error result WITHOUT persisting.
 * 5. If all commands succeed, persists the resulting document via the store.
 * 6. Returns a typed result payload to the caller.
 */
export async function applyProjectSceneCommands(
  store: ProjectStore,
  projectId: ProjectId,
  commands: SceneCommand[],
): Promise<ProjectCommandResult> {
  const project = await store.openProjectById(projectId)

  const batchCommand: SceneCommand = {
    type: 'batch-commands',
    commands,
  }

  const { document: nextDocument, result } = applySceneCommand(project.scene, batchCommand)

  if (result.status === 'error') {
    return { status: 'error', result: result as SceneCommandResult | SceneCommandBatchResult }
  }

  // On success, nextDocument is guaranteed non-null since we started with a non-null document
  // and only node/batch commands can be in the batch (not clear-scene-document).
  // ParsedSceneGraph conforms to SceneDocument, so we can pass it directly.
  await store.saveProjectScene(projectId, nextDocument!)

  return { status: 'ok', result: result as SceneCommandResult | SceneCommandBatchResult }
}
