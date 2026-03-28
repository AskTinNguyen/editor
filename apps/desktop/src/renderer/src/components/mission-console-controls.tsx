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
  { id: 'off' as const, name: 'No Thinking', icon: '⚡' },
  { id: 'think' as const, name: 'Thinking', icon: '💭' },
  { id: 'max' as const, name: 'Max Thinking', icon: '🧠' },
]

// ---------------------------------------------------------------------------
// MissionConsoleControls — compact model + thinking selector bar
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
    <div className="flex items-center gap-2 px-3 py-1 border-t border-border/30">
      {/* Model selector */}
      <select
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        className="h-6 rounded border border-border/40 bg-background/50 px-1.5 text-[11px] text-foreground/70 focus:border-blue-500/50 focus:outline-none"
      >
        {AVAILABLE_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      {/* Thinking level toggle — segmented control */}
      <div className="flex items-center gap-0.5">
        {THINKING_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              thinkingLevel === level.id
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : 'text-foreground/40 hover:text-foreground/60'
            }`}
            onClick={() => onThinkingLevelChange(level.id)}
            title={level.name}
          >
            {level.name}
          </button>
        ))}
      </div>
    </div>
  )
}
