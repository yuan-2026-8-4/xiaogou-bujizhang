// 分类服务（user_categories 表）：系统预设 + 账本自定义，双模式（云端 / 本地 Demo）
import { supabase } from '../lib/supabase'
import type { TransactionType, UserCategory } from '../types'

/** 系统预设分类（ledgerId = null，作为 Demo 模式和账本默认底库） */
export const DEFAULT_CATEGORIES: UserCategory[] = [
  // 支出
  { id: 'exp-food',    name: '餐饮',   icon: '🍜', color: '#f97316', type: 'expense' },
  { id: 'exp-shop',    name: '购物',   icon: '🛍️', color: '#ec4899', type: 'expense' },
  { id: 'exp-transport', name: '交通', icon: '🚗', color: '#3b82f6', type: 'expense' },
  { id: 'exp-bill',    name: '账单',   icon: '💡', color: '#ef4444', type: 'expense' },
  { id: 'exp-entertainment', name: '娱乐', icon: '🎬', color: '#a855f7', type: 'expense' },
  { id: 'exp-medical', name: '医疗',   icon: '💊', color: '#10b981', type: 'expense' },
  { id: 'exp-edu',     name: '学习',   icon: '📚', color: '#0ea5e9', type: 'expense' },
  { id: 'exp-housing', name: '居家',   icon: '🏠', color: '#8b5cf6', type: 'expense' },
  { id: 'exp-travel',  name: '旅行',   icon: '✈️', color: '#06b6d4', type: 'expense' },
  { id: 'exp-other',   name: '其他支出', icon: '💸', color: '#64748b', type: 'expense' },
  // 收入
  { id: 'inc-salary',  name: '工资',   icon: '💰', color: '#10b981', type: 'income' },
  { id: 'inc-bonus',   name: '奖金',   icon: '🎁', color: '#14b8a6', type: 'income' },
  { id: 'inc-invest',  name: '理财',   icon: '📈', color: '#22d3ee', type: 'income' },
  { id: 'inc-parttime',name: '兼职',   icon: '💼', color: '#84cc16', type: 'income' },
  { id: 'inc-redpacket',name:'红包',    icon: '🧧', color: '#f43f5e', type: 'income' },
  { id: 'inc-refund',  name: '退款',   icon: '🔄', color: '#059669', type: 'income' },
  { id: 'inc-other',   name: '其他收入', icon: '✅', color: '#64748b', type: 'income' },
]

const DEMO_KEY = 'demo:categories'
function readDemo(): UserCategory[] {
  try { const raw = localStorage.getItem(DEMO_KEY); if (raw) return JSON.parse(raw) as UserCategory[] } catch {}
  localStorage.setItem(DEMO_KEY, JSON.stringify(DEFAULT_CATEGORIES))
  return [...DEFAULT_CATEGORIES]
}
function writeDemo(list: UserCategory[]) { localStorage.setItem(DEMO_KEY, JSON.stringify(list)) }

function rowToCat(r: Record<string, unknown>): UserCategory {
  return {
    id: String(r.id),
    ledgerId: (r.ledger_id as string | undefined | null) ?? null,
    name: String(r.name),
    icon: String(r.icon ?? '📦'),
    color: String(r.color ?? '#64748b'),
    type: r.type as TransactionType,
    createdAt: (r.created_at as string | undefined),
  }
}

/** 获取账本可用分类：系统预设(ledgerId=null) + 该账本自定义 */
export async function fetchCategories(ledgerId: string, isDemoMode: boolean): Promise<{ categories: UserCategory[]; error?: string }> {
  if (isDemoMode || !supabase) return { categories: readDemo() }
  const { data, error } = await supabase
    .from('user_categories')
    .select('*')
    .or(`ledger_id.is.null,ledger_id.eq.${ledgerId}`)
  if (error) return { categories: [], error: error.message }
  // 系统预设在前，自定义在后
  const rows = (data as Record<string, unknown>[] | null) ?? []
  return { categories: rows.map(rowToCat) }
}

export async function createCategory(cat: UserCategory, isDemoMode: boolean): Promise<{ category?: UserCategory; error?: string }> {
  if (isDemoMode || !supabase) {
    const list = readDemo()
    if (list.some(c => c.id === cat.id)) return { error: '分类ID已存在' }
    const saved: UserCategory = { ...cat }
    list.push(saved); writeDemo(list)
    return { category: saved }
  }
  const payload = {
    id: cat.id,
    ledger_id: cat.ledgerId ?? null,
    name: cat.name, icon: cat.icon, color: cat.color, type: cat.type,
  }
  const { data, error } = await supabase.from('user_categories').insert(payload).select().single()
  if (error || !data) return { error: error?.message ?? '创建分类失败' }
  return { category: rowToCat(data as Record<string, unknown>) }
}

export async function updateCategory(id: string, patch: Partial<Pick<UserCategory, 'name'|'icon'|'color'>>, isDemoMode: boolean): Promise<{ category?: UserCategory; error?: string }> {
  if (isDemoMode || !supabase) {
    const list = readDemo(); const idx = list.findIndex(c => c.id === id); if (idx < 0) return { error: '分类不存在' }
    const saved: UserCategory = { ...list[idx], ...patch }; list[idx] = saved; writeDemo(list)
    return { category: saved }
  }
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.icon !== undefined) payload.icon = patch.icon
  if (patch.color !== undefined) payload.color = patch.color
  const { data, error } = await supabase.from('user_categories').update(payload).eq('id', id).select().single()
  if (error || !data) return { error: error?.message ?? '更新分类失败' }
  return { category: rowToCat(data as Record<string, unknown>) }
}

/** 删除分类，可选指定迁移分类 ID（迁移相关账单，任务5 AC-11.3）；migrateToId 为 null 时不迁移，由上游 UI 提示 */
export async function deleteCategory(id: string, migrateToId: string | null, isDemoMode: boolean, ledgerId: string): Promise<{ error?: string }> {
  if (isDemoMode || !supabase) {
    const list = readDemo().filter(c => c.id !== id); writeDemo(list)
    if (migrateToId) {
      const txs: { id: string; category: string }[] = JSON.parse(localStorage.getItem('demo:transactions') || '[]')
      const next = txs.map(t => t.category === id ? { ...t, category: migrateToId } : t)
      localStorage.setItem('demo:transactions', JSON.stringify(next))
    }
    return {}
  }
  if (migrateToId) {
    // 迁移该账本下的 transactions（分类名是 user_categories.id；我们用 id 字符串作为 category 列值）
    const { error: upErr } = await supabase
      .from('transactions')
      .update({ category: migrateToId })
      .eq('ledger_id', ledgerId)
      .eq('category', id)
    if (upErr) return { error: '迁移账单失败: ' + upErr.message }
  }
  const { error } = await supabase.from('user_categories').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}
