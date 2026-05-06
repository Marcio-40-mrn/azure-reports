# Azure DevOps Report

Dashboard web para consultar e exportar itens de trabalho do Azure DevOps, com filtros por colaborador, período, tipo de item e projeto.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- Acesso a uma organização no Azure DevOps
- Personal Access Token (PAT) com os escopos abaixo

## Gerando um PAT no Azure DevOps

1. Acesse `https://dev.azure.com/<sua-org>` e clique na sua foto de perfil → **Personal access tokens**
2. Clique em **New Token**
3. Dê um nome e defina a validade
4. Em **Scopes**, selecione:
   - **Work Items** → Read
   - **Project and Team** → Read
5. Clique em **Create** e copie o token gerado (ele não será exibido novamente)

## Configuração

Crie um arquivo `.env` na raiz do projeto com as suas credenciais:

```env
VITE_AZURE_ORG=https://dev.azure.com/sua-organizacao
VITE_AZURE_PAT=seu-personal-access-token
```

> O arquivo `.env` já está no `.gitignore` — nunca o commite.

## Instalação e execução

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

Abra `http://localhost:5173` no navegador.

## Como usar

### 1. Painel de filtros (coluna esquerda)

| Filtro | Descrição |
|---|---|
| **Colaboradores** | Selecione um ou mais membros das equipes. Use a caixa de busca para filtrar por nome. |
| **Data Início / Data Fim** | Intervalo de `System.ChangedDate` dos itens. |
| **Tipos de Item** | Marque os tipos desejados: Bug, Task, Product Backlog Item, Test Plan, Test Case. |
| **Projetos** | Todos os projetos da organização são carregados automaticamente e selecionados por padrão. Desmarque os que não deseja incluir. |

Após configurar os filtros, clique em **Gerar Relatório**. O botão fica habilitado somente quando todos os campos obrigatórios estão preenchidos.

### 2. Resultados

- **Cards por colaborador** — cada membro selecionado recebe um card com gráfico de rosca e tabela de distribuição por status.
- **Tabela completa** — lista todos os itens retornados com ID, título, tipo, status, responsável, projeto e datas.

### 3. Exportar para Excel

Clique em **Exportar Excel** (canto superior direito dos resultados) para baixar um arquivo `.xlsx` com todos os itens da consulta atual, com cabeçalhos legíveis.

## Scripts disponíveis

```bash
npm run dev          # servidor de desenvolvimento (hot-reload)
npm run build        # build de produção (TypeScript + Vite)
npm run preview      # pré-visualiza o build de produção localmente
npm run lint         # análise ESLint
npm run type-check   # verificação de tipos sem emitir arquivos
```

## Estrutura do projeto

```
src/
  api/
    azureDevOps.ts       # cliente axios, WIQL, chamadas à API
  components/
    FilterBar.tsx         # painel de filtros
    CollaboratorCard.tsx  # card com gráfico por colaborador
    ReportTable.tsx       # tabela completa de itens
    ExportButton.tsx      # exportação para Excel
    LoadingSpinner.tsx    # overlay de carregamento
    EnvCheck.tsx          # aviso se variáveis de ambiente estiverem ausentes
  hooks/
    useReport.ts          # orquestra fetch, loading e erro
  types/
    index.ts              # interfaces TypeScript (WorkItem, FilterState…)
  App.tsx
  main.tsx
```

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Nenhum colaborador encontrado" | PAT sem escopo **Project and Team (Read)** | Gere um novo PAT com o escopo correto |
| Erro 401 / 403 | PAT inválido ou expirado | Verifique `VITE_AZURE_PAT` no `.env` e reinicie o servidor |
| Erro 404 na organização | `VITE_AZURE_ORG` incorreto | Confirme a URL completa, ex.: `https://dev.azure.com/minha-org` |
| Variáveis não reconhecidas | `.env` criado após `npm run dev` | Pare o servidor, edite o `.env` e execute `npm run dev` novamente |
