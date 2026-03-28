import type { InspectorResult } from '../../shared/ui-inspector'

export function toolUnavailableResult<T>(message: string): InspectorResult<T> {
  return {
    success: false,
    error: {
      code: 'TOOL_UNAVAILABLE',
      message,
      retriable: false,
    },
  }
}

export function captureFailedResult(error: unknown): InspectorResult<never> {
  return {
    success: false,
    error: {
      code: 'CAPTURE_FAILED',
      message: error instanceof Error ? error.message : String(error),
      retriable: true,
    },
  }
}
