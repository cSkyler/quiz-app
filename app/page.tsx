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
          <h1 className="ui-title">MAP 刷题平台</h1>
          <p className="ui-subtitle">
            {sessionEmail ? `已登录：${sessionEmail}` : '游客模式：可刷题，但不保存云端进度'}
          </p>
        </div>

        <div className="ui-row" style={{ gap: 10 }}>
          {sessionEmail ? (
            <button className="ui-btn" onClick={signOut}>退出登录</button>
          ) : (
            <Link className="ui-btn" href="/login" style={{ textDecoration: 'none' }}>
              登录 / 切换账号
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
          <Link className="ui-link" href="/courses">查看全部课程 →</Link>
        </div>

        {courses.length === 0 ? (
          <p className="ui-subtitle" style={{ marginTop: 10 }}>暂无课程。</p>
        ) : (
          <table className="ui-table" style={{ marginTop: 10 }}>
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
        )}
      </div>

      <div className="ui-card" style={{ marginTop: 14 }}>
        <h2 className="ui-title" style={{ fontSize: 18, marginTop: 0 }}>接下来</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>错题本（按课程）</li>
          <li>错题次数统计与错题消除</li>
          <li>讨论区（课程内）</li>
        </ul>
      </div>
    </main>
  )
}
