import { useEffect, useRef } from 'react'
import { sceneRegistry } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'

/**
 * Temporarily highlights nodes by adding their THREE objects to the
 * hovered outliner. The pulsing cyan outline is rendered by the
 * existing post-processing pipeline.
 */
export function AgentHighlightManager({ nodeIds }: { nodeIds: string[] }) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (nodeIds.length === 0) return

    // Look up THREE objects from the registry
    const objects: import('three').Object3D[] = []
    for (const id of nodeIds) {
      const obj = sceneRegistry.nodes.get(id)
      if (obj) objects.push(obj)
    }

    if (objects.length === 0) return

    // Add to the hovered outliner for cyan pulsing highlight
    const outliner = useViewer.getState().outliner
    for (const obj of objects) {
      if (!outliner.hoveredObjects.includes(obj)) {
        outliner.hoveredObjects.push(obj)
      }
    }

    // Auto-remove after 3 seconds
    timeoutRef.current = setTimeout(() => {
      for (const obj of objects) {
        const idx = outliner.hoveredObjects.indexOf(obj)
        if (idx >= 0) outliner.hoveredObjects.splice(idx, 1)
      }
    }, 3000)

    return () => {
      clearTimeout(timeoutRef.current)
      for (const obj of objects) {
        const idx = outliner.hoveredObjects.indexOf(obj)
        if (idx >= 0) outliner.hoveredObjects.splice(idx, 1)
      }
    }
  }, [nodeIds])

  return null
}
