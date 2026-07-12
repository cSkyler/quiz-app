'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lightbulb,
  ListChecks,
  Play,
  RotateCcw,
  Target,
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import ChapterPracticeClient from '@/components/ChapterPracticeClient'
import {
  buildLearningProgress,
  loadQuestionStatuses,
  normalizeLearningStatus,
  type ChapterProgress,
  type CourseProgress,
  type QuestionStatusRow,
} from '@/lib/learningProgress'

type Course = { id: string; title: string; description: string | null }
type Brief = { exam_structure: string | null; assignments: string | null; study_tips: string | null; exam_date: string | null }
type Chapter = { id: string; title: string; order_index: number; provided_by: string | null }
type QuestionMeta = { id: string; chapter_id: string; type: string; stem: string }
type ReviewNote = { chapter_id: string; content: string }
type WrongStatus = { question_id: string; status: 'red' | 'yellow'; wrong_count: number | null }
type Resume = { chapter_id: string; last_question_id: string | null }
type ViewKey = 'overview' | 'chapters' | 'review' | 'wrong' | 'practice'

const tabItems: Array<{ key: Exclude<ViewKey, 'practice'>; label: string }> = [
  { key: 'overview', label: '课程概览' },
  { key: 'chapters', label: '章节与题库' },
  { key: 'review', label: '复习资料' },
  { key: 'wrong', label: '错题' },
]

function Placeholder() {
  return <div className="content-placeholder"><span>内容整理中</span><p>管理员可以稍后在内容工作台中补充。</p></div>
}

function ReviewDocument({ content }: { content: string }) {
  const pages = content.split('---PAGE---').map((page) => page.trim()).filter(Boolean)
  return (
    <div className="inline-review-document">
      {pages.map((page, pageIndex) => (
        <section key={pageIndex}>
          {pages.length > 1 ? <span className="review-page-label">第 {pageIndex + 1} 页</span> : null}
          {page.split(/\r?\n/).map((line, lineIndex) => {
            const text = line.trim()
            if (!text) return <div className="review-spacer" key={lineIndex} />
            if (text.startsWith('### ')) return <h4 key={lineIndex}>{text.slice(4)}</h4>
            if (text.startsWith('## ')) return <h3 key={lineIndex}>{text.slice(3)}</h3>
            if (text.startsWith('# ')) return <h2 key={lineIndex}>{text.slice(2)}</h2>
            if (/^[-*•]\s*/.test(text)) return <p className="review-list-item" key={lineIndex}>{text.replace(/^[-*•]\s*/, '')}</p>
            return <p key={lineIndex}>{text}</p>
          })}
        </section>
      ))}
    </div>
  )
}

