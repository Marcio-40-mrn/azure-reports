import axios, { type AxiosError } from 'axios'
import type { WorkItem, Project, User, WorkItemType } from '../types'

const PAT = import.meta.env.VITE_AZURE_PAT as string
const authHeader = `Basic ${btoa(`:${PAT}`)}`

const headers = {
  Authorization: authHeader,
  'Content-Type': 'application/json',
}

// Requests go through the Vite dev proxy to avoid CORS.
// If you see 400 errors, confirm VITE_AZURE_ORG is set correctly and restart the dev server.
const client = axios.create({ baseURL: '/api/devops', headers })

/** Extracts the human-readable message from an Azure DevOps error response. */
function azureMessage(err: unknown): string {
  const e = err as AxiosError<{ message?: string; value?: string }>
  const status = e.response?.status
  const body = e.response?.data
  const detail = body?.message ?? body?.value ?? e.message ?? 'Erro desconhecido'
  return status ? `[${status}] ${detail}` : detail
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await client.get<{ value: { id: string; name: string }[] }>(
      '/_apis/projects?$top=200&api-version=7.1',
    )
    return res.data.value.map((p) => ({ id: p.id, name: p.name }))
  } catch (err) {
    throw new Error(azureMessage(err))
  }
}

// ─── Users (via team members — requires "Project and Team (Read)" scope) ──────

interface AzureTeam {
  id: string
  name: string
}

interface AzureTeamMember {
  identity: {
    id: string
    displayName: string
    uniqueName: string
  }
}

export async function fetchUsers(): Promise<User[]> {
  let projects: Project[]
  try {
    projects = await fetchProjects()
  } catch (err) {
    throw new Error(`Não foi possível carregar projetos para buscar colaboradores: ${(err as Error).message}`)
  }

  const memberMap = new Map<string, User>()

  await Promise.all(
    projects.map(async (project) => {
      try {
        const teamsRes = await client.get<{ value: AzureTeam[] }>(
          `/_apis/projects/${encodeURIComponent(project.id)}/teams?api-version=7.1`,
        )
        await Promise.all(
          teamsRes.data.value.map(async (team) => {
            try {
              const membersRes = await client.get<{ value: AzureTeamMember[] }>(
                `/_apis/projects/${encodeURIComponent(project.id)}/teams/${encodeURIComponent(team.id)}/members?api-version=7.1`,
              )
              for (const m of membersRes.data.value) {
                const { id, displayName, uniqueName } = m.identity
                if (!memberMap.has(id)) {
                  memberMap.set(id, { id, displayName, principalName: uniqueName })
                }
              }
            } catch {
              // skip teams with access issues
            }
          }),
        )
      } catch {
        // skip projects with access issues
      }
    }),
  )

  if (memberMap.size === 0) {
    throw new Error('Nenhum colaborador encontrado. Verifique se o PAT tem o escopo "Project and Team (Read)".')
  }

  return Array.from(memberMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )
}

// ─── Test Case Outcomes ───────────────────────────────────────────────────────

const OUTCOME_LABELS: Record<string, string> = {
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
  notapplicable: 'Not Applicable',
  active: 'Active',
  error: 'Error',
  timeout: 'Timeout',
  aborted: 'Aborted',
  inconclusive: 'Inconclusive',
  notexecuted: 'Not Executed',
  warning: 'Warning',
  paused: 'Paused',
}

function normalizeOutcome(outcome: string): string {
  return OUTCOME_LABELS[outcome.toLowerCase()] ?? outcome
}

// Apenas estes valores indicam teste executado — "Active" = não executado
const EXECUTED_OUTCOMES = new Set(['passed', 'failed', 'blocked'])

interface AzureTestPointRaw {
  testCaseReference?: { id: number; name: string }
  testCase?: { id: string; name: string }
  lastResultOutcome?: string
  results?: {
    outcome?: string            // campo real na API v7.1
    lastResultOutcome?: string  // campo legado (não existe mais)
    lastResultDetails?: { dateCompleted?: string } | null
  } | null
  lastResultDetails?: { dateCompleted?: string } | null
}

