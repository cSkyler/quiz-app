'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Chapter = { id: string; title: string; order_index: number }

export default function CourseChaptersPage() {
  const params = useParams() as { courseId?: string | string[] }
  const courseIdRaw = params.courseId
  const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')
  const [chapters, setChapters] = useState<Chapter[]>([])

  useEffect(() => {
    ;(async () => {
      setStatus('Loading...')
      if (!courseId) {
        setStatus('ERROR: courseId missing')
        return
      }

      const { data, error } = await supabase
        .from('chapters')
        .select('id,title,order_index')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      if (error) {
        setStatus(`ERROR: ${error.message}`)
        return
      }

      setChapters((data ?? []) as Chapter[])
      setStatus('OK')
    })()
  }, [supabase, courseId])

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-btn ui-btn-ghost ui-btn-sm" href={`/courses/${courseId}`}>← 返回课程</Link>
        <Link className="ui-btn ui-btn-ghost ui-btn-sm" href="/courses">课程列表</Link>
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card">
  {chapters.length === 0 ? (
    <p className="ui-subtitle">该课程暂无章节，请先在管理端录入。</p>
  ) : (
    <>
      {/* Mobile: Card list（杜绝横向滚动） */}
      <div className="ui-only-mobile" style={{ marginTop: 4, display: 'grid', gap: 12 }}>
        {chapters.map((ch) => (
          <div key={ch.id} className="ui-card">
            <div className="ui-chapter-item">
  <div className="ui-chapter-text">
    <div className="ui-subtitle">#{ch.order_index}</div>

    <div className={ch.title.length >= 14 ? 'ui-chapter-title ui-chapter-title--tight' : 'ui-chapter-title'}>
      {ch.title}
    </div>
  </div>

  <Link
    className="ui-btn ui-btn-primary ui-btn-compact ui-chapter-cta"
    href={`/courses/${courseId}/chapters/${ch.id}?mode=catalog`}
    style={{ textDecoration: 'none' }}
  >
    开始
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
              <th>章节</th>
              <th style={{ width: 180 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((ch) => (
              <tr key={ch.id}>
                <td>{ch.order_index}</td>
                <td style={{ fontWeight: 700 }}>{ch.title}</td>
                <td>
                  <Link
                    className="ui-btn"
                    href={`/courses/${courseId}/chapters/${ch.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    开始刷题
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


    </main>
  )
}
