// 隐私锁服务：本地 Demo 模式用 localStorage；云端模式用 privacy_locks 表 + WebCrypto SHA-256 存 Base64 hash
import { supabase } from '../lib/supabase'
import type { PrivacyLock } from '../types'

const LOCK_KEY_PREFIX = 'demo:privacyLock:' // + userId
export const LOCK_TIMEOUT_MS = 3 * 60 * 1000 // 3 分钟

export async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  // Base64，避免二进制
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

export function demoKey(userId: string) { return LOCK_KEY_PREFIX + userId }

/** 查询当前用户是否已开启隐私锁 */
export async function fetchLock(userId: string, isDemoMode: boolean): Promise<PrivacyLock | null> {
  if (!userId) return null
  if (isDemoMode || !supabase) {
    const raw = localStorage.getItem(demoKey(userId))
    return raw ? (JSON.parse(raw) as PrivacyLock) : null
  }
  const { data } = await supabase.from('privacy_locks').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return null
  return {
    userId: (data as { user_id: string }).user_id,
    pinHash: (data as { pin_hash: string }).pin_hash,
    fingerprintEnabled: (data as { fingerprint_enabled: boolean }).fingerprint_enabled ?? false,
    updatedAt: (data as { updated_at?: string }).updated_at,
  }
}

/** 设置/重置 PIN（首次设置 & 修改密码都走这个；改密码前由 UI 先 verifyPin 通过） */
export async function setPin(userId: string, newPin: string, fingerprintEnabled: boolean, isDemoMode: boolean): Promise<{ error?: string }> {
  const pinHash = await hashPin(newPin)
  if (isDemoMode || !supabase) {
    const lock: PrivacyLock = { userId, pinHash, fingerprintEnabled, updatedAt: new Date().toISOString() }
    localStorage.setItem(demoKey(userId), JSON.stringify(lock))
    return {}
  }
  const row = { user_id: userId, pin_hash: pinHash, fingerprint_enabled: fingerprintEnabled }
  // upsert（因为 user_id 是 PK）
  const { error } = await supabase.from('privacy_locks').upsert(row, { onConflict: 'user_id' })
  if (error) return { error: error.message }
  return {}
}

/** 关闭隐私锁（只有已开才能关；verifyPin 通过后才调） */
export async function disableLock(userId: string, isDemoMode: boolean): Promise<{ error?: string }> {
  if (isDemoMode || !supabase) { localStorage.removeItem(demoKey(userId)); return {} }
  const { error } = await supabase.from('privacy_locks').delete().eq('user_id', userId)
  if (error) return { error: error.message }
  return {}
}

/** 校验 PIN（同时处理"忘记密码"流程无法通过此接口，忘记密码走任务6 UI 层提示"请删除本地数据或联系管理员"） */
export async function verifyPin(userId: string, pin: string, isDemoMode: boolean): Promise<boolean> {
  const lock = await fetchLock(userId, isDemoMode)
  if (!lock) return false
  return lock.pinHash === await hashPin(pin)
}

/** 会话内最后通过隐私锁校验的时间戳（任务6 idle 超时） */
export function getLastUnlockAt(userId: string): number {
  return Number(localStorage.getItem(`lock:unlock:${userId}`) || 0)
}
export function markUnlocked(userId: string) {
  localStorage.setItem(`lock:unlock:${userId}`, String(Date.now()))
}
export function clearUnlocked(userId: string) {
  localStorage.removeItem(`lock:unlock:${userId}`)
}
/** 当前会话是否仍在 3 分钟解锁窗口内 */
export function isStillUnlocked(userId: string): boolean {
  const t = getLastUnlockAt(userId)
  return t > 0 && (Date.now() - t) < LOCK_TIMEOUT_MS
}
