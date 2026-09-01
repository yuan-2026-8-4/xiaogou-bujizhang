import { budgetLevel } from '../../services/budget'

/** 任务7 手绘 SVG 11 段虚线环形图（不引入新包）：
 *  - 11 段灰虚线做底色
 *  - 按比例逐段覆盖（coverage=0..1），按阈值分蓝绿/黄/红三段色
 *  - strokeDasharray 一段一条圆层，offset 定位到对应段位置
 */
export default function BudgetRing({ used, budget, size = 180 }: { used: number; budget: number; size?: number }) {
  const stroke = 14
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const { level, percent } = budgetLevel(used, budget)

  const segments = 11
  const C = 2 * Math.PI * r
  const gap = 3
  const dash = (C - gap * segments) / segments
  const dashArray = `${dash} ${gap}`
  const totalLen = dash + gap

  // 颜色
  const colorSafe = '#2DD4BF'
  const colorSafe2 = '#14B8A6'
  const colorWarn = '#F59E0B'
  const colorDanger = '#EF4444'
  const colorBg = '#E2E8F0'

  function pickColor(i: number, pct: number): string {
    const warnAt = Math.floor(0.8 * segments)
    if (pct >= 1) return colorDanger
    if (i >= warnAt && pct >= 0.8) return colorWarn
    return i % 2 === 0 ? colorSafe : colorSafe2
  }

  // 构建每段绘制数据
  type SegDraw = { key: number; actualDash: number; offset: number; color: string }
  const draws: SegDraw[] = []
  for (let i = 0; i < segments; i++) {
    const segStart = i / segments
    const segEnd = (i + 1) / segments
    let coverage = 0
    if (segEnd <= percent) coverage = 1
    else if (segStart < percent) coverage = (percent - segStart) * segments
    if (coverage <= 0) continue
    draws.push({
      key: i,
      actualDash: dash * coverage,
      offset: -i * totalLen,
      color: pickColor(i, percent),
    })
  }

  const remain = budget ? Math.max(0, budget - used) : 0
  const remainText = budget ? `¥${remain.toFixed(0)}` : '未设'
  const pctClass: 'safe' | 'warn' | 'danger' = level

  return (
    <div className="b-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 背景 11 段 */}
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={colorBg} strokeWidth={stroke}
          strokeDasharray={dashArray} strokeLinecap="butt" transform={`rotate(-90 ${cx} ${cy})`}
        />
        {/* 逐段覆盖 */}
        {draws.map(({ key, actualDash, offset, color }) => {
          const pattern = `${actualDash} ${C - actualDash}`
          return (
            <circle
              key={key}
              cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={pattern} strokeDashoffset={offset}
              strokeLinecap="butt" transform={`rotate(-90 ${cx} ${cy})`}
            />
          )
        })}
      </svg>
      <div className={`ring-center ${pctClass}`}>
        <div className="remain">{remainText}</div>
        <div className="sub">{budget ? `已用 ${Math.round(percent * 100)}%` : '点击设置'}</div>
      </div>
    </div>
  )
}
