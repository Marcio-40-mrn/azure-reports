import { useState, useMemo, useEffect, type MouseEvent } from 'react'
import { format } from 'date-fns'
import { ChevronDown, X } from 'lucide-react'
import type { WorkItem } from '../types'

interface Props {
  items: WorkItem[]
}

const TYPE_COLORS: Record<string, string> = {
  Bug: 'bg-red-100 text-red-700',
  Task: 'bg-blue-100 text-blue-700',
  'Product Backlog Item': 'bg-purple-100 text-purple-700',
  'Test Plan': 'bg-yellow-100 text-yellow-700',
  'Test Case': 'bg-green-100 text-green-700',
}

const STATUS_COLORS: Record<string, string> = {
  Passed: 'bg-emerald-100 text-emerald-700',
  Failed: 'bg-red-100 text-red-700',
  Blocked: 'bg-orange-100 text-orange-700',
  'Not Applicable': 'bg-gray-100 text-gray-500',
  'Not Executed': 'bg-gray-100 text-gray-500',
  'In Progress': 'bg-blue-100 text-blue-700',
  Active: 'bg-blue-100 text-blue-700',
  Design: 'bg-slate-100 text-slate-600',
  Ready: 'bg-cyan-100 text-cyan-700',
  Closed: 'bg-gray-100 text-gray-500',
  Resolved: 'bg-teal-100 text-teal-700',
  Inconclusive: 'bg-yellow-100 text-yellow-700',
  Aborted: 'bg-red-100 text-red-600',
}

type ColKey = 'types' | 'statuses' | 'assignees' | 'projects'

interface Filters {
  title: string
  types: Set<string>
  statuses: Set<string>
  assignees: Set<string>
  projects: Set<string>
}

// ─── Multi-select dropdown content (rendered in a fixed portal) ───────────────

