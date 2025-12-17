'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type MasteryRow = {
  question_id: string
  status: 'red' | 'yellow' | 'green'
  wrong_count: number
  correct_streak: number
}

type QRow = {
  id: string
  chapter_id: string
  type: string
  stem: string
}

type ChapterRow = {
  id: string
  course_id: string
  title: string
  order_index: number
}

type Item = {
  question_id: string
  status: 'red' | 'yellow'
  wrong_count: number
  correct_streak: number
  stem: string
  type: string
  chapter_id: string
  chapter_title: string
  chapter_order: number
}

export default function CourseWrongbookPage() {
  const params = useParams() as { courseId?: string | string[] }
  const courseIdRaw = params.courseId
  const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!courseId) {
        setStatus('ERROR: courseId missing')
        return
      }

      setStatus('Loading...')
      const { data: sess } = await supabase.auth.getSession()
      const session = sess.session
      if (cancelled) return

      setSessionEmail(session?.user?.email ?? null)
      if (!session) {
        setItems([])
        setStatus('请先登录后查看错题本（错题本是私人数据）')
        return
      }

      // 1) 拉本用户 mastery 中的红/黄（RLS会隔离到当前用户）
      const { data: mRows, error: mErr } = await supabase
        .from('mastery')
        .select('question_id,status,wrong_count,correct_streak')
        .in('status', ['red', 'yellow'])

      if (cancelled) return
      if (mErr) {
        setStatus(`ERROR mastery: ${mErr.message}`)
        return
      }

      const mastery = (mRows ?? []) as MasteryRow[]
      if (mastery.length === 0) {
        setItems([])
        setStatus('OK（当前课程暂无错题 / 不确定题）')
        return
      }

      const qIds = mastery.map((x) => x.question_id)

      // 2) 拉 questions（拿到 chapter_id + stem + type）
      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('id,chapter_id,type,stem')
        .in('id', qIds)

      if (cancelled) return
      if (qErr) {
        setStatus(`ERROR questions: ${qErr.message}`)
        return
      }

      const qRows = (qs ?? []) as QRow[]
      if (qRows.length === 0) {
        setItems([])
        setStatus('OK（未找到题目数据）')
        return
      }

      // 3) 拉这些题目对应的 chapters，用于筛选当前 courseId
      const chapterIds = Array.from(new Set(qRows.map((q) => q.chapter_id)))
      const { data: chs, error: cErr } = await supabase
        .from('chapters')
        .select('id,course_id,title,order_index')
        .in('id', chapterIds)

      if (cancelled) return
      if (cErr) {
        setStatus(`ERROR chapters: ${cErr.message}`)
        return
      }

      const chapters = (chs ?? []) as ChapterRow[]
      const chMap: Record<string, ChapterRow> = {}
      for (const c of chapters) chMap[c.id] = c

      // 4) 合并 + 仅保留属于该课程的题目
      const qMap: Record<string, QRow> = {}
      for (const q of qRows) qMap[q.id] = q

      const merged: Item[] = []
      for (const m of mastery) {
        const q = qMap[m.question_id]
        if (!q) continue
        const ch = chMap[q.chapter_id]
        if (!ch) continue
        if (ch.course_id !== courseId) continue

        merged.push({
          question_id: m.question_id,
          status: m.status as 'red' | 'yellow',
          wrong_count: m.wrong_count ?? 0,
          correct_streak: m.correct_streak ?? 0,
          stem: q.stem,
          type: q.type,
          chapter_id: q.chapter_id,
          chapter_title: ch.title,
          chapter_order: ch.order_index
        })
      }

      // 排序：先章节顺序，再红在前，再错题次数
      merged.sort((a, b) => {
        if (a.chapter_order !== b.chapter_order) return a.chapter_order - b.chapter_order
        if (a.status !== b.status) return a.status === 'red' ? -1 : 1
        if (a.wrong_count !== b.wrong_count) return b.wrong_count - a.wrong_count
        return a.stem.localeCompare(b.stem)
      })

      setItems(merged)
      setStatus('OK')
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, courseId])

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-link" href={`/courses/${courseId}`}>← 返回课程</Link>
        <div className="ui-badge">课程错题本</div>
      </div>

      <div className="ui-status">
        {status}
        {sessionEmail ? `（已登录：${sessionEmail}）` : ''}
      </div>

      {!sessionEmail ? (
        <div className="ui-card">
          <p className="ui-subtitle">错题本需要登录后才能使用。</p>
          <Link className="ui-btn ui-btn-primary" href="/login" style={{ textDecoration: 'none' }}>
            去登录
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="ui-card">
          <p className="ui-subtitle">当前课程暂无错题/不确定题（红/黄）。</p>
        </div>
      ) : (
        <div className="ui-card">
          <div className="ui-row" style={{ justifyContent: 'space-between' }}>
            <h2 className="ui-title" style={{ fontSize: 16 }}>错题总览</h2>
            <span className="ui-badge">{items.length} 题</span>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            {items.map((it) => (
              <div
                key={it.question_id}
                className="ui-card"
                style={{ padding: 12, display: 'grid', gap: 8 }}
              >
                <div className="ui-row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div className="ui-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span
                      className="ui-badge"
                      style={{
                        borderColor: it.status === 'red' ? '#dc2626' : '#ca8a04',
                        color: it.status === 'red' ? '#dc2626' : '#ca8a04'
                      }}
                    >
                      {it.status === 'red' ? '红：做错' : '黄：不确定'}
                    </span>
                    <span className="ui-badge">题型：{it.type}</span>
                    <span className="ui-badge">第{it.chapter_order}章</span>
                    <span className="ui-badge">{it.chapter_title}</span>
                    <span className="ui-badge">错{it.wrong_count}次</span>
                  </div>

                  <Link
                    className="ui-btn ui-btn-primary"
                    href={`/chapters/${it.chapter_id}?q=${it.question_id}&mode=wrongbook`}
                    style={{ textDecoration: 'none' }}
                  >
                    去做这题
                  </Link>
                </div>

                <div style={{ fontWeight: 700 }}>{it.stem}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
