# Pascal Desktop Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch a new `apps/desktop` Electron shell that hosts the existing editor runtime, persists projects to local files, and introduces the first headless `@pascal/scene-engine` seam without changing the manual editing experience.

**Architecture:** Add a new Electron app as the desktop shell, keep `@pascal-app/editor` as the renderer-facing editor runtime for now, and extract scene document parsing/validation plus the first deterministic command surface into a new `@pascal/scene-engine` package. The desktop app owns trusted filesystem access and passes `onLoad`/`onSave` adapters into `Editor`, so browser `localStorage` stops being the source of truth in desktop mode.

**Tech Stack:** Bun workspaces, Turborepo, TypeScript 5.9, Electron, Vite/electron-vite, React 19, existing `@pascal-app/editor`, `@pascal-app/viewer`, `@pascal-app/core`, Bun test

---

## Scope Guard

This plan intentionally covers only the first milestone from the approved spec:

- `apps/desktop` shell
- local project file persistence
- first `@pascal/scene-engine` boundary
- manual editor running in Electron

This plan does **not** include:

- full agent runtime integration
- Pascal CodeMode
- workflow/skill-pack execution
- workerized export/indexing/generation beyond what the desktop shell needs
- broad floorplan refactors
- `apps/web` evolution beyond keeping the current web host working

## Planned File Structure

### Desktop project-file convention

Use a simple local-first layout for the first milestone:

- one project directory per project under an app-managed workspace root
- one canonical project file per directory, for example `project.pascal.json`
- stable `projectId` generated and stored inside that file

Example:

```text
<workspace-root>/
  <project-id>/
    project.pascal.json
```

The trusted main-process store owns the mapping between `projectId` and `projectFilePath`. The renderer only sees project IDs and loaded project payloads.

### New files and responsibilities

- `apps/desktop/package.json`
  Desktop app scripts and Electron/Vite dependencies
- `apps/desktop/tsconfig.json`
  Desktop TypeScript project config
- `apps/desktop/electron.vite.config.ts`
  Build config for main, preload, and renderer bundles
- `apps/desktop/src/main/index.ts`
  Main-process bootstrap and window creation
- `apps/desktop/src/main/create-main-window.ts`
  Focused BrowserWindow factory
- `apps/desktop/src/main/projects/project-store.ts`
  Trusted file-backed project read/write service
- `apps/desktop/src/main/projects/project-ipc.ts`
  IPC registration for project operations
- `apps/desktop/src/main/projects/project-bootstrap.ts`
  First-launch/open-recent logic that guarantees the renderer starts with a project
- `apps/desktop/src/main/projects/project-store.test.ts`
  Persistence tests for create/open/save/reopen flows
- `apps/desktop/src/preload/index.ts`
  Safe renderer bridge exposing `projects.*`
- `apps/desktop/src/shared/projects.ts`
  Shared project file types and IPC contracts
- `apps/desktop/src/renderer/index.html`
  Desktop renderer entry HTML
- `apps/desktop/src/renderer/src/main.tsx`
  Renderer bootstrap
- `apps/desktop/src/renderer/src/app.tsx`
  Desktop host that mounts `Editor` with file-backed `onLoad`/`onSave`
- `apps/desktop/src/renderer/src/vite-env.d.ts`
  Renderer typing glue
- `packages/scene-engine/package.json`
  New headless package metadata
- `packages/scene-engine/tsconfig.json`
  Build config for scene-engine
- `packages/scene-engine/src/index.ts`
  Public exports
- `packages/scene-engine/src/schema/index.ts`
  Headless schema export surface moved out of `core`
- `packages/scene-engine/src/schema/base.ts`
  Base node schema now owned by scene-engine
- `packages/scene-engine/src/schema/camera.ts`
  Camera schema now owned by scene-engine
- `packages/scene-engine/src/schema/collections.ts`
  Collection identifiers and shared collection schema moved with item-related node types
- `packages/scene-engine/src/schema/nodes/*`
  Node schemas moved out of `core` so document parsing stays headless
- `packages/scene-engine/src/schema/types.ts`
  `AnyNode` / `AnyNodeId` types now owned by scene-engine
- `packages/scene-engine/src/document/scene-document.ts`
  Shared `SceneDocument` / `SceneGraph` types
- `packages/scene-engine/src/document/scene-graph.ts`
  Scene parsing/validation moved out of `core`
- `packages/scene-engine/src/document/scene-graph.test.ts`
  Validation regression tests copied/adapted from current `core`
