'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function onUpdatePassword() {
    setStatus('')

    if (!password || password.length < 8) {
      setStatus('新密码至少 8 位。')
      return
    }
    if (password !== password2) {
      setStatus('两次输入的新密码不一致。')
      return
    }

    setLoading(true)
    try {
      // 用户点击邮件链接后，会带着一次性的恢复会话进入本站
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setStatus(`修改失败：${error.message}`)
        return
      }

      setStatus('密码已更新，正在跳转到登录页...')
      router.replace('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-link" href="/login">← 返回登录</Link>
      </div>

      <div className="ui-card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 className="ui-title" style={{ fontSize: 20, marginTop: 0 }}>重置密码</h1>
        <p className="ui-subtitle">请在此设置新密码（需通过邮箱中的重置链接进入本页）。</p>

        <div className="ui-col" style={{ gap: 10, marginTop: 12 }}>
          <input
            className="ui-input"
            placeholder="新密码（至少 8 位）"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            className="ui-input"
            placeholder="再次输入新密码"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
          />

          <button className="ui-btn ui-btn-primary" onClick={onUpdatePassword} disabled={loading}>
            {loading ? '提交中...' : '更新密码'}
          </button>

          {status ? <div className="ui-status">{status}</div> : null}
        </div>
      </div>
    </main>
  )
}
