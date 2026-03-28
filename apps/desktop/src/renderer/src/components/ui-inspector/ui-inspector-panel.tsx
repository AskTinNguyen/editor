import type { UiInspectorSnapshot, UiInspectorState } from '../../../../shared/ui-inspector'

export function UiInspectorPanel({
  state,
  attachedSnapshot,
  onToggleMode,
  onAttachSnapshot,
  onCopyContext,
  onClear,
}: {
  state: UiInspectorState
  attachedSnapshot: UiInspectorSnapshot | null
  onToggleMode: () => void
  onAttachSnapshot: () => void
  onCopyContext: () => void
  onClear: () => void
}) {
  const snapshot = state.snapshot

  return (
    <aside
      className="absolute top-4 right-4 z-50 w-80 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-xl backdrop-blur"
      data-ui-inspector-chrome="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm text-foreground">UI Inspector</p>
          <p className="text-xs text-muted-foreground">
            {state.mode === 'inspect' ? 'Click any UI or canvas area to capture.' : 'Ready'}
          </p>
        </div>
        <button
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            state.mode === 'inspect'
              ? 'bg-sky-600 text-white'
              : 'bg-accent text-foreground hover:bg-accent/80'
          }`}
          onClick={onToggleMode}
          type="button"
        >
          {state.mode === 'inspect' ? 'Stop' : 'Inspect'}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-border/50 bg-background/60 p-3">
        {snapshot ? (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-accent px-2 py-0.5 uppercase tracking-wide">
                {snapshot.source}
              </span>
              {snapshot.route ? <span>{snapshot.route}</span> : null}
            </div>
            <p className="mt-2 font-medium text-sm text-foreground">{snapshot.label}</p>
            {snapshot.selector ? (
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                {snapshot.selector}
              </p>
            ) : null}
            {snapshot.scene?.selectedNodeIds?.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                nodes: {snapshot.scene.selectedNodeIds.join(', ')}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No capture yet.</p>
        )}
      </div>

      {attachedSnapshot ? (
        <p className="mt-3 text-xs text-emerald-600">Attached to mission console draft.</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!snapshot}
          onClick={onAttachSnapshot}
          type="button"
        >
          Send to Agent
        </button>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!snapshot}
          onClick={onCopyContext}
          type="button"
        >
          Copy Context
        </button>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!snapshot && !attachedSnapshot}
          onClick={onClear}
          type="button"
        >
          Clear
        </button>
      </div>
    </aside>
  )
}
