'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { daysUntilExam } from '@/lib/exam'
import ThemeSwitcher from './ThemeSwitcher'

const navItems = [
  { href: '/dashboard', label: '学习首页', icon: LayoutDashboard },
  { href: '/courses', label: '我的课程', icon: GraduationCap },
  { href: '/progress', label: '学习进度', icon: BarChart3 },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('学习者')
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      setEmail(user?.email ?? '')
      if (!user) return
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('nickname,role')
        .eq('user_id', user.id)
        .maybeSingle()
      setNickname(profile?.nickname?.trim() || user.email?.split('@')[0] || '学习者')
      setRole(profile?.role ?? null)
    })()
  }, [supabase])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  const isAdmin = role === 'admin' || role === 'owner'
  const examDays = daysUntilExam()

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/dashboard" className="app-brand">
          <span className="app-brand__mark"><BookOpen size={20} /></span>
          <span><strong>MAPer</strong><small>学习平台</small></span>
        </Link>

        <nav className="app-nav" aria-label="主导航">
          <div className="app-nav__label">学习空间</div>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={active ? 'app-nav__item is-active' : 'app-nav__item'}>
                <Icon size={18} /><span>{item.label}</span>{active ? <ChevronRight size={15} /> : null}
              </Link>
            )
          })}
        </nav>

        <div className="app-sidebar__bottom">
          {isAdmin ? <Link href="/admin" className={pathname.startsWith('/admin') ? 'app-nav__item is-active' : 'app-nav__item'}><ShieldCheck size={18} /><span>管理后台</span></Link> : null}
          <Link href="/onboarding?replay=1" className="app-nav__item"><CircleHelp size={18} /><span>新手教程</span></Link>
          <div className="app-sidebar__exam"><span>考试倒计时</span><strong>{examDays} 天</strong><small>2026年7月19日</small></div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__context"><span className="status-dot" />长期学习 · 考前冲刺</div>
          <div className="app-topbar__actions">
            <ThemeSwitcher />
            <Link href="/me" className="profile-button" title={email}>
              <span className="profile-button__avatar"><UserRound size={17} /></span>
              <span className="profile-button__text"><strong>{nickname}</strong><small>{role === 'owner' ? 'Owner' : role === 'admin' ? '管理员' : '学习者'}</small></span>
            </Link>
            <button className="icon-button" type="button" title="退出登录" aria-label="退出登录" onClick={signOut}><LogOut size={18} /></button>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  )
}
