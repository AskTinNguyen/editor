import type { PascalAgentProvider } from './agent-provider'

/**
 * Stub agent provider for testing and development.
 *
 * - Prompt contains "wall" → creates a wall node via scene_applyCommands
 * - Otherwise → reads the project and returns a summary
 *
 * Uses the host tool callbacks directly (no worker sandbox needed).
 */
export function createStubAgentProvider(): PascalAgentProvider {
  return {
    name: 'stub',

    async runTurn({ projectId, prompt, sceneContext, tools }) {
      let toolCallsExecuted = 0

      if (prompt.toLowerCase().includes('wall')) {
        const scene = sceneContext as {
          nodes: Record<string, { type: string; id: string }>
        }
        const levelNode = Object.values(scene.nodes).find((n) => n.type === 'level')

        if (!levelNode) {
          return {
            response: 'No level node found in the scene to add a wall to.',
            toolCallsExecuted: 0,
          }
        }

        const wallId = `wall_stub_${Date.now()}`
        await tools.scene_applyCommands({
          projectId,
          commands: [
            {
              type: 'create-node',
              parentId: levelNode.id,
              node: {
                object: 'node',
                id: wallId,
                type: 'wall',
                parentId: null,
                visible: true,
                metadata: {},
                children: [],
                start: [0, 0],
                end: [5, 0],
              },
            } as any,
          ],
        })
        toolCallsExecuted = 1

        return {
          response: `Created wall ${wallId} on level ${levelNode.id}.`,
          toolCallsExecuted,
        }
      }

      // Default: read the project
      const project = await tools.project_read(projectId)
      toolCallsExecuted = 1

      return {
        response: `Read project "${project.name}" with ${Object.keys((project.scene as any)?.nodes ?? {}).length} nodes.`,
        toolCallsExecuted,
      }
    },
  }
}
