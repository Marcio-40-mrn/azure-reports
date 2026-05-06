import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { WorkItem } from '../types'

interface Props {
  items: WorkItem[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function ReportChart({ items }: Props) {
  if (items.length === 0) return null

  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1
  }

  const data = Object.entries(counts).map(([name, value]) => ({ name, value }))

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-4">Distribuição por Status</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => [`${value} itens`, 'Quantidade']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
