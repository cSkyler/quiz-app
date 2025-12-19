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
  type ChapterProgress = {
    chapter_id: string
    total: number
    green: number
    yellow: number
    red: number
    attempted: number
    unseen: number
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
  
  const [chapterProgMap, setChapterProgMap] = useState<Record<string, ChapterProgress>>({})
  const [courseProg, setCourseProg] = useState<CourseProgress | null>(null)
  
  async function loadProgress(courseId: string) {
    // 1) course summary
    {
      const { data } = await supabase
        .from('v_progress_courses')
        .select('course_id,total,green,yellow,red,attempted,unseen')
        .eq('course_id', courseId)
        .maybeSingle()
      setCourseProg((data ?? null) as any)
    }
  
    // 2) per chapter
    {
      const { data } = await supabase
        .from('v_progress_chapters')
        .select('chapter_id,total,green,yellow,red,attempted,unseen')
        .eq('course_id', courseId)
  
      const map: Record<string, any> = {}
      for (const r of data ?? []) map[r.chapter_id] = r
      setChapterProgMap(map)
    }
  }
  
  function ProgressBar(p?: ChapterProgress | null) {
    const total = p?.total ?? 0
    const green = p?.green ?? 0
    const yellow = p?.yellow ?? 0
    const red = p?.red ?? 0
    const unseen = total - (green + yellow + red)
  
    const pct = (x: number) => (total ? `${(x / total) * 100}%` : '0%')
  
    return (
      <div style={{ marginTop: 10 }}>
        <div className="ui-progress">
          <div className="ui-progress__bar">
            <div className="ui-progress__seg ui-progress__green" style={{ width: pct(green) }} />
            <div className="ui-progress__seg ui-progress__yellow" style={{ width: pct(yellow) }} />
            <div className="ui-progress__seg ui-progress__red" style={{ width: pct(red) }} />
            <div className="ui-progress__seg ui-progress__unseen" style={{ width: pct(Math.max(0, unseen)) }} />
          </div>
        </div>
  
        <div className="ui-progress-meta">
          <span>已做 {green + yellow + red}/{total || 0}</span>
          <span>绿 {green} / 黄 {yellow} / 红 {red}</span>
        </div>
      </div>
    )
  }
  
  useEffect(() => {
    let cancelled = false
  
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
  
      if (cancelled) return
  
      if (error) {
        setStatus(`ERROR: ${error.message}`)
        return
      }
  
      setChapters((data ?? []) as Chapter[])
  
      // ✅ 新增：拉取课程/章节进度
      await loadProgress(courseId)
  
      if (!cancelled) setStatus('OK')
    })()
  
    return () => {
      cancelled = true
    }
  }, [supabase, courseId])
  

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-btn ui-btn-ghost ui-btn-sm" href={`/courses/${courseId}`}>← 返回课程</Link>
        <Link className="ui-btn ui-btn-ghost ui-btn-sm" href="/courses">课程列表</Link>
      </div>

      <div className="ui-status">{status}</div>
      {courseProg ? (
  <div className="ui-card" style={{ marginTop: 12 }}>
    <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <h2 className="ui-title" style={{ fontSize: 16, margin: 0 }}>本课程进度</h2>
      <span className="ui-meta">已做 {courseProg.attempted}/{courseProg.total}</span>
    </div>

    {ProgressBar({
      chapter_id: 'course',
      total: courseProg.total,
      green: courseProg.green,
      yellow: courseProg.yellow,
      red: courseProg.red,
      attempted: courseProg.attempted,
      unseen: courseProg.unseen
    })}
  </div>
) : null}


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
{ProgressBar(chapterProgMap[ch.id] ?? null)}

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
                <td style={{ fontWeight: 700 }}>
  <div>{ch.title}</div>
  {ProgressBar(chapterProgMap[ch.id] ?? null)}
</td>

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