- `packages/scene-engine/src/commands/scene-command.ts`
  First deterministic command union for document-level operations
- `packages/scene-engine/src/commands/apply-scene-command.ts`
  Pure command application entry point
- `packages/scene-engine/src/commands/apply-scene-command.test.ts`
  Tests for deterministic command behavior

### Existing files to modify

- `package.json`
  Add desktop-friendly root scripts if needed
- `turbo.json`
  Ensure `apps/desktop` participates in `dev`, `build`, and `check-types`
- `packages/core/package.json`
  Add dependency on `@pascal/scene-engine` and a `check-types` script
- `packages/core/src/index.ts`
  Re-export scene parsing from `@pascal/scene-engine` during migration
- `packages/core/src/lib/scene-graph.ts`
  Keep a temporary compatibility shim for old import paths during migration
- `packages/editor/src/lib/scene.ts`
  Import `SceneGraph` / `parseSceneGraph` from `@pascal/scene-engine`
- `packages/editor/package.json`
  Add dependency on `@pascal/scene-engine` because `packages/editor/src/lib/scene.ts` imports it
- `apps/editor/package.json`
  Add dependency on `@pascal/scene-engine` only if the web host references shared document types directly
- `apps/editor/app/page.tsx`
  Keep web host behavior explicit and unaffected

## Task 1: Scaffold `apps/desktop`

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/electron.vite.config.ts`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/main/create-main-window.ts`
- Create: `apps/desktop/src/main/projects/project-bootstrap.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/index.html`
- Create: `apps/desktop/src/renderer/src/main.tsx`
- Create: `apps/desktop/src/renderer/src/app.tsx`
- Create: `apps/desktop/src/renderer/src/vite-env.d.ts`
- Modify: `package.json`
- Modify: `turbo.json`

- [ ] **Step 1: Add the failing workspace shell shape**

Create `apps/desktop/package.json` with scripts like:

```json
{
  "name": "desktop",
  "private": true,
  "type": "module",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@pascal-app/core": "*",
    "@pascal-app/editor": "*",
    "@pascal-app/viewer": "*",
    "@pascal/scene-engine": "*",
    "electron": "^35.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.19.12",
    "@types/react": "19.2.2",
    "@types/react-dom": "19.2.2",
    "electron-vite": "^3.0.0",
    "typescript": "5.9.3",
    "vite": "^6.0.0"
  }
}
```

When creating `packages/scene-engine/package.json`, include:

```json
{
  "scripts": {
    "build": "tsc --build",
    "check-types": "tsc --noEmit"
  }
}
```

When modifying `packages/core/package.json`, add:

```json
{
  "scripts": {
    "check-types": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Add a typecheck-first smoke test step**

Run: `bun run check-types --filter=desktop`

Expected: FAIL because `apps/desktop` files and config do not exist yet.

- [ ] **Step 3: Add minimal desktop bootstrap**

Write `create-main-window.ts` and `index.ts` with a single BrowserWindow loading the renderer bundle:

```ts
const currentDir = dirname(fileURLToPath(import.meta.url))

