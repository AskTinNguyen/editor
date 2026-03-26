import type { AgentSessionEvent } from '../../../shared/agents'

/**
 * Returns true if the event indicates that the agent applied scene commands
 * and the editor should reload the project scene from disk.
 */
export function shouldRefreshScene(event: AgentSessionEvent): boolean {
  return (
    event.type === 'turn-completed' &&
    event.result.sceneCommandsApplied > 0 &&
    event.result.status === 'completed'
  )
}
