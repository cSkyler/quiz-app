'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Chapter = { id: string; title: string; order_index: number }
type QType = 'tf' | 'single' | 'multi' | 'blank' | 'short' | 'case'
type QuestionRow = { id: string; type: QType; stem: string; created_at: string }

type Option = { key: 'A' | 'B' | 'C' | 'D'; text: string }

function parseBlankAnswers(raw: string): string[] {
  // 支持：换行分隔 / 逗号 / 顿号 / 斜杠
  const s = (raw ?? '').trim()
  if (!s) return []
  return s
    .split(/\r?\n|,|，|、|\/|\|/g)
    .map((x) => x.trim())
    .filter(Boolean)
}

function buildOptions(optA: string, optB: string, optC: string, optD: string): Option[] {
  return [
    { key: 'A', text: optA.trim() },
    { key: 'B', text: optB.trim() },
    { key: 'C', text: optC.trim() },
    { key: 'D', text: optD.trim() }
  ]
}

function validateABCD(optA: string, optB: string, optC: string, optD: string) {
  return [optA, optB, optC, optD].every((x) => x.trim().length > 0)
}

export default function ChapterQuestionsPage() {
  const params = useParams() as { chapterId?: string | string[] }
  const chapterIdRaw = params.chapterId
  const chapterId = Array.isArray(chapterIdRaw) ? chapterIdRaw[0] : chapterIdRaw

  const supabase = useMemo(() => supabaseBrowser(), [])

  const [status, setStatus] = useState('Checking auth...')
  const [isAdmin, setIsAdmin] = useState(false)

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)

  // 通用表单
  const [newType, setNewType] = useState<QType>('tf')
  const [newStem, setNewStem] = useState('')
  const [newExplanation, setNewExplanation] = useState('')

  // tf
  const [newTf, setNewTf] = useState<'true' | 'false'>('true')

  // single/multi options
  const [optA, setOptA] = useState('')
  const [optB, setOptB] = useState('')
  const [optC, setOptC] = useState('')
  const [optD, setOptD] = useState('')

  // single correct
  const [singleCorrect, setSingleCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A')

  // multi correct
  const [multiCorrect, setMultiCorrect] = useState<Record<'A' | 'B' | 'C' | 'D', boolean>>({
    A: false,
    B: false,
    C: false,
    D: false
  })

  // blank answers
  const [blankAnswers, setBlankAnswers] = useState('')

  // short/case reference answer
  const [referenceAnswer, setReferenceAnswer] = useState('')

  // bulk import
  const [bulkJson, setBulkJson] = useState('')
  const [importing, setImporting] = useState(false)

  const [adding, setAdding] = useState(false)

  function resetNewForm() {
    setNewStem('')
    setNewExplanation('')

    setNewTf('true')

    setOptA('')
    setOptB('')
    setOptC('')
    setOptD('')

    setSingleCorrect('A')
    setMultiCorrect({ A: false, B: false, C: false, D: false })

    setBlankAnswers('')
    setReferenceAnswer('')
  }

  async function reloadQuestions(chId: string) {
    const { data: qs, error: qErr } = await supabase
      .from('questions')
      .select('id,type,stem,created_at')
      .eq('chapter_id', chId)
      .order('created_at', { ascending: true })

    if (qErr) {
      setStatus(`WARN: reload failed: ${qErr.message}`)
      return
    }
    setQuestions((qs ?? []) as QuestionRow[])
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      if (!chapterId) {
        setStatus('ERROR: chapterId is missing in route params.')
        setLoading(false)
        return
      }

      // auth
      const { data: sess } = await supabase.auth.getSession()
      const user = sess.session?.user
      if (!user) {
        setStatus('Not logged in. Go to /login first.')
        setIsAdmin(false)
        setLoading(false)
        return
      }

      const { data: profile, error: pErr } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (pErr) {
        setStatus(`ERROR reading profile: ${pErr.message}`)
        setIsAdmin(false)
        setLoading(false)
        return
      }

      if (profile?.role !== 'admin') {
        setStatus(`Logged in as ${user.email}, role=${profile?.role}. Not admin.`)
        setIsAdmin(false)
        setLoading(false)
        return
      }

      if (cancelled) return
      setIsAdmin(true)
      setStatus('OK: admin')

      // chapter
      const { data: c, error: cErr } = await supabase
        .from('chapters')
        .select('id,title,order_index')
        .eq('id', chapterId)
        .single()

      if (cErr) {
        setStatus(`ERROR loading chapter: ${cErr.message}`)
        setLoading(false)
        return
      }
      setChapter(c as Chapter)

      // questions
      await reloadQuestions(chapterId)

      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, chapterId])

  async function addQuestion() {
    if (!chapterId) return
    const stem = newStem.trim()
    const explanation = newExplanation.trim() || null

    if (!stem) {
      setStatus('ERROR: 题干不能为空')
      return
    }

    setAdding(true)
    setStatus('Adding question...')

    try {
      // payload: {chapter_id,type,stem,options,answer,explanation}
      let payload: any = null

      if (newType === 'tf') {
        payload = {
          chapter_id: chapterId,
          type: 'tf',
          stem,
          options: null,
          answer: { correct: newTf === 'true' },
          explanation
        }
      } else if (newType === 'single') {
        if (!validateABCD(optA, optB, optC, optD)) {
          throw new Error('单选题：A-D 选项都不能为空')
        }
        payload = {
          chapter_id: chapterId,
          type: 'single',
          stem,
          options: buildOptions(optA, optB, optC, optD),
          answer: { correct: singleCorrect },
          explanation
        }
      } else if (newType === 'multi') {
        if (!validateABCD(optA, optB, optC, optD)) {
          throw new Error('多选题：A-D 选项都不能为空')
        }
        const picks = (Object.keys(multiCorrect) as Array<'A' | 'B' | 'C' | 'D'>).filter((k) => multiCorrect[k])
        if (picks.length === 0) {
          throw new Error('多选题：至少勾选一个正确答案')
        }
        payload = {
          chapter_id: chapterId,
          type: 'multi',
          stem,
          options: buildOptions(optA, optB, optC, optD),
          answer: { correct: picks },
          explanation
        }
      } else if (newType === 'blank') {
        const answers = parseBlankAnswers(blankAnswers)
        if (answers.length === 0) {
          throw new Error('填空题：请填写至少一个标准答案（可多行/逗号/斜杠分隔）')
        }
        payload = {
          chapter_id: chapterId,
          type: 'blank',
          stem,
          options: null,
          answer: { correct: answers },
          explanation
        }
      } else if (newType === 'short' || newType === 'case') {
        const ref = referenceAnswer.trim()
        if (!ref) {
          throw new Error('简答/案例：请填写参考答案（将用于展示比对）')
        }
        payload = {
          chapter_id: chapterId,
          type: newType,
          stem,
          options: null,
          answer: { reference: ref },
          explanation
        }
      }

      const { error } = await supabase.from('questions').insert([payload])
      if (error) throw error

      setStatus('OK: 题目已新增')
      resetNewForm()
      await reloadQuestions(chapterId)
    } catch (e: any) {
      setStatus(`ERROR add: ${e?.message ?? String(e)}`)
    } finally {
      setAdding(false)
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm('确定删除这道题吗？')) return
    setStatus('Deleting question...')

    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) {
      setStatus(`ERROR delete: ${error.message}`)
      return
    }

    setStatus('OK: 题目已删除')
    if (chapterId) await reloadQuestions(chapterId)
  }

  async function bulkImportQuestions() {
    if (!chapterId) return

    const raw = bulkJson.trim()
    if (!raw) {
      setStatus('ERROR: 批量导入内容为空')
      return
    }

    let items: any[] = []
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('JSON 必须是数组')
      items = parsed
    } catch (e: any) {
      setStatus(`ERROR: JSON 解析失败：${e?.message ?? String(e)}`)
      return
    }

    let rows: any[] = []
    try {
      rows = items.map((it, idx) => {
        const type = it?.type as QType
        const stem = (it?.stem ?? '').toString().trim()
        const explanation = (it?.explanation ?? '').toString().trim() || null

        if (!type || !['tf', 'single', 'multi', 'blank', 'short', 'case'].includes(type)) {
          throw new Error(`第 ${idx + 1} 条：type 必须是 tf/single/multi/blank/short/case`)
        }
        if (!stem) throw new Error(`第 ${idx + 1} 条：stem 不能为空`)

        if (type === 'tf') {
          const c = it?.answer?.correct
          if (typeof c !== 'boolean') throw new Error(`第 ${idx + 1} 条：tf 的 answer.correct 必须是 boolean`)
          return { chapter_id: chapterId, type, stem, options: null, answer: { correct: c }, explanation }
        }

        if (type === 'single') {
          const opts = it?.options
          const correct = it?.answer?.correct
          if (!Array.isArray(opts) || opts.length !== 4) throw new Error(`第 ${idx + 1} 条：single options 必须是长度4数组`)
          const keys = opts.map((o: any) => o?.key)
          if (JSON.stringify(keys) !== JSON.stringify(['A', 'B', 'C', 'D'])) {
            throw new Error(`第 ${idx + 1} 条：single options.key 必须依次为 A/B/C/D`)
          }
          if (!['A', 'B', 'C', 'D'].includes(correct)) {
            throw new Error(`第 ${idx + 1} 条：single answer.correct 必须是 A/B/C/D`)
          }
          const textsOk = opts.every((o: any) => (o?.text ?? '').toString().trim().length > 0)
          if (!textsOk) throw new Error(`第 ${idx + 1} 条：single A-D 文本都不能为空`)
          return { chapter_id: chapterId, type, stem, options: opts, answer: { correct }, explanation }
        }

        if (type === 'multi') {
          const opts = it?.options
          const correctArr = it?.answer?.correct
          if (!Array.isArray(opts) || opts.length !== 4) throw new Error(`第 ${idx + 1} 条：multi options 必须是长度4数组`)
          const keys = opts.map((o: any) => o?.key)
          if (JSON.stringify(keys) !== JSON.stringify(['A', 'B', 'C', 'D'])) {
            throw new Error(`第 ${idx + 1} 条：multi options.key 必须依次为 A/B/C/D`)
          }
          const textsOk = opts.every((o: any) => (o?.text ?? '').toString().trim().length > 0)
          if (!textsOk) throw new Error(`第 ${idx + 1} 条：multi A-D 文本都不能为空`)
          if (!Array.isArray(correctArr) || correctArr.length === 0) {
            throw new Error(`第 ${idx + 1} 条：multi answer.correct 必须是数组且至少一个`)
          }
          const ok = correctArr.every((x: any) => ['A', 'B', 'C', 'D'].includes(x))
          if (!ok) throw new Error(`第 ${idx + 1} 条：multi answer.correct 只能包含 A/B/C/D`)
          return { chapter_id: chapterId, type, stem, options: opts, answer: { correct: correctArr }, explanation }
        }

        if (type === 'blank') {
          let corr = it?.answer?.correct
          if (typeof corr === 'string') corr = parseBlankAnswers(corr)
          if (!Array.isArray(corr) || corr.length === 0) {
            throw new Error(`第 ${idx + 1} 条：blank answer.correct 必须是数组（或可解析的字符串）`)
          }
          return { chapter_id: chapterId, type, stem, options: null, answer: { correct: corr }, explanation }
        }

        // short / case
        const ref = it?.answer?.reference
        if (!ref || !ref.toString().trim()) {
          throw new Error(`第 ${idx + 1} 条：${type} answer.reference 必须提供参考答案`)
        }
        return { chapter_id: chapterId, type, stem, options: null, answer: { reference: ref.toString().trim() }, explanation }
      })
    } catch (e: any) {
      setStatus(`ERROR import validate: ${e?.message ?? String(e)}`)
      return
    }

    setImporting(true)
    setStatus(`Importing... ${rows.length} questions`)

    try {
      const chunkSize = 100
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const { error } = await supabase.from('questions').insert(chunk)
        if (error) throw error
      }

      setStatus(`OK: 批量导入成功（${rows.length} 题）`)
      setBulkJson('')
      await reloadQuestions(chapterId)
    } catch (err: any) {
      setStatus(`ERROR import: ${err?.message ?? String(err)}`)
    } finally {
      setImporting(false)
    }
  }

  if (!isAdmin) {
    return (
      <main className="ui-container">
        <div className="ui-topbar">
          <div>
            <h1 className="ui-title">题目管理</h1>
            <p className="ui-subtitle">仅管理员可进入</p>
          </div>
          <div className="ui-row" style={{ gap: 10 }}>
  <Link className="ui-link" href="/">🏠 首页</Link>
  <Link className="ui-link" href="/courses">课程</Link>
  <Link className="ui-link" href="/admin">← 返回章节列表</Link>
</div>

        </div>
        <div className="ui-status">{status}</div>
      </main>
    )
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">题目管理</h1>
          <p className="ui-subtitle">录题 / 批量导入 / 删除</p>
        </div>
        <div className="ui-row" style={{ gap: 10 }}>
  <Link className="ui-link" href="/">🏠 首页</Link>
  <Link className="ui-link" href="/courses">课程</Link>
  <Link className="ui-link" href="/admin">← 返回章节列表</Link>
</div>

      </div>

      <div className="ui-status">{status}</div>

      <div className="ui-card">
        <div className="ui-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="ui-badge">章节</div>
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>
              {chapter ? `${chapter.order_index}. ${chapter.title}` : 'Loading...'}
            </div>
          </div>
          <div className="ui-badge">{questions.length} 题</div>
        </div>
      </div>

      <div className="ui-card">
        <h2 className="ui-title" style={{ fontSize: 16 }}>新增题目</h2>

        <div className="ui-row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
          <span className="ui-badge">题型</span>
          <select
            className="ui-select"
            value={newType}
            onChange={(e) => setNewType(e.target.value as QType)}
            style={{ maxWidth: 260 }}
          >
            <option value="tf">判断题（tf）</option>
            <option value="single">单选题（single）</option>
            <option value="multi">多选题（multi）</option>
            <option value="blank">填空题（blank）</option>
            <option value="short">简答题（short）</option>
            <option value="case">案例分析（case）</option>
          </select>

          <button className="ui-btn" onClick={resetNewForm} disabled={adding}>
            清空表单
          </button>
        </div>

        <div className="ui-col" style={{ marginTop: 10 }}>
          <input
            className="ui-input"
            placeholder="题干（必填）"
            value={newStem}
            onChange={(e) => setNewStem(e.target.value)}
          />
          <textarea
            className="ui-textarea"
            placeholder="解析/解释（可选，建议填写）"
            value={newExplanation}
            onChange={(e) => setNewExplanation(e.target.value)}
            rows={3}
          />
        </div>

        {/* type-specific */}
        <div style={{ marginTop: 12 }}>
          {newType === 'tf' && (
            <div className="ui-card" style={{ padding: 12 }}>
              <div className="ui-badge">判断题设置</div>
              <div className="ui-row" style={{ marginTop: 10 }}>
                <select
                  className="ui-select"
                  value={newTf}
                  onChange={(e) => setNewTf(e.target.value as 'true' | 'false')}
                  style={{ maxWidth: 220 }}
                >
                  <option value="true">正确</option>
                  <option value="false">错误</option>
                </select>
              </div>
            </div>
          )}

          {(newType === 'single' || newType === 'multi') && (
            <div className="ui-card" style={{ padding: 12 }}>
              <div className="ui-badge">{newType === 'single' ? '单选题设置' : '多选题设置'}</div>
              <div className="ui-col" style={{ marginTop: 10 }}>
                <input className="ui-input" placeholder="A 选项" value={optA} onChange={(e) => setOptA(e.target.value)} />
                <input className="ui-input" placeholder="B 选项" value={optB} onChange={(e) => setOptB(e.target.value)} />
                <input className="ui-input" placeholder="C 选项" value={optC} onChange={(e) => setOptC(e.target.value)} />
                <input className="ui-input" placeholder="D 选项" value={optD} onChange={(e) => setOptD(e.target.value)} />
              </div>

              {newType === 'single' ? (
                <div className="ui-row" style={{ marginTop: 10 }}>
                  <span className="ui-badge">正确答案</span>
                  <select
                    className="ui-select"
                    value={singleCorrect}
                    onChange={(e) => setSingleCorrect(e.target.value as 'A' | 'B' | 'C' | 'D')}
                    style={{ maxWidth: 140 }}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <div className="ui-badge">正确答案（可多选）</div>
                  <div className="ui-row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
                    {(['A', 'B', 'C', 'D'] as const).map((k) => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={multiCorrect[k]}
                          onChange={() => setMultiCorrect((m) => ({ ...m, [k]: !m[k] }))}
                        />
                        {k}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {newType === 'blank' && (
            <div className="ui-card" style={{ padding: 12 }}>
              <div className="ui-badge">填空题设置</div>
              <div className="ui-col" style={{ marginTop: 10 }}>
                <textarea
                  className="ui-textarea"
                  placeholder="标准答案（必填）：可多行；或用逗号/斜杠分隔"
                  value={blankAnswers}
                  onChange={(e) => setBlankAnswers(e.target.value)}
                  rows={4}
                />
                <div className="ui-subtitle">示例：2周 / 两周（两种写法都算对）</div>
              </div>
            </div>
          )}

          {(newType === 'short' || newType === 'case') && (
            <div className="ui-card" style={{ padding: 12 }}>
              <div className="ui-badge">{newType === 'short' ? '简答题设置' : '案例分析设置'}</div>
              <div className="ui-col" style={{ marginTop: 10 }}>
                <textarea
                  className="ui-textarea"
                  placeholder="参考答案（必填）：刷题端会显示用于比对"
                  value={referenceAnswer}
                  onChange={(e) => setReferenceAnswer(e.target.value)}
                  rows={6}
                />
              </div>
            </div>
          )}
        </div>

        <div className="ui-row" style={{ marginTop: 12 }}>
          <button className="ui-btn ui-btn-primary" onClick={addQuestion} disabled={adding}>
            {adding ? '添加中...' : '添加题目'}
          </button>
        </div>

        {/* bulk import */}
        <div style={{ marginTop: 16 }}>
          <div className="ui-badge">批量导入（JSON 数组）</div>
          <div className="ui-col" style={{ marginTop: 10 }}>
            <textarea
              className="ui-textarea"
              placeholder='粘贴 JSON 数组。支持 tf/single/multi/blank/short/case。'
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              rows={10}
            />
            <div className="ui-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="ui-btn ui-btn-primary" onClick={bulkImportQuestions} disabled={importing}>
                {importing ? '导入中...' : '批量导入到本章节'}
              </button>
              <button
                className="ui-btn"
                onClick={() =>
                  setBulkJson(
                    JSON.stringify(
                      [
                        {
                          type: 'tf',
                          stem: '抑郁发作的诊断要求症状至少持续2周。',
                          answer: { correct: true },
                          explanation: '常用诊断标准中，抑郁发作持续时间通常至少2周。'
                        },
                        {
                          type: 'single',
                          stem: '抑郁发作诊断中，“症状持续时间”的最低要求是：',
                          options: [
                            { key: 'A', text: '3天' },
                            { key: 'B', text: '1周' },
                            { key: 'C', text: '2周' },
                            { key: 'D', text: '2个月' }
                          ],
                          answer: { correct: 'C' },
                          explanation: '通常至少2周。'
                        },
                        {
                          type: 'multi',
                          stem: '下列哪些属于抑郁发作的常见核心症状？（多选）',
                          options: [
                            { key: 'A', text: '情绪低落' },
                            { key: 'B', text: '夸大观念' },
                            { key: 'C', text: '兴趣/快感缺失' },
                            { key: 'D', text: '精力下降' }
                          ],
                          answer: { correct: ['A', 'C', 'D'] },
                          explanation: '核心症状常见包括情绪低落、兴趣减退、精力不足等。'
                        },
                        {
                          type: 'blank',
                          stem: '重性抑郁发作的最低持续时间通常为____。',
                          answer: { correct: ['2周', '两周'] },
                          explanation: '常见标准：至少2周。'
                        },
                        {
                          type: 'short',
                          stem: '简述抑郁发作与正常悲伤的关键鉴别点。',
                          answer: { reference: '可从诱因、持续时间、程度、功能损害、自责无价值感、快感缺失、躯体症状等方面鉴别。' },
                          explanation: '抓住“功能损害 + 症状谱系 + 持续性”。'
                        },
                        {
                          type: 'case',
                          stem: '案例：某来访近1个月持续情绪低落、兴趣减退、睡眠差、精力不足…请给出可能诊断与理由，并列出鉴别要点。',
                          answer: { reference: '可考虑抑郁发作/抑郁障碍；理由：核心症状+伴随症状+持续时间+功能受损；鉴别：双相、物质/躯体疾病、哀伤反应等。' },
                          explanation: '结构化：诊断—证据—排除/鉴别—评估风险。'
                        }
                      ],
                      null,
                      2
                    )
                  )
                }
                disabled={importing}
              >
                填入示例
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* list */}
      <div className="ui-card">
        <div className="ui-row" style={{ justifyContent: 'space-between' }}>
          <h2 className="ui-title" style={{ fontSize: 16 }}>题目列表</h2>
          <span className="ui-badge">{questions.length} 题</span>
        </div>

        {loading ? (
          <p className="ui-subtitle">Loading...</p>
        ) : questions.length === 0 ? (
          <p className="ui-subtitle">该章节暂无题目。请使用上方表单新增或批量导入。</p>
        ) : (
          <table className="ui-table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ width: 90 }}>题型</th>
                <th>题干</th>
                <th style={{ width: 110 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>
                    <span className="ui-badge">{q.type}</span>
                  </td>
                  <td>{q.stem}</td>
                  <td>
                    <button className="ui-btn ui-btn-danger" onClick={() => deleteQuestion(q.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
