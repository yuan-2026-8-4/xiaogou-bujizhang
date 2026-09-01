import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'

/** 任务4 账本管理（新建/编辑/删除/切换） + Demo 双模式 */
export default function LedgerPage() {
  const nav = useNavigate()
  const { ledgers, currentLedgerId, setCurrentLedger, addLedger, updateLedger, deleteLedger, user, isDemoMode } = useAppStore()
  const [err, setErr] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'personal' as 'personal' | 'collaborative', icon: '📒' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const onNew = async () => {
    if (!form.name.trim()) return setErr('名称不能为空')
    if (!isDemoMode && !user) return setErr('未登录')
    if (form.type === 'collaborative') return setErr('协同账本请到协同页创建')
    const lg = await addLedger({ name: form.name.trim(), icon: form.icon, type: 'personal' })
    if (!lg) return setErr('创建失败')
    setShowNew(false); setForm({ name: '', type: 'personal', icon: '📒' })
  }
  const onEditSave = async () => {
    if (!editingId || !form.name.trim()) return setErr('名称不能为空')
    const r = await updateLedger(editingId, { name: form.name.trim(), icon: form.icon })
    if (r.error) return setErr(r.error)
    setEditingId(null)
  }
  const onDelete = async (id: string) => {
    if (!window.confirm('删除账本会清空所有账单，确定？')) return
    const r = await deleteLedger(id)
    if (r.error) return setErr(r.error)
  }
  const openEdit = (id: string) => {
    const l = ledgers.find(x => x.id === id)!
    setEditingId(id); setForm({ name: l.name, type: l.type, icon: l.icon })
  }

  return (
    <div className="page ledger-manage">
      <div className="top-bar">
        <h2>账本管理</h2>
        <button className="btn-primary small" onClick={() => setShowNew(true)}>+ 新账本</button>
      </div>

      <ul className="ledger-list">
        {ledgers.length === 0 && <div className="empty">还没有账本，点右上角新建</div>}
        {ledgers.map(l => {
          const active = l.id === currentLedgerId
          if (editingId === l.id) {
            return (
              <li key={l.id} className="ledger-item editing">
                <input className="icon-input" value={form.icon} maxLength={2} onChange={e => setForm({ ...form, icon: e.target.value })} />
                <input className="name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <div className="tags">
                  <span className={`pill ${l.type}`}>{l.type === 'personal' ? '个人' : '协同'}</span>
                </div>
                <div className="actions">
                  <button className="btn-ghost small" onClick={() => setEditingId(null)}>取消</button>
                  <button className="btn-primary small" onClick={onEditSave}>保存</button>
                </div>
              </li>
            )
          }
          return (
            <li key={l.id} className={`ledger-item ${active ? 'active' : ''}`} onClick={() => setCurrentLedger(l.id)}>
              <div className="ledger-icon">{l.icon}</div>
              <div className="ledger-info">
                <div className="name">{l.name}{active && <span className="muted">（当前）</span>}</div>
                <div className="muted">
                  {l.type === 'personal' ? '个人账本' : '协同账本'}
                  {l.inviteCode && ` · 邀请码 ${l.inviteCode}`}
                </div>
              </div>
              <div className="tags">
                <span className={`pill ${l.type}`}>{l.type === 'personal' ? '个人' : '协同'}</span>
              </div>
              <div className="actions" onClick={e => e.stopPropagation()}>
                <button className="link" onClick={() => nav(`/collab/${l.id}`)}>详情</button>
                <button className="link" onClick={() => openEdit(l.id)}>编辑</button>
                <button className="link danger" onClick={() => onDelete(l.id)}>删除</button>
              </div>
            </li>
          )
        })}
      </ul>

      {(showNew) && (
        <div className="modal-mask" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>新建个人账本</h3>
            <div className="row"><label>图标</label><input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} maxLength={2} /></div>
            <div className="row"><label>名称</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="例如：旅行基金" /></div>
            {err && <div className="toast error">{err}</div>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowNew(false)}>取消</button>
              <button className="btn-primary" onClick={onNew}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
