import type { ProjectId } from '../../shared/projects'

/**
 * A provider generates executable code from a user prompt and project context.
 * The session manager calls the provider to get code, then runs it through
 * the pascal_execute gateway.
 *
 * The first implementation is a stub. Real LLM providers (Anthropic, etc.)
 * will implement this interface later.
 */
export type PascalAgentProvider = {
  /**
   * Generate executable code from a user prompt.
   * The code will be run in a worker_threads isolate with access to:
   * - pascal.project_read(projectId)
   * - pascal.scene_read(projectId)
   * - pascal.scene_applyCommands({ projectId, commands })
   */
  generateCode(params: {
    projectId: ProjectId
    prompt: string
    sceneContext: unknown
  }): Promise<string>
}
