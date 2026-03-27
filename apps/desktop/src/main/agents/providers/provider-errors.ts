// ---------------------------------------------------------------------------
// Typed error hierarchy for LLM provider failures
// ---------------------------------------------------------------------------

export type ProviderErrorCode =
  | 'auth_failed'
  | 'rate_limited'
  | 'network_error'
  | 'model_not_found'
  | 'context_too_long'
  | 'provider_error'

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

// ---------------------------------------------------------------------------
// Anthropic SDK error mapping
// ---------------------------------------------------------------------------

/**
 * Map an Anthropic SDK error to a typed ProviderError.
 * The SDK throws typed error classes like AuthenticationError, RateLimitError, etc.
 */
export function mapAnthropicError(err: unknown): ProviderError {
  if (err instanceof Error) {
    const name = err.name || err.constructor.name
    const message = err.message

    if (
      name === 'AuthenticationError' ||
      message.includes('401') ||
      message.includes('authentication')
    ) {
      return new ProviderError(
        'auth_failed',
        `Anthropic authentication failed: ${message}`,
        err,
      )
    }
    if (
      name === 'RateLimitError' ||
      message.includes('429') ||
      message.includes('rate')
    ) {
      return new ProviderError(
        'rate_limited',
        `Rate limited by Anthropic: ${message}`,
        err,
      )
    }
    if (
      name === 'APIConnectionError' ||
      message.includes('ECONNREFUSED') ||
      message.includes('fetch failed')
    ) {
      return new ProviderError(
        'network_error',
        `Failed to connect to Anthropic API: ${message}`,
        err,
      )
    }
    if (message.includes('not found') || message.includes('does not exist')) {
      return new ProviderError(
        'model_not_found',
        `Model not found: ${message}`,
        err,
      )
    }
    if (
      message.includes('too long') ||
      message.includes('context length') ||
      message.includes('max_tokens')
    ) {
      return new ProviderError(
        'context_too_long',
        `Context too long: ${message}`,
        err,
      )
    }
  }

  return new ProviderError(
    'provider_error',
    err instanceof Error ? err.message : String(err),
    err,
  )
}

// ---------------------------------------------------------------------------
// OpenAI SDK error mapping
// ---------------------------------------------------------------------------

/**
 * Map an OpenAI SDK error to a typed ProviderError.
 */
export function mapOpenAIError(err: unknown): ProviderError {
  if (err instanceof Error) {
    const name = err.name || err.constructor.name
    const message = err.message

    if (
      name === 'AuthenticationError' ||
      message.includes('401') ||
      message.includes('Incorrect API key')
    ) {
      return new ProviderError(
        'auth_failed',
        `OpenAI authentication failed: ${message}`,
        err,
      )
    }
    if (
      name === 'RateLimitError' ||
      message.includes('429') ||
      message.includes('Rate limit')
    ) {
      return new ProviderError(
        'rate_limited',
        `Rate limited by OpenAI: ${message}`,
        err,
      )
    }
    if (
      name === 'APIConnectionError' ||
      message.includes('ECONNREFUSED') ||
      message.includes('fetch failed')
    ) {
      return new ProviderError(
        'network_error',
        `Failed to connect to OpenAI API: ${message}`,
        err,
      )
    }
    if (message.includes('does not exist') || message.includes('not found')) {
      return new ProviderError(
        'model_not_found',
        `Model not found: ${message}`,
        err,
      )
    }
    if (
      message.includes('maximum context length') ||
      message.includes('too many tokens')
    ) {
      return new ProviderError(
        'context_too_long',
        `Context too long: ${message}`,
        err,
      )
    }
  }

  return new ProviderError(
    'provider_error',
    err instanceof Error ? err.message : String(err),
    err,
  )
}

// ---------------------------------------------------------------------------
// Vesper Gateway error mapping
// ---------------------------------------------------------------------------

/**
 * Map a Vesper Gateway error. Same as Anthropic (gateway is Anthropic-compatible)
 * but with additional handling for credential discovery failures.
 */
export function mapVesperGatewayError(err: unknown): ProviderError {
  if (err instanceof Error) {
    if (
      err.message.includes('No AI Gateway credentials found') ||
      err.message.includes('credential')
    ) {
      return new ProviderError(
        'auth_failed',
        'Vesper Gateway credentials not found. Run `ai-gateway auth login` or set ANTHROPIC_AUTH_TOKEN.',
        err,
      )
    }
  }
  return mapAnthropicError(err)
}
