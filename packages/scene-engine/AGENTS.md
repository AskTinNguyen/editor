# @pascal/scene-engine

## Purpose

Pure, zero-dependency command kernel for scene mutations. All scene graph changes flow through this package as typed commands. It owns the canonical node schemas (Zod), the `SceneDocument` shape, and the `applySceneCommand` reducer. No UI, no rendering, no side effects — input a document and a command, get a new document back.

## Package Contract

| Export | Kind | Description |
|---|---|---|
| `SceneDocument` | type | `{ nodes: Record<string, unknown>; rootNodeIds: string[] }` |
| `ParsedSceneGraph` | type | Zod-inferred document after parsing (typed nodes) |
| `SceneCommand` | type | Union of all command types (see Command Reference) |
| `SceneNodePatch` | type | `Partial<AnyNode>` minus structural fields (`id`, `type`, `parentId`, `children`, `object`) |
| `applySceneCommand(doc, cmd)` | function | Pure reducer — returns `{ document, result }`. Never mutates input. |
| `parseSceneGraph(input)` | function | Validates raw JSON → `ParsedSceneGraph \| null` |
| `assertSceneGraphIntegrity(graph)` | function | Returns `IntegrityError[]` — empty array means valid |
| `AnyNode` | Zod union | Discriminated union of all 14 node schemas |
| `*Node` schemas | Zod objects | `SiteNode`, `BuildingNode`, `LevelNode`, `WallNode`, `SlabNode`, `CeilingNode`, `ZoneNode`, `ItemNode`, `DoorNode`, `WindowNode`, `RoofNode`, `RoofSegmentNode`, `ScanNode`, `GuideNode` |
| `generateId(prefix)` | function | Returns `${prefix}_${nanoid(16)}` |
| `BaseNode` | Zod object | Common fields: `id`, `type`, `name`, `parentId`, `visible`, `camera`, `metadata` |

## Command Reference

| Command | Payload | Behaviour |
|---|---|---|
| `create-node` | `{ node: AnyNode, parentId: string }` | Adds node to graph, appends to parent's children, sets `parentId`. Validates integrity after. |
| `update-node` | `{ nodeId: string, patch: SceneNodePatch }` | Shallow-merges patch into existing node. Rejects patches containing structural fields (`id`, `type`, `parentId`, `children`, `object`). |
| `move-node` | `{ nodeId: string, newParentId: string }` | Removes from old parent's children, adds to new parent's children, updates `parentId`. No-op if same parent. Validates integrity after. |
| `delete-node` | `{ nodeId: string }` | Removes node from graph, removes from parent's children and `rootNodeIds`. Does **not** cascade-delete children. |
| `batch-commands` | `{ commands: SceneCommand[] }` | Applies commands sequentially. Rolls back entire batch on first error. |
| `replace-scene-document` | `{ document: ParsedSceneGraph }` | Replaces entire document. Works on null documents. |
| `clear-scene-document` | `{}` | Sets document to `null`. |

All commands return `{ document: ParsedSceneGraph | null, result: SceneCommandResult }`. Result has `status: 'ok' | 'error'` and `commandType`.

## Key Invariants

`assertSceneGraphIntegrity` enforces these rules (error codes in parens):

| Rule | Code |
|---|---|
| Every child ID in a node's `children` array exists in `nodes` | `MISSING_CHILD` |
| Every `parentId` references a node that exists in `nodes` | `MISSING_PARENT` |
| A node with `parentId` appears in that parent's `children` array | `NOT_IN_PARENT_CHILDREN` |
| Root nodes (`rootNodeIds`) have `null` parentId | `ROOT_HAS_PARENT` |
| Every non-root node is reachable from some parent's `children` | `ORPHAN_NODE` |

`parseSceneGraph` additionally validates:
- Node record keys match their `node.id`
- Every `rootNodeIds` entry exists in `nodes`

## ID Conventions

IDs are generated via `generateId(prefix)` → `${prefix}_${nanoid16}`.

| Prefix | Node Type |
|---|---|
| `site_` | SiteNode |
| `building_` | BuildingNode |
| `level_` | LevelNode |
| `wall_` | WallNode |
| `slab_` | SlabNode |
| `ceiling_` | CeilingNode |
| `zone_` | ZoneNode |
| `item_` | ItemNode |
| `door_` | DoorNode |
| `window_` | WindowNode |
| `roof_` | RoofNode |
| `rseg_` | RoofSegmentNode |
| `scan_` | ScanNode |
| `guide_` | GuideNode |

## Adding a New Command

1. **Define the type** in `src/commands/scene-command.ts` — add to `NodeCommand` or `DocumentCommand` union.
2. **Add to `SceneCommand`** — it's `DocumentCommand | NodeCommand | BatchCommand`, so it picks up automatically.
3. **Handle in `applySceneCommand`** — add a `case` in the switch in `src/commands/apply-scene-command.ts`. The exhaustive `never` check will error at compile time until you do.
4. **Write tests** in `src/commands/apply-scene-command.test.ts`.

## What Agents Should Know

- **Call pattern**: agents call `scene_applyCommands` with an array of `SceneCommand` objects. Use `batch-commands` to group related mutations atomically.
- **Pure reducer**: `applySceneCommand` is pure — it takes `(doc | null, command)` and returns a new `{ document, result }`. It never mutates the input document.
- **Validate after mutations**: `create-node` and `move-node` run `assertSceneGraphIntegrity` internally. For manual pipelines, call it yourself after mutations.
- **Batch rollback**: if any command in a `batch-commands` fails, the entire batch rolls back to the original document.
- **Structural fields are immutable via patch**: `update-node` rejects patches containing `id`, `type`, `parentId`, `children`, or `object`. Use `move-node` for reparenting.
- **No cascade delete**: `delete-node` removes only the target node. Clean up children explicitly or they become orphans (which fails integrity).
- **Node creation**: always use the Zod schema (e.g. `WallNode.parse({...})`) to construct nodes before passing to `create-node`.
