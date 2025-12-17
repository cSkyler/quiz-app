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

function normStr(s: string) {
  return (s ?? '').toString().trim().toLowerCase()
}

function sameSet(a: string[], b: string[]) {
  const A = [...a].sort().join('|')
  const B = [...b].sort().join('|')
  return A === B
}

// tf/single/multi/blank 用：对/错驱动掌握度
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
  const sp = useSearchParams()
const jumpQ = sp.get('q') // 从错题本跳转来的题目ID
const isWrongbookMode = sp.get('mode') === 'wrongbook'


  const supabase = useMemo(() => supabaseBrowser(), [])

  const [status, setStatus] = useState('Loading...')
  const [sessionOk, setSessionOk] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [questions, setQuestions] = useState<Q[]>([])
  const [tab, setTab] = useState<'tf' | 'single' | 'multi' | 'blank' | 'short' | 'case' | 'wrong'>('tf')

  const [idx, setIdx] = useState(0)
  const [masteryMap, setMasteryMap] = useState<Record<string, MasteryRow>>({})

  // wrong tab: 先总览列表，点开再做题
  const [wrongMode, setWrongMode] = useState<'list' | 'practice'>('list')
  const [selectedWrongId, setSelectedWrongId] = useState<string | null>(null)

  // 作答状态
  const [pickTf, setPickTf] = useState<'true' | 'false' | null>(null)
  const [pickSingle, setPickSingle] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [pickMulti, setPickMulti] = useState<Record<'A' | 'B' | 'C' | 'D', boolean>>({
    A: false,
    B: false,
    C: false,
    D: false
  })
  const [blankText, setBlankText] = useState('')
  const [freeText, setFreeText] = useState('') // short/case

  const [result, setResult] = useState<null | { correct: boolean | null; msg: string }>(null)

  // short/case 自评：提交后显示参考，再点按钮写 attempts/mastery
  const [pendingSelfEval, setPendingSelfEval] = useState<null | { qid: string; text: string }>(null)

  function resetPicks() {
    setPickTf(null)
    setPickSingle(null)
    setPickMulti({ A: false, B: false, C: false, D: false })
    setBlankText('')
    setFreeText('')
    setResult(null)
    setPendingSelfEval(null)
  }

  // 过滤列表
  const list: Q[] = useMemo(() => {
    if (tab === 'wrong') {
      // wrong list：只要 red/yellow
      const wrongIds = new Set(
        Object.values(masteryMap)
          .filter((m) => m.status === 'red' || m.status === 'yellow')
          .map((m) => m.question_id)
      )
      return questions.filter((q) => wrongIds.has(q.id))
    }
    return questions.filter((q) => q.type === tab)
  }, [questions, tab, masteryMap])

  // idx 越界保护
  useEffect(() => {
    if (!list.length) {
      setIdx(0)
      return
    }
    if (idx >= list.length) setIdx(0)
  }, [list.length, idx])

  const q = list[idx]

  // 初始加载：session + questions + progress + mastery
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setStatus('Loading...')
      if (!chapterId) {
        setStatus('ERROR: chapterId missing (route param mismatch)')
        return
      }

      const { data: sess } = await supabase.auth.getSession()
      const session = sess.session
      if (cancelled) return

      setSessionOk(!!session)
      setUserId(session?.user.id ?? null)

      // questions：用 created_at 排序（避免 order_index 不存在）
      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (qErr) {
        setStatus(`ERROR questions: ${qErr.message}`)
        return
      }

      const questionsList = (qs ?? []) as Q[]
      setQuestions(questionsList)

      // restore progress
     // 3) jump to a specific question (from wrongbook) OR restore progress
