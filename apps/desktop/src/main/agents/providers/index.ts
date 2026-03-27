import type { PascalAgentProvider } from '../agent-provider'
import { createStubAgentProvider } from '../stub-agent-provider'
import { createAnthropicProvider, type AnthropicProviderConfig } from './anthropic-provider'
import { createOpenAIProvider, type OpenAIProviderConfig } from './openai-provider'
import {
  createVesperGatewayProvider,
  type VesperGatewayProviderConfig,
} from './vesper-gateway-provider'

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

export type ProviderId = 'stub' | 'anthropic' | 'openai' | 'vesper-gateway'

export type ProviderConfig =
  | { provider: 'stub' }
  | { provider: 'anthropic'; config: AnthropicProviderConfig }
  | { provider: 'openai'; config: OpenAIProviderConfig }
  | { provider: 'vesper-gateway'; config?: VesperGatewayProviderConfig }

export function createProvider(selection: ProviderConfig): PascalAgentProvider {
  switch (selection.provider) {
    case 'stub':
      return createStubAgentProvider()
    case 'anthropic':
      return createAnthropicProvider(selection.config)
    case 'openai':
      return createOpenAIProvider(selection.config)
    case 'vesper-gateway':
      return createVesperGatewayProvider(selection.config)
    default: {
      const _exhaustive: never = selection
      throw new Error(`Unknown provider: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

// Re-exports for convenience
export { createAnthropicProvider, type AnthropicProviderConfig } from './anthropic-provider'
export { createOpenAIProvider, type OpenAIProviderConfig } from './openai-provider'
export {
  createVesperGatewayProvider,
  type VesperGatewayProviderConfig,
} from './vesper-gateway-provider'
export { getAiGatewayCredentials } from './ai-gateway-credentials'
