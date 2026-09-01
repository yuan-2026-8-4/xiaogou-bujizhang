// 全局类型定义

// 收支类型：支出 / 收入
export type TransactionType = 'expense' | 'income'

// 账单记录
export interface Transaction {
  id: string
  ledgerId: string // 所属账本ID
  userId: string // 记录人ID
  amount: number // 金额（元）
  type: TransactionType // 收支类型
  category: string // 分类ID
  note: string // 备注
  date: string // 日期 YYYY-MM-DD
  createdBy?: string // 记录人昵称（协同账本显示）
  createdAt: string
}

// 账本
export interface Ledger {
  id: string
  name: string
  type: 'personal' | 'collaborative' // 个人 / 协同
  icon: string
  color: string
  monthStartDay: number // 月度起始日，默认1
  inviteCode?: string // 协同账本邀请码（6位数字）
  ownerId: string
  createdAt: string
  updatedAt?: string
}

// 分类
export interface Category {
  id: string
  ledgerId?: string // 账本专属分类；为空表示系统预设
  name: string
  icon: string // emoji 图标
  color: string
  type: TransactionType
}

// 用户资料
export interface Profile {
  id: string
  nickname: string
  avatarUrl?: string
  email?: string
}

// 自定义分类（系统预设或账本专属）
export interface UserCategory {
  id: string
  ledgerId?: string | null // 空表示系统预设
  name: string
  icon: string
  color: string
  type: TransactionType
  createdAt?: string
}

// 隐私锁
export interface PrivacyLock {
  userId: string
  pinHash: string
  fingerprintEnabled: boolean
  updatedAt?: string
}

// 月度预算（账本 × 月份唯一）
export interface LedgerBudget {
  id?: string
  ledgerId: string
  month: string // YYYY-MM
  amount: number
  createdBy?: string
  createdAt?: string
}

// 账本成员扩展信息（协同详情页使用）
export interface LedgerMember {
  userId: string
  nickname: string
  avatarUrl?: string
  role: 'owner' | 'admin' | 'member'
  joinedAt?: string
}

// 协同账本概览
export interface LedgerOverview {
  id: string
  name: string
  icon: string
  color: string
  type: 'personal' | 'collaborative'
  inviteCode?: string
  memberCount: number
  memberRole: 'owner' | 'admin' | 'member'
  todayActiveUsers: number
  todayTxCount: number
  monthExpense: number
}
