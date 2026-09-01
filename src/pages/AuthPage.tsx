import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseReady } from '../lib/supabase'
import { signIn, signUp } from '../services/auth'
import PrivacyPolicyModal from '../components/PrivacyPolicyModal'

// 登录 / 注册页：邮箱 + 密码
// - 云端模式：真实 Supabase 认证
// - Demo 模式（未配置 Supabase）：直接进入体验
export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [tip, setTip] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)
  const [policyFrom, setPolicyFrom] = useState<'agree' | 'about'>('about')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTip('')

    // 上架合规：注册前必须同意隐私政策
    if (mode === 'register' && !agreed) {
      setTip('请先阅读并同意《隐私政策》')
      return
    }

    setLoading(true)
    if (mode === 'register') {
      const res = await signUp(email.trim(), password)
      setLoading(false)
      if (res.error) {
        setTip(res.error)
        return
      }
      if (res.needsConfirmation) {
        setTip('注册成功！请先到邮箱点击验证邮件，再回来登录')
        setMode('login')
        return
      }
      navigate('/')
      return
    }
    const res = await signIn(email.trim(), password)
    setLoading(false)
    if (res.error) {
      setTip(res.error)
      return
    }
    navigate('/')
  }

  // Demo 模式：未配置 Supabase，直接体验
  const demoEnter = () => {
    navigate('/')
  }

  return (
    <div className="page auth-page">
      <div className="auth-logo">
        <div className="auth-logo-icon">🐶</div>
        <h1>小狗不记账</h1>
        <p>家庭协同记账，轻松每一笔</p>
      </div>

      <form className="card auth-card" onSubmit={submit}>
        {!isSupabaseReady && (
          <div className="auth-demo-tip">演示模式：未连接云端，数据仅保存在本机</div>
        )}

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        {mode === 'register' && (
          <input
            className="field"
            placeholder="昵称（可选）"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
          />
        )}
        <input
          className="field"
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          type="password"
          placeholder="密码（至少6位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        {tip && <div className="auth-tip">{tip}</div>}

        {mode === 'register' && (
          <label className="auth-agree">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              我已阅读并同意
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setPolicyFrom('agree')
                  setShowPolicy(true)
                }}
              >
                《隐私政策》
              </button>
            </span>
          </label>
        )}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>

        {isSupabaseReady ? (
          <button className="auth-skip" type="button" onClick={demoEnter}>
            先随便逛逛 ›
          </button>
        ) : (
          <button className="auth-skip" type="button" onClick={demoEnter}>
            暂不登录，先体验 Demo ›
          </button>
        )}
      </form>

      {showPolicy && (
        <PrivacyPolicyModal
          onClose={() => setShowPolicy(false)}
          onAgree={
            policyFrom === 'agree'
              ? () => {
                  setAgreed(true)
                  setShowPolicy(false)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
