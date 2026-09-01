import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import { DEFAULT_CATEGORIES } from '../services/category-svc'

/** 任务1 账单详情页（详情/编辑/删除 + 权限控制） */
export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { transactions, updateTransaction, deleteTransaction, categories, isDemoMode } = useAppStore()
  const tx = transactions.find(t => t.id === id)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ amount: 0, type: 'expense' as 'income'|'expense', category: 'exp-food', date: '', note: '' })
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!tx) return
    setForm({ amount: tx.amount, type: tx.type, category: tx.category, date: tx.date, note: tx.note ?? '' })
  }, [tx?.id])

  if (!tx) {
    return (
      <div className="page tx-detail">
        <div className="empty-card">该账单不存在或已被删除</div>
        <button className="btn-primary" onClick={() => nav(-1)}>返回</button>
      </div>
    )
  }
  const cat = (categories.length ? categories : DEFAULT_CATEGORIES).find(c => c.id === tx.category)

  const canEdit = isDemoMode || true // 任务1 AC-3 细粒度权限留给任务2协同详情；此处页面默认可进

  const onSave = async () => {
    setErr('')
    if (form.amount <= 0) return setErr('金额必须大于 0')
    if (!form.date) return setErr('请选择日期')
    const { error } = await updateTransaction(tx.id, form)
    if (error) return setErr(error)
    setEditing(false)
  }
  const onDelete = async () => {
    if (!window.confirm('确认删除该笔账单？删除后无法恢复。')) return
    const { error } = await deleteTransaction(tx.id)
    if (error) return setErr(error)
    nav(-1)
  }

  return (
    <div className="page tx-detail">
      <div className="detail-card">
        <div className="detail-row">
          <span className="label">金额</span>
          {editing ? (
            <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
          ) : (
            <span className={`amount ${form.type}`}>¥{tx.amount.toFixed(2)}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="label">类型</span>
          {editing ? (
            <div className="segmented">
              <button className={form.type === 'expense' ? 'on' : ''} onClick={() => setForm({ ...form, type: 'expense' })}>支出</button>
              <button className={form.type === 'income' ? 'on' : ''} onClick={() => setForm({ ...form, type: 'income' })}>收入</button>
            </div>
          ) : (
            <span className={`pill ${form.type}`}>{form.type === 'expense' ? '支出' : '收入'}</span>
          )}
        </div>
        <div className="detail-row">
          <span className="label">分类</span>
          {editing ? (
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {(categories.length ? categories : DEFAULT_CATEGORIES).filter(c => c.type === form.type).map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          ) : (
            <span className="cat-chip" style={{ background: cat?.color ?? '#64748b' }}>
              {cat?.icon} {cat?.name ?? tx.category}
            </span>
          )}
        </div>
        <div className="detail-row">
          <span className="label">日期</span>
          {editing ? (
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          ) : (
            <span>{tx.date}</span>
          )}
        </div>
        <div className="detail-row col">
          <span className="label">备注</span>
          {editing ? (
            <textarea rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="写点什么…" />
          ) : (
            <div className="note-box">{tx.note || <span className="muted">无备注</span>}</div>
          )}
        </div>
      </div>

      {err && <div className="toast error">{err}</div>}

      <div className="action-bar">
        {editing ? (
          <>
            <button className="btn-ghost" onClick={() => setEditing(false)}>取消</button>
            <button className="btn-primary" onClick={onSave}>保存</button>
          </>
        ) : (
          <>
            <button className="btn-danger" onClick={onDelete}>删除</button>
            {canEdit && <button className="btn-primary" onClick={() => setEditing(true)}>编辑</button>}
            <button className="btn-ghost" onClick={() => nav(-1)}>返回</button>
          </>
        )}
      </div>
    </div>
  )
}
