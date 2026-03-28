// ---------------------------------------------------------------------------
// Model + thinking level types (local until shared/agents.ts exports them)
// ---------------------------------------------------------------------------

export type ThinkingLevel = 'off' | 'think' | 'max'

export type ModelDefinition = {
  id: string
  name: string
  family: string
  contextWindow: number
}

export const AVAILABLE_MODELS: ModelDefinition[] = [
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', family: 'claude', contextWindow: 200000 },
  { id: 'claude-opus-4-6', name: 'Opus 4.6', family: 'claude', contextWindow: 200000 },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', family: 'claude', contextWindow: 200000 },
]

export const THINKING_LEVELS = [
  { id: 'off' as const, label: 'Off' },
  { id: 'think' as const, label: 'Think' },
  { id: 'max' as const, label: 'Max' },
]

// ---------------------------------------------------------------------------
// MissionConsoleControls — model + thinking selector bar
// ---------------------------------------------------------------------------

export function MissionConsoleControls({
  model,
  onModelChange,
  thinkingLevel,
  onThinkingLevelChange,
}: {
  model: string
  onModelChange: (model: string) => void
  thinkingLevel: ThinkingLevel
  onThinkingLevelChange: (level: ThinkingLevel) => void
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border/40 bg-card/80 px-3 py-1.5">
      {/* Model selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-foreground/50">Model</span>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="h-7 rounded-md border border-border/50 bg-background px-2 text-xs text-foreground focus:border-blue-500/50 focus:outline-none"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Thinking level toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-foreground/50">Thinking</span>
        <div className="flex rounded-md border border-border/50 bg-background">
          {THINKING_LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              className={`px-2.5 py-1 text-xs transition-colors first:rounded-l-md last:rounded-r-md ${
                thinkingLevel === level.id
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-foreground/60 hover:bg-accent hover:text-foreground'
              }`}
              onClick={() => onThinkingLevelChange(level.id)}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
