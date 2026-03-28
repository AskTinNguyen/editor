import { useCallback, useState } from 'react'
import type { ProjectId } from '../../../shared/projects'
import { useAgentSession } from '../lib/agent-client'
import { MissionConsoleComposer } from './mission-console-composer'
import { MissionConsoleControls, type ThinkingLevel } from './mission-console-controls'
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
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('think')

  const handleSend = useCallback(
    (prompt: string) => {
      sendMessage(prompt, { selectedNodeIds, model, thinkingLevel })
    },
    [sendMessage, selectedNodeIds, model, thinkingLevel],
  )

  return (
    <div className="flex flex-col border-t border-border/60 bg-card">
      <MissionConsoleStatus status={status} />
      <MissionConsoleLog
        messages={session?.messages ?? []}
        lastTurnResult={session?.lastTurnResult ?? null}
      />
      <MissionConsoleControls
        model={model}
        onModelChange={setModel}
        thinkingLevel={thinkingLevel}
        onThinkingLevelChange={setThinkingLevel}
      />
      <MissionConsoleComposer onSend={handleSend} disabled={isProcessing} />
    </div>
  )
}
