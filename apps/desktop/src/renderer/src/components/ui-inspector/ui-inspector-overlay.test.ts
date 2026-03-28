import { describe, expect, test } from 'bun:test'
import { toContainerRelativeRect } from './ui-inspector-overlay'

describe('toContainerRelativeRect', () => {
  test('translates viewport coordinates into editor-region-relative coordinates', () => {
    const result = toContainerRelativeRect(
      {
        left: 160,
        top: 92,
        width: 120,
        height: 36,
      },
      {
        left: 40,
        top: 40,
      },
    )

    expect(result).toEqual({
      left: 120,
      top: 52,
      width: 120,
      height: 36,
    })
  })
})
