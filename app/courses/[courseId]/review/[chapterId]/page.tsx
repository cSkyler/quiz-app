'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Chapter = { id: string; title: string; order_index: number }
type NoteRow = { content: string }

const PAGE_SPLITTER = '---PAGE---'
function normalizeNewlines(raw: string): string {
    return (raw ?? '')
      // Windows / old mac
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 有些编辑器/导入会产生 Unicode 分隔符
      .replace(/\u2028|\u2029/g, '\n')
      // 关键兜底：把“转义换行” \\n 还原成真实换行
      .replace(/\\n/g, '\n')
  }
  
  
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function splitPages(raw: string): string[] {
    const s = normalizeNewlines(raw)
    const pages = s
      .split(PAGE_SPLITTER)
      .map((x) => x.trim())
      .filter(Boolean)
    return pages.length ? pages : [s.trim()].filter(Boolean)
  }
  
  
  function splitParagraphs(raw: string): string[] {
    const s = normalizeNewlines(raw).trim()
    if (!s) return []
    return s
      .split(/\n{2,}/g)
      .map((x) => x.trim())
      .filter(Boolean)
  }
  
  

/** 极简渲染：标题(#/##)、无序列表(- )、普通段落 */
function renderBlock(block: string, keyBase: string) {
    const lines = normalizeNewlines(block).split('\n')
  const nodes: any[] = []
  let listBuf: string[] = []

  function flushList() {
    if (listBuf.length) {
      nodes.push(
        <ul key={`${keyBase}-ul-${nodes.length}`} className="ui-review-ul">
          {listBuf.map((t, i) => (
            <li key={`${keyBase}-li-${i}`} className="ui-review-li">
              {t}
            </li>
          ))}
        </ul>
      )
      listBuf = []
    }
  }


lines.forEach((ln, idx) => {
  const line = ln.trim()

// 空行：每一行都增加一次留白（空几行就叠加几次）
if (!line) {
    flushList()
    nodes.push(
        <div
          key={`${keyBase}-gap-${idx}`}
          className="ui-review-gap"
          style={{ height: 18 }}  // 先强行给高度做诊断
        />
      )
      
    return
  }
  


    if (line.startsWith('- ')) {
      listBuf.push(line.slice(2).trim())
      return
    }

    flushList()

    if (line.startsWith('## ')) {
      nodes.push(
        <h3 key={`${keyBase}-h3-${idx}`} className="ui-review-h3">
          {line.slice(3).trim()}
        </h3>
      )
      return
    }

    if (line.startsWith('# ')) {
      nodes.push(
        <h2 key={`${keyBase}-h2-${idx}`} className="ui-review-h2">
          {line.slice(2).trim()}
        </h2>
      )
      return
    }

    nodes.push(
      <p key={`${keyBase}-p-${idx}`} className="ui-review-p">
        {line}
      </p>
    )
  })

  flushList()
  return nodes
}

export default function ReviewReadPage() {
  const params = useParams() as { courseId?: string | string[]; chapterId?: string | string[] }
  const courseIdRaw = params.courseId
  const chapterIdRaw = params.chapterId
  const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw
  const chapterId = Array.isArray(chapterIdRaw) ? chapterIdRaw[0] : chapterIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])
  const pagerRef = useRef<HTMLDivElement | null>(null)

  const [status, setStatus] = useState('Loading...')
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [pages, setPages] = useState<string[]>([])
  const [pageIdx, setPageIdx] = useState(0)

  useEffect(() => {
    ;(async () => {
      if (!courseId || !chapterId) {
        setStatus('ERROR: missing params')
        return
      }

      const { data: ch, error: chErr } = await supabase
        .from('chapters')
        .select('id,title,order_index')
        .eq('id', chapterId)
        .maybeSingle()

      if (chErr) {
        setStatus(`ERROR: ${chErr.message}`)
        return
      }
      setChapter((ch ?? null) as any)

      const { data: note, error: nErr } = await supabase
        .from('chapter_review_notes')
        .select('content')
        .eq('chapter_id', chapterId)
        .eq('course_id', courseId)
        .maybeSingle()

      if (nErr) {
        setStatus(`ERROR: ${nErr.message}`)
        return
      }

      const raw = ((note as NoteRow | null)?.content ?? '') as string
      const ps = splitPages(raw)
      setPages(ps)
      setPageIdx(0)

      requestAnimationFrame(() => {
        if (pagerRef.current) pagerRef.current.scrollTo({ left: 0, behavior: 'auto' as any })
      })

      setStatus('OK')
    })()
  }, [supabase, courseId, chapterId])

  function goTo(i: number) {
    const el = pagerRef.current
    if (!el) return
    const w = el.clientWidth || 1
    const next = clamp(i, 0, Math.max(0, pages.length - 1))
    el.scrollTo({ left: next * w, behavior: 'smooth' })
    setPageIdx(next)
  }

  function onScroll() {
    const el = pagerRef.current
    if (!el) return
    const w = el.clientWidth || 1
    const idx = clamp(Math.round(el.scrollLeft / w), 0, Math.max(0, pages.length - 1))
    if (idx !== pageIdx) setPageIdx(idx)
  }

  // 桌面键盘左右翻页
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') goTo(pageIdx - 1)
      if (e.key === 'ArrowRight') goTo(pageIdx + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdx, pages.length])

  const title = chapter ? `${chapter.order_index}. ${chapter.title}` : '章节复习'

  return (
    <main className="ui-container">
      <div className="ui-topbar ui-review-topbar">
        <Link className="ui-btn ui-btn-ghost ui-btn-sm" href={`/courses/${courseId}/review`}>
          ← 返回复习目录
        </Link>
        <span className="ui-meta">{pages.length ? `${pageIdx + 1}/${pages.length} 页` : ''}</span>
      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card ui-review-card">
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 className="ui-title" style={{ margin: 0 }}>{title}</h1>
          <span className="ui-meta">左右滑动翻页</span>
        </div>

        {pages.length === 0 ? (
          <div className="ui-subtitle" style={{ marginTop: 14 }}>
            本章复习内容尚未导入。请在 Supabase 的 chapter_review_notes 表中填入 content，并用 {PAGE_SPLITTER} 分页。
          </div>
        ) : (
          <div className="ui-review-pager-wrap" style={{ marginTop: 12 }}>
            {/* 横向分页容器：移动端手势滑动；桌面端也可用侧边按钮 */}
            <div ref={pagerRef} className="ui-review-pager" onScroll={onScroll}>
            {pages.map((pg, idx) => {
  const txt = normalizeNewlines(pg)
  return (
    <section key={idx} className="ui-review-page">
      <div className="ui-review-page__inner">{renderBlock(txt, `p${idx}`)}</div>
    </section>
  )
})}


            </div>

            {/* 电脑端：左右透明高级按钮（你红圈位置） */}
            <button
              type="button"
              className="ui-review-side ui-review-side--left"
              onClick={() => goTo(pageIdx - 1)}
              aria-label="上一页"
            >
              <span className="ui-review-side__icon">‹</span>
            </button>
            <button
              type="button"
              className="ui-review-side ui-review-side--right"
              onClick={() => goTo(pageIdx + 1)}
              aria-label="下一页"
            >
              <span className="ui-review-side__icon">›</span>
            </button>

            {/* 手机端：底部圆点分页指示器 */}
            <div className="ui-review-dots" aria-label="分页指示器">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`ui-review-dot ${i === pageIdx ? 'is-active' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`第 ${i + 1} 页`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
