# packages/editor — AGENTS.md

## Purpose

Full editor UI package. Composes `@pascal-app/core` + `@pascal-app/viewer` into a complete editing experience. ~126 TSX files. Owns the state machine (phase/mode/tool), tool system, panel routing, command palette, sidebar/scene tree, item catalog, and transient node lifecycle.

## State Machine

The editor operates on a three-axis state machine: **Phase x Mode x Tool**.

### Phases and Available Modes

| Phase | Modes | Default Tool (build) |
|---|---|---|
| `site` | `select`, `edit` | `property-line` |
| `structure` | `select`, `build`, `delete` | `wall` (elements layer), `zone` (zones layer) |
| `furnish` | `select`, `build`, `delete` | `item` |

### Tools by Phase (build mode only)

| Phase | Layer | Tools |
|---|---|---|
| `site` | — | `property-line` |
| `structure` | `elements` | `wall`, `slab`, `ceiling`, `roof`, `door`, `window`, `item`, `column`, `stair`, `room`, `custom-room` |
| `structure` | `zones` | `zone` |
| `furnish` | — | `item` |

Key constraint: `tool` is only set when `mode === 'build'`. Leaving build mode clears the tool.

## useEditor Store

**File:** `src/store/use-editor.tsx` — Zustand store with `persist` middleware.

| Field | Type | Description |
|---|---|---|
| `phase` | `'site' \| 'structure' \| 'furnish'` | Current workflow phase |
| `mode` | `'select' \| 'edit' \| 'delete' \| 'build'` | Current interaction mode |
| `tool` | `Tool \| null` | Active build tool (null outside build mode) |
| `structureLayer` | `'zones' \| 'elements'` | Sub-layer toggle in structure phase |
| `catalogCategory` | `CatalogCategory \| null` | Active item catalog filter |
| `selectedItem` | `AssetInput \| null` | Currently selected catalog asset for placement |
| `movingNode` | `ItemNode \| WindowNode \| DoorNode \| RoofNode \| RoofSegmentNode \| null` | Node being repositioned |
| `spaces` | `Record<string, Space>` | Detected spaces for cutaway mode |
| `editingHole` | `{ nodeId, holeIndex } \| null` | Active hole being edited on slab/ceiling |
| `isPreviewMode` | `boolean` | Viewer-like experience inside editor |
| `isFloorplanOpen` | `boolean` | 2D floorplan overlay toggle |

**Persisted to localStorage** (key `pascal-editor-ui-preferences`): `phase`, `mode`, `tool`, `structureLayer`, `catalogCategory`, `isFloorplanOpen`. Restored via `normalizePersistedEditorUiState()` which enforces valid phase/mode/tool combinations.

## Tool System

**File:** `src/components/tools/tool-manager.tsx`

`ToolManager` reads `phase`, `mode`, `tool` from `useEditor` and renders the active tool component. It also renders context-sensitive boundary/hole editors when nodes are selected.

### Tool Components

| Tool | Component | Description |
|---|---|---|
| `wall` | `WallTool` | Draw walls with endpoint snapping, drafting helpers |
| `zone` | `ZoneTool` | Polygon creation for spatial zones |
| `door` | `DoorTool` | Place doors on walls |
| `window` | `WindowTool` | Place windows on walls |
| `item` | `ItemTool` | Catalog item placement with surface strategies |
| `roof` | `RoofTool` | Roof creation |
| `ceiling` | `CeilingTool` | Ceiling polygon creation |
| `slab` | `SlabTool` | Floor slab polygon creation |
| `property-line` | `SiteBoundaryEditor` | Edit site boundary polygon |

### Boundary/Hole Editors (select mode)

Activated automatically when a node is selected:

| Editor | Condition |
|---|---|
| `SiteBoundaryEditor` | `phase === 'site' && mode === 'edit'` |
| `ZoneBoundaryEditor` | Zone selected in structure/select |
| `SlabBoundaryEditor` | Slab selected (no active hole edit) |
| `SlabHoleEditor` | Slab selected + `editingHole` set |
| `CeilingBoundaryEditor` | Ceiling selected (no active hole edit) |
| `CeilingHoleEditor` | Ceiling selected + `editingHole` set |

### Shared: PolygonEditor

`src/components/tools/shared/polygon-editor.tsx` — Generic vertex-editing component reused by slab, ceiling, zone, and site boundary editors. Provides drag handles, vertex add/remove, and optional level-portal mounting.

### MoveTool

`src/components/tools/item/move-tool.tsx` — Handles repositioning existing items. Rendered when `movingNode` is set, takes priority over build tools.

## Panel Routing

**File:** `src/components/ui/panels/panel-manager.tsx`

`PanelManager` routes a single selected node to its property panel:

| Node Type | Panel |
|---|---|
| `item` | `ItemPanel` |
| `wall` | `WallPanel` |
| `door` | `DoorPanel` |
| `window` | `WindowPanel` |
| `slab` | `SlabPanel` |
| `ceiling` | `CeilingPanel` |
| `roof` | `RoofPanel` |
| `roof-segment` | `RoofSegmentPanel` |
| (reference selected) | `ReferencePanel` |

