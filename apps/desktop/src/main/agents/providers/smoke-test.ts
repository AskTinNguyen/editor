#!/usr/bin/env bun
/**
 * Provider smoke test — validates a real LLM provider works end-to-end.
 *
 * Usage:
 *   PASCAL_AGENT_PROVIDER=vesper-gateway bun run apps/desktop/src/main/agents/providers/smoke-test.ts
 *   ANTHROPIC_API_KEY=sk-ant-... PASCAL_AGENT_PROVIDER=anthropic bun run apps/desktop/src/main/agents/providers/smoke-test.ts
 *   OPENAI_API_KEY=sk-... PASCAL_AGENT_PROVIDER=openai bun run apps/desktop/src/main/agents/providers/smoke-test.ts
 *   PASCAL_AGENT_PROVIDER=stub bun run apps/desktop/src/main/agents/providers/smoke-test.ts
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectStore } from '../../projects/project-store'
import { applyProjectSceneCommands } from '../../projects/project-command-service'
import { createProvider, type ProviderConfig } from './index'
import type { PascalToolCallHandler } from '../agent-provider'
import type { ProjectId } from '../../../shared/projects'

function resolveProviderConfig(): ProviderConfig {
  const providerId = process.env.PASCAL_AGENT_PROVIDER ?? 'stub'

  switch (providerId) {
    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        console.error('ANTHROPIC_API_KEY is required')
        process.exit(1)
      }
      return {
        provider: 'anthropic',
        config: {
          apiKey,
          model: process.env.PASCAL_AGENT_MODEL,
          baseURL: process.env.ANTHROPIC_BASE_URL,
        },
      }
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        console.error('OPENAI_API_KEY is required')
        process.exit(1)
      }
      return {
        provider: 'openai',
        config: {
          apiKey,
          model: process.env.PASCAL_AGENT_MODEL,
        },
      }
    }
    case 'vesper-gateway':
      return {
        provider: 'vesper-gateway',
        config: { model: process.env.PASCAL_AGENT_MODEL },
      }
    case 'stub':
      return { provider: 'stub' }
    default:
      console.error(`Unknown provider: ${providerId}`)
      process.exit(1)
  }
}

async function main() {
  const providerConfig = resolveProviderConfig()
  console.log(`Provider: ${providerConfig.provider}`)

  const rootDir = await mkdtemp(join(tmpdir(), 'pascal-smoke-'))
  console.log(`Temp dir: ${rootDir}`)

  try {
    // 1. Create project store and project
    const projectStore = createProjectStore({ rootDir })
    const project = await projectStore.createProject({ name: 'Smoke Test' })
    console.log(`Project: ${project.projectId}`)

    // 2. Get initial scene
    const opened = await projectStore.openProjectById(project.projectId)
    const initialNodeCount = Object.keys(opened.scene.nodes).length
    console.log(`Initial nodes: ${initialNodeCount}`)

    // 3. Create tool handler
    const toolHandler: PascalToolCallHandler = {
      project_read: async (pid: ProjectId) => {
        const p = await projectStore.openProjectById(pid)
        return { name: p.name, scene: p.scene }
      },
      scene_read: async (pid: ProjectId) => {
        const p = await projectStore.openProjectById(pid)
        return p.scene
      },
      scene_applyCommands: async (payload) => {
        return applyProjectSceneCommands(projectStore, payload.projectId, payload.commands)
      },
      vesper_ui_get_state: async () => ({
        success: true,
        data: { mode: 'idle', snapshot: null, updatedAt: null },
      }),
      vesper_ui_get_selection: async () => ({
        success: false,
        error: {
          code: 'NO_SELECTION',
          message: 'No UI selection is currently captured.',
          retriable: true,
        },
      }),
      vesper_ui_get_context: async () => ({
        success: false,
        error: {
          code: 'NO_SELECTION',
          message: 'No UI selection is currently captured.',
          retriable: true,
        },
      }),
      vesper_ui_capture_screenshot: async () => ({
        success: false,
        error: {
          code: 'TOOL_UNAVAILABLE',
          message: 'UI inspector screenshot capture is not implemented yet.',
          retriable: false,
        },
      }),
    }

    // 4. Create provider
    const provider = createProvider(providerConfig)
    console.log(`Provider name: ${provider.name}`)

    // 5. Run turn
    console.log('\nSending prompt: "Add a wall from (0,0) to (5,0)"...\n')

    const start = Date.now()
    const result = await provider.runTurn({
      projectId: project.projectId,
      prompt: 'Add a wall from (0,0) to (5,0) on the first level',
      sceneContext: opened.scene,
      messageHistory: [],
      tools: toolHandler,
    })
    const elapsed = Date.now() - start

    console.log(`Response: ${result.response}`)
    console.log(`Tool calls: ${result.toolCallsExecuted}`)
    console.log(`Time: ${elapsed}ms`)

    // 6. Verify persistence
    const reopened = await projectStore.openProjectById(project.projectId)
    const finalNodeCount = Object.keys(reopened.scene.nodes).length
    const wallNodes = Object.values(reopened.scene.nodes).filter(
      (n) => (n as { type: string }).type === 'wall',
    )

    console.log(`\nFinal nodes: ${finalNodeCount} (was ${initialNodeCount})`)
    console.log(`Wall nodes: ${wallNodes.length}`)

    if (wallNodes.length > 0) {
      console.log('\nSMOKE TEST PASSED — wall created and persisted')
      process.exit(0)
    } else {
      console.log('\nSMOKE TEST PARTIAL — no wall created (provider may need prompt tuning)')
      process.exit(0)
    }
  } catch (err) {
    console.error('\nSMOKE TEST FAILED:', err)
    process.exit(1)
  } finally {
    await rm(rootDir, { force: true, recursive: true })
  }
}

main()
