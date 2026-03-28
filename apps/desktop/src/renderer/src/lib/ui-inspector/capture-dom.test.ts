import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { captureDomInspectorTarget } from './capture-dom'

type FakeAttribute = {
  name: string
  value: string
}

class FakeElement {
  tagName: string
  parentElement: FakeElement | null = null
  children: FakeElement[] = []
  attributes: FakeAttribute[]
  textContent: string
  outerHTML: string
  rect: DOMRect

  constructor({
    tagName,
    attributes = [],
    textContent = '',
    outerHTML,
    rect,
  }: {
    tagName: string
    attributes?: FakeAttribute[]
    textContent?: string
    outerHTML?: string
    rect?: Partial<Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>>
  }) {
    this.tagName = tagName.toUpperCase()
    this.attributes = attributes
    this.textContent = textContent
    this.outerHTML = outerHTML ?? `<${tagName.toLowerCase()}>${textContent}</${tagName.toLowerCase()}>`

    const x = rect?.x ?? 0
    const y = rect?.y ?? 0
    const width = rect?.width ?? 120
    const height = rect?.height ?? 32

    this.rect = {
      x,
      y,
      width,
      height,
      top: y,
      left: x,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({}),
    } as DOMRect
  }

  get id(): string {
    return this.getAttribute('id') ?? ''
  }

  appendChild(child: FakeElement) {
    child.parentElement = this
    this.children.push(child)
  }

  getAttribute(name: string): string | null {
    return this.attributes.find((attribute) => attribute.name === name)?.value ?? null
  }

  getBoundingClientRect(): DOMRect {
    return this.rect
  }

  closest(selector: string): FakeElement | null {
    if (selector !== '[data-ui-inspector-chrome="true"]') {
      return null
    }

    let current: FakeElement | null = this
    while (current) {
      if (current.getAttribute('data-ui-inspector-chrome') === 'true') {
        return current
      }
      current = current.parentElement
    }

    return null
  }
}

class FakeInputElement extends FakeElement {}
class FakeHtmlInputElement extends FakeInputElement {
  get type(): string {
    return this.getAttribute('type') ?? 'text'
  }
}

const originalGlobals = {
  Element: globalThis.Element,
  HTMLElement: globalThis.HTMLElement,
  HTMLInputElement: globalThis.HTMLInputElement,
  CSS: globalThis.CSS,
  document: globalThis.document,
  window: globalThis.window,
}

beforeEach(() => {
  const registry = new Map<string, FakeElement[]>()

  Object.assign(globalThis, {
    Element: FakeElement,
    HTMLElement: FakeElement,
    HTMLInputElement: FakeHtmlInputElement,
    CSS: {
      escape(value: string) {
        return value
      },
    },
    document: {
      querySelectorAll(selector: string) {
        return registry.get(selector) ?? []
      },
    },
    window: {
      location: { pathname: '/projects/demo' },
      getComputedStyle() {
        return {
          display: 'block',
          position: 'relative',
          color: 'rgb(15, 23, 42)',
          backgroundColor: 'rgb(255, 255, 255)',
          fontSize: '14px',
          fontWeight: '500',
          borderRadius: '8px',
        }
      },
    },
  })

  ;(globalThis as typeof globalThis & { __uiInspectorRegistry: Map<string, FakeElement[]> }).__uiInspectorRegistry =
    registry
})

afterEach(() => {
  Object.assign(globalThis, originalGlobals)
  delete (globalThis as typeof globalThis & { __uiInspectorRegistry?: unknown }).__uiInspectorRegistry
})

function registerElements(selector: string, ...elements: FakeElement[]) {
  const registry = (
    globalThis as typeof globalThis & { __uiInspectorRegistry: Map<string, FakeElement[]> }
  ).__uiInspectorRegistry
  registry.set(selector, elements)
}

describe('captureDomInspectorTarget', () => {
  test('ignores inspector chrome and returns a selector for normal UI', () => {
    const chrome = new FakeElement({
      tagName: 'div',
      attributes: [{ name: 'data-ui-inspector-chrome', value: 'true' }],
    })
    const ignored = new FakeElement({
      tagName: 'button',
      attributes: [{ name: 'id', value: 'ignore-me' }],
      textContent: 'Ignore',
      outerHTML: '<button id="ignore-me">Ignore</button>',
    })
    chrome.appendChild(ignored)

    const target = new FakeElement({
      tagName: 'button',
      attributes: [{ name: 'id', value: 'real-target' }],
      textContent: 'Save',
      outerHTML: '<button id="real-target">Save</button>',
      rect: { x: 24, y: 48, width: 120, height: 36 },
    })

    registerElements('button', ignored, target)

    const snapshot = captureDomInspectorTarget(target as unknown as Element)
    const chromeSnapshot = captureDomInspectorTarget(ignored as unknown as Element)

    expect(snapshot?.selector).toBe('#real-target')
    expect(snapshot?.label).toBe('Save')
    expect(snapshot?.route).toBe('/projects/demo')
    expect(snapshot?.bounds).toEqual({
      x: 24,
      y: 48,
      width: 120,
      height: 36,
    })
    expect(chromeSnapshot).toBeNull()
  })

  test('redacts hidden input values and ignores zero-size nodes', () => {
    const hiddenInput = new FakeHtmlInputElement({
      tagName: 'input',
      attributes: [
        { name: 'type', value: 'hidden' },
        { name: 'id', value: 'token-field' },
      ],
      outerHTML: '<input id="token-field" type="hidden" value="super-secret" />',
    })

    const zeroSize = new FakeElement({
      tagName: 'div',
      textContent: 'Invisible',
      rect: { width: 0, height: 0 },
    })

    registerElements('input', hiddenInput)
    registerElements('div', zeroSize)

    const hiddenSnapshot = captureDomInspectorTarget(hiddenInput as unknown as Element)
    const zeroSizeSnapshot = captureDomInspectorTarget(zeroSize as unknown as Element)

    expect(hiddenSnapshot?.htmlExcerpt).toBe('<input type="hidden" value="[REDACTED]" />')
    expect(zeroSizeSnapshot).toBeNull()
  })
})
