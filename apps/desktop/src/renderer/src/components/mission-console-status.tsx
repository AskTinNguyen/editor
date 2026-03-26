import type { AgentSessionStatus } from '../../../shared/agents'

const STATUS_CONFIG: Record<AgentSessionStatus, { color: string; label: string }> = {
  idle: { color: 'bg-gray-400', label: 'Ready' },
  reading: { color: 'bg-blue-500', label: 'Reading project...' },
  planning: { color: 'bg-blue-500', label: 'Planning changes...' },
  applying: { color: 'bg-amber-500', label: 'Applying changes...' },
  completed: { color: 'bg-green-500', label: 'Done' },
  error: { color: 'bg-red-500', label: 'Error' },
}

export function MissionConsoleStatus({ status }: { status: AgentSessionStatus }) {
  const config = STATUS_CONFIG[status]

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/70">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${config.color}`} />
      <span className="select-none font-medium">{config.label}</span>
      {(status === 'reading' || status === 'planning' || status === 'applying') && (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent opacity-50" />
      )}
    </div>
  )
}
