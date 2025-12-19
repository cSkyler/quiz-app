'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Chapter = { id: string; title: string; order_index: number }
type QType = 'tf' | 'single' | 'multi' | 'blank' | 'short' | 'case'
type Q = {
  id: string
  chapter_id: string
  type: QType
  stem: string
  created_at?: string
}
type UQS = { question_id: string; status: 'red' | 'yellow' | 'green' }

export default function WrongbookPage() {
  const params = useParams() as { courseId?: string | string[] }
  const courseIdRaw = params.courseId
  const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])

  const [status, setStatus] = useState('Loading...')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [wrongQuestions, setWrongQuestions] = useState<Q[]>([])
  const [filter, setFilter] = useState<'all' | 'red' | 'yellow'>('all')
  const [query, setQuery] = useState('')

  // chapter map
  const chapterMap = useMemo(() => {
    const m: Record<string, Chapter> = {}
    for (const c of chapters) m[c.id] = c
    return m
  }, [chapters])

  const filtered = useMemo(() => {
    const q = query.trim()
    const base = wrongQuestions.filter((x) => {
      if (!q) return true
      return (x.stem ?? '').toLowerCase().includes(q.toLowerCase())
    })
    return base
  }, [wrongQuestions, query])

  const grouped = useMemo(() => {
    const g: Record<string, Q[]> = {}
    for (const q of filtered) {
      ;(g[q.chapter_id] ||= []).push(q)
    }
    // keep order inside chapter stable
    for (const k of Object.keys(g)) {
      g[k] = g[k].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    }
    return g
  }, [filtered])

  const orderedChapterIds = useMemo(() => {
    const ids = Object.keys(grouped)
    return ids.sort((a, b) => {
      const oa = chapterMap[a]?.order_index ?? 999999
      const ob = chapterMap[b]?.order_index ?? 999999
      if (oa !== ob) return oa - ob
      return (chapterMap[a]?.title ?? '').localeCompare(chapterMap[b]?.title ?? '')
    })
  }, [grouped, chapterMap])

  async function loadAll() {
    setStatus('Loading...')
    if (!courseId) {
      setStatus('ERROR: courseId missing')
      return
    }

    const { data: sess } = await supabase.auth.getSession()
    const uid = sess.session?.user?.id
    if (!uid) {
      setStatus('ERROR: not logged in')
      setWrongQuestions([])
      return
    }

    // 1) chapters
    const { data: chs, error: chErr } = await supabase
      .from('chapters')
      .select('id,title,order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    if (chErr) {
      setStatus(`ERROR chapters: ${chErr.message}`)
      return
    }
    setChapters((chs ?? []) as Chapter[])

    // 2) wrong status rows (red/yellow)
    let s = supabase
      .from('user_question_status')
      .select('question_id,status')
      .eq('user_id', uid)

    if (filter === 'red') s = s.eq('status', 'red')
    else if (filter === 'yellow') s = s.eq('status', 'yellow')
    else s = s.in('status', ['red', 'yellow'])

    const { data: uqs, error: uErr } = await s
    if (uErr) {
      setStatus(`ERROR user_question_status: ${uErr.message}`)
      return
    }

    const qids = (uqs ?? []).map((r: any) => r.question_id).filter(Boolean)
    if (qids.length === 0) {
      setWrongQuestions([])
      setStatus('OK')
      return
    }

    // 3) questions (only those in this course's chapters)
    // 先拿本课程 chapter ids，避免跨课程误入（更稳）
    const chIds = (chs ?? []).map((c: any) => c.id)
    const { data: qs, error: qErr } = await supabase
      .from('questions')
      .select('id,chapter_id,type,stem,created_at')
      .in('id', qids)
      .in('chapter_id', chIds)

    if (qErr) {
      setStatus(`ERROR questions: ${qErr.message}`)
      return
    }

    setWrongQuestions((qs ?? []) as Q[])
    setStatus('OK')
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, filter])

  const totalWrong = wrongQuestions.length

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-btn ui-btn-ghost ui-btn-sm" href={`/courses/${courseId}`}>← 返回课程</Link>
        <div className="ui-row" style={{ gap: 10 }}>
          <Link className="ui-btn ui-btn-ghost ui-btn-sm" href={`/courses/${courseId}/chapters`}>章节列表</Link>
          <button className="ui-btn ui-btn-sm" onClick={loadAll}>刷新</button>
        </div>
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card" style={{ marginTop: 12 }}>
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 className="ui-title" style={{ fontSize: 18, margin: 0 }}>错题本（黄/红）</h1>
          <span className="ui-badge">{totalWrong} 题</span>
        </div>

        <div className="ui-row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
          <span className="ui-badge">筛选</span>
          <select className="ui-select" style={{ maxWidth: 220 }} value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">全部（黄+红）</option>
            <option value="yellow">仅黄</option>
            <option value="red">仅红</option>
          </select>

          <input
            className="ui-input"
            style={{ maxWidth: 420 }}
            placeholder="搜索题干关键词…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {totalWrong === 0 ? (
          <p className="ui-subtitle" style={{ marginTop: 12 }}>暂无错题（黄/红）。</p>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {orderedChapterIds.map((cid) => {
              const ch = chapterMap[cid]
              const list = grouped[cid] ?? []
              const chapterTitle = ch ? `${ch.order_index}. ${ch.title}` : `未知章节（${cid.slice(0, 6)}）`

              return (
                <details key={cid} className="ui-card" style={{ marginTop: 0 }} open>
                  <summary className="ui-row" style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span className="ui-body" style={{ fontWeight: 700 }}>{chapterTitle}</span>
                    <span className="ui-badge">{list.length} 题</span>
                  </summary>

                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    {list.map((q) => (
                      <Link
                        key={q.id}
                        className="ui-item"
                        href={`/courses/${courseId}/chapters/${q.chapter_id}?mode=quiz&from=wrongbook&q=${q.id}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <div className="ui-row" style={{ justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <div className="ui-subtitle">题型：{q.type}</div>
                            <div className="ui-h2 ui-clamp-2">{q.stem}</div>
                          </div>
                          <span className="ui-badge">去做</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
