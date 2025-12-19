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
  type CourseProgress = {
    course_id: string
    total: number
    green: number
    yellow: number
    red: number
    attempted: number
    unseen: number
  }
  
  const [courseProg, setCourseProg] = useState<CourseProgress | null>(null)
  const [resume, setResume] = useState<null | { chapter_id: string; last_question_id: string | null }>(null)
  
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
      setCourse((data ?? null) as Course | null)

// === 插入：课程总进度 + 继续上次刷题 ===

// 1) 课程总进度（v_progress_courses）
{
  const { data: prog } = await supabase
    .from('v_progress_courses')
    .select('course_id,total,green,yellow,red,attempted,unseen')
    .eq('course_id', courseId)
    .maybeSingle()

  setCourseProg((prog ?? null) as any)
}

// 2) 继续上次：从 chapter_progress 找本课程最近一次
{
  // 先拿本课程所有 chapter id
  const { data: chs, error: chErr } = await supabase
    .from('chapters')
    .select('id')
    .eq('course_id', courseId)

  if (!chErr) {
    const ids = (chs ?? []).map((x: any) => x.id).filter(Boolean)
    if (ids.length > 0) {
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess.session?.user?.id
      if (uid) {
        const { data: prog2 } = await supabase
          .from('chapter_progress')
          .select('chapter_id,last_question_id,updated_at')
          .eq('user_id', uid)
          .in('chapter_id', ids)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (prog2?.chapter_id) {
          setResume({ chapter_id: prog2.chapter_id, last_question_id: prog2.last_question_id ?? null })
        } else {
          setResume(null)
        }
      }
    }
  }
}

setStatus('OK')

      setStatus('OK')
    })()
  }, [supabase, courseId])

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
      <Link className="ui-btn ui-btn-ghost ui-btn-sm" href="/">
  ← 返回首页
</Link>

       
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card">
        <h1 className="ui-title">{course?.title ?? '课程'}</h1>
        {course?.description ? <p className="ui-subtitle">{course.description}</p> : null}

        <div className="ui-row" style={{ marginTop: 12, gap: 10 }}>
          
        </div>
        <div className="ui-card" style={{ marginTop: 12 }}>
  <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
    <h2 className="ui-title" style={{ fontSize: 18, margin: 0 }}>课程进度</h2>
    <span className="ui-meta">{courseProg?.total ? `总题数：${courseProg.total}` : ''}</span>
  </div>

  {CourseProgressBar(courseProg)}

  <div className="ui-row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
    <Link className="ui-btn ui-btn-primary" href={`/courses/${courseId}/chapters`} style={{ textDecoration: 'none' }}>
      去章节列表
    </Link>

    <Link className="ui-btn" href={`/courses/${courseId}/wrongbook`} style={{ textDecoration: 'none' }}>
      错题本
    </Link>

    <Link
      className="ui-btn ui-btn-ghost"
      href={
        resume
          ? `/courses/${courseId}/chapters/${resume.chapter_id}?mode=quiz${resume.last_question_id ? `&q=${resume.last_question_id}` : ''}`
          : `/courses/${courseId}/chapters`
      }
      style={{ textDecoration: 'none' }}
    >
      继续上次刷题
    </Link>
  </div>

  {!resume ? <div className="ui-subtitle" style={{ marginTop: 8 }}>暂无上次进度，建议从章节列表开始。</div> : null}
</div>

      </div>
    </main>
  )
}
