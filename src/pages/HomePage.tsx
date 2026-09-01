import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import BillCard from '../components/transaction/BillCard'
import BudgetRing from '../components/budget/BudgetRing'
import { budgetLevel } from '../services/budget'

// 首页：严格按参考图1（用户提供的图4）
// 顶部蓝绿色渐变区域放收支三栏 + 快速统计条
// 下方白色区域按日期分组显示账单列表
// 底部中央悬浮圆形蓝绿色加号按钮
export default function HomePage() {
  const { transactions, currentLedgerId, ledgers, setCurrentLedger, currentBudget } = useAppStore()
  const navigate = useNavigate()
  const loc = useLocation()
  const isList = loc.pathname === '/'
  const [showLedgerPicker, setShowLedgerPicker] = useState(false)
  const now = dayjs()
  const monthPrefix = now.format('YYYY-MM')

  // 本月预算用量（任务7 AC-15 / TR-7.5 入口）
  const budgetMonthExpense = useMemo(() => transactions
    .filter(t => t.ledgerId === currentLedgerId && t.type === 'expense' && t.date.startsWith(monthPrefix))
    .reduce((s, t) => s + t.amount, 0),
  [transactions, currentLedgerId, monthPrefix])
  const levelResult = currentBudget ? budgetLevel(budgetMonthExpense, currentBudget.amount) : null
  const levelStr: 'safe' | 'warn' | 'danger' | 'none' = levelResult ? levelResult.level : 'none'
  const percent = levelResult ? Math.round(levelResult.percent * 100) : 0
  const remaining = currentBudget ? Math.max(0, currentBudget.amount - budgetMonthExpense) : 0

  const currentLedger = ledgers.find((l) => l.id === currentLedgerId)
  const isCoop = currentLedger?.type === 'collaborative'

  const txList = useMemo(
    () =>
      transactions
        .filter((t) => t.ledgerId === currentLedgerId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [transactions, currentLedgerId],
  )

  // 本月统计
  const month = dayjs().format('YYYY-MM')
  const monthTx = txList.filter((t) => t.date.startsWith(month))
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // 今日/本周支出
  const today = dayjs().format('YYYY-MM-DD')
  const todayExpense = txList
    .filter((t) => t.date === today && t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const weekExpense = txList
    .filter(
      (t) =>
        t.type === 'expense' &&
        dayjs(t.date).isAfter(dayjs().subtract(6, 'day')) &&
        dayjs(t.date).isBefore(dayjs().add(1, 'day')),
    )
    .reduce((s, t) => s + t.amount, 0)

  // 按日期分组
  const groups = useMemo(() => {
    const map = new Map<string, typeof txList>()
    for (const t of txList) {
      const arr = map.get(t.date) ?? []
      arr.push(t)
      map.set(t.date, arr)
    }
    return Array.from(map.entries())
  }, [txList])

  const quickAccessDate = (d: string) => {
    if (d === today) return '今天'
    if (d === dayjs().subtract(1, 'day').format('YYYY-MM-DD')) return '昨天'
    return dayjs(d).format('M月D日 ddd')
  }

  return (
    <div className="page home-page">
      {/* 顶部蓝绿色渐变区域 */}
      <div className="home-top-section">
        {/* 导航栏 */}
        <div className="home-nav">
          <button
            className="home-nav-left"
            onClick={() => setShowLedgerPicker(true)}
          >
            <span style={{ fontSize: 18 }}>
              {currentLedger?.icon ?? '📒'}
            </span>
            <span>{currentLedger?.name ?? '账本'}</span>
            <span style={{ fontSize: 12 }}>▾</span>
          </button>
          <div className="home-nav-right">
            <button
              className="home-nav-icon"
              onClick={() => navigate('/ledger')}
              aria-label="账本管理"
            >
              📒
            </button>
          </div>
        </div>

        {/* 列表 / 日历 切换 Tab（任务3 TR-3.5） */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 10px 0' }}>
          <div className="segmented" role="tablist">
            <button className={isList ? 'on' : ''} onClick={() => navigate('/')}>📝 列表</button>
            <button className={!isList ? 'on' : ''} onClick={() => navigate('/calendar')}>📅 日历</button>
          </div>
        </div>

        {/* 收支三栏（白色文字在渐变背景上） */}
        <div className="home-summary">
          <div className="sum-item">
            <div className="sum-label">本月收入</div>
            <div className="sum-value">{income.toFixed(0)}</div>
          </div>
          <div className="sum-item">
            <div className="sum-label">本月支出</div>
            <div className="sum-value">{expense.toFixed(0)}</div>
          </div>
          <div className="sum-item">
            <div className="sum-label">结余</div>
            <div className="sum-value">{(income - expense).toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* 今日/本周快速统计卡片 */}
      <div className="home-quick-stats">
        <div className="quick-stat">
          <div className="quick-stat-label">今日支出</div>
          <div className="quick-stat-value num-expense">
            ¥{todayExpense.toFixed(2)}
          </div>
        </div>
        <div className="quick-stat">
          <div className="quick-stat-label">本周支出</div>
          <div className="quick-stat-value num-expense">
            ¥{weekExpense.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 预算仪表盘入口（任务7 TR-7.5）：小预算环 120px，点击跳 /budget */}
      <div
        className="card home-budget-entry"
        role="button"
        onClick={() => navigate('/budget')}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, marginBottom: 10 }}
      >
        <BudgetRing
          size={110}
          used={budgetMonthExpense}
          budget={currentBudget?.amount ?? 0}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            {now.format('YYYY年M月')} 预算
          </div>
          {currentBudget ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: levelStr === 'danger' ? '#ef4444' : levelStr === 'warn' ? '#f59e0b' : '#0f766e', marginTop: 2 }}>
                {percent}% · 已用 ¥{budgetMonthExpense.toFixed(0)}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                剩余 ¥{remaining.toFixed(0)} / {currentBudget.amount.toFixed(0)}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f766e', marginTop: 2 }}>
                本月还未设置预算
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                点击设置 → 帮你把控每月支出节奏
              </div>
            </>
          )}
        </div>
        <div style={{ color: '#99f6e4', fontSize: 22 }}>›</div>
      </div>

      {/* 账单列表区域 */}
      <div className="home-bill-section">
        <div className="home-section-head">
          <span>本月 | 最近账单</span>
          <span className="arrow">›</span>
        </div>

        {groups.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📝</div>
            还没有账单，点下方 ＋ 记一笔吧
          </div>
        )}

        {groups.map(([date, list]) => (
          <section key={date} className="bill-group">
            <div className="bill-group-date">
              {quickAccessDate(date)} · 共{list.length}笔
            </div>
            <div className="bill-group-card">
              {list.map((t) => (
                <BillCard key={t.id} tx={t} showUser={isCoop} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* 账本选择弹窗 */}
      {showLedgerPicker && (
        <div className="modal-mask" onClick={() => setShowLedgerPicker(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <div className="modal-title">切换账本</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ledgers.map((l) => (
                <button
                  key={l.id}
                  className={`ledger-item${l.id === currentLedgerId ? ' active' : ''}`}
                  onClick={() => {
                    setCurrentLedger(l.id)
                    setShowLedgerPicker(false)
                  }}
                >
                  <span
                    className="ledger-icon"
                    style={{ background: `${l.color}1f`, color: l.color }}
                  >
                    {l.icon}
                  </span>
                  <span className="ledger-name">{l.name}</span>
                  <span className="ledger-type">
                    {l.type === 'collaborative' ? '协同' : '个人'}
                  </span>
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => navigate('/ledger')}>
                管理账本
              </button>
              <button className="btn-primary" onClick={() => setShowLedgerPicker(false)}>
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