Each panel edits node properties via `useScene.updateNode()`. Reference selection takes priority over node type routing.

## Command Palette

**File:** `src/store/use-command-registry.ts`

```ts
type CommandAction = {
  id: string
  label: string | (() => string)
  group: string
  icon?: ReactNode
  keywords?: string[]
  shortcut?: string[]
  badge?: string | (() => string)
  navigate?: boolean
  when?: () => boolean   // returning false disables the item
  execute: () => void
}
```

`useCommandRegistry.register(actions)` returns an unsubscribe function. Components register commands on mount and unregister on unmount. The command palette searches all registered actions by label/keywords.

## Sidebar / Scene Tree

**Entry:** `src/components/ui/sidebar/app-sidebar.tsx` — Icon rail toggles between `SitePanel` and `SettingsPanel`.

**Scene tree:** `src/components/ui/sidebar/panels/site-panel/index.tsx`

Tree nodes dispatch by `node.type` via a factory `TreeNode` component:

| Component | Node Type |
|---|---|
| `BuildingTreeNode` | `building` — expandable, "add level" action |
| `LevelTreeNode` | `level` — inline rename, auto-expanded |
| `WallTreeNode` | `wall` — multi-select, visibility toggle, contains doors/windows |
| `DoorTreeNode` | `door` — leaf node |
| `WindowTreeNode` | `window` — leaf node |
| `ItemTreeNode` | `item` — category-based icons, can contain children |
| `SlabTreeNode` | `slab` |
| `CeilingTreeNode` | `ceiling` |
| `RoofTreeNode` | `roof` |
| `ZoneTreeNode` | `zone` |

**Features:** drag/drop reparenting (`tree-node-drag.tsx`), inline rename (`inline-rename-input.tsx`), visibility toggle, multi-select, auto-expand on descendant selection.

## Item Catalog

**Catalog data:** `src/components/ui/item-catalog/catalog-items.tsx` — `CATALOG_ITEMS: AssetInput[]` (111 items).

**Categories:** `furniture`, `appliance`, `bathroom`, `kitchen`, `outdoor`, `window`, `door`.

**Placement strategies** (`src/components/tools/item/placement-strategies.ts`):

| Strategy | Surface | Behavior |
|---|---|---|
| `floorStrategy` | Floor/grid | Grid snapping, ground plane placement |
| `wallStrategy` | Wall faces | Auto Y-adjustment, wall-attached positioning |
| `ceilingStrategy` | Ceiling | Ceiling-mounted placement |
| `itemSurfaceStrategy` | Item surfaces | Place on top of other items (tables, counters) |

**Coordinator:** `use-placement-coordinator.tsx` orchestrates cursor visualization, event routing to strategies, and draft node lifecycle. Supports `Shift` for free placement (bypass grid snap).

**Draft nodes:** `use-draft-node.ts` manages transient item creation/adoption with two modes:
- **Create mode:** new transient node, commit = delete + recreate
- **Move mode:** adopt existing node, commit = restore original + update

## Transient Nodes

Preview/draft nodes use `metadata: { isTransient: true }` to exclude from persistence and distinguish from committed scene nodes.

**Lifecycle:**
1. Create node with `isTransient: true`
2. Update position/rotation during interactive placement
3. On commit: `stripTransient()` removes the flag, then node is recreated cleanly
4. On cancel: transient node is deleted

**Temporal coordination:** Tools pause undo/redo tracking during transient operations. This ensures undo reverts to the pre-interaction state, not intermediate drag positions.

**Always clean up transient nodes before committing.** Use `stripTransient()` from `placement-math.ts` to remove the flag from metadata.

## What Agents Should Know

### Adding a New Tool
1. Add the tool name to the `Tool` union type in `use-editor.tsx` (under the appropriate phase type)
2. Create the tool component in `src/components/tools/<tool-name>/`
3. Register the component in `ToolManager`'s `tools` record
4. Add a mode button in the toolbar UI

### Adding a New Panel
1. Create the panel component in `src/components/ui/panels/`
2. Add a case to `PanelManager`'s switch statement for the node type
3. Use `useScene.updateNode()` for property mutations

### Adding a Command
1. Define `CommandAction` objects with unique `id`, `group`, `label`, and `execute`
2. Call `useCommandRegistry.register(actions)` in a `useEffect`, return the unsubscribe function as cleanup

### Rules
- **All mutations go through `useScene`** (from `@pascal-app/core`). Never mutate THREE objects directly.
- **Viewer isolation**: `@pascal-app/viewer` must not import from this package. Inject behavior via props/children.
- **Clean up transient nodes** before committing — call `stripTransient()` or manually delete `metadata.isTransient`.
- **Phase/mode constraints are enforced** by `normalizePersistedEditorUiState()` — invalid combinations are corrected on restore.
