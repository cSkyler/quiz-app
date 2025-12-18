'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Course = {
  id: string
  title: string
  description: string | null
}

export default function CourseHomePage() {
  const params = useParams() as { courseId?: string | string[] }
  const courseIdRaw = params.courseId
  const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')
  const [course, setCourse] = useState<Course | null>(null)

  useEffect(() => {
    ;(async () => {
      if (!courseId) {
        setStatus('ERROR: courseId missing')
        return
      }
      const { data, error } = await supabase
        .from('courses')
        .select('id,title,description')
        .eq('id', courseId)
        .maybeSingle()

      if (error) {
        setStatus(`ERROR: ${error.message}`)
        return
      }
      setCourse((data ?? null) as Course | null)
      setStatus('OK')
    })()
  }, [supabase, courseId])

  return (
    <main className="ui-container">
      <div className="ui-topbar">
      <Link className="ui-btn ui-btn-ghost ui-btn-sm" href="/">
  ← 返回首页
</Link>

       
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card">
        <h1 className="ui-title">{course?.title ?? '课程'}</h1>
        {course?.description ? <p className="ui-subtitle">{course.description}</p> : null}

        <div className="ui-row" style={{ marginTop: 12, gap: 10 }}>
          <Link className="ui-btn ui-btn-primary" href={`/courses/${courseId}/chapters`} style={{ textDecoration: 'none' }}>
            开始刷题（章节选择）
          </Link>

          <Link className="ui-btn ui-btn-primary" href={`/courses/${courseId}/wrongbook`} style={{ textDecoration: 'none' }}>
            错题本
          </Link>

          <Link className="ui-btn" href={`/courses/${courseId}/discussions`} style={{ textDecoration: 'none' }}>
            讨论区（待实现）
          </Link>
        </div>
      </div>
    </main>
  )
}
