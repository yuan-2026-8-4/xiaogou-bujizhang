import { supabase } from '../lib/supabase'
import type { Ledger, Transaction, TransactionType } from '../types'
import type { NewLedger, NewTransaction } from '../store/AppStore'

// 数据服务：账本 / 账单 的云端读写（数据库 snake_case ↔ 前端 camelCase 映射）

// ---------- 行映射 ----------

type LedgerRow = {
  id: string
  name: string
  type: 'personal' | 'collaborative'
  icon: string | null
  color: string | null
  monthly_start_day: number
  invite_code: string | null
  created_by: string
  created_at: string
}

function rowToLedger(r: LedgerRow & { updated_at?: string }): Ledger {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    icon: r.icon ?? '📒',
    color: r.color ?? '#14b8a6',
    monthStartDay: r.monthly_start_day ?? 1,
    inviteCode: r.invite_code ?? undefined,
    ownerId: r.created_by,
    createdAt: r.created_at,
    updatedAt: (r as { updated_at?: string }).updated_at,
  }
}

type TxRow = {
  id: string
  ledger_id: string
  user_id: string
  amount: string | number
  type: TransactionType
  category: string
  date: string
  note: string | null
  created_at: string
}

function rowToTx(r: TxRow): Transaction {
  return {
    id: r.id,
    ledgerId: r.ledger_id,
    userId: r.user_id,
    amount: Number(r.amount),
    type: r.type,
    category: r.category,
    date: r.date,
    note: r.note ?? '',
    createdAt: r.created_at,
  }
}

// ---------- 账本 ----------

// 拉取当前用户所有账本（通过成员关系）
export async function fetchLedgers(): Promise<{ ledgers: Ledger[]; error?: string }> {
  if (!supabase) return { ledgers: [] }
  const { data, error } = await supabase
    .from('ledger_members')
    .select('ledgers(*)')
    .order('joined_at', { ascending: true })
  if (error) return { ledgers: [], error: error.message }

  // join 查询返回 { ledgers: LedgerRow | LedgerRow[] | null }，统一按单对象处理
  const rows = (data ?? []).map((row: unknown) => {
    const r = row as { ledgers: LedgerRow | LedgerRow[] | null }
    return Array.isArray(r.ledgers) ? r.ledgers[0] : r.ledgers
  })
  const ledgers = rows.filter((r): r is LedgerRow => Boolean(r)).map(rowToLedger)
  return { ledgers }
}

// 新建账本（个人）。协同账本请用 collab.ts 的 createCollabLedger
export async function insertLedger(data: NewLedger, userId: string): Promise<{ ledger?: Ledger; error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  const { data: row, error } = await supabase
    .from('ledgers')
    .insert({
      name: data.name,
      type: data.type,
      icon: data.icon ?? '📒',
      color: data.color ?? '#14b8a6',
      created_by: userId,
    })
    .select()
    .single()
  if (error || !row) return { error: error?.message ?? '创建失败' }

  // 把自己加为 owner
  await supabase.from('ledger_members').insert({ ledger_id: row.id, user_id: userId, role: 'owner' })
  return { ledger: rowToLedger(row as LedgerRow) }
}

// 删除账本（仅 owner 有权限，RLS 兜底）
export async function removeLedger(ledgerId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  const { error } = await supabase.from('ledgers').delete().eq('id', ledgerId)
  if (error) return { error: error.message }
  return {}
}

// 编辑账本元信息（任务2 / 任务4）
export async function updateLedger(
  ledgerId: string,
  patch: Partial<Pick<Ledger, 'name' | 'icon' | 'color' | 'monthStartDay'>>,
): Promise<{ ledger?: Ledger; error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.icon !== undefined) payload.icon = patch.icon
  if (patch.color !== undefined) payload.color = patch.color
  if (patch.monthStartDay !== undefined) payload.monthly_start_day = patch.monthStartDay
  const { data: row, error } = await supabase
    .from('ledgers')
    .update(payload)
    .eq('id', ledgerId)
    .select()
    .single()
  if (error || !row) return { error: error?.message ?? '更新账本失败' }
  return { ledger: rowToLedger(row as LedgerRow) }
}

// ---------- 账单 ----------

// 拉取多个账本的账单（按日期倒序）
export async function fetchTransactions(ledgerIds: string[]): Promise<{ transactions: Transaction[]; error?: string }> {
  if (!supabase || ledgerIds.length === 0) return { transactions: [] }
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .in('ledger_id', ledgerIds)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) return { transactions: [], error: error.message }
  return { transactions: (data ?? []).map(rowToTx) }
}

// 记一笔账
export async function insertTransaction(tx: NewTransaction, userId: string): Promise<{ transaction?: Transaction; error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  const { data: row, error } = await supabase
    .from('transactions')
    .insert({
      ledger_id: tx.ledgerId,
      user_id: userId,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      date: tx.date,
      note: tx.note || null,
    })
    .select()
    .single()
  if (error || !row) return { error: error?.message ?? '保存失败' }
  return { transaction: rowToTx(row as TxRow) }
}

// 删除账单
export async function removeTransaction(txId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  const { error } = await supabase.from('transactions').delete().eq('id', txId)
  if (error) return { error: error.message }
  return {}
}

// 编辑账单（任务1）
export async function updateTransaction(
  txId: string,
  patch: Partial<Pick<Transaction, 'amount' | 'type' | 'category' | 'date' | 'note'>>,
): Promise<{ transaction?: Transaction; error?: string }> {
  if (!supabase) return { error: '未连接云端' }
  const payload: Record<string, unknown> = {}
  if (patch.amount !== undefined) payload.amount = patch.amount
  if (patch.type !== undefined) payload.type = patch.type
  if (patch.category !== undefined) payload.category = patch.category
  if (patch.date !== undefined) payload.date = patch.date
  if (patch.note !== undefined) payload.note = patch.note || null
  const { data: row, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', txId)
    .select()
    .single()
  if (error || !row) return { error: error?.message ?? '编辑失败' }
  return { transaction: rowToTx(row as TxRow) }
}

// ---------- 实时订阅（多人协同核心） ----------

// 订阅账单表变更：家庭其他人记一笔，你这边立即出现
export function subscribeTransactions(
  ledgerIds: string[],
  onInsert: (tx: Transaction) => void,
  onDelete: (txId: string) => void,
): () => void {
  const client = supabase
  if (!client || ledgerIds.length === 0) return () => {}
  const channel = client
    .channel(`tx-${ledgerIds.join('-').slice(0, 40)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transactions', filter: `ledger_id=in.(${ledgerIds.join(',')})` },
      (payload) => onInsert(rowToTx(payload.new as TxRow)),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'transactions', filter: `ledger_id=in.(${ledgerIds.join(',')})` },
      (payload) => onDelete((payload.old as { id: string }).id),
    )
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}
