import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  BuildingNode,
  LevelNode,
  SiteNode,
  parseSceneGraph,
  type ParsedSceneGraph,
  type SceneDocument,
} from '@pascal/scene-engine'
import type {
  CreateProjectInput,
  PascalProjectFile,
  ProjectId,
  ProjectSummary,
} from '../../shared/projects'

const PROJECT_FILE_NAME = 'project.pascal.json'
const WORKSPACE_INDEX_FILE = '.pascal-workspace.json'

type WorkspaceIndex = {
  version: 1
  projectPaths: Partial<Record<ProjectId, string>>
  recentProjectIds: ProjectId[]
}

export type StoredProjectFile = PascalProjectFile & {
  projectFilePath: string
}

function createProjectId(): ProjectId {
  return `project_${randomUUID().replaceAll('-', '')}`
}

function createDefaultSceneDocument(): ParsedSceneGraph {
  const level = LevelNode.parse({ level: 0, children: [] })
  const building = BuildingNode.parse({ children: [level.id] })
  const site = {
    ...SiteNode.parse({}),
    children: [building.id],
  }

  const scene = parseSceneGraph({
    nodes: {
      [site.id]: site,
      [building.id]: building,
      [level.id]: level,
    },
    rootNodeIds: [site.id],
  })

  if (!scene) {
    throw new Error('Failed to build the default scene document')
  }

  return scene
}

function createEmptyWorkspaceIndex(): WorkspaceIndex {
  return {
    version: 1,
    projectPaths: {},
    recentProjectIds: [],
  }
}

function normalizeRecentProjects(
  recentProjectIds: ProjectId[],
  projectId: ProjectId,
): ProjectId[] {
  return [projectId, ...recentProjectIds.filter((candidate) => candidate !== projectId)]
}

