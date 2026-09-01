import { NavLink } from 'react-router-dom'

// 底部导航：首页 / 协作 / 中间青色圆形加号 / 统计 / 我的
// 加号按钮带绿色光晕，对应参考图样式
export default function TabBar({ onAdd }: { onAdd: () => void }) {
  const item = (to: string, icon: string, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
      end={to === '/'}
    >
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
    </NavLink>
  )

  return (
    <nav className="tab-bar">
      {item('/', '🏠', '首页')}
      {item('/collab', '👥', '协作')}
      <button className="tab-add" onClick={onAdd} aria-label="记账">
        ＋
      </button>
      {item('/stats', '📊', '统计')}
      {item('/settings', '👤', '我的')}
    </nav>
  )
}
