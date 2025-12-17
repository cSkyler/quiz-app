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
      explanation: null
    }

    const { error } = await supabase.from('questions').insert([payload])

    if (error) {
      setStatus(`ERROR add question: ${error.message}`)
      setAdding(false)
      return
    }

    setNewStem('')
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
      explanation: null
    }

    const { error } = await supabase.from('questions').insert([payload])

    if (error) {
      setStatus(`ERROR add question: ${error.message}`)
      setAddingSingle(false)
      return
    }

    setSingleStem('')
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
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href="/admin" style={{ textDecoration: 'none' }}>← 返回章节列表</Link>
        <h1 style={{ margin: 0 }}>题目管理</h1>
      </div>

      <pre style={{ whiteSpace: 'pre-wrap' }}>{status}</pre>

      {!isAdmin ? null : (
        <>
          <section style={{ marginTop: 12 }}>
            <h2>章节</h2>
            {chapter ? (
              <p>
                {chapter.order_index}. {chapter.title}
              </p>
            ) : (
              <p>Loading chapter...</p>
            )}
          </section>

          <section style={{ marginTop: 12 }}>
            <h2>题目列表</h2>
            <div style={{ margin: '12px 0', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
  <h3 style={{ marginTop: 0 }}>新增题目</h3>

  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
    <span>题型：</span>
    <select
      value={newType}
      onChange={(e) => setNewType(e.target.value as 'tf' | 'single')}
      style={{ padding: 10, maxWidth: 220 }}
    >
      <option value="tf">判断题（tf）</option>
      <option value="single">选择题（single）</option>
    </select>
  </div>

  {newType === 'tf' && (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>判断题（tf）</h4>
      <div style={{ display: 'grid', gap: 8, maxWidth: 700 }}>
        <input
          placeholder="题干（例如：抑郁发作至少持续2周）"
          value={newStem}
          onChange={(e) => setNewStem(e.target.value)}
          style={{ padding: 10 }}
        />
        <select
          value={newTf}
          onChange={(e) => setNewTf(e.target.value as 'true' | 'false')}
          style={{ padding: 10, maxWidth: 200 }}
        >
          <option value="true">正确</option>
          <option value="false">错误</option>
        </select>
        <button onClick={addTfQuestion} disabled={adding} style={{ padding: 10, maxWidth: 200 }}>
          {adding ? '添加中...' : '添加判断题'}
        </button>
      </div>
    </div>
  )}

  {newType === 'single' && (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>选择题（single）</h4>
      <div style={{ display: 'grid', gap: 8, maxWidth: 700 }}>
        <input
          placeholder="题干"
          value={singleStem}
          onChange={(e) => setSingleStem(e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          placeholder="A 选项"
          value={optA}
          onChange={(e) => setOptA(e.target.value)}
          style={{ padding: 10 }}
        />
        <input
          placeholder="B 选项"
          value={optB}
          onChange={(e) => setOptB(e.target.value)}
          style={{ padding: 10 }}
        />
        <input
          placeholder="C 选项"
          value={optC}
          onChange={(e) => setOptC(e.target.value)}
          style={{ padding: 10 }}
        />
        <input
          placeholder="D 选项"
          value={optD}
          onChange={(e) => setOptD(e.target.value)}
          style={{ padding: 10 }}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>正确答案：</span>
          <select
            value={singleCorrect}
            onChange={(e) => setSingleCorrect(e.target.value as 'A' | 'B' | 'C' | 'D')}
            style={{ padding: 10, maxWidth: 120 }}
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>

          <button onClick={addSingleQuestion} disabled={addingSingle} style={{ padding: 10 }}>
            {addingSingle ? '添加中...' : '添加选择题'}
          </button>
        </div>
      </div>
    </div>
  )}
</div>



            {loading ? (
              <p>Loading...</p>
            ) : questions.length === 0 ? (
              <p>该章节暂无题目。请使用上方表单新增题目。</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>题型</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>题干</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{q.type}</td>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{q.stem}</td>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                        <button onClick={() => deleteQuestion(q.id)} style={{ padding: '6px 10px' }}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
  
            )}
          </section>
        </>
      )}
    </main>
  )
}
