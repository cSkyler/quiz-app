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
type CourseProgress = {
  course_id: string
  total: number
  green: number
  yellow: number
  red: number
  attempted: number
  unseen: number
}

export default function CoursesPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')
  const [courses, setCourses] = useState<Course[]>([])
  const [courseProgMap, setCourseProgMap] = useState<Record<string, CourseProgress>>({})

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
      // === load v_progress_courses (per course) ===
{
  const ids = (data ?? []).map((c) => c.id).filter(Boolean)
  if (ids.length === 0) {
    setCourseProgMap({})
  } else {
    const { data: progRows, error: progErr } = await supabase
      .from('v_progress_courses')
      .select('course_id,total,green,yellow,red,attempted,unseen')
      .in('course_id', ids)

    if (!progErr) {
      const map: Record<string, any> = {}
      for (const r of progRows ?? []) map[r.course_id] = r
      setCourseProgMap(map)
    } else {
      // 不要打断课程页主流程
      setCourseProgMap({})
    }
  }
}

      setStatus('OK')
    })()
  }, [supabase])
  function CourseProgressBar(p?: CourseProgress | null) {
    const total = p?.total ?? 0
    const green = p?.green ?? 0
    const yellow = p?.yellow ?? 0
    const red = p?.red ?? 0
    const unseen = Math.max(0, total - (green + yellow + red))
  
    const pct = (x: number) => (total ? `${(x / total) * 100}%` : '0%')
  
    return (
      <div style={{ marginTop: 10 }}>
        <div className="ui-progress">
          <div className="ui-progress__bar">
            <div className="ui-progress__seg ui-progress__green" style={{ width: pct(green) }} />
            <div className="ui-progress__seg ui-progress__yellow" style={{ width: pct(yellow) }} />
            <div className="ui-progress__seg ui-progress__red" style={{ width: pct(red) }} />
            <div className="ui-progress__seg ui-progress__unseen" style={{ width: pct(unseen) }} />
          </div>
        </div>
  
        <div className="ui-progress-meta">
          <span>已做 {green + yellow + red}/{total}</span>
          <span>绿 {green} / 黄 {yellow} / 红 {red}</span>
        </div>
      </div>
    )
  }
  
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
            {CourseProgressBar(courseProgMap[c.id] ?? null)}

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
              {CourseProgressBar(courseProgMap[c.id] ?? null)}

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
