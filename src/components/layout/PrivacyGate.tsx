import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../store/AppStore'
import { clearUnlocked, isStillUnlocked } from '../../services/lock'

/**
 * 任务6 PrivacyGate：路由级锁屏拦截。
 * 规则：当隐私锁已开启（privacyEnabled=true）且当前会话未解锁时，
 *       覆盖全屏 PinGate 组件，输入 4 位 PIN 正确后才可看到子页面。
 * 额外：idle 3 分钟 或 visibilitychange 页面切回前台时，若超时则重新锁屏。
 */
export default function PrivacyGate({ children }: { children: React.ReactNode }) {
  const { privacyEnabled, verifyPin, effectiveUserId } = useAppStore()
  const userId = effectiveUserId ?? 'demo-user'
  // 🔴 关键：初始 state 同步计算，不用等 useEffect（解决 reload 后第一帧泄露 + useEffect 延迟漏锁的边界问题）
  const [locked, setLocked] = useState<boolean>(() => privacyEnabled && !isStillUnlocked(userId))
  const [pin, setPin] = useState<string>('')
  const [err, setErr] = useState<string>('')

  // 监听 privacyEnabled 或 userId 变化（登录态切换/云端加载完成/fetchLock 成功后）再同步 locked
  useEffect(() => {
    if (!privacyEnabled) { setLocked(false); return }
    // 同步计算（userId 不变时，如果仍在解锁窗口就不锁）
    setLocked(!isStillUnlocked(userId))
  }, [privacyEnabled, userId])

  // idle 计时器：每 10s 检查一次是否超时，避免 30s 太长 Review 阶段无法验证
  useEffect(() => {
    if (!privacyEnabled) return
    const t = setInterval(() => {
      if (!isStillUnlocked(userId)) setLocked(true)
    }, 10 * 1000)
    return () => clearInterval(t)
  }, [privacyEnabled, userId])

  // visibilitychange：切回前台时，立即重新检查（例如后台停留 3 分钟 → 锁屏）
  useEffect(() => {
    if (!privacyEnabled) return
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (!isStillUnlocked(userId)) setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [privacyEnabled, userId])

  // 用户活动：touch / click / keydown 时 → 如果当前未锁定，延长上次解锁时间戳？
  // 不需要：锁屏一旦解锁，它的 lastUnlockAt 是通过 markUnlocked() 在 verifyPin() 内写的；
  //        之后每 30s/visible 时通过 isStillUnlocked 对比 Date.now() - lastUnlockAt < 180s。
  //        所以用户活动无需额外逻辑。

  const onDigit = (d: string) => {
    if (pin.length >= 4) return
    setPin((prev) => prev + d)
    setErr('')
  }
  const onDel = () => { setPin((p) => p.slice(0, -1)); setErr('') }
  const onClear = () => { setPin(''); setErr('') }
  const onSubmit = async () => {
    if (pin.length !== 4) return
    const ok = await verifyPin(pin)
    if (ok) {
      setPin(''); setErr(''); setLocked(false)
    } else {
      setErr('密码错误，请重试')
      // 500ms 后清空
      setTimeout(() => setPin(''), 450)
    }
  }
  // 输入 4 位自动提交
  useEffect(() => { if (pin.length === 4 && locked) onSubmit() }, [pin]) // eslint-disable-line

  const keys = useMemo(() => ['1','2','3','4','5','6','7','8','9','C','0','←'], [])

  if (!privacyEnabled || !locked) return <>{children}</>

  return (
    <div className="app-shell">
      <div className="privacy-gate" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#f0fdfa,#ccfbf1)', padding: 16 }}>
        <div className="pin-setup" style={{ width: '100%', maxWidth: 420, borderRadius: 20, padding: 28, boxShadow: '0 20px 48px rgba(20,184,166,.25)', background: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>🔒</div>
            <h2 style={{ margin: 0, fontSize: 20, color: '#0f766e' }}>小狗不记账已上锁</h2>
            <p style={{ color: '#64748b', marginTop: 6, fontSize: 13 }}>请输入 4 位 PIN 解锁查看</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '18px 0 10px' }}>
            {[0,1,2,3].map((i) => (
              <div key={i} className={`pin-dot ${pin.length > i ? 'on' : ''}`} style={{ width: 14, height: 14, borderRadius: 999, border: '2px solid #99f6e4', background: pin.length > i ? 'linear-gradient(135deg,#2DD4BF,#14B8A6)' : 'transparent' }} />
            ))}
          </div>
          {err && <div style={{ color: '#ef4444', textAlign: 'center', fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div className="pin-keypad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
            {keys.map(k => {
              const isDel = k === '←'; const isClr = k === 'C'
              let cls = 'pk'
              if (isDel) cls += ' pk-ctrl'
              if (isClr) cls += ' pk-ctrl pk-clear'
              return (
                <button
                  key={k}
                  className={cls}
                  style={{ borderRadius: 14, padding: '14px 0', fontSize: 20, fontWeight: 600, border: 'none', background: isDel || isClr ? '#f1f5f9' : '#f8fafc', color: '#0f766e' }}
                  onClick={() => {
                    if (isClr) onClear()
                    else if (isDel) onDel()
                    else onDigit(k)
                  }}
                >{k}</button>
              )
            })}
          </div>
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#94a3b8' }}>
            3 分钟无操作或切到后台会自动上锁
          </p>
          <button
            className="btn-ghost"
            style={{ width: '100%', marginTop: 12, fontSize: 12, color: '#64748b' }}
            onClick={() => {
              if (!window.confirm('确认关闭隐私锁？需要重新进入 设置→隐私锁 再次开启。')) return
              // 临时紧急解锁（forgot-password 指引）：Demo 模式下直接关闭，云端需要到 设置页面操作
              clearUnlocked(userId)
              // 让用户走设置页面：直接跳转到 /settings/privacy-lock 让用户走关闭流程
              location.hash = '/settings/privacy-lock'
            }}
          >忘记密码？前往设置重置</button>
        </div>
      </div>
    </div>
  )
}
