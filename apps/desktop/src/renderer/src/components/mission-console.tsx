import { useCallback, useState } from 'react'
import { buildUiInspectorContextPayload } from '../../../shared/ui-inspector-context'
import type { UiInspectorSnapshot } from '../../../shared/ui-inspector'
import type { ProjectId } from '../../../shared/projects'
import { useAgentSession } from '../lib/agent-client'
import { MissionConsoleComposer } from './mission-console-composer'
import { type ThinkingLevel, AVAILABLE_MODELS, THINKING_LEVELS } from './mission-console-controls'
import { MissionConsoleLog } from './mission-console-log'
import { MissionConsoleStatus } from './mission-console-status'

export function MissionConsole({
  projectId,
  selectedNodeIds,
  uiInspectorSnapshot,
  onUiInspectorSnapshotSent,
}: {
  projectId: ProjectId
  selectedNodeIds?: string[]
  uiInspectorSnapshot?: UiInspectorSnapshot | null
  onUiInspectorSnapshotSent?: () => void
}) {
  const { session, status, sendMessage, isProcessing } = useAgentSession(projectId)
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('think')

  const handleSend = useCallback(
    (prompt: string) => {
      void (async () => {
        const result = await sendMessage(prompt, {
          selectedNodeIds,
          model,
          thinkingLevel,
          agentContextPrefix: uiInspectorSnapshot
            ? buildUiInspectorContextPayload(uiInspectorSnapshot)
            : undefined,
          uiInspectorAttachment: uiInspectorSnapshot
            ? {
                label: uiInspectorSnapshot.label,
                source: uiInspectorSnapshot.source,
                route: uiInspectorSnapshot.route,
                selector: uiInspectorSnapshot.selector,
                selectedNodeIds: uiInspectorSnapshot.scene?.selectedNodeIds,
              }
            : undefined,
        })

        if (result && uiInspectorSnapshot) {
          onUiInspectorSnapshotSent?.()
        }
      })
    },
    [
      model,
      onUiInspectorSnapshotSent,
      selectedNodeIds,
      sendMessage,
      thinkingLevel,
      uiInspectorSnapshot,
    ],
  )

  return (
    <div className="relative z-20 flex max-h-72 flex-col border-t-2 border-blue-500/30 bg-card">
      {/* Top row: status + model/thinking controls inline */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 py-1.5">
        <MissionConsoleStatus status={status} />

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-6 rounded-md border border-border/50 bg-background px-1.5 text-[11px] text-foreground focus:border-blue-500/50 focus:outline-none"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* Thinking toggle */}
          <div className="flex rounded-md border border-border/50 overflow-hidden">
            {THINKING_LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                className={`px-2 py-0.5 text-[11px] transition-colors ${
                  thinkingLevel === level.id
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-background text-foreground/60 hover:bg-accent hover:text-foreground'
                }`}
                onClick={() => setThinkingLevel(level.id)}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat log — scrollable */}
      <MissionConsoleLog
        messages={session?.messages ?? []}
        lastTurnResult={session?.lastTurnResult ?? null}
      />

      {/* Composer — fixed at bottom */}
      <div className="shrink-0">
        <MissionConsoleComposer
          onSend={handleSend}
          disabled={isProcessing}
          uiInspectorAttachment={
            uiInspectorSnapshot
              ? {
                  label: uiInspectorSnapshot.label,
                  source: uiInspectorSnapshot.source,
                  route: uiInspectorSnapshot.route,
                }
              : null
          }
          onClearUiInspectorAttachment={onUiInspectorSnapshotSent}
        />
      </div>
    </div>
  )
}
