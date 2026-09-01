import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/AppStore'
import { LOCK_TIMEOUT_MS } from '../services/lock'

/** 任务6 隐私锁设置页（创建 / 修改 / 关闭 / 忘记密码指引） */
export default function PrivacyLockPage() {
  const nav = useNavigate()
  const { privacyEnabled, setPin, disablePin, verifyPin } = useAppStore()
  const [step, setStep] = useState<'home' | 'set' | 'change' | 'off'>('home')
  const [pin, setPinA] = useState('')
  const [pin2, setPin2] = useState('')
  const [oldPin, setOldPin] = useState('')
  const [err, setErr] = useState('')
  const [fp, setFp] = useState(false)

  useEffect(() => {
    setPinA(''); setPin2(''); setOldPin(''); setErr('')
  }, [step])

  const pinOK = (s: string) => /^\d{4}$/.test(s)

  const onSet = async () => {
    setErr('')
    if (!pinOK(pin)) return setErr('请输入 4 位数字 PIN')
    if (pin !== pin2) return setErr('两次输入不一致')
    const r = await setPin(pin, fp)
    if (r.error) return setErr(r.error)
    alert('设置成功'); setStep('home')
  }
  const onChange = async () => {
    setErr('')
    if (!pinOK(oldPin)) return setErr('原 PIN 需 4 位数字')
    if (!pinOK(pin)) return setErr('新 PIN 需 4 位数字')
    if (pin !== pin2) return setErr('两次输入不一致')
    if (!await verifyPin(oldPin)) return setErr('原密码错误')
    const r = await setPin(pin, fp)
    if (r.error) return setErr(r.error)
    alert('修改成功'); setStep('home')
  }
  const onDisable = async () => {
    setErr('')
    if (!pinOK(oldPin)) return setErr('请输入原 PIN')
    const r = await disablePin(oldPin)
    if (r.error) return setErr(r.error)
    alert('隐私锁已关闭'); setStep('home')
  }

  return (
    <div className="page pin-pad">
      <div className="top-bar">
        <button className="btn-ghost small" onClick={() => nav(-1)}>‹ 返回</button>
        <h2>隐私锁</h2>
        <div />
      </div>

      <div className="status-card">
        <div className={`dot ${privacyEnabled ? 'on' : ''}`} />
        <div>
          <div className="title">{privacyEnabled ? '隐私锁已开启' : '隐私锁未开启'}</div>
          <div className="muted">空闲 {Math.round(LOCK_TIMEOUT_MS / 60000)} 分钟后自动锁定</div>
        </div>
      </div>

      {step === 'home' && (
        <div className="list-actions">
          {!privacyEnabled && <button className="btn-primary full" onClick={() => setStep('set')}>设置 PIN</button>}
          {privacyEnabled && <button className="btn-primary full" onClick={() => setStep('change')}>修改 PIN</button>}
          {privacyEnabled && <button className="btn-danger full" onClick={() => setStep('off')}>关闭隐私锁</button>}
          <div className="tips">
            <div className="tips-title">忘记密码怎么办？</div>
            <p>您的 PIN 只保存在 <strong>您自己的账号数据</strong>中，任何人均无法解密查看。</p>
            <p>1) 云端模式：删除 `privacy_locks` 行（需在 Supabase 控制台操作），即可重新设置。</p>
            <p>2) Demo 模式：在浏览器隐私清除「本地存储」后重新进入即可。</p>
          </div>
        </div>
      )}

      {(step === 'set' || step === 'change' || step === 'off') && (
        <PinForm
          title={
            step === 'set' ? '设置新 PIN（4 位数字）' :
            step === 'change' ? '修改 PIN' :
            '关闭 PIN 锁'
          }
          showOld={step !== 'set'}
          oldPin={oldPin} setOldPin={setOldPin}
          pin={pin} setPin={setPinA}
          pin2={pin2} setPin2={setPin2}
          fp={fp} setFp={setFp}
          showFp={step !== 'off'}
          showConfirm={step !== 'off'}
          err={err}
          onCancel={() => setStep('home')}
          onSubmit={
            step === 'set' ? onSet :
            step === 'change' ? onChange :
            onDisable
          }
          submitLabel={step === 'off' ? '关闭' : '保存'}
        />
      )}
    </div>
  )
}