// Faz um único scan Plans → Suites → test points (sem filtro por tcId).
// Retorna:
//   outcomeMap  — tcId → outcome normalizado para test cases com execução no período
//   executedIds — IDs de test cases que tiveram execução no período
// (elimina a dependência do endpoint test/runs que não suporta filtro por data)
async function fetchTestCaseData(
  projects: string[],
  startDate: string,
  endDate: string,
): Promise<{ outcomeMap: Map<number, string>; executedIds: Set<number> }> {
  const outcomeMap = new Map<number, string>()
  const executedIds = new Set<number>()
  const latestDateMap = new Map<number, string>()
  // endDate é "YYYY-MM-DD"; para comparação com dateCompleted (ISO) precisamos cobrir o dia inteiro
  const endBound = endDate + 'T23:59:59'

  for (const project of projects) {
    let plans: { id: number; name: string }[] = []
    try {
      const r = await client.get<{ value: { id: number; name: string }[] }>(
        `/${encodeURIComponent(project)}/_apis/testplan/plans?api-version=7.1&$top=200`,
      )
      plans = r.data.value ?? []
      console.log(`[TestCaseData] "${project}": ${plans.length} planos`)
    } catch (err) {
      console.error(`[TestCaseData] ERRO planos "${project}":`, err)
      continue
    }

    await Promise.allSettled(
      plans.map(async plan => {
        let suites: { id: number; name: string }[] = []
        try {
          const r = await client.get<{ value: { id: number; name: string }[] }>(
            `/${encodeURIComponent(project)}/_apis/testplan/plans/${plan.id}/suites?api-version=7.1&$top=500`,
          )
          suites = r.data.value ?? []
        } catch {
          return
        }

        await Promise.allSettled(
          suites.map(async suite => {
            try {
              // Sem testCaseIdList — retorna todos os pontos da suite
              const r = await client.get<{ value: AzureTestPointRaw[] }>(
                `/${encodeURIComponent(project)}/_apis/testplan/plans/${plan.id}/suites/${suite.id}/testpoint` +
                `?api-version=7.1&$top=1000`,
              )
              const pts = r.data.value ?? []
              if (pts.length > 0) {
                console.log(`[TestCaseData]   suite ${suite.id} "${suite.name}": ${pts.length} pontos, primeiro=`, pts[0])
              }
              for (const pt of pts) {
                const rawId =
                  pt.testCaseReference?.id != null
                    ? pt.testCaseReference.id
                    : parseInt(pt.testCase?.id ?? '', 10)
                if (!rawId) continue

                const outcome =
                  pt.results?.outcome ??
                  pt.results?.lastResultOutcome ??
                  pt.lastResultOutcome ??
                  ''
                const dateCompleted =
                  pt.results?.lastResultDetails?.dateCompleted ??
                  pt.lastResultDetails?.dateCompleted ??
                  ''

                console.log(`[TestCaseData]   tcId=${rawId} outcome="${outcome}" dateCompleted="${dateCompleted}"`)

                if (!outcome || !EXECUTED_OUTCOMES.has(outcome.toLowerCase())) continue
                if (!dateCompleted || dateCompleted < startDate || dateCompleted > endBound) continue

                executedIds.add(rawId)
                const prev = latestDateMap.get(rawId) ?? ''
                if (dateCompleted >= prev) {
                  outcomeMap.set(rawId, normalizeOutcome(outcome))
                  latestDateMap.set(rawId, dateCompleted)
                }
              }
            } catch (err) {
              console.error(`[TestCaseData]   ERRO suite ${suite.id}:`, err)
            }
          }),
        )
      }),
    )
  }

  console.log(`[TestCaseData] executedIds (${executedIds.size}):`, Array.from(executedIds))
  console.log('[TestCaseData] outcomeMap:', Object.fromEntries(outcomeMap))
  return { outcomeMap, executedIds }
}

// ─── Work Items ───────────────────────────────────────────────────────────────

const BATCH_SIZE = 200

const FIELDS = [
  'System.Id',
  'System.Title',
  'System.WorkItemType',
  'System.State',
  'System.AssignedTo',
  'System.TeamProject',
  'System.ChangedDate',
  'System.CreatedDate',
].join(',')

