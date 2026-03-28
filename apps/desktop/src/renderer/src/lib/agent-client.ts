import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AgentSession,
  AgentSessionEvent,
  AgentSessionStatus,
  ThinkingLevel,
  AgentTurnResult,
  PascalDesktopAgentsApi,
} from '../../../shared/agents'
import type { ProjectId } from '../../../shared/projects'
import type { UiInspectorAttachment } from '../../../shared/ui-inspector'

/**
 * Returns the renderer-side agents API exposed by the preload script.
 */
export function getAgentClient(): PascalDesktopAgentsApi {
  return (window as unknown as { pascalDesktop: { agents: PascalDesktopAgentsApi } }).pascalDesktop
    .agents
}

/**
 * React hook that manages an agent session for a given project.
 *
 * - Loads the session on mount (and when projectId changes).
 * - Subscribes to real-time session events and keeps local state in sync.
 * - Provides a `sendMessage` helper that forwards prompts to the main process.
 * - Exposes `isProcessing` derived from the current status.
 */
export function useAgentSession(projectId: ProjectId | null) {
  const [session, setSession] = useState<AgentSession | null>(null)
  const [status, setStatus] = useState<AgentSessionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Keep a ref to the latest projectId so callbacks always close over the
  // current value without needing to re-subscribe on every render.
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId

  // ── Load session + subscribe to events ──────────────────────────────
  useEffect(() => {
    if (!projectId) {
      setSession(null)
      setStatus('idle')
      setError(null)
      return
    }

    let cancelled = false
    const client = getAgentClient()

    // Initial load
    client
      .getSession(projectId)
      .then((s) => {
        if (cancelled) return
        setSession(s)
        setStatus(s.status)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      })

    // Live subscription
    const unsubscribe = client.subscribe(projectId, (event: AgentSessionEvent) => {
      if (cancelled) return

      switch (event.type) {
        case 'status-changed':
          setStatus(event.status)
          setSession((prev) => (prev ? { ...prev, status: event.status } : prev))
          break

        case 'message-added':
          setSession((prev) =>
            prev ? { ...prev, messages: [...prev.messages, event.message] } : prev,
          )
          break

        case 'turn-completed':
          setSession((prev) => (prev ? { ...prev, lastTurnResult: event.result } : prev))
          if (event.result.status === 'error') {
            setError(event.result.error ?? 'Agent turn failed')
          }
          break

        // execution-log entries are informational — we don't store them in
        // the session state because the full log is already in lastTurnResult.
        case 'execution-log':
          break
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [projectId])

  // ── Send a user prompt ──────────────────────────────────────────────
  const sendMessage = useCallback(
    async (
      prompt: string,
      options?: {
        selectedNodeIds?: string[]
        model?: string
        thinkingLevel?: ThinkingLevel
        agentContextPrefix?: string
        uiInspectorAttachment?: UiInspectorAttachment
      },
    ): Promise<AgentTurnResult | null> => {
      const pid = projectIdRef.current
      if (!pid) return null

      setError(null)
      try {
        const result = await getAgentClient().sendMessage(pid, prompt, options)
        return result
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setStatus('error')
        return null
      }
    },
    [],
  )

  // ── Derived state ───────────────────────────────────────────────────
  const isProcessing = status === 'reading' || status === 'planning' || status === 'applying'

  return { session, status, error, sendMessage, isProcessing } as const
}
