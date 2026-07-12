'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, BrainCircuit, CalendarDays, Search } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { loadAllLearningProgress, type CourseProgress } from '@/lib/learningProgress'

type Course = { id: string; title: string; description: string | null; order_index: number }

export default function CoursesPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [courses, setCourses] = useState<Course[]>([])
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({})
  const [examDates, setExamDates] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      const progressRequest = user
        ? loadAllLearningProgress(supabase, user.id)
        : Promise.resolve({ courseProgress: {} as Record<string, CourseProgress>, chapterProgress: {} })
      const [{ data: courseRows }, { data: briefRows }, { courseProgress }] = await Promise.all([
        supabase.from('courses').select('id,title,description,order_index').order('order_index'),
        supabase.from('course_brief').select('course_id,exam_date'),
        progressRequest,
      ])
      setCourses((courseRows ?? []) as Course[])
      const dates: Record<string, string> = {}
      for (const row of briefRows ?? []) if (row.exam_date) dates[row.course_id] = row.exam_date
      setExamDates(dates)
      setProgress(courseProgress)
      setLoading(false)
    })()
  }, [supabase])

  const filtered = courses.filter((course) =>
    `${course.title} ${course.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <main className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="page-eyebrow">课程空间</span>
          <h1>我的课程</h1>
          <p>选择一门课程，继续资料阅读、章节练习或错题复习。</p>
        </div>
        <div className="course-search">
          <Search size={17} />
          <input aria-label="搜索课程" placeholder="搜索课程" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      <div className="course-summary">
        <span><strong>{courses.length}</strong> 门课程</span><i />
        <span><strong>{Object.values(progress).reduce((sum, row) => sum + row.attempted, 0)}</strong> 道题已练习</span><i />
        <span>考试目标 <strong>2026年7月19日</strong></span>
      </div>

      <section className="course-grid">
        {filtered.map((course, index) => {
          const row = progress[course.id]
          const percent = row?.total ? Math.round((row.attempted / row.total) * 100) : 0
          const Icon = index % 2 ? BookOpen : BrainCircuit
          const examDate = examDates[course.id]
            ? new Date(`${examDates[course.id]}T00:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
            : '考试日期待设置'
          return (
            <article className="course-card" key={course.id}>
              <div className="course-card__head">
                <span className={index % 2 ? 'course-symbol is-green' : 'course-symbol'}><Icon size={21} /></span>
                <span className="course-card__index">课程 {String(course.order_index).padStart(2, '0')}</span>
              </div>
              <h2>{course.title}</h2>
              <p>{course.description || '课程介绍内容整理中，章节与题目可正常学习。'}</p>
              <div className="course-card__exam"><CalendarDays size={15} />{examDate}</div>
              <div className="course-card__progress">
                <div><span>学习进度</span><strong>{percent}%</strong></div>
                <i><b style={{ width: `${percent}%` }} /></i>
              </div>
              <div className="course-card__stats">
                <span><strong>{row?.attempted ?? 0}</strong> / {row?.total ?? 0} 已练习</span>
                <span><i className="mastery-dot is-red" />{row?.red ?? 0} 待复习</span>
              </div>
              <Link className="course-card__action" href={`/courses/${course.id}`}>
                {row?.attempted ? '继续学习' : '进入课程'}<ArrowRight size={16} />
              </Link>
            </article>
          )
        })}
        {!loading && !filtered.length ? (
          <div className="empty-state panel"><BookOpen /><strong>{query ? '没有匹配的课程' : '暂无课程'}</strong><p>{query ? '尝试使用其他关键词。' : '管理员添加课程后会显示在这里。'}</p></div>
        ) : null}
      </section>
    </main>
  )
}
