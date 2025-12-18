'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Course = {
  id: string
  title: string
  description: string | null
  order_index: number
}

export default function HomePage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })

    ;(async () => {
      setStatus('Loading...')

      const { data: sess } = await supabase.auth.getSession()
      const session = sess.session
      setSessionEmail(session?.user?.email ?? null)

      // 课程列表
      const { data: cRows, error: cErr } = await supabase
        .from('courses')
        .select('id,title,description,order_index')
        .order('order_index', { ascending: true })

      if (cErr) {
        setStatus(`ERROR courses: ${cErr.message}`)
        return
      }
      setCourses((cRows ?? []) as Course[])

      // 是否管理员（可选）
      if (session) {
        const { data: prof, error: pErr } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (!pErr && prof?.role === 'admin') setIsAdmin(true)
        else setIsAdmin(false)
      } else {
        setIsAdmin(false)
      }

      setStatus('OK')
    })()

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [supabase])

  async function signOut() {
    await supabase.auth.signOut()
    setSessionEmail(null)
    setIsAdmin(false)
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">MAPer 学习平台</h1>
          <p className="ui-subtitle">
            {sessionEmail ? `已登录：${sessionEmail}` : '游客模式：可刷题，但不保存云端进度'}
          </p>
        </div>

        <div className="ui-row" style={{ gap: 10 }}>
          {sessionEmail ? (
            <button className="ui-btn" onClick={signOut}>退出登录</button>
          ) : (
            <Link className="ui-btn" href="/login" style={{ textDecoration: 'none' }}>
              登录 / 切换
            </Link>
          )}

          {isAdmin ? (
            <Link className="ui-btn" href="/admin" style={{ textDecoration: 'none' }}>
              管理端
            </Link>
          ) : null}
        </div>
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card">
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="ui-title" style={{ fontSize: 18, margin: 0 }}>课程</h2>
          

        </div>

        {courses.length === 0 ? (
          <p className="ui-subtitle" style={{ marginTop: 10 }}>暂无课程。</p>
        ) : (
          <>
  {/* Mobile: Card list */}
  <div className="ui-only-mobile" style={{ marginTop: 12, display: 'grid', gap: 12 }}>
    {courses.map((c) => (
      <div key={c.id} className="ui-card">
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="ui-subtitle">#{c.order_index}</div>
            <div className="ui-h2 ui-clamp-2">{c.title}</div>
            {c.description ? <div className="ui-subtitle ui-clamp-2">{c.description}</div> : null}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Link
            className="ui-btn ui-btn-primary"
            href={`/courses/${c.id}`}
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            进入课程
          </Link>
          <Link
            className="ui-btn"
            href={`/courses/${c.id}/chapters`}
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            章节
          </Link>
        </div>
      </div>
    ))}
  </div>

  {/* Desktop: Table */}
  <div className="ui-only-desktop ui-table-wrap" style={{ marginTop: 10 }}>
    <table className="ui-table">
      <thead>
        <tr>
          <th style={{ width: 80 }}>顺序</th>
          <th>课程</th>
          <th style={{ width: 220 }}>操作</th>
        </tr>
      </thead>
      <tbody>
        {courses.map((c) => (
          <tr key={c.id}>
            <td>{c.order_index}</td>
            <td>
              <div style={{ fontWeight: 800 }}>{c.title}</div>
              {c.description ? <div className="ui-subtitle">{c.description}</div> : null}
            </td>
            <td className="ui-row" style={{ gap: 10 }}>
              <Link className="ui-btn ui-btn-primary" href={`/courses/${c.id}`} style={{ textDecoration: 'none' }}>
                进入课程
              </Link>
              <Link className="ui-btn" href={`/courses/${c.id}/chapters`} style={{ textDecoration: 'none' }}>
                章节
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</>

        )}
      </div>

      <div className="ui-card" style={{ marginTop: 14 }}>
  <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
    <h2 className="ui-title" style={{ fontSize: 18, marginTop: 0, marginBottom: 0 }}>公告</h2>
    <span className="ui-meta">持续更新中</span>
  </div>

  <div style={{ marginTop: 10 }}>
    <p className="ui-body" style={{ marginTop: 0 }}>
      本平台由 <strong>抱水</strong> 个人搭建并维护，面向同学们免费开放使用。平台以“高效刷题 + 错题复盘”为核心，
      当前仍在迭代中，如遇到题库、答案或功能异常，欢迎随时反馈，我会尽快修复与优化。
    </p>
    <p className="ui-body" style={{ marginBottom: 0 }}>
      使用提示：游客模式可刷题但不保存进度；登录后支持多设备同步与错题/熟练度记录。
    </p>
  </div>

  <div style={{ marginTop: 12 }} className="ui-divider" />

  <div style={{ marginTop: 12 }}>
    <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div className="ui-label">更新</div>
        <div className="ui-body ui-muted">手机端课程列表已优化为卡片布局，提升可读性与触控体验。</div>
      </div>
      <span className="ui-badge">v0.1</span>
    </div>
  </div>

  <div style={{ marginTop: 12 }} className="ui-divider" />

  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
    <Link className="ui-btn ui-btn-primary" href="/feedback" style={{ textDecoration: 'none', textAlign: 'center' }}>
      反馈入口
    </Link>
    <Link className="ui-btn" href="/updates" style={{ textDecoration: 'none', textAlign: 'center' }}>
      更新记录
    </Link>
  </div>

  <div className="ui-subtle" style={{ marginTop: 10 }}>
    说明：本平台为学习辅助工具，题目与解析以课程资料、网上资料为参考利用AI生成，若与老师标准答案冲突，请以课堂为准。
  </div>
</div>

    </main>
  )
}
