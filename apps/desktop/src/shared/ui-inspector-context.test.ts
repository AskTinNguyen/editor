import { describe, expect, test } from 'bun:test'
import { buildUiInspectorContextPayload, redactInspectorText } from './ui-inspector-context'

describe('ui inspector context', () => {
  test('redacts secret-like substrings and trims excerpts', () => {
    const payload = buildUiInspectorContextPayload({
      source: 'dom',
      label: 'API Key field',
      route: '/desktop/editor',
      selector: '#api-key',
      textSnippet: 'token=abc123 secret=wow',
      htmlExcerpt: '<input value="abc123" />',
      bounds: { x: 1, y: 2, width: 3, height: 4 },
    })

    expect(payload).toContain('UI_INSPECTOR_CONTEXT')
    expect(payload).toContain('token=[REDACTED]')
    expect(payload).toContain('secret=[REDACTED]')
    expect(payload).toContain('value="[REDACTED]"')
  })

  test('redacts sensitive query params and caps large excerpts', () => {
    const longText = `before?token=abc123&safe=ok ${'x'.repeat(500)}`
    const longHtml = `<div data-token="abc123">${'y'.repeat(3000)}</div>`

    const payload = buildUiInspectorContextPayload({
      source: 'dom',
      label: 'Long content',
      selector: '#long',
      textSnippet: longText,
      htmlExcerpt: longHtml,
      bounds: { x: 0, y: 0, width: 100, height: 40 },
    })

    expect(payload).toContain('token=[REDACTED]')
    expect(payload).toContain('safe=ok')
    expect(payload).toContain('htmlExcerpt:')
    expect(payload).toContain('...')
  })

  test('redactInspectorText strips bearer tokens', () => {
    expect(redactInspectorText('Authorization: bearer abc.def.ghi')).toContain(
      'bearer [REDACTED]',
    )
  })

  test('redacts sensitive data attributes while preserving safe ones', () => {
    const payload = buildUiInspectorContextPayload({
      source: 'dom',
      label: 'Tokenized button',
      selector: '#save',
      dataAttributes: {
        'data-token': 'abc123',
        'data-api-key': 'secret-key',
        'data-tracking-id': 'cta-save',
      },
      bounds: { x: 0, y: 0, width: 100, height: 40 },
    })

    expect(payload).toContain('"data-token":"[REDACTED]"')
    expect(payload).toContain('"data-api-key":"[REDACTED]"')
    expect(payload).toContain('"data-tracking-id":"cta-save"')
  })
})
