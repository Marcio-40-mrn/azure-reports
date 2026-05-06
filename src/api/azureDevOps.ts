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

  if (allIds.size === 0) return []

  return fetchWorkItemDetails(Array.from(allIds))
}
