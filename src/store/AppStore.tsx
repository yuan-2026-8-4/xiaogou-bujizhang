import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Ledger, LedgerBudget, Transaction, UserCategory, Profile } from '../types'
import { MOCK_LEDGERS, MOCK_TRANSACTIONS } from '../data/mock'
import { supabase, isSupabaseReady } from '../lib/supabase'
import * as authSvc from '../services/auth'
import * as dataSvc from '../services/data'
import * as catSvc from '../services/category-svc'
import * as lockSvc from '../services/lock'
import * as budgetSvc from '../services/budget'
import { fetchMembers } from '../services/collab'

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'userId'> & {
  userId?: string
}

export type NewLedger = {
  name: string
  type: 'personal' | 'collaborative'
  icon?: string
  color?: string
}

interface AppStoreValue {
  // 基础数据
  ledgers: Ledger[]
  transactions: Transaction[]
  currentLedgerId: string
  setCurrentLedger: (id: string) => void
  // 基础操作
  addTransaction: (tx: NewTransaction) => Promise<{ error?: string }>
  deleteTransaction: (id: string) => Promise<{ error?: string }>
  updateTransaction: (id: string, patch: Partial<Pick<Transaction,'amount'|'type'|'category'|'date'|'note'>>) => Promise<{ error?: string }>
  addLedger: (data: NewLedger) => Promise<Ledger | undefined>
  updateLedger: (id: string, patch: Partial<Pick<Ledger,'name'|'icon'|'color'|'monthStartDay'>>) => Promise<{ ledger?: Ledger; error?: string }>
  deleteLedger: (id: string) => Promise<{ error?: string }>
  refreshData: () => Promise<void>
  // 分类
  categories: UserCategory[]
  refreshCategories: () => Promise<void>
  createCategory: (c: UserCategory) => Promise<{ category?: UserCategory; error?: string }>
  updateCategory: (id: string, patch: Partial<Pick<UserCategory,'name'|'icon'|'color'>>) => Promise<{ category?: UserCategory; error?: string }>
  deleteCategory: (id: string, migrateToId: string | null) => Promise<{ error?: string }>
  // 预算
  currentBudget: LedgerBudget | null
  refreshBudget: (month?: string) => Promise<void>
  setBudget: (amount: number, month?: string) => Promise<{ error?: string }>
  removeBudget: (month?: string) => Promise<{ error?: string }>
  // 隐私锁
  privacyEnabled: boolean
  verifyPin: (pin: string) => Promise<boolean>
  setPin: (newPin: string, fpEnabled?: boolean) => Promise<{ error?: string }>
  disablePin: (oldPin: string) => Promise<{ error?: string }>
  // 认证
  user: { id: string; email?: string } | null
  profile: Profile | null
  isDemoMode: boolean
  isAuthLoading: boolean
  isDataLoading: boolean
  cloudError: string
  /** 云端登录 user.id，未登录 Demo 模式 = 'u-demo'，用于隐私锁/预算/分类的 userId */
  effectiveUserId: string
  signOut: () => Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ledgers, setLedgers] = useState<Ledger[]>(MOCK_LEDGERS)
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS)
  const [currentLedgerId, setCurrentLedgerId] = useState<string>(MOCK_LEDGERS[0].id)
  const [categories, setCategories] = useState<UserCategory[]>(catSvc.DEFAULT_CATEGORIES)
  const [currentBudget, setCurrentBudget] = useState<LedgerBudget | null>(null)
  const [privacyEnabled, setPrivacyEnabled] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAuthLoading, setAuthLoading] = useState(isSupabaseReady)
  const [isDataLoading, setDataLoading] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const unsubRef = useRef<(() => void) | null>(null)
  const memberNameMapRef = useRef<Map<string, string>>(new Map())

  const isDemoMode = !isSupabaseReady || !user
  const effectiveUserId = user?.id ?? 'u-demo'

  // ---------- 云端数据加载 ----------
  const loadCloudData = async () => {
    setDataLoading(true)
    setCloudError('')
    const { ledgers: cloudLedgers, error } = await dataSvc.fetchLedgers()
    if (error) {
      setCloudError('云端数据加载失败：' + error)
      setDataLoading(false)
      return
    }
    if (cloudLedgers.length > 0) {
      setLedgers(cloudLedgers)
      setCurrentLedgerId((prev) => (cloudLedgers.some((l) => l.id === prev) ? prev : cloudLedgers[0].id))
      const { transactions: cloudTx, error: txErr } = await dataSvc.fetchTransactions(cloudLedgers.map((l) => l.id))
      if (txErr) setCloudError('账单加载失败：' + txErr)
      else {
        const nameMap = new Map<string, string>()
        for (const l of cloudLedgers.filter((x) => x.type === 'collaborative')) {
          const members = await fetchMembers(l.id)
          members.forEach((m) => nameMap.set(m.userId, m.nickname))
        }
        memberNameMapRef.current = nameMap
        setTransactions(cloudTx.map((t) => ({ ...t, createdBy: nameMap.get(t.userId) })))
      }
    } else {
      setLedgers([]); setTransactions([])
    }
    setDataLoading(false)
  }

  // ---------- 登录状态监听 ----------
  useEffect(() => {
    if (!supabase) return
    let mounted = true

    // 启动时恢复会话
    authSvc.getSession().then(async (session) => {
      if (!mounted) return
      if (session?.user) {
        const u = session.user
        setUser({ id: u.id, email: u.email ?? undefined })
        const p = await authSvc.getProfile(u.id, u.email ?? undefined)
        if (!mounted) return
        setProfile(p)
        await loadCloudData()
      }
      setAuthLoading(false)
    })

    // 登录/登出事件
    const unsub = authSvc.onAuthChange(async (loggedIn) => {
      if (!mounted) return
      if (loggedIn) {
        const session = await authSvc.getSession()
        if (session?.user && mounted) {
          const u = session.user
          setUser({ id: u.id, email: u.email ?? undefined })
          const p = await authSvc.getProfile(u.id, u.email ?? undefined)
          if (!mounted) return
          setProfile(p)
          await loadCloudData()
        }
      } else {
        // 登出：清空云端数据，回到 demo
        setUser(null)
        setProfile(null)
        setLedgers(MOCK_LEDGERS)
        setTransactions(MOCK_TRANSACTIONS)
        setCurrentLedgerId(MOCK_LEDGERS[0].id)
      }
    })

    return () => {
      mounted = false
      unsub()
    }
  }, [])

  // ---------- 实时订阅（登录后：家庭成员记的账实时出现） ----------
  useEffect(() => {
    if (isDemoMode || ledgers.length === 0) return
    // 断开旧订阅
    unsubRef.current?.()
    const ledgerIds = ledgers.map((l) => l.id)
    unsubRef.current = dataSvc.subscribeTransactions(
      ledgerIds,
      (tx) => {
        // 别人记的账直接插入；自己记的已本地插入过，按 id 去重；补上记录人昵称
        const withName = { ...tx, createdBy: memberNameMapRef.current.get(tx.userId) }
        setTransactions((prev) => (prev.some((t) => t.id === tx.id) ? prev : [withName, ...prev]))
      },
      (txId) => {
        setTransactions((prev) => prev.filter((t) => t.id !== txId))
      },
    )
    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [isDemoMode, ledgers])

  // ---------- 记账 ----------
  const addTransaction = async (input: NewTransaction): Promise<{ error?: string }> => {
    if (isDemoMode) {
      const tx: Transaction = {
        ...input,
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: input.userId ?? 'u-demo',
        createdAt: new Date().toISOString(),
      }
      setTransactions((prev) => [tx, ...prev])
      return {}
    }
    if (!user) return { error: '请先登录' }
    const { transaction, error } = await dataSvc.insertTransaction(input, user.id)
    if (error) return { error }
    if (transaction) {
      setTransactions((prev) => (prev.some((t) => t.id === transaction.id) ? prev : [transaction, ...prev]))
    }
    return {}
  }

  // ---------- 删账单 ----------
  const deleteTransaction = async (id: string): Promise<{ error?: string }> => {
    if (isDemoMode) {
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      return {}
    }
    const { error } = await dataSvc.removeTransaction(id)
    if (error) return { error }
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    return {}
  }

  // ---------- 编辑账单（任务1） ----------
  const updateTransactionFn = async (
    id: string,
    patch: Partial<Pick<Transaction,'amount'|'type'|'category'|'date'|'note'>>,
  ): Promise<{ error?: string }> => {
    if (isDemoMode) {
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      return {}
    }
    const { transaction, error } = await dataSvc.updateTransaction(id, patch)
    if (error || !transaction) return { error: error ?? '编辑失败' }
    setTransactions((prev) => prev.map((t) => (t.id === id ? transaction : t)))
    return {}
  }

  // ---------- 编辑账本 ----------
  const updateLedgerFn = async (
    id: string,
    patch: Partial<Pick<Ledger,'name'|'icon'|'color'|'monthStartDay'>>,
  ): Promise<{ ledger?: Ledger; error?: string }> => {
    if (isDemoMode) {
      let updated: Ledger | undefined
      setLedgers((prev) => prev.map((l) => {
        if (l.id !== id) return l
        updated = { ...l, ...patch, updatedAt: new Date().toISOString() }
        return updated
      }))
      return { ledger: updated }
    }
    const { ledger, error } = await dataSvc.updateLedger(id, patch)
    if (error || !ledger) return { error: error ?? '更新账本失败' }
    setLedgers((prev) => prev.map((l) => (l.id === id ? ledger : l)))
    return { ledger }
  }

  // ---------- 分类操作 ----------
  const refreshCategories = async () => {
    const { categories: list } = await catSvc.fetchCategories(currentLedgerId, isDemoMode)
    setCategories(list)
  }
  const createCategoryFn = async (c: UserCategory) => {
    const r = await catSvc.createCategory(c, isDemoMode)
    if (r.category) setCategories((prev) => [...prev, r.category!])
    return r
  }
  const updateCategoryFn = async (id: string, patch: Partial<Pick<UserCategory,'name'|'icon'|'color'>>) => {
    const r = await catSvc.updateCategory(id, patch, isDemoMode)
    if (r.category) setCategories((prev) => prev.map((x) => (x.id === id ? r.category! : x)))
    return r
  }
  const deleteCategoryFn = async (id: string, migrateToId: string | null) => {
    const r = await catSvc.deleteCategory(id, migrateToId, isDemoMode, currentLedgerId)
    if (!r.error) setCategories((prev) => prev.filter((x) => x.id !== id))
    // 若做了迁移，同步本地 transactions 对应 category 名
    if (!r.error && migrateToId) {
      setTransactions((prev) => prev.map((t) => (t.category === id ? { ...t, category: migrateToId } : t)))
    }
    return r
  }

  // ---------- 预算操作 ----------
  const refreshBudgetFn = async (month?: string) => {
    const m = month ?? budgetSvc.thisMonthKey()
    const b = await budgetSvc.fetchBudget(currentLedgerId, m, isDemoMode)
    setCurrentBudget(b)
  }
  const setBudgetFn = async (amount: number, month?: string) => {
    const m = month ?? budgetSvc.thisMonthKey()
    const b: LedgerBudget = { ledgerId: currentLedgerId, month: m, amount, createdBy: effectiveUserId }
    const r = await budgetSvc.setBudget(b, isDemoMode)
    if (r.error) return { error: r.error }
    setCurrentBudget(r.budget ?? null)
    return {}
  }
  const removeBudgetFn = async (month?: string) => {
    const m = month ?? budgetSvc.thisMonthKey()
    const r = await budgetSvc.removeBudget(currentLedgerId, m, isDemoMode)
    if (!r.error) setCurrentBudget(null)
    return r
  }

  // ---------- 隐私锁 ----------
  useEffect(() => {
    (async () => setPrivacyEnabled(Boolean(await lockSvc.fetchLock(effectiveUserId, isDemoMode))))()
  }, [effectiveUserId, isDemoMode])

  const verifyPinFn = async (pin: string) => {
    const ok = await lockSvc.verifyPin(effectiveUserId, pin, isDemoMode)
    if (ok) lockSvc.markUnlocked(effectiveUserId)
    return ok
  }
  const setPinFn = async (newPin: string, fpEnabled = false) => {
    const r = await lockSvc.setPin(effectiveUserId, newPin, fpEnabled, isDemoMode)
    if (!r.error) { setPrivacyEnabled(true); lockSvc.markUnlocked(effectiveUserId) }
    return r
  }
  const disablePinFn = async (oldPin: string) => {
    const ok = await lockSvc.verifyPin(effectiveUserId, oldPin, isDemoMode)
    if (!ok) return { error: '原密码错误' }
    const r = await lockSvc.disableLock(effectiveUserId, isDemoMode)
    if (!r.error) { setPrivacyEnabled(false); lockSvc.clearUnlocked(effectiveUserId) }
    return r
  }

  // ---------- 新建账本（个人；协同账本由 CollaborationPage 走 collab 服务） ----------
  const addLedger = async (data: NewLedger): Promise<Ledger | undefined> => {
    if (isDemoMode || !user) {
      const ledger: Ledger = {
        id: `ledger-${Date.now()}`,
        name: data.name,
        type: data.type,
        icon: data.icon ?? '📒',
        color: data.color ?? '#14b8a6',
        monthStartDay: 1,
        ownerId: user?.id ?? 'u-demo',
        createdAt: new Date().toISOString().slice(0, 10),
      }
      setLedgers((prev) => [...prev, ledger])
      setCurrentLedgerId(ledger.id)
      return ledger
    }
    const { ledger, error } = await dataSvc.insertLedger(data, user.id)
    if (error || !ledger) {
      setCloudError('创建账本失败：' + (error ?? '未知错误'))
      return undefined
    }
    setLedgers((prev) => [...prev, ledger])
    setCurrentLedgerId(ledger.id)
    return ledger
  }

  // ---------- 删账本 ----------
  const deleteLedger = async (id: string): Promise<{ error?: string }> => {
    if (!isDemoMode) {
      const { error } = await dataSvc.removeLedger(id)
      if (error) return { error }
    }
    setLedgers((prev) => {
      const next = prev.filter((l) => l.id !== id)
      if (currentLedgerId === id && next.length > 0) {
        setCurrentLedgerId(next[0].id)
      }
      return next
    })
    return {}
  }

  // ---------- 手动刷新 ----------
  const refreshData = async () => {
    if (!user) return
    await loadCloudData()
    await Promise.all([refreshCategories(), refreshBudgetFn()])
  }

  // ---------- 登出 ----------
  const signOutFn = async () => {
    await authSvc.signOut()
  }

  const value = useMemo(
    () => ({
      ledgers, transactions, currentLedgerId, setCurrentLedger: setCurrentLedgerId,
      addTransaction, deleteTransaction, updateTransaction: updateTransactionFn,
      addLedger, updateLedger: updateLedgerFn, deleteLedger, refreshData,
      categories, refreshCategories,
      createCategory: createCategoryFn, updateCategory: updateCategoryFn, deleteCategory: deleteCategoryFn,
      currentBudget, refreshBudget: refreshBudgetFn, setBudget: setBudgetFn, removeBudget: removeBudgetFn,
      privacyEnabled, verifyPin: verifyPinFn, setPin: setPinFn, disablePin: disablePinFn,
      user, profile, isDemoMode, isAuthLoading, isDataLoading, cloudError,
      signOut: signOutFn,
      effectiveUserId,
    }),
    [ledgers, transactions, currentLedgerId, categories, currentBudget, privacyEnabled, user, profile, isDemoMode, isAuthLoading, isDataLoading, cloudError, effectiveUserId],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

// 在组件中读取全局数据
export function useAppStore() {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore 必须在 AppStoreProvider 内使用')
  return ctx
}
