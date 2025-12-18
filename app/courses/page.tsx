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

export default function CoursesPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    ;(async () => {
      setStatus('Loading...')
      const { data, error } = await supabase
        .from('courses')
        .select('id,title,description,order_index')
        .order('order_index', { ascending: true })

      if (error) {
        setStatus(`ERROR: ${error.message}`)
        return
      }
      setCourses((data ?? []) as Course[])
      setStatus('OK')
    })()
  }, [supabase])

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">课程</h1>
          <p className="ui-subtitle">选择一门课进入后开始刷题</p>
        </div>
        <Link className="ui-btn ui-btn-ghost ui-btn-sm" href="/">返回首页</Link>
      </div>

      <div className="ui-status">{status}</div>

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

    </main>
  )
}