if (session && questionsList.length > 0) {
  if (jumpQ) {
    const jumpIndex = questionsList.findIndex((x) => x.id === jumpQ)
    if (jumpIndex >= 0) setIdx(jumpIndex)
  } else {
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
}


      // mastery
      if (session && questionsList.length > 0) {
        const ids = questionsList.map((x) => x.id)
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

      if (cancelled) return
      setStatus('OK')
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, chapterId])

  // 保存进度：只对“当前过滤后的 list”记录 last_question_id
  useEffect(() => {
    if (!userId) return
    if (!chapterId) return
    if (!list.length) return
    const current = list[idx]
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
  }, [idx, list, userId, supabase, chapterId])

  // 切 tab：重置作答；错题本默认回到总览
  function switchTab(next: typeof tab) {
    setTab(next)
    setIdx(0)
    resetPicks()
    if (next === 'wrong') {
      setWrongMode('list')
      setSelectedWrongId(null)
    }
  }

  async function insertAttemptAndUpsertMastery(args: {
    qid: string
    isCorrect: boolean
    chosen: any
  }) {
    const { data: sess } = await supabase.auth.getSession()
    const uid = sess.session?.user.id
    if (!uid) {
      setStatus('ERROR: not logged in')
      return
    }

    // attempts
    const { error: aErr } = await supabase.from('attempts').insert({
      user_id: uid,
      question_id: args.qid,
      is_correct: args.isCorrect,
      user_answer: args.chosen
    })

    if (aErr) {
      setStatus(`ERROR attempts: ${aErr.message}`)
      return
    }

    // mastery read
    const { data: prev, error: mSelErr } = await supabase
      .from('mastery')
      .select('question_id,status,correct_streak,wrong_count')
      .eq('user_id', uid)
      .eq('question_id', args.qid)
      .maybeSingle()

    if (mSelErr) {
      setStatus(`ERROR mastery read: ${mSelErr.message}`)
      return
    }

    const prevRow = (prev ?? null) as MasteryRow | null
    const wrongCount = (prevRow?.wrong_count ?? 0) + (args.isCorrect ? 0 : 1)
    const correctStreak = args.isCorrect ? (prevRow?.correct_streak ?? 0) + 1 : 0
    const nextStatus = computeStatus(args.isCorrect, prevRow).status

    const { error: mUpErr } = await supabase.from('mastery').upsert(
      {
        user_id: uid,
        question_id: args.qid,
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
      [args.qid]: {
        question_id: args.qid,
        status: nextStatus,
        wrong_count: wrongCount,
        correct_streak: correctStreak
      }
    }))
  }

  async function submit() {
    if (!q) return

    // 游客：允许做题，但不写入 attempts/mastery/progress
    if (!sessionOk) {
      // 仍然要显示结果
    }

    // tf
    if (q.type === 'tf') {
      if (!pickTf) return setResult({ correct: false, msg: '请选择“正确/错误”' })
      const c = !!q.answer?.correct
      const isCorrect = (pickTf === 'true') === c
      const chosen = { pick: pickTf === 'true' }
      setResult({ correct: isCorrect, msg: isCorrect ? '正确' : '错误' })
      if (!sessionOk) return
      await insertAttemptAndUpsertMastery({ qid: q.id, isCorrect, chosen })
      return
    }

    // single
    if (q.type === 'single') {
      if (!pickSingle) return setResult({ correct: false, msg: '请选择 A/B/C/D' })
      const c = q.answer?.correct
      const isCorrect = pickSingle === c
      const chosen = { pick: pickSingle }
      setResult({ correct: isCorrect, msg: isCorrect ? '正确' : '错误' })
      if (!sessionOk) return
      await insertAttemptAndUpsertMastery({ qid: q.id, isCorrect, chosen })
      return
    }

    // multi
    if (q.type === 'multi') {
      const picked = (Object.keys(pickMulti) as Array<'A' | 'B' | 'C' | 'D'>).filter((k) => pickMulti[k])
      if (picked.length === 0) return setResult({ correct: false, msg: '请至少选择一个选项' })
      const correctArr = (q.answer?.correct ?? []) as string[]
      const isCorrect = sameSet(picked, correctArr)
      const chosen = { pick: picked }
      setResult({ correct: isCorrect, msg: isCorrect ? '正确' : '错误' })
      if (!sessionOk) return
      await insertAttemptAndUpsertMastery({ qid: q.id, isCorrect, chosen })
      return
    }

    // blank（标准答案数组：answer.correct = ["2周","两周"]）
    if (q.type === 'blank') {
      const input = normStr(blankText)
      if (!input) return setResult({ correct: false, msg: '请填写你的答案' })

      const correctArr = ((q.answer?.correct ?? []) as string[]).map(normStr)
      const isCorrect = correctArr.includes(input)
      const chosen = { text: blankText }
      setResult({ correct: isCorrect, msg: isCorrect ? '正确' : '错误' })
      if (!sessionOk) return
      await insertAttemptAndUpsertMastery({ qid: q.id, isCorrect, chosen })
      return
    }

    // short/case：先显示“已提交（自评）”，不立刻写入 attempts/mastery；等用户点自评按钮
    if (q.type === 'short' || q.type === 'case') {
      const t = freeText.trim()
      if (!t) return setResult({ correct: null, msg: '请先作答' })

      setResult({ correct: null, msg: '已提交（请自评后记录掌握度）' })
      setPendingSelfEval({ qid: q.id, text: t })
      return
    }
  }

  async function selfEval(mark: 'green' | 'yellow' | 'red') {
    if (!pendingSelfEval) return
    if (!sessionOk) return

    const { data: sess } = await supabase.auth.getSession()
    const uid = sess.session?.user.id
    if (!uid) return

    const qid = pendingSelfEval.qid
    const chosen = { text: pendingSelfEval.text, self: mark }

    // attempts：yellow 用 null 可能会被 boolean 拒绝；这里保守映射：green=true, red=false, yellow=false（但 self 字段保留）
    const isCorrect = mark === 'green' ? true : false

    const { error: aErr } = await supabase.from('attempts').insert({
      user_id: uid,
      question_id: qid,
      is_correct: isCorrect,
      user_answer: chosen
    })
    if (aErr) {
      setStatus(`ERROR attempts: ${aErr.message}`)
      return
    }

    const { data: prev, error: mSelErr } = await supabase
      .from('mastery')
      .select('question_id,status,correct_streak,wrong_count')
      .eq('user_id', uid)
      .eq('question_id', qid)
      .maybeSingle()

    if (mSelErr) {
      setStatus(`ERROR mastery read: ${mSelErr.message}`)
      return
    }

    const prevRow = (prev ?? null) as MasteryRow | null
    const wrongCount =
      (prevRow?.wrong_count ?? 0) + (mark === 'red' ? 1 : 0)
    const correctStreak =
      mark === 'green' ? (prevRow?.correct_streak ?? 0) + 1 : 0

    const nextStatus = mark

    const { error: mUpErr } = await supabase.from('mastery').upsert(
      {
        user_id: uid,
        question_id: qid,
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
      [qid]: {
        question_id: qid,
        status: nextStatus,
        wrong_count: wrongCount,
        correct_streak: correctStreak
      }
    }))

    setPendingSelfEval(null)
    setStatus('OK')
  }

  function next() {
    if (idx < list.length - 1) {
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

  const badgeColor = (s?: 'red' | 'yellow' | 'green') => {
    if (s === 'green') return { borderColor: '#16a34a', color: '#16a34a' }
    if (s === 'yellow') return { borderColor: '#ca8a04', color: '#ca8a04' }
    if (s === 'red') return { borderColor: '#dc2626', color: '#dc2626' }
    return {}
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-link" href="/chapters">
          ← 返回章节
        </Link>
        <div className="ui-badge">
          {list.length ? `进度 ${idx + 1}/${list.length}` : '无题目'}
        </div>
      </div>

      <div className="ui-status">{status}</div>

      {/* 底部题型导航条（你要的那排按钮） */}
      <div className="ui-card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="ui-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="ui-btn" onClick={() => switchTab('tf')} disabled={tab === 'tf'}>判断</button>
          <button className="ui-btn" onClick={() => switchTab('single')} disabled={tab === 'single'}>单选</button>
          <button className="ui-btn" onClick={() => switchTab('multi')} disabled={tab === 'multi'}>多选</button>
          <button className="ui-btn" onClick={() => switchTab('blank')} disabled={tab === 'blank'}>填空</button>
          <button className="ui-btn" onClick={() => switchTab('short')} disabled={tab === 'short'}>简答</button>
          <button className="ui-btn" onClick={() => switchTab('case')} disabled={tab === 'case'}>案例</button>
          <button className="ui-btn ui-btn-danger" onClick={() => switchTab('wrong')} disabled={tab === 'wrong'}>
            错题本
          </button>
          <span className="ui-badge" style={{ marginLeft: 'auto' }}>
            {sessionOk ? '已登录：进度/掌握度会保存' : '未登录：可刷题但不保存'}
          </span>
        </div>
      </div>

      {/* 错题本总览 */}
      {tab === 'wrong' && wrongMode === 'list' ? (
        <div className="ui-card">
          <div className="ui-row" style={{ justifyContent: 'space-between' }}>
            <h2 className="ui-title" style={{ fontSize: 16 }}>错题本（总览）</h2>
            <span className="ui-badge">{list.length} 题</span>
          </div>

          {!sessionOk ? (
            <p className="ui-subtitle">未登录：无法读取个人错题记录。请先登录。</p>
          ) : list.length === 0 ? (
            <p className="ui-subtitle">当前暂无错题（红/黄）。</p>
          ) : (
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              {list.map((it) => {
                const m = masteryMap[it.id]
                return (
                  <div
                    key={it.id}
                    className="ui-card"
                    style={{ padding: 12, cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedWrongId(it.id)
                      setWrongMode('practice')
                      const i = list.findIndex((x) => x.id === it.id)
                      if (i >= 0) setIdx(i)
                      resetPicks()
                    }}
                  >
                    <div className="ui-row" style={{ justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700 }}>{it.stem}</div>
                      <span className="ui-badge" style={badgeColor(m?.status)}>
                        {m?.status ?? '-'}
                      </span>
                    </div>
                    <div className="ui-subtitle" style={{ marginTop: 6 }}>
                      题型：{it.type}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 无题目提示 */}
          {list.length === 0 ? (
            <div className="ui-card">
              <p className="ui-subtitle">当前筛选下暂无题目（可切换题型或去 /admin 录题）。</p>
            </div>
          ) : !q ? (
            <div className="ui-card">
              <p className="ui-subtitle">题目索引越界（已自动回到第1题）。</p>
            </div>
          ) : (
            <div className="ui-card">
              <div className="ui-row" style={{ justifyContent: 'space-between' }}>
                <div className="ui-badge">题型：{q.type}</div>

                {tab === 'wrong' && wrongMode === 'practice' ? (
                  <button
                    className="ui-btn"
                    onClick={() => {
                      setWrongMode('list')
                      setSelectedWrongId(null)
                      resetPicks()
                    }}
                  >
                    ← 返回错题总览
                  </button>
                ) : null}
              </div>

              <div style={{ marginTop: 10 }}>
                {sessionOk && masteryMap[q.id]?.status ? (
                  <span className="ui-badge" style={badgeColor(masteryMap[q.id]?.status)}>
                    掌握度：{masteryMap[q.id].status}
                  </span>
                ) : null}

                <h2 className="ui-title" style={{ fontSize: 18, marginTop: 10 }}>
                  {q.stem}
                </h2>
              </div>

              {/* tf */}
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

              {/* single */}
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

              {/* multi */}
              {q.type === 'multi' && (
                <div className="ui-col" style={{ marginTop: 12 }}>
                  {(q.options ?? []).map((o: any) => {
                    const key = o.key as 'A' | 'B' | 'C' | 'D'
                    const checked = !!pickMulti[key]
                    return (
                      <button
                        key={key}
                        className="ui-btn"
                        onClick={() =>
                          setPickMulti((m) => ({
                            ...m,
                            [key]: !m[key]
                          }))
                        }
                        disabled={!!result}
                        style={{ textAlign: 'left' }}
                      >
                        {checked ? `✅ ${key}. ${o.text}` : `${key}. ${o.text}`}
                      </button>
                    )
                  })}
                  <div className="ui-subtitle" style={{ marginTop: 8 }}>
                    多选：可重复点选切换勾选状态
                  </div>
                </div>
              )}

              {/* blank */}
              {q.type === 'blank' && (
                <div className="ui-col" style={{ marginTop: 12 }}>
                  <input
                    className="ui-input"
                    placeholder="输入你的答案"
                    value={blankText}
                    onChange={(e) => setBlankText(e.target.value)}
                    disabled={!!result}
                  />
                  <div className="ui-subtitle" style={{ marginTop: 8 }}>
                    填空题：将与标准答案（可多个）进行匹配
                  </div>
                </div>
              )}

              {/* short/case */}
              {(q.type === 'short' || q.type === 'case') && (
                <div className="ui-col" style={{ marginTop: 12 }}>
                  <textarea
                    className="ui-textarea"
                    placeholder="在此作答（提交后显示参考答案，你再自评记录掌握度）"
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={6}
                    disabled={!!result}
                  />
                </div>
              )}

              {/* 操作按钮 */}
              <div className="ui-row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                <button className="ui-btn ui-btn-primary" onClick={submit} disabled={!!result}>
                  提交
                </button>
                <button className="ui-btn" onClick={prev} disabled={idx === 0}>
                  上一题
                </button>
                <button className="ui-btn" onClick={next} disabled={idx === list.length - 1}>
                  下一题
                </button>
                <button className="ui-btn" onClick={resetPicks}>
                  重置
                </button>
              </div>

              {/* 结果区 */}
              {result && (
                <div className="ui-status" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
                  结果：{result.msg}
                  {q.explanation ? `\n解析：${q.explanation}` : ''}
                  {!sessionOk ? '\n提示：未登录，本次不保存进度。' : ''}
                  {(q.type === 'short' || q.type === 'case') && q.answer?.reference
                    ? `\n参考答案：${q.answer.reference}`
                    : ''}
                </div>
              )}

              {/* short/case 自评按钮 */}
              {sessionOk && pendingSelfEval && (q.type === 'short' || q.type === 'case') && (
                <div className="ui-card" style={{ marginTop: 12, padding: 12 }}>
                  <div className="ui-badge">自评后写入记录</div>
                  <div className="ui-row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                    <button className="ui-btn" onClick={() => selfEval('green')}>标记为掌握（绿）</button>
                    <button className="ui-btn" onClick={() => selfEval('yellow')}>标记为不确定（黄）</button>
                    <button className="ui-btn ui-btn-danger" onClick={() => selfEval('red')}>标记为没掌握（红）</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}