export default function CoursePage() {
  const params = useParams() as { courseId?: string | string[] }
  const courseId = Array.isArray(params.courseId) ? params.courseId[0] : params.courseId ?? ''
  const supabase = useMemo(() => supabaseBrowser(), [])
  const contentRef = useRef<HTMLDivElement>(null)

  const [course, setCourse] = useState<Course | null>(null)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [progress, setProgress] = useState<CourseProgress | null>(null)
  const [chapterRows, setChapterRows] = useState<Chapter[]>([])
  const [chapterProgress, setChapterProgress] = useState<Record<string, ChapterProgress>>({})
  const [questions, setQuestions] = useState<QuestionMeta[]>([])
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [wrongStatuses, setWrongStatuses] = useState<Record<string, WrongStatus>>({})
  const [resume, setResume] = useState<Resume | null>(null)
  const [activeView, setActiveView] = useState<ViewKey>('overview')
  const [practiceOrigin, setPracticeOrigin] = useState<Exclude<ViewKey, 'practice'>>('chapters')
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
  const [wrongChapterFilter, setWrongChapterFilter] = useState('all')
  const [wrongStateFilter, setWrongStateFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!courseId) return
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      const [{ data: courseRow }, { data: briefRow }, { data: chapters }, { data: notes }] = await Promise.all([
        supabase.from('courses').select('id,title,description').eq('id', courseId).maybeSingle(),
        supabase.from('course_brief').select('exam_structure,assignments,study_tips,exam_date').eq('course_id', courseId).maybeSingle(),
        supabase.from('chapters').select('id,title,order_index,provided_by').eq('course_id', courseId).order('order_index'),
        supabase.from('chapter_review_notes').select('chapter_id,content').eq('course_id', courseId),
      ])

      const loadedChapters = (chapters ?? []) as Chapter[]
      const chapterIds = loadedChapters.map((chapter) => chapter.id)
      const questionRequest = chapterIds.length
        ? supabase.from('questions').select('id,chapter_id,type,stem').in('chapter_id', chapterIds)
        : Promise.resolve({ data: [] })
      const [{ data: questionRows }] = await Promise.all([questionRequest])

      const loadedQuestions = (questionRows ?? []) as QuestionMeta[]
      const questionIds = loadedQuestions.map((question) => question.id)
      let statusRows: QuestionStatusRow[] = []
      if (user && questionIds.length) {
        const [loadedStatuses, { data: resumeRow }] = await Promise.all([
          loadQuestionStatuses(supabase, user.id, questionIds),
          supabase.from('chapter_progress').select('chapter_id,last_question_id,updated_at').eq('user_id', user.id).in('chapter_id', chapterIds).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        ])
        statusRows = loadedStatuses
        const statusMap: Record<string, WrongStatus> = {}
        for (const row of statusRows) {
          const status = normalizeLearningStatus(row.status)
          if (status !== 'green') statusMap[row.question_id] = { question_id: row.question_id, status, wrong_count: row.wrong_count ?? null }
        }
        setWrongStatuses(statusMap)
        setResume(resumeRow as Resume | null)
      }

      const calculated = buildLearningProgress(
        loadedChapters.map((chapter) => ({ id: chapter.id, course_id: courseId })),
        loadedQuestions,
        statusRows
      )
      const noteMap: Record<string, string> = {}
      for (const note of (notes ?? []) as ReviewNote[]) noteMap[note.chapter_id] = note.content

      setCourse(courseRow as Course | null)
      setBrief(briefRow as Brief | null)
      setProgress(calculated.courseProgress[courseId] ?? null)
      setChapterRows(loadedChapters)
      setChapterProgress(calculated.chapterProgress)
      setQuestions(loadedQuestions)
      setReviewNotes(noteMap)
      setSelectedReviewId((notes?.[0]?.chapter_id as string | undefined) ?? loadedChapters[0]?.id ?? null)
      setLoading(false)
    })()
  }, [courseId, supabase])

  const refreshLearningProgress = useCallback(async () => {
    if (!courseId || chapterRows.length === 0) return
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    if (!user) return

    const questionIds = questions.map((question) => question.id)
    try {
      const statusRows = await loadQuestionStatuses(supabase, user.id, questionIds)
      const calculated = buildLearningProgress(
        chapterRows.map((chapter) => ({ id: chapter.id, course_id: courseId })),
        questions,
        statusRows
      )
      setProgress(calculated.courseProgress[courseId] ?? null)
      setChapterProgress(calculated.chapterProgress)

      const statusMap: Record<string, WrongStatus> = {}
      for (const row of statusRows) {
        const status = normalizeLearningStatus(row.status)
        if (status !== 'green') statusMap[row.question_id] = { question_id: row.question_id, status, wrong_count: row.wrong_count ?? null }
      }
      setWrongStatuses(statusMap)
    } catch {
      // Keep the last known progress visible if a refresh request is interrupted.
    }
  }, [chapterRows, courseId, questions, supabase])

  function chooseView(view: Exclude<ViewKey, 'practice'>) {
    setActiveView(view)
    requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function startPractice(chapterId: string, questionId: string | null = null, origin: Exclude<ViewKey, 'practice'> = 'chapters') {
    setSelectedChapterId(chapterId)
    setSelectedQuestionId(questionId)
    setPracticeOrigin(origin)
    setActiveView('practice')
    requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  if (loading) return <main className="workspace-page"><div className="route-loader route-loader--inline"><span className="loader" /><p>正在加载课程…</p></div></main>
  if (!course) return <main className="workspace-page"><div className="empty-state panel"><BookOpen /><strong>课程不存在或暂不可用</strong><Link className="button button--primary" href="/courses">返回课程列表</Link></div></main>

  const percent = progress?.total ? Math.round((progress.attempted / progress.total) * 100) : 0
  const examText = brief?.exam_date
    ? new Date(`${brief.exam_date}T00:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '考试日期待设置'
  const questionCounts = questions.reduce<Record<string, number>>((map, question) => {
    map[question.chapter_id] = (map[question.chapter_id] ?? 0) + 1
    return map
  }, {})
  const chapterNames = Object.fromEntries(chapterRows.map((chapter) => [chapter.id, chapter.title]))
  const questionMap = Object.fromEntries(questions.map((question) => [question.id, question]))
  const wrongQuestions = Object.values(wrongStatuses)
    .map((status) => ({ status, question: questionMap[status.question_id] }))
    .filter((item) => item.question)
    .filter((item) => wrongChapterFilter === 'all' || item.question.chapter_id === wrongChapterFilter)
    .filter((item) => wrongStateFilter === 'all' || item.status.status === wrongStateFilter)
  const selectedReviewContent = selectedReviewId ? reviewNotes[selectedReviewId] ?? '' : ''
  const selectedPracticeChapter = chapterRows.find((chapter) => chapter.id === selectedChapterId)

  return (
    <main className="workspace-page course-workspace">
      <Link className="back-link" href="/courses"><ArrowLeft size={17} />返回课程列表</Link>

      <section className="course-header">
        <div>
          <span className="page-eyebrow">课程工作台</span>
          <h1>{course.title}</h1>
          <p>{course.description || '课程介绍内容整理中，现有章节、题目和学习记录不受影响。'}</p>
          <div className="course-header__meta">
            <span><CalendarDays size={17} />{examText}</span>
            <span><BookOpen size={17} />{chapterRows.length} 个章节</span>
            <span><FileText size={17} />{Object.keys(reviewNotes).length}/{chapterRows.length} 章资料已准备</span>
          </div>
        </div>
        <div className="course-header__action"><div><span>总体进度</span><strong>{percent}%</strong></div><i><b style={{ width: `${percent}%` }} /></i></div>
      </section>

      <nav className="course-tabs" aria-label="课程内容切换">
        {tabItems.map((tab) => (
          <button key={tab.key} type="button" className={(activeView === tab.key || (activeView === 'practice' && practiceOrigin === tab.key)) ? 'is-active' : ''} onClick={() => chooseView(tab.key)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <div ref={contentRef} className="course-tab-content">
        {activeView === 'overview' ? (
          <div className="course-layout">
            <div className="course-main">
              <section className="panel course-next">
                <div><span className="metric-icon"><Play size={21} /></span><div><small>建议下一步</small><h2>{resume ? '继续上次学习' : '从章节目录开始'}</h2><p>{resume ? '系统已经保存你上次停留的章节和题目。' : '选择一个章节，先查看资料或直接进入练习。'}</p></div></div>
                <button className="button button--primary" type="button" onClick={() => resume ? startPractice(resume.chapter_id, resume.last_question_id) : chooseView('chapters')}>{resume ? '继续学习' : '开始学习'}<ArrowRight size={17} /></button>
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>课程信息</h2><p>考试结构、学习建议与作业要求</p></div></div>
                <div className="brief-grid">
                  <article><span><ClipboardList size={20} />考试结构</span>{brief?.exam_structure ? <p>{brief.exam_structure}</p> : <Placeholder />}</article>
                  <article><span><Lightbulb size={20} />学习建议</span>{brief?.study_tips ? <p>{brief.study_tips}</p> : <Placeholder />}</article>
                  <article><span><CheckCircle2 size={20} />作业与考核</span>{brief?.assignments ? <p>{brief.assignments}</p> : <Placeholder />}</article>
                </div>
              </section>
            </div>
            <aside className="course-side">
              <section className="panel">
                <div className="panel-heading"><div><h2>学习状态</h2><p>来自原有学习记录</p></div></div>
                <div className="mastery-summary">
                  <div><span className="mastery-dot is-green" /><span><strong>{progress?.green ?? 0}</strong><small>已掌握</small></span></div>
                  <div><span className="mastery-dot is-yellow" /><span><strong>{progress?.yellow ?? 0}</strong><small>不确定</small></span></div>
                  <div><span className="mastery-dot is-red" /><span><strong>{progress?.red ?? 0}</strong><small>需复习</small></span></div>
                </div>
              </section>
              <section className="panel course-shortcuts">
                <div className="panel-heading"><div><h2>快速入口</h2></div></div>
                <button type="button" onClick={() => chooseView('review')}><span><FileText size={19} /><i><strong>复习资料</strong><small>{Object.keys(reviewNotes).length} 章已准备</small></i></span><ArrowRight size={17} /></button>
                <button type="button" onClick={() => chooseView('chapters')}><span><Target size={19} /><i><strong>章节练习</strong><small>{chapterRows.length} 个章节</small></i></span><ArrowRight size={17} /></button>
                <button type="button" onClick={() => chooseView('wrong')}><span><RotateCcw size={19} /><i><strong>错题本</strong><small>{wrongQuestions.length} 道待复习</small></i></span><ArrowRight size={17} /></button>
              </section>
            </aside>
          </div>
        ) : null}

        {activeView === 'chapters' ? (
          <section className="panel inline-chapter-panel">
            <div className="panel-heading"><div><h2>章节与题库</h2><p>在当前课程页面选择章节并开始练习</p></div><ListChecks size={21} /></div>
            <div className="chapter-table">
              <div className="chapter-table__head"><span>章节</span><span>题目</span><span>完成度</span><span>正确率</span><span>学习状态</span><span>操作</span></div>
              {chapterRows.map((chapter) => {
                const row = chapterProgress[chapter.id]
                const total = row?.total ?? questionCounts[chapter.id] ?? 0
                const complete = total ? Math.round(((row?.attempted ?? 0) / total) * 100) : 0
                const accuracy = row?.attempted ? Math.round((row.green / row.attempted) * 100) : 0
                const state = complete >= 100 ? '已完成' : complete > 0 ? '学习中' : '未开始'
                return (
                  <div className="chapter-table__row" key={chapter.id}>
                    <div><span>{String(chapter.order_index).padStart(2, '0')}</span><strong>{chapter.title}</strong></div>
                    <span>{total} 题</span>
                    <div className="chapter-progress-cell"><i><b style={{ width: `${complete}%` }} /></i><span>{complete}%</span></div>
                    <span>{row?.attempted ? `${accuracy}%` : '—'}</span>
                    <span className={`chapter-state is-${state === '已完成' ? 'done' : state === '学习中' ? 'active' : 'idle'}`}>{state}</span>
                    <button type="button" onClick={() => startPractice(chapter.id)}>{row?.attempted ? '继续练习' : '开始练习'}<ArrowRight size={15} /></button>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {activeView === 'review' ? (
          <div className="inline-review-layout">
            <aside className="panel inline-review-nav">
              <div className="panel-heading"><div><h2>资料目录</h2><p>{Object.keys(reviewNotes).length} 章已准备</p></div></div>
              {chapterRows.map((chapter) => (
                <button key={chapter.id} type="button" className={selectedReviewId === chapter.id ? 'is-active' : ''} disabled={!reviewNotes[chapter.id]} onClick={() => setSelectedReviewId(chapter.id)}>
                  <span>{chapter.order_index}</span><i><strong>{chapter.title}</strong><small>{reviewNotes[chapter.id] ? '可以阅读' : '内容整理中'}</small></i>
                </button>
              ))}
            </aside>
            <section className="panel inline-review-main">
              <div className="inline-review-heading"><div><span className="page-eyebrow">章节复习资料</span><h2>{selectedReviewId ? chapterNames[selectedReviewId] : '请选择章节'}</h2></div>{selectedReviewId ? <button className="button button--primary" type="button" onClick={() => startPractice(selectedReviewId, null, 'review')}>开始本章练习<ArrowRight size={16} /></button> : null}</div>
              {selectedReviewContent ? <ReviewDocument content={selectedReviewContent} /> : <div className="empty-state"><FileText size={26} /><strong>本章资料正在整理</strong><p>可以先进行章节练习，资料补充后会自动显示。</p></div>}
            </section>
          </div>
        ) : null}

        {activeView === 'wrong' ? (
          <section className="panel inline-wrong-panel">
            <div className="panel-heading"><div><h2>错题本</h2><p>按章节和掌握状态复习原有错题记录</p></div><RotateCcw size={21} /></div>
            <div className="wrong-filters">
              <label>章节<select value={wrongChapterFilter} onChange={(event) => setWrongChapterFilter(event.target.value)}><option value="all">全部章节</option>{chapterRows.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
              <label>状态<select value={wrongStateFilter} onChange={(event) => setWrongStateFilter(event.target.value)}><option value="all">全部状态</option><option value="wrong">需复习</option><option value="unsure">不确定</option></select></label>
              <span>共 {wrongQuestions.length} 道</span>
            </div>
            {wrongQuestions.length ? (
              <div className="wrong-table">
                <div className="wrong-table__head"><span>题目</span><span>所属章节</span><span>题型</span><span>错误次数</span><span>状态</span><span>操作</span></div>
                {wrongQuestions.map(({ status, question }) => (
                  <div className="wrong-table__row" key={question.id}>
                    <strong>{question.stem}</strong><span>{chapterNames[question.chapter_id]}</span><span>{question.type}</span><span>{status.wrong_count ?? 1} 次</span><span className={status.status === 'red' ? 'wrong-state is-red' : 'wrong-state is-yellow'}>{status.status === 'red' ? '需复习' : '不确定'}</span><button type="button" onClick={() => startPractice(question.chapter_id, question.id, 'wrong')}>重新作答</button>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state"><CheckCircle2 size={28} /><strong>当前筛选下没有错题</strong><p>继续保持，新的学习记录会自动同步到这里。</p></div>}
          </section>
        ) : null}

        {activeView === 'practice' && selectedChapterId ? (
          <section className="inline-practice-section">
            <div className="inline-practice-heading"><div><span className="page-eyebrow">专注答题</span><h2>{selectedPracticeChapter?.order_index}. {selectedPracticeChapter?.title}</h2></div></div>
            <ChapterPracticeClient
              key={`${selectedChapterId}-${selectedQuestionId ?? 'resume'}`}
              courseId={courseId}
              chapterId={selectedChapterId}
              embedded
              initialQuestionId={selectedQuestionId}
              onProgressChange={refreshLearningProgress}
              onBack={() => {
                void refreshLearningProgress()
                setActiveView(practiceOrigin)
              }}
            />
          </section>
        ) : null}
      </div>
    </main>
  )
}
