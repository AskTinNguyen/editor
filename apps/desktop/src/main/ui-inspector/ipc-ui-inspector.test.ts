import { describe, expect, test } from 'bun:test'
import {
  captureFailedResult,
  toolUnavailableResult,
} from './ipc-ui-inspector-errors'

describe('ui inspector ipc error taxonomy', () => {
  test('uses canonical TOOL_UNAVAILABLE for unavailable inspector capabilities', () => {
    expect(toolUnavailableResult('No window found')).toEqual({
      success: false,
      error: {
        code: 'TOOL_UNAVAILABLE',
        message: 'No window found',
        retriable: false,
      },
    })
  })

  test('uses canonical CAPTURE_FAILED for capture failures', () => {
    expect(captureFailedResult(new Error('capture exploded'))).toEqual({
      success: false,
      error: {
        code: 'CAPTURE_FAILED',
        message: 'capture exploded',
        retriable: true,
      },
    })
  })
})
