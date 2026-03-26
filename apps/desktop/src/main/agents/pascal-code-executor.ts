/**
 * Pascal Code Executor
 *
 * Host-side code execution gateway. Validates agent-generated code, spawns
 * a worker_threads isolate to run it, routes tool calls back through host
 * callbacks, enforces timeouts, and returns structured results.
 */

import { Worker } from 'node:worker_threads'
import type { ProjectId } from '../../shared/projects'
import type {
  ExecutionLogEntry,
  PascalExecuteRequest,
  PascalExecuteResult,
  PascalProxyTools,
} from '../../shared/agents'

const DEFAULT_TIMEOUT_MS = 30_000

const WORKER_PATH = new URL(
  './pascal-code-executor-worker.ts',
  import.meta.url
).href

/**
 * Validate JavaScript syntax by attempting `new Function(code)`.
 * Returns null if valid, or an error message if invalid.
 */
function validateSyntax(code: string): string | null {
  try {
    // Wrap in async function body to allow top-level await
    new Function(`return (async () => {\n${code}\n})()`)
    return null
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      return err.message
    }
    return String(err)
  }
}

export type PascalCodeExecutor = {
  execute: (request: PascalExecuteRequest) => Promise<PascalExecuteResult>
}

/**
 * Creates a Pascal code executor backed by the given proxy tools.
 */
export function createPascalCodeExecutor(
  tools: PascalProxyTools
): PascalCodeExecutor {
  return {
    execute: async (
      request: PascalExecuteRequest
    ): Promise<PascalExecuteResult> => {
      const { code, projectId, timeoutMs = DEFAULT_TIMEOUT_MS } = request
      const logs: ExecutionLogEntry[] = []

      // ---------------------------------------------------------------
      // 1. Validate syntax before spawning a worker
      // ---------------------------------------------------------------
      const syntaxError = validateSyntax(code)
      if (syntaxError) {
        return {
          status: 'error',
          logs,
          error: `SyntaxError: ${syntaxError}`,
        }
      }

      // ---------------------------------------------------------------
      // 2. Spawn worker
      // ---------------------------------------------------------------
      return new Promise<PascalExecuteResult>((resolve) => {
        let settled = false

        const worker = new Worker(WORKER_PATH)

        // Timeout guard
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            worker.terminate()
            resolve({
              status: 'timeout',
              logs,
              error: `Execution timed out after ${timeoutMs}ms`,
            })
          }
        }, timeoutMs)

        function finish(result: PascalExecuteResult) {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            worker.terminate()
            resolve(result)
          }
        }

        // ---------------------------------------------------------------
        // 3. Handle messages from the worker
        // ---------------------------------------------------------------
        worker.on('message', async (msg: Record<string, unknown>) => {
          if (settled) return

          switch (msg.type) {
            case 'ready': {
              // Worker is initialized — send the code
              worker.postMessage({ type: 'execute', code, projectId })
              break
            }

            case 'tool-call': {
              const { id, tool, args } = msg as {
                id: string
                tool: string
                args: Record<string, unknown>
              }

              logs.push({
                type: 'tool-call',
                tool,
                args,
                timestamp: new Date().toISOString(),
              })

              try {
                let result: unknown

                switch (tool) {
                  case 'project_read':
                    result = await tools.project_read(
                      (args as { projectId: ProjectId }).projectId
                    )
                    break
                  case 'scene_read':
                    result = await tools.scene_read(
                      (args as { projectId: ProjectId }).projectId
                    )
                    break
                  case 'scene_applyCommands':
                    result = await tools.scene_applyCommands(
                      args as Parameters<PascalProxyTools['scene_applyCommands']>[0]
                    )
                    break
                  default:
                    throw new Error(`Unknown tool: ${tool}`)
                }

                logs.push({
                  type: 'tool-result',
                  tool,
                  result,
                  timestamp: new Date().toISOString(),
                })

                if (!settled) {
                  worker.postMessage({
                    type: 'tool-result',
                    id,
                    result,
                  })
                }
              } catch (err: unknown) {
                const error =
                  err instanceof Error ? err.message : String(err)

                if (!settled) {
                  worker.postMessage({
                    type: 'tool-error',
                    id,
                    error,
                  })
                }
              }
              break
            }

            case 'console': {
              const { level, args: consoleArgs } = msg as {
                level: 'log' | 'warn' | 'error'
                args: unknown[]
              }
              logs.push({
                type: 'console',
                level,
                args: consoleArgs,
                timestamp: new Date().toISOString(),
              })
              break
            }

            case 'done': {
              finish({ status: 'completed', logs })
              break
            }

            case 'error': {
              finish({
                status: 'error',
                logs,
                error: msg.error as string,
              })
              break
            }
          }
        })

        // ---------------------------------------------------------------
        // 4. Handle worker errors and exit
        // ---------------------------------------------------------------
        worker.on('error', (err: Error) => {
          finish({
            status: 'error',
            logs,
            error: err.message,
          })
        })

        worker.on('exit', (exitCode: number) => {
          if (!settled && exitCode !== 0) {
            finish({
              status: 'error',
              logs,
              error: `Worker exited with code ${exitCode}`,
            })
          }
        })
      })
    },
  }
}
