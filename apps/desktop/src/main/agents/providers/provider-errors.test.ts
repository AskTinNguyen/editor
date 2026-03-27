import { describe, expect, test } from 'bun:test'
import {
  ProviderError,
  mapAnthropicError,
  mapOpenAIError,
  mapVesperGatewayError,
} from './provider-errors'

// ---------------------------------------------------------------------------
// Mock SDK error classes — simulate the shapes thrown by real SDKs
// ---------------------------------------------------------------------------

class MockAuthenticationError extends Error {
  constructor(message = 'authentication failed') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

class MockRateLimitError extends Error {
  constructor(message = 'rate limited') {
    super(message)
    this.name = 'RateLimitError'
  }
}

class MockAPIConnectionError extends Error {
  constructor(message = 'connection refused') {
    super(message)
    this.name = 'APIConnectionError'
  }
}

// ---------------------------------------------------------------------------
// ProviderError
// ---------------------------------------------------------------------------

describe('ProviderError', () => {
  test('is an instance of Error', () => {
    const err = new ProviderError('auth_failed', 'bad key')
    expect(err).toBeInstanceOf(Error)
  })

  test('has correct name, code, message, and cause', () => {
    const cause = new Error('original')
    const err = new ProviderError('rate_limited', 'slow down', cause)

    expect(err.name).toBe('ProviderError')
    expect(err.code).toBe('rate_limited')
    expect(err.message).toBe('slow down')
    expect(err.cause).toBe(cause)
  })
})

// ---------------------------------------------------------------------------
// mapAnthropicError
// ---------------------------------------------------------------------------

describe('mapAnthropicError', () => {
  test('maps AuthenticationError to auth_failed', () => {
    const result = mapAnthropicError(new MockAuthenticationError())
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('auth_failed')
    expect(result.message).toContain('Anthropic authentication failed')
  })

  test('maps 401 message to auth_failed', () => {
    const result = mapAnthropicError(new Error('HTTP 401 Unauthorized'))
    expect(result.code).toBe('auth_failed')
  })

  test('maps RateLimitError to rate_limited', () => {
    const result = mapAnthropicError(new MockRateLimitError())
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('rate_limited')
    expect(result.message).toContain('Rate limited by Anthropic')
  })

  test('maps 429 message to rate_limited', () => {
    const result = mapAnthropicError(new Error('HTTP 429 Too Many Requests'))
    expect(result.code).toBe('rate_limited')
  })

  test('maps APIConnectionError to network_error', () => {
    const result = mapAnthropicError(new MockAPIConnectionError())
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('network_error')
    expect(result.message).toContain('Failed to connect to Anthropic API')
  })

  test('maps ECONNREFUSED to network_error', () => {
    const result = mapAnthropicError(new Error('connect ECONNREFUSED 127.0.0.1:443'))
    expect(result.code).toBe('network_error')
  })

  test('maps fetch failed to network_error', () => {
    const result = mapAnthropicError(new Error('fetch failed'))
    expect(result.code).toBe('network_error')
  })

  test('maps model not found to model_not_found', () => {
    const result = mapAnthropicError(new Error('model claude-3-fake not found'))
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('model_not_found')
    expect(result.message).toContain('Model not found')
  })

  test('maps "does not exist" to model_not_found', () => {
    const result = mapAnthropicError(new Error('The model does not exist'))
    expect(result.code).toBe('model_not_found')
  })

  test('maps context length errors to context_too_long', () => {
    const result = mapAnthropicError(
      new Error('prompt is too long: exceeds context length'),
    )
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('context_too_long')
    expect(result.message).toContain('Context too long')
  })

  test('maps max_tokens message to context_too_long', () => {
    const result = mapAnthropicError(new Error('max_tokens exceeded'))
    expect(result.code).toBe('context_too_long')
  })

  test('maps unknown errors to provider_error', () => {
    const result = mapAnthropicError(new Error('something unexpected'))
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('provider_error')
    expect(result.message).toBe('something unexpected')
    expect(result.cause).toBeInstanceOf(Error)
  })

  test('handles non-Error values', () => {
    const result = mapAnthropicError('string error')
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('provider_error')
    expect(result.message).toBe('string error')
    expect(result.cause).toBe('string error')
  })

  test('handles null/undefined values', () => {
    const result = mapAnthropicError(null)
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('provider_error')
    expect(result.message).toBe('null')
  })
})

// ---------------------------------------------------------------------------
// mapOpenAIError
// ---------------------------------------------------------------------------

describe('mapOpenAIError', () => {
  test('maps AuthenticationError to auth_failed', () => {
    const result = mapOpenAIError(new MockAuthenticationError('Incorrect API key provided'))
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('auth_failed')
    expect(result.message).toContain('OpenAI authentication failed')
  })

  test('maps 401 errors to auth_failed', () => {
    const result = mapOpenAIError(new Error('HTTP 401 Unauthorized'))
    expect(result.code).toBe('auth_failed')
  })

  test('maps "Incorrect API key" to auth_failed', () => {
    const result = mapOpenAIError(new Error('Incorrect API key provided: sk-...abc'))
    expect(result.code).toBe('auth_failed')
  })

  test('maps RateLimitError to rate_limited', () => {
    const result = mapOpenAIError(new MockRateLimitError('Rate limit reached'))
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('rate_limited')
    expect(result.message).toContain('Rate limited by OpenAI')
  })

  test('maps 429 errors to rate_limited', () => {
    const result = mapOpenAIError(new Error('HTTP 429 Too Many Requests'))
    expect(result.code).toBe('rate_limited')
  })

  test('maps "Rate limit" message to rate_limited', () => {
    const result = mapOpenAIError(new Error('Rate limit exceeded'))
    expect(result.code).toBe('rate_limited')
  })

  test('maps APIConnectionError to network_error', () => {
    const result = mapOpenAIError(new MockAPIConnectionError())
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('network_error')
    expect(result.message).toContain('Failed to connect to OpenAI API')
  })

  test('maps connection errors to network_error', () => {
    const result = mapOpenAIError(new Error('connect ECONNREFUSED'))
    expect(result.code).toBe('network_error')
  })

  test('maps "does not exist" to model_not_found', () => {
    const result = mapOpenAIError(new Error('The model gpt-5-fake does not exist'))
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('model_not_found')
  })

  test('maps "maximum context length" to context_too_long', () => {
    const result = mapOpenAIError(
      new Error("This model's maximum context length is 8192 tokens"),
    )
    expect(result.code).toBe('context_too_long')
  })

  test('maps "too many tokens" to context_too_long', () => {
    const result = mapOpenAIError(new Error('too many tokens in the request'))
    expect(result.code).toBe('context_too_long')
  })

  test('maps unknown errors to provider_error', () => {
    const result = mapOpenAIError(new Error('something else'))
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('provider_error')
    expect(result.message).toBe('something else')
  })

  test('handles non-Error values', () => {
    const result = mapOpenAIError(42)
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('provider_error')
    expect(result.message).toBe('42')
  })
})

// ---------------------------------------------------------------------------
// mapVesperGatewayError
// ---------------------------------------------------------------------------

describe('mapVesperGatewayError', () => {
  test('maps "No AI Gateway credentials found" to auth_failed', () => {
    const result = mapVesperGatewayError(
      new Error('No AI Gateway credentials found'),
    )
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('auth_failed')
    expect(result.message).toContain('Vesper Gateway credentials not found')
    expect(result.message).toContain('ai-gateway auth login')
  })

  test('maps credential-related errors to auth_failed', () => {
    const result = mapVesperGatewayError(
      new Error('Failed to read credential from keychain'),
    )
    expect(result.code).toBe('auth_failed')
    expect(result.message).toContain('Vesper Gateway credentials not found')
  })

  test('falls through to Anthropic error mapping for SDK errors', () => {
    const result = mapVesperGatewayError(new MockRateLimitError())
    expect(result).toBeInstanceOf(ProviderError)
    expect(result.code).toBe('rate_limited')
    expect(result.message).toContain('Rate limited by Anthropic')
  })

  test('falls through to Anthropic mapping for auth errors', () => {
    const result = mapVesperGatewayError(new MockAuthenticationError())
    expect(result.code).toBe('auth_failed')
    expect(result.message).toContain('Anthropic authentication failed')
  })

  test('falls through to Anthropic mapping for unknown errors', () => {
    const result = mapVesperGatewayError(new Error('unexpected failure'))
    expect(result.code).toBe('provider_error')
    expect(result.message).toBe('unexpected failure')
  })
})
