import { supabase, isSupabaseReady } from '../lib/supabase'
import type { Profile } from '../types'

// 认证服务：邮箱注册 / 登录 / 登出 / 会话监听 / 账号注销

export { isSupabaseReady }

// 获取当前会话（返回 null 表示未登录）
export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

// 邮箱注册。注册成功自动登录（若项目开启了邮箱确认，则需先去邮箱点验证链接）
export async function signUp(email: string, password: string) {
  if (!supabase) return { error: '尚未配置 Supabase，请先按指引完成配置' }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: translateAuthError(error.message) }
  // needsConfirmation：用户已创建但无会话 → 说明需要邮箱验证
  const needsConfirmation = !data.session
  return { needsConfirmation }
}

// 邮箱登录
export async function signIn(email: string, password: string) {
  if (!supabase) return { error: '尚未配置 Supabase，请先按指引完成配置' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: translateAuthError(error.message) }
  return {}
}

// 登出
export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

// 读取用户档案（昵称等）；档案不存在时自动补建
export async function getProfile(userId: string, fallbackEmail?: string): Promise<Profile> {
  if (!supabase) return { id: userId, nickname: '我' }
  const { data } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (data) {
    return {
      id: data.id,
      nickname: data.nickname ?? '我',
      avatarUrl: data.avatar_url ?? undefined,
      email: fallbackEmail,
    }
  }
  // 档案缺失（老账号）：补建
  await supabase.from('profiles').upsert({ id: userId })
  return { id: userId, nickname: '我', email: fallbackEmail }
}

// 修改昵称
export async function updateNickname(userId: string, nickname: string) {
  if (!supabase) return
  await supabase.from('profiles').update({ nickname }).eq('id', userId)
}

// 注销账号：删除云端全部个人数据（账本/账单/成员/档案），然后登出
export async function deleteAccount() {
  if (!supabase) return
  // delete_own_account 是 SECURITY DEFINER 函数，见 supabase/schema.sql
  await supabase.rpc('delete_own_account')
  await signOut()
}

// 监听登录状态变化（刷新页面后自动恢复登录态）
export function onAuthChange(cb: (loggedIn: boolean) => void) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(Boolean(session))
  })
  return () => data.subscription.unsubscribe()
}

// 常见认证错误翻译成中文
function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return '邮箱或密码不正确'
  if (m.includes('already registered')) return '该邮箱已注册，请直接登录'
  if (m.includes('rate limit')) return '操作太频繁，请稍后再试'
  if (m.includes('password') && m.includes('short')) return '密码至少 6 位'
  if (m.includes('email not confirmed')) return '请先到邮箱点击验证邮件，再登录'
  if (m.includes('failed to fetch')) return '网络连接失败，请检查网络'
  return msg
}
