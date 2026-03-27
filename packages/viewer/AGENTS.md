# packages/viewer — Agent Guide

## Purpose

Presentation-only 3D canvas component built with React Three Fiber and Three.js WebGPU. Renders the scene graph from `@pascal-app/core` into interactive 3D geometry. **Must never import from `apps/editor`** — all editor-specific behaviour is injected via children or props.

## Renderer Chain

```
SceneRenderer (iterates rootNodeIds)
  → NodeRenderer (type dispatch per node)
    → SiteRenderer | BuildingRenderer | LevelRenderer | ...
```

`SceneRenderer` reads `useScene.rootNodeIds` and renders one `NodeRenderer` per root. `NodeRenderer` resolves the node type and delegates to the matching renderer.

| Node Type | Renderer | Notes |
|---|---|---|
| `site` | `SiteRenderer` | Ground plane / site boundary |
| `building` | `BuildingRenderer` | Building group container |
| `level` | `LevelRenderer` | Floor level group (positioned by LevelSystem) |
| `wall` | `WallRenderer` | Extruded wall mesh |
| `slab` | `SlabRenderer` | Floor slab mesh |
| `ceiling` | `CeilingRenderer` | Ceiling mesh |
| `door` | `DoorRenderer` | Door cutout + panel geometry |
| `window` | `WindowRenderer` | Window cutout + glass geometry |
| `zone` | `ZoneRenderer` | Floor fill + wall border (on ZONE_LAYER) |
| `item` | `ItemRenderer` | Placed asset (furniture, fixtures) |
| `roof` | `RoofRenderer` | Roof group container |
| `roof-segment` | `RoofSegmentRenderer` | Individual roof face |
| `scan` | `ScanRenderer` | Point cloud / scan overlay |
| `guide` | `GuideRenderer` | Measurement / reference guides |

**To add a new node type:** create a renderer in `src/components/renderers/<type>/`, then add a dispatch line in `node-renderer.tsx`.

## useViewer Store

Zustand store persisted to `localStorage` under key `viewer-preferences`.

```ts
type SelectionPath = {
  buildingId: string | null   // drill-down hierarchy
  levelId: string | null
  zoneId: string | null
  selectedIds: string[]       // multi-select within zone (cmd/ctrl-click)
}
```

| State | Type | Default | Description |
|---|---|---|---|
| `selection` | `SelectionPath` | all null/empty | Hierarchical selection path |
| `hoveredId` | `string \| null` | `null` | Currently hovered node |
| `levelMode` | `stacked \| exploded \| solo \| manual` | `stacked` | How levels are positioned vertically |
| `wallMode` | `up \| cutaway \| down` | `up` | Wall visibility strategy |
| `cameraMode` | `perspective \| orthographic` | `perspective` | Camera projection |
| `theme` | `light \| dark` | `light` | Background and material theme |
| `unit` | `metric \| imperial` | `metric` | Display unit system |
| `showScans` | `boolean` | `true` | Scan overlay visibility |
| `showGuides` | `boolean` | `true` | Guide overlay visibility |
| `showGrid` | `boolean` | `true` | Grid visibility |
| `debugColors` | `boolean` | `false` | Debug color mode |
| `cameraDragging` | `boolean` | `false` | Whether camera is being dragged |
| `outliner` | `{selectedObjects, hoveredObjects}` | empty arrays | Object3D refs for outline post-processing |

**Selection hierarchy guard:** `setSelection()` auto-clears children when a parent changes (e.g., setting `buildingId` clears `levelId`, `zoneId`, `selectedIds`).

**Per-project preferences:** `showScans`, `showGuides`, `showGrid` are stored per `projectId` in `projectPreferences`.

## Viewer Systems

All systems are R3F components mounted inside `<Canvas>`. They run in `useFrame` or `useEffect`.

| System | File | What It Does |
|---|---|---|
| `LevelSystem` | `systems/level/level-system.tsx` | Positions level groups vertically. Stacked: cumulative height. Exploded: adds `index * 5m` gap. Solo: hides non-selected levels. Animates via lerp. |
| `WallCutout` | `systems/wall/wall-cutout.tsx` | Camera-aware wall transparency. Compares camera direction to wall normal. Interior-facing walls switch to a dot-pattern transparent material. Throttled to update when camera moves >0.5m or direction changes >0.3. |
| `ZoneSystem` | `systems/zone/zone-system.tsx` | Animates zone floor/wall opacity on hover. Debounces exit (50ms) to prevent flicker. Drives zone label pin visibility via DOM. |
| `ScanSystem` | `systems/scan/scan-system.tsx` | Toggles scan node visibility based on `showScans`. |
| `GuideSystem` | `systems/guide/guide-system.tsx` | Toggles guide node visibility based on `showGuides`. |
| `InteractiveSystem` | `systems/interactive/interactive-system.tsx` | Renders HTML control overlays (toggle, slider, temperature) for interactive items. Portals controls into the item's Object3D group. Fades opacity based on zone containment. |
| `ItemLightSystem` | `systems/item-light/item-light-system.tsx` | Pool of 12 `PointLight`s dynamically assigned to the nearest interactive light-emitting items. Scores by camera angle + distance + level. Fades in/out with lerp. Hysteresis prevents flickering at pool boundary. |

