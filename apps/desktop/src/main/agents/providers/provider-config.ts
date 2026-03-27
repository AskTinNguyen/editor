import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { PascalToolCallHandler } from '../agent-provider'
import { createProvider, type ProviderConfig } from './index'

const CONFIG_FILE = '.pascal-agent-config.json'

// ---------------------------------------------------------------------------
// Persisted config shape
// ---------------------------------------------------------------------------

export type PersistedProviderConfig = {
  provider: 'stub' | 'anthropic' | 'openai' | 'vesper-gateway'
  anthropicApiKey?: string
  openaiApiKey?: string
  model?: string
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

export async function loadProviderConfig(
  rootDir: string,
): Promise<PersistedProviderConfig> {
  try {
    const raw = await readFile(join(rootDir, CONFIG_FILE), 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedProviderConfig>
    return {
      provider: parsed.provider ?? 'stub',
      anthropicApiKey: parsed.anthropicApiKey,
      openaiApiKey: parsed.openaiApiKey,
      model: parsed.model,
    }
  } catch {
    return { provider: 'stub' }
  }
}

export async function saveProviderConfig(
  rootDir: string,
  config: PersistedProviderConfig,
): Promise<void> {
  const filePath = join(rootDir, CONFIG_FILE)
  await mkdir(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  await writeFile(tmp, JSON.stringify(config, null, 2), 'utf8')
  await rename(tmp, filePath)
}

// ---------------------------------------------------------------------------
// Resolve a ProviderConfig from persisted config
// ---------------------------------------------------------------------------

/**
 * Convert a PersistedProviderConfig into the ProviderConfig union that
 * `createProvider` accepts. Falls back to env vars when no API key is stored.
 */
export function resolveProviderFromConfig(
  config: PersistedProviderConfig,
): ProviderConfig {
  switch (config.provider) {
    case 'anthropic': {
      const apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new Error('Anthropic API key not configured')
      return {
        provider: 'anthropic',
        config: { apiKey, model: config.model },
      }
    }
    case 'openai': {
      const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('OpenAI API key not configured')
      return {
        provider: 'openai',
        config: { apiKey, model: config.model },
      }
    }
    case 'vesper-gateway':
      return {
        provider: 'vesper-gateway',
        config: { model: config.model },
      }
    case 'stub':
    default:
      return { provider: 'stub' }
  }
}

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------

/**
 * Test if provider credentials are valid. For the stub provider this always
 * succeeds. For real providers we validate config resolution (missing keys
 * will surface as errors) — a lightweight check that avoids API calls.
 */
export async function testProviderConnection(
  config: PersistedProviderConfig,
  _toolHandler: PascalToolCallHandler,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const providerConfig = resolveProviderFromConfig(config)
    // Verify the provider can be instantiated
    createProvider(providerConfig)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
