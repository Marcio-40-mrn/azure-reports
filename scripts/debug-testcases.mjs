/**
 * Debug script — chama a API do Azure DevOps diretamente (sem browser/Vite).
 *
 * Uso:
 *   node scripts/debug-testcases.mjs "Nome Completo" [dias]
 *
 * Exemplos:
 *   node scripts/debug-testcases.mjs "Marcio Silva" 15
 *   node scripts/debug-testcases.mjs "Marcio" 30
 *
 * Mostra:
 *   1. Lista de usuários encontrados que batem com o nome
 *   2. IDs retornados pelo WIQL para Test Cases
 *   3. Test points encontrados nos planos (com outcome e dateCompleted)
 *   4. IDs executados no período
 *   5. Resultado final do merge
 */

import axios from 'axios'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ─── Config ──────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env')

function parseEnv(path) {
  const lines = readFileSync(path, 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const env = parseEnv(envPath)
const PAT = env.VITE_AZURE_PAT
const ORG = (env.VITE_AZURE_ORG || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '').trim()

if (!PAT || !ORG) {
  console.error('❌  VITE_AZURE_PAT e VITE_AZURE_ORG precisam estar no .env')
  process.exit(1)
}

const NAME_FILTER = process.argv[2] ?? ''
const DAYS = parseInt(process.argv[3] ?? '15', 10)

if (!NAME_FILTER) {
  console.error('❌  Informe o nome: node scripts/debug-testcases.mjs "Seu Nome" [dias]')
  process.exit(1)
}

const endDate = new Date()
const startDate = new Date()
startDate.setDate(startDate.getDate() - DAYS)
const fmt = d => d.toISOString().slice(0, 10)
const START = fmt(startDate)
const END = fmt(endDate)
const END_BOUND = END + 'T23:59:59'

console.log(`\n🔍  Nome: "${NAME_FILTER}"  |  Período: ${START} → ${END}  |  Org: ${ORG}\n`)

const base = `https://dev.azure.com/${ORG}`
const headers = {
  Authorization: `Basic ${Buffer.from(`:${PAT}`).toString('base64')}`,
  'Content-Type': 'application/json',
}
const api = axios.create({ baseURL: base, headers })

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXECUTED_OUTCOMES = new Set(['passed', 'failed', 'blocked'])

async function getProjects() {
  const r = await api.get('/_apis/projects?$top=200&api-version=7.1')
  return r.data.value.map(p => p.name)
}

// ─── 1. Usuários que batem com o filtro ──────────────────────────────────────

async function listMatchingUsers(projects) {
  console.log('═══ 1. Usuários encontrados ═══')
  const seen = new Set()
  for (const project of projects) {
    try {
      const teams = await api.get(`/_apis/projects/${encodeURIComponent(project)}/teams?api-version=7.1`)
      for (const team of teams.data.value ?? []) {
        try {
          const members = await api.get(
            `/_apis/projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(team.id)}/members?api-version=7.1`
          )
          for (const m of members.data.value ?? []) {
            const name = m.identity?.displayName ?? ''
            if (!seen.has(name) && name.toLowerCase().includes(NAME_FILTER.toLowerCase())) {
              console.log(`  ✅  "${name}"  (id: ${m.identity?.id})`)
              seen.add(name)
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  if (seen.size === 0) console.log('  ⚠️  Nenhum usuário encontrado com esse nome')
  console.log()
  return Array.from(seen)
}

// ─── 2. WIQL — IDs de Test Cases ─────────────────────────────────────────────

async function wiqlTestCaseIds(projects, assignees) {
  console.log('═══ 2. WIQL Test Cases ═══')
  const ids = new Set()
  for (const project of projects) {
    for (const assignee of assignees) {
      const wiql = `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.AssignedTo] CONTAINS '${assignee}'
          AND [System.WorkItemType] IN ('Test Case')
          AND [System.ChangedDate] >= '${START}'
          AND [System.ChangedDate] <= '${END}'
          AND [System.TeamProject] IN ('${project}')
        ORDER BY [System.ChangedDate] DESC
      `
      try {
        const r = await api.post('/_apis/wit/wiql?api-version=7.1', { query: wiql })
        const items = r.data.workItems ?? []
        items.forEach(i => ids.add(i.id))
        console.log(`  ${project} / "${assignee}": ${items.length} IDs via WIQL`)
      } catch (e) {
        console.error(`  ❌ WIQL erro (${project}/${assignee}):`, e.response?.data?.message ?? e.message)
      }
    }
  }
  console.log(`  Total WIQL IDs: ${ids.size}`, ids.size ? Array.from(ids) : '')
  console.log()
  return ids
}

// ─── 3. Scan Plans → Suites → Test Points ────────────────────────────────────

async function scanTestPoints(projects) {
  console.log('═══ 3. Scan Plans → Suites → Test Points ═══')
  const executedIds = new Set()
  const outcomeMap = new Map()
  const latestDateMap = new Map()

  for (const project of projects) {
    let plans = []
    try {
      const r = await api.get(
        `/${encodeURIComponent(project)}/_apis/testplan/plans?api-version=7.1&$top=200`
      )
      plans = r.data.value ?? []
      console.log(`\n  📋  ${project}: ${plans.length} planos`)
    } catch (e) {
      console.error(`  ❌ Planos (${project}):`, e.response?.data?.message ?? e.message)
      continue
    }

    for (const plan of plans) {
      let suites = []
      try {
        const r = await api.get(
          `/${encodeURIComponent(project)}/_apis/testplan/plans/${plan.id}/suites?api-version=7.1&$top=500`
        )
        suites = r.data.value ?? []
      } catch { continue }

      for (const suite of suites) {
        try {
          const r = await api.get(
            `/${encodeURIComponent(project)}/_apis/testplan/plans/${plan.id}/suites/${suite.id}/testpoint` +
            `?api-version=7.1&$top=1000`
          )
          const pts = r.data.value ?? []

          const withOutcome = pts.filter(pt => {
            const outcome = pt.results?.outcome ?? pt.results?.lastResultOutcome ?? pt.lastResultOutcome ?? ''
            return EXECUTED_OUTCOMES.has(outcome.toLowerCase())
          })

          if (withOutcome.length > 0) {
            console.log(`    📂  suite ${suite.id} "${suite.name}": ${pts.length} pts, ${withOutcome.length} com outcome`)
            for (const pt of withOutcome) {
              const id = pt.testCaseReference?.id ?? parseInt(pt.testCase?.id ?? '0', 10)
              const outcome = pt.results?.outcome ?? pt.results?.lastResultOutcome ?? pt.lastResultOutcome ?? ''
              const dateCompleted =
                pt.results?.lastResultDetails?.dateCompleted ??
                pt.lastResultDetails?.dateCompleted ?? ''
              const inRange = dateCompleted >= START && dateCompleted <= END_BOUND
              console.log(
                `      tcId=${id}  outcome="${outcome}"  dateCompleted="${dateCompleted}"  inRange=${inRange}`
              )
              if (inRange && id) {
                executedIds.add(id)
                const prev = latestDateMap.get(id) ?? ''
                if (dateCompleted >= prev) {
                  outcomeMap.set(id, outcome)
                  latestDateMap.set(id, dateCompleted)
                }
              }
            }
          }
        } catch { /* sem acesso */ }
      }
    }
  }

  console.log(`\n  ✅  executedIds no período (${executedIds.size}):`, Array.from(executedIds))
  console.log(`  ✅  outcomeMap:`, Object.fromEntries(outcomeMap))
  console.log()
  return { executedIds, outcomeMap }
}

// ─── 4. Detalhes dos work items finais ───────────────────────────────────────

async function getWorkItemDetails(ids) {
  if (ids.length === 0) return []
  console.log('═══ 4. Work Item Details ═══')
  const FIELDS = [
    'System.Id', 'System.Title', 'System.WorkItemType',
    'System.State', 'System.AssignedTo', 'System.TeamProject',
    'System.ChangedDate',
  ].join(',')

  const results = []
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    try {
      const r = await api.get(`/_apis/wit/workitems?ids=${chunk.join(',')}&fields=${FIELDS}&api-version=7.1`)
      results.push(...r.data.value)
    } catch (e) {
      console.error('  ❌ workitems erro:', e.response?.data?.message ?? e.message)
    }
  }
  return results
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projects = await getProjects()
  console.log(`Projetos encontrados: ${projects.join(', ')}\n`)

  const matchingUsers = await listMatchingUsers(projects)
  const assignees = matchingUsers.length > 0 ? matchingUsers : [NAME_FILTER]

  const wiqlIds = await wiqlTestCaseIds(projects, assignees)
  const { executedIds, outcomeMap } = await scanTestPoints(projects)

  const allIds = new Set([...wiqlIds, ...executedIds])
  console.log(`═══ 5. Merge final: ${allIds.size} IDs únicos ═══`)
  console.log('  WIQL:', Array.from(wiqlIds))
  console.log('  Exec:', Array.from(executedIds))
  console.log('  All: ', Array.from(allIds))
  console.log()

  const items = await getWorkItemDetails(Array.from(allIds))

  console.log('\n═══ 6. Work Items filtrados por assignee ═══')
  for (const item of items) {
    const f = item.fields
    const assignedTo = typeof f['System.AssignedTo'] === 'object'
      ? f['System.AssignedTo']?.displayName ?? ''
      : f['System.AssignedTo'] ?? ''
    const matches = assignees.some(a => assignedTo.toLowerCase().includes(a.toLowerCase()))
    const outcome = outcomeMap.get(f['System.Id']) ?? f['System.State']
    const changed = f['System.ChangedDate'] ?? ''
    const inPeriod = changed >= START && changed <= END_BOUND
    const hasOutcome = EXECUTED_OUTCOMES.has((outcome ?? '').toLowerCase())
    const show = (inPeriod || hasOutcome) && matches
    console.log(
      `  ${show ? '✅' : '❌'}  id=${f['System.Id']}  type="${f['System.WorkItemType']}"` +
      `  state="${f['System.State']}"  outcome="${outcome}"` +
      `  assignedTo="${assignedTo}"  changedDate="${changed?.slice(0, 10)}"` +
      `  inPeriod=${inPeriod}  hasOutcome=${hasOutcome}  assigneeMatch=${matches}`
    )
  }
}

main().catch(e => {
  console.error('\n💥 Erro fatal:', e.message)
  process.exit(1)
})
