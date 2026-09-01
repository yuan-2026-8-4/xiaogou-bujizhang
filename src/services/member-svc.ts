// 账本成员服务（ledger_members + profiles 联表查询）：协同详情页用
import { supabase } from '../lib/supabase'
import type { LedgerMember, LedgerOverview } from '../types'

/** 账本成员列表（Demo 模式返回本地单用户假数据） */
export async function fetchMembers(ledgerId: string, demoUserId: string, demoNickname: string, isDemoMode: boolean): Promise<{ members: LedgerMember[]; error?: string }> {
  if (isDemoMode || !ledgerId) {
    return { members: [{ userId: demoUserId, nickname: demoNickname, role: 'owner' }] }
  }
  if (!supabase) return { members: [] }
  return await fetchMembers2(ledgerId)
}

async function fetchMembers2(ledgerId: string): Promise<{ members: LedgerMember[]; error?: string }> {
  if (!supabase) return { members: [] }
  const membersResp = await supabase
    .from('ledger_members').select('user_id,role,joined_at').eq('ledger_id', ledgerId)
  if (membersResp.error) return { members: [], error: membersResp.error.message }
  const rows = (membersResp.data ?? []) as Array<{ user_id: string; role: string; joined_at?: string }>
  const userIds = rows.map(r => r.user_id)
  const profilesResp = await supabase
    .from('profiles').select('id,nickname,avatar_url').in('id', userIds)
  const profiles: Record<string, { nickname?: string; avatar_url?: string }> = {}
  ;(profilesResp.data ?? []).forEach((p: Record<string, unknown>) => {
    profiles[p.id as string] = { nickname: p.nickname as string | undefined, avatar_url: p.avatar_url as string | undefined }
  })
  const members: LedgerMember[] = rows.map(r => ({
    userId: r.user_id,
    nickname: profiles[r.user_id]?.nickname ?? '成员',
    avatarUrl: profiles[r.user_id]?.avatar_url ?? undefined,
    role: (r.role as LedgerMember['role']) ?? 'member',
    joinedAt: r.joined_at,
  }))
  // owner 排首，再按加入时间
  members.sort((a, b) => {
    const rank = (r: string) => r === 'owner' ? 0 : r === 'admin' ? 1 : 2
    if (rank(a.role) !== rank(b.role)) return rank(a.role) - rank(b.role)
    return (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '')
  })
  return { members }
}

/** 移除成员（任务2 AC-7）；owner 自己不能移除自己，UI 要先校验。admin/member 由 owner/admin 移除 */
export async function removeMember(ledgerId: string, userId: string, isDemoMode: boolean): Promise<{ error?: string }> {
  if (isDemoMode || !supabase) return isDemoMode ? {} : { error: '未连接云端' }
  const { error } = await supabase.from('ledger_members').delete().eq('ledger_id', ledgerId).eq('user_id', userId)
  if (error) return { error: error.message }
  return {}
}

/** 转让 owner（通过 transfer_owner RPC） */
export async function transferOwner(ledgerId: string, newOwnerId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  const { error } = await supabase.rpc('transfer_owner', { p_ledger_id: ledgerId, p_new_owner_id: newOwnerId })
  if (error) return { error: error.message }
  return {}
}

/** 账本概览（任务2 AC-5/6：成员数、今日活跃、今日账单数、本月支出、我角色） */
export async function fetchLedgerOverview(
  ledgerId: string,
  myUserId: string,
  isDemoMode: boolean,
  monthRange: { start: string; end: string },
  localLedgers?: Array<{ id: string; name: string; icon?: string; color?: string; type: string; ownerId?: string; inviteCode?: string }>,
  localTxs?: Array<{ ledgerId: string; amount: number; type: 'income'|'expense'; date: string; createdBy?: string; userId?: string }>,
): Promise<{ overview?: LedgerOverview; error?: string }> {
  if (isDemoMode || !ledgerId) {
    const ledger = (localLedgers ?? []).find(l => l.id === ledgerId)
    if (!ledgerId) {
      return { overview: { id: 'demo', name: isDemoMode ? '示例账本' : '加载中', icon: '📒', color: '#14b8a6', type: 'personal', memberCount: 1, memberRole: 'owner', todayActiveUsers: 1, todayTxCount: 0, monthExpense: 0 } }
    }
    if (!ledger) {
      return { error: '账本不存在或您没有权限' }
    }
    const today = new Date().toISOString().slice(0, 10)
    const rows = (localTxs ?? []).filter(t => t.ledgerId === ledgerId)
    const todayRows = rows.filter(t => t.date === today)
    const activeUsers = new Set(todayRows.map(t => t.createdBy ?? t.userId ?? myUserId)).size
    const todayTxCount = todayRows.length
    const monthExpense = rows.filter(t => t.type === 'expense' && t.date >= monthRange.start && t.date <= monthRange.end)
      .reduce((s, t) => s + t.amount, 0)
    const memberCount = ledger?.type === 'collaborative' ? 3 : 1
    const memberRole: LedgerMember['role'] = (myUserId && ledger?.ownerId && myUserId !== ledger.ownerId) ? 'member' : 'owner'
    return {
      overview: {
        id: ledgerId,
        name: ledger.name,
        icon: ledger.icon ?? '📒',
        color: ledger.color ?? '#14b8a6',
        type: (ledger.type as 'personal'|'collaborative') ?? 'personal',
        inviteCode: ledger.inviteCode,
        memberCount,
        memberRole,
        todayActiveUsers: activeUsers || 1,
        todayTxCount,
        monthExpense,
      },
    }
  }
  if (!supabase) return { error: '未连接云端' }
  // 并行：成员、我角色、账本信息、今日账单、本月支出
  const today = new Date().toISOString().slice(0, 10)
  const [memResp, myResp, ledResp, todayTxResp, monthTxResp] = await Promise.all([
    supabase.from('ledger_members').select('user_id').eq('ledger_id', ledgerId),
    supabase.from('ledger_members').select('role').eq('ledger_id', ledgerId).eq('user_id', myUserId).maybeSingle(),
    supabase.from('ledgers').select('*').eq('id', ledgerId).single(),
    supabase.from('transactions').select('user_id,id').eq('ledger_id', ledgerId).eq('date', today),
    supabase.from('transactions').select('amount,type').eq('ledger_id', ledgerId).gte('date', monthRange.start).lte('date', monthRange.end).eq('type', 'expense'),
  ])
  if (ledResp.error || !ledResp.data) return { error: ledResp.error?.message ?? '账本不存在' }
  const members = (memResp.data ?? []) as Array<{ user_id: string }>
  const role: LedgerMember['role'] = (myResp.data as { role?: string } | null)?.role as LedgerMember['role'] ?? 'member'
  const todayRows = (todayTxResp.data ?? []) as Array<{ user_id: string; id: string }>
  const activeUsers = new Set(todayRows.map(r => r.user_id)).size
  const todayTxCount = todayRows.length
  const monthExpense = ((monthTxResp.data ?? []) as Array<{ amount: string | number }>).reduce((s, r) => s + Number(r.amount), 0)
  const ledger = ledResp.data as Record<string, unknown>
  return {
    overview: {
      id: String(ledger.id),
      name: String(ledger.name),
      icon: String(ledger.icon ?? '📒'),
      color: String(ledger.color ?? '#14b8a6'),
      type: (ledger.type as LedgerOverview['type']) ?? 'personal',
      inviteCode: (ledger.invite_code as string | null) ?? undefined,
      memberCount: members.length,
      memberRole: role,
      todayActiveUsers: activeUsers,
      todayTxCount,
      monthExpense,
    },
  }
}
