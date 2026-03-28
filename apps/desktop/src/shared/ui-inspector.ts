export const UI_INSPECTOR_TOOL_IDS = {
  getState: 'vesper_ui_get_state',
  getSelection: 'vesper_ui_get_selection',
  getContext: 'vesper_ui_get_context',
  captureScreenshot: 'vesper_ui_capture_screenshot',
} as const

export const UI_INSPECTOR_ACTIONS = {
  getState: 'get_state',
  getSelection: 'get_selection',
  getContext: 'get_context',
  captureScreenshot: 'capture_screenshot',
} as const

export const UI_INSPECTOR_IPC_CHANNELS = {
  getState: 'uiInspector:getState',
  setMode: 'uiInspector:setMode',
  setSnapshot: 'uiInspector:setSnapshot',
  clear: 'uiInspector:clear',
  stateChanged: 'uiInspector:stateChanged',
  captureScreenshot: 'uiInspector:captureScreenshot',
  sendToChat: 'uiInspector:sendToChat',
} as const

export const UI_INSPECTOR_CAPS = {
  maxOuterHtmlLength: 4000,
  minOuterHtmlLength: 200,
  maxOuterHtmlLengthMax: 8000,
  maxTextSnippetLength: 500,
  minTextSnippetLength: 80,
  maxTextSnippetLengthMax: 2000,
  maxComponentPathDepth: 10,
  minComponentPathDepth: 3,
  maxComponentPathDepthMax: 20,
  contextHtmlExcerptMax: 2400,
  minContextHtmlExcerptMax: 120,
  maxContextHtmlExcerptMax: 4000,
  contextTextExcerptMax: 360,
  minContextTextExcerptMax: 80,
  maxContextTextExcerptMax: 1000,
  contextMaxStyleKeys: 120,
  minContextMaxStyleKeys: 20,
  maxContextMaxStyleKeys: 200,
  contextMaxDataAttrKeys: 20,
  minContextMaxDataAttrKeys: 5,
  maxContextMaxDataAttrKeys: 60,
  screenshotMaxBytes: 4 * 1024 * 1024,
  minScreenshotMaxBytes: 256 * 1024,
  maxScreenshotMaxBytes: 6 * 1024 * 1024,
} as const

export type UiInspectorMode = 'idle' | 'inspect'

export type UiInspectorSource = 'dom' | 'scene'

export type UiInspectorBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type UiInspectorSceneContext = {
  selectedNodeIds?: string[]
  hoveredNodeId?: string | null
  phase?: string
  mode?: string
  tool?: string | null
  cameraMode?: string
  levelMode?: string
  wallMode?: string
}

export type UiInspectorSnapshot = {
  source: UiInspectorSource
  label: string
  route?: string
  selector?: string
  targetId?: string
  textSnippet?: string
  htmlExcerpt?: string
  styles?: Record<string, string>
  dataAttributes?: Record<string, string>
  componentPath?: string[]
  screenshotDataUrl?: string
  screenshotByteSize?: number
  scene?: UiInspectorSceneContext
  bounds: UiInspectorBounds
  capturedAt?: string
}

export type UiInspectorState = {
  mode: UiInspectorMode
  snapshot: UiInspectorSnapshot | null
  updatedAt: string | null
}

export type UiInspectorAttachment = {
  label: string
  source: UiInspectorSource
  route?: string
  selector?: string
  selectedNodeIds?: string[]
}

export type UiInspectorSendOptions = {
  agentContextPrefix?: string
  uiInspectorAttachment?: UiInspectorAttachment
}

export type InspectorErrorCode =
  | 'NO_SELECTION'
  | 'CAPTURE_FAILED'
  | 'SEND_FAILED'
  | 'TOOL_UNAVAILABLE'
  | 'PERMISSION_BLOCKED'

export type InspectorError = {
  code: InspectorErrorCode
  message: string
  retriable: boolean
}

export type InspectorResult<T> =
  | { success: true; data: T }
  | { success: false; error: InspectorError }

export type UiInspectorContextOptions = {
  includeHtml?: boolean
  includeStyles?: boolean
  includeDataAttributes?: boolean
}

export type PascalDesktopUiInspectorApi = {
  getState(projectId: string): Promise<UiInspectorState>
  setMode(projectId: string, mode: UiInspectorMode): Promise<InspectorResult<UiInspectorState>>
  setSnapshot(
    projectId: string,
    snapshot: UiInspectorSnapshot,
  ): Promise<InspectorResult<UiInspectorState>>
  clear(projectId: string): Promise<InspectorResult<UiInspectorState>>
  captureScreenshot(
    projectId: string,
    bounds: UiInspectorBounds,
    scale?: number,
    captureContext?: string,
  ): Promise<InspectorResult<{ screenshotDataUrl: string; screenshotByteSize: number }>>
  sendToChat(
    projectId: string,
    prompt: string,
    options?: UiInspectorSendOptions,
  ): Promise<InspectorResult<unknown>>
  subscribe(projectId: string, listener: (state: UiInspectorState) => void): () => void
}
