import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import { budgetLevel } from '../services/budget'
import BudgetRing from '../components/budget/BudgetRing'

/** 任务7 预算设置页：首页预算环组件单独抽，此页做设置入口 + 各月历史（预留） */
export default function BudgetPage() {
  const nav = useNavigate()
  const { transactions, currentLedgerId, currentBudget, refreshBudget, setBudget, removeBudget, isDemoMode } = useAppStore()
  const [monthStr, setMonthStr] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { refreshBudget(monthStr) }, [monthStr, currentLedgerId, refreshBudget])

  const monthTxs = useMemo(() => {
    return transactions.filter(t => t.ledgerId === currentLedgerId && t.date.startsWith(monthStr))
  }, [transactions, currentLedgerId, monthStr])

  const used = useMemo(() => monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [monthTxs])
  const amountNum = currentBudget?.amount ?? 0
  const remaining = amountNum - used
  const level = budgetLevel(used, amountNum)
  const day = Number(new Date().toISOString().slice(8, 10))
  const daysInMonth = new Date(Number(monthStr.slice(0, 4)), Number(monthStr.slice(5, 7)), 0).getDate()
  const daily = amountNum / daysInMonth
  const pace = daily * day

  const onSave = async () => {
    setErr('')
    const v = Number(amount)
    if (!v || v <= 0) return setErr('请输入大于 0 的预算金额')
    const r = await setBudget(v, monthStr)
    if (r.error) return setErr(r.error)
    setAmount('')
  }
  const onRemove = async () => {
    if (!window.confirm('确认删除该月预算？')) return
    const r = await removeBudget(monthStr)
    if (r.error) return setErr(r.error)
  }

  return (
    <div className="page budget-ring">
      <div className="top-bar">
        <button className="btn-ghost small" onClick={() => nav(-1)}>‹ 返回</button>
        <h2>本月预算</h2>
        <div />
      </div>

      <div className="card month-picker">
        <input type="month" value={monthStr} onChange={e => setMonthStr(e.target.value)} />
      </div>

      <div className="ring-wrap">
        <BudgetRing used={used} budget={amountNum} size={240} />
        <div className="ring-meta">
          <div className="label-row"><span className="dot c-used"></span>已用 <strong className={`${level.level}`}>¥{used.toFixed(2)}</strong></div>
          <div className="label-row"><span className="dot c-remain"></span>剩余 <strong>¥{Math.max(0, remaining).toFixed(2)}</strong></div>
          <div className="label-row"><span className="dot c-pace"></span>进度日耗参考 <strong>¥{pace.toFixed(0)}</strong></div>
          <div className={`level-tag ${level.level}`}>
            {level.level === 'safe' ? '预算健康' : level.level === 'warn' ? '即将超支' : '已超支'}（{Math.round(level.percent * 100)}%）
          </div>
        </div>
      </div>

      <div className="card set-budget">
        <h3>{currentBudget ? '修改预算' : '设置预算'}</h3>
        <div className="row">
          <label>预算金额</label>
          <input type="number" step="0.01" placeholder="例如 3000" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        {err && <div className="toast error">{err}</div>}
        <div className="row-2">
          {currentBudget && <button className="btn-danger" onClick={onRemove}>删除本月预算</button>}
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={onSave}>保存</button>
        </div>
        {isDemoMode && <div className="muted tiny">Demo 模式：预算保存在本地浏览器存储。</div>}
      </div>
    </div>
  )
}
