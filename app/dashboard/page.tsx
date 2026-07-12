'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, Clock3, Megaphone, RotateCcw, Target } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Course = { id: string; title: string; description: string | null; order_index: number }
type Progress = { course_id: string; total: number; green: number; yellow: number; red: number; attempted: number; unseen: number }

export default function DashboardPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [courses, setCourses] = useState<Course[]>([])
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [wrongCount, setWrongCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [nickname, setNickname] = useState('同学')
  const [announcement, setAnnouncement] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      const [{ data: courseRows }, { data: announcementRow }] = await Promise.all([
        supabase.from('courses').select('id,title,description,order_index').order('order_index'),
        supabase.from('site_settings').select('value').eq('key', 'announcement').maybeSingle(),
      ])
      setCourses((courseRows ?? []) as Course[])
      setAnnouncement(announcementRow?.value?.trim() ?? '')
      if (user) {
        const [{ data: progressRows }, { count: wrong }, { count: today }, { data: profile }] = await Promise.all([
          supabase.from('v_progress_courses').select('course_id,total,green,yellow,red,attempted,unseen').eq('user_id', user.id),
          supabase.from('user_question_status').select('question_id', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['wrong','unsure']),
          supabase.from('attempts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
          supabase.from('user_profiles').select('nickname').eq('user_id', user.id).maybeSingle(),
        ])
        const map: Record<string, Progress> = {}
        for (const row of progressRows ?? []) map[row.course_id] = row as Progress
        setProgress(map)
        setWrongCount(wrong ?? 0)
        setTodayCount(today ?? 0)
        setNickname(profile?.nickname?.trim() || user.email?.split('@')[0] || '同学')
      }
      setLoading(false)
    })()
  }, [supabase])

  const totalAttempted = Object.values(progress).reduce((sum, item) => sum + (item.attempted ?? 0), 0)
  const totalGreen = Object.values(progress).reduce((sum, item) => sum + (item.green ?? 0), 0)
  const accuracy = totalAttempted ? Math.round((totalGreen / totalAttempted) * 100) : 0
  const primaryCourse = courses[0]

  return (
    <main className="workspace-page">
      <div className="workspace-heading"><div><span className="page-eyebrow">学习概览</span><h1>上午好，{nickname}</h1><p>今天从一项明确的任务开始，保持稳定的复习节奏。</p></div><Link className="button button--primary" href={primaryCourse ? `/courses/${primaryCourse.id}` : '/courses'}>继续学习 <ArrowRight size={17} /></Link></div>

      <section className="exam-strip"><div className="exam-strip__date"><CalendarDays size={20} /><span><small>本学期考试</small><strong>2026年7月19日</strong></span></div><div className="exam-strip__message"><strong>距离考试还有 8 天</strong><span>建议优先完成未练习章节，再集中复习红色和黄色题目。</span></div><Link href="/courses">查看冲刺计划 <ArrowRight size={16} /></Link></section>
      {announcement ? <section className="announcement-strip"><Megaphone size={17} /><strong>平台公告</strong><p>{announcement}</p></section> : null}

      <section className="metric-grid"><article><span className="metric-icon"><CheckCircle2 size={19} /></span><div><small>今日答题</small><strong>{loading ? '—' : todayCount}</strong><em>保持连续学习</em></div></article><article><span className="metric-icon is-teal"><Target size={19} /></span><div><small>综合掌握率</small><strong>{loading ? '—' : `${accuracy}%`}</strong><em>以已练习题目计算</em></div></article><article><span className="metric-icon is-amber"><RotateCcw size={19} /></span><div><small>待复习题目</small><strong>{loading ? '—' : wrongCount}</strong><em>错误与不确定题目</em></div></article><article><span className="metric-icon is-neutral"><Clock3 size={19} /></span><div><small>累计已练习</small><strong>{loading ? '—' : totalAttempted}</strong><em>跨课程同步记录</em></div></article></section>

      <div className="workspace-grid">
        <section className="panel course-panel"><div className="panel-heading"><div><h2>我的课程</h2><p>按照当前进度继续学习</p></div><Link href="/courses">全部课程 <ArrowRight size={15} /></Link></div><div className="dashboard-course-list">{courses.slice(0, 5).map((course, index) => { const p = progress[course.id]; const percent = p?.total ? Math.round((p.attempted / p.total) * 100) : 0; const Icon = index % 2 ? BookOpen : BrainCircuit; return <Link key={course.id} href={`/courses/${course.id}`} className="dashboard-course"><span className={index % 2 ? 'course-symbol is-green' : 'course-symbol'}><Icon size={20} /></span><div className="dashboard-course__body"><strong>{course.title}</strong><small>{course.description || '课程内容持续整理中'}</small><div><i><b style={{ width: `${percent}%` }} /></i><span>{percent}%</span></div></div><span className="dashboard-course__meta">{p?.attempted ?? 0}/{p?.total ?? 0} 题<ArrowRight size={16} /></span></Link> })}{!loading && courses.length === 0 ? <div className="empty-state"><BookOpen size={24} /><strong>暂无课程</strong><p>管理员添加课程后会显示在这里。</p></div> : null}</div></section>
        <aside className="workspace-side"><section className="panel"><div className="panel-heading"><div><h2>建议下一步</h2><p>根据当前学习状态</p></div></div><div className="next-task"><span><Target size={20} /></span><strong>{wrongCount > 0 ? '复习待掌握题目' : '开始一个未练习章节'}</strong><p>{wrongCount > 0 ? `目前有 ${wrongCount} 道错误或不确定题目，优先解决重复出错的内容。` : '选择一门课程，从第一个未练习章节开始。'}</p><Link href="/courses">开始复习 <ArrowRight size={15} /></Link></div></section><section className="panel quick-guide"><div className="panel-heading"><div><h2>掌握度说明</h2></div></div><ul><li><i className="mastery-dot is-green" /><span><strong>已掌握</strong><small>可以稳定回答</small></span></li><li><i className="mastery-dot is-yellow" /><span><strong>不确定</strong><small>需要再次确认</small></span></li><li><i className="mastery-dot is-red" /><span><strong>需复习</strong><small>优先加入复习计划</small></span></li></ul></section></aside>
      </div>
    </main>
  )
}
