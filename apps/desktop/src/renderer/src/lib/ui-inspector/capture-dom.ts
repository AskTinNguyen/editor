import { UI_INSPECTOR_CAPS, type UiInspectorSnapshot } from '../../../../shared/ui-inspector'

function isInspectorChrome(element: Element): boolean {
  return element.closest('[data-ui-inspector-chrome="true"]') !== null
}

function selectorForElement(element: Element): string {
  const id = element.getAttribute('id')
  if (id) return `#${CSS.escape(id)}`

  const dataTestId = element.getAttribute('data-testid')
  if (dataTestId) return `[data-testid="${CSS.escape(dataTestId)}"]`

  const role = element.getAttribute('role')
  if (role) return `${element.tagName.toLowerCase()}[role="${CSS.escape(role)}"]`

  const base = element.tagName.toLowerCase()
  if (document.querySelectorAll(base).length === 1) return base

  const nth =
    Array.from(element.parentElement?.children ?? [])
      .filter((node) => node.tagName === element.tagName)
      .indexOf(element) + 1

  return `${base}:nth-of-type(${Math.max(1, nth)})`
}

function safeOuterHtml(element: HTMLElement): string | undefined {
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase()
    if (type === 'password' || type === 'hidden') {
      return `<input type="${type}" value="[REDACTED]" />`
    }
  }

  const normalized = element.outerHTML.trim()
  if (!normalized) return undefined

  return normalized.length <= UI_INSPECTOR_CAPS.maxOuterHtmlLength
    ? normalized
    : `${normalized.slice(0, UI_INSPECTOR_CAPS.maxOuterHtmlLength)}...`
}

function extractLabel(element: HTMLElement): string {
  const ariaLabel = element.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  const dataTestId = element.getAttribute('data-testid')?.trim()
  if (dataTestId) return dataTestId

  const textContent = element.textContent?.trim().replace(/\s+/g, ' ')
  if (textContent) return textContent.slice(0, UI_INSPECTOR_CAPS.maxTextSnippetLength)

  return element.id || element.tagName.toLowerCase()
}

function extractDataAttributes(element: HTMLElement): Record<string, string> | undefined {
  const entries = Array.from(element.attributes)
    .filter((attribute) => attribute.name.startsWith('data-'))
    .filter((attribute) => attribute.name !== 'data-ui-inspector-chrome')
    .slice(0, UI_INSPECTOR_CAPS.contextMaxDataAttrKeys)
    .map((attribute) => [attribute.name, attribute.value] as const)

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function extractStyles(element: HTMLElement): Record<string, string> | undefined {
  const computed = window.getComputedStyle(element)
  const styleKeys = [
    'display',
    'position',
    'color',
    'backgroundColor',
    'fontSize',
    'fontWeight',
    'borderRadius',
  ] as const

  const entries = styleKeys
    .map((key) => [key, computed[key]])
    .filter(([, value]) => Boolean(value))

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function captureDomInspectorTarget(element: Element): UiInspectorSnapshot | null {
  if (!(element instanceof HTMLElement) || isInspectorChrome(element)) {
    return null
  }

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return null
  }

  return {
    source: 'dom',
    label: extractLabel(element),
    route: window.location.pathname,
    selector: selectorForElement(element),
    targetId: element.id || undefined,
    textSnippet: element.textContent?.trim().slice(0, UI_INSPECTOR_CAPS.maxTextSnippetLength),
    htmlExcerpt: safeOuterHtml(element),
    styles: extractStyles(element),
    dataAttributes: extractDataAttributes(element),
    bounds: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    capturedAt: new Date().toISOString(),
  }
}
