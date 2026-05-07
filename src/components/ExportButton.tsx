import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Workbook } from 'exceljs'
import { format } from 'date-fns'
import type { WorkItem } from '../types'

// Mesmas cores do CollaboratorCard
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

// ─── Pie chart SVG (donut) ────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildPieSVG(
  data: { name: string; value: number; color: string }[],
  total: number,
): string {
  const W = 560, H = 320
  const cx = 148, cy = 163, R = 130, ri = 52

  let angle = -Math.PI / 2
  const slices: string[] = []

  for (const d of data) {
    const sweep = (d.value / total) * 2 * Math.PI
    if (sweep < 0.002) { angle += sweep; continue }
    const ea = angle + sweep
    const cos0 = Math.cos(angle), sin0 = Math.sin(angle)
    const cos1 = Math.cos(ea),   sin1 = Math.sin(ea)
    const lg = sweep > Math.PI ? 1 : 0

    // outer arc then inner arc (donut)
    slices.push(
      `<path d="M${(cx + R * cos0).toFixed(1)},${(cy + R * sin0).toFixed(1)} ` +
      `A${R},${R} 0 ${lg},1 ${(cx + R * cos1).toFixed(1)},${(cy + R * sin1).toFixed(1)} ` +
      `L${(cx + ri * cos1).toFixed(1)},${(cy + ri * sin1).toFixed(1)} ` +
      `A${ri},${ri} 0 ${lg},0 ${(cx + ri * cos0).toFixed(1)},${(cy + ri * sin0).toFixed(1)} Z" ` +
      `fill="${d.color}" stroke="white" stroke-width="2"/>`,
    )
    angle = ea
  }

  const legend = data.map((d, i) => {
    const pct = ((d.value / total) * 100).toFixed(0)
    const y = 38 + i * 32
    return (
      `<rect x="312" y="${y}" width="14" height="14" rx="2" fill="${d.color}"/>` +
      `<text x="333" y="${y + 11}" font-size="13" fill="#374151" font-family="Arial">${esc(d.name)}</text>` +
      `<text x="510" y="${y + 11}" font-size="13" font-weight="bold" fill="#111827" font-family="Arial" text-anchor="end">${d.value}</text>` +
      `<text x="553" y="${y + 11}" font-size="11" fill="#9ca3af" font-family="Arial">${pct}%</text>`
    )
  }).join('\n')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="white"/>` +
    `<text x="${cx}" y="18" text-anchor="middle" font-size="14" font-weight="bold" fill="#1f2937" font-family="Arial">Distribuição por Status</text>` +
    slices.join('') +
    `<circle cx="${cx}" cy="${cy}" r="${ri - 2}" fill="white"/>` +
    `<text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="22" font-weight="bold" fill="#1f2937" font-family="Arial">${total}</text>` +
    `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="11" fill="#9ca3af" font-family="Arial">itens</text>` +
    `<line x1="298" y1="28" x2="298" y2="${H - 20}" stroke="#e5e7eb" stroke-width="1"/>` +
    legend +
    `</svg>`
  )
}

async function svgToPng(svg: string): Promise<string> {
  const W = 560, H = 320
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = W * 2
      canvas.height = H * 2
      const ctx = canvas.getContext('2d')!
      ctx.scale(2, 2)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
      ctx.drawImage(img, 0, 0, W, H)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/png').split(',')[1])
    }
    img.onerror = reject
    img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  })
}

// ─── Excel style constants ────────────────────────────────────────────────────

const C = {
  header:    'FF1E3A5F',  // dark blue
  headerTxt: 'FFFFFFFF',  // white
  accent:    'FF2563EB',  // blue border
  altRow:    'FFEFF6FF',  // soft blue tint
  totalRow:  'FFE5E7EB',  // light grey
  obs:       'FFFFF3CD',  // light yellow — Observações
  obsHeader: 'FFCA8A04',  // amber — Observações header
  border:    'FFE5E7EB',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XRow = any

function styleHeader(row: XRow, cols: number, lastColAccent?: number) {
  row.height = 26
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    const isObs = lastColAccent && c === lastColAccent
    cell.font  = { bold: true, size: 11, color: { argb: isObs ? 'FF1C1C1C' : C.headerTxt } }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: isObs ? C.obsHeader : C.header } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = { bottom: { style: 'medium', color: { argb: C.accent } } }
  }
}

function styleData(row: XRow, cols: number, alt: boolean) {
  row.height = 19
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    if (alt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.altRow } }
    cell.border = { bottom: { style: 'thin', color: { argb: C.border } } }
    cell.alignment = { vertical: 'middle' }
  }
}

function styleTotal(row: XRow, cols: number) {
  row.height = 22
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    cell.font   = { bold: true, size: 11 }
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalRow } }
    cell.border = { top: { style: 'medium', color: { argb: '9CA3AF' } }, bottom: { style: 'thin', color: { argb: C.border } } }
    cell.alignment = { vertical: 'middle' }
  }
}

function safeSheet(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '').substring(0, 31) || 'Colaborador'
}

// ─── Workbook ─────────────────────────────────────────────────────────────────

async function buildAndDownload(items: WorkItem[]) {
  // Group by assignee
  const grouped = new Map<string, WorkItem[]>()
  for (const item of items) {
    const key = item.assignedTo || 'Não atribuído'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(item)
  }
  const assignees = [...grouped.keys()].sort()

  // Status distribution (sorted by count desc)
  const statusMap: Record<string, number> = {}
  for (const item of items) {
    statusMap[item.status] = (statusMap[item.status] ?? 0) + 1
  }
  const statusData = Object.entries(statusMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }))
  const allStatuses = statusData.map(d => d.name)
  const total = items.length

  // Generate pie chart PNG
  const chartPng = await svgToPng(buildPieSVG(statusData, total))

  const wb = new Workbook()
  wb.creator = 'Azure DevOps Report'
  wb.created = new Date()

  buildDashboard(wb, items, allStatuses, grouped, assignees, total, chartPng)
  buildResumo(wb, grouped, assignees, allStatuses, items)
  for (const [name, personItems] of grouped) {
    buildPersonSheet(wb, name, personItems)
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `azure-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Sheet: Dashboard ─────────────────────────────────────────────────────────

function buildDashboard(
  wb: Workbook,
  items: WorkItem[],
  allStatuses: string[],
  grouped: Map<string, WorkItem[]>,
  assignees: string[],
  total: number,
  chartPng: string,
) {
  const ws = wb.addWorksheet('Dashboard')

  // Col widths
  ws.getColumn(1).width = 30
  ws.getColumn(2).width = 10
  for (let i = 0; i < allStatuses.length; i++) ws.getColumn(3 + i).width = 14

  // ── Banner rows 1–2 ──────────────────────────────────────────────────────
  ws.mergeCells('A1:F2')
  const title = ws.getCell('A1')
  title.value     = 'Azure DevOps  —  Relatório de Atividades'
  title.font      = { bold: true, size: 20, color: { argb: C.headerTxt } }
  title.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.header } }
  title.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 24
  ws.getRow(2).height = 24

  // ── Metadata row 3 ───────────────────────────────────────────────────────
  ws.getRow(3).height = 18
  const metaStyle = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
  ws.getCell('A3').value = `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`
  ws.getCell('A3').font  = metaStyle
  ws.getCell('D3').value = `${total} iten${total !== 1 ? 's' : ''}  ·  ${grouped.size} colaborador${grouped.size !== 1 ? 'es' : ''}`
  ws.getCell('D3').font  = metaStyle

  // ── Row 4: spacer ────────────────────────────────────────────────────────
  ws.getRow(4).height = 8

  // ── Chart image (rows 5–24) ───────────────────────────────────────────────
  const imgId = wb.addImage({ base64: chartPng, extension: 'png' })
  ws.addImage(imgId, { tl: { col: 0, row: 4 }, ext: { width: 560, height: 320 } })

  // ── Breakdown table (row 25+) ─────────────────────────────────────────────
  const BREAK = 25
  ws.getRow(BREAK - 1).height = 12  // small gap before table

  const bCols = ['Colaborador', 'Total', ...allStatuses]
  const bHeader = ws.getRow(BREAK)
  bCols.forEach((h, i) => { bHeader.getCell(i + 1).value = h })
  styleHeader(bHeader, bCols.length)

  assignees.forEach((name, idx) => {
    const pi = grouped.get(name)!
    const row = ws.getRow(BREAK + 1 + idx)
    row.getCell(1).value = name
    row.getCell(2).value = pi.length
    allStatuses.forEach((s, si) => {
      row.getCell(si + 3).value = pi.filter(i => i.status === s).length
    })
    styleData(row, bCols.length, idx % 2 === 1)
  })

  const totRow = ws.getRow(BREAK + 1 + assignees.length)
  totRow.getCell(1).value = 'TOTAL'
  totRow.getCell(2).value = total
  allStatuses.forEach((s, si) => {
    totRow.getCell(si + 3).value = items.filter(i => i.status === s).length
  })
  styleTotal(totRow, bCols.length)
}