interface MultiDropdownProps {
  values: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

function MultiDropdown({ values, selected, onChange }: MultiDropdownProps) {
  const [search, setSearch] = useState('')
  const visible = useMemo(
    () => values.filter(v => !search || v.toLowerCase().includes(search.toLowerCase())),
    [values, search],
  )
  const allVisible = visible.length > 0 && visible.every(v => selected.has(v))

  function toggle(v: string) {
    const next = new Set(selected)
    next.has(v) ? next.delete(v) : next.add(v)
    onChange(next)
  }

  function toggleAll() {
    const next = new Set(selected)
    if (allVisible) visible.forEach(v => next.delete(v))
    else visible.forEach(v => next.add(v))
    onChange(next)
  }

  return (
    <>
      {values.length > 5 && (
        <div className="px-2 pt-2 pb-1">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            onClick={e => e.stopPropagation()}
            className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
        <button type="button" onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
          {allVisible ? 'Remover todos' : 'Selecionar todos'}
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-xs text-gray-300">|</span>
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="text-xs text-gray-400 hover:text-red-500 hover:underline"
            >
              Limpar
            </button>
          </>
        )}
      </div>
      <div className="max-h-52 overflow-y-auto py-1">
        {visible.map(v => (
          <label
            key={v}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(v)}
              onChange={() => toggle(v)}
              className="accent-blue-600 shrink-0"
            />
            <span className="text-xs text-gray-700 truncate" title={v}>
              {v || '(vazio)'}
            </span>
          </label>
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-2">Nenhum resultado.</p>
        )}
      </div>
    </>
  )
}

// ─── ReportTable ──────────────────────────────────────────────────────────────

export default function ReportTable({ items }: Props) {
  const [filters, setFilters] = useState<Filters>({
    title: '',
    types: new Set(),
    statuses: new Set(),
    assignees: new Set(),
    projects: new Set(),
  })
  // rect of the trigger button so we can position the floating dropdown with fixed coords
  const [openCol, setOpenCol] = useState<{ key: ColKey; rect: DOMRect } | null>(null)

  // reset column filters whenever a new report is generated (items array reference changes)
  useEffect(() => {
    setFilters({ title: '', types: new Set(), statuses: new Set(), assignees: new Set(), projects: new Set() })
    setOpenCol(null)
  }, [items])

  const uniqueTypes = useMemo(
    () => [...new Set(items.map(i => i.type))].filter(Boolean).sort(),
    [items],
  )
  const uniqueStatuses = useMemo(
    () => [...new Set(items.map(i => i.status))].filter(Boolean).sort(),
    [items],
  )
  const uniqueAssignees = useMemo(
    () => [...new Set(items.map(i => i.assignedTo))].filter(Boolean).sort(),
    [items],
  )
  const uniqueProjects = useMemo(
    () => [...new Set(items.map(i => i.project))].filter(Boolean).sort(),
    [items],
  )

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filters.title && !item.title.toLowerCase().includes(filters.title.toLowerCase()))
        return false
      if (filters.types.size > 0 && !filters.types.has(item.type)) return false
      if (filters.statuses.size > 0 && !filters.statuses.has(item.status)) return false
      if (filters.assignees.size > 0 && !filters.assignees.has(item.assignedTo)) return false
      if (filters.projects.size > 0 && !filters.projects.has(item.project)) return false
      return true
    })
  }, [items, filters])

  const activeCount =
    (filters.title ? 1 : 0) +
    (filters.types.size > 0 ? 1 : 0) +
    (filters.statuses.size > 0 ? 1 : 0) +
    (filters.assignees.size > 0 ? 1 : 0) +
    (filters.projects.size > 0 ? 1 : 0)

  function setColFilter(key: ColKey, next: Set<string>) {
    setFilters(f => ({ ...f, [key]: next }))
  }

  function clearAll() {
    setFilters({
      title: '',
      types: new Set(),
      statuses: new Set(),
      assignees: new Set(),
      projects: new Set(),
    })
    setOpenCol(null)
  }

  function openFilter(key: ColKey, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    // captura rect antes do setState — e.currentTarget é nullificado pelo React após o handler
    const rect = e.currentTarget.getBoundingClientRect()
    setOpenCol(prev => (prev?.key === key ? null : { key, rect }))
  }

  const colValues: Record<ColKey, string[]> = {
    types: uniqueTypes,
    statuses: uniqueStatuses,
    assignees: uniqueAssignees,
    projects: uniqueProjects,
  }

  function filterBtn(key: ColKey) {
    const isActive = filters[key].size > 0
    const isOpen = openCol?.key === key
    return (
      <button
        type="button"
        onClick={e => openFilter(key, e)}
        className={`flex items-center justify-center min-w-[20px] h-5 rounded px-1 text-xs transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700 font-semibold'
            : isOpen
              ? 'bg-gray-200 text-gray-600'
              : 'text-gray-400 hover:bg-gray-200'
        }`}
      >
        {isActive ? filters[key].size : <ChevronDown size={11} />}
      </button>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Nenhum item encontrado. Ajuste os filtros e gere o relatório.
      </div>
    )
  }

  return (
    <div>
      {/* Floating dropdown + backdrop — rendered outside overflow container to avoid clipping */}
      {openCol && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenCol(null)} />
          <div
            style={{
              position: 'fixed',
              top: openCol.rect.bottom + 4,
              left: openCol.rect.left,
              width: 224,
              zIndex: 50,
            }}
            className="bg-white border border-gray-200 rounded-lg shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <MultiDropdown
              values={colValues[openCol.key]}
              selected={filters[openCol.key]}
              onChange={next => setColFilter(openCol.key, next)}
            />
          </div>
        </>
      )}

      {/* Search bar + item count + clear button */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          type="text"
          value={filters.title}
          onChange={e => setFilters(f => ({ ...f, title: e.target.value }))}
          placeholder="Buscar no título..."
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <span className="text-sm text-gray-500 ml-auto">
          {filtered.length < items.length ? (
            <>
              <span className="font-semibold text-gray-800">{filtered.length}</span>
              {' de '}
              {items.length} itens
            </>
          ) : (
            <>
              <span className="font-semibold text-gray-800">{items.length}</span> itens
            </>
          )}
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg px-2 py-1 transition-colors"
          >
            <X size={11} />
            Limpar filtros ({activeCount})
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm text-gray-700">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Título</th>
              <th className="px-4 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  Tipo {filterBtn('types')}
                </div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  Status {filterBtn('statuses')}
                </div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  Atribuído a {filterBtn('assignees')}
                </div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  Projeto {filterBtn('projects')}
                </div>
              </th>
              <th className="px-4 py-3 text-left">Alterado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-gray-500">{item.id}</td>
                <td className="px-4 py-3 max-w-xs truncate" title={item.title}>
                  {item.title}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      TYPE_COLORS[item.type] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3">{item.assignedTo}</td>
                <td className="px-4 py-3">{item.project}</td>
                <td className="px-4 py-3 text-gray-400">
                  {item.changedDate ? format(new Date(item.changedDate), 'dd/MM/yyyy') : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Nenhum item corresponde aos filtros ativos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
