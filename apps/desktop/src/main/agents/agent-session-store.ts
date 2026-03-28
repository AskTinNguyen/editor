import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AgentSession, AgentSessionId } from '../../shared/agents'
import type { ProjectId } from '../../shared/projects'

const SESSION_FILE_NAME = 'agent-session.json'

function createSessionId(): AgentSessionId {
  return `session_${randomUUID().replaceAll('-', '')}`
}

function createEmptySession(projectId: ProjectId): AgentSession {
  const now = new Date().toISOString()
  return {
    sessionId: createSessionId(),
    projectId,
    status: 'idle',
    messages: [],
    lastTurnResult: null,
    model: 'claude-sonnet-4-6',
    thinkingLevel: 'think',
    createdAt: now,
    updatedAt: now,
  }
}

function sessionFilePath(rootDir: string, projectId: ProjectId): string {
  return join(rootDir, projectId, SESSION_FILE_NAME)
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8')
  await rename(tempPath, filePath)
}

export function createAgentSessionStore({ rootDir }: { rootDir: string }) {
  const cache = new Map<ProjectId, AgentSession>()

  async function getSession(projectId: ProjectId): Promise<AgentSession> {
    // Return cached version if available
    const cached = cache.get(projectId)
    if (cached) {
      return cached
    }

    // Try to load from disk
    const filePath = sessionFilePath(rootDir, projectId)
    try {
      const raw = await readFile(filePath, 'utf8')
      const session = JSON.parse(raw) as AgentSession
      cache.set(projectId, session)
      return session
    } catch {
      // File doesn't exist or is invalid — create a new empty session
      const session = createEmptySession(projectId)
      cache.set(projectId, session)
      await writeJsonAtomically(filePath, session)
      return session
    }
  }

  async function saveSession(session: AgentSession): Promise<void> {
    const filePath = sessionFilePath(rootDir, session.projectId)
    session.updatedAt = new Date().toISOString()
    cache.set(session.projectId, session)
    await writeJsonAtomically(filePath, session)
  }

  async function clearSessions(): Promise<void> {
    cache.clear()
    await rm(rootDir, { force: true, recursive: true })
  }

  return {
    getSession,
    saveSession,
    clearSessions,
  }
}
