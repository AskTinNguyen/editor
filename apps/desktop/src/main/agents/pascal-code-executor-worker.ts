/**
 * Pascal Code Executor Worker
 *
 * Runs in a worker_threads isolate. Receives agent-generated code from the
 * main thread, creates a `pascal` proxy object that routes tool calls back
 * to the host, captures console output, and executes the code.
 */

import { parentPort } from 'node:worker_threads'

if (!parentPort) {
  throw new Error(
    'pascal-code-executor-worker must be run inside a Worker thread'
  )
}

const port = parentPort

// ---------------------------------------------------------------------------
// Pending tool-call resolution map
// ---------------------------------------------------------------------------
const pendingCalls = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
>()

function callTool(tool: string, args: unknown): Promise<unknown> {
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    pendingCalls.set(id, { resolve, reject })
    port.postMessage({ type: 'tool-call', id, tool, args })
  })
}

// ---------------------------------------------------------------------------
// Handle messages from the main thread
// ---------------------------------------------------------------------------
port.on('message', async (msg: unknown) => {
  const message = msg as Record<string, unknown>

  // Tool result coming back from host
  if (message.type === 'tool-result') {
    const pending = pendingCalls.get(message.id as string)
    if (pending) {
      pendingCalls.delete(message.id as string)
      pending.resolve(message.result)
    }
    return
  }

  // Tool error coming back from host
  if (message.type === 'tool-error') {
    const pending = pendingCalls.get(message.id as string)
    if (pending) {
      pendingCalls.delete(message.id as string)
      pending.reject(new Error(message.error as string))
    }
    return
  }

  // Execute code request
  if (message.type === 'execute') {
    const code = message.code as string
    const projectId = message.projectId as string

    // Build the pascal proxy object with whitelisted tool methods
    const pascal = {
      project_read: () => callTool('project_read', { projectId }),
      scene_read: () => callTool('scene_read', { projectId }),
      scene_applyCommands: (payload: {
        projectId?: string
        commands: unknown[]
      }) =>
        callTool('scene_applyCommands', {
          projectId: payload.projectId ?? projectId,
          commands: payload.commands,
        }),
    }

    // Capture console output
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    }

    for (const level of ['log', 'warn', 'error'] as const) {
      console[level] = (...args: unknown[]) => {
        port.postMessage({
          type: 'console',
          level,
          args: args.map((a) => {
            try {
              // Ensure args are serializable
              return JSON.parse(JSON.stringify(a))
            } catch {
              return String(a)
            }
          }),
        })
      }
    }

    try {
      // Wrap the code in an async function so `await` works at the top level
      const asyncFn = new Function('pascal', `return (async () => {\n${code}\n})()`)
      await asyncFn(pascal)

      port.postMessage({ type: 'done' })
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      port.postMessage({ type: 'error', error })
    } finally {
      // Restore console
      console.log = originalConsole.log
      console.warn = originalConsole.warn
      console.error = originalConsole.error
    }
  }
})

// Signal that the worker is ready
port.postMessage({ type: 'ready' })
