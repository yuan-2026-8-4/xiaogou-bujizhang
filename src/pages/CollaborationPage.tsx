import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import { createCollabLedger, joinByInviteCode, fetchMembers, leaveLedger, type MemberInfo } from '../services/collab'
import type { Ledger, Transaction } from '../types'

// 协同记账页：严格按参考图3
// 大型 teal 渐变卡片 + 成员头像 + 列表 + 底部双按钮
export default function CollaborationPage() {
  const nav = useNavigate()
  const { ledgers, transactions, user, isDemoMode, addLedger } = useAppStore()
  const coops = ledgers.filter((l) => l.type === 'collaborative')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="page">
      {/* 顶部标题栏 */}
      <div className="collab-header">
        <div className="collab-title">协同记账</div>
      </div>

      <div className="collab-section-title">已加入协同账本</div>

      {/* 大型 teal 渐变卡片（有协同账本时显示） */}
      {coops.length > 0 &&
        coops.map((l) => (
          <CollabHero
            key={l.id}
            ledger={l}
            transactions={transactions.filter((t) => t.ledgerId === l.id)}
            currentUserId={user?.id}
            isDemoMode={isDemoMode}
            expanded={expandedId === l.id}
            onToggle={() => setExpandedId(expandedId === l.id ? null : l.id)}
            onOpenDetail={() => nav(`/collab/${l.id}`)}
            onLeft={async () => {
              if (!user) return
              if (!window.confirm(`确定退出「${l.name}」吗？退出后不再看到该账本账单`)) return
              await leaveLedger(l.id, user.id)
              window.location.reload()
            }}
          />
        ))}

      {/* 空状态 */}
      {coops.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-sub)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div>还没有加入任何协同账本</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>和家人、朋友一起轻松记账吧</div>
        </div>
      )}

      {/* 底部双按钮 */}
      <div className="collab-actions">
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          创建家庭/团队
        </button>
        <button className="btn-ghost" onClick={() => setShowJoin(true)}>
          输入邀请码加入
        </button>
      </div>

      {/* 创建协同弹窗 */}
      {showCreate && <CollabCreateModal onClose={() => setShowCreate(false)} addLedger={addLedger} />}
      {/* 加入协同弹窗 */}
      {showJoin && <CollabJoinModal onClose={() => setShowJoin(false)} />}
    </div>
  )
}

