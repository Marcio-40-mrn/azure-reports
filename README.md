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
   - **Test Plans** → Read *(necessário para exibir resultados de Test Cases: Passed/Failed/Blocked)*
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
| **Colaboradores** | Selecione um ou mais membros das equipes. Use a caixa de busca para filtrar por nome. O botão **Remover todos** desmarca todos de uma vez. |
| **Data Início / Data Fim** | Intervalo de `System.ChangedDate` dos itens. |
| **Tipos de Item** | Marque os tipos desejados: Bug, Task, Product Backlog Item, Test Plan, Test Case. O botão **Remover todos** desmarca todos de uma vez. Para Test Cases, somente os executados com resultado **Passed**, **Failed** ou **Blocked** são exibidos — itens em *Design* (não executados) são excluídos automaticamente. |
| **Projetos** | Todos os projetos da organização são carregados automaticamente e selecionados por padrão. Desmarque os que não deseja incluir. |

Após configurar os filtros, clique em **Gerar Relatório**. O botão fica habilitado somente quando todos os campos obrigatórios estão preenchidos.

### 2. Resultados

- **Cards por colaborador** — cada membro selecionado recebe um card com gráfico de rosca e tabela de distribuição por status. Com um único colaborador o card é exibido em largura maior; com dois ou mais, o layout passa para duas colunas.
- **Tabela completa** — lista todos os itens retornados com ID, título, tipo, status, responsável, projeto e datas. Para Test Cases, o campo **Responsável** exibe quem efetivamente executou o teste (*Run By*), não quem foi designado.

### 3. Exportar para Excel

Clique em **Exportar Excel** para baixar um arquivo `.xlsx` com a consulta atual. A planilha é gerada com três tipos de abas:

| Aba | Conteúdo |
|---|---|
| **Dashboard** | Gráfico de pizza com a distribuição por status + tabela de totais por colaborador |
| **Resumo** | Pivot: uma linha por colaborador, colunas por status, linha de total |
| **[Nome do colaborador]** | Lista detalhada de itens ordenada por Tipo → Status → Título, com coluna **Observações** em branco para preenchimento manual |

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
| Test Cases não aparecem | PAT sem escopo **Test Plans (Read)** | Gere um novo PAT incluindo esse escopo |
| Test Cases aparecem como "Design" | PAT sem escopo **Test Plans (Read)** ou nenhum teste foi executado no período | Verifique o escopo do PAT e o intervalo de datas |
| Test Case aparece sob o colaborador errado | O campo **Responsável** exibe quem *executou* o teste (*Run By*), não quem foi designado | Comportamento esperado — é intencional |
