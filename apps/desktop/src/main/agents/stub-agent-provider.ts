import type { PascalAgentProvider } from './agent-provider'

/**
 * Stub agent provider for testing. Generates code that:
 * - Creates a wall when the prompt mentions "wall"
 * - Otherwise just reads the project
 *
 * This will be replaced by real LLM integration later.
 */
export function createStubAgentProvider(): PascalAgentProvider {
  return {
    async generateCode({ projectId, prompt, sceneContext }) {
      if (prompt.toLowerCase().includes('wall')) {
        // Find the level node ID from the scene context
        const scene = sceneContext as {
          nodes: Record<string, { type: string; id: string }>
        }
        const levelNode = Object.values(scene.nodes).find(
          (n) => n.type === 'level',
        )

        if (!levelNode) {
          return `console.error('No level node found in scene')`
        }

        // Generate code that creates a wall via scene_applyCommands
        return `
          const result = await pascal.scene_applyCommands({
            projectId: '${projectId}',
            commands: [
              {
                type: 'create-node',
                parentId: '${levelNode.id}',
                node: {
                  object: 'node',
                  id: 'wall_stub_' + Date.now(),
                  type: 'wall',
                  parentId: null,
                  visible: true,
                  metadata: {},
                  children: [],
                  start: [0, 0],
                  end: [5, 0],
                },
              },
            ],
          })
          console.log('Applied commands:', JSON.stringify(result))
        `
      }

      // Default: just read the project
      return `
        const project = await pascal.project_read('${projectId}')
        console.log('Read project:', project.name)
      `
    },
  }
}