// ─── Sheet: Resumo ────────────────────────────────────────────────────────────

function buildResumo(
  wb: Workbook,
  grouped: Map<string, WorkItem[]>,
  assignees: string[],
  allStatuses: string[],
  allItems: WorkItem[],
) {
  const ws = wb.addWorksheet('Resumo')
  ws.getColumn(1).width = 32
  ws.getColumn(2).width = 10
  allStatuses.forEach((_, i) => { ws.getColumn(3 + i).width = 14 })

  const cols = ['Colaborador', 'Total', ...allStatuses]
  const hRow = ws.getRow(1)
  cols.forEach((h, i) => { hRow.getCell(i + 1).value = h })
  styleHeader(hRow, cols.length)

  assignees.forEach((name, idx) => {
    const pi = grouped.get(name)!
    const row = ws.getRow(idx + 2)
    row.getCell(1).value = name
    row.getCell(2).value = pi.length
    allStatuses.forEach((s, si) => {
      row.getCell(si + 3).value = pi.filter(i => i.status === s).length
    })
    styleData(row, cols.length, idx % 2 === 1)
  })

  const totRow = ws.getRow(assignees.length + 2)
  totRow.getCell(1).value = 'TOTAL'
  totRow.getCell(2).value = allItems.length
  allStatuses.forEach((s, si) => {
    totRow.getCell(si + 3).value = allItems.filter(i => i.status === s).length
  })
  styleTotal(totRow, cols.length)

  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
}

