import type { Category } from '../types'

// 系统预设分类（每个账本默认使用，账本可在此基础上自定义增删改）
// 图标使用 emoji（免费可商用），正式上架可替换为图标库
export const DEFAULT_CATEGORIES: Category[] = [
  // ---- 支出分类 ----
  { id: 'exp-food', name: '餐饮', icon: '🍜', color: '#f97316', type: 'expense' },
  { id: 'exp-transport', name: '交通', icon: '🚗', color: '#3b82f6', type: 'expense' },
  { id: 'exp-shopping', name: '购物', icon: '🛍️', color: '#ec4899', type: 'expense' },
  { id: 'exp-housing', name: '住房', icon: '🏠', color: '#8b5cf6', type: 'expense' },
  { id: 'exp-entertainment', name: '娱乐', icon: '🎮', color: '#f59e0b', type: 'expense' },
  { id: 'exp-medical', name: '医疗', icon: '💊', color: '#ef4444', type: 'expense' },
  { id: 'exp-education', name: '教育', icon: '📚', color: '#06b6d4', type: 'expense' },
  { id: 'exp-communication', name: '通讯', icon: '📱', color: '#6366f1', type: 'expense' },
  { id: 'exp-social', name: '人情', icon: '🎁', color: '#f43f5e', type: 'expense' },
  { id: 'exp-daily', name: '日用', icon: '🧴', color: '#0891b2', type: 'expense' },
  { id: 'exp-travel', name: '旅行', icon: '✈️', color: '#0ea5e9', type: 'expense' },
  { id: 'exp-other', name: '其他', icon: '📦', color: '#64748b', type: 'expense' },
  // ---- 收入分类 ----
  { id: 'inc-salary', name: '工资', icon: '💼', color: '#10b981', type: 'income' },
  { id: 'inc-bonus', name: '奖金', icon: '🏆', color: '#f59e0b', type: 'income' },
  { id: 'inc-redpacket', name: '红包', icon: '🧧', color: '#ef4444', type: 'income' },
  { id: 'inc-invest', name: '理财', icon: '📈', color: '#06b6d4', type: 'income' },
  { id: 'inc-parttime', name: '兼职', icon: '💻', color: '#8b5cf6', type: 'income' },
  { id: 'inc-other', name: '其他', icon: '💰', color: '#64748b', type: 'income' },
]
