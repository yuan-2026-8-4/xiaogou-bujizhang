import { createClient } from '@supabase/supabase-js'

// 从环境变量读取 Supabase 配置（.env 文件，见 .env.example）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 未配置 Supabase 时为 null，前端使用本地模拟数据跑通界面；
// 用户按指引配置 .env 后自动切换为真实云端数据
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

// 判断当前是否已连接 Supabase
export const isSupabaseReady = Boolean(supabase)
