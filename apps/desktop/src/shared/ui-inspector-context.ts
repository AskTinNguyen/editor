import {
  UI_INSPECTOR_CAPS,
  type UiInspectorContextOptions,
  type UiInspectorSnapshot,
} from './ui-inspector'

const SENSITIVE_KEY_PATTERN = /(token|secret|password|api[_-]?key|authorization)/i
const TEXT_SECRET_PATTERN = /\b(api[_-]?key|token|secret|password)\s*[:=]\s*([^\s"'&]+)/gi
const BEARER_PATTERN = /\bbearer\s+[a-z0-9._-]+\b/gi
const AUTHORIZATION_HEADER_PATTERN = /\bauthorization\s*:\s*bearer\s+[a-z0-9._-]+\b/gi
const QUERY_PARAM_PATTERN = /([?&])([^=&]+)=([^&#]*)/gi
const HTML_VALUE_PATTERN = /\bvalue=(['"])(.*?)\1/gi

function clampText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}...`
}

function truncateRecord(
  value: Record<string, string> | undefined,
  maxKeys: number,
): Record<string, string> | undefined {
  if (!value) return undefined
  const entries = Object.entries(value).slice(0, maxKeys)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function redactSensitiveQueryParams(value: string): string {
  return value.replace(QUERY_PARAM_PATTERN, (match, prefix: string, key: string, rawValue: string) => {
    if (!SENSITIVE_KEY_PATTERN.test(key)) {
      return match
    }

    return `${prefix}${key}=${rawValue ? '[REDACTED]' : ''}`
  })
}

function redactHtmlValue(value: string): string {
  return value.replace(HTML_VALUE_PATTERN, (_match, quote: string, rawValue: string) => {
    if (!rawValue) {
      return `value=${quote}${rawValue}${quote}`
    }

    return `value=${quote}[REDACTED]${quote}`
  })
}

export function redactInspectorText(value: string): string {
  return redactSensitiveQueryParams(
    value
      .replace(AUTHORIZATION_HEADER_PATTERN, 'Authorization: bearer [REDACTED]')
      .replace(BEARER_PATTERN, 'bearer [REDACTED]')
      .replace(TEXT_SECRET_PATTERN, (_match, key: string) => `${key}=[REDACTED]`)
      .replace(
        /\bauthorization\s*[:=]\s*(?!bearer\s+\[REDACTED\])([^\s"'&]+)/gi,
        'authorization=[REDACTED]',
      ),
  )
}

function serializeBounds(snapshot: UiInspectorSnapshot): string {
  const { x, y, width, height } = snapshot.bounds
  return `${x},${y},${width},${height}`
}

function serializeScene(snapshot: UiInspectorSnapshot): string[] {
  if (!snapshot.scene) return []

  const lines: string[] = []
  const { scene } = snapshot

  if (scene.selectedNodeIds && scene.selectedNodeIds.length > 0) {
    lines.push(`selectedNodeIds: ${scene.selectedNodeIds.join(', ')}`)
  }
  if (scene.hoveredNodeId) lines.push(`hoveredNodeId: ${scene.hoveredNodeId}`)
  if (scene.phase) lines.push(`phase: ${scene.phase}`)
  if (scene.mode) lines.push(`mode: ${scene.mode}`)
  if (scene.tool) lines.push(`tool: ${scene.tool}`)
  if (scene.cameraMode) lines.push(`cameraMode: ${scene.cameraMode}`)
  if (scene.levelMode) lines.push(`levelMode: ${scene.levelMode}`)
  if (scene.wallMode) lines.push(`wallMode: ${scene.wallMode}`)

  return lines
}

export function buildUiInspectorContextPayload(
  snapshot: UiInspectorSnapshot,
  options: UiInspectorContextOptions = {},
): string {
  const textSnippet = snapshot.textSnippet
    ? clampText(redactInspectorText(snapshot.textSnippet), UI_INSPECTOR_CAPS.contextTextExcerptMax)
    : undefined

  const htmlExcerpt = snapshot.htmlExcerpt
    ? clampText(
        redactInspectorText(redactHtmlValue(snapshot.htmlExcerpt)),
        UI_INSPECTOR_CAPS.contextHtmlExcerptMax,
      )
    : undefined

  const styles = truncateRecord(snapshot.styles, UI_INSPECTOR_CAPS.contextMaxStyleKeys)
  const dataAttributes = truncateRecord(
    snapshot.dataAttributes,
    UI_INSPECTOR_CAPS.contextMaxDataAttrKeys,
  )

  const lines = [
    'UI_INSPECTOR_CONTEXT',
    `source: ${snapshot.source}`,
    `label: ${snapshot.label}`,
    `bounds: ${serializeBounds(snapshot)}`,
  ]

  if (snapshot.route) lines.push(`route: ${snapshot.route}`)
  if (snapshot.selector) lines.push(`selector: ${snapshot.selector}`)
  if (snapshot.targetId) lines.push(`targetId: ${snapshot.targetId}`)
  if (snapshot.componentPath && snapshot.componentPath.length > 0) {
    lines.push(
      `componentPath: ${snapshot.componentPath
        .slice(0, UI_INSPECTOR_CAPS.maxComponentPathDepth)
        .join(' > ')}`,
    )
  }
  if (textSnippet) lines.push(`textSnippet: ${textSnippet}`)
  if (options.includeHtml !== false && htmlExcerpt) lines.push(`htmlExcerpt: ${htmlExcerpt}`)
  if (options.includeStyles !== false && styles) lines.push(`styles: ${JSON.stringify(styles)}`)
  if (options.includeDataAttributes !== false && dataAttributes) {
    lines.push(`dataAttributes: ${JSON.stringify(dataAttributes)}`)
  }
  if (snapshot.screenshotByteSize) lines.push(`screenshotByteSize: ${snapshot.screenshotByteSize}`)
  if (snapshot.capturedAt) lines.push(`capturedAt: ${snapshot.capturedAt}`)

  const sceneLines = serializeScene(snapshot)
  if (sceneLines.length > 0) {
    lines.push('scene:')
    lines.push(...sceneLines.map((line) => `  ${line}`))
  }

  return lines.join('\n')
}