function PinForm(props: {
  title: string; showOld: boolean; oldPin: string; setOldPin: (v: string) => void
  pin: string; setPin: (v: string) => void
  pin2: string; setPin2: (v: string) => void
  fp: boolean; setFp: (v: boolean) => void
  showFp: boolean; showConfirm: boolean; err: string
  onCancel: () => void; onSubmit: () => void; submitLabel: string
}) {
  const refOld = useRef<HTMLInputElement>(null)
  const refPin = useRef<HTMLInputElement>(null)
  const refPin2 = useRef<HTMLInputElement>(null)
  const focus = (i: number) => [refOld, refPin, refPin2][i]?.current?.focus()
  const [active, setActive] = useState<0 | 1 | 2>(props.showOld ? 0 : 1)

  const press = (k: string) => {
    if (k === 'C') {
      if (active === 0 && props.showOld) { props.setOldPin('') }
      else if (active === 1) { props.setPin('') }
      else { props.setPin2('') }
      return
    }
    if (k === '←') {
      if (active === 0 && props.showOld) { props.setOldPin(props.oldPin.slice(0, -1)) }
      else if (active === 1) { props.setPin(props.pin.slice(0, -1)) }
      else { props.setPin2(props.pin2.slice(0, -1)) }
      return
    }
    const push = (cur: string, setter: (s: string) => void, next: () => void) => {
      if (cur.length >= 4) return
      const v = cur + k
      setter(v)
      if (v.length === 4) { setTimeout(() => next(), 50) }
    }
    if (active === 0 && props.showOld) push(props.oldPin, props.setOldPin, () => setActive(1))
    else if (active === 1) push(props.pin, props.setPin, () => props.showConfirm ? setActive(2) : props.onSubmit())
    else push(props.pin2, props.setPin2, () => props.onSubmit())
  }

  return (
    <div className="pin-setup">
      <h3 className="pin-title">{props.title}</h3>

      {props.showOld && (
        <label className={`pin-slot ${active === 0 ? 'active' : ''}`} onClick={() => { setActive(0); focus(0) }}>
          <span className="l">原 PIN</span>
          <PinDots v={props.oldPin} />
        </label>
      )}
      <label className={`pin-slot ${active === 1 ? 'active' : ''}`} onClick={() => { setActive(props.showOld ? 1 : 0); focus(1) }}>
        <span className="l">新 PIN</span>
        <PinDots v={props.pin} />
      </label>
      {props.showConfirm && (
        <label className={`pin-slot ${active === 2 ? 'active' : ''}`} onClick={() => { setActive(2); focus(2) }}>
          <span className="l">再次输入</span>
          <PinDots v={props.pin2} />
        </label>
      )}

      {props.showFp && (
        <label className="fp-row">
          <input type="checkbox" checked={props.fp} onChange={e => props.setFp(e.target.checked)} />
          <span>启用指纹 / 面容（若浏览器支持 WebAuthn，此处预留界面位）</span>
        </label>
      )}

      {props.err && <div className="toast error">{props.err}</div>}

      <div className="pin-keypad">
        {['1','2','3','4','5','6','7','8','9','C','0','←'].map(k => (
          <button key={k} className={`pk ${k === 'C' ? 'c' : k === '←' ? 'bk' : ''}`} onClick={() => press(k)}>{k}</button>
        ))}
      </div>

      <div className="row-2">
        <button className="btn-ghost" onClick={props.onCancel}>取消</button>
        <button className="btn-primary" onClick={props.onSubmit}>{props.submitLabel}</button>
      </div>
    </div>
  )
}

function PinDots({ v }: { v: string }) {
  return (
    <div className="pin-dots">
      {[0,1,2,3].map(i => (
        <span key={i} className={`dot-slot ${v.length > i ? 'on' : ''}`} />
      ))}
    </div>
  )
}

// 保持 useMemo 稳定
void useMemo
