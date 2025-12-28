'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Chapter = { id: string; title: string; order_index: number }
type ReviewRow = { chapter_id: string; level: number }

function levelText(level?: number | null) {
  if (level === 2) return '熟知'
  if (level === 1) return '有印象'
  if (level === 0) return '不知道'
  return '未评价'
}

export default function ReviewHomePage() {
  const params = useParams() as { courseId?: string | string[] }
  const courseIdRaw = params.courseId
  const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])
  const [status, setStatus] = useState('Loading...')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [preparedSet, setPreparedSet] = useState<Set<string>>(new Set())
  const [levels, setLevels] = useState<Record<string, number>>({})

  useEffect(() => {
    ;(async () => {
      if (!courseId) {
        setStatus('ERROR: courseId missing')
        return
      }

      // 1) 章节列表
      const { data: chs, error: chErr } = await supabase
        .from('chapters')
        .select('id,title,order_index')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      if (chErr) {
        setStatus(`ERROR: ${chErr.message}`)
        return
      }
      const list = (chs ?? []) as Chapter[]
      setChapters(list)

      // 2) 哪些章已经导入复习文章
      const { data: notes } = await supabase
        .from('chapter_review_notes')
        .select('chapter_id')
        .eq('course_id', courseId)

      const set = new Set<string>((notes ?? []).map((x: any) => x.chapter_id).filter(Boolean))
      setPreparedSet(set)

      // 3) 当前用户的自评等级
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess.session?.user?.id
      if (uid && list.length > 0) {
        const ids = list.map((c) => c.id)
        const { data: prog } = await supabase
          .from('chapter_review_progress')
          .select('chapter_id,level')
          .eq('user_id', uid)
          .in('chapter_id', ids)

        const m: Record<string, number> = {}
        ;((prog ?? []) as ReviewRow[]).forEach((r) => (m[r.chapter_id] = r.level))
        setLevels(m)
      }

      setStatus('OK')
    })()
  }, [supabase, courseId])

  const preparedCount = chapters.filter((c) => preparedSet.has(c.id)).length

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-btn ui-btn-ghost ui-btn-sm" href={`/courses/${courseId}`}>
          ← 返回课程
        </Link>
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card">
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 className="ui-title" style={{ margin: 0 }}>课程复习</h1>
          <span className="ui-meta">已准备 {preparedCount}/{chapters.length} 章</span>
        </div>

        <div style={{ marginTop: 10 }}>
          {chapters.map((c) => {
            const prepared = preparedSet.has(c.id)
            const lv = levels[c.id]
            return (
              <Link
                key={c.id}
                href={prepared ? `/courses/${courseId}/review/${c.id}` : '#'}
                className="ui-card"
                style={{
                  display: 'block',
                  marginTop: 10,
                  textDecoration: 'none',
                  opacity: prepared ? 1 : 0.55,
                  cursor: prepared ? 'pointer' : 'not-allowed',
                }}
                aria-disabled={!prepared}
              >
                <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div className="ui-title" style={{ fontSize: 16, margin: 0 }}>
                    {c.order_index}. {c.title}
                  </div>
                  <span className="ui-meta">{prepared ? '已准备' : '未导入'}</span>
                </div>

                <div className="ui-subtitle" style={{ marginTop: 6 }}>
                  自评：{levelText(lv)}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
