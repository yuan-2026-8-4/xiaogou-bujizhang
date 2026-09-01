import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import { deleteAccount, updateNickname } from '../services/auth'
import PrivacyPolicyModal from '../components/PrivacyPolicyModal'

// 设置页：蓝绿色渐变顶部 + 用户卡片 + 设置列表
export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, profile, isDemoMode, signOut, privacyEnabled } = useAppStore()
  const [showPolicy, setShowPolicy] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [editName, setEditName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const items = [
    { icon: '🔐', label: '账号与安全', hint: isDemoMode ? '未登录' : user?.email ?? '', action: () => !isDemoMode && navigate('/auth') },
    { icon: '🔒', label: '隐私锁', hint: privacyEnabled ? '已开启' : '未开启', action: () => navigate('/settings/privacy-lock') },
    { icon: '📂', label: '分类管理', hint: '自定义支出/收入分类', action: () => navigate('/settings/categories') },
    { icon: '📅', label: '月度起始日', hint: '每月1号', action: () => {} },
    { icon: '💱', label: '货币符号', hint: '¥ 人民币', action: () => {} },
    { icon: '📄', label: '用户协议与隐私政策', hint: '', action: () => setShowPolicy(true) },
    { icon: 'ℹ️', label: '关于我们', hint: 'v0.2.0', action: () => setShowPolicy(true) },
  ]

  // 退出登录
  const handleSignOut = async () => {
    if (!window.confirm('确定退出登录吗？')) return
    await signOut()
    navigate('/auth')
  }

  // 账号注销（删除云端全部数据，不可恢复）
  const handleDeleteAccount = async () => {
    if (!window.confirm('注销后，云端所有账本、账单和个人数据将被永久删除且无法恢复。确定继续吗？')) return
    if (!window.confirm('再次确认：真的要注销账号吗？')) return
    await deleteAccount()
    alert('账号已注销，云端数据已删除')
    navigate('/auth')
  }

  // 修改昵称
  const saveNickname = async () => {
    const name = nameInput.trim()
    if (!name || !user) return
    await updateNickname(user.id, name)
    window.location.reload()
  }

  return (
    <div className="page settings-page">
      {/* 顶部渐变区域 + 用户卡片 */}
      <div className="settings-hero">
        <div style={{ fontSize: 17, fontWeight: 600, color: '#fff', marginBottom: 16 }}>我的</div>
        <div className="settings-user">
          <div className="settings-avatar">🐶</div>
          <div>
            {editName ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="field"
                  style={{ padding: '6px 10px', fontSize: 14, width: 140 }}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="输入昵称"
                  maxLength={12}
                  autoFocus
                />
                <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={saveNickname}>
                  保存
                </button>
                <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setEditName(false)}>
                  取消
                </button>
              </div>
            ) : (
              <div className="settings-name" onClick={() => !isDemoMode && user && (setEditName(true), setNameInput(profile?.nickname ?? ''))}>
                {isDemoMode ? '游客（Demo）' : profile?.nickname ?? '我'} {!isDemoMode && <span style={{ fontSize: 12, opacity: 0.7 }}>✏️</span>}
              </div>
            )}
            <div className="settings-email">{isDemoMode ? '登录后可多人协同' : user?.email}</div>
          </div>
        </div>
        {isDemoMode && (
          <button className="settings-login-btn" onClick={() => navigate('/auth')}>
            登录 / 注册，开启多人协同 ›
          </button>
        )}
      </div>

      {/* 设置列表 */}
      <div className="settings-list">
        {items.map((item) => (
          <button className="settings-item" key={item.label} onClick={item.action}>
            <span className="settings-item-icon">{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.hint && (
              <span style={{ fontSize: 12, color: 'var(--text-sub)', marginRight: 6, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.hint}
              </span>
            )}
            <span className="settings-arrow">›</span>
          </button>
        ))}
      </div>

      {/* 登出 / 注销 */}
      {!isDemoMode && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn-ghost"
            style={{ color: 'var(--danger)', borderColor: '#fecaca' }}
            onClick={handleSignOut}
          >
            退出登录
          </button>
          <button
            className="btn-ghost"
            style={{ color: 'var(--text-sub)', borderColor: '#e2e8f0', fontSize: 13 }}
            onClick={() => setShowDelete(true)}
          >
            注销账号（删除全部云端数据）
          </button>
        </div>
      )}

      {/* 弹窗 */}
      {showPolicy && <PrivacyPolicyModal onClose={() => setShowPolicy(false)} />}
      {showDelete && (
        <div className="modal-mask" onClick={() => setShowDelete(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">注销账号</div>
            <div style={{ fontSize: 14, color: 'var(--text-main)', lineHeight: 1.7, marginBottom: 16 }}>
              注销后将<strong style={{ color: 'var(--danger)' }}>永久删除</strong>：
              <br />· 你创建的所有账本与账单
              <br />· 个人资料与登录信息
              <br />
              <br />此操作不可恢复，确定继续吗？
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowDelete(false)}>取消</button>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }} onClick={handleDeleteAccount}>
                确认注销
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
