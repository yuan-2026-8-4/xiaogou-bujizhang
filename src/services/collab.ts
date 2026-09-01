import { supabase } from '../lib/supabase'
import type { Ledger } from '../types'

// 协同服务：创建协同账本（自动生成邀请码）/ 邀请码加入 / 成员管理

// 创建协同账本：数据库 RPC 原子完成（建账本 + 生成邀请码 + 把自己加为 owner）
// 详见 supabase/schema.sql 的 create_collab_ledger 函数
export async function createCollabLedger(
  name: string,
  icon: string,
): Promise<{ ledger?: Ledger; error?: string }> {
  if (!supabase) return { error: '未连接云端' }

  const { data, error } = await supabase.rpc('create_collab_ledger', {
    p_name: name,
    p_icon: icon,
  })

  if (error) {
    return { error: error.message.includes('邀请码生成冲突') ? '邀请码生成冲突，请重试' : error.message }
  }

  const row = (data as { ledger_id: string; code: string }[] | null)?.[0]
  if (!row) return { error: '创建失败，请重试' }

  const ledger: Ledger = {
    id: row.ledger_id,
    name,
    type: 'collaborative',
    icon,
    color: '#14b8a6',
    monthStartDay: 1,
    inviteCode: row.code,
    ownerId: '',
    createdAt: new Date().toISOString(),
  }
  return { ledger }
}

// 通过邀请码加入协同账本
export async function joinByInviteCode(code: string, userId: string): Promise<{ ledgerName?: string; error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  if (!/^\d{6}$/.test(code)) return { error: '请输入 6 位数字邀请码' }

  // 1. 查邀请码对应的账本（RPC 函数，见 schema.sql）
  const { data: ledgerId, error: rpcErr } = await supabase.rpc('find_ledger_by_invite_code', { p_code: code })
  if (rpcErr) return { error: rpcErr.message }
  if (!ledgerId) return { error: '邀请码无效，请向账本创建者确认' }

  // 2. 已是成员？
  const { data: existing } = await supabase
    .from('ledger_members')
    .select('ledger_id')
    .eq('ledger_id', ledgerId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return { error: '你已在该协同账本中' }

  // 3. 把自己插为成员（RLS 允许插入自己）
  const { error: joinErr } = await supabase
    .from('ledger_members')
    .insert({ ledger_id: ledgerId, user_id: userId, role: 'member' })
  if (joinErr) return { error: '加入失败：' + joinErr.message }

  const { data: ledger } = await supabase.from('ledgers').select('name').eq('id', ledgerId).single()
  return { ledgerName: ledger?.name ?? '协同账本' }
}

// 查询账本成员（昵称 + 角色）
export type MemberInfo = { userId: string; nickname: string; role: string }

export async function fetchMembers(ledgerId: string): Promise<MemberInfo[]> {
  if (!supabase) return []
  const { data } = await supabase.rpc('get_ledger_members', { p_ledger_id: ledgerId })
  return (data ?? []).map((m: { user_id: string; nickname: string; role: string }) => ({
    userId: m.user_id,
    nickname: m.nickname,
    role: m.role,
  }))
}

// 移除成员（仅 owner/admin 有权限，RLS 兜底）
export async function removeMember(ledgerId: string, memberUserId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  const { error } = await supabase
    .from('ledger_members')
    .delete()
    .eq('ledger_id', ledgerId)
    .eq('user_id', memberUserId)
  if (error) return { error: error.message }
  return {}
}

// 退出协同账本（自己退出）
export async function leaveLedger(ledgerId: string, userId: string): Promise<{ error?: string }> {
  return removeMember(ledgerId, userId)
}
