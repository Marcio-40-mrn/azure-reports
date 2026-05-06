import { useMemo } from 'react'
import { LayoutDashboard, AlertCircle } from 'lucide-react'
import FilterBar from './components/FilterBar'
import ReportTable from './components/ReportTable'
import CollaboratorCard from './components/CollaboratorCard'
import ExportButton from './components/ExportButton'
import LoadingSpinner from './components/LoadingSpinner'
import EnvCheck from './components/EnvCheck'
import { useReport } from './hooks/useReport'
import type { WorkItem } from './types'

export default function App() {
  const { items, loading, error, generate } = useReport()

  const itemsByAssignee = useMemo(() => {
    const map = new Map<string, WorkItem[]>()
    for (const item of items) {
      const name = item.assignedTo || 'Não atribuído'
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push(item)
    }
    return map
  }, [items])

  const cardGridClass =
    itemsByAssignee.size === 1
      ? 'grid grid-cols-1 max-w-md'
      : itemsByAssignee.size === 2
        ? 'grid grid-cols-1 lg:grid-cols-2'
        : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="min-h-screen bg-gray-100">
      <EnvCheck />

      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <LayoutDashboard size={22} className="text-blue-600" />
        <h1 className="text-xl font-bold text-gray-800">Azure DevOps Report</h1>
      </header>

      <div className="flex gap-6 p-6 max-w-screen-xl mx-auto">
        <aside className="w-72 shrink-0">
          <FilterBar onGenerate={generate} loading={loading} />
        </aside>

        <main className="flex-1 flex flex-col gap-6 min-w-0">
          {/* API error */}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && <LoadingSpinner />}

          {!loading && items.length > 0 && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-800">{items.length}</span> itens
                  {itemsByAssignee.size > 1 && (
                    <span className="ml-1 text-gray-400">
                      — {itemsByAssignee.size} colaboradores
                    </span>
                  )}
                </p>
                <ExportButton items={items} />
              </div>

              {/* One card per collaborator */}
              <div className={cardGridClass + ' gap-6'}>
                {Array.from(itemsByAssignee.entries()).map(([name, personItems]) => (
                  <CollaboratorCard key={name} name={name} items={personItems} />
                ))}
              </div>

              {/* Full items table */}
              <ReportTable items={items} />
            </>
          )}

          {!loading && items.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-2">
              <LayoutDashboard size={36} className="opacity-30" />
              <p className="text-sm">Selecione os filtros e clique em "Gerar Relatório".</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
