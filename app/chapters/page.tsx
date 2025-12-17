'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Chapter = { id: string; title: string; order_index: number }

export default function ChaptersPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })
  
    ;(async () => {
      const { data: sess } = await supabase.auth.getSession()
      setSessionEmail(sess.session?.user?.email ?? null)
  
      const { data, error } = await supabase
        .from('chapters')
        .select('id,title,order_index')
        .order('order_index', { ascending: true })
  
      if (error) {
        setStatus(`ERROR: ${error.message}`)
        return
      }
      setChapters((data ?? []) as Chapter[])
      setStatus('OK')
    })()
  
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [supabase])
  

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">章节刷题</h1>
          <p className="ui-subtitle">
            {sessionEmail ? `已登录：${sessionEmail}` : '未登录：可刷题但不保存进度'}
          </p>
        </div>
        <Link className="ui-link" href={sessionEmail ? '/' : '/login'}>
          {sessionEmail ? '返回首页' : '去登录'}
        </Link>
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card">
        {chapters.length === 0 ? (
          <p className="ui-subtitle">暂无章节，请先在 /admin 新建章节。</p>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>顺序</th>
                <th>章节</th>
                <th style={{ width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.id}>
                  <td>{c.order_index}</td>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td>
                    <Link className="ui-btn" href={`/chapters/${c.id}`} style={{ textDecoration: 'none' }}>
                      开始刷题
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