// ─── Sheet: por colaborador ───────────────────────────────────────────────────

const DETAIL_COLS = [
  { header: 'ID',          width: 8  },
  { header: 'Título',      width: 54 },
  { header: 'Tipo',        width: 22 },
  { header: 'Status',      width: 18 },
  { header: 'Projeto',     width: 26 },
  { header: 'Criado em',   width: 13 },
  { header: 'Alterado em', width: 13 },
  { header: 'Observações', width: 42 },  // última coluna — destaque amarelo
]

function buildPersonSheet(wb: Workbook, name: string, items: WorkItem[]) {
  const ws = wb.addWorksheet(safeSheet(name))
  DETAIL_COLS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width })

  const sorted = [...items].sort((a, b) => {
    const dt = a.type.localeCompare(b.type)
    if (dt !== 0) return dt
    const ds = a.status.localeCompare(b.status)
    if (ds !== 0) return ds
    return a.title.localeCompare(b.title)
  })

  // Header — última coluna com cor de destaque (âmbar)
  const hRow = ws.getRow(1)
  DETAIL_COLS.forEach((col, i) => { hRow.getCell(i + 1).value = col.header })
  styleHeader(hRow, DETAIL_COLS.length, DETAIL_COLS.length)  // lastColAccent = col 8

  sorted.forEach((item, idx) => {
    const row = ws.getRow(idx + 2)
    row.getCell(1).value = item.id
    row.getCell(2).value = item.title
    row.getCell(3).value = item.type
    row.getCell(4).value = item.status
    row.getCell(5).value = item.project
    row.getCell(6).value = item.createdDate ? format(new Date(item.createdDate), 'dd/MM/yyyy') : ''
    row.getCell(7).value = item.changedDate ? format(new Date(item.changedDate), 'dd/MM/yyyy') : ''
    row.getCell(8).value = ''  // Observações — preencher à mão
    styleData(row, DETAIL_COLS.length, idx % 2 === 1)

    // Destaque visual na coluna Observações
    row.getCell(8).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.obs } }
    row.getCell(8).alignment = { vertical: 'middle', wrapText: true }
    row.getCell(8).border    = {
      left:   { style: 'medium', color: { argb: C.obsHeader } },
      bottom: { style: 'thin',   color: { argb: C.border } },
    }

    // Título sem wrap para não empolar a linha
    row.getCell(2).alignment = { vertical: 'middle', wrapText: false }
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
  })

  ws.views  = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: DETAIL_COLS.length } }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  items: WorkItem[]
}

export default function ExportButton({ items }: Props) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await buildAndDownload(items)
    } catch (e) {
      console.error('Export error:', e)
    } finally {
      setExporting(false)
    }
  }

  if (items.length === 0) return null

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
    >
      {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {exporting ? 'Exportando...' : `Exportar para Excel (${items.length} itens)`}
    </button>
  )
}
