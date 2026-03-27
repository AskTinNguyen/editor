# packages/core — Agent Guide

## Purpose

Central logic library for the Pascal editor. No UI, no rendering. Every other package depends on it. Owns: schema types, scene state, systems, spatial indexing, events, and asset storage.

## useScene Store

Zustand store with Zundo temporal middleware (undo/redo).

**State shape:**

| Field | Type | Description |
|---|---|---|
| `nodes` | `Record<AnyNodeId, AnyNode>` | Flat dictionary of all scene nodes |
| `rootNodeIds` | `AnyNodeId[]` | Top-level node IDs (typically one Site) |
| `dirtyNodes` | `Set<AnyNodeId>` | Nodes pending system recomputation |
| `collections` | `Record<CollectionId, Collection>` | Relational groupings (not nodes) |

**Key actions:**

| Action | Description |
|---|---|
| `createNode(node, parentId?)` | Add a node to the scene |
| `updateNode(id, data)` | Partial update on a node |
| `deleteNode(id)` | Remove a node and clean up children |
| `markDirty(id)` | Flag a node for system recomputation |
| `clearDirty(id)` | Remove a node from the dirty set |
| `setScene(nodes, rootNodeIds)` | Replace the entire scene (applies migrations) |
| `loadScene()` | Load default scene (Site > Building > Level) |

**Undo/redo:** Zundo `temporal` middleware tracks `nodes`, `rootNodeIds`, and `collections`. Limited to **50 steps**. On undo/redo, changed nodes are diffed and marked dirty automatically.

```ts
useScene.temporal.getState().undo()
useScene.temporal.getState().redo()
clearSceneHistory() // reset undo stack
```

## Dirty System Loop

Performance-critical pattern that drives all geometry updates:

```
mutation (createNode/updateNode) → markDirty(id)
  → useFrame callback checks dirtyNodes
  → system recomputes geometry for dirty nodes of its type
  → clearDirty(id)
```

Each system runs in `useFrame` (R3F render loop) with a priority number. Systems only process nodes matching their type. If the THREE.Mesh isn't mounted yet, the node stays dirty until the next frame.

**Why this matters:** Only dirty nodes are recomputed each frame. Without this, every node would regenerate geometry every frame.

## Systems Table

All systems follow the same pattern: subscribe to `dirtyNodes` via `useFrame`, filter by node type, recompute geometry, call `clearDirty`.

| System | Node Type | Priority | What It Owns |
|---|---|---|---|
| `SlabSystem` | `slab` | 1 | Extruded floor polygons with holes, slab elevation |
| `ItemSystem` | `item` | 2 | Position sync (slab elevation, wall-side offset, surface placement) |
| `DoorSystem` | `door` | 3 | Procedural door mesh (frame, leaf, segments, hardware), cutout for wall CSG; marks parent wall dirty |
| `WindowSystem` | `window` | 3 | Procedural window mesh (frame, glass grid, sill), cutout for wall CSG; marks parent wall dirty |
| `WallSystem` | `wall` | 4 | Extruded wall geometry with mitering, CSG cutouts for doors/windows, slab elevation offset |
| `CeilingSystem` | `ceiling` | — | Flat polygon geometry with holes |
| `RoofSystem` | `roof-segment`, `roof` | — | Per-segment geometry (gable/hip/flat/shed), merged CSG for parent roof; throttled to 1 roof + 3 segments per frame |

**Priority ordering matters:** Slabs (1) before items (2) before doors/windows (3) before walls (4) — so slab elevation is ready when items need it, and cutout meshes exist before wall CSG runs.

## Registry Pattern

O(1) lookup from node ID to live `THREE.Object3D`. Avoids scene-graph traversal.

```ts
import { sceneRegistry, useRegistry } from '@pascal-app/core'

// In a renderer component:
useRegistry(node.id, 'wall', meshRef) // registers on mount, cleans up on unmount

// In a system or anywhere:
const mesh = sceneRegistry.nodes.get(nodeId) as THREE.Mesh
const allWallIds = sceneRegistry.byType.wall // Set<string>
```

**`sceneRegistry.byType`** has typed sets for: `site`, `building`, `ceiling`, `level`, `wall`, `item`, `slab`, `zone`, `roof`, `roof-segment`, `scan`, `guide`, `window`, `door`.

## Event Bus

mitt-based typed emitter for pointer/interaction events.

```ts
import { emitter } from '@pascal-app/core'

emitter.on('wall:click', (event) => { /* WallEvent */ })
emitter.emit('grid:move', { position, nativeEvent })
```

**Naming convention:** `nodeType:eventSuffix`

**Suffixes:** `click`, `move`, `enter`, `leave`, `pointerdown`, `pointerup`, `context-menu`, `double-click`

**Node types with events:** `wall`, `item`, `site`, `building`, `level`, `zone`, `slab`, `ceiling`, `roof`, `roof-segment`, `window`, `door`, `grid`

**Special events:** `camera-controls:view`, `camera-controls:focus`, `tool:cancel`, `preset:generate-thumbnail`

## Spatial Grid

`spatialGridManager` is a singleton that indexes items, walls, slabs, and ceilings for fast spatial queries. Maintains separate grids per level.

```ts
import { spatialGridManager, useSpatialQuery } from '@pascal-app/core'

// Hook for React components:
const { canPlaceOnFloor, canPlaceOnWall, canPlaceOnCeiling } = useSpatialQuery()

// Direct API:
spatialGridManager.canPlaceOnFloor(levelId, position, dimensions, rotation)
spatialGridManager.getSlabElevationAt(levelId, x, z)
spatialGridManager.getSlabElevationForWall(levelId, start, end)
```

Grid sync is initialized once via `initSpatialGridSync()` which subscribes to store changes. **Brute-force iteration over all nodes is banned** — always use the spatial grid for neighbourhood queries.

## Asset Storage

IndexedDB-backed binary asset storage with a custom `asset://` protocol.

```ts
import { saveAsset, loadAssetUrl } from '@pascal-app/core'

const url = await saveAsset(file)      // returns "asset://<uuid>"
const blobUrl = await loadAssetUrl(url) // returns blob URL (cached)
```

`loadAssetUrl` is pass-through for `blob:`, `http:`, and `data:` URLs. Only `asset://` triggers IndexedDB lookup.

## Node Creation Rule

Always use Zod schema parsing, then store action:

```ts
import { WallNode } from '@pascal-app/core'
import useScene from '@pascal-app/core'

const wall = WallNode.parse({ start: [0, 0], end: [3, 0] })
useScene.getState().createNode(wall, levelId)
```

**Never construct raw node objects.** `NodeType.parse()` generates IDs, applies defaults, and validates.

## What Agents Should Know

- **Use `applySceneCommand`** from `@pascal/scene-engine` (re-exported by core) for structured scene mutations when working with the agent pipeline.
- **`markDirty(id)`** is the trigger for all geometry updates. After any node mutation, the node must be marked dirty or systems won't pick it up. `createNode` and `updateNode` handle this automatically.
- **Registry gives THREE access** without DOM traversal: `sceneRegistry.nodes.get(id)`.
- **Systems are React components** that render `null` — they run logic in `useFrame`. They must be mounted in the R3F tree to function.
- **Flat node storage** — hierarchy is via `parentId` and `children` arrays, not nesting. Use `parentId` to walk up, `children` to walk down.
- **Undo/redo diffs** automatically mark only changed nodes dirty — no manual intervention needed.