## Post-Processing

File: `src/components/viewer/post-processing.tsx`

Pipeline built with Three.js WebGPU TSL (Three Shading Language):

1. **Scene pass** with MRT — outputs color, diffuse, normal, velocity, depth
2. **Zone pass** — renders only `ZONE_LAYER` objects separately
3. **SSGI** — screen-space global illumination (AO + GI). GI intensity is 0 by default; primarily used for ambient occlusion.
4. **Denoise** — denoises the AO channel
5. **Composite** — `scene * AO + zone + diffuse * GI`
6. **Outline passes** — selection outline (white/yellow, static) + hover outline (blue, pulsing via `oscSine`)
7. **TRAA** — temporal reprojection anti-aliasing on the combined result
8. **Background blend** — lerps background color per theme, composites via `contentAlpha`

The pipeline uses `RenderPipeline` with auto-retry (up to 3 attempts) on WebGPU errors. Renderer: `THREE.WebGPURenderer` with ACES filmic tone mapping.

## Asset URL Resolution

File: `src/lib/asset-url.ts`

```
resolveAssetUrl(url) →
  http(s)://...  → pass through (external URL)
  asset://...    → resolve from IndexedDB via core's loadAssetUrl()
  /path or path  → prepend ASSETS_CDN_URL (env: NEXT_PUBLIC_ASSETS_CDN_URL)
```

`resolveCdnUrl()` is the synchronous variant — cannot handle `asset://` URLs.

## Layer-Based Raycasting

File: `src/lib/layers.ts`

| Constant | Value | Usage |
|---|---|---|
| `SCENE_LAYER` | `0` | Default layer for all scene geometry |
| `ZONE_LAYER` | `2` | Zone floor fills and wall borders |

Zones render on a separate layer so the post-processing pipeline can composite them independently (zone pass uses `setLayers` to isolate). This prevents zones from interfering with SSGI/TRAA depth calculations and allows zone-over-background pixels to bypass TRAA (which would output black due to depth=1.0).

## Viewer Props & Callbacks

```ts
interface ViewerProps {
  children?: React.ReactNode       // Editor injects tools, custom systems
  selectionManager?: 'default' | 'custom'  // 'custom' disables built-in SelectionManager
  perf?: boolean                   // Enables PerfMonitor overlay
}
```

The editor composes the viewer by passing tool components as `children`:

```tsx
<Viewer>
  <ToolManager />        {/* editor tool handling */}
  <CustomSystems />      {/* editor-side systems */}
</Viewer>
```

The built-in `SelectionManager` handles hierarchical click-through selection (building → level → zone → items) and hover state. It uses the core `emitter` event bus to listen for `{type}:enter`, `{type}:leave`, `{type}:click` events. Set `selectionManager="custom"` to replace it.

## Isolation Rule

`@pascal-app/viewer` must **never** import from `apps/editor`. The boundary is enforced by convention:

- Editor behaviour → injected as `children` or props
- Display state → read from `useViewer` store
- Scene data → read from `useScene` (core)
- Node events → emitted via core's `emitter`, consumed by `SelectionManager`

## What Agents Should Know

- **Change display settings:** use `useViewer` actions (`setLevelMode`, `setWallMode`, `setTheme`, etc.)
- **Add a new node type:** create renderer in `src/components/renderers/<type>/`, add dispatch in `node-renderer.tsx`
- **Selection is a hierarchical path**, not a flat array — building → level → zone → selectedIds. Setting a parent auto-clears children.
- **Systems are R3F components** — they use `useFrame` for per-frame logic, not standalone classes
- **Post-processing is TSL-based** — shader nodes are composed functionally, not with GLSL strings
- **WebGPU renderer** — `three/webgpu` imports, not `three`. Materials use `MeshStandardNodeMaterial`.
- **Outline effects** reference `outliner.selectedObjects` / `hoveredObjects` arrays directly (mutated in place, no setter)
- **ItemLightSystem** uses a fixed pool of 12 lights — adding more light-emitting items doesn't increase light count, just changes assignment priority
