import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import { DEFAULT_CATEGORIES } from '../services/category-svc'
import type { UserCategory } from '../types'

/** 任务5 分类管理：新增 / 编辑 / 删除 / 删除时迁移 */
export default function CategoryManagePage() {
  const nav = useNavigate()
  const { categories, currentLedgerId, refreshCategories, createCategory, updateCategory, deleteCategory, transactions } = useAppStore()
  const all = categories.length ? categories : DEFAULT_CATEGORIES
  const [tab, setTab] = useState<'expense' | 'income'>('expense')
  const list = useMemo(() => all.filter(c => c.type === tab), [all, tab])

  // 每个分类的账单使用数量（用于"删除需迁移"提示）
  const usageCount = useMemo(() => {
    const m = new Map<string, number>()
    transactions.forEach(t => {
      if (t.ledgerId !== currentLedgerId) return
      m.set(t.category, (m.get(t.category) ?? 0) + 1)
    })
    return m
  }, [transactions, currentLedgerId])

  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<UserCategory | null>(null)
  const [form, setForm] = useState<UserCategory>({ id: '', name: '', icon: '📦', color: '#64748b', type: 'expense', ledgerId: null })
  const [migDlg, setMigDlg] = useState<{ id: string; name: string } | null>(null)
  const [migTo, setMigTo] = useState<string>('')
  const [err, setErr] = useState('')

  useEffect(() => { refreshCategories() }, [currentLedgerId, refreshCategories])

  const newRandomId = () => `custom-${tab}-${Date.now().toString(36)}`

  const openNew = () => {
    setEditing(null)
    setForm({ id: newRandomId(), name: '', icon: '📦', color: tab === 'expense' ? '#f97316' : '#10b981', type: tab, ledgerId: currentLedgerId })
    setShowNew(true)
  }
  const openEdit = (c: UserCategory) => {
    setEditing(c); setForm({ ...c }); setShowNew(true)
  }
  const onSave = async () => {
    setErr('')
    if (!form.name.trim()) return setErr('名称不能为空')
    if (editing) {
      const r = await updateCategory(editing.id, { name: form.name.trim(), icon: form.icon, color: form.color })
      if (r.error) return setErr(r.error)
    } else {
      const payload: UserCategory = { ...form, id: form.id || newRandomId(), ledgerId: currentLedgerId, name: form.name.trim() }
      const r = await createCategory(payload)
      if (r.error) return setErr(r.error)
    }
    setShowNew(false)
  }

  const onDelete = async (c: UserCategory) => {
    const cnt = usageCount.get(c.id) ?? 0
    if (cnt > 0) {
      // 弹出迁移选择
      setMigDlg({ id: c.id, name: c.name })
      // 选择第一个同类型非自己的分类作为默认
      const candidates = list.filter(x => x.id !== c.id)
      setMigTo(candidates[0]?.id ?? '')
      return
    }
    if (!window.confirm(`确认删除分类"${c.name}"？`)) return
    const r = await deleteCategory(c.id, null)
    if (r.error) setErr(r.error)
  }
  const confirmMigrate = async () => {
    if (!migDlg) return
    if (!migTo) return setErr('请选择迁移到的目标分类')
    if (!window.confirm(`删除后"${migDlg.name}"下所有账单将迁移到新分类，是否继续？`)) return
    const r = await deleteCategory(migDlg.id, migTo)
    if (r.error) return setErr(r.error)
    setMigDlg(null); setMigTo('')
  }

  return (
    <div className="page cat-manage">
      <div className="top-bar">
        <button className="btn-ghost small" onClick={() => nav(-1)}>‹ 返回</button>
        <h2>分类管理</h2>
        <button className="btn-primary small" onClick={openNew}>+ 新增</button>
      </div>

      <div className="tabs">
        <button className={tab === 'expense' ? 'on' : ''} onClick={() => setTab('expense')}>支出</button>
        <button className={tab === 'income' ? 'on' : ''} onClick={() => setTab('income')}>收入</button>
      </div>

      <ul className="cat-list">
        {list.map(c => {
          const cnt = usageCount.get(c.id) ?? 0
          const sys = !c.ledgerId
          return (
            <li key={c.id} className="cat-item">
              <div className="cat-icon" style={{ background: c.color }}>{c.icon}</div>
              <div className="cat-info">
                <div className="name">{c.name} {sys && <span className="muted tiny">（系统）</span>}</div>
                <div className="muted tiny">使用中 {cnt} 笔</div>
              </div>
              <div className="cat-actions">
                <button className="link" onClick={() => openEdit(c)}>编辑</button>
                {!sys && <button className="link danger" onClick={() => onDelete(c)}>删除</button>}
              </div>
            </li>
          )
        })}
      </ul>

      {err && <div className="toast error">{err}</div>}

      {showNew && (
        <div className="modal-mask" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editing ? '编辑分类' : '新建分类'}</h3>
            <div className="row"><label>图标</label><input value={form.icon} maxLength={2} onChange={e => setForm({ ...form, icon: e.target.value })} /></div>
            <div className="row"><label>名称</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="例如：桌游" /></div>
            <div className="row"><label>颜色</label><input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowNew(false)}>取消</button>
              <button className="btn-primary" onClick={onSave}>保存</button>
            </div>
          </div>
        </div>
      )}

      {migDlg && (
        <div className="modal-mask" onClick={() => setMigDlg(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>删除分类：{migDlg.name}</h3>
            <p className="muted">该分类下还有 {usageCount.get(migDlg.id) ?? 0} 笔账单，请选择迁移到：</p>
            <select value={migTo} onChange={e => setMigTo(e.target.value)}>
              <option value="">（请选择）</option>
              {list.filter(x => x.id !== migDlg.id).map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setMigDlg(null)}>取消</button>
              <button className="btn-danger" onClick={confirmMigrate}>删除并迁移</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
