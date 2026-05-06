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
```

### Key Architectural Decisions

**WIQL for queries**: Work item searches use WIQL (`POST /{org}/{project}/_apis/wit/wiql`) because it handles date filtering and multi-assignee OR conditions natively. Avoid polling individual endpoints per user.

**Two-step fetch**: WIQL returns IDs only → a second batch call (`GET /_apis/wit/workitems?ids=...&fields=...`) fetches the actual fields. Batch in chunks of 200 (API limit).

**Auth**: PAT is read from `import.meta.env.VITE_AZURE_PAT` at runtime and injected by the axios instance in `api/azureDevOps.ts`. No auth logic in components.

**State**: All filter state lives in `App.tsx` and is passed down to `FilterBar` (controlled inputs). Report results live in the `useReport` hook.

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

## Excel Export

`ExportButton` uses `xlsx` (`SheetJS`): converts the current `WorkItem[]` array to a worksheet via `XLSX.utils.json_to_sheet`, wraps it in a workbook, and triggers download with `XLSX.writeFile`. Column headers must be human-readable (not camelCase field names).
