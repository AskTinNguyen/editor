# apps/editor

Thin Next.js 16 shell that mounts the `<Editor>` component from `@pascal-app/editor`. Most editor logic lives in packages. This app handles routing, environment config, demo data loading, and scene format conversion.

## Route Structure

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Main editor — mounts `<Editor>` with demo scene |
| `/api/health` | `app/api/health/route.ts` | Health check endpoint |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/terms` | `app/terms/page.tsx` | Terms of service |

No dynamic routes (`[param]`) exist in this app currently.

## Entry Point (`page.tsx`)

```
<Editor onLoad={async () => {
  fetch('/demo-small-office-v1/pascal-projection.json')
  → convertPascalProjectionToSceneGraph(payload)
  → returns SceneGraph
}} />
```

The `onLoad` callback fetches demo data from `public/demo-small-office-v1/pascal-projection.json`, converts it via the Pascal demo adapter, and passes the resulting `SceneGraph` to the editor.

## Pascal Demo Adapter

`lib/pascal-demo-adapter.ts` exports `convertPascalProjectionToSceneGraph()`.

- **Input**: `PascalProjectionScene` — `{ variantId, nodes: PascalProjectionNode[] }` where each node has `id`, `kind`, `canonicalId`, `parentId?`, `geometry?`, `metadata?`.
- **Output**: `SceneGraph` — `{ nodes: Record<id, node>, rootNodeIds: string[] }` compatible with `@pascal-app/editor`.
- **Node kinds handled**: `site`, `building`, `level`, `zone`, `wall`, `slab`, `roof`, `door`, `window`, `opening` (mapped to `window`). Unknown kinds become `item` nodes.

Use this adapter when loading Pascal projection format. For native scene graphs, pass them directly to `<Editor>`.

## Environment Utils (`lib/utils.ts`)

| Export | Description |
|---|---|
| `isDevelopment` | `NODE_ENV` or `NEXT_PUBLIC_VERCEL_ENV` is `"development"` |
| `isProduction` | `NODE_ENV` or `NEXT_PUBLIC_VERCEL_ENV` is `"production"` |
| `isPreview` | `NEXT_PUBLIC_VERCEL_ENV` is `"preview"` |
| `BASE_URL` | Dev: `NEXT_PUBLIC_APP_URL` or `localhost:3000`. Preview: `NEXT_PUBLIC_VERCEL_URL`. Prod: `NEXT_PUBLIC_APP_URL` or Vercel production URL, fallback `https://editor.pascal.app`. |

## What Agents Should Know

- **To change the initial scene**: modify the `onLoad` callback in `app/page.tsx` or the conversion logic in `lib/pascal-demo-adapter.ts`.
- **To add a route**: create a new directory under `app/` following Next.js app router conventions.
- **This app is web-only**. For the desktop app, see `apps/desktop`.
- **Layout** (`app/layout.tsx`) loads Geist Sans/Mono, Geist Pixel, and Barlow fonts. The `<Agentation>` dev tool is included only in development.
