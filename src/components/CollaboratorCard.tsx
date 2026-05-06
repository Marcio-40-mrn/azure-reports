import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { User } from 'lucide-react'
import type { WorkItem } from '../types'

interface Props {
  name: string
  items: WorkItem[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

export default function CollaboratorCard({ name, items }: Props) {
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1
  }

  const chartData = Object.entries(counts)
    .map(([status, value]) => ({ name: status, value }))
    .sort((a, b) => b.value - a.value)

  const total = items.length

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
        <User size={15} className="text-blue-500 shrink-0" />
        <h3 className="font-semibold text-gray-800 truncate flex-1 text-sm" title={name}>
          {name}
        </h3>
        <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full shrink-0">
          {total} itens
        </span>
      </div>

      {/* Donut + table side-by-side */}
      <div className="flex items-center gap-3">
        {/* Donut chart — fixed size, no ResponsiveContainer needed */}
        <div className="shrink-0">
          <PieChart width={148} height={148}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={68}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} itens`, '']}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
          </PieChart>
        </div>

        {/* Status breakdown */}
        <div className="flex-1 min-w-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide text-[10px]">
                <th className="text-left font-medium pb-2">Status</th>
                <th className="text-right font-medium pb-2">Qtd</th>
                <th className="text-right font-medium pb-2">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {chartData.map((entry, i) => (
                <tr key={entry.name}>
                  <td className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="truncate text-gray-700" title={entry.name}>
                        {entry.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 text-right font-semibold text-gray-800">
                    {entry.value}
                  </td>
                  <td className="py-1.5 text-right text-gray-400">
                    {((entry.value / total) * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
