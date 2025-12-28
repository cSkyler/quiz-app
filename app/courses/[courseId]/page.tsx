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

type CourseProgress = {
  course_id: string
  total: number
  green: number
  yellow: number
  red: number
  attempted: number
  unseen: number
}

type CourseBrief = {
  course_id: string
  exam_structure: string | null
  assignments: string | null
  study_tips: string | null
  exam_date: string | null // date -> 'YYYY-MM-DD'
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysBetweenLocal(a: Date, b: Date) {
  // b - a, in days (local day)
  const ms = startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime()
  return Math.round(ms / 86400000)
}

export default function CourseHomePage() {
  const params = useParams() as { courseId?: string | string[] }
  const courseIdRaw = params.courseId
  const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')

  const [course, setCourse] = useState<Course | null>(null)
  const [courseProg, setCourseProg] = useState<CourseProgress | null>(null)
  const [resume, setResume] = useState<null | { chapter_id: string; last_question_id: string | null }>(null)

  const [brief, setBrief] = useState<CourseBrief | null>(null)
  const [chaptersTotal, setChaptersTotal] = useState(0)
  const [reviewPrepared, setReviewPrepared] = useState(0)

  useEffect(() => {
    ;(async () => {
      if (!courseId) {
        setStatus('ERROR: courseId missing')
        return
      }

      setStatus('Loading...')

      // 0) 课程信息
      {
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
      }

      // 1) 课程简介（course_brief）
      {
        const { data: b, error: bErr } = await supabase
          .from('course_brief')
          .select('course_id,exam_structure,assignments,study_tips,exam_date')
          .eq('course_id', courseId)
          .maybeSingle()

        // 没有数据不算错误：允许 brief 为 null
        if (!bErr) setBrief((b ?? null) as any)
      }

      // 2) 课程总进度（v_progress_courses）
      {
        const { data: prog, error: pErr } = await supabase
          .from('v_progress_courses')
          .select('course_id,total,green,yellow,red,attempted,unseen')
          .eq('course_id', courseId)
          .maybeSingle()

        if (!pErr) setCourseProg((prog ?? null) as any)
      }

      // 3) 章节列表（用于：继续上次刷题 + 复习准备数量）
      {
        const { data: chs, error: chErr } = await supabase
          .from('chapters')
          .select('id')
          .eq('course_id', courseId)

        if (!chErr) {
          const ids = (chs ?? []).map((x: any) => x.id).filter(Boolean)
          setChaptersTotal(ids.length)

          // 3.1) 继续上次：从 chapter_progress 找本课程最近一次
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

          // 3.2) 复习内容准备数量：chapter_review_notes（只数有内容的章节）
          // 使用 head+count，避免把 content 拉到首页
          const { count } = await supabase
            .from('chapter_review_notes')
            .select('chapter_id', { count: 'exact', head: true })
            .eq('course_id', courseId)

          setReviewPrepared(count ?? 0)
        }
      }

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

  function CountdownCard() {
    const examDateStr = brief?.exam_date ?? null
    if (!examDateStr) {
      return (
        <div className="ui-card" style={{ marginTop: 12 }}>
          <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="ui-title" style={{ fontSize: 18, margin: 0 }}>考试倒计时</h2>
            <span className="ui-meta">未设置考试日期</span>
          </div>
          <div className="ui-subtitle" style={{ marginTop: 8 }}>
            你可以在 Supabase 的 <code>course_brief.exam_date</code> 填写 date（YYYY-MM-DD）。
          </div>
        </div>
      )
    }

    // date -> local day (avoid timezone shift)
    const exam = new Date(`${examDateStr}T00:00:00`)
    const today = new Date()
    const daysLeft = daysBetweenLocal(today, exam) // exam - today

       // 14 天冲刺：考试日前 14 天窗口（包含考试日）
       const sprintWindow = 14
       const totalSteps = sprintWindow - 1 // 13
       const sprintStart = new Date(exam)
       sprintStart.setDate(sprintStart.getDate() - totalSteps)
   
       const daysToSprintStart = daysBetweenLocal(today, sprintStart) // sprintStart - today
       const inSprint = daysToSprintStart <= 0 && daysLeft >= 0
   
       // 进度：冲刺开始日进度=0，考试日进度=1
       let progress = 0
       if (daysLeft < 0) progress = 1
       else if (daysLeft > totalSteps) progress = 0
       else progress = clamp((totalSteps - daysLeft) / totalSteps, 0, 1)
   
       const pct = Math.round(progress * 100)
   
       return (
         <div className="ui-card" style={{ marginTop: 12 }}>
           <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
             <h2 className="ui-title" style={{ fontSize: 18, margin: 0 }}>考试倒计时</h2>
             <span className="ui-meta">考试日期：{examDateStr}</span>
           </div>
   
           <div className="ui-row" style={{ marginTop: 10, justifyContent: 'space-between', alignItems: 'baseline' }}>
             <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 0.5 }}>
               {daysLeft >= 0 ? `D-${daysLeft}` : '已结束'}
             </div>
             <div className="ui-meta">
               {daysLeft >= 0 ? `还剩 ${daysLeft} 天` : `已过 ${Math.abs(daysLeft)} 天`}
             </div>
           </div>
   
           <div style={{ marginTop: 12 }}>
             <div className="ui-meta" style={{ marginBottom: 8 }}>
               {daysLeft < 0
                 ? '两周复习（14天）：已完成'
                 : inSprint
                   ? `两周复习（14天）：已过 ${Math.round(progress * sprintWindow)}/${sprintWindow}`
                   : `距离两周复习开始还有 ${Math.max(0, daysToSprintStart)} 天`}
             </div>
   
                       {/* 视频进度条 + 流星光点（可溢出） */}
          <div
            className="ui-countdown-bar"
            style={
              {
                // 你想要的右下角蓝色花火风：统一用同一个 accent 控制“流星 + 已完成进度”
                // 后面你要换色，只改这里即可
                ['--cd-accent' as any]: 'rgba(158, 53, 114, 0.95)',
                ['--cd-accent-soft' as any]: 'rgba(71, 5, 59, 0.96)',
              } as any
            }
          >
            <div className="ui-countdown-bar__wrap">
              <div className="ui-countdown-bar__track">
                <div className="ui-countdown-bar__fill" style={{ width: `${pct}%` }} />
              </div>

             

              {/* 流星（在轨道之上，不受裁剪） */}
              <div className="ui-countdown-bar__comet" style={{ left: `${pct}%` }} />

{/* 花火粒子：以彗星为中心，向左侧 30° 范围内散落（不裁剪，可飞出轨道） */}
<div className="ui-countdown-bar__sparks" style={{ left: `${pct}%` }}>
  {Array.from({ length: 40 }).map((_, i) => (
    <span key={i} className="ui-countdown-bar__spark" />
  ))}
</div>


            </div>

            <div className="ui-countdown-bar__labels">
              <span>开始</span>
              <span>两周复习</span>
              <span>考试</span>
            </div>
          </div>

           </div>
         </div>
       )
   
  }

  function CourseBriefCard() {
    const hasAny =
      (brief?.exam_structure && brief.exam_structure.trim()) ||
      (brief?.assignments && brief.assignments.trim()) ||
      (brief?.study_tips && brief.study_tips.trim())

    return (
      <div className="ui-card" style={{ marginTop: 12 }}>
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="ui-title" style={{ fontSize: 18, margin: 0 }}>课程简介</h2>
          <span className="ui-meta">考核构成 / 作业考核 / 复习建议</span>
        </div>

        {!hasAny ? (
          <div className="ui-subtitle" style={{ marginTop: 8 }}>
            暂无简介内容。
          </div>
        ) : (
          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            <div>
              <div className="ui-meta" style={{ marginBottom: 6 }}>考核构成</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
                {brief?.exam_structure?.trim() ? brief.exam_structure : '—'}
              </div>
            </div>

            <div>
              <div className="ui-meta" style={{ marginBottom: 6 }}>作业考核</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
                {brief?.assignments?.trim() ? brief.assignments : '—'}
              </div>
            </div>

            <div>
              <div className="ui-meta" style={{ marginBottom: 6 }}>复习建议</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
                {brief?.study_tips?.trim() ? brief.study_tips : '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function CourseReviewCard() {
    const prepared = reviewPrepared
    const total = chaptersTotal

    return (
      <div className="ui-card" style={{ marginTop: 12 }}>
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="ui-title" style={{ fontSize: 18, margin: 0 }}>课程复习</h2>
          <span className="ui-meta">{total ? `已准备 ${prepared}/${total} 章` : ''}</span>
        </div>

        

        <div className="ui-row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
          <Link className="ui-btn ui-btn-primary" href={`/courses/${courseId}/review`} style={{ textDecoration: 'none' }}>
            开始复习
          </Link>

          
        </div>

        {prepared === 0 ? (
          <div className="ui-subtitle" style={{ marginTop: 8 }}>
            当前还没导入任何章节复习内容。
          </div>
        ) : null}
      </div>
    )
  }

  function CourseProgressCard() {
    return (
      
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
      </div>

      {/* 单列堆叠：倒计时 -> 课程简介 -> 课程复习 -> 课程进度 */}
      {CountdownCard()}
      {CourseBriefCard()}
      {CourseReviewCard()}
      {CourseProgressCard()}
    </main>
  )
}
