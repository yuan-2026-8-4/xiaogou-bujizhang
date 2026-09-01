import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'
import AddTransactionPanel from '../transaction/AddTransactionPanel'
import PrivacyGate from './PrivacyGate'

// 整体布局：PrivacyGate(隐私锁全覆盖) → 页面内容 + 底部导航 + 全局记账面板
export default function AppLayout() {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className="app-shell">
      <PrivacyGate>
        <div className="app-content">
          <Outlet />
        </div>
        <TabBar onAdd={() => setPanelOpen(true)} />
        <AddTransactionPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </PrivacyGate>
    </div>
  )
}
