'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

export default function LoginPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const nextPath = useMemo(() => {
    const raw = sp.get('next') || '/'
    // 防止开放重定向：只允许站内相对路径
    return raw.startsWith('/') ? raw : '/'
  }, [sp])

  const supabase = useMemo(() => supabaseBrowser(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      setSessionEmail(data.session?.user?.email ?? null)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      setSessionEmail(session?.user?.email ?? null)

      // 只在真正 SIGNED_IN 时跳转，避免残留 session/竞态导致回跳闭环
      if (evt === 'SIGNED_IN' && session) {
        // 这里保留你后面要做的 nextPath 逻辑时再替换
        router.replace('/courses')
        router.refresh()
      }
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [supabase, router])



  async function onLogin() {
    setStatus('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (error) {
        setStatus(`登录失败：${error.message}`)
        return
      }

      if (!data.session) {
        setStatus('登录未建立会话：请检查是否需要邮箱验证，或稍后重试。')
        return
      }

      setStatus('登录成功，正在跳转...')
      router.replace(nextPath)
      router.refresh()

    } finally {
      setLoading(false)
    }
  }

  async function onSendResetEmail() {
    setStatus('')
    const e = email.trim()
    if (!e) {
      setStatus('请先在邮箱框输入你的邮箱，再点“忘记密码”。')
      return
    }

    setLoading(true)
    try {
      // 关键：redirectTo 指向我们等下新建的重置页
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/reset-password`
            : undefined
      })

      if (error) {
        setStatus(`发送失败：${error.message}`)
        return
      }

      setStatus('已发送重置邮件：请去邮箱点击链接，然后在打开的页面设置新密码。')
    } finally {
      setLoading(false)
    }
  }

  async function onSignOut() {
    setStatus('')
    await supabase.auth.signOut()
    setStatus('已退出登录')
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-link" href="/">← 返回首页</Link>
        <div className="ui-badge">{sessionEmail ? `已登录：${sessionEmail}` : '未登录'}</div>
      </div>

      <div className="ui-card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 className="ui-title" style={{ fontSize: 20, marginTop: 0 }}>登录</h1>
        <p className="ui-subtitle">登录后可保存进度、掌握度、错题等数据。</p>

        <div className="ui-col" style={{ gap: 10, marginTop: 12 }}>
          <input
            className="ui-input"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="ui-input"
            placeholder="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button className="ui-btn ui-btn-primary" onClick={onLogin} disabled={loading}>
            {loading ? '处理中...' : '登录'}
          </button>

          <div className="ui-row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <button className="ui-btn" onClick={onSendResetEmail} disabled={loading}>
              忘记密码
            </button>
            <Link className="ui-link" href="/signup">未有账号？去注册</Link>
            {sessionEmail ? (
              <button className="ui-btn" onClick={onSignOut}>退出账号</button>
            ) : (
              <span />
            )}
          </div>

          {status ? <div className="ui-status">{status}</div> : null}
        </div>
      </div>
    </main>
  )
}
