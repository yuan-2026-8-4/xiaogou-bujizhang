import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import * as memberSvc from '../services/member-svc'
import type { LedgerMember, LedgerOverview } from '../types'

/** 任务2 协同账本详情页：概览 / 成员 / 邀请 / 转让 / 移除 / 编辑 / 删除 */
export default function CollabLedgerDetailPage() {
  const { ledgerId } = useParams<{ ledgerId: string }>()
  const nav = useNavigate()
  const { ledgers, transactions, updateLedger, deleteLedger, user, isDemoMode, profile } = useAppStore()
  const ledger = ledgers.find(l => l.id === ledgerId)
  const [overview, setOverview] = useState<LedgerOverview | null>(null)
  const [members, setMembers] = useState<LedgerMember[]>([])
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '📒' })

  useEffect(() => { if (ledger) setForm({ name: ledger.name, icon: ledger.icon }) }, [ledger?.id])

  const monthRange = useMemo(() => {
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth() + 1
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = `${y}-${String(m).padStart(2, '0')}-31`
    return { start, end }
  }, [])

  // 生成一个"变化指纹"：所有 ledger 的 id+name+icon+updateAt 拼接的哈希（string concat），当 length+内容任一变就变
  const ledgerFingerprint = ledgers.map(l => `${l.id}|${l.name}|${l.icon ?? ''}|${l.updatedAt ?? ''}`).join('@@')
  const txFingerprint = transactions.length

  const load = async () => {
    if (!ledgerId) return
    const myUid = user?.id ?? 'u-demo'
    const [o, m] = await Promise.all([
      memberSvc.fetchLedgerOverview(ledgerId, myUid, isDemoMode, monthRange, ledgers, transactions),
      memberSvc.fetchMembers(ledgerId, myUid, profile?.nickname ?? '我', isDemoMode),
    ])
    if (o.error) setErr(o.error)
    setOverview(o.overview ?? null)
    setMembers(m.members)
  }
  useEffect(() => { load() }, [ledgerId, isDemoMode, user?.id, monthRange.start, monthRange.end, ledgerFingerprint, txFingerprint])

  if (!ledger && !overview) {
    return (
      <div className="page collab-detail">
        <div className="empty-card">{err || '账本不存在或您没有权限'}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
          <button className="btn-ghost" onClick={() => nav('/collab', { replace: true })}>返回协同列表</button>
          <button className="btn-primary" onClick={() => nav(-1)}>返回</button>
        </div>
      </div>
    )
  }
  const ov = overview ?? { id: ledger!.id, name: ledger!.name, icon: ledger!.icon, color: ledger!.color, type: ledger!.type, memberCount: 1, memberRole: 'owner' as const, todayActiveUsers: 1, todayTxCount: 0, monthExpense: 0 }
  const iAmOwner = ov.memberRole === 'owner'
  const iAmAdmin = iAmOwner || ov.memberRole === 'admin'

  const save = async () => {
    if (!ledgerId || !ledger) return
    if (!form.name.trim()) return setErr('账本名不能为空')
    const r = await updateLedger(ledgerId, { name: form.name.trim(), icon: form.icon })
    if (r.error) return setErr(r.error)
    setErr('')
    setEditing(false)
    await load() // 重新读取 overview.name/icon/color 等
  }
  const onDelete = async () => {
    if (!iAmOwner) return setErr('仅主人可删除账本')
    if (!window.confirm('删除账本会清空所有账单与成员，无法恢复。确定删除？')) return
    const { error } = await deleteLedger(ledgerId!)
    if (error) return setErr(error)
    nav('/', { replace: true })
  }
  const remove = async (uid: string) => {
    if (!iAmAdmin) return setErr('无权限移除成员')
    if (!window.confirm('确认移除该成员？')) return
    const { error } = await memberSvc.removeMember(ledgerId!, uid, isDemoMode)
    if (error) return setErr(error)
    load()
  }
  const transfer = async (uid: string) => {
    if (!iAmOwner) return setErr('仅主人可转让')
    if (!window.confirm('转让后您将变为管理员，不可撤回。确定？')) return
    const { error } = isDemoMode ? { error: 'Demo 模式不支持转让' } : await memberSvc.transferOwner(ledgerId!, uid)
    if (error) return setErr(error)
    load()
  }
  const copyInvite = async () => {
    if (!ov.inviteCode) return setErr('该账本未开启协同邀请')
    try { await navigator.clipboard.writeText(ov.inviteCode); alert('邀请码已复制：' + ov.inviteCode) }
    catch { alert('复制失败，请手动复制：' + ov.inviteCode) }
  }

  return (
    <div className="page collab-detail">
      <div className="ov-card" style={{ background: `linear-gradient(135deg, #2DD4BF, ${ov.color ?? '#14B8A6'})` }}>
        <div className="ov-title">
          {editing ? (
            <>
              <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="icon-input" maxLength={2} />
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="name-input" />
            </>
          ) : (
            <>
              <span className="big-icon">{ov.icon}</span>
              <h2>{ov.name}</h2>
            </>
          )}
        </div>
        <div className="ov-grid">
          <div><div className="num">{ov.memberCount}</div><div className="sub">成员</div></div>
          <div><div className="num">{ov.todayActiveUsers}</div><div className="sub">今日活跃</div></div>
          <div><div className="num">{ov.todayTxCount}</div><div className="sub">今日笔数</div></div>
          <div><div className="num expense">¥{ov.monthExpense.toFixed(2)}</div><div className="sub">本月支出</div></div>
        </div>
      </div>

      {ov.inviteCode && (
        <div className="card invite-card">
          <div><span className="label">邀请码</span><code>{ov.inviteCode}</code></div>
          <button className="btn-primary small" onClick={copyInvite}>复制</button>
        </div>
      )}

      <div className="section-title">成员（{members.length}）</div>
      <ul className="member-list">
        {members.map(m => (
          <li key={m.userId}>
            <div className="avatar">{(m.nickname || 'U').slice(0, 1)}</div>
            <div className="info">
              <div className="name">{m.nickname}{user?.id === m.userId && <span className="muted">（我）</span>}</div>
              <div className="muted">{m.role === 'owner' ? '主人' : m.role === 'admin' ? '管理员' : '成员'}</div>
            </div>
            <div className="member-actions">
              {iAmOwner && user?.id !== m.userId && <button className="link" onClick={() => transfer(m.userId)}>设为主人</button>}
              {iAmAdmin && !iAmOwner ? null : iAmAdmin && user?.id !== m.userId && m.role !== 'owner' && (
                <button className="link danger" onClick={() => remove(m.userId)}>移除</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {err && <div className="toast error">{err}</div>}

      <div className="action-bar">
        <button className="btn-ghost" onClick={() => nav(-1)}>返回</button>
        {editing ? (
          <>
            <button className="btn-ghost" onClick={() => setEditing(false)}>取消</button>
            <button className="btn-primary" onClick={save}>保存</button>
          </>
        ) : (
          <>
            {iAmAdmin && <button className="btn-ghost" onClick={() => setEditing(true)}>编辑账本</button>}
            {iAmOwner && <button className="btn-danger" onClick={onDelete}>删除账本</button>}
          </>
        )}
      </div>
    </div>
  )
}