export function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    webPreferences: {
      preload: join(currentDir, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  return window
}
```

Write `app.tsx` to mount a placeholder `<EditorHost />` component so the renderer bundle is valid before project APIs exist.

- [ ] **Step 4: Add first-launch project bootstrap**

Create `apps/desktop/src/main/projects/project-bootstrap.ts`:

```ts
export async function ensureInitialProject(store: ProjectStore): Promise<PascalProjectFile> {
  const recent = await store.getMostRecentProject()
  if (recent) return recent
  return store.createProject({ name: 'Untitled Project' })
}
```

Register a `projects:get-initial-project` IPC flow so the renderer always has a concrete project before it mounts `Editor`.

- [ ] **Step 5: Wire root scripts**

Add exact root scripts only if needed:

```json
{
  "scripts": {
    "desktop:dev": "turbo run dev --filter=desktop",
    "desktop:build": "turbo run build --filter=desktop"
  }
}
```

Update `turbo.json` only as needed so `apps/desktop` participates in normal workspace tasks.

- [ ] **Step 6: Verify the shell typechecks**

Run: `bun run check-types --filter=desktop`

Expected: PASS for `apps/desktop`.

- [ ] **Step 7: Commit**

```bash
git add package.json turbo.json apps/desktop
git commit -m "feat(desktop): scaffold electron shell"
```

## Task 2: Extract `@pascal/scene-engine`

**Files:**
- Create: `packages/scene-engine/package.json`
- Create: `packages/scene-engine/tsconfig.json`
- Create: `packages/scene-engine/src/index.ts`
- Create: `packages/scene-engine/src/schema/index.ts`
- Create: `packages/scene-engine/src/schema/base.ts`
- Create: `packages/scene-engine/src/schema/camera.ts`
- Create: `packages/scene-engine/src/schema/collections.ts`
- Create: `packages/scene-engine/src/schema/nodes/*`
- Create: `packages/scene-engine/src/schema/types.ts`
- Create: `packages/scene-engine/src/document/scene-document.ts`
- Create: `packages/scene-engine/src/document/scene-graph.ts`
- Create: `packages/scene-engine/src/document/scene-graph.test.ts`
- Create: `packages/scene-engine/src/commands/scene-command.ts`
- Create: `packages/scene-engine/src/commands/apply-scene-command.ts`
- Create: `packages/scene-engine/src/commands/apply-scene-command.test.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/lib/scene-graph.ts`
- Modify: `packages/editor/src/lib/scene.ts`
- Modify: `packages/editor/package.json`

- [ ] **Step 1: Copy the current scene validation into a failing new-package test**

Seed `packages/scene-engine/src/document/scene-graph.test.ts` from the existing coverage in [packages/core/src/lib/scene-graph.test.ts](/Users/tinnguyen/editor/packages/core/src/lib/scene-graph.test.ts), preserving the valid/invalid scene cases.

Create `packages/scene-engine/package.json` with full entry metadata, not scripts only:

```json
{
  "name": "@pascal/scene-engine",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "check-types": "tsc --noEmit"
  }
}
```

Run: `bun test packages/scene-engine/src/document/scene-graph.test.ts`

Expected: FAIL because the new package and parser do not exist.

- [ ] **Step 2: Create the document types and parser**

Before moving parser code, move the schema ownership with it so `@pascal/scene-engine` does not depend back on `@pascal-app/core`.

Move these files into `packages/scene-engine/src/schema/`:

- `packages/core/src/schema/base.ts`
- `packages/core/src/schema/camera.ts`
- `packages/core/src/schema/collections.ts`
- `packages/core/src/schema/nodes/*`
- `packages/core/src/schema/types.ts`

Then create `packages/scene-engine/src/schema/index.ts` and update `scene-graph.ts` to import from `../schema`.

Write:

```ts
export type SceneDocument = {
  nodes: Record<string, unknown>
  rootNodeIds: string[]
}

export function parseSceneGraph(input: unknown): ParsedSceneGraph | null {
  const result = SceneGraphSchema.safeParse(input)
  return result.success ? result.data : null
}
```

Move the existing validation logic from [packages/core/src/lib/scene-graph.ts](/Users/tinnguyen/editor/packages/core/src/lib/scene-graph.ts) into `packages/scene-engine/src/document/scene-graph.ts`.

During migration, `@pascal-app/core` should temporarily re-export schema and parser types from `@pascal/scene-engine` instead of keeping duplicate authoritative definitions.

Preserve `packages/core` buildability during this move by adding thin compatibility shims under the old paths until internal imports are updated. At minimum, keep shim files for:

- `packages/core/src/schema/index.ts`
- `packages/core/src/schema/types.ts`
- `packages/core/src/schema/base.ts`
- `packages/core/src/schema/camera.ts`
- `packages/core/src/schema/collections.ts`
- `packages/core/src/schema/nodes/*`
- `packages/core/src/lib/scene-graph.ts`

Each shim should re-export from `@pascal/scene-engine`, for example:

```ts
export * from '@pascal/scene-engine'
```

Only after `packages/core/src/store/use-scene.ts`, `packages/core/src/store/use-interactive.ts`, `packages/core/src/events/bus.ts`, `packages/core/src/lib/space-detection.ts`, and related internal consumers are switched over should those shims be removed.

- [ ] **Step 3: Add the first deterministic command surface**

Create a minimal document-level command union:

```ts
export type SceneCommand =
  | { type: 'replace-scene-document'; document: ParsedSceneGraph }
  | { type: 'clear-scene-document' }
```

Write `applySceneCommand()` as a pure function returning the next document.

- [ ] **Step 4: Write and run command tests**

Test that `replace-scene-document` and `clear-scene-document` are deterministic and side-effect free.

Run: `bun test packages/scene-engine/src/document/scene-graph.test.ts packages/scene-engine/src/commands/apply-scene-command.test.ts`

Expected: PASS.

- [ ] **Step 5: Update migration imports**

Update `packages/editor/src/lib/scene.ts` to import `SceneGraph` / `parseSceneGraph` from `@pascal/scene-engine` instead of `@pascal-app/core`.

Update `packages/editor/package.json` to declare `@pascal/scene-engine` alongside the editor runtime's other internal workspace dependencies.

Temporarily re-export the parser from `packages/core/src/index.ts` if other existing code still depends on that surface:

```ts
export { parseSceneGraph } from '@pascal/scene-engine'
export type { ParsedSceneGraph, SceneDocument } from '@pascal/scene-engine'
```

Also re-export the moved schema/types from `@pascal/scene-engine` through `packages/core/src/index.ts` until downstream imports are migrated.

- [ ] **Step 6: Verify new package and dependents**

Run: `bun test packages/scene-engine/src/document/scene-graph.test.ts packages/scene-engine/src/commands/apply-scene-command.test.ts`

Run: `bun run check-types --filter=@pascal/scene-engine --filter=@pascal-app/core --filter=@pascal-app/editor`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/scene-engine packages/core/package.json packages/core/src/index.ts packages/editor/src/lib/scene.ts
git commit -m "feat(scene-engine): extract scene document foundation"
```

## Task 3: Add file-backed desktop project persistence

**Files:**
- Create: `apps/desktop/src/shared/projects.ts`
- Create: `apps/desktop/src/main/projects/project-store.ts`
- Create: `apps/desktop/src/main/projects/project-ipc.ts`
- Create: `apps/desktop/src/main/projects/project-bootstrap.ts`
- Create: `apps/desktop/src/main/projects/project-store.test.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: Write the failing project-store tests**

Create tests for:

- create project
- save scene document
- reopen same file
- reject invalid scene document

Suggested shape:

```ts
test('reopens a saved project file with the same scene document', async () => {
  const store = createProjectStore({ rootDir: tempDir })
  const created = await store.createProject({ name: 'Test Project' })
  await store.saveProjectScene(created.projectFilePath, validScene)
  const reopened = await store.openProject(created.projectFilePath)
  expect(reopened.scene).toEqual(validScene)
})
```

Run: `bun test apps/desktop/src/main/projects/project-store.test.ts`

Expected: FAIL because the store does not exist.

- [ ] **Step 2: Define the shared contract**

Write `apps/desktop/src/shared/projects.ts` with exact types for:

- `PascalProjectFile`
- `CreateProjectInput`
- `ProjectSummary`
- `ProjectScenePayload`
- `GetInitialProjectResult`
- `ProjectId`

Use `SceneDocument` / `ParsedSceneGraph` from `@pascal/scene-engine`.

Make the contract explicit:

- `PascalProjectFile` is the canonical fully-loaded project shape used by `getInitialProject()` and `open()`
- `ProjectSummary` is metadata-only and used for recent-project lists or shell UI
- `GetInitialProjectResult` should be a type alias of `PascalProjectFile`, not a third distinct model

Add a short note in this file that the main process owns the `projectId -> projectFilePath` mapping via the trusted project store, so the renderer never invents or resolves file paths.

- [ ] **Step 3: Implement trusted main-process persistence**

Write `project-store.ts` using filesystem APIs with atomic save behavior:

```ts
await writeFile(tempPath, JSON.stringify(projectFile, null, 2), 'utf8')
await rename(tempPath, targetPath)
```

The store should validate incoming scene payloads with `parseSceneGraph()` before writing.

- [ ] **Step 4: Register preload-safe IPC**

Expose a narrow API from preload:

```ts
contextBridge.exposeInMainWorld('pascalDesktop', {
  projects: {
    getInitialProject: () => ipcRenderer.invoke('projects:get-initial-project'),
    create: (input) => ipcRenderer.invoke('projects:create', input),
    open: (projectId) => ipcRenderer.invoke('projects:open', { projectId }),
    saveScene: (projectId, scene) => ipcRenderer.invoke('projects:save-scene', { projectId, scene }),
  },
})
```

Do not expose raw `ipcRenderer`.

`projectId` must be a main-process-issued identifier resolved through the trusted project store. The renderer must never provide arbitrary filesystem paths for open/save calls.

- [ ] **Step 5: Verify persistence behavior**

Run: `bun test apps/desktop/src/main/projects/project-store.test.ts`

Run: `bun run check-types --filter=desktop`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/shared apps/desktop/src/main apps/desktop/src/preload
git commit -m "feat(desktop): add file-backed project store"
```

## Task 4: Mount the existing editor runtime in desktop mode

**Files:**
- Modify: `apps/desktop/src/renderer/src/app.tsx`
- Modify: `packages/editor/src/lib/scene.ts`
- Modify: `apps/editor/app/page.tsx`
- Test: `apps/desktop/src/main/projects/project-store.test.ts`

- [ ] **Step 1: Write a renderer host that fails without the preload contract**

In `apps/desktop/src/renderer/src/app.tsx`, write a small host component that expects `window.pascalDesktop.projects`.

Run: `bun run check-types --filter=desktop`

Expected: FAIL until the preload typing and window declarations line up.

- [ ] **Step 2: Add renderer typing for the preload bridge**

Add `vite-env.d.ts` declarations:

```ts
interface Window {
  pascalDesktop: {
    projects: {
      getInitialProject(): Promise<GetInitialProjectResult>
      create(input: CreateProjectInput): Promise<ProjectSummary>
      open(projectId: ProjectId): Promise<PascalProjectFile>
      saveScene(projectId: ProjectId, scene: SceneDocument): Promise<void>
    }
  }
}
```

- [ ] **Step 3: Mount `Editor` with file-backed adapters**

Replace the placeholder renderer host with:

```tsx
const [currentProject, setCurrentProject] = useState<PascalProjectFile | null>(null)

useEffect(() => {
  window.pascalDesktop.projects.getInitialProject().then(setCurrentProject)
}, [])

if (!currentProject) return <div>Loading project...</div>

<Editor
  projectId={currentProject.projectId}
  onLoad={async () => currentProject.scene}
  onSave={async (scene) => {
    await window.pascalDesktop.projects.saveScene(currentProject.projectId, scene)
  }}
/>
```

Keep the web host at [apps/editor/app/page.tsx](/Users/tinnguyen/editor/apps/editor/app/page.tsx) working as-is for demo usage.

- [ ] **Step 4: Ensure desktop mode never falls back to browser storage**

Use the desktop host’s `onLoad`/`onSave` path so `packages/editor/src/hooks/use-auto-save.ts` writes to local files instead of `saveSceneToLocalStorage()` when inside Electron.

Do **not** remove the web fallback in this milestone.

- [ ] **Step 5: Verify the desktop host path**

Run: `bun run check-types --filter=desktop --filter=@pascal-app/editor`

Run: `bun test apps/desktop/src/main/projects/project-store.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer packages/editor/src/lib/scene.ts apps/editor/app/page.tsx
git commit -m "feat(desktop): host editor with file-backed scene adapters"
```

## Task 5: Verification and developer ergonomics

**Files:**
- Modify: `README.md`
- Modify: `apps/desktop/package.json`
- Modify: `docs/superpowers/specs/2026-03-25-pascal-desktop-electron-native-design.md` (only if implementation uncovers a necessary correction)

- [ ] **Step 1: Add minimal desktop run instructions**

Document:

- install
- `bun run desktop:dev`
- where project files live during development

- [ ] **Step 2: Run the milestone verification suite**

Run:

```bash
bun test packages/scene-engine/src/document/scene-graph.test.ts
bun test packages/scene-engine/src/commands/apply-scene-command.test.ts
bun test apps/desktop/src/main/projects/project-store.test.ts
bun run check-types --filter=@pascal/scene-engine --filter=@pascal-app/core --filter=@pascal-app/editor --filter=desktop
```

Expected:

- all tests PASS
- all selected packages typecheck

- [ ] **Step 3: Run desktop smoke manually**

Run: `bun run desktop:dev`

Manual checks:

- app window opens
- editor renders
- create a project file
- save and reopen project file
- edits persist after relaunch

- [ ] **Step 4: Commit**

```bash
git add README.md apps/desktop/package.json
git commit -m "docs(desktop): add milestone verification notes"
```

## Final Verification Gate

Before calling the milestone complete:

- [ ] All new tests pass
- [ ] Desktop shell launches without using browser storage as the source of truth
- [ ] `@pascal/scene-engine` owns scene parsing/validation and first command application
- [ ] Main process owns trusted file IO
- [ ] Existing manual editing flow still works inside Electron

## Execution Notes

- Prefer small commits after each task.
- Do not mix agent-runtime or CodeMode work into this milestone.
- If `packages/core` consumers break during extraction, use temporary re-exports rather than broad rewrites.
- If `apps/desktop` scaffolding forces extra bundler complexity, choose the simplest path that preserves Electron as the real shell.
