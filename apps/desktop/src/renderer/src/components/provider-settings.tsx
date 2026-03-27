import { useCallback, useEffect, useState } from 'react'

type PersistedProviderConfig = {
  provider: 'stub' | 'anthropic' | 'openai' | 'vesper-gateway'
  anthropicApiKey?: string
  openaiApiKey?: string
  model?: string
}

type ConnectionStatus = 'untested' | 'ok' | 'error'

const PROVIDERS = [
  { value: 'stub' as const, label: 'Stub', description: 'No API key needed' },
  { value: 'anthropic' as const, label: 'Anthropic Claude', description: 'Requires API key' },
  { value: 'openai' as const, label: 'OpenAI GPT', description: 'Requires API key' },
  {
    value: 'vesper-gateway' as const,
    label: 'Vesper AI Gateway',
    description: 'Auto-discovers',
  },
] as const

export interface ProviderSettingsProps {
  open: boolean
  onClose: () => void
}

export function ProviderSettings({ open, onClose }: ProviderSettingsProps) {
  const [provider, setProvider] = useState<PersistedProviderConfig['provider']>('stub')
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [model, setModel] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('untested')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // Load persisted config when panel opens
  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function load() {
      try {
        const config = await window.pascalDesktop.agents?.getProviderConfig?.()
        if (cancelled || !config) return
        setProvider(config.provider ?? 'stub')
        setAnthropicApiKey(config.anthropicApiKey ?? '')
        setOpenaiApiKey(config.openaiApiKey ?? '')
        setModel(config.model ?? '')
      } catch {
        // API may not exist yet — leave defaults
      }
      setConnectionStatus('untested')
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open])

  // Escape key closes
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const handleTestConnection = useCallback(async () => {
    setTesting(true)
    setConnectionStatus('untested')
    try {
      const result = await window.pascalDesktop.agents?.testProviderConnection?.({
        provider,
        anthropicApiKey: provider === 'anthropic' ? anthropicApiKey : undefined,
        openaiApiKey: provider === 'openai' ? openaiApiKey : undefined,
        model: model || undefined,
      })
      setConnectionStatus(result?.ok ? 'ok' : 'error')
    } catch {
      setConnectionStatus('error')
    } finally {
      setTesting(false)
    }
  }, [provider, anthropicApiKey, openaiApiKey, model])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await window.pascalDesktop.agents?.setProviderConfig?.({
        provider,
        anthropicApiKey: provider === 'anthropic' ? anthropicApiKey : undefined,
        openaiApiKey: provider === 'openai' ? openaiApiKey : undefined,
        model: model || undefined,
      })
      onClose()
    } catch {
      // Silently fail — API may not exist yet
    } finally {
      setSaving(false)
    }
  }, [provider, anthropicApiKey, openaiApiKey, model, onClose])

  if (!open) return null

  const needsApiKey = provider === 'anthropic' || provider === 'openai'
  const statusColor =
    connectionStatus === 'ok'
      ? 'bg-green-500'
      : connectionStatus === 'error'
        ? 'bg-red-500'
        : 'bg-gray-400'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        role="presentation"
      />

      {/* Panel — right-side slide-over */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
          <span className="font-semibold text-sm text-foreground">Provider Settings</span>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Provider radio group */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-foreground/70 mb-1">Provider</legend>
            {PROVIDERS.map((p) => (
              <label
                key={p.value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  provider === p.value
                    ? 'border-foreground/30 bg-accent/40'
                    : 'border-border/60 hover:bg-accent/20'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.value}
                  checked={provider === p.value}
                  onChange={() => {
                    setProvider(p.value)
                    setConnectionStatus('untested')
                  }}
                  className="mt-0.5 accent-foreground"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-foreground">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                </div>
              </label>
            ))}
          </fieldset>

          {/* Conditional API key input */}
          {needsApiKey && (
            <div className="space-y-1">
              <label
                htmlFor="api-key-input"
                className="text-xs font-medium text-foreground/70"
              >
                {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
              </label>
              <input
                id="api-key-input"
                type="password"
                value={provider === 'anthropic' ? anthropicApiKey : openaiApiKey}
                onChange={(e) => {
                  if (provider === 'anthropic') {
                    setAnthropicApiKey(e.target.value)
                  } else {
                    setOpenaiApiKey(e.target.value)
                  }
                  setConnectionStatus('untested')
                }}
                placeholder="sk-..."
                className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none"
              />
            </div>
          )}

          {/* Model override */}
          <div className="space-y-1">
            <label
              htmlFor="model-override-input"
              className="text-xs font-medium text-foreground/70"
            >
              Model Override{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="model-override-input"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. claude-sonnet-4-20250514"
              className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none"
            />
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing}
              onClick={handleTestConnection}
              className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-foreground hover:bg-accent/40 transition-colors disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`} />
            {connectionStatus === 'ok' && (
              <span className="text-xs text-green-500">Connected</span>
            )}
            {connectionStatus === 'error' && (
              <span className="text-xs text-red-500">Failed</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/60 px-3 py-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
