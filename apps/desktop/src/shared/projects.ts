import type { ParsedSceneGraph, SceneDocument } from '@pascal/scene-engine'

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

export type PascalDesktopProjectsApi = {
  getInitialProject(): Promise<GetInitialProjectResult>
  create(input: CreateProjectInput): Promise<ProjectSummary>
  open(projectId: ProjectId): Promise<PascalProjectFile>
  saveScene(projectId: ProjectId, scene: SceneDocument): Promise<void>
}

export type PascalDesktopApi = {
  // The trusted main process owns the projectId -> projectFilePath mapping.
  projects: PascalDesktopProjectsApi
}
