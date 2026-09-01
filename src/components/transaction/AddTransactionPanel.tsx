import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { DEFAULT_CATEGORIES } from '../../config/categories'
import { useAppStore } from '../../store/AppStore'
import type { TransactionType } from '../../types'

// 快速记账面板：严格按参考图2（用户提供的图1）
// 标题居中、支出/收入下划线切换、4×3 分类网格、底部青色保存按钮
export default function AddTransactionPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { addTransaction, currentLedgerId } = useAppStore()
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORIES[0].id)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))

  const categories = useMemo(
    () => DEFAULT_CATEGORIES.filter((c) => c.type === type),
    [type],
  )

  if (!open) return null

  // 数字键盘按键
  const press = (key: string) => {
    if (key === 'back') {
      setAmount((a) => a.slice(0, -1))
      return
    }
    if (key === '.') {
      if (!amount || amount.includes('.')) return
      setAmount((a) => a + '.')
      return
    }
    if (/^\d$/.test(key)) {
      setAmount((a) => {
        const next = a + key
        if (next.split('.')[0].length > 7) return a
        if (next.split('.')[1]?.length > 2) return a
        return next
      })
    }
  }

  const switchType = (t: TransactionType) => {
    setType(t)
    setCategoryId(DEFAULT_CATEGORIES.find((c) => c.type === t)!.id)
  }

  const save = async () => {
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    const { error } = await addTransaction({
      ledgerId: currentLedgerId,
      amount: val,
      type,
      category: categoryId,
      note,
      date,
    })
    if (error) {
      alert('保存失败：' + error)
      return
    }
    setAmount('')
    setNote('')
    setType('expense')
    setCategoryId(DEFAULT_CATEGORIES[0].id)
    onClose()
  }

  const keys: string[][] = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['.', '0', 'back'],
  ]

  return (
    <>
      <div className="panel-mask" onClick={onClose} />
      <div className="add-panel">
        {/* 标题居中，右上角× */}
        <div className="add-panel-head">
          <span className="add-panel-title">快速记账</span>
          <button className="add-panel-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 大字号金额 */}
        <div className="add-amount-row">
          <div className="add-amount">
            <span className="add-amount-cny">¥</span>
            <span>{amount || '0'}</span>
          </div>
        </div>

        {/* 支出/收入 下划线切换 */}
        <div className="add-type-tabs">
          <button
            className={type === 'expense' ? 'active' : ''}
            onClick={() => switchType('expense')}
          >
            支出
          </button>
          <button
            className={type === 'income' ? 'active' : ''}
            onClick={() => switchType('income')}
          >
            收入
          </button>
        </div>

        {/* 分类网格 4×3 */}
        <div className="add-cats">
          {categories.map((c) => (
            <button
              key={c.id}
              className={`cat-item${categoryId === c.id ? ' active' : ''}`}
              onClick={() => setCategoryId(c.id)}
            >
              <span
                className="cat-icon"
                style={{ background: `${c.color}1f`, color: c.color }}
              >
                {c.icon}
              </span>
              <span className="cat-name">{c.name}</span>
            </button>
          ))}
        </div>

        {/* 日期与备注 */}
        <div className="add-extra">
          <input
            className="add-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            className="add-note"
            type="text"
            placeholder="备注（选填）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* 自定义数字键盘 */}
        <div className="num-keyboard">
          {keys.map((row, i) => (
            <div className="num-row" key={i}>
              {row.map((k) => (
                <button key={k} className="num-key" onClick={() => press(k)}>
                  {k === 'back' ? '⌫' : k}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* 保存按钮 */}
        <button className="btn-primary" onClick={save}>
          保存
        </button>
      </div>
    </>
  )
}
