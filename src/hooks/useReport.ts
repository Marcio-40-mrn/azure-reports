import { useState, useCallback } from 'react'
import { fetchWorkItems } from '../api/azureDevOps'
import type { WorkItem, FilterState } from '../types'

const STORAGE_KEY = 'azure-report:last-items'

function loadFromStorage(): WorkItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as WorkItem[]
  } catch {
    // ignore parse errors
  }
  return []
}

function saveToStorage(items: WorkItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota errors
  }
}

interface ReportState {
  items: WorkItem[]
  loading: boolean
  error: string | null
}

export function useReport() {
  const [state, setState] = useState<ReportState>(() => ({
    items: loadFromStorage(),
    loading: false,
    error: null,
  }))

  const generate = useCallback(async (filters: FilterState) => {
    setState({ items: [], loading: true, error: null })
    try {
      const items = await fetchWorkItems(filters)
      saveToStorage(items)
      setState({ items, loading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState({ items: [], loading: false, error: message })
    }
  }, [])

  return { ...state, generate }
}
