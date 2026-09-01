import type { Transaction } from '../../types'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/AppStore'
import { DEFAULT_CATEGORIES } from '../../services/category-svc'

// 单条账单卡片：点击跳转 /tx/:id（任务1 TR-1.1）
export default function BillCard({
  tx,
  showUser = false,
}: {
  tx: Transaction
  showUser?: boolean
}) {
  const nav = useNavigate()
  const { categories } = useAppStore()
  const catLib = categories.length ? categories : DEFAULT_CATEGORIES
  const cat = catLib.find((c) => c.id === tx.category)
  const icon = cat?.icon ?? '📦'
  const color = cat?.color ?? '#64748b'

  return (
    <div className="bill-card" role="button" onClick={() => nav(`/tx/${tx.id}`)}>
      {/* 圆形彩色背景图标 */}
      <span
        className="bill-icon"
        style={{ background: `${color}22`, color }}
      >
        {icon}
      </span>
      <div className="bill-main">
        <div className="bill-name">{cat?.name ?? '其他'}</div>
        <div className="bill-note">
          {tx.note || '无备注'}
          {showUser && tx.createdBy ? ` · ${tx.createdBy}` : ''}
        </div>
      </div>
      <span className={`bill-amount ${tx.type === 'expense' ? 'num-expense' : 'num-income'}`}>
        {tx.type === 'expense' ? '-' : '+'}
        {tx.amount.toFixed(2)}
      </span>
    </div>
  )
}
