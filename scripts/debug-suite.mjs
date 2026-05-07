/**
 * Dumpa o shape RAW dos test points da suite 19045 para ver quais campos existem.
 * node scripts/debug-suite.mjs
 */

import axios from 'axios'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env')

function parseEnv(path) {
  const lines = readFileSync(path, 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const env = parseEnv(envPath)
const PAT = env.VITE_AZURE_PAT
const ORG = (env.VITE_AZURE_ORG || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '').trim()

const api = axios.create({
  baseURL: `https://dev.azure.com/${ORG}`,
  headers: {
    Authorization: `Basic ${Buffer.from(`:${PAT}`).toString('base64')}`,
    'Content-Type': 'application/json',
  },
})

const PROJECT = 'Aramis Connect'
const SUITE_ID = 19045

// Encontra o plano que contém a suite 19045
async function findPlan() {
  const r = await api.get(`/${encodeURIComponent(PROJECT)}/_apis/testplan/plans?api-version=7.1&$top=200`)
  for (const plan of r.data.value ?? []) {
    try {
      const s = await api.get(
        `/${encodeURIComponent(PROJECT)}/_apis/testplan/plans/${plan.id}/suites/${SUITE_ID}?api-version=7.1`
      )
      if (s.data?.id) return plan.id
    } catch { /* não é nesse plano */ }
  }
  return null
}

async function main() {
  console.log(`Procurando plano da suite ${SUITE_ID}...`)
  const planId = await findPlan()
  if (!planId) { console.error('Suite não encontrada em nenhum plano'); return }
  console.log(`Suite ${SUITE_ID} encontrada no plano ${planId}\n`)

  // Busca test points SEM filtro de testCaseIdList
  console.log('── Sem testCaseIdList ──────────────────────────────────')
  const r1 = await api.get(
    `/${encodeURIComponent(PROJECT)}/_apis/testplan/plans/${planId}/suites/${SUITE_ID}/testpoint?api-version=7.1&$top=50`
  )
  const pts1 = r1.data.value ?? []
  console.log(`Total pontos: ${pts1.length}`)
  if (pts1.length > 0) {
    console.log('\nPrimeiro ponto (shape completo):')
    console.log(JSON.stringify(pts1[0], null, 2))
    console.log('\nTodos os pontos (campos relevantes):')
    for (const pt of pts1) {
      const id = pt.testCaseReference?.id ?? pt.testCase?.id
      const outcome = pt.results?.lastResultOutcome ?? pt.lastResultOutcome ?? pt.results?.outcome ?? '(vazio)'
      const date = pt.results?.lastResultDetails?.dateCompleted ?? pt.lastResultDetails?.dateCompleted ?? '(sem data)'
      console.log(`  tcId=${id}  outcome="${outcome}"  dateCompleted="${date}"`)
    }
  }

  // Busca test points COM testCaseIdList (como era antes)
  console.log('\n── Com testCaseIdList=19143 ────────────────────────────')
  const r2 = await api.get(
    `/${encodeURIComponent(PROJECT)}/_apis/testplan/plans/${planId}/suites/${SUITE_ID}/testpoint?testCaseIdList=19143&api-version=7.1`
  )
  const pts2 = r2.data.value ?? []
  console.log(`Total pontos: ${pts2.length}`)
  if (pts2.length > 0) {
    console.log('\nPrimeiro ponto (shape completo):')
    console.log(JSON.stringify(pts2[0], null, 2))
  }
}

main().catch(e => {
  console.error('Erro:', e.response?.data ?? e.message)
})
