import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'

const DIST_DIR = resolve('dist')

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)))
      continue
    }

    if (entry.isFile() && extname(entry.name) === '.js') {
      files.push(entryPath)
    }
  }

  return files
}

async function resolveRuntimeSpecifier(filePath, specifier) {
  if (!specifier.startsWith('.') || extname(specifier)) {
    return specifier
  }

  const absoluteBase = resolve(dirname(filePath), specifier)
  const fileCandidate = `${absoluteBase}.js`
  const indexCandidate = join(absoluteBase, 'index.js')

  try {
    const fileStat = await stat(fileCandidate)
    if (fileStat.isFile()) {
      return `${specifier}.js`
    }
  } catch {}

  try {
    const indexStat = await stat(indexCandidate)
    if (indexStat.isFile()) {
      return `${specifier}/index.js`
    }
  } catch {}

  return specifier
}

async function rewriteFile(filePath) {
  const raw = await readFile(filePath, 'utf8')
  const matches = [...raw.matchAll(/(from\s+['"])(\.[^'"]+)(['"])/g)]

  if (matches.length === 0) {
    return
  }

  let next = raw

  for (const match of matches) {
    const [, prefix, specifier, suffix] = match
    const rewrittenSpecifier = await resolveRuntimeSpecifier(filePath, specifier)

    if (rewrittenSpecifier === specifier) {
      continue
    }

    next = next.replace(`${prefix}${specifier}${suffix}`, `${prefix}${rewrittenSpecifier}${suffix}`)
  }

  if (next !== raw) {
    await writeFile(filePath, next, 'utf8')
  }
}

for (const filePath of await walk(DIST_DIR)) {
  await rewriteFile(filePath)
}