// ---------- 协同账本 hero 卡（真实成员数/本月支出/头像） ----------
function CollabHero({
  ledger,
  transactions,
  currentUserId,
  isDemoMode,
  expanded,
  onToggle,
  onOpenDetail,
  onLeft,
}: {
  ledger: Ledger
  transactions: Transaction[]
  currentUserId?: string
  isDemoMode: boolean
  expanded: boolean
  onToggle: () => void
  onOpenDetail: () => void
  onLeft: () => void
}) {
  const [members, setMembers] = useState<MemberInfo[]>([])

  useEffect(() => {
    if (isDemoMode) {
      setMembers([
        { userId: 'a', nickname: '我', role: 'owner' },
        { userId: 'b', nickname: '家人', role: 'member' },
        { userId: 'c', nickname: '朋友', role: 'member' },
      ])
      return
    }
    fetchMembers(ledger.id).then(setMembers)
  }, [ledger.id, isDemoMode])

  // 本月支出
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthExpense = transactions
    .filter((t) => t.type === 'expense' && t.date.startsWith(monthPrefix))
    .reduce((s, t) => s + t.amount, 0)

  const avatarColors = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

  const copyCode = () => {
    if (!ledger.inviteCode) return
    navigator.clipboard
      .writeText(ledger.inviteCode)
      .then(() => alert(`邀请码 ${ledger.inviteCode} 已复制，发给家人/朋友即可一起记账`))
      .catch(() => alert(`邀请码：${ledger.inviteCode}（请手动记下）`))
  }

  return (
    <div className="collab-hero" onClick={onToggle} style={{ cursor: 'pointer' }}>
      {/* 叠加头像（最多4个 + 溢出数字） */}
      <div className="collab-avatars">
        {members.slice(0, 4).map((m, i) => (
          <div key={m.userId} className="avatar" style={{ background: avatarColors[i % avatarColors.length] }}>
            {m.nickname.slice(0, 1)}
          </div>
        ))}
        {members.length > 4 && (
          <div className="avatar" style={{ background: '#64748b' }}>+{members.length - 4}</div>
        )}
      </div>
      <div className="collab-name">{ledger.name}</div>
      <div className="collab-meta">
        <span>本月支出总额 ¥{monthExpense.toFixed(2)}</span>
        <span>● 成员人数 {members.length}</span>
      </div>

      {/* 展开区：邀请码 + 退出 + 详情 */}
      {expanded && (
        <div className="collab-expand" onClick={(e) => e.stopPropagation()}>
          {ledger.inviteCode && (
            <div className="collab-code-row">
              <span>邀请码</span>
              <span className="collab-code">{ledger.inviteCode}</span>
              <button className="collab-copy" onClick={copyCode}>复制</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-primary" style={{ flex: 1, padding: '8px 10px', fontSize: 13 }} onClick={onOpenDetail}>查看详情</button>
            {currentUserId === ledger.ownerId ? (
              <div className="collab-role" style={{ flex: 1, margin: 0, lineHeight: '32px' }}>你是本账本创建者</div>
            ) : (
              <button className="btn-ghost" style={{ flex: 1, padding: '8px 10px', fontSize: 13, color: '#ef4444', borderColor: '#ef4444' }} onClick={onLeft}>退出该协同账本</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- 创建协同账本弹窗 ----------
function CollabCreateModal({
  onClose,
  addLedger,
}: {
  onClose: () => void
  addLedger: (data: { name: string; type: 'personal' | 'collaborative'; icon?: string; color?: string }) => Promise<Ledger | undefined>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'家庭' | '情侣' | '合租' | '团队'>('家庭')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<Ledger | undefined>()
  const { user, isDemoMode } = useAppStore()

  const types = ['家庭', '情侣', '合租', '团队'] as const
  const icons = { 家庭: '🏡', 情侣: '💕', 合租: '🏠', 团队: '👥' }

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    setErr('')
    let ledger: Ledger | undefined
    if (!isDemoMode && user) {
      // 云端模式：走协同服务（数据库 RPC 原子生成邀请码）
      const res = await createCollabLedger(name.trim(), icons[type])
      if (res.error) {
        setErr(res.error)
        setLoading(false)
        return
      }
      ledger = res.ledger
    } else {
      // Demo 模式：本地建账本（含模拟邀请码）
      ledger = await addLedger({
        name: name.trim(),
        type: 'collaborative',
        icon: icons[type],
        color: '#14b8a6',
      })
      if (ledger) ledger.inviteCode = String(Math.floor(100000 + Math.random() * 900000))
    }
    setLoading(false)
    if (!ledger) return
    setCreated(ledger)
  }

  // 创建成功 → 展示邀请码
  if (created) {
    return (
      <div className="modal-mask" onClick={onClose}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 40, textAlign: 'center' }}>🎉</div>
          <div className="modal-title" style={{ marginTop: 4 }}>「{created.name}」创建成功</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', textAlign: 'center', marginBottom: 12 }}>
            把邀请码发给家人/朋友，即可一起记账
          </div>
          <div className="invite-code-display">{created.inviteCode}</div>
          <div className="modal-footer">
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                navigator.clipboard
                  .writeText(created.inviteCode ?? '')
                  .then(() => alert('邀请码已复制'))
                  .catch(() => {})
                onClose()
              }}
            >
              复制邀请码并完成
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">创建协同账本</div>

        <input
          className="field"
          placeholder="账本名称（如：咱家日常开销）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={10}
        />

        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8 }}>选择类型</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                padding: '12px 6px',
                borderRadius: 12,
                background: type === t ? 'rgba(20,184,166,0.1)' : '#f9fafb',
                border: type === t ? '2px solid var(--primary)' : '2px solid transparent',
                fontSize: 12,
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 2 }}>{icons[t]}</div>
              {t}
            </button>
          ))}
        </div>

        {err && <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>{err}</div>}

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={!name.trim() || loading}>
            {loading ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- 加入协同账本弹窗（真实邀请码校验） ----------
function CollabJoinModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, refreshData } = useAppStore()

  const submit = async () => {
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setErr('请输入6位数字邀请码')
      return
    }
    setLoading(true)
    setErr('')

    if (!user) {
      setLoading(false)
      setErr('请先在"我的"页面登录后再加入协同账本')
      return
    }

    const res = await joinByInviteCode(code, user.id)
    setLoading(false)
    if (res.error) {
      setErr(res.error)
      return
    }
    await refreshData()
    alert(`已加入「${res.ledgerName}」！`)
    onClose()
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">输入邀请码</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', textAlign: 'center', marginBottom: 16 }}>
          向家人/朋友索要6位数字邀请码
        </div>

        <input
          className="field"
          placeholder="6位邀请码"
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
          maxLength={6}
          style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
        />

        {err && <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', marginBottom: 8 }}>{err}</div>}

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={code.length !== 6 || loading}>
            {loading ? '加入中…' : '加入'}
          </button>
        </div>
      </div>
    </div>
  )
}
