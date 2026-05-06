export type WorkItemType = 'Bug' | 'Task' | 'Product Backlog Item' | 'Test Plan' | 'Test Case'

export interface WorkItem {
  id: number
  title: string
  type: WorkItemType
  status: string
  assignedTo: string
  project: string
  changedDate: string
  createdDate: string
}

export interface Project {
  id: string
  name: string
}

export interface User {
  id: string
  displayName: string
  principalName: string
}

export interface FilterState {
  assignees: string[]
  startDate: string
  endDate: string
  itemTypes: WorkItemType[]
  projects: string[]
}
