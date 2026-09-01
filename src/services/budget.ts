// 预算服务：ledger_budgets 表（云端）+ localStorage（Demo）
import { supabase } from '../lib/supabase'
import type { LedgerBudget } from '../types'

const DEMO_KEY_PREFIX = 'demo:budgets:' // + ledgerId

export function thisMonthKey(): string {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function readDemo(ledgerId: string): LedgerBudget[] {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY_PREFIX + ledgerId) || '[]') as LedgerBudget[] } catch { return [] }
}
function writeDemo(ledgerId: string, list: LedgerBudget[]) {
  localStorage.setItem(DEMO_KEY_PREFIX + ledgerId, JSON.stringify(list))
}

/** 获取某账本指定月份的预算 */
export async function fetchBudget(ledgerId: string, month: string, isDemoMode: boolean): Promise<LedgerBudget | null> {
  if (!ledgerId) return null
  if (isDemoMode || !supabase) {
    return readDemo(ledgerId).find(b => b.month === month) ?? null
  }
  const { data, error } = await supabase
    .from('ledger_budgets')
    .select('*')
    .eq('ledger_id', ledgerId)
    .eq('month', month)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: (data as { id: string }).id,
    ledgerId: (data as { ledger_id: string }).ledger_id,
    month: (data as { month: string }).month,
    amount: Number((data as { amount: number | string }).amount),
    createdBy: (data as { created_by?: string }).created_by,
    createdAt: (data as { created_at?: string }).created_at,
  }
}

/** 设置预算（存在就覆写，利用 unique(ledger_id, month)） */
export async function setBudget(b: LedgerBudget, isDemoMode: boolean): Promise<{ budget?: LedgerBudget; error?: string }> {
  if (isDemoMode || !supabase) {
    const list = readDemo(b.ledgerId).filter(x => x.month !== b.month)
    const saved: LedgerBudget = { ...b, id: 'demo-' + b.ledgerId + '-' + b.month }
    list.push(saved); writeDemo(b.ledgerId, list)
    return { budget: saved }
  }
  const row = {
    ledger_id: b.ledgerId,
    month: b.month,
    amount: b.amount,
    created_by: b.createdBy,
  }
  // upsert（按 ledger_id,month 冲突则更新 amount）
  const { data, error } = await supabase
    .from('ledger_budgets')
    .upsert(row, { onConflict: 'ledger_id,month' })
    .select().single()
  if (error || !data) return { error: error?.message ?? '保存预算失败' }
  return {
    budget: {
      id: (data as { id: string }).id,
      ledgerId: (data as { ledger_id: string }).ledger_id,
      month: (data as { month: string }).month,
      amount: Number((data as { amount: number | string }).amount),
      createdBy: (data as { created_by?: string }).created_by,
      createdAt: (data as { created_at?: string }).created_at,
    },
  }
}

/** 删除某月预算 */
export async function removeBudget(ledgerId: string, month: string, isDemoMode: boolean): Promise<{ error?: string }> {
  if (isDemoMode || !supabase) {
    writeDemo(ledgerId, readDemo(ledgerId).filter(x => x.month !== month))
    return {}
  }
  const { error } = await supabase
    .from('ledger_budgets').delete().eq('ledger_id', ledgerId).eq('month', month)
  if (error) return { error: error.message }
  return {}
}

/** 预算分级：蓝绿/黄/红 三色阈值（任务7 AC-14） */
export function budgetLevel(used: number, budget: number): { level: 'safe' | 'warn' | 'danger'; percent: number } {
  if (!budget || budget <= 0) return { level: 'safe', percent: 0 }
  const percent = Math.min(1, used / budget)
  if (percent >= 1) return { level: 'danger', percent }
  if (percent >= 0.8) return { level: 'warn', percent }
  return { level: 'safe', percent }
}
