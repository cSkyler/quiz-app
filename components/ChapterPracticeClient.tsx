'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'


type QType = 'tf' | 'single' | 'multi' | 'blank' | 'short' | 'case'

type Q = {
  id: string
  chapter_id: string
  type: QType
  stem: string
  options: any | null
  answer: any
  explanation: string | null
  created_at?: string
}

type MasteryRow = {
  question_id: string
  status: 'red' | 'yellow' | 'green'
  correct_streak: number
  wrong_count: number
}

type Mode = 'all' | QType | 'wrong'

function computeStatus(lastCorrect: boolean, prev?: MasteryRow | null) {
  if (!lastCorrect) return { status: 'red' as const }
  const wrong = prev?.wrong_count ?? 0
  const streak = (prev?.correct_streak ?? 0) + 1
  if (wrong === 0) return { status: 'green' as const }
  if (streak >= 3) return { status: 'green' as const }
  return { status: 'yellow' as const }
}

function normalizeText(s: string) {
  return (s ?? '').toString().trim().toLowerCase()
}

function sameSet(a: string[], b: string[]) {
  const A = [...new Set(a)].sort().join('|')
  const B = [...new Set(b)].sort().join('|')
  return A === B
}

export default function ChapterPracticeClient(props: { chapterId?: string; courseId?: string }) {
  const route = useParams() as { courseId?: string | string[]; chapterId?: string | string[] }
  const sp = useSearchParams()
// URL params: 目录/做题模式 + 题型筛选 + 指定题目

const typeParam = sp.get('type') // tf | single | multi | fill | short | case
const qParam = sp.get('q')       // question id
const viewMode = sp.get('mode') === 'catalog' ? 'catalog' : 'quiz'


  const chapterIdRaw = props.chapterId ?? route.chapterId
  const chapterId = Array.isArray(chapterIdRaw) ? chapterIdRaw[0] : chapterIdRaw

  const courseIdRaw = props.courseId ?? route.courseId ?? sp.get('courseId')
  const courseId = Array.isArray(courseIdRaw) ? courseIdRaw[0] : courseIdRaw

  if (!chapterId || chapterId === 'undefined') {
    return (
      <main className="ui-container">
        <div className="ui-card">
          <p className="ui-subtitle">ERROR: chapterId missing（请从章节列表进入）</p>
        </div>
      </main>
    )
  }

  const backHref = courseId ? `/courses/${courseId}/chapters` : '/chapters'
  const jumpQid = qParam

  const fromWrongbook = sp.get('from') === 'wrongbook'
  const wrongbookHref = courseId ? `/courses/${courseId}/wrongbook` : '/courses'
  const backToCatalogHref = `?mode=catalog${typeParam ? `&type=${typeParam}` : ''}`
const topLeftHref = fromWrongbook ? wrongbookHref : (viewMode === 'quiz' ? backToCatalogHref : backHref)
const topLeftText = fromWrongbook ? '返回错题本' : (viewMode === 'quiz' ? '返回目录' : '返回章节')

  const supabase = useMemo(() => supabaseBrowser(), [])

  const [status, setStatus] = useState('Loading...')
  const [sessionOk, setSessionOk] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [questions, setQuestions] = useState<Q[]>([])
  const [allQuestions, setAllQuestions] = useState<Q[]>([])

  const [idx, setIdx] = useState(0)

  // 模式：全部 / 某题型 / 错题本
  const [mode, setMode] = useState<Mode>('all')

  // 错题本：先总览，再进入做题
  const [wrongOverview, setWrongOverview] = useState(true)

  // 选择/输入状态
  const [pickTf, setPickTf] = useState<'true' | 'false' | null>(null)
  const [pickSingle, setPickSingle] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [pickMulti, setPickMulti] = useState<Record<'A' | 'B' | 'C' | 'D', boolean>>({
    A: false,
    B: false,
    C: false,
    D: false
  })
  const [blankInput, setBlankInput] = useState('')
  const [shortInput, setShortInput] = useState('')
  const [caseInput, setCaseInput] = useState('')

  const [result, setResult] = useState<null | { correct: boolean | null; msg: string }>(null)
  const [masteryMap, setMasteryMap] = useState<Record<string, MasteryRow>>({})



  // ====== 过滤 list（用于“题型切换/错题本”）======
  const filteredList: Q[] = (() => {
    if (mode === 'all') return questions
    if (mode === 'wrong') {
      if (!sessionOk) return []
      return questions.filter((q) => {
        const st = masteryMap[q.id]?.status
        return st === 'red' || st === 'yellow'
      })
    }
    return questions.filter((q) => q.type === mode)
  })()
  const q = filteredList[idx]

 
  // ====== 拉题 + 进度 + mastery ======
useEffect(() => {
  
    let cancelled = false
    

    ;(async () => {
      setStatus('Loading...')
  
      // 1) session
      const { data: sess } = await supabase.auth.getSession()
      const session = sess.session
      if (cancelled) return
  
      setSessionOk(!!session)
      setUserId(session?.user.id ?? null)
  
      // 2) questions
      const { data: qs, error: qsErr } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: true })
  
      if (cancelled) return
      if (qsErr) {
        setStatus(`ERROR questions: ${qsErr.message}`)
        return
      }
  
      const list = (qs ?? []) as Q[]
      setQuestions(list)
      setAllQuestions(list)

      // 3) URL 指定题目：优先跳转（来自错题本）
      if (jumpQid && list.length > 0) {
        const i = list.findIndex((x) => x.id === jumpQid)
        if (i >= 0) {
          setIdx(i)
        } else {
          setStatus(`WARN: qid not found in this chapter: ${jumpQid}`)
        }
      } else if (session && list.length > 0) {
        // 4) 没有 qid 时，才恢复章节进度
        const { data: prog, error: pErr } = await supabase
          .from('chapter_progress')
          .select('last_question_id')
          .eq('user_id', session.user.id)
          .eq('chapter_id', chapterId)
          .maybeSingle()
  
        if (!pErr && prog?.last_question_id) {
          const resumeIndex = list.findIndex((x) => x.id === prog.last_question_id)
          if (resumeIndex >= 0) setIdx(resumeIndex)
        }
      }
  
      // 5) 读取 mastery（关键：否则退出再进错题就“清空”）
      if (session && list.length > 0) {
        const ids = list.map((x) => x.id)
        const { data: mRows, error: mErr } = await supabase
          .from('mastery')
          .select('question_id,status,wrong_count,correct_streak')
          .eq('user_id', session.user.id)
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
  
      if (!cancelled) setStatus('OK')
    })()
  
    return () => {
      cancelled = true
    }
  }, [supabase, chapterId, jumpQid])
  
    
    
      // ====== 保存做到哪一题（用当前正在显示的 q.id，避免和 questions/filteredList 索引错位） ======
      useEffect(() => {
        if (!userId) return
        if (!q?.id) return
      
        // 从错题本“点进来定位某题”时，不覆盖你正常章节进度
        if (fromWrongbook && jumpQid) return
      
        supabase
          .from('chapter_progress')
          .upsert(
            {
              user_id: userId,
              chapter_id: chapterId,
              last_question_id: q.id,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id,chapter_id' }
          )
          .then(({ error }) => {
            if (error) console.log('chapter_progress upsert error:', error.message)
          })
      }, [userId, chapterId, q?.id, supabase, fromWrongbook, jumpQid])
      
      
  // 防止 idx 越界
  useEffect(() => {
    if (filteredList.length === 0) {
      setIdx(0)
      return
    }
    if (idx > filteredList.length - 1) setIdx(0)
  }, [filteredList.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // mode 切换时：清空选择 + 错题本默认回总览
useEffect(() => {
    resetPicks()
    if (mode === 'wrong') setWrongOverview(true)
  
    // 如果 URL 带了 qid/q（从错题本“去做这题”跳转），不要把 idx 重置回 0
    const deep = sp.get('qid') || sp.get('q')
    if (!deep) setIdx(0)
  }, [mode, sp]) // eslint-disable-line react-hooks/exhaustive-deps
  

  

  function resetPicks() {
    setPickTf(null)
    setPickSingle(null)
    setPickMulti({ A: false, B: false, C: false, D: false })
    setBlankInput('')
    setShortInput('')
    setCaseInput('')
    setResult(null)
  }

  async function writeAttemptAndMastery(isCorrect: boolean, chosen: any) {
    if (!sessionOk) return

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
      user_answer: chosen
    })

    if (aErr) {
      setStatus(`ERROR attempts: ${aErr.message}`)
      return
    }

    // mastery upsert（按 user_id + question_id）
    const { data: prev, error: mSelErr } = await supabase
      .from('mastery')
      .select('question_id,status,correct_streak,wrong_count')
      .eq('user_id', uid)
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

    const { error: mUpErr } = await supabase.from('mastery').upsert(
      {
        user_id: uid,
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

  async function submit() {
    if (!q) return

    // 简答/案例：不自动判分，只展示你的回答 + 参考答案/解析
    if (q.type === 'short') {
      if (!shortInput.trim()) {
        setResult({ correct: null, msg: '请先填写你的回答' })
        return
      }
      setResult({ correct: null, msg: '已提交（自评）' })
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        ;(navigator as any).vibrate(12)
      }
      
      return
    }

    if (q.type === 'case') {
      if (!caseInput.trim()) {
        setResult({ correct: null, msg: '请先填写你的回答' })
        return
      }
      setResult({ correct: null, msg: '已提交（自评）' })
      return
    }

    // 自动判分题型：tf / single / multi / blank
    let isCorrect = false
    let chosen: any = null

    if (q.type === 'tf') {
      if (!pickTf) {
        setResult({ correct: false, msg: '请选择“正确/错误”' })
        return
      }
      const c = !!q.answer?.correct
      isCorrect = (pickTf === 'true') === c
      chosen = { pick: pickTf === 'true' }
    }

    if (q.type === 'single') {
      if (!pickSingle) {
        setResult({ correct: false, msg: '请选择 A/B/C/D' })
        return
      }
      const c = q.answer?.correct
      isCorrect = pickSingle === c
      chosen = { pick: pickSingle }
    }

    if (q.type === 'multi') {
      const picked = (['A', 'B', 'C', 'D'] as const).filter((k) => !!pickMulti[k])
      if (picked.length === 0) {
        setResult({ correct: false, msg: '请至少选择一个选项' })
        return
      }
      const cArr = (q.answer?.correct ?? []) as string[]
      isCorrect = sameSet(picked, cArr)
      chosen = { picks: picked }
    }

    if (q.type === 'blank') {
      const input = blankInput.trim()
      if (!input) {
        setResult({ correct: false, msg: '请填写答案' })
        return
      }

      const rawCorrect = q.answer?.correct
      const correctArr: string[] = Array.isArray(rawCorrect)
        ? rawCorrect
        : typeof rawCorrect === 'string'
          ? [rawCorrect]
          : []

      const ok = correctArr.map(normalizeText).includes(normalizeText(input))
      isCorrect = ok
      chosen = { text: input }
    }

    setResult({ correct: isCorrect, msg: isCorrect ? '正确' : '错误' })

// 震动反馈（移动端生效；桌面端不会报错）
if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
  ;(navigator as any).vibrate(isCorrect ? 18 : [25, 40, 25])
}

await writeAttemptAndMastery(isCorrect, chosen)

  }

  function next() {
    if (idx < filteredList.length - 1) {
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

  // ====== UI helpers ======

  function optClass(isPicked: boolean, isCorrectOpt: boolean) {
    // 未提交：只显示选中态
    if (!result) return isPicked ? 'ui-btn ui-opt ui-opt--picked' : 'ui-btn ui-opt'
    // 提交后：正确优先，其次错误选中
    if (isCorrectOpt) return 'ui-btn ui-opt ui-opt--correct'
    if (isPicked && result.correct === false) return 'ui-btn ui-opt ui-opt--wrong'
    return 'ui-btn ui-opt ui-opt--dim'
  }
  

  function masteryBadge(qid: string) {
    const st = masteryMap[qid]?.status
    if (!sessionOk || !st) return null
    const color = st === 'green' ? '#16a34a' : st === 'yellow' ? '#ca8a04' : '#dc2626'
    return (
      <span className="ui-badge" style={{ borderColor: color, color }}>
        掌握度：{st}
      </span>
    )
  }

  // ====== 渲染 ======
  return (
    <main className="ui-container">
      <div className="ui-topbar">
      <Link className="ui-btn ui-btn-ghost ui-btn-sm" href={topLeftHref}>
  ← {topLeftText}
</Link>



        <div className="ui-badge">
          {filteredList.length ? `进度 ${idx + 1}/${filteredList.length}` : '无题目'}
        </div>
      </div>

      <div className="ui-status">{status}</div>

{/* 做题反馈条：替代旧的题型按钮区（仅 quiz 模式显示） */}
{viewMode === 'quiz' && (
  <div
    className={[
      'ui-feedbackbar',
      !result ? 'ui-feedbackbar--idle' : result.correct === true ? 'ui-feedbackbar--ok' : result.correct === false ? 'ui-feedbackbar--bad' : 'ui-feedbackbar--neutral'
    ].join(' ')}
  >
    <div className="ui-feedbackbar__left">
      <div className="ui-feedbackbar__title">
        {!result
          ? '待提交'
          : result.correct === true
            ? '回答正确'
            : result.correct === false
              ? '回答错误'
              : '已提交（自评）'}
      </div>

      <div className="ui-feedbackbar__sub">
        {!result
          ? '选择答案后提交，本题将记录熟练度。'
          : q?.explanation
            ? '已更新熟练度，可查看解析。'
            : '已更新熟练度。'}
      </div>
    </div>

    <div className="ui-feedbackbar__right">
      {/* 错题时展示正确答案（自动判分题型） */}
      {result?.correct === false && q ? (
        <div className="ui-feedbackbar__ans">
          正确：{
            q.type === 'tf'
              ? (q.answer?.correct ? '正确' : '错误')
              : q.type === 'single'
                ? (q.answer?.correct ?? '-')
                : q.type === 'multi'
                  ? ((q.answer?.correct ?? []).join('、') || '-')
                  : q.type === 'blank'
                    ? (Array.isArray(q.answer?.correct) ? q.answer.correct.join(' / ') : (q.answer?.correct ?? '-'))
                    : '-'
          }
        </div>
      ) : (
        <div className="ui-feedbackbar__hint">
          {q ? `题型：${q.type}` : ''}
        </div>
      )}
    </div>
  </div>
)}


{/* 目录模式（先选题，再进入做题） */}
{viewMode === 'catalog' && (
  <div
  className={[
    'ui-card',
    result?.correct === true ? 'ui-card--ok' : '',
    result?.correct === false ? 'ui-card--bad' : '',
    result?.correct === null ? 'ui-card--neutral' : ''
  ].join(' ')}
>

    <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 className="ui-title" style={{ fontSize: 16, margin: 0 }}>题目目录</h2>
      <Link className="ui-btn ui-btn-ghost ui-btn-sm" href="?mode=quiz">
  继续刷题 →
</Link>

    </div>

    {/* 题型 chips：横排滚动 + 中文 */}
<div className="ui-chipbar" style={{ marginTop: 12 }}>
  <Link
    className={!typeParam ? 'ui-btn ui-btn-primary ui-btn-compact' : 'ui-btn ui-btn-compact'}
    href="?mode=catalog"
    style={{ textDecoration: 'none' }}
  >
    全部（{allQuestions.length}）
  </Link>

  {(['tf', 'single', 'multi', 'blank', 'short', 'case'] as QType[]).map((t) => {
    const label =
      t === 'tf' ? '判断' :
      t === 'single' ? '单选' :
      t === 'multi' ? '多选' :
      t === 'blank' ? '填空' :
      t === 'short' ? '简答' :
      '案例'

    const cnt = allQuestions.filter((q) => q.type === t).length

    return (
      <Link
        key={t}
        className={typeParam === t ? 'ui-btn ui-btn-primary ui-btn-compact' : 'ui-btn ui-btn-compact'}
        href={`?mode=catalog&type=${t}`}
        style={{ textDecoration: 'none' }}
      >
        {label}（{cnt}）
      </Link>
    )
  })}
</div>


    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      {allQuestions
        .filter(q => (typeParam ? q.type === typeParam : true))
        .map((it, i) => (
          <Link
            key={it.id}
            className="ui-item"
            href={`?mode=quiz&q=${it.id}`}
            style={{ textDecoration: 'none' }}
          >
            <div className="ui-row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="ui-subtitle">#{i + 1} · {it.type}</div>
                <div className="ui-h2 ui-clamp-2">{it.stem}</div>
              </div>
              <span className="ui-badge">进入</span>
            </div>
          </Link>
        ))}
    </div>
  </div>
)}

      

      {/* 错题本总览 */}
      {mode === 'wrong' && sessionOk && wrongOverview && (
        <div className="ui-card">
          <div className="ui-row" style={{ justifyContent: 'space-between' }}>
            <h2 className="ui-title" style={{ fontSize: 16 }}>错题总览（黄/红）</h2>
            <span className="ui-badge">{filteredList.length} 题</span>
          </div>

          {filteredList.length === 0 ? (
            <p className="ui-subtitle" style={{ marginTop: 10 }}>暂无错题（黄/红）。</p>
          ) : (
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              {filteredList.map((it, i) => {
                const st = masteryMap[it.id]?.status
                const color = st === 'yellow' ? '#ca8a04' : '#dc2626'
                return (
                  <button
                    key={it.id}
                    className="ui-btn"
                    style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 12 }}
                    onClick={() => {
                      setIdx(i)
                      setWrongOverview(false)
                      resetPicks()
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {it.stem?.slice(0, 60) ?? '(无题干)'}{(it.stem?.length ?? 0) > 60 ? '…' : ''}
                    </span>
                    <span className="ui-badge" style={{ borderColor: color, color }}>
                      {st}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 正常做题区（含：错题本点进去后的做题） */}
      {viewMode === 'quiz' && !(mode === 'wrong' && sessionOk && wrongOverview) && (
        !q ? (
          <div className="ui-card">
            <p className="ui-subtitle">
              当前筛选下暂无题目（可切换题型，或去 /admin 录题）。
            </p>
          </div>
        ) : (
          <div className="ui-card">
            <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="ui-badge">题型：{q.type}</div>
              {masteryBadge(q.id)}
            </div>

            {mode === 'wrong' && sessionOk && !wrongOverview && (
              <div style={{ marginTop: 10 }}>
                <button className="ui-btn" onClick={() => setWrongOverview(true)}>← 返回错题总览</button>
              </div>
            )}

            <h2 className="ui-title" style={{ fontSize: 18, marginTop: 12 }}>{q.stem}</h2>

            {/* TF */}
            {q.type === 'tf' && (
              <div className="ui-row" style={{ marginTop: 12 }}>
                <button
  className={optClass(pickTf === 'true', !!q.answer?.correct)}
  onClick={() => setPickTf('true')}
  disabled={!!result}
>
  正确
</button>

<button
  className={optClass(pickTf === 'false', !q.answer?.correct)}
  onClick={() => setPickTf('false')}
  disabled={!!result}
>
  错误
</button>

              </div>
            )}

           {/* SINGLE */}
{q.type === 'single' && (
  <div className="ui-col" style={{ marginTop: 12 }}>
    {(() => {
      const correctKey = q.answer?.correct as 'A' | 'B' | 'C' | 'D' | undefined
      return (q.options ?? []).map((o: any) => {
        const key = o.key as 'A' | 'B' | 'C' | 'D'
        const picked = pickSingle === key
        const isCorrectOpt = !!correctKey && key === correctKey

        return (
          <button
            key={key}
            className={optClass(picked, isCorrectOpt)}
            onClick={() => setPickSingle(key)}
            disabled={!!result}
            style={{ textAlign: 'left' }}
          >
            <span className="ui-opt__k">{key}</span>
            <span className="ui-opt__t">{o.text}</span>
          </button>
        )
      })
    })()}
  </div>
)}


            {/* MULTI */}
            {q.type === 'multi' && (
              <div className="ui-col" style={{ marginTop: 12 }}>
                {(q.options ?? []).map((o: any) => {
                  const key = o.key as 'A' | 'B' | 'C' | 'D'
                  const checked = !!pickMulti[key]
                  return (
                    <button
                      key={key}
                      className="ui-btn"
                      onClick={() => setPickMulti((m) => ({ ...m, [key]: !m[key] }))}
                      disabled={!!result}
                      style={{ textAlign: 'left' }}
                    >
                      {checked ? `✅ ${key}. ${o.text}` : `${key}. ${o.text}`}
                    </button>
                  )
                })}
                <p className="ui-subtitle" style={{ marginTop: 8 }}>
                  提示：多选可重复点选取消。
                </p>
              </div>
            )}

            {/* BLANK */}
            {q.type === 'blank' && (
              <div className="ui-col" style={{ marginTop: 12 }}>
                <input
                  className="ui-input"
                  value={blankInput}
                  onChange={(e) => setBlankInput(e.target.value)}
                  placeholder="请输入答案"
                  disabled={!!result}
                />
                <p className="ui-subtitle" style={{ marginTop: 8 }}>
                  说明：按“标准答案”进行匹配（你可以在 q.answer.correct 里放字符串或字符串数组）。
                </p>
              </div>
            )}

            {/* SHORT */}
            {q.type === 'short' && (
              <div className="ui-col" style={{ marginTop: 12 }}>
                <textarea
                  className="ui-textarea"
                  rows={6}
                  value={shortInput}
                  onChange={(e) => setShortInput(e.target.value)}
                  placeholder="请输入你的回答（提交后显示参考答案/解析，自评对照）"
                  disabled={!!result}
                />
              </div>
            )}

            {/* CASE */}
            {q.type === 'case' && (
              <div className="ui-col" style={{ marginTop: 12 }}>
                <textarea
                  className="ui-textarea"
                  rows={10}
                  value={caseInput}
                  onChange={(e) => setCaseInput(e.target.value)}
                  placeholder="请输入你的案例分析（提交后显示参考答案/解析，自评对照）"
                  disabled={!!result}
                />
              </div>
            )}

            <div className="ui-row" style={{ marginTop: 12 }}>
              <button className="ui-btn ui-btn-primary" onClick={submit} disabled={!!result}>
                提交
              </button>
              <button className="ui-btn" onClick={prev} disabled={idx === 0}>
                上一题
              </button>
              <button className="ui-btn" onClick={next} disabled={idx === filteredList.length - 1}>
                下一题
              </button>
            </div>

            {result && (
              <div className="ui-status" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
                结果：{result.msg}
                {q.explanation ? `\n解析：${q.explanation}` : ''}

                {(q.type === 'short' || q.type === 'case') && (
                  <>
                    {q.type === 'short' ? `\n\n你的回答：\n${shortInput}` : `\n\n你的回答：\n${caseInput}`}
                    {q.answer?.text ? `\n\n参考答案：\n${q.answer.text}` : ''}
                  </>
                )}

                {!sessionOk ? '\n提示：未登录，本次不保存进度/错题。' : ''}
              </div>
            )}
          </div>
        )
      )}
    </main>
  )
}
