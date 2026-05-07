/**
 * Valida a estrutura de uma planilha .xlsx exportada pelo dashboard.
 *
 * Uso:
 *   node scripts/validate-export.mjs azure-report-2026-05-07.xlsx
 *
 * Verifica:
 *   - Abas presentes (Resumo + ao menos uma de colaborador)
 *   - Colunas obrigatórias em cada aba
 *   - Ausência de células vazias em campos obrigatórios
 *   - Freeze de linha (se ativado)
 *   - AutoFilter (se ativado)
 *   - Resumo de contagens por aba
 */

import { createRequire } from 'module'
import { existsSync } from 'fs'
import { resolve } from 'path'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const filePath = resolve(process.argv[2] ?? '')

if (!process.argv[2] || !existsSync(filePath)) {
  console.error('❌  Informe o caminho do arquivo: node scripts/validate-export.mjs arquivo.xlsx')
  process.exit(1)
}

const DETAIL_COLS = ['ID', 'Título', 'Tipo', 'Status', 'Atribuído a', 'Projeto', 'Criado em', 'Alterado em']
const SUMMARY_REQUIRED = ['Colaborador', 'Total de Itens']
const REQUIRED_DETAIL_FIELDS = ['ID', 'Título', 'Tipo', 'Status', 'Atribuído a']

let errors = 0
let warnings = 0

function err(msg)  { console.log(`  ❌  ${msg}`); errors++ }
function warn(msg) { console.log(`  ⚠️   ${msg}`); warnings++ }
function ok(msg)   { console.log(`  ✅  ${msg}`) }

const wb = XLSX.readFile(filePath, { cellStyles: true })
console.log(`\n📄  Arquivo: ${filePath}`)
console.log(`📋  Abas encontradas: ${wb.SheetNames.join(', ')}\n`)

// ── Aba Resumo ────────────────────────────────────────────────────────────────
console.log('═══ Aba "Resumo" ═══')
if (!wb.SheetNames.includes('Resumo')) {
  err('Aba "Resumo" não encontrada')
} else {
  const ws = wb.Sheets['Resumo']
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  ok(`${rows.length} linhas de dados`)

  // Colunas presentes
  const cols = rows.length > 0 ? Object.keys(rows[0]) : []
  for (const req of SUMMARY_REQUIRED) {
    if (cols.includes(req)) ok(`Coluna "${req}" presente`)
    else err(`Coluna "${req}" ausente`)
  }

  const statusCols = cols.filter(c => !SUMMARY_REQUIRED.includes(c))
  ok(`${statusCols.length} coluna(s) de status: ${statusCols.join(', ') || '(nenhuma)'}`)

  // Freeze
  if (ws['!freeze']) ok('Freeze de linha configurado')
  else warn('Freeze de linha NÃO configurado (melhoria pendente)')

  // AutoFilter
  if (ws['!autofilter']) ok('AutoFilter configurado')
  else warn('AutoFilter NÃO configurado (melhoria pendente)')

  // Totais
  const totalRow = rows.find(r => String(r['Colaborador']).toUpperCase() === 'TOTAL')
  if (totalRow) ok('Linha de TOTAL presente')
  else warn('Linha de TOTAL ausente (melhoria pendente)')

  // Células vazias em campo obrigatório
  const emptyColaborador = rows.filter(r => !r['Colaborador']).length
  if (emptyColaborador > 0) err(`${emptyColaborador} linha(s) com "Colaborador" vazio`)

  // Totais por status
  if (rows.length > 0) {
    console.log('\n  Contagens no Resumo:')
    for (const row of rows) {
      const name = row['Colaborador'] || '(vazio)'
      const total = row['Total de Itens']
      const breakdown = statusCols.map(s => `${s}: ${row[s]}`).join('  ')
      console.log(`    ${name} → total=${total}  ${breakdown}`)
    }
  }
}

// ── Abas de colaboradores ─────────────────────────────────────────────────────
const collaboratorSheets = wb.SheetNames.filter(n => n !== 'Resumo' && n !== 'Filtros Aplicados')

console.log(`\n═══ Abas de colaboradores (${collaboratorSheets.length}) ═══`)

if (collaboratorSheets.length === 0) {
  err('Nenhuma aba de colaborador encontrada')
} else {
  for (const sheetName of collaboratorSheets) {
    console.log(`\n  📁  "${sheetName}"`)
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

    ok(`${rows.length} linha(s)`)

    const cols = rows.length > 0 ? Object.keys(rows[0]) : []
    const missingCols = DETAIL_COLS.filter(c => !cols.includes(c))
    if (missingCols.length > 0) err(`Colunas ausentes: ${missingCols.join(', ')}`)
    else ok(`Todas as colunas obrigatórias presentes`)

    // Campos obrigatórios vazios
    for (const field of REQUIRED_DETAIL_FIELDS) {
      const emptyCount = rows.filter(r => r[field] === '' || r[field] == null).length
      if (emptyCount > 0) warn(`"${field}" vazio em ${emptyCount} linha(s)`)
    }

    // Freeze / AutoFilter
    if (ws['!freeze']) ok('Freeze configurado')
    else warn('Freeze NÃO configurado')
    if (ws['!autofilter']) ok('AutoFilter configurado')
    else warn('AutoFilter NÃO configurado')

    // Distribuição por Status
    if (rows.length > 0) {
      const byStatus = {}
      for (const row of rows) {
        const s = row['Status'] || '(vazio)'
        byStatus[s] = (byStatus[s] ?? 0) + 1
      }
      const dist = Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join('  ')
      console.log(`    Status → ${dist}`)
    }
  }
}

// ── Aba de metadados (opcional) ───────────────────────────────────────────────
console.log('\n═══ Aba "Filtros Aplicados" ═══')
if (wb.SheetNames.includes('Filtros Aplicados')) {
  const ws = wb.Sheets['Filtros Aplicados']
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  ok(`Presente — ${rows.length} linha(s)`)
} else {
  warn('Aba "Filtros Aplicados" ausente (melhoria pendente)')
}

// ── Resultado final ────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50))
if (errors === 0 && warnings === 0) {
  console.log('✅  Planilha válida — sem erros ou avisos')
} else {
  if (errors > 0)   console.log(`❌  ${errors} erro(s) encontrado(s)`)
  if (warnings > 0) console.log(`⚠️   ${warnings} aviso(s) (melhorias pendentes)`)
}
console.log()
