# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Azure DevOps Reporting Dashboard — a React + TypeScript SPA that connects to the Azure DevOps REST API to extract work item metrics and generate visual, exportable reports.

## Tech Stack

- **Framework**: React 18 + Vite + TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **HTTP**: axios
- **Icons**: lucide-react
- **Excel export**: xlsx
- **Dates**: date-fns
- **API**: Azure DevOps REST API (WIQL queries + Work Items endpoints)

## Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server (http://localhost:5173)
npm run build        # production build
npm run preview      # preview production build
npm run lint         # eslint check
npm run type-check   # tsc --noEmit
```

```bash
# Debug / validação (scripts utilitários, não fazem parte do build)
node scripts/debug-testcases.mjs "Nome Completo" 15   # debug de Test Cases via API direta
node scripts/debug-suite.mjs                           # dump raw de uma suite específica
node scripts/validate-export.mjs caminho/arquivo.xlsx  # valida estrutura do .xlsx exportado
```

## Environment Variables

Create a `.env` file at the project root (never commit it):

```
VITE_AZURE_ORG=your-organization
VITE_AZURE_PAT=your-personal-access-token
```

Access in code via `import.meta.env.VITE_AZURE_ORG`. The PAT is Base64-encoded in the axios Authorization header (`Basic ${btoa(':' + pat)}`).

## Architecture

```
src/
  api/
    azureDevOps.ts     # axios client, WIQL query builder, API calls
  components/
    FilterBar.tsx      # search form: assignees, date range, item types, projects
    ReportTable.tsx    # detailed work items table
    ReportChart.tsx    # Recharts PieChart for status distribution
    ExportButton.tsx   # xlsx export trigger
    LoadingSpinner.tsx # loading state overlay
  hooks/
    useReport.ts       # orchestrates API fetch, loading/error state
  types/
    index.ts           # WorkItem, Project, User, FilterState interfaces
  App.tsx
  main.tsx

scripts/               # utilitários Node.js para debug e validação (não entram no build)
  debug-testcases.mjs
  debug-suite.mjs
  validate-export.mjs
```

### Key Architectural Decisions

**WIQL for queries**: Work item searches use WIQL (`POST /{org}/{project}/_apis/wit/wiql`) because it handles date filtering and multi-assignee OR conditions natively. Avoid polling individual endpoints per user.

**Two-step fetch**: WIQL returns IDs only → a second batch call (`GET /_apis/wit/workitems?ids=...&fields=...`) fetches the actual fields. Batch in chunks of 200 (API limit).

**Auth**: PAT is read from `import.meta.env.VITE_AZURE_PAT` at runtime and injected by the axios instance in `api/azureDevOps.ts`. No auth logic in components.

**State**: All filter state lives in `App.tsx` and is passed down to `FilterBar` (controlled inputs). Report results live in the `useReport` hook.

**Test Case Outcomes**: Test Cases são buscados via WIQL (por `ChangedDate`) + scan de Plans→Suites→TestPoints (por `results.lastResultDetails.dateCompleted`). O campo de outcome é `results.outcome` (API v7.1) — nunca `results.lastResultOutcome` (campo legado que não existe mais). A função `fetchTestCaseData` faz os dois em uma única passagem e retorna `{ outcomeMap, executedIds }`.

## TypeScript Interfaces (canonical shapes)

```ts
// types/index.ts
interface WorkItem {
  id: number;
  title: string;
  type: 'Bug' | 'Task' | 'Product Backlog Item' | 'Test Plan' | 'Test Case';
  status: string;
  assignedTo: string;
  project: string;
  changedDate: string;
  createdDate: string;
}

interface FilterState {
  assignees: string[];
  startDate: string;       // ISO date string
  endDate: string;
  itemTypes: WorkItem['type'][];
  projects: string[];
}
```

## WIQL Query Pattern

```sql
SELECT [System.Id]
FROM WorkItems
WHERE [System.AssignedTo] CONTAINS '{name}'
  AND [System.WorkItemType] IN ('Bug', 'Task', ...)
  AND [System.ChangedDate] >= '{startDate}'
  AND [System.ChangedDate] <= '{endDate}'
  AND [System.TeamProject] IN ('{project1}', '{project2}')
```

For multiple assignees, run one WIQL query per assignee and merge/deduplicate results by ID.

## Excel Export — estado atual (✅ concluído em 07/05/2026)

`ExportButton` (`src/components/ExportButton.tsx`) usa **`exceljs`** (substituiu o `xlsx`):

### Estrutura da planilha
| Aba | Conteúdo |
|---|---|
| **Dashboard** | Banner azul + gráfico de pizza donut (SVG gerado em canvas → PNG embutido) + tabela de breakdown por colaborador com linha TOTAL |
| **Resumo** | Pivot: uma linha por colaborador × colunas por status; linha TOTAL cinza; cabeçalho azul; freeze + autofilter |
| **[Nome do colaborador]** | Tabela detalhada ordenada por Tipo → Status → Título; coluna **"Observações"** amarela (vazia, para preenchimento manual); cabeçalho azul; freeze + autofilter |

### Detalhes técnicos
- Gráfico gerado puramente via SVG matemático (sem DOM capture, sem dependências extras)
- SVG convertido para PNG via `canvas` nativo do browser antes de embutir no Excel
- Estilos: cabeçalho `#1E3A5F` branco bold; linhas alternadas `#EFF6FF`; total `#E5E7EB`; Observações `#FFF3CD` com borda âmbar
- Nome do arquivo: `azure-report-YYYY-MM-DD.xlsx`
- Bundle size: ~1.5 MB (exceljs é maior que xlsx — aceitável para uso interno)

### Validar planilha exportada sem abrir o Excel
```bash
node scripts/validate-export.mjs azure-report-2026-05-07.xlsx
```

---

## Regras de negócio — Test Cases

- **Somente** Test Cases com resultado de execução (`Passed`, `Failed`, `Blocked`) aparecem no relatório.
- Test Cases em status `Design` (não executados) são **excluídos** intencionalmente — filtro em `fetchWorkItems` (`azureDevOps.ts`).
- Outcomes são buscados via `fetchTestCaseData`: scan de Plans → Suites → test points usando `results.outcome` (API v7.1). O endpoint `test/runs?minLastUpdatedDate=...` **não existe** nessa versão — não usar.
- Test Cases executados no período que não tiveram `System.ChangedDate` atualizado são capturados pelo scan de test points (`results.lastResultDetails.dateCompleted`).