interface AzureWorkItemRaw {
  fields: {
    'System.Id': number
    'System.Title': string
    'System.WorkItemType': string
    'System.State': string
    'System.AssignedTo': string | { displayName: string } | null
    'System.TeamProject': string
    'System.ChangedDate': string
    'System.CreatedDate': string
  }
}

function extractDisplayName(value: string | { displayName: string } | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.displayName ?? ''
}

async function fetchWorkItemDetails(ids: number[]): Promise<WorkItem[]> {
  const results: WorkItem[] = []

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE)
    try {
      const res = await client.get<{ value: AzureWorkItemRaw[] }>(
        `/_apis/wit/workitems?ids=${chunk.join(',')}&fields=${FIELDS}&api-version=7.1`,
      )
      for (const raw of res.data.value) {
        const f = raw.fields
        results.push({
          id: f['System.Id'],
          title: f['System.Title'] ?? '',
          type: f['System.WorkItemType'] as WorkItemType,
          status: f['System.State'] ?? '',
          assignedTo: extractDisplayName(f['System.AssignedTo']),
          project: f['System.TeamProject'] ?? '',
          changedDate: f['System.ChangedDate'] ?? '',
          createdDate: f['System.CreatedDate'] ?? '',
        })
      }
    } catch (err) {
      throw new Error(azureMessage(err))
    }
  }

  return results
}

export async function fetchWorkItems(params: {
  assignees: string[]
  startDate: string
  endDate: string
  itemTypes: WorkItemType[]
  projects: string[]
}): Promise<WorkItem[]> {
  const { assignees, startDate, endDate, itemTypes, projects } = params

  const typeList = itemTypes.map((t) => `'${t}'`).join(', ')
  const projectList = projects.map((p) => `'${p}'`).join(', ')

  const allIds = new Set<number>()

  for (const assignee of assignees) {
    const wiql = `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.AssignedTo] CONTAINS '${assignee}'
        AND [System.WorkItemType] IN (${typeList})
        AND [System.ChangedDate] >= '${startDate}'
        AND [System.ChangedDate] <= '${endDate}'
        AND [System.TeamProject] IN (${projectList})
      ORDER BY [System.ChangedDate] DESC
    `
    try {
      const res = await client.post<{ workItems: { id: number }[] }>(
        '/_apis/wit/wiql?api-version=7.1',
        { query: wiql },
      )
      for (const item of res.data.workItems) {
        allIds.add(item.id)
      }
    } catch (err) {
      throw new Error(azureMessage(err))
    }
  }

  // Test Cases executados não atualizam System.ChangedDate — scan de test points
  // retorna IDs executados no período e o mapa de outcomes em uma única passagem
  let testCaseOutcomeMap = new Map<number, string>()
  if (itemTypes.includes('Test Case')) {
    const { outcomeMap, executedIds } = await fetchTestCaseData(projects, startDate, endDate)
    testCaseOutcomeMap = outcomeMap
    for (const id of executedIds) allIds.add(id)
    console.log('[fetchWorkItems] allIds após merge:', allIds.size)
  }

  if (allIds.size === 0) return []

  const workItems = await fetchWorkItemDetails(Array.from(allIds))

  for (const item of workItems) {
    if (item.type === 'Test Case' && testCaseOutcomeMap.has(item.id)) {
      item.status = testCaseOutcomeMap.get(item.id)!
    }
  }

  // Filtra test cases: deve estar designado ao(s) assignee(s) selecionado(s) E
  // (ter sido alterado no período OU ter outcome de execução no período)
  return workItems.filter(item => {
    if (item.type !== 'Test Case') return true
    const changed = item.changedDate ?? ''
    const inPeriod = changed >= startDate && changed <= endDate + 'T23:59:59'
    const hasOutcome = EXECUTED_OUTCOMES.has((item.status ?? '').toLowerCase())
    const assignedToSelected =
      assignees.length === 0 ||
      assignees.some(a => item.assignedTo.toLowerCase().includes(a.toLowerCase()))
    console.log(
      `[Filter] tcId=${item.id} assignedTo="${item.assignedTo}" inPeriod=${inPeriod} hasOutcome=${hasOutcome} assignedToSelected=${assignedToSelected}`,
    )
    return (inPeriod || hasOutcome) && assignedToSelected
  })
}
