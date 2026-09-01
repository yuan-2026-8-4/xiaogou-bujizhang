import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import CollaborationPage from './pages/CollaborationPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import LedgerPage from './pages/LedgerPage'
import CalendarPage from './pages/CalendarPage'
import TransactionDetailPage from './pages/TransactionDetailPage'
import CollabLedgerDetailPage from './pages/CollabLedgerDetailPage'
import CategoryManagePage from './pages/CategoryManagePage'
import PrivacyLockPage from './pages/PrivacyLockPage'
import BudgetPage from './pages/BudgetPage'

// 路由：登录页独立；其余页面带底部导航
// 底部 tab：首页 / 协作 / [+] / 统计 / 我的
export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/collab" element={<CollaborationPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        {/* 第一阶段新增 5 条路由 */}
        <Route path="/tx/:id" element={<TransactionDetailPage />} />
        <Route path="/collab/:ledgerId" element={<CollabLedgerDetailPage />} />
        <Route path="/settings/categories" element={<CategoryManagePage />} />
        <Route path="/settings/privacy-lock" element={<PrivacyLockPage />} />
        <Route path="/budget" element={<BudgetPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
