import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const clientMarker = join('src', 'client')
const prohibited = [
  [/@deepseek-ai\/dsh-subagent/, 'Subagent package import'],
  [/\bsubagents\b/, 'Subagent service access'],
  [/dsh-tool-subagent/, 'Subagent tool package'],
  [/\borigin\s*:\s*['"]subagent['"]/, 'Subagent session origin'],
  [/\bparentSession\s*:/, 'Parent/child Session linkage'],
  [/\bdelegationDepth\s*:/, 'Delegation-depth metadata'],
  [/@deepseek-ai\/[^'"\s]+\/src\//, 'Harness private source import'],
  [/sessionPersistence\.locate\s*\(/, 'Persistence artifact path access'],
  [/\bctx\.jobs\b/, 'Job runtime used as an Agent substitute'],
  [/\bagentCtx\.agentPresets\b/, 'Agent Presets must be mounted through the injected plugin context'],
  [/\bagentCtx\.permissionPresets\b/, 'Permission Presets must be applied through the injected plugin context'],
  [/\b(?:window|globalThis)\.(?:alert|confirm|prompt)\s*\(/, 'Browser-native dialogs are prohibited; use Harness Modal'],
  [/(^|[^\w.])(?:alert|confirm|prompt)\s*\(/m, 'Browser-native dialogs are prohibited; use Harness Modal'],
]

// Browser-side client files may reference the subagent wire type (opening a
// teammate Session as a subagent view); the server side stays subagent-free.
const clientExempted = new Set(['Subagent package import'])
const violations = []
for (const file of await files(sourceRoot)) {
  const content = await readFile(file, 'utf8')
  const isClient = file.includes(clientMarker)
  for (const [pattern, label] of prohibited) {
    if (pattern.test(content) && !(isClient && clientExempted.has(label))) {
      violations.push(`${relative(root, file)}: ${label}`)
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(`Agent Team architecture guard failed:\n${violations.map(item => `- ${item}`).join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('Agent Team architecture guard passed.\n')
}

async function files(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(path))
    else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) result.push(path)
  }
  return result
}
