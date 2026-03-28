import { useEffect, useState, type RefObject } from 'react'
import type { UiInspectorState } from '../../../../shared/ui-inspector'

type HighlightRect = {
  left: number
  top: number
  width: number
  height: number
}

type RectLike = {
  left: number
  top: number
  width: number
  height: number
}

function isInspectorChrome(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-ui-inspector-chrome="true"]') !== null
}

export function toContainerRelativeRect(targetRect: RectLike, containerRect: Pick<RectLike, 'left' | 'top'>): HighlightRect {
  return {
    left: targetRect.left - containerRect.left,
    top: targetRect.top - containerRect.top,
    width: targetRect.width,
    height: targetRect.height,
  }
}

export function UiInspectorOverlay({
  state,
  containerRef,
  onCaptureTarget,
  onStop,
}: {
  state: UiInspectorState
  containerRef: RefObject<HTMLElement | null>
  onCaptureTarget: (input: { target: Element }) => void
  onStop: () => void
}) {
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null)

  useEffect(() => {
    if (state.mode !== 'inspect') {
      setHighlightRect(null)
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)
      if (!(target instanceof Element) || isInspectorChrome(target)) {
        setHighlightRect(null)
        return
      }

      const rect = target.getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      setHighlightRect(
        containerRect
          ? toContainerRelativeRect(rect, containerRect)
          : {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            },
      )
    }

    const handleClick = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)
      if (!(target instanceof Element) || isInspectorChrome(target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      onCaptureTarget({ target })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onStop()
      }
    }

    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [containerRef, onCaptureTarget, onStop, state.mode])

  if (state.mode !== 'inspect' || !highlightRect) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div
        className="absolute rounded-lg border-2 border-sky-400 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
        style={{
          left: highlightRect.left,
          top: highlightRect.top,
          width: highlightRect.width,
          height: highlightRect.height,
        }}
      />
    </div>
  )
}
