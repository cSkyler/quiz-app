'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowRight, BarChart3, BookOpen, Check, RotateCcw } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

export default function LoginPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const nextPath = useMemo(() => {
    const raw = sp.get('next') || '/start'
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/start'
  }, [sp])
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function onLogin() {
    setStatus('')
    if (!email.trim() || !password) { setStatus('请输入邮箱和密码。'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) { setStatus(`登录失败：${error.message}`); return }
      if (!data.session) { setStatus('登录会话尚未建立，请确认邮箱是否已经验证。'); return }
      setStatus('登录成功，正在进入学习空间…')
      router.replace(nextPath)
      router.refresh()
    } finally { setLoading(false) }
  }

  async function onSendResetEmail() {
    const value = email.trim()
    if (!value) { setStatus('请先输入注册邮箱，再申请重置密码。'); return }
    setLoading(true); setStatus('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(value, { redirectTo: `${window.location.origin}/reset-password` })
      setStatus(error ? `发送失败：${error.message}` : '重置邮件已经发送，请前往邮箱查看。')
    } finally { setLoading(false) }
  }

  return (
    <main className="auth-page">
      <aside className="auth-aside"><Link href="/" className="landing-brand"><span><BookOpen size={19}/></span><strong>MAPer</strong><small>学习平台</small></Link><div className="auth-aside__copy"><span>长期学习 · 考前冲刺</span><h1>继续你的心理学课程复习</h1><p>登录后自动同步章节进度、错题和掌握度，在不同设备继续上一次学习。</p><div className="auth-aside__features"><div><Check size={17}/>保存每一道题的学习状态</div><div><RotateCcw size={17}/>持续追踪错题掌握变化</div><div><BarChart3 size={17}/>根据进度安排下一步复习</div></div></div></aside>
      <section className="auth-main"><div className="auth-main__top"><span>还没有账户？</span><Link className="button button--secondary" href="/signup">免费注册</Link></div><div className="auth-card"><h2>登录</h2><p>欢迎回来。输入你的账户信息继续学习。</p><div className="form-field"><label htmlFor="email">邮箱</label><input id="email" placeholder="name@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" /></div><div className="form-field"><label htmlFor="password">密码</label><input id="password" placeholder="输入密码" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter') onLogin()}} autoComplete="current-password" /></div><button className="button button--primary auth-submit" onClick={onLogin} disabled={loading}>{loading?'正在登录…':<>登录并继续 <ArrowRight size={17}/></>}</button><div className="auth-helper"><button onClick={onSendResetEmail} disabled={loading}>忘记密码？</button><Link href="/">返回官网</Link></div>{status?<div className="auth-status">{status}</div>:null}</div></section>
    </main>
  )
}
