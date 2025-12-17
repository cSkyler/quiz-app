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
        <Link className="ui-link" href="/">返回首页</Link>
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card">
        {courses.length === 0 ? (
          <p className="ui-subtitle">暂无课程（管理员可在后续管理端新增）。</p>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>顺序</th>
                <th>课程</th>
                <th style={{ width: 180 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td>{c.order_index}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{c.title}</div>
                    {c.description ? <div className="ui-subtitle">{c.description}</div> : null}
                  </td>
                  <td>
                    <Link className="ui-btn" href={`/courses/${c.id}`} style={{ textDecoration: 'none' }}>
                      进入课程
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