function toProjectSummary(project: PascalProjectFile): ProjectSummary {
  return {
    projectId: project.projectId,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function toPascalProjectFile(project: StoredProjectFile): PascalProjectFile {
  return {
    projectId: project.projectId,
    name: project.name,
    scene: project.scene,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

async function writeJsonAtomically(filePath: string, value: unknown) {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8')
  await rename(tempPath, filePath)
}

async function readWorkspaceIndex(rootDir: string): Promise<WorkspaceIndex> {
  try {
    const raw = await readFile(join(rootDir, WORKSPACE_INDEX_FILE), 'utf8')
    const parsed = JSON.parse(raw) as Partial<WorkspaceIndex>

    return {
      version: 1,
      projectPaths:
        typeof parsed.projectPaths === 'object' && parsed.projectPaths ? parsed.projectPaths : {},
      recentProjectIds: Array.isArray(parsed.recentProjectIds)
        ? parsed.recentProjectIds.filter((value): value is ProjectId => typeof value === 'string')
        : [],
    }
  } catch {
    return createEmptyWorkspaceIndex()
  }
}

async function writeWorkspaceIndex(rootDir: string, index: WorkspaceIndex) {
  await writeJsonAtomically(join(rootDir, WORKSPACE_INDEX_FILE), index)
}

function parseStoredProjectFile(input: unknown, projectFilePath: string): StoredProjectFile {
  if (!(input && typeof input === 'object')) {
    throw new Error(`Project file at ${projectFilePath} is invalid`)
  }

  const project = input as Partial<StoredProjectFile>
  const scene = parseSceneGraph(project.scene)

  if (
    !scene ||
    typeof project.projectId !== 'string' ||
    typeof project.name !== 'string' ||
    typeof project.createdAt !== 'string' ||
    typeof project.updatedAt !== 'string'
  ) {
    throw new Error(`Project file at ${projectFilePath} is invalid`)
  }

  return {
    projectId: project.projectId as ProjectId,
    name: project.name,
    scene,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    projectFilePath,
  }
}

async function readStoredProjectFile(projectFilePath: string): Promise<StoredProjectFile> {
  const raw = await readFile(projectFilePath, 'utf8')
  return parseStoredProjectFile(JSON.parse(raw), projectFilePath)
}

async function writeStoredProjectFile(project: StoredProjectFile) {
  await writeJsonAtomically(project.projectFilePath, {
    projectId: project.projectId,
    name: project.name,
    scene: project.scene,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  })
}

async function rememberProject(rootDir: string, project: StoredProjectFile) {
  const index = await readWorkspaceIndex(rootDir)
  index.projectPaths[project.projectId] = project.projectFilePath
  index.recentProjectIds = normalizeRecentProjects(index.recentProjectIds, project.projectId)
  await writeWorkspaceIndex(rootDir, index)
}

export function createProjectStore({ rootDir }: { rootDir: string }) {
  async function createProject(input: CreateProjectInput): Promise<StoredProjectFile> {
    const projectId = createProjectId()
    const now = new Date().toISOString()
    const projectFilePath = join(rootDir, projectId, PROJECT_FILE_NAME)
    const project: StoredProjectFile = {
      projectId,
      name: input.name,
      scene: createDefaultSceneDocument(),
      createdAt: now,
      updatedAt: now,
      projectFilePath,
    }

    await writeStoredProjectFile(project)
    await rememberProject(rootDir, project)

    return project
  }

  async function openProject(projectFilePath: string): Promise<StoredProjectFile> {
    const project = await readStoredProjectFile(projectFilePath)
    await rememberProject(rootDir, project)
    return project
  }

  async function openProjectById(projectId: ProjectId): Promise<PascalProjectFile> {
    const index = await readWorkspaceIndex(rootDir)
    const projectFilePath = index.projectPaths[projectId]

    if (!projectFilePath) {
      throw new Error(`Unknown project "${projectId}"`)
    }

    const project = await openProject(projectFilePath)
    return toPascalProjectFile(project)
  }

  async function getMostRecentProject(): Promise<PascalProjectFile | null> {
    const index = await readWorkspaceIndex(rootDir)

    for (const projectId of index.recentProjectIds) {
      const projectFilePath = index.projectPaths[projectId]
      if (!projectFilePath) {
        continue
      }

      try {
        const project = await readStoredProjectFile(projectFilePath)
        return toPascalProjectFile(project)
      } catch {
        delete index.projectPaths[projectId]
        index.recentProjectIds = index.recentProjectIds.filter(
          (candidate) => candidate !== projectId,
        )
        await writeWorkspaceIndex(rootDir, index)
      }
    }

    return null
  }

  async function saveProjectScene(projectId: ProjectId, scene: SceneDocument): Promise<void> {
    const parsedScene = parseSceneGraph(scene)

    if (!parsedScene) {
      throw new Error('Invalid scene document')
    }

    const index = await readWorkspaceIndex(rootDir)
    const projectFilePath = index.projectPaths[projectId]

    if (!projectFilePath) {
      throw new Error(`Unknown project "${projectId}"`)
    }

    const existingProject = await readStoredProjectFile(projectFilePath)
    const nextProject: StoredProjectFile = {
      ...existingProject,
      scene: parsedScene,
      updatedAt: new Date().toISOString(),
    }

    await writeStoredProjectFile(nextProject)
    await rememberProject(rootDir, nextProject)
  }

  async function listRecentProjects(): Promise<ProjectSummary[]> {
    const index = await readWorkspaceIndex(rootDir)
    const projects: ProjectSummary[] = []

    for (const projectId of index.recentProjectIds) {
      const projectFilePath = index.projectPaths[projectId]
      if (!projectFilePath) {
        continue
      }

      try {
        const project = await readStoredProjectFile(projectFilePath)
        projects.push(toProjectSummary(project))
      } catch {}
    }

    return projects
  }

  async function clearWorkspace() {
    await rm(rootDir, { force: true, recursive: true })
  }

  return {
    clearWorkspace,
    createProject,
    getMostRecentProject,
    listRecentProjects,
    openProject,
    openProjectById,
    saveProjectScene,
  }
}
