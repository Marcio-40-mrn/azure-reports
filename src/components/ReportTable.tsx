import { format } from 'date-fns'
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

export default function ReportTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Nenhum item encontrado. Ajuste os filtros e gere o relatório.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm text-gray-700">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">ID</th>
            <th className="px-4 py-3 text-left">Título</th>
            <th className="px-4 py-3 text-left">Tipo</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Atribuído a</th>
            <th className="px-4 py-3 text-left">Projeto</th>
            <th className="px-4 py-3 text-left">Alterado em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-gray-500">{item.id}</td>
              <td className="px-4 py-3 max-w-xs truncate" title={item.title}>
                {item.title}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[item.type] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {item.type}
                </span>
              </td>
              <td className="px-4 py-3">{item.status}</td>
              <td className="px-4 py-3">{item.assignedTo}</td>
              <td className="px-4 py-3">{item.project}</td>
              <td className="px-4 py-3 text-gray-400">
                {item.changedDate ? format(new Date(item.changedDate), 'dd/MM/yyyy') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
