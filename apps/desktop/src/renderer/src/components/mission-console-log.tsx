import { useEffect, useRef, useState } from 'react'
import type { AgentMessage, AgentTurnResult, ExecutionLogEntry } from '../../../shared/agents'

// ── Execution log row ───────────────────────────────────────────────────
function ExecutionLogRow({ entry }: { entry: ExecutionLogEntry }) {
  switch (entry.type) {
    case 'tool-call':
      return (
        <div className="flex items-start gap-1.5 text-[11px] text-foreground/50">
          <span className="shrink-0 font-mono text-blue-400">call</span>
          <span className="truncate font-mono">
            {entry.tool}({Object.keys(entry.args).join(', ')})
          </span>
        </div>
      )
    case 'tool-result':
      return (
        <div className="flex items-start gap-1.5 text-[11px] text-foreground/50">
          <span className="shrink-0 font-mono text-green-400">result</span>
          <span className="truncate font-mono">{entry.tool}</span>
        </div>
      )
    case 'console':
      return (
        <div className="flex items-start gap-1.5 text-[11px] text-foreground/50">
          <span
            className={`shrink-0 font-mono ${
              entry.level === 'error'
                ? 'text-red-400'
                : entry.level === 'warn'
                  ? 'text-amber-400'
                  : 'text-foreground/40'
            }`}
          >
            {entry.level}
          </span>
          <span className="truncate font-mono">{entry.args.map(String).join(' ')}</span>
        </div>
      )
    case 'scene-commands-applied':
      return (
        <div className="flex items-start gap-1.5 text-[11px] text-foreground/50">
          <span className="shrink-0 font-mono text-purple-400">scene</span>
          <span className="truncate font-mono">commands applied</span>
        </div>
      )
  }
}

// ── Turn result summary card ────────────────────────────────────────────
function TurnResultCard({ result }: { result: AgentTurnResult }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mx-3 my-1.5 rounded-md border border-border/40 bg-card/80 text-xs">
      {/* Summary header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            result.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="flex-1 text-foreground/80">{result.summary}</span>
        {result.sceneCommandsApplied > 0 && (
          <span className="shrink-0 rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
            {result.sceneCommandsApplied} scene cmd{result.sceneCommandsApplied !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error message */}
      {result.error && (
        <div className="border-t border-border/30 px-2.5 py-1.5 text-red-400">
          {result.error}
        </div>
      )}

      {/* Expandable execution log */}
      {result.executionLog.length > 0 && (
        <>
          <button
            type="button"
            className="flex w-full items-center gap-1 border-t border-border/30 px-2.5 py-1 text-[10px] text-foreground/40 hover:text-foreground/60"
            onClick={() => setExpanded((prev) => !prev)}
          >
            <span
              className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              ▸
            </span>
            <span>
              {result.executionLog.length} log entr
              {result.executionLog.length === 1 ? 'y' : 'ies'}
            </span>
          </button>

          {expanded && (
            <div className="max-h-40 space-y-0.5 overflow-y-auto border-t border-border/20 px-2.5 py-1.5">
              {result.executionLog.map((entry, i) => (
                <ExecutionLogRow key={`${entry.timestamp}-${i}`} entry={entry} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Message bubble ──────────────────────────────────────────────────────
function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-3 py-0.5`}>
      <div
        className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
          isUser
            ? 'bg-blue-600/20 text-foreground/90'
            : 'bg-foreground/5 text-foreground/80'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}

// ── Main log component ──────────────────────────────────────────────────
export function MissionConsoleLog({
  messages,
  lastTurnResult,
}: {
  messages: AgentMessage[]
  lastTurnResult: AgentTurnResult | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length, lastTurnResult])

  if (messages.length === 0 && !lastTurnResult) {
    return null
  }

  return (
    <div ref={scrollRef} className="max-h-48 flex-1 overflow-y-auto py-1">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {lastTurnResult && <TurnResultCard result={lastTurnResult} />}
    </div>
  )
}
