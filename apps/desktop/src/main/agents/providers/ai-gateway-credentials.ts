/**
 * AI Gateway credential discovery for Pascal Desktop.
 *
 * Discovers auth token from:
 * 1. Environment variable: ANTHROPIC_AUTH_TOKEN
 * 2. macOS Keychain: service "ai-gateway" or "cliproxy", account "prod"
 * 3. File store: ~/.config/{ai-gateway|cliproxy}/secrets.json
 *
 * Discovers base URL from:
 * 1. Environment variable: ANTHROPIC_BASE_URL
 * 2. Config file: ~/.config/cliproxy/config.json (profiles.prod.base_url)
 * 3. Default: https://ai-gateway.atherlabs.com
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_BASE_URL = 'https://ai-gateway.atherlabs.com'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiGatewayCredentials = {
  authToken: string
  baseUrl: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getConfigDir(): string {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support')
  }
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
}

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

function readTokenFromKeychain(service: string): string | null {
  if (process.platform !== 'darwin') return null
  try {
    const out = execSync(
      `security find-generic-password -a prod -s ${JSON.stringify(service)} -w`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return out.trim() || null
  } catch {
    return null
  }
}

function readTokenFromFileStore(service: string): string | null {
  const secretsPath = join(getConfigDir(), service, 'secrets.json')
  const data = readJson<Record<string, string>>(secretsPath)
  return data?.prod?.trim() || null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover the AI Gateway base URL.
 *
 * Resolution order:
 * 1. `ANTHROPIC_BASE_URL` environment variable
 * 2. `~/.config/cliproxy/config.json` → `profiles.prod.base_url`
 * 3. Default: `https://ai-gateway.atherlabs.com`
 */
export function getAiGatewayBaseUrl(): string {
  // 1. Environment variable
  if (process.env.ANTHROPIC_BASE_URL) {
    return process.env.ANTHROPIC_BASE_URL.replace(/\/+$/, '')
  }

  // 2. Config file
  const configPath = join(getConfigDir(), 'cliproxy', 'config.json')
  const cfg = readJson<{ profiles?: Record<string, { base_url?: string }> }>(configPath)
  const fromConfig = cfg?.profiles?.prod?.base_url
  if (fromConfig?.trim()) {
    return fromConfig.trim().replace(/\/+$/, '')
  }

  return DEFAULT_BASE_URL
}

/**
 * Discover the AI Gateway auth token.
 *
 * Resolution order:
 * 1. `ANTHROPIC_AUTH_TOKEN` environment variable
 * 2. macOS Keychain: service `ai-gateway` or `cliproxy`, account `prod`
 * 3. File store: `~/.config/{ai-gateway|cliproxy}/secrets.json` → key `prod`
 */
export function getAiGatewayToken(): string | null {
  // 1. Environment variable
  if (process.env.ANTHROPIC_AUTH_TOKEN) {
    return process.env.ANTHROPIC_AUTH_TOKEN
  }

  // 2. macOS Keychain
  const fromKeychain =
    readTokenFromKeychain('ai-gateway') || readTokenFromKeychain('cliproxy')
  if (fromKeychain) return fromKeychain

  // 3. File store
  return (
    readTokenFromFileStore('ai-gateway') ||
    readTokenFromFileStore('cliproxy') ||
    null
  )
}

/**
 * Discover both base URL and auth token for the AI Gateway.
 * Returns `null` if no auth token can be found.
 */
export function getAiGatewayCredentials(): AiGatewayCredentials | null {
  const authToken = getAiGatewayToken()
  if (!authToken) return null
  return { authToken, baseUrl: getAiGatewayBaseUrl() }
}
