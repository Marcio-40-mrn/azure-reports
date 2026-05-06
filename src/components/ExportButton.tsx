import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import type { WorkItem } from '../types'

interface Props {
  items: WorkItem[]
}

function groupByAssignee(items: WorkItem[]): Map<string, WorkItem[]> {
  const map = new Map<string, WorkItem[]>()
  for (const item of items) {
    const name = item.assignedTo || 'Não atribuído'
    if (!map.has(name)) map.set(name, [])
    map.get(name)!.push(item)
  }
  return map
}

function itemToRow(item: WorkItem) {
  return {
    ID: item.id,
    Título: item.title,
    Tipo: item.type,
    Status: item.status,
    'Atribuído a': item.assignedTo,
    Projeto: item.project,
    'Criado em': item.createdDate ? format(new Date(item.createdDate), 'dd/MM/yyyy') : '',
    'Alterado em': item.changedDate ? format(new Date(item.changedDate), 'dd/MM/yyyy') : '',
  }
}

const ITEM_COL_WIDTHS = [
  { wch: 8 },
  { wch: 52 },
  { wch: 22 },
  { wch: 16 },
  { wch: 28 },
  { wch: 24 },
  { wch: 12 },
  { wch: 12 },
]

function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '').substring(0, 31) || 'Colaborador'
}

export default function ExportButton({ items }: Props) {
  function handleExport() {
    const grouped = groupByAssignee(items)
    const allStatuses = [...new Set(items.map((i) => i.status))].sort()
    const wb = XLSX.utils.book_new()

    // ── Sheet 1: Resumo (pivot: one row per collaborator, status columns) ──────
    const summaryRows = Array.from(grouped.entries()).map(([name, personItems]) => {
      const row: Record<string, string | number> = {
        Colaborador: name,
        'Total de Itens': personItems.length,
      }
      for (const status of allStatuses) {
        row[status] = personItems.filter((i) => i.status === status).length
      }
      return row
    })
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows)
    summaryWs['!cols'] = [
      { wch: 32 },
      { wch: 14 },
      ...allStatuses.map(() => ({ wch: 14 })),
    ]
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo')

    // ── One sheet per collaborator ───────────────────────────────────────────
    for (const [name, personItems] of grouped) {
      const ws = XLSX.utils.json_to_sheet(personItems.map(itemToRow))
      ws['!cols'] = ITEM_COL_WIDTHS
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(name))
    }

    const filename = `azure-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  if (items.length === 0) return null

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
    >
      <Download size={16} />
      Exportar para Excel ({items.length} itens)
    </button>
  )
}
