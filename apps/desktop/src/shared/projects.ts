import type {
  ParsedSceneGraph,
  SceneCommand,
  SceneCommandBatchResult,
  SceneCommandResult,
  SceneDocument,
} from '@pascal/scene-engine'

export type ProjectId = `project_${string}`

export type PascalProjectFile = {
  projectId: ProjectId
  name: string
  scene: ParsedSceneGraph
  createdAt: string
  updatedAt: string
}

export type CreateProjectInput = {
  name: string
}

export type ProjectSummary = {
  projectId: ProjectId
  name: string
  createdAt: string
  updatedAt: string
}

export type ProjectScenePayload = {
  projectId: ProjectId
  scene: SceneDocument
}

export type GetInitialProjectResult = PascalProjectFile

export type ProjectCommandPayload = {
  projectId: ProjectId
  commands: SceneCommand[]
}

export type ProjectCommandResult =
  | { status: 'ok'; result: SceneCommandResult | SceneCommandBatchResult }
  | { status: 'error'; result: SceneCommandResult | SceneCommandBatchResult }

export type PascalDesktopProjectsApi = {
  getInitialProject(): Promise<GetInitialProjectResult>
  create(input: CreateProjectInput): Promise<ProjectSummary>
  open(projectId: ProjectId): Promise<PascalProjectFile>
  saveScene(projectId: ProjectId, scene: SceneDocument): Promise<void>
  listRecent(): Promise<ProjectSummary[]>
  applySceneCommands(projectId: ProjectId, commands: SceneCommand[]): Promise<ProjectCommandResult>
}

export type { PascalDesktopAgentsApi } from './agents'

export type PascalDesktopApi = {
  // The trusted main process owns the projectId -> projectFilePath mapping.
  projects: PascalDesktopProjectsApi
  agents: import('./agents').PascalDesktopAgentsApi
}
