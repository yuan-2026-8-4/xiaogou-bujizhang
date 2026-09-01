import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { useAppStore } from '../store/AppStore'
import { DEFAULT_CATEGORIES } from '../config/categories'

// 统计页：严格按参考图4
// 顶部蓝绿色渐变区域放数据总览三栏
// 环形图 + 折线图在下方白色卡片
export default function StatsPage() {
  const { transactions, currentLedgerId } = useAppStore()
  const [range, setRange] = useState<'month' | 'prevMonth' | '3month' | 'year'>('month')

  // 时间范围筛选
  const rangeDate = useMemo(() => {
    const now = dayjs()
    if (range === 'month') return now.format('YYYY-MM')
    if (range === 'prevMonth') return now.subtract(1, 'month').format('YYYY-MM')
    if (range === '3month') return now.subtract(2, 'month').startOf('month').format('YYYY-MM-DD')
    return now.format('YYYY')
  }, [range])

  const list = useMemo(() => {
    const all = transactions.filter((t) => t.ledgerId === currentLedgerId)
    if (range === 'month') return all.filter((t) => t.date.startsWith(rangeDate))
    if (range === 'prevMonth') return all.filter((t) => t.date.startsWith(rangeDate))
    if (range === '3month') {
      const start = dayjs(rangeDate)
      const end = dayjs().endOf('month')
      return all.filter((t) => dayjs(t.date).isAfter(start) && dayjs(t.date).isBefore(end))
    }
    return all.filter((t) => t.date.startsWith(rangeDate))
  }, [transactions, currentLedgerId, range, rangeDate])

  // 支出分类占比（环形图）
  const pieData = useMemo(() => {
    const map = new Map<string, number>()
    list
      .filter((t) => t.type === 'expense')
      .forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount))
    return Array.from(map.entries())
      .map(([k, v]) => {
        const cat = DEFAULT_CATEGORIES.find((c) => c.id === k)
        return {
          name: cat?.name ?? '其他',
          value: Math.round(v * 100) / 100,
          color: cat?.color ?? '#64748b',
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [list])

  // 近30天收支趋势（折线图）
  const trend = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) =>
      dayjs().subtract(29 - i, 'day').format('YYYY-MM-DD'),
    )
    return days.map((d) => {
      const exp = list
        .filter((t) => t.date === d && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)
      const inc = list
        .filter((t) => t.date === d && t.type === 'income')
        .reduce((s, t) => s + t.amount, 0)
      return {
        date: d.slice(5).replace('-', '/'),
        支出: Math.round(exp),
        收入: Math.round(inc),
      }
    })
  }, [list])

  const totalIncome = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const rangeLabels: Record<string, string> = {
    month: '本月',
    prevMonth: '上月',
    '3month': '近3月',
    year: '本年',
  }

  return (
    <div className="page">
      {/* 顶部蓝绿色渐变区域 */}
      <div className="stats-header">
        <div className="stats-nav">
          <div style={{ width: 32 }} />
          <div className="stats-title">统计报表</div>
          <button
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
            aria-label="设置"
          >
            ⚙️
          </button>
        </div>

        {/* 时间范围切换 */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 20,
            padding: 3,
            marginBottom: 16,
          }}
        >
          {Object.entries(rangeLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRange(key as any)}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 18,
                fontSize: 13,
                background: range === key ? '#fff' : 'transparent',
                color: range === key ? 'var(--primary)' : '#fff',
                fontWeight: range === key ? 600 : 400,
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 数据总览三栏 */}
        <div className="stats-overview">
          <div>
            <div className="stats-label">总收入</div>
            <div className="stats-value">{totalIncome.toFixed(0)}</div>
          </div>
          <div>
            <div className="stats-label">总支出</div>
            <div className="stats-value">{totalExpense.toFixed(0)}</div>
          </div>
          <div>
            <div className="stats-label">结余</div>
            <div className="stats-value">{(totalIncome - totalExpense).toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* 支出分类环形图 */}
      <div className="chart-card">
        <h3>支出分类</h3>
        {pieData.length > 0 ? (
          <div className="ring-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="none"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieData[i].color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`¥${value.toFixed(2)}`, '']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* 环形中心文字 */}
            <div className="ring-center">
              <div className="rc-title">支出分类</div>
              <div className="rc-sub">{rangeLabels[range]}分类占比</div>
            </div>
            {/* 右侧图例 */}
            <div
              style={{
                position: 'absolute',
                right: 4,
                top: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 11,
                maxHeight: 200,
                overflow: 'hidden',
              }}
            >
              {pieData.slice(0, 5).map((d, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: d.color,
                    }}
                  />
                  <span style={{ color: 'var(--text-sub)' }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty">{rangeLabels[range]}暂无支出</div>
        )}
      </div>

      {/* 收支趋势折线图 */}
      <div className="chart-card">
        <h3>
          <span>收支趋势</span>
          <span className="legend">近30天</span>
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trend} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
            />
            <Line
              type="monotone"
              dataKey="支出"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 2, fill: '#f97316' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="收入"
              stroke="#14b8a6"
              strokeWidth={2}
              dot={{ r: 2, fill: '#14b8a6' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12, color: 'var(--text-sub)', marginTop: 8 }}>
          <span><span style={{ display: 'inline-block', width: 16, height: 2, background: '#14b8a6', marginRight: 4, verticalAlign: 'middle' }} />收入</span>
          <span><span style={{ display: 'inline-block', width: 16, height: 2, background: '#f97316', marginRight: 4, verticalAlign: 'middle' }} />支出</span>
        </div>
      </div>
    </div>
  )
}
