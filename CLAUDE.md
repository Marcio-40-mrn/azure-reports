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

## Excel Export — estado atual

`ExportButton` (`src/components/ExportButton.tsx`) usa `xlsx` (SheetJS):
- **Aba "Resumo"**: pivot com uma linha por colaborador e colunas por status (contagens)
- **Uma aba por colaborador**: lista detalhada com ID, Título, Tipo, Status, Atribuído a, Projeto, Criado em, Alterado em
- Larguras de coluna definidas manualmente via `!cols`
- Nome do arquivo: `azure-report-YYYY-MM-DD.xlsx`

Para validar uma planilha exportada sem abrir o Excel:
```bash
node scripts/validate-export.mjs azure-report-2026-05-07.xlsx
```

---

## 🟡 PRÓXIMA TASK — Melhorias na Exportação de Planilha

### Objetivo
Tornar a planilha exportada mais profissional e útil para apresentação/análise, sem alterar a estrutura de abas existente.

### Melhorias planejadas

**1. Estilo visual (cabeçalhos)**
- Cabeçalho das colunas em negrito com fundo colorido (azul escuro, texto branco)
- Linha de totais no final da aba "Resumo" com fundo cinza
- Primeira linha congelada (`!freeze`) em todas as abas

**2. AutoFilter**
- Habilitar filtro automático em todas as abas (`!autofilter`) para facilitar análise no Excel

**3. Aba de metadados**
- Nova aba "Filtros Aplicados" com: período, projetos selecionados, assignees, tipos de item, data/hora da exportação
- Útil para rastrear a origem do relatório

**4. Totais na aba Resumo**
- Linha "TOTAL" ao final com soma de cada coluna de status

**5. Ordenação consistente**
- Aba de cada colaborador ordenada por: Tipo → Status → Título

### Como validar o resultado
```bash
# Gerar o relatório no browser, salvar o .xlsx e rodar:
node scripts/validate-export.mjs azure-report-2026-05-07.xlsx
```
O script verifica: abas presentes, colunas corretas, ausência de células vazias obrigatórias, presença de freeze e autofilter, e imprime um resumo de contagens por aba.

### Referência SheetJS para os recursos acima
```js
// Freeze primeira linha
ws['!freeze'] = { xSplit: 0, ySplit: 1 }

// AutoFilter cobrindo toda a faixa de dados
ws['!autofilter'] = { ref: ws['!ref'] }

// Estilo de célula (requer xlsx-js-style ou manipulação manual de cellXfs)
// Alternativa: usar sheetjs-style-v2 (drop-in replacement do xlsx com suporte a styles)
```

> **Nota sobre estilos**: a lib `xlsx` free não suporta estilos de célula (negrito, cor de fundo).
> Opções: (a) migrar para `xlsx-js-style` (fork compatível, MIT), (b) usar `exceljs` (API diferente, mais verbosa).
> Discutir com o usuário antes de trocar a dependência.
