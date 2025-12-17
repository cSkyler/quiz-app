'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

export default function SignupPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSignup() {
    setStatus('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password
      })

      if (error) {
        setStatus(`注册失败：${error.message}`)
        return
      }

      // 关键：识别“邮箱已存在”的常见情况（Supabase 的防枚举策略可能不直接报错）
      // 如果 user.identities 为空，通常代表该邮箱已注册（或不可再次注册）
      const identities = (data.user as any)?.identities
      if (Array.isArray(identities) && identities.length === 0) {
        setStatus('该邮箱可能已注册：请直接去登录（或使用“忘记密码”）。')
        return
      }

      // 开启邮箱验证时：session 通常为 null，需要提示用户查收邮件
      setStatus('注册成功：请到邮箱点击确认链接完成验证，然后再返回登录。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-link" href="/">← 返回首页</Link>
        <Link className="ui-link" href="/login">去登录</Link>
      </div>

      <div className="ui-card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 className="ui-title" style={{ fontSize: 20, marginTop: 0 }}>注册</h1>
        <p className="ui-subtitle">注册后需要邮箱验证（推荐开启），验证通过后才能登录保存进度。</p>

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
            placeholder="密码（建议至少 8 位）"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <button className="ui-btn ui-btn-primary" onClick={onSignup} disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>

          <div className="ui-row" style={{ justifyContent: 'space-between' }}>
            <Link className="ui-link" href="/login">已有账号？去登录</Link>
            <span />
          </div>

          {status ? <div className="ui-status">{status}</div> : null}
        </div>
      </div>
    </main>
  )
}
