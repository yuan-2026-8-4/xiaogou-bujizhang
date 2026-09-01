import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import BillCard from '../components/transaction/BillCard'
import type { Transaction } from '../types'

/** 任务3 日历视图：月视图网格 + 点切换 + 当日列表 */
export default function CalendarPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const isList = loc.pathname === '/'
  const { transactions, currentLedgerId, ledgers, setCurrentLedger } = useAppStore()
  const currentLedger = ledgers.find((l) => l.id === currentLedgerId)

  const [cursor, setCursor] = useState(() => {
    const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [selected, setSelected] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [showLedgerPicker, setShowLedgerPicker] = useState(false)

  const txsInLedger = useMemo(() => transactions.filter(t => t.ledgerId === currentLedgerId), [transactions, currentLedgerId])

  const { days, startWeekday } = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startWeekday = (first.getDay() + 6) % 7 // 周一=0
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
    return { days, startWeekday }
  }, [cursor])

  const byDate = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    txsInLedger.forEach(t => {
      const arr = map.get(t.date) ?? []; arr.push(t); map.set(t.date, arr)
    })
    return map
  }, [txsInLedger])

  const monthSum = useMemo(() => {
    const prefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`
    let inc = 0, exp = 0
    txsInLedger.forEach(t => {
      if (t.date.startsWith(prefix)) { if (t.type === 'income') inc += t.amount; else exp += t.amount }
    })
    return { inc, exp }
  }, [txsInLedger, cursor])

  const selectedTxs = byDate.get(selected) ?? []
  const sumDay = useMemo(() => {
    let inc = 0, exp = 0
    selectedTxs.forEach(t => { if (t.type === 'income') inc += t.amount; else exp += t.amount })
    return { inc, exp }
  }, [selectedTxs])

  const todayStr = new Date().toISOString().slice(0, 10)
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]
  while (cells.length < 42) cells.push(null)

  return (
    <div className="page calendar-view">
      {/* 顶栏与首页保持一致的渐变+账本下拉+切换tab */}
      <div className="home-top-section" style={{ paddingBottom: 10 }}>
        <div className="home-nav">
          <button className="home-nav-left" onClick={() => setShowLedgerPicker(true)}>
            <span style={{ fontSize: 18 }}>{currentLedger?.icon ?? '📒'}</span>
            <span>{currentLedger?.name ?? '账本'}</span>
            <span style={{ fontSize: 12 }}>▾</span>
          </button>
          <div className="home-nav-right">
            <button className="home-nav-icon" onClick={() => nav('/ledger')} aria-label="账本管理">📒</button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 10px 0' }}>
          <div className="segmented" role="tablist">
            <button className={isList ? 'on' : ''} onClick={() => nav('/')}>📝 列表</button>
            <button className={!isList ? 'on' : ''} onClick={() => nav('/calendar')}>📅 日历</button>
          </div>
        </div>
      </div>

      {showLedgerPicker && (
        <div className="modal-mask" onClick={() => setShowLedgerPicker(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
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
                  <span className="ledger-icon" style={{ background: `${l.color}1f`, color: l.color }}>{l.icon}</span>
                  <span className="ledger-name">{l.name}</span>
                  <span className="ledger-type">{l.type === 'collaborative' ? '协同' : '个人'}</span>
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => nav('/ledger')}>管理账本</button>
              <button className="btn-primary" onClick={() => setShowLedgerPicker(false)}>完成</button>
            </div>
          </div>
        </div>
      )}

      <div className="cal-header">
        <button className="cal-nav" onClick={() => setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })}>‹</button>
        <h2>{cursor.y}年{cursor.m + 1}月</h2>
        <button className="cal-nav" onClick={() => setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })}>›</button>
      </div>
      <div className="cal-summary">
        <div><span className="muted">本月收入</span><div className="income big">¥{monthSum.inc.toFixed(2)}</div></div>
        <div><span className="muted">本月支出</span><div className="expense big">¥{monthSum.exp.toFixed(2)}</div></div>
        <div><span className="muted">结余</span><div className={`big ${monthSum.inc - monthSum.exp >= 0 ? 'income' : 'expense'}`}>¥{(monthSum.inc - monthSum.exp).toFixed(2)}</div></div>
      </div>

      <div className="cal-grid">
        {['一','二','三','四','五','六','日'].map(d => <div key={d} className="cal-wk">{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="cal-cell empty" />
          const dateStr = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const txs = byDate.get(dateStr) ?? []
          const dExp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
          const dInc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
          const isSel = dateStr === selected
          const isToday = dateStr === todayStr
          const hasTx = txs.length > 0
          return (
            <button
              key={i}
              className={`cal-cell ${isSel ? 'on' : ''} ${isToday ? 'today' : ''}`}
              data-today={isToday}
              data-has-tx={hasTx}
              onClick={() => setSelected(dateStr)}
            >
              <div className="d">{d}</div>
              {dInc > 0 && <div className="mini income">+{dInc.toFixed(0)}</div>}
              {dExp > 0 && <div className="mini expense">-{dExp.toFixed(0)}</div>}
              {hasTx && <span className="dot" />}
            </button>
          )
        })}
      </div>

      <div className="day-header">
        <div>
          <strong>{selected}</strong>
          <span className="muted ml">{selectedTxs.length} 笔</span>
        </div>
        <div className="sums">
          {sumDay.inc > 0 && <span className="income">收 ¥{sumDay.inc.toFixed(2)}</span>}
          {sumDay.exp > 0 && <span className="expense">支 ¥{sumDay.exp.toFixed(2)}</span>}
        </div>
      </div>
      <div className="tx-list">
        {selectedTxs.length === 0 && <div className="empty">当日还没有账单，点底部 + 记一笔吧</div>}
        {selectedTxs.map(t => (
          <BillCard key={t.id} tx={t} showUser={currentLedger?.type === 'collaborative'} />
        ))}
      </div>
    </div>
  )
}
