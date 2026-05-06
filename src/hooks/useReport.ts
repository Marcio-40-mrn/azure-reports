import { useState, useCallback } from 'react'
import { fetchWorkItems } from '../api/azureDevOps'
import type { WorkItem, FilterState } from '../types'

interface ReportState {
  items: WorkItem[]
  loading: boolean
  error: string | null
}

export function useReport() {
  const [state, setState] = useState<ReportState>({
    items: [],
    loading: false,
    error: null,
  })

  const generate = useCallback(async (filters: FilterState) => {
    setState({ items: [], loading: true, error: null })
    try {
      const items = await fetchWorkItems(filters)
      setState({ items, loading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState({ items: [], loading: false, error: message })
    }
  }, [])

  return { ...state, generate }
}
