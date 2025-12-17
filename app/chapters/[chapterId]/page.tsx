'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Q = {
  id: string
  chapter_id: string
  type: 'tf' | 'single'
  stem: string
  options: any | null
  answer: any
  explanation: string | null
}

type MasteryRow = {
  question_id: string
  status: 'red' | 'yellow' | 'green'
  correct_streak: number
  wrong_count: number
}

function computeStatus(lastCorrect: boolean, prev?: MasteryRow | null) {
  if (!lastCorrect) return { status: 'red' as const }

  const wrong = prev?.wrong_count ?? 0
  const streak = (prev?.correct_streak ?? 0) + 1

  // 从未错过：第一次做对直接绿
  if (wrong === 0) return { status: 'green' as const }

  // 曾经错过：先黄，连续对满3次转绿
  if (streak >= 3) return { status: 'green' as const }
  return { status: 'yellow' as const }
}


export default function ChapterPracticePage() {
  const params = useParams() as { chapterId?: string | string[] }
const chapterIdRaw = params.chapterId
const chapterId = Array.isArray(chapterIdRaw) ? chapterIdRaw[0] : chapterIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])

  const [status, setStatus] = useState('Loading...')
  const [sessionOk, setSessionOk] = useState(false)

  const [questions, setQuestions] = useState<Q[]>([])
  const [idx, setIdx] = useState(0)

  const [pickTf, setPickTf] = useState<'true' | 'false' | null>(null)
  const [pickSingle, setPickSingle] = useState<'A' | 'B' | 'C' | 'D' | null>(null)

  const [result, setResult] = useState<null | { correct: boolean; msg: string }>(null)
  const [masteryMap, setMasteryMap] = useState<Record<string, MasteryRow>>({})
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
  
    ;(async () => {
      setStatus('Loading...')
      if (!chapterId) {
        setStatus('ERROR: chapterId missing (route param mismatch)')
        return
      }
      
      // 1) session
      const { data: sess } = await supabase.auth.getSession()
      const session = sess.session
      if (cancelled) return
  
      setSessionOk(!!session)
      setUserId(session?.user.id ?? null)
  
      // 2) questions
      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapterId)
        
  
      if (cancelled) return
      if (qErr) {
        setStatus(`ERROR questions: ${qErr.message}`)
        return
      }
  
      const questionsList = (qs ?? []) as any[]
      setQuestions(questionsList)
  // 避免从别的章节跳过来 idx 还停在旧值，导致越界显示“暂无题目”
setIdx(0)
setPickTf(null)
setPickSingle(null)
setResult(null)

      // 3) restore progress (only logged-in)
      if (session && questionsList.length > 0) {
        const { data: prog, error: pErr } = await supabase
          .from('chapter_progress')
          .select('last_question_id')
          .eq('user_id', session.user.id)
          .eq('chapter_id', chapterId)
          .maybeSingle()
  
        if (!pErr && prog?.last_question_id) {
          const resumeIndex = questionsList.findIndex((x) => x.id === prog.last_question_id)
          if (resumeIndex >= 0) setIdx(resumeIndex)
        }
      }
  
      // 4) mastery (only logged-in; guests keep empty map)
      if (session && questionsList.length > 0) {
        const ids = questionsList.map((x) => x.id)
        const { data: mRows, error: mErr } = await supabase
          .from('mastery')
          .select('question_id,status,wrong_count,correct_streak')
          .in('question_id', ids)
  
        if (cancelled) return
        if (mErr) {
          setStatus(`ERROR mastery read: ${mErr.message}`)
          return
        }
  
        const map: Record<string, any> = {}
        for (const r of mRows ?? []) map[r.question_id] = r
        setMasteryMap(map)
      } else {
        setMasteryMap({})
      }
  
      if (cancelled) return
      setStatus('OK')
    })()
  
    return () => {
      cancelled = true
    }
  }, [supabase, chapterId])
  
  useEffect(() => {
    if (!userId) return
    if (!questions.length) return
  
    const current = questions[idx]
    if (!current) return
  
    supabase
      .from('chapter_progress')
      .upsert(
        {
          user_id: userId,
          chapter_id: chapterId,
          last_question_id: current.id,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,chapter_id' }
      )
      .then(() => {})
  }, [idx, questions, userId, supabase, chapterId])
  
  const q = questions[idx]

  function resetPicks() {
    setPickTf(null)
    setPickSingle(null)
    setResult(null)
  }

  async function submit() {
    if (!q) return

    let isCorrect = false
    let chosen: any = null

    if (q.type === 'tf') {
      if (!pickTf) return setResult({ correct: false, msg: '请选择“正确/错误”' })
      const c = !!q.answer?.correct
      isCorrect = (pickTf === 'true') === c
      chosen = { pick: pickTf === 'true' }
    } else {
      if (!pickSingle) return setResult({ correct: false, msg: '请选择 A/B/C/D' })
      const c = q.answer?.correct
      isCorrect = pickSingle === c
      chosen = { pick: pickSingle }
    }

    setResult({ correct: isCorrect, msg: isCorrect ? '正确' : '错误' })

    if (!sessionOk) return // 游客不写入

    // 1) 写 attempts（字段名如不一致，你把这里改成你表里的列名）
    // 1) 写 attempts（只给登录用户）
const { data: sess } = await supabase.auth.getSession()
const uid = sess.session?.user.id
if (!uid) {
  setStatus('ERROR attempts: not logged in')
  return
}

const { error: aErr } = await supabase.from('attempts').insert({
  user_id: uid,
  question_id: q.id,
  is_correct: isCorrect,
  user_answer: chosen // 统一用你表里的 user_answer
})

if (aErr) {
  setStatus(`ERROR attempts: ${aErr.message}`)
  return
}


    // 2) upsert mastery（若你 mastery 表字段不同，也只需要改这里）
    const { data: prev, error: mSelErr } = await supabase
      .from('mastery')
      .select('question_id,status,correct_streak,wrong_count')
      .eq('question_id', q.id)
      .maybeSingle()

    if (mSelErr) {
      setStatus(`ERROR mastery read: ${mSelErr.message}`)
      return
    }

    const prevRow = (prev ?? null) as MasteryRow | null

    const wrongCount = (prevRow?.wrong_count ?? 0) + (isCorrect ? 0 : 1)
    const correctStreak = isCorrect ? (prevRow?.correct_streak ?? 0) + 1 : 0
    const nextStatus = computeStatus(isCorrect, prevRow).status

    const { data: sess2 } = await supabase.auth.getSession()
    const uid2 = sess2.session?.user.id
    if (!uid2) {
      setStatus('ERROR mastery upsert: not logged in')
      return
    }
    
    const { error: mUpErr } = await supabase.from('mastery').upsert(
      {
        user_id: uid2,
        question_id: q.id,
        status: nextStatus,
        wrong_count: wrongCount,
        correct_streak: correctStreak
      },
      { onConflict: 'user_id,question_id' }
    )
    
    if (mUpErr) {
      setStatus(`ERROR mastery upsert: ${mUpErr.message}`)
      return
    }
    
    setMasteryMap((prevMap) => ({
      ...prevMap,
      [q.id]: {
        question_id: q.id,
        status: nextStatus,
        wrong_count: wrongCount,
        correct_streak: correctStreak
      }
    }))
    
  }

  function next() {
    if (idx < questions.length - 1) {
      setIdx((x) => x + 1)
      resetPicks()
    }
  }

  function prev() {
    if (idx > 0) {
      setIdx((x) => x - 1)
      resetPicks()
    }
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-link" href="/chapters">← 返回章节</Link>
        <div className="ui-badge">
          {questions.length ? `进度 ${idx + 1}/${questions.length}` : '无题目'}
        </div>
      </div>

      <div className="ui-status">{status}</div>

      {!q ? (
        <div className="ui-card">
          <p className="ui-subtitle">该章节暂无题目，请先在 /admin 录题。</p>
        </div>
      ) : (
        <div className="ui-card">
          <div className="ui-badge">题型：{q.type}</div>
          <div style={{ marginTop: 10 }}>
  {sessionOk && masteryMap[q.id]?.status && (
    <span
      className="ui-badge"
      style={{
        borderColor:
          masteryMap[q.id].status === 'green'
            ? '#16a34a'
            : masteryMap[q.id].status === 'yellow'
              ? '#ca8a04'
              : '#dc2626',
        color:
          masteryMap[q.id].status === 'green'
            ? '#16a34a'
            : masteryMap[q.id].status === 'yellow'
              ? '#ca8a04'
              : '#dc2626'
      }}
    >
      掌握度：{masteryMap[q.id].status}
    </span>
  )}

  <h2 className="ui-title" style={{ fontSize: 18, marginTop: 10 }}>{q.stem}</h2>
</div>


          {q.type === 'tf' && (
            <div className="ui-row" style={{ marginTop: 12 }}>
              <button className="ui-btn" onClick={() => setPickTf('true')} disabled={!!result}>
                {pickTf === 'true' ? '✅ 正确' : '正确'}
              </button>
              <button className="ui-btn" onClick={() => setPickTf('false')} disabled={!!result}>
                {pickTf === 'false' ? '✅ 错误' : '错误'}
              </button>
            </div>
          )}

          {q.type === 'single' && (
            <div className="ui-col" style={{ marginTop: 12 }}>
              {(q.options ?? []).map((o: any) => {
                const key = o.key as 'A' | 'B' | 'C' | 'D'
                return (
                  <button
                    key={key}
                    className="ui-btn"
                    onClick={() => setPickSingle(key)}
                    disabled={!!result}
                    style={{ textAlign: 'left' }}
                  >
                    {pickSingle === key ? `✅ ${key}. ${o.text}` : `${key}. ${o.text}`}
                  </button>
                )
              })}
            </div>
          )}

          <div className="ui-row" style={{ marginTop: 12 }}>
            <button className="ui-btn ui-btn-primary" onClick={submit} disabled={!!result}>
              提交
            </button>
            <button className="ui-btn" onClick={prev} disabled={idx === 0}>
              上一题
            </button>
            <button className="ui-btn" onClick={next} disabled={idx === questions.length - 1}>
              下一题
            </button>
          </div>

          {result && (
            <div className="ui-status" style={{ marginTop: 12 }}>
              结果：{result.msg}
              {q.explanation ? `\n解析：${q.explanation}` : ''}
              {!sessionOk ? '\n提示：未登录，本次不保存进度。' : ''}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
