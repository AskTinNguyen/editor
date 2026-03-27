import { useCallback } from 'react'
import type { ProjectId } from '../../../shared/projects'
import { useAgentSession } from '../lib/agent-client'
import { MissionConsoleComposer } from './mission-console-composer'
import { MissionConsoleLog } from './mission-console-log'
import { MissionConsoleStatus } from './mission-console-status'

export function MissionConsole({
  projectId,
  selectedNodeIds,
}: {
  projectId: ProjectId
  selectedNodeIds?: string[]
}) {
  const { session, status, sendMessage, isProcessing } = useAgentSession(projectId)

  const handleSend = useCallback(
    (prompt: string) => {
      sendMessage(prompt, { selectedNodeIds })
    },
    [sendMessage, selectedNodeIds],
  )

  return (
    <div className="flex flex-col border-t border-border/60 bg-card">
      <MissionConsoleStatus status={status} />
      <MissionConsoleLog
        messages={session?.messages ?? []}
        lastTurnResult={session?.lastTurnResult ?? null}
      />
      <MissionConsoleComposer onSend={handleSend} disabled={isProcessing} />
    </div>
  )
}
