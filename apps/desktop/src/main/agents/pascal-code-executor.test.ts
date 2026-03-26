import { describe, expect, mock, test } from 'bun:test'
import type { PascalProxyTools } from '../../shared/agents'
import { createPascalCodeExecutor } from './pascal-code-executor'

function createMockTools(): PascalProxyTools {
  return {
    project_read: mock(async () => ({ name: 'test', scene: {} })),
    scene_read: mock(async () => ({})),
    scene_applyCommands: mock(async () => ({ status: 'ok', result: {} })),
  }
}

describe('PascalCodeExecutor', () => {
  test('invalid code is rejected before execution', async () => {
    const tools = createMockTools()
    const executor = createPascalCodeExecutor(tools)

    const result = await executor.execute({
      code: 'const x = {;',
      projectId: 'proj-1',
    })

    expect(result.status).toBe('error')
    expect(result.error).toContain('SyntaxError')
    // No tools should have been called
    expect(tools.project_read).not.toHaveBeenCalled()
    expect(tools.scene_read).not.toHaveBeenCalled()
    expect(tools.scene_applyCommands).not.toHaveBeenCalled()
  })

  test('the worker times out when timeout is exceeded', async () => {
    const tools = createMockTools()
    const executor = createPascalCodeExecutor(tools)

    const result = await executor.execute({
      code: 'await new Promise(r => setTimeout(r, 60000))',
      projectId: 'proj-1',
      timeoutMs: 200,
    })

    expect(result.status).toBe('timeout')
    expect(result.error).toContain('timed out')
  })

  test('scene_applyCommands routes through host callback', async () => {
    const tools = createMockTools()
    const executor = createPascalCodeExecutor(tools)

    const result = await executor.execute({
      code: `
        const res = await pascal.scene_applyCommands({
          commands: [{ type: 'add-wall', data: {} }]
        });
      `,
      projectId: 'proj-1',
      timeoutMs: 5000,
    })

    expect(result.status).toBe('completed')
    expect(tools.scene_applyCommands).toHaveBeenCalledTimes(1)

    // Verify the tool call is logged
    const toolCallLog = result.logs.find(
      (l) => l.type === 'tool-call' && l.tool === 'scene_applyCommands'
    )
    expect(toolCallLog).toBeDefined()

    const toolResultLog = result.logs.find(
      (l) => l.type === 'tool-result' && l.tool === 'scene_applyCommands'
    )
    expect(toolResultLog).toBeDefined()
  })

  test('console output is captured into structured logs', async () => {
    const tools = createMockTools()
    const executor = createPascalCodeExecutor(tools)

    const result = await executor.execute({
      code: `
        console.log('hello');
        console.warn('be careful');
        console.error('oops');
      `,
      projectId: 'proj-1',
      timeoutMs: 5000,
    })

    expect(result.status).toBe('completed')

    const consoleLogs = result.logs.filter((l) => l.type === 'console')
    expect(consoleLogs.length).toBe(3)

    const logEntry = consoleLogs.find(
      (l) => l.type === 'console' && l.level === 'log'
    )
    expect(logEntry).toBeDefined()
    if (logEntry && logEntry.type === 'console') {
      expect(logEntry.args).toEqual(['hello'])
    }

    const warnEntry = consoleLogs.find(
      (l) => l.type === 'console' && l.level === 'warn'
    )
    expect(warnEntry).toBeDefined()
    if (warnEntry && warnEntry.type === 'console') {
      expect(warnEntry.args).toEqual(['be careful'])
    }

    const errorEntry = consoleLogs.find(
      (l) => l.type === 'console' && l.level === 'error'
    )
    expect(errorEntry).toBeDefined()
    if (errorEntry && errorEntry.type === 'console') {
      expect(errorEntry.args).toEqual(['oops'])
    }
  })

  test('completed execution returns clean result', async () => {
    const tools = createMockTools()
    const executor = createPascalCodeExecutor(tools)

    const result = await executor.execute({
      code: 'const x = 1 + 1',
      projectId: 'proj-1',
      timeoutMs: 5000,
    })

    expect(result.status).toBe('completed')
    expect(result.error).toBeUndefined()
    expect(result.logs).toEqual([])
  })
})
