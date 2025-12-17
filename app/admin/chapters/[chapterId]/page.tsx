'use client'

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Chapter = { id: string; title: string; order_index: number }
type Question = { id: string; type: string; stem: string; created_at: string }
type TfAnswer = { correct: boolean }
type SingleOption = { key: 'A' | 'B' | 'C' | 'D'; text: string }
type SingleAnswer = { correct: 'A' | 'B' | 'C' | 'D' }


export default function ChapterQuestionsPage() {
    const routeParams = useParams<{ chapterId: string }>()
    const chapterIdRaw = routeParams?.chapterId
    const chapterId = Array.isArray(chapterIdRaw) ? chapterIdRaw[0] : chapterIdRaw
    


  const [status, setStatus] = useState('Checking auth...')
  const [isAdmin, setIsAdmin] = useState(false)

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [newStem, setNewStem] = useState('')
  const [newTf, setNewTf] = useState<'true' | 'false'>('true')
  const [adding, setAdding] = useState(false)
  const [singleStem, setSingleStem] = useState('')
  const [optA, setOptA] = useState('')
  const [optB, setOptB] = useState('')
  const [optC, setOptC] = useState('')
  const [optD, setOptD] = useState('')
  const [singleCorrect, setSingleCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A')
  const [addingSingle, setAddingSingle] = useState(false)
  const [newType, setNewType] = useState<'tf' | 'single'>('tf')
  const [newExplanation, setNewExplanation] = useState('')
  const [bulkJson, setBulkJson] = useState('')
  const [importing, setImporting] = useState(false)
  
  useEffect(() => {
    async function init() {
        if (!chapterId) {
            setStatus('ERROR: chapterId is missing in route params.')
            return
          }
    
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('Not logged in. Go to /login first.')
        setIsAdmin(false)
        return
      }

      const { data: profile, error: pErr } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (pErr) {
        setStatus(`ERROR reading profile: ${pErr.message}`)
        setIsAdmin(false)
        return
      }

      if (profile?.role !== 'admin') {
        setStatus(`Logged in as ${user.email}, role=${profile?.role}. Not admin.`)
        setIsAdmin(false)
        return
      }

      setIsAdmin(true)
      setStatus('OK: admin')

      // load chapter
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

      // load questions
      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('id,type,stem,created_at')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: true })

      if (qErr) {
        setStatus(`ERROR loading questions: ${qErr.message}`)
        setLoading(false)
        return
      }

      setQuestions((qs ?? []) as Question[])
      setLoading(false)
    }

    init()
  }, [chapterId])
  async function addTfQuestion() {
    if (!chapterId) return
    if (newStem.trim().length === 0) {
      setStatus('ERROR: 题干不能为空')
      return
    }
    
    setAdding(true)
    setStatus('Adding question...')

    const payload = {
      chapter_id: chapterId,
      type: 'tf',
      stem: newStem.trim(),
      options: null,
      answer: { correct: newTf === 'true' } as TfAnswer,
      explanation: newExplanation.trim() || null

    }

    const { error } = await supabase.from('questions').insert([payload])

    if (error) {
      setStatus(`ERROR add question: ${error.message}`)
      setAdding(false)
      return
    }

    setNewStem('')
    setNewExplanation('')

    setNewTf('true')
    setStatus('OK: 判断题已新增')

    const { data: qs, error: qErr } = await supabase
      .from('questions')
      .select('id,type,stem,created_at')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: true })

    if (qErr) setStatus(`WARN: added but reload failed: ${qErr.message}`)
    else setQuestions((qs ?? []) as Question[])

    setAdding(false)
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
  
    // 基础校验 + 组装 payload
    const rows = items.map((it, idx) => {
      const type = it?.type
      const stem = (it?.stem ?? '').toString().trim()
      const explanation = (it?.explanation ?? '').toString().trim()
  
      if (!type || !['tf', 'single'].includes(type)) {
        throw new Error(`第 ${idx + 1} 条：type 必须是 "tf" 或 "single"`)
      }
      if (!stem) {
        throw new Error(`第 ${idx + 1} 条：stem 不能为空`)
      }
  
      if (type === 'tf') {
        const c = it?.answer?.correct
        if (typeof c !== 'boolean') {
          throw new Error(`第 ${idx + 1} 条：tf 的 answer.correct 必须是 true/false`)
        }
        return {
          chapter_id: chapterId,
          type: 'tf',
          stem,
          options: null,
          answer: { correct: c },
          explanation: explanation || null
        }
      }
  
      // single
      const opts = it?.options
      const correct = it?.answer?.correct
      if (!Array.isArray(opts) || opts.length !== 4) {
        throw new Error(`第 ${idx + 1} 条：single 的 options 必须是长度为4的数组（A-D）`)
      }
      const keys = opts.map((o: any) => o?.key)
      const textsOk = opts.every((o: any) => (o?.text ?? '').toString().trim().length > 0)
      if (JSON.stringify(keys) !== JSON.stringify(['A', 'B', 'C', 'D'])) {
        throw new Error(`第 ${idx + 1} 条：single 的 options.key 必须依次为 A/B/C/D`)
      }
      if (!textsOk) {
        throw new Error(`第 ${idx + 1} 条：single 的 A-D 选项文本都不能为空`)
      }
      if (!['A', 'B', 'C', 'D'].includes(correct)) {
        throw new Error(`第 ${idx + 1} 条：single 的 answer.correct 必须是 A/B/C/D`)
      }
  
      return {
        chapter_id: chapterId,
        type: 'single',
        stem,
        options: opts,
        answer: { correct },
        explanation: explanation || null
      }
    })
  
    setImporting(true)
    setStatus(`Importing... ${rows.length} questions`)
  
    try {
      // 分批写入，避免一次太大
      const chunkSize = 100
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const { error } = await supabase.from('questions').insert(chunk)
        if (error) throw error
      }
  
      setStatus(`OK: 批量导入成功（${rows.length} 题）`)
      setBulkJson('')
  
      // 重新加载列表
      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('id,type,stem,created_at')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: true })
  
      if (qErr) setStatus(`WARN: imported but reload failed: ${qErr.message}`)
      else setQuestions((qs ?? []) as Question[])
    } catch (err: any) {
      setStatus(`ERROR import: ${err?.message ?? String(err)}`)
    } finally {
      setImporting(false)
    }
  }
  

  async function addSingleQuestion() {
    if (!chapterId) return
    if (singleStem.trim().length === 0) {
      setStatus('ERROR: 题干不能为空')
      return
    }
    if ([optA, optB, optC, optD].some((x) => x.trim().length === 0)) {
      setStatus('ERROR: 选项 A-D 都不能为空')
      return
    }

    setAddingSingle(true)
    setStatus('Adding single question...')

    const options: SingleOption[] = [
      { key: 'A', text: optA.trim() },
      { key: 'B', text: optB.trim() },
      { key: 'C', text: optC.trim() },
      { key: 'D', text: optD.trim() }
    ]

    const payload = {
      chapter_id: chapterId,
      type: 'single',
      stem: singleStem.trim(),
      options,
      answer: { correct: singleCorrect } as SingleAnswer,
      explanation: newExplanation.trim() || null

    }

    const { error } = await supabase.from('questions').insert([payload])

    if (error) {
      setStatus(`ERROR add question: ${error.message}`)
      setAddingSingle(false)
      return
    }

    setSingleStem('')
    setNewExplanation('')
    setOptA('')
    setOptB('')
    setOptC('')
    setOptD('')
    setSingleCorrect('A')
    setStatus('OK: 选择题已新增')

    const { data: qs, error: qErr } = await supabase
      .from('questions')
      .select('id,type,stem,created_at')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: true })

    if (qErr) setStatus(`WARN: added but reload failed: ${qErr.message}`)
    else setQuestions((qs ?? []) as Question[])

    setAddingSingle(false)
  }
  async function deleteQuestion(id: string) {
    if (!confirm('确定删除这道题吗？')) return
    setStatus('Deleting question...')

    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) {
      setStatus(`ERROR delete question: ${error.message}`)
      return
    }

    setStatus('OK: 题目已删除')

    const { data: qs, error: qErr } = await supabase
      .from('questions')
      .select('id,type,stem,created_at')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: true })

    if (qErr) setStatus(`WARN: deleted but reload failed: ${qErr.message}`)
    else setQuestions((qs ?? []) as Question[])
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">题目管理</h1>
          <p className="ui-subtitle">录题、改题、删题都在这里完成</p>
        </div>
        <Link className="ui-link" href="/admin">← 返回章节列表</Link>
      </div>
  
      <div className="ui-status">{status}</div>
  
      {!isAdmin ? null : (
        <>
          <div className="ui-card">
            <div className="ui-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="ui-badge">章节</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>
                  {chapter ? `${chapter.order_index}. ${chapter.title}` : 'Loading...'}
                </div>
              </div>
            </div>
          </div>
  
          <div className="ui-card">
            <h2 className="ui-title" style={{ fontSize: 16 }}>新增题目</h2>
  
            <div className="ui-row" style={{ marginTop: 10 }}>
              <span className="ui-badge">题型</span>
              <select
                className="ui-select"
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'tf' | 'single')}
                style={{ maxWidth: 260 }}
              >
                <option value="tf">判断题（tf）</option>
                <option value="single">选择题（single）</option>
              </select>
            </div>
  
            <div className="ui-col" style={{ marginTop: 10 }}>
              <textarea
                className="ui-textarea"
                placeholder="解析/解释（可选，建议填写）"
                value={newExplanation}
                onChange={(e) => setNewExplanation(e.target.value)}
                rows={3}
              />
            </div>
            <div style={{ marginTop: 12 }}>
  <div className="ui-badge">批量导入（JSON）</div>
  <div className="ui-col" style={{ marginTop: 10 }}>
    <textarea
      className="ui-textarea"
      placeholder='粘贴 JSON 数组，例如：[{"type":"tf","stem":"...","answer":{"correct":true},"explanation":"..."}]'
      value={bulkJson}
      onChange={(e) => setBulkJson(e.target.value)}
      rows={10}
    />
    <div className="ui-row">
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
                  explanation: '重性抑郁发作通常以持续至少2周为最低时长标准之一。'
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

            <div style={{ marginTop: 12 }}>
              {newType === 'tf' && (
                <div className="ui-card" style={{ padding: 12 }}>
                  <div className="ui-badge">判断题（tf）</div>
                  <div className="ui-col" style={{ marginTop: 10 }}>
                    <input
                      className="ui-input"
                      placeholder="题干（例如：抑郁发作至少持续2周）"
                      value={newStem}
                      onChange={(e) => setNewStem(e.target.value)}
                    />
  
                    <div className="ui-row">
                      <select
                        className="ui-select"
                        value={newTf}
                        onChange={(e) => setNewTf(e.target.value as 'true' | 'false')}
                        style={{ maxWidth: 220 }}
                      >
                        <option value="true">正确</option>
                        <option value="false">错误</option>
                      </select>
  
                      <button className="ui-btn ui-btn-primary" onClick={addTfQuestion} disabled={adding}>
                        {adding ? '添加中...' : '添加判断题'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
  
              {newType === 'single' && (
                <div className="ui-card" style={{ padding: 12 }}>
                  <div className="ui-badge">选择题（single）</div>
                  <div className="ui-col" style={{ marginTop: 10 }}>
                    <input
                      className="ui-input"
                      placeholder="题干"
                      value={singleStem}
                      onChange={(e) => setSingleStem(e.target.value)}
                    />
  
                    <input className="ui-input" placeholder="A 选项" value={optA} onChange={(e) => setOptA(e.target.value)} />
                    <input className="ui-input" placeholder="B 选项" value={optB} onChange={(e) => setOptB(e.target.value)} />
                    <input className="ui-input" placeholder="C 选项" value={optC} onChange={(e) => setOptC(e.target.value)} />
                    <input className="ui-input" placeholder="D 选项" value={optD} onChange={(e) => setOptD(e.target.value)} />
  
                    <div className="ui-row">
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
  
                      <button className="ui-btn ui-btn-primary" onClick={addSingleQuestion} disabled={addingSingle}>
                        {addingSingle ? '添加中...' : '添加选择题'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
  
          <div className="ui-card">
            <div className="ui-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="ui-title" style={{ fontSize: 16 }}>题目列表</h2>
              <span className="ui-badge">{questions.length} 题</span>
            </div>
  
            {loading ? (
              <p className="ui-subtitle">Loading...</p>
            ) : questions.length === 0 ? (
              <p className="ui-subtitle">该章节暂无题目。请使用上方表单新增题目。</p>
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
                      <td><span className="ui-badge">{q.type}</span></td>
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
        </>
      )}
    </main>
  )
  
}
