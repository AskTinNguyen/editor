import { useCallback, useRef, useState } from 'react'

export function MissionConsoleComposer({
  onSend,
  disabled,
  uiInspectorAttachment,
  onClearUiInspectorAttachment,
}: {
  onSend: (prompt: string) => void
  disabled: boolean
  uiInspectorAttachment?: { label: string; source: 'dom' | 'scene'; route?: string } | null
  onClearUiInspectorAttachment?: () => void
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      // Cap at 4 lines (approximately 80px)
      el.style.height = `${Math.min(el.scrollHeight, 80)}px`
    }
  }, [])

  return (
    <div className="border-t border-border/40 px-3 py-2">
      {uiInspectorAttachment ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px]">
          <div className="min-w-0">
            <span className="font-medium text-emerald-700">Inspector attached</span>
            <span className="ml-2 text-foreground/70">
              {uiInspectorAttachment.source}
              {' • '}
              {uiInspectorAttachment.label}
              {uiInspectorAttachment.route ? ` • ${uiInspectorAttachment.route}` : ''}
            </span>
          </div>
          <button
            type="button"
            className="shrink-0 text-foreground/50 hover:text-foreground"
            onClick={onClearUiInspectorAttachment}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          className="min-h-[28px] flex-1 resize-none rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/30 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
          placeholder="Ask the agent to modify the scene..."
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="inline-flex h-7 shrink-0 items-center rounded-md bg-blue-600 px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || !value.trim()}
          onClick={handleSend}
        >
          {disabled ? 'Working...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
