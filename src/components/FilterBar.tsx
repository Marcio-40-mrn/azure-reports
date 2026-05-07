import { useState, useEffect, useMemo } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import { fetchProjects, fetchUsers } from '../api/azureDevOps'
import type { FilterState, WorkItemType, Project, User } from '../types'

const ITEM_TYPES: WorkItemType[] = ['Bug', 'Task', 'Product Backlog Item', 'Test Plan', 'Test Case']

function orgSlug(): string {
  return (import.meta.env.VITE_AZURE_ORG || '')
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/\/$/, '')
    .trim() || '(vazio)'
}

interface Props {
  onGenerate: (filters: FilterState) => void
  loading: boolean
}

export default function FilterBar({ onGenerate, loading }: Props) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [itemTypes, setItemTypes] = useState<WorkItemType[]>([...ITEM_TYPES])

  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [projectSearch, setProjectSearch] = useState('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])

  useEffect(() => {
    setUsersLoading(true)
    fetchUsers()
      .then((u) => { setUsers(u); setUsersError(null) })
      .catch((err) => setUsersError(err?.message ?? 'Erro ao carregar colaboradores'))
      .finally(() => setUsersLoading(false))

    setProjectsLoading(true)
    fetchProjects()
      .then((p) => { setProjects(p); setSelectedProjects(p.map((x) => x.name)); setProjectsError(null) })
      .catch((err) => setProjectsError(err?.message ?? 'Erro ao carregar projetos'))
      .finally(() => setProjectsLoading(false))
  }, [])

  const filteredUsers = useMemo(
    () => users.filter((u) => u.displayName.toLowerCase().includes(userSearch.toLowerCase())),
    [users, userSearch],
  )

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase())),
    [projects, projectSearch],
  )

  function toggleUser(displayName: string) {
    setSelectedUsers((prev) =>
      prev.includes(displayName) ? prev.filter((n) => n !== displayName) : [...prev, displayName],
    )
  }

  function toggleProject(name: string) {
    setSelectedProjects((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    )
  }

  function selectAllProjects() {
    const visible = new Set(filteredProjects.map((p) => p.name))
    setSelectedProjects((prev) => Array.from(new Set([...prev, ...visible])))
  }

  function deselectAllProjects() {
    const visible = new Set(filteredProjects.map((p) => p.name))
    setSelectedProjects((prev) => prev.filter((name) => !visible.has(name)))
  }

  const allVisibleSelected =
    filteredProjects.length > 0 && filteredProjects.every((p) => selectedProjects.includes(p.name))

  function toggleItemType(type: WorkItemType) {
    setItemTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onGenerate({ assignees: selectedUsers, startDate, endDate, itemTypes, projects: selectedProjects })
  }

  const isValid =
    selectedUsers.length > 0 &&
    startDate &&
    endDate &&
    itemTypes.length > 0 &&
    selectedProjects.length > 0

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-gray-700">Filtros</h2>

      {/* Collaborators */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-600">Colaboradores</label>
          {selectedUsers.length > 0 && (
            <span className="text-xs text-blue-600">{selectedUsers.length} selecionado(s)</span>
          )}
        </div>

        {usersLoading && <p className="text-xs text-gray-400 py-2">Carregando colaboradores...</p>}

        {usersError && (
          <div className="flex items-start gap-1.5 text-xs text-red-500 bg-red-50 rounded-lg p-2">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>
              {usersError}
              <br />
              Org: <code className="font-mono">{orgSlug()}</code>
              {' — '}Reinicie com <code className="font-mono">npm run dev</code> após editar o .env.
            </span>
          </div>
        )}

        {!usersLoading && !usersError && (
          <>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum resultado.</p>
              ) : (
                filteredUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.displayName)}
                      onChange={() => toggleUser(u.displayName)}
                      className="accent-blue-600 shrink-0"
                    />
                    <span className="truncate" title={u.principalName}>
                      {u.displayName}
                    </span>
                  </label>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Data Início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Data Fim</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Item types */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">Tipos de Item</label>
        <div className="flex flex-col gap-1">
          {ITEM_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-1 rounded"
            >
              <input
                type="checkbox"
                checked={itemTypes.includes(type)}
                onChange={() => toggleItemType(type)}
                className="accent-blue-600"
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-600">Projetos</label>
          {selectedProjects.length > 0 && (
            <span className="text-xs text-blue-600">{selectedProjects.length} selecionado(s)</span>
          )}
        </div>

        {projectsLoading && <p className="text-xs text-gray-400 py-2">Carregando projetos...</p>}

        {projectsError && (
          <div className="flex items-start gap-1.5 text-xs text-red-500 bg-red-50 rounded-lg p-2">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>
              {projectsError}
              <br />
              Org: <code className="font-mono">{orgSlug()}</code>
              {' — '}Reinicie com <code className="font-mono">npm run dev</code> após editar o .env.
            </span>
          </div>
        )}

        {!projectsLoading && !projectsError && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={allVisibleSelected ? deselectAllProjects : selectAllProjects}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                {allVisibleSelected ? 'Remover todos' : 'Selecionar todos'}
              </button>
              {!allVisibleSelected && selectedProjects.length > 0 && (
                <>
                  <span className="text-xs text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllProjects}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                  >
                    Remover todos
                  </button>
                </>
              )}
            </div>
            <input
              type="text"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Buscar projeto..."
              className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
              {filteredProjects.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum resultado.</p>
              ) : (
                filteredProjects.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(p.name)}
                      onChange={() => toggleProject(p.name)}
                      className="accent-blue-600"
                    />
                    {p.name}
                  </label>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={!isValid || loading}
        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        <Search size={16} />
        {loading ? 'Gerando...' : 'Gerar Relatório'}
      </button>
    </form>
  )
}
